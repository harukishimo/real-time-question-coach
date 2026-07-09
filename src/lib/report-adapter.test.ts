import { describe, expect, it, vi } from "vitest";
import {
  buildReportLlmPayload,
  DEFAULT_REPORT_LLM_TIMEOUT_MS,
  generateSessionReportWithProvider,
  parseReportProviderResponse
} from "@/lib/report-adapter";
import { createSessionProfile } from "@/lib/session-profile";
import { createTranscriptSegment } from "@/lib/transcript";
import type { CoachCard } from "@/lib/types";

const profile = createSessionProfile({
  conversationType: "sales",
  industry: "manufacturing",
  purpose: "導入時期と決裁を確認する",
  mustCheckItems: ["決裁"],
  audioSource: "dummy",
  consentNoServerStorage: true
});

const segment = createTranscriptSegment({
  sequence: 1,
  text: "決裁者と導入時期はまだ確認できていません。",
  isFinal: true,
  startedAtMs: 0,
  endedAtMs: 1000
});

const cards: CoachCard[] = [
  {
    id: "card-1",
    title: "決裁確認",
    question: "決裁者は誰ですか？",
    reason: "important",
    priority: "high",
    score: 95,
    status: "active",
    sourceSegmentIds: [segment.id],
    ruleIds: ["important"],
    createdAt: new Date(0).toISOString()
  }
];

