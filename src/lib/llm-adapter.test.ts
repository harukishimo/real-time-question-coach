import { describe, expect, it, vi } from "vitest";
import {
  buildCoachLlmPayload,
  getCoachAdapter,
  parseCoachProviderResponse,
  validateCoachCandidates
} from "@/lib/llm-adapter";
import { createSessionProfile } from "@/lib/session-profile";
import { createTranscriptSegment } from "@/lib/transcript";
import type { CoachCardCandidate } from "@/lib/types";

const profile = createSessionProfile({
  conversationType: "requirements",
  industry: "it",
  purpose: "権限と保存方針を確認する",
  mustCheckItems: ["権限"],
  audioSource: "dummy",
  consentNoServerStorage: true
});

const finalSegment = createTranscriptSegment({
  sequence: 1,
  text: "権限と保存方針はまだ曖昧です。",
  isFinal: true,
  startedAtMs: 0,
  endedAtMs: 1000
});

function candidate(index: number): CoachCardCandidate {
  return {
    stableKey: `provider-${index}`,
    title: `確認${index}`,
    question: `権限${index}について確認しますか？`,
    reason: "provider test",
    priority: "high",
    score: 90 + index,
    sourceSegmentIds: [finalSegment.id],
    ruleIds: ["provider-test"]
  };
}

describe("LLM coach adapter", () => {
  it("minimizes payload and excludes session id, auth, and provider secrets", () => {
    const payload = buildCoachLlmPayload({
      sessionProfile: profile,
      transcriptSegments: [finalSegment],
      existingCards: []
    });

    expect(payload).toMatchObject({
      schemaVersion: "rqc.coach.v1",
      maxCandidates: 3,
      session: {
        conversationType: "requirements",
        industry: "it"
      }
    });
    expect(JSON.stringify(payload)).not.toContain(profile.id);
    expect(JSON.stringify(payload)).not.toContain("OPENAI_API_KEY");
    expect(payload.recentTranscript).toHaveLength(1);
  });

  it("redacts secret-looking text from LLM payload fields", () => {
    const payload = buildCoachLlmPayload({
      sessionProfile: {
        ...profile,
        purpose: "sk-secret-in-purpose を送らない"
      },
      transcriptSegments: [
        {
          ...finalSegment,
          text: "Bearer abc.def.ghi と sk-secret-in-transcript を含む発話"
        }
      ],
      existingCards: [
        {
          id: "card-secret",
          title: "secret",
          question: "sk-secret-card-question は聞く？",
          reason: "test",
          priority: "high",
          score: 90,
          status: "active",
          sourceSegmentIds: [finalSegment.id],
          ruleIds: ["test"],
          createdAt: new Date(0).toISOString()
        }
      ]
    });

    expect(JSON.stringify(payload)).not.toContain("sk-secret");
    expect(JSON.stringify(payload)).not.toContain("Bearer abc.def.ghi");
    expect(JSON.stringify(payload)).toContain("[REDACTED]");
  });

  it("validates and caps provider candidates to three safe question cards", () => {
    const candidates = validateCoachCandidates([
      candidate(1),
      candidate(2),
      candidate(3),
      candidate(4),
      {
        ...candidate(5),
        question: "<script>alert(1)</script>"
      }
    ]);

    expect(candidates).toHaveLength(3);
    expect(JSON.stringify(candidates)).not.toContain("<script>");
  });

  it("parses OpenAI and Anthropic provider responses into the same schema", () => {
    const openAi = parseCoachProviderResponse(
      {
        output_text: JSON.stringify({
          candidates: [candidate(1)]
        })
      },
      [finalSegment.id]
    );
    const anthropic = parseCoachProviderResponse(
      {
        content: [
          {
            type: "tool_use",
            input: {
              candidates: [candidate(2)]
            }
          }
        ]
      },
      [finalSegment.id]
    );

    expect(openAi[0]).toMatchObject({
      stableKey: "provider-1"
    });
    expect(anthropic[0]).toMatchObject({
      stableKey: "provider-2"
    });
  });

  it("fails closed when real provider env is missing", async () => {
    const result = await getCoachAdapter("anthropic").generateCards({
      sessionProfile: profile,
      transcriptSegments: [finalSegment],
      existingCards: [],
      lastLlmCallAt: 0
    });

    expect(result).toMatchObject({
      provider: "anthropic",
      candidates: [],
      diagnostic: {
        code: "missing_env",
        notRun: true
      }
    });
  });

  it("calls OpenAI adapter with structured output request and parses success response", async () => {
    let capturedBody: BodyInit | null | undefined;
    const fetcher = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      capturedBody = init?.body;
      return new Response(
        JSON.stringify({
          output_text: JSON.stringify({
            candidates: [candidate(1)]
          })
        }),
        { status: 200 }
      );
    });

    const result = await getCoachAdapter("openai").generateCards(
      {
        sessionProfile: profile,
        transcriptSegments: [finalSegment],
        existingCards: [],
        lastLlmCallAt: 0
      },
      {
        apiKey: "server-key",
        model: "gpt-5-mini",
        fetcher: fetcher as unknown as typeof fetch
      }
    );

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(result.diagnostic).toBeUndefined();
    expect(result.candidates).toHaveLength(1);
    expect(String(capturedBody)).not.toContain("server-key");
  });

  it("normalizes provider schema mismatch into a safe diagnostic", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ nope: true }), { status: 200 }));
    const result = await getCoachAdapter("anthropic").generateCards(
      {
        sessionProfile: profile,
        transcriptSegments: [finalSegment],
        existingCards: [],
        lastLlmCallAt: 0
      },
      {
        apiKey: "server-key",
        model: "claude-sonnet-test",
        fetcher: fetcher as unknown as typeof fetch
      }
    );

    expect(result).toMatchObject({
      candidates: [],
      diagnostic: {
        code: "schema_mismatch",
        provider: "anthropic"
      }
    });
  });

  it("normalizes timeout, rate limit, and empty provider responses safely", async () => {
    const timeoutFetcher = vi.fn(async () => {
      throw new Error("request timeout");
    });
    const rateLimitFetcher = vi.fn(async () => new Response("{}", { status: 429 }));
    const emptyFetcher = vi.fn(async () => new Response(JSON.stringify({ output_text: "" }), { status: 200 }));

    const baseInput = {
      sessionProfile: profile,
      transcriptSegments: [finalSegment],
      existingCards: [],
      lastLlmCallAt: 0
    };

    await expect(
      getCoachAdapter("openai").generateCards(baseInput, {
        apiKey: "server-key",
        model: "gpt-5-mini",
        fetcher: timeoutFetcher as unknown as typeof fetch,
        timeoutMs: 10
      })
    ).resolves.toMatchObject({
      diagnostic: {
        code: "provider_timeout"
      }
    });
    await expect(
      getCoachAdapter("openai").generateCards(baseInput, {
        apiKey: "server-key",
        model: "gpt-5-mini",
        fetcher: rateLimitFetcher as unknown as typeof fetch
      })
    ).resolves.toMatchObject({
      diagnostic: {
        code: "rate_limited"
      }
    });
    await expect(
      getCoachAdapter("openai").generateCards(baseInput, {
        apiKey: "server-key",
        model: "gpt-5-mini",
        fetcher: emptyFetcher as unknown as typeof fetch
      })
    ).resolves.toMatchObject({
      diagnostic: {
        code: "schema_mismatch"
      }
    });
  });
});
