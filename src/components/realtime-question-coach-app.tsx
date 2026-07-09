"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  getAudioSourceCapabilities,
  requestAudioSourceStream,
  stopMediaStream
} from "@/lib/audio-source";
import {
  getBrowserAuthConfig,
  getCurrentSupabaseAccessToken,
  getCurrentSupabaseUser,
  signInWithGoogleOAuth
} from "@/lib/auth-client";
import { applyCoachCardCandidates, countCardsByStatus, updateCardStatus } from "@/lib/coach-card";
import { createDummyTranscriptPair } from "@/lib/dummy-transcript";
import { buildJsonExport, buildMarkdownExport } from "@/lib/export";
import {
  connectOpenAiRealtimeTranscription,
  realtimeTranscriptEventToSegment,
  type RealtimeSttConnection
} from "@/lib/realtime-stt-client";
import {
  getAudioSourceLabel,
  getConversationTypeLabel,
  getIndustryLabel,
  normalizeMustCheckItems
} from "@/lib/session-profile";
import { decideCoachDispatch } from "@/lib/rule-gate";
import type { SttTokenResponse } from "@/lib/stt";
import { mergeTranscriptSegment } from "@/lib/transcript";
import type {
  AudioSourceType,
  AuthUser,
  CoachCard,
  ConversationType,
  Industry,
  SessionProfile,
  SessionReport,
  SessionSetupInput,
  TranscriptSegment
} from "@/lib/types";

type Screen = "login" | "setup" | "session" | "report";

const initialSetup = {
  conversationType: "requirements" as ConversationType,
  industry: "it" as Industry,
  purpose: "MVPで必ず確認すべき要件とリスクを整理する",
  mustCheckText: "権限\n保存方針\n導入時期",
  audioSource: "dummy" as AudioSourceType,
  consentNoServerStorage: true
};

function downloadText(filename: string, text: string, type: string) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function requestHeaders(): Promise<Record<string, string>> {
  const config = getBrowserAuthConfig();
  const headers: Record<string, string> = {
    "Content-Type": "application/json"
  };

  if (config.authMode === "mock") {
    headers["x-rqc-dev-user"] = "true";
    headers["x-rqc-role"] = "owner";
    return headers;
  }

  const accessToken = await getCurrentSupabaseAccessToken();
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  return headers;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: await requestHeaders(),
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed: ${response.status}`);
  }

  return (await response.json()) as T;
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    method: "GET",
    headers: await requestHeaders()
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed: ${response.status}`);
  }

  return (await response.json()) as T;
}