describe("LLM report adapter", () => {
  it("builds minimal report payload without session id or provider secrets", () => {
    const payload = buildReportLlmPayload({
      sessionProfile: profile,
      transcriptSegments: [segment],
      cards
    });

    expect(payload).toMatchObject({
      schemaVersion: "rqc.report.v1",
      session: {
        conversationType: "sales",
        industry: "manufacturing"
      }
    });
    expect(JSON.stringify(payload)).not.toContain(profile.id);
    expect(JSON.stringify(payload)).not.toContain("API_KEY");
  });

  it("redacts secret-looking text from report LLM payload", () => {
    const payload = buildReportLlmPayload({
      sessionProfile: {
        ...profile,
        purpose: "sk-secret-report-purpose"
      },
      transcriptSegments: [
        {
          ...segment,
          text: "Bearer report.token.value と sk-secret-report-transcript"
        }
      ],
      cards: [
        {
          ...cards[0],
          question: "sk-secret-report-card を確認？"
        }
      ]
    });

    expect(JSON.stringify(payload)).not.toContain("sk-secret");
    expect(JSON.stringify(payload)).not.toContain("Bearer report.token.value");
    expect(JSON.stringify(payload)).toContain("[REDACTED]");
  });

  it("parses provider report response into SessionReport", () => {
    const fallback = {
      sessionId: profile.id,
      heardItems: [],
      missedItems: [],
      nextActions: [],
      cardStats: { total: 0, done: 0, later: 0, dismissed: 0 },
      generatedAt: new Date(0).toISOString()
    };

    expect(
      parseReportProviderResponse(
        {
          output_text: JSON.stringify({
            heardItems: ["聞けた"],
            missedItems: ["未確認"],
            nextActions: ["次回確認"]
          })
        },
        fallback
      )
    ).toMatchObject({
      heardItems: ["聞けた"],
      missedItems: ["未確認"],
      nextActions: ["次回確認"]
    });
  });

  it("parses raw OpenAI Responses API report output content", () => {
    const fallback = {
      sessionId: profile.id,
      heardItems: [],
      missedItems: [],
      nextActions: [],
      cardStats: { total: 0, done: 0, later: 0, dismissed: 0 },
      generatedAt: new Date(0).toISOString()
    };

    expect(
      parseReportProviderResponse(
        {
          output: [
            {
              type: "message",
              content: [
                {
                  type: "output_text",
                  text: JSON.stringify({
                    heardItems: ["聞けた"],
                    missedItems: ["未確認"],
                    nextActions: ["次回確認"]
                  })
                }
              ]
            }
          ]
        },
        fallback
      )
    ).toMatchObject({
      heardItems: ["聞けた"],
      missedItems: ["未確認"],
      nextActions: ["次回確認"]
    });
  });

  it("uses mock report without real provider execution", async () => {
    const result = await generateSessionReportWithProvider("mock", {
      sessionProfile: profile,
      transcriptSegments: [segment],
      cards
    });

    expect(result).toMatchObject({
      ok: true,
      provider: "mock",
      report: {
        sessionId: profile.id
      }
    });
  });

  it("fails closed when Anthropic report env is missing", async () => {
    const result = await generateSessionReportWithProvider("anthropic", {
      sessionProfile: profile,
      transcriptSegments: [segment],
      cards
    });

    expect(result).toMatchObject({
      ok: false,
      diagnostic: {
        code: "missing_env",
        envNames: ["ANTHROPIC_API_KEY", "LLM_MODEL_REPORT"]
      }
    });
  });

  it("calls OpenAI report adapter and does not put the server key in request body", async () => {
    let capturedBody: BodyInit | null | undefined;
    const timeoutSpy = vi.spyOn(AbortSignal, "timeout");
    const fetcher = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      capturedBody = init?.body;
      return new Response(
        JSON.stringify({
          output_text: JSON.stringify({
            heardItems: ["決裁"],
            missedItems: ["導入時期"],
            nextActions: ["導入時期を確認する"]
          })
        }),
        { status: 200 }
      );
    });

    const result = await generateSessionReportWithProvider(
      "openai",
      {
        sessionProfile: profile,
        transcriptSegments: [segment],
        cards
      },
      {
        apiKey: "server-key",
        model: "gpt-5-mini",
        fetcher: fetcher as unknown as typeof fetch
      }
    );

    expect(result).toMatchObject({
      ok: true,
      provider: "openai"
    });
    expect(timeoutSpy).toHaveBeenCalledWith(DEFAULT_REPORT_LLM_TIMEOUT_MS);
    expect(String(capturedBody)).not.toContain("server-key");
    timeoutSpy.mockRestore();
  });

  it("falls back safely on report schema mismatch", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ invalid: true }), { status: 200 }));

    const result = await generateSessionReportWithProvider(
      "anthropic",
      {
        sessionProfile: profile,
        transcriptSegments: [segment],
        cards
      },
      {
        apiKey: "server-key",
        model: "claude-sonnet-test",
        fetcher: fetcher as unknown as typeof fetch
      }
    );

    expect(result).toMatchObject({
      ok: false,
      diagnostic: {
        code: "schema_mismatch"
      },
      fallbackReport: {
        sessionId: profile.id
      }
    });
  });

  it("parses Anthropic report success and normalizes timeout/rate provider failures", async () => {
    const anthropicSuccess = vi.fn(async () =>
      new Response(
        JSON.stringify({
          content: [
            {
              type: "text",
              text: JSON.stringify({
                heardItems: ["聞けた"],
                missedItems: ["未確認"],
                nextActions: ["次回確認"]
              })
            }
          ]
        }),
        { status: 200 }
      )
    );
    const timeoutFetcher = vi.fn(async () => {
      throw new Error("provider timeout");
    });
    const rateLimitFetcher = vi.fn(async () => new Response("{}", { status: 429 }));

    await expect(
      generateSessionReportWithProvider(
        "anthropic",
        { sessionProfile: profile, transcriptSegments: [segment], cards },
        {
          apiKey: "server-key",
          model: "claude-sonnet-test",
          fetcher: anthropicSuccess as unknown as typeof fetch
        }
      )
    ).resolves.toMatchObject({
      ok: true,
      report: {
        heardItems: ["聞けた"]
      }
    });
    await expect(
      generateSessionReportWithProvider(
        "openai",
        { sessionProfile: profile, transcriptSegments: [segment], cards },
        {
          apiKey: "server-key",
          model: "gpt-5-mini",
          fetcher: timeoutFetcher as unknown as typeof fetch
        }
      )
    ).resolves.toMatchObject({
      ok: false,
      diagnostic: {
        code: "provider_timeout"
      }
    });
    await expect(
      generateSessionReportWithProvider(
        "openai",
        { sessionProfile: profile, transcriptSegments: [segment], cards },
        {
          apiKey: "server-key",
          model: "gpt-5-mini",
          fetcher: rateLimitFetcher as unknown as typeof fetch
        }
      )
    ).resolves.toMatchObject({
      ok: false,
      diagnostic: {
        code: "rate_limited"
      }
    });
  });
});
