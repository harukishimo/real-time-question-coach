import { describe, expect, it, vi } from "vitest";
import {
  buildCoachLlmPayload,
  DEFAULT_COACH_LLM_TIMEOUT_MS,
  getCoachAdapter,
  getOpenAiCoachReasoning,
  OPENAI_COACH_MAX_OUTPUT_TOKENS,
  parseCoachProviderResponse,
  validateCoachCandidates
} from "@/lib/llm-adapter";
import { createSessionProfile } from "@/lib/session-profile";
import { createTranscriptSegment } from "@/lib/transcript";
import type { CoachCard, CoachCardCandidate } from "@/lib/types";

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
    ruleIds: ["provider-test"],
    topicId: `provider:${index}`,
    targetDimension: "why"
  };
}

function existingCard(
  index: number,
  overrides: Partial<CoachCard> = {}
): CoachCard {
  return {
    id: `existing-${index}`,
    title: `既存確認${index}`,
    question: `既存質問${index}は確認済みですか？`,
    reason: "existing test",
    priority: "medium",
    score: 70 + index,
    status: "active",
    sourceSegmentIds: [finalSegment.id],
    ruleIds: ["existing-test"],
    createdAt: new Date(0).toISOString(),
    ...overrides
  };
}

describe("LLM coach adapter", () => {
  it("uses the lowest reasoning effort compatible with the configured OpenAI model", () => {
    expect(getOpenAiCoachReasoning("gpt-5-mini")).toEqual({ effort: "minimal" });
    expect(getOpenAiCoachReasoning("gpt-5.4-mini")).toEqual({ effort: "none" });
    expect(getOpenAiCoachReasoning("gpt-5.4-pro")).toBeUndefined();
    expect(getOpenAiCoachReasoning("gpt-4.1-mini")).toBeUndefined();
  });

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
    expect(payload.transcriptWindow).toMatchObject({
      targetDurationMs: 90_000,
      minFinalSegments: 20,
      maxFinalSegments: 30,
      includedFinalSegments: 1
    });
    expect(payload.topicStates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: "conversation",
          status: "partial"
        })
      ])
    );
    expect(payload.latestFinalTranscript?.text).toBe(finalSegment.text);
    expect(payload.unconfirmedIssues.length).toBeGreaterThan(0);
    expect(payload.triggerReasons.length).toBeGreaterThan(0);
    expect(payload.localCandidateSeeds.length).toBeLessThanOrEqual(3);
    expect(payload).not.toHaveProperty("existingCardQuestions");
  });

  it("sends a bounded multi-turn transcript window and topic evidence for deep dives", () => {
    const transcriptSegments = Array.from({ length: 40 }, (_, index) =>
      createTranscriptSegment({
        sequence: index + 1,
        text:
          index === 39
            ? "導入時期は来月末までで、担当チームは営業部です。"
            : `通常の確定発話${index + 1}です。`,
        isFinal: true,
        startedAtMs: index * 2_000,
        endedAtMs: index * 2_000 + 1_000
      })
    );
    const payload = buildCoachLlmPayload({
      sessionProfile: profile,
      transcriptSegments,
      existingCards: []
    });
    const setupTopic = payload.topicStates.find((topic) => topic.label === "権限");
    const conversationTopics = payload.topicStates.filter(
      (topic) => topic.source === "conversation"
    );

    expect(payload.recentTranscript).toHaveLength(30);
    expect(payload.recentTranscript.at(-1)?.text).toContain("導入時期");
    expect(payload.transcriptWindow.includedFinalSegments).toBe(30);
    expect(conversationTopics.length).toBeGreaterThan(0);
    expect(setupTopic).toMatchObject({
      source: "session_setup",
      status: "not_started"
    });
    expect(
      payload.topicStates.some((topic) =>
        topic.evidence.some((evidence) => evidence.text.includes("担当チーム"))
      )
    ).toBe(true);
  });

  it("redacts secret-looking text from LLM payload fields", () => {
    const payload = buildCoachLlmPayload({
      sessionProfile: {
        ...profile,
        purpose:
          "sk-secret-in-purpose api_key=abc123456789 password=hunter2 client_secret=xyz987654321 を送らない"
      },
      transcriptSegments: [
        {
          ...finalSegment,
          text:
            "Bearer abcdefghijklmnopqrstuvwxyz と sk-secret-in-transcript と AKIA1234567890ABCDEF と eyJaaaaaaaaaaaa.bbbbbbbbbbbb.cccccccccccc を含む発話"
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
    expect(JSON.stringify(payload)).not.toContain("api_key=");
    expect(JSON.stringify(payload)).not.toContain("password=");
    expect(JSON.stringify(payload)).not.toContain("client_secret=");
    expect(JSON.stringify(payload)).not.toContain("Bearer abcdefghijklmnopqrstuvwxyz");
    expect(JSON.stringify(payload)).not.toContain("AKIA1234567890ABCDEF");
    expect(JSON.stringify(payload)).not.toContain("eyJaaaaaaaaaaaa.bbbbbbbbbbbb.cccccccccccc");
    expect(JSON.stringify(payload)).toContain("[REDACTED]");
  });

  it("uses compact duplicate-prevention context instead of stale previous questions", () => {
    const payload = buildCoachLlmPayload({
      sessionProfile: profile,
      transcriptSegments: [finalSegment],
      existingCards: [
        existingCard(1, {
          status: "done",
          question: "古い完了カードの長い質問をLLMへ再送しませんか？"
        }),
        existingCard(2, {
          status: "queued",
          question: "保存方針について後で確認しますか？"
        }),
        existingCard(3, {
          status: "pinned",
          question: "権限について現在表示している質問ですか？"
        })
      ]
    });

    expect(payload).not.toHaveProperty("existingCardQuestions");
    expect(JSON.stringify(payload)).not.toContain("古い完了カードの長い質問");
    expect(JSON.stringify(payload)).not.toContain("保存方針について後で確認");
    expect(payload.duplicatePrevention.activeQuestions).toEqual([
      "権限について現在表示している質問ですか？"
    ]);
    expect(payload.duplicatePrevention.coveredTopics).toContain("権限");
    expect(payload.duplicatePrevention.askedDeepDiveDimensions).toEqual([]);
  });

  it("sends all six displayed questions for duplicate prevention", () => {
    const payload = buildCoachLlmPayload({
      sessionProfile: profile,
      transcriptSegments: [finalSegment],
      existingCards: Array.from({ length: 6 }, (_, index) => existingCard(index + 1))
    });

    expect(payload.duplicatePrevention.activeQuestions).toEqual([
      "既存質問6は確認済みですか？",
      "既存質問5は確認済みですか？",
      "既存質問4は確認済みですか？",
      "既存質問3は確認済みですか？",
      "既存質問2は確認済みですか？",
      "既存質問1は確認済みですか？"
    ]);
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

  it("parses raw OpenAI Responses API output content", () => {
    const openAi = parseCoachProviderResponse(
      {
        output: [
          {
            type: "message",
            content: [
              {
                type: "output_text",
                text: JSON.stringify({
                  candidates: [candidate(1)]
                })
              }
            ]
          }
        ]
      },
      [finalSegment.id]
    );

    expect(openAi[0]).toMatchObject({
      stableKey: "provider-1"
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
    const timeoutSpy = vi.spyOn(AbortSignal, "timeout");
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
    expect(DEFAULT_COACH_LLM_TIMEOUT_MS).toBe(15_000);
    expect(timeoutSpy).toHaveBeenCalledWith(DEFAULT_COACH_LLM_TIMEOUT_MS);
    expect(result.diagnostic).toBeUndefined();
    expect(result.candidates).toHaveLength(1);
    expect(String(capturedBody)).not.toContain("server-key");
    const requestBody = JSON.parse(String(capturedBody)) as {
      input: Array<{ role: string; content: string }>;
      max_output_tokens: number;
      reasoning?: { effort: string };
    };
    const userPayload = JSON.parse(requestBody.input[1].content) as Record<string, unknown>;
    expect(requestBody.input[0].content).toContain("duplicatePrevention.activeQuestions");
    expect(requestBody.input[0].content).toContain("recentTranscript");
    expect(requestBody.input[0].content).toContain("no predefined important or ambiguous keyword");
    expect(requestBody.input[0].content).toContain("topic:<topic id>");
    expect(requestBody.input[0].content).toContain("empty candidates array");
    expect(requestBody.max_output_tokens).toBe(OPENAI_COACH_MAX_OUTPUT_TOKENS);
    expect(requestBody.reasoning).toEqual({ effort: "minimal" });
    expect(userPayload.reviewMode).toBe("local_signal");
    expect(userPayload).toHaveProperty("latestFinalTranscript");
    expect(userPayload).toHaveProperty("unconfirmedIssues");
    expect(userPayload).toHaveProperty("topicStates");
    expect(userPayload).toHaveProperty("transcriptWindow");
    expect(userPayload).toHaveProperty("triggerReasons");
    expect(userPayload).toHaveProperty("localCandidateSeeds");
    expect(userPayload).toHaveProperty("duplicatePrevention");
    expect(userPayload).not.toHaveProperty("existingCardQuestions");
    timeoutSpy.mockRestore();
  });

  it("runs a manual provider review without local seeds and accepts an intentional empty result", async () => {
    let capturedBody: BodyInit | null | undefined;
    const fetcher = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      capturedBody = init?.body;
      return new Response(
        JSON.stringify({
          output_text: JSON.stringify({ candidates: [] })
        }),
        { status: 200 }
      );
    });
    const unrelatedFinal = {
      ...finalSegment,
      id: "seg-manual-provider-review",
      sequence: 2,
      text: "引き続き一般的な話をしています。"
    };

    const result = await getCoachAdapter("openai").generateCards(
      {
        sessionProfile: profile,
        transcriptSegments: [unrelatedFinal],
        existingCards: [
          existingCard(1, {
            title: "目的との接続確認",
            question: `今の話は「${profile.purpose}」のどの確認論点に接続しますか？`,
            ruleIds: ["context-bridge"]
          })
        ],
        lastLlmCallAt: Date.now(),
        manualRecheck: true
      },
      {
        apiKey: "server-key",
        model: "gpt-5-mini",
        fetcher: fetcher as unknown as typeof fetch
      }
    );

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(result.gate).toMatchObject({
      shouldCallLlm: true,
      reasons: ["manual_recheck"]
    });
    expect(result.candidates).toEqual([]);
    expect(result.diagnostic).toBeUndefined();

    const requestBody = JSON.parse(String(capturedBody)) as {
      input: Array<{ role: string; content: string }>;
    };
    const userPayload = JSON.parse(requestBody.input[1].content) as Record<string, unknown>;
    expect(userPayload.reviewMode).toBe("manual_recheck");
    expect(userPayload.triggerReasons).toEqual(["manual_recheck"]);
  });

  it("filters provider candidates that duplicate an already asked topic dimension", async () => {
    const fetcher = vi.fn(async () =>
      new Response(
        JSON.stringify({
          output_text: JSON.stringify({
            candidates: [
              {
                ...candidate(1),
                stableKey: "duplicate-topic",
                question: "権限についてもう一度確認しますか？",
                topicId: "setup:0",
                targetDimension: "why"
              },
              {
                ...candidate(2),
                stableKey: "fresh-topic",
                title: "導入時期の確認",
                question: "導入時期の希望日は決まっていますか？",
                reason: "まだ導入時期が未確認です。",
                ruleIds: ["provider-test"]
              }
            ]
          })
        }),
        { status: 200 }
      )
    );
    const result = await getCoachAdapter("openai").generateCards(
      {
        sessionProfile: profile,
        transcriptSegments: [finalSegment],
        existingCards: [
          existingCard(1, {
            title: "権限の確認",
            question: "権限について現在表示している質問ですか？",
            topicId: "setup:0",
            targetDimension: "why"
          })
        ],
        lastLlmCallAt: 0
      },
      {
        apiKey: "server-key",
        model: "gpt-5-mini",
        fetcher: fetcher as unknown as typeof fetch
      }
    );

    expect(result.candidates.map((item) => item.stableKey)).toEqual(["fresh-topic"]);
  });

  it("allows a new missing dimension on an existing topic and filters the same dimension", async () => {
    const fetcher = vi.fn(async () =>
      new Response(
        JSON.stringify({
          output_text: JSON.stringify({
            candidates: [
              {
                ...candidate(1),
                stableKey: "same-topic-new-dimension",
                question: "権限が必要になった背景は何ですか？",
                ruleIds: ["topic:setup:0", "deep-dive:why"],
                topicId: "setup:0",
                targetDimension: "why"
              },
              {
                ...candidate(2),
                stableKey: "same-topic-same-dimension",
                question: "権限を持つ担当者は他にもいますか？",
                ruleIds: ["topic:setup:0", "deep-dive:who"],
                topicId: "setup:0",
                targetDimension: "who"
              }
            ]
          })
        }),
        { status: 200 }
      )
    );
    const result = await getCoachAdapter("openai").generateCards(
      {
        sessionProfile: profile,
        transcriptSegments: [finalSegment],
        existingCards: [
          existingCard(1, {
            title: "権限の担当確認",
            question: "権限を持つ担当者は誰ですか？",
            ruleIds: ["topic:setup:0", "deep-dive:who"],
            topicId: "setup:0",
            targetDimension: "who"
          })
        ],
        lastLlmCallAt: 0,
        manualRecheck: true
      },
      {
        apiKey: "server-key",
        model: "gpt-5-mini",
        fetcher: fetcher as unknown as typeof fetch
      }
    );

    expect(result.candidates.map((item) => item.stableKey)).toEqual([
      "same-topic-new-dimension"
    ]);
    expect(result.payloadPreview?.duplicatePrevention.askedDeepDiveDimensions).toEqual([
      "topic:setup:0|deep-dive:who"
    ]);
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
      diagnostic: {
        code: "schema_mismatch",
        provider: "anthropic"
      }
    });
    expect(result.candidates.length).toBeGreaterThan(0);
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
      candidates: expect.arrayContaining([
        expect.objectContaining({
          question: expect.stringContaining("確認")
        })
      ]),
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