export function RealtimeQuestionCoachApp() {
  const [screen, setScreen] = useState<Screen>("login");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [setup, setSetup] = useState(initialSetup);
  const [sessionProfile, setSessionProfile] = useState<SessionProfile | null>(null);
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [partialSegment, setPartialSegment] = useState<TranscriptSegment | null>(null);
  const [cards, setCards] = useState<CoachCard[]>([]);
  const [report, setReport] = useState<SessionReport | null>(null);
  const [dummyIndex, setDummyIndex] = useState(0);
  const [lastLlmCallAt, setLastLlmCallAt] = useState(0);
  const [lastDispatchKey, setLastDispatchKey] = useState<string | null>(null);
  const [coachInFlight, setCoachInFlight] = useState(false);
  const [sttActive, setSttActive] = useState(false);
  const [statusMessage, setStatusMessage] = useState("Google OAuth adapter is using local mock fallback.");
  const lastDispatchKeyRef = useRef<string | null>(null);
  const coachInFlightRef = useRef(false);
  const sessionProfileRef = useRef<SessionProfile | null>(null);
  const cardsRef = useRef<CoachCard[]>([]);
  const lastLlmCallAtRef = useRef(0);
  const sttConnectionRef = useRef<RealtimeSttConnection | null>(null);
  const sttSequenceRef = useRef(0);
  const sttSequenceByProviderItemRef = useRef<Map<string, number>>(new Map());

  const capabilities = useMemo(() => getAudioSourceCapabilities(globalThis.navigator), []);
  const cardCounts = countCardsByStatus(cards);
  const browserAuthConfig = useMemo(() => getBrowserAuthConfig(), []);

  useEffect(() => {
    if (browserAuthConfig.authMode !== "supabase") return;

    void getCurrentSupabaseUser().then((supabaseUser) => {
      if (!supabaseUser) {
        setStatusMessage("Supabase session is not active or role metadata is missing.");
        return;
      }

      setUser(supabaseUser);
      setScreen("setup");
      setStatusMessage("Supabase Google OAuth session is active.");
    });
  }, [browserAuthConfig.authMode]);

  useEffect(() => {
    sessionProfileRef.current = sessionProfile;
  }, [sessionProfile]);

  useEffect(() => {
    cardsRef.current = cards;
  }, [cards]);

  useEffect(() => {
    lastLlmCallAtRef.current = lastLlmCallAt;
  }, [lastLlmCallAt]);

  useEffect(() => {
    return () => {
      sttConnectionRef.current?.stop();
      sttConnectionRef.current = null;
    };
  }, []);

  async function loginWithGoogle() {
    if (browserAuthConfig.authMode === "supabase") {
      const result = await signInWithGoogleOAuth(globalThis.location.origin);
      if (!result.ok) {
        setStatusMessage(result.message);
      }
      return;
    }

    setUser({
      id: "dev-user-001",
      email: "owner@example.local",
      role: "owner",
      provider: "google"
    });
    setScreen("setup");
    setStatusMessage("Google OAuth local mock session is active.");
  }

  async function requestDiagnostics() {
    const diagnostics = await getJson<{
      providerReady: boolean;
      llmProvider: string;
      sttProvider: string;
      missingRequiredServerKeys: string[];
    }>("/api/diagnostics");

    setStatusMessage(
      diagnostics.providerReady
        ? `Provider diagnostics OK: LLM=${diagnostics.llmProvider}, STT=${diagnostics.sttProvider}.`
        : `Provider diagnostics not ready: ${diagnostics.missingRequiredServerKeys.join(", ") || "invalid config"}.`
    );
  }

  async function startSession() {
    stopAudioTranscription();
    const setupInput: SessionSetupInput = {
      conversationType: setup.conversationType,
      industry: setup.industry,
      purpose: setup.purpose,
      mustCheckItems: normalizeMustCheckItems(setup.mustCheckText),
      audioSource: setup.audioSource,
      consentNoServerStorage: setup.consentNoServerStorage
    };

    const response = await postJson<{
      sessionProfile: SessionProfile;
      user: AuthUser;
    }>("/api/session/init", { setupInput });

    setUser(response.user);
    setSessionProfile(response.sessionProfile);
    setSegments([]);
    setPartialSegment(null);
    setCards([]);
    setReport(null);
    setDummyIndex(0);
    setLastLlmCallAt(0);
    setLastDispatchKey(null);
    setCoachInFlight(false);
    lastDispatchKeyRef.current = null;
    coachInFlightRef.current = false;
    sttSequenceRef.current = 0;
    sttSequenceByProviderItemRef.current = new Map();
    setScreen("session");
    setStatusMessage("Session profile created in browser memory.");
  }

  function stopAudioTranscription() {
    sttConnectionRef.current?.stop();
    sttConnectionRef.current = null;
    setSttActive(false);
  }

  function getSttSequence(providerItemId: string): number {
    const existing = sttSequenceByProviderItemRef.current.get(providerItemId);
    if (existing) return existing;

    const next = sttSequenceRef.current + 1;
    sttSequenceRef.current = next;
    sttSequenceByProviderItemRef.current.set(providerItemId, next);
    return next;
  }

  async function startAudioTranscription() {
    if (!sessionProfile) return;

    stopAudioTranscription();
    setStatusMessage(`${getAudioSourceLabel(sessionProfile.audioSource)}の音声接続を開始しています。`);

    const streamResult = await requestAudioSourceStream(
      sessionProfile.audioSource,
      globalThis.navigator
    );
    const activeProfile =
      streamResult.activeSource === sessionProfile.audioSource
        ? sessionProfile
        : {
            ...sessionProfile,
            audioSource: streamResult.activeSource
          };

    if (activeProfile !== sessionProfile) {
      setSessionProfile(activeProfile);
      setSetup((current) => ({
        ...current,
        audioSource: streamResult.activeSource
      }));
    }

    if (!streamResult.ok || !streamResult.stream) {
      setStatusMessage(streamResult.message);
      return;
    }

    let tokenResponse: { stt: SttTokenResponse };
    try {
      tokenResponse = await postJson<{ stt: SttTokenResponse }>("/api/stt-token", {
        audioSource: activeProfile.audioSource,
        sessionId: activeProfile.id
      });
    } catch (error) {
      stopMediaStream(streamResult.stream);
      setStatusMessage(error instanceof Error ? error.message : "STT token request failed.");
      return;
    }

    const stt = tokenResponse.stt;
    if (stt.provider === "mock") {
      stopMediaStream(streamResult.stream);
      setStatusMessage(
        `${streamResult.message} Mock STT token ready. Real STT provider is not enabled.`
      );
      return;
    }

    if (stt.provider !== "openai" || stt.connectionType !== "webrtc" || !stt.realtimeUrl) {
      stopMediaStream(streamResult.stream);
      setStatusMessage("STT provider response does not include a supported WebRTC connection.");
      return;
    }

    try {
      const connection = await connectOpenAiRealtimeTranscription({
        token: stt.token,
        mediaStream: streamResult.stream,
        realtimeUrl: stt.realtimeUrl,
        onStatus(status) {
          if (status === "connecting") setStatusMessage("OpenAI Realtime STTに接続しています。");
          if (status === "connected") setStatusMessage("OpenAI Realtime STTに接続しました。");
          if (status === "disconnected") setStatusMessage("音声接続を停止しました。");
          if (status === "error") setStatusMessage("OpenAI Realtime STT接続でエラーが発生しました。");
        },
        onTranscript(event) {
          const sequence = getSttSequence(event.providerItemId);
          const segment = realtimeTranscriptEventToSegment({
            event,
            sequence
          });
          if (!segment) return;

          if (event.kind === "partial") {
            setPartialSegment(segment);
            return;
          }

          setPartialSegment(null);
          setSegments((current) => {
            const nextSegments = mergeTranscriptSegment(current, segment);
            queueMicrotask(() => {
              void runCoach(nextSegments);
            });
            return nextSegments;
          });
        }
      });

      await connection.ready;
      sttConnectionRef.current = connection;
      setSttActive(true);
      setStatusMessage("OpenAI Realtime STTに接続しました。");
    } catch (error) {
      setSttActive(false);
      setStatusMessage(error instanceof Error ? error.message : "Realtime STT connection failed.");
    }
  }

  async function runCoach(nextSegments: TranscriptSegment[], manualRecheck = false) {
    const activeSessionProfile = sessionProfileRef.current ?? sessionProfile;
    if (!activeSessionProfile) return;
    const activeCards = cardsRef.current;
    const activeLastLlmCallAt = lastLlmCallAtRef.current;

    const dispatch = decideCoachDispatch({
      sessionProfile: activeSessionProfile,
      segments: nextSegments,
      existingCards: activeCards,
      lastLlmCallAt: activeLastLlmCallAt,
      lastDispatchKey: lastDispatchKeyRef.current ?? lastDispatchKey ?? undefined,
      inFlight: coachInFlightRef.current || coachInFlight,
      manualRecheck
    });

    if (!dispatch.shouldDispatch) {
      setStatusMessage(`Coach gate: ${dispatch.reasons.join(", ")}`);
      return;
    }

    const fallbackCards = applyCoachCardCandidates(activeCards, dispatch.candidateSeeds);
    const appliedLocalFallback = JSON.stringify(fallbackCards) !== JSON.stringify(activeCards);
    if (appliedLocalFallback) {
      setCards(fallbackCards);
      cardsRef.current = fallbackCards;
      const nextLocalCallAt = Date.now();
      setLastLlmCallAt(nextLocalCallAt);
      lastLlmCallAtRef.current = nextLocalCallAt;
      setStatusMessage(`Coach local: ${dispatch.reasons.join(", ")}`);
    }

    try {
      coachInFlightRef.current = true;
      setCoachInFlight(true);
      const response = await postJson<{
        cards: CoachCard[];
        gate: {
          shouldCallLlm: boolean;
          reasons: string[];
        };
        diagnostic?: {
          code: string;
        };
      }>("/api/coach", {
        sessionProfile: activeSessionProfile,
        transcriptSegments: nextSegments,
        existingCards: fallbackCards,
        lastLlmCallAt: activeLastLlmCallAt,
        manualRecheck
      });

      setCards(response.cards);
      cardsRef.current = response.cards;
      if (response.gate.shouldCallLlm) {
        const nextLlmCallAt = Date.now();
        setLastLlmCallAt(nextLlmCallAt);
        lastLlmCallAtRef.current = nextLlmCallAt;
      }
      setLastDispatchKey(dispatch.dispatchKey);
      lastDispatchKeyRef.current = dispatch.dispatchKey;
      setStatusMessage(
        `Coach gate: ${response.gate.reasons.join(", ")}${
          response.diagnostic ? ` / provider: ${response.diagnostic.code}` : ""
        }`
      );
    } catch (error) {
      if (appliedLocalFallback) {
        setLastDispatchKey(dispatch.dispatchKey);
        lastDispatchKeyRef.current = dispatch.dispatchKey;
        setStatusMessage(
          `Coach local fallback: ${dispatch.reasons.join(", ")} / provider request failed.`
        );
      } else {
        setStatusMessage(error instanceof Error ? error.message : "Coach request failed.");
      }
    } finally {
      coachInFlightRef.current = false;
      setCoachInFlight(false);
    }
  }

  async function addNextDummyTranscript() {
    if (!sessionProfile) return;

    const pair = createDummyTranscriptPair(sessionProfile.conversationType, dummyIndex);
    setPartialSegment(pair.partial);

    const nextSegments = mergeTranscriptSegment(segments, pair.final);
    setSegments(nextSegments);
    setPartialSegment(null);
    setDummyIndex((value) => value + 1);
    await runCoach(nextSegments);
  }

  async function endSession() {
    if (!sessionProfile) return;
    stopAudioTranscription();

    try {
      const response = await postJson<{
        report: SessionReport;
      }>("/api/report", {
        sessionProfile,
        transcriptSegments: segments,
        cards
      });

      setReport(response.report);
      setScreen("report");
      setStatusMessage("Session report generated in memory.");
    } catch (error) {
      setReport(null);
      setStatusMessage(error instanceof Error ? error.message : "Session report generation failed.");
    }
  }

  function handleCardAction(cardId: string, status: "done" | "later" | "dismissed" | "pinned") {
    setCards((current) => updateCardStatus(current, cardId, status));
  }

  function exportMarkdown() {
    if (!sessionProfile || !report) return;
    downloadText(
      "realtime-question-coach-report.md",
      buildMarkdownExport({
        sessionProfile,
        transcriptSegments: segments,
        cards,
        report
      }),
      "text/markdown"
    );
  }

  function exportJson() {
    if (!sessionProfile || !report) return;
    downloadText(
      "realtime-question-coach-report.json",
      buildJsonExport({
        sessionProfile,
        transcriptSegments: segments,
        cards,
        report
      }),
      "application/json"
    );
  }

  function saveLocal() {
    if (!sessionProfile || !report) return;
    localStorage.setItem(
      `rqc:${sessionProfile.id}`,
      buildJsonExport({
        sessionProfile,
        transcriptSegments: segments,
        cards,
        report
      })
    );
    setStatusMessage("Saved locally in this browser.");
  }

  function discardSession() {
    stopAudioTranscription();
    if (sessionProfile) {
      localStorage.removeItem(`rqc:${sessionProfile.id}`);
    }
    setSessionProfile(null);
    setSegments([]);
    setPartialSegment(null);
    setCards([]);
    setReport(null);
    setScreen("setup");
    setStatusMessage("Session data discarded from browser memory.");
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            Q
          </span>
          <div>
            <p className="eyebrow">Realtime Question Coach</p>
            <h1>Live Question Support</h1>
          </div>
        </div>
        <div className="topbar-actions">
          <span className="status-pill">{user ? user.role : "signed out"}</span>
          <span className="status-pill neutral">{screen}</span>
        </div>
      </header>

      <p className="status-message" role="status">
        {statusMessage}
      </p>

      {screen === "login" ? (
        <section className="login-view" aria-labelledby="login-title">
          <div className="login-copy">
            <p className="eyebrow">Google OAuth</p>
            <h2 id="login-title">Realtime Question Coach</h2>
            <p>会話中の聞き漏れを、短い質問カードで支援します。</p>
          </div>
          <button className="primary-action" type="button" onClick={loginWithGoogle}>
            Googleでログイン
          </button>
        </section>
      ) : null}

      {screen === "setup" ? (
        <section className="setup-view" aria-labelledby="setup-title">
          <div className="view-header">
            <p className="eyebrow">Session Setup</p>
            <h2 id="setup-title">会話前の設定</h2>
          </div>
          <div className="setup-grid">
            <label>
              会話タイプ
              <select
                value={setup.conversationType}
                onChange={(event) =>
                  setSetup((current) => ({
                    ...current,
                    conversationType: event.target.value as ConversationType
                  }))
                }
              >
                {(["sales", "requirements", "recruiting", "user_research"] as const).map(
                  (value) => (
                    <option key={value} value={value}>
                      {getConversationTypeLabel(value)}
                    </option>
                  )
                )}
              </select>
            </label>
            <label>
              業界
              <select
                value={setup.industry}
                onChange={(event) =>
                  setSetup((current) => ({
                    ...current,
                    industry: event.target.value as Industry
                  }))
                }
              >
                {(["manufacturing", "it", "healthcare", "finance", "generic"] as const).map(
                  (value) => (
                    <option key={value} value={value}>
                      {getIndustryLabel(value)}
                    </option>
                  )
                )}
              </select>
            </label>
            <label className="wide-field">
              今回の目的
              <textarea
                value={setup.purpose}
                onChange={(event) =>
                  setSetup((current) => ({
                    ...current,
                    purpose: event.target.value
                  }))
                }
              />
            </label>
            <label className="wide-field">
              必ず確認する論点
              <textarea
                value={setup.mustCheckText}
                onChange={(event) =>
                  setSetup((current) => ({
                    ...current,
                    mustCheckText: event.target.value
                  }))
                }
              />
            </label>
            <label>
              音声ソース
              <select
                value={setup.audioSource}
                onChange={(event) =>
                  setSetup((current) => ({
                    ...current,
                    audioSource: event.target.value as AudioSourceType
                  }))
                }
              >
                {capabilities.map((capability) => (
                  <option key={capability.source} value={capability.source}>
                    {capability.label}
                    {capability.available ? "" : "（非対応）"}
                  </option>
                ))}
              </select>
            </label>
            <p className="policy-note">
              会話本文・音声・AIカードはサーバーDBに保存しません。
            </p>
          </div>
          <div className="action-row">
            <button
              className="primary-action"
              disabled={!setup.purpose.trim()}
              type="button"
              onClick={startSession}
            >
              セッション開始
            </button>
          </div>
        </section>
      ) : null}

      {screen === "session" && sessionProfile ? (
        <section className="session-view" aria-labelledby="session-title">
          <div className="session-toolbar">
            <div>
              <p className="eyebrow">Realtime Session</p>
              <h2 id="session-title">{getConversationTypeLabel(sessionProfile.conversationType)}</h2>
            </div>
            <div className="action-row compact">
              <button
                type="button"
                onClick={() => {
                  stopAudioTranscription();
                  setScreen("setup");
                }}
              >
                設定へ戻る
              </button>
              <button type="button" onClick={requestDiagnostics}>
                診断
              </button>
              <button type="button" disabled={sttActive} onClick={startAudioTranscription}>
                音声接続開始
              </button>
              <button type="button" disabled={!sttActive} onClick={stopAudioTranscription}>
                音声接続停止
              </button>
              <button type="button" onClick={addNextDummyTranscript}>
                ダミー文字起こし開始
              </button>
              <button className="primary-action" type="button" onClick={endSession}>
                終了
              </button>
            </div>
          </div>

          <div className="session-grid">
            <section className="transcript-pane" aria-label="文字起こし">
              <div className="pane-header">
                <h3>文字起こし</h3>
                <span>{segments.length} final</span>
              </div>
              <div className="transcript-list">
                {segments.map((segment) => (
                  <article key={segment.id} className="transcript-item">
                    <span>{segment.speaker.label}</span>
                    <p>{segment.text}</p>
                  </article>
                ))}
                {partialSegment ? (
                  <article className="transcript-item partial">
                    <span>{partialSegment.speaker.label}</span>
                    <p>{partialSegment.text}</p>
                  </article>
                ) : null}
              </div>
            </section>

            <section className="coach-pane" aria-label="AI補助カード">
              <div className="pane-header">
                <h3>AI補助カード</h3>
                <span>
                  active {cardCounts.active} / queued {cardCounts.queued} / done {cardCounts.done}
                </span>
              </div>
              <div className="coach-list">
                {cards
                  .filter((card) => card.status === "active" || card.status === "pinned")
                  .map((card) => (
                    <article key={card.id} className={`coach-card ${card.priority}`}>
                      <div className="card-topline">
                        <strong>{card.title}</strong>
                        <span>{card.score}</span>
                      </div>
                      <p>{card.question}</p>
                      <small>{card.reason}</small>
                      <div className="card-actions">
                        <button type="button" onClick={() => handleCardAction(card.id, "done")}>
                          聞いた
                        </button>
                        <button type="button" onClick={() => handleCardAction(card.id, "later")}>
                          あとで
                        </button>
                        <button type="button" onClick={() => handleCardAction(card.id, "dismissed")}>
                          不要
                        </button>
                        <button type="button" onClick={() => handleCardAction(card.id, "pinned")}>
                          固定
                        </button>
                        <button type="button" onClick={() => runCoach(segments, true)}>
                          再判定
                        </button>
                      </div>
                    </article>
                  ))}
                {cards.length === 0 ? <p className="empty-state">重要論点が出るとカードが表示されます。</p> : null}
              </div>
            </section>
          </div>
        </section>
      ) : null}

      {screen === "report" && sessionProfile && report ? (
        <section className="report-view" aria-labelledby="report-title">
          <div className="view-header">
            <p className="eyebrow">Session Report</p>
            <h2 id="report-title">振り返り</h2>
          </div>
          <div className="report-grid">
            <section>
              <h3>聞けたこと</h3>
              <ul>{report.heardItems.map((item) => <li key={item}>{item}</li>)}</ul>
            </section>
            <section>
              <h3>聞けなかったこと</h3>
              <ul>{report.missedItems.map((item) => <li key={item}>{item}</li>)}</ul>
            </section>
            <section>
              <h3>次回確認事項</h3>
              <ul>{report.nextActions.map((item) => <li key={item}>{item}</li>)}</ul>
            </section>
          </div>
          <div className="action-row">
            <button type="button" onClick={exportMarkdown}>
              Markdown export
            </button>
            <button type="button" onClick={exportJson}>
              JSON export
            </button>
            <button type="button" onClick={saveLocal}>
              ローカル保存
            </button>
            <button className="danger-action" type="button" onClick={discardSession}>
              破棄
            </button>
          </div>
        </section>
      ) : null}
    </main>
  );
}
