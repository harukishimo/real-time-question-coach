"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getAudioSourceCapabilities,
  requestAudioSourceStream,
  stopMediaStream
} from "@/lib/audio-source";
import {
  getBrowserAuthConfig,
  getCurrentSupabaseAccessToken,
  getCurrentSupabaseUser,
  signInWithGoogleOAuth,
  signOutCurrentSession
} from "@/lib/auth-client";
import { applyCoachCardCandidates, countCardsByStatus, updateCardStatus } from "@/lib/coach-card";
import { createDummyTranscriptPair } from "@/lib/dummy-transcript";
import { buildJsonExport, buildMarkdownExport } from "@/lib/export";
import {
  deleteLocalSession,
  listLocalSessions,
  loadLocalSession,
  migrateLegacyLocalSessions,
  saveLocalSession,
  type LocalSessionSummary
} from "@/lib/local-session-storage";
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

type Screen = "login" | "credential" | "setup" | "session" | "report";

type OpenAiCredentialStatus = {
  provider: "openai";
  configured: boolean;
  updatedAt: string | null;
};

const COACH_GATE_HEARTBEAT_MS = 1_000;

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

function currentTimestampMs(): number {
  return Date.now();
}

function readLocalSessionsForUser(user: AuthUser): LocalSessionSummary[] {
  if (typeof window === "undefined") return [];

  if (user.role === "owner") {
    migrateLegacyLocalSessions(window.localStorage, user.id);
  }
  return listLocalSessions(window.localStorage, user.id);
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
    throw new Error((await response.text()) || `Request failed: ${response.status}`);
  }

  return (await response.json()) as T;
}

async function putJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "PUT",
    headers: await requestHeaders(),
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error((await response.text()) || `Request failed: ${response.status}`);
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
  const [lastLlmCallAt, setLastLlmCallAt] = useState(0);
  const [lastDispatchKey, setLastDispatchKey] = useState<string | null>(null);
  const [coachInFlight, setCoachInFlight] = useState(false);
  const [sttActive, setSttActive] = useState(false);
  const [savedSessions, setSavedSessions] = useState<LocalSessionSummary[]>([]);
  const [openAiApiKey, setOpenAiApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [savingCredential, setSavingCredential] = useState(false);
  const [credentialRequired, setCredentialRequired] = useState(false);
  const [statusMessage, setStatusMessage] = useState("Google OAuth adapter is using local mock fallback.");
  const lastDispatchKeyRef = useRef<string | null>(null);
  const coachInFlightRef = useRef(false);
  const sessionProfileRef = useRef<SessionProfile | null>(null);
  const cardsRef = useRef<CoachCard[]>([]);
  const segmentsRef = useRef<TranscriptSegment[]>([]);
  const lastLlmCallAtRef = useRef(0);
  const runCoachRef = useRef<
    (
      nextSegments: TranscriptSegment[],
      manualRecheck?: boolean,
      silentWhenSkipped?: boolean
    ) => Promise<void>
  >(async () => {});
  const sttConnectionRef = useRef<RealtimeSttConnection | null>(null);
  const sttSequenceRef = useRef(0);
  const sttSequenceByProviderItemRef = useRef<Map<string, number>>(new Map());

  const capabilities = useMemo(() => getAudioSourceCapabilities(globalThis.navigator), []);
  const cardCounts = countCardsByStatus(cards);
  const browserAuthConfig = useMemo(() => getBrowserAuthConfig(), []);
  const continueAfterAuthentication = useCallback(async () => {
    if (browserAuthConfig.authMode === "mock") {
      setScreen("setup");
      setStatusMessage("Google OAuth local mock session is active.");
      return;
    }

    try {
      const credential = await getJson<OpenAiCredentialStatus>("/api/provider-credential/openai");
      if (credential.configured) {
        setCredentialRequired(false);
        setScreen("setup");
        setStatusMessage("Supabase Google OAuth session is active.");
        return;
      }
      setCredentialRequired(true);
      setScreen("credential");
      setStatusMessage("利用を開始するにはOpenAI APIキーを設定してください。");
    } catch {
      setCredentialRequired(true);
      setScreen("credential");
      setStatusMessage("OpenAI APIキーの設定状態を確認できませんでした。設定を保存して続行してください。");
    }
  }, [browserAuthConfig.authMode]);

  useEffect(() => {
    if (browserAuthConfig.authMode !== "supabase") return;

    void getCurrentSupabaseUser().then((supabaseUser) => {
      if (!supabaseUser) {
        setStatusMessage("Supabase session is not active or role metadata is missing.");
        return;
      }

      setUser(supabaseUser);
      try {
        setSavedSessions(readLocalSessionsForUser(supabaseUser));
      } catch {
        setSavedSessions([]);
      }
      void continueAfterAuthentication();
    });
  }, [browserAuthConfig.authMode, continueAfterAuthentication]);

  useEffect(() => {
    sessionProfileRef.current = sessionProfile;
  }, [sessionProfile]);

  useEffect(() => {
    cardsRef.current = cards;
  }, [cards]);

  useEffect(() => {
    segmentsRef.current = segments;
  }, [segments]);

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

    const mockUser: AuthUser = {
      id: "dev-user-001",
      email: "owner@example.local",
      role: "owner",
      provider: "google"
    };
    setUser(mockUser);
    try {
      setSavedSessions(readLocalSessionsForUser(mockUser));
    } catch {
      setSavedSessions([]);
    }
    await continueAfterAuthentication();
  }

  async function saveCredential() {
    if (!openAiApiKey.trim()) return;
    setSavingCredential(true);
    try {
      await putJson<OpenAiCredentialStatus>("/api/provider-credential/openai", {
        apiKey: openAiApiKey
      });
      setOpenAiApiKey("");
      setShowApiKey(false);
      setCredentialRequired(false);
      setScreen("setup");
      setStatusMessage("OpenAI APIキーを安全に保存しました。");
    } catch {
      setStatusMessage("APIキーを保存できませんでした。キーとSupabaseのサーバー設定を確認してください。");
    } finally {
      setSavingCredential(false);
    }
  }

  async function logout() {
    stopAudioTranscription();
    const result = await signOutCurrentSession();
    if (!result.ok) {
      setStatusMessage(result.message);
      return;
    }

    setUser(null);
    setSessionProfile(null);
    sessionProfileRef.current = null;
    setSegments([]);
    segmentsRef.current = [];
    setPartialSegment(null);
    setCards([]);
    cardsRef.current = [];
    setReport(null);
    setSavedSessions([]);
    setOpenAiApiKey("");
    setShowApiKey(false);
    setSavingCredential(false);
    setCredentialRequired(false);
    setScreen("login");
    setStatusMessage("ログアウトしました。ブラウザ内の保存済みセッションは削除していません。");
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
    sessionProfileRef.current = response.sessionProfile;
    setSegments([]);
    setPartialSegment(null);
    setCards([]);
    setReport(null);
    setLastLlmCallAt(0);
    setLastDispatchKey(null);
    setCoachInFlight(false);
    lastDispatchKeyRef.current = null;
    coachInFlightRef.current = false;
    cardsRef.current = [];
    segmentsRef.current = [];
    lastLlmCallAtRef.current = 0;
    sttSequenceRef.current = 0;
    sttSequenceByProviderItemRef.current = new Map();
    setScreen("session");

    if (response.sessionProfile.audioSource === "dummy") {
      const pair = createDummyTranscriptPair(response.sessionProfile.conversationType, 0);
      const nextSegments = mergeTranscriptSegment([], pair.final);
      setSegments(nextSegments);
      segmentsRef.current = nextSegments;
      setStatusMessage("ダミー文字起こしを自動開始しました。");
      queueMicrotask(() => {
        void runCoachRef.current(nextSegments);
      });
      return;
    }

    void startAudioTranscription(response.sessionProfile);
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

  async function startAudioTranscription(profileOverride?: SessionProfile) {
    const activeSessionProfile = profileOverride ?? sessionProfileRef.current;
    if (!activeSessionProfile) return;

    stopAudioTranscription();
    setStatusMessage(
      `${getAudioSourceLabel(activeSessionProfile.audioSource)}の音声接続を開始しています。`
    );

    const streamResult = await requestAudioSourceStream(
      activeSessionProfile.audioSource,
      globalThis.navigator
    );
    const activeProfile =
      streamResult.activeSource === activeSessionProfile.audioSource
        ? activeSessionProfile
        : {
            ...activeSessionProfile,
            audioSource: streamResult.activeSource
          };

    if (activeProfile !== activeSessionProfile) {
      setSessionProfile(activeProfile);
      sessionProfileRef.current = activeProfile;
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
            segmentsRef.current = nextSegments;
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

  async function runCoach(
    nextSegments: TranscriptSegment[],
    manualRecheck = false,
    silentWhenSkipped = false
  ) {
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
      if (!silentWhenSkipped) {
        setStatusMessage(`Coach gate: ${dispatch.reasons.join(", ")}`);
      }
      return;
    }

    const fallbackCards = applyCoachCardCandidates(activeCards, dispatch.candidateSeeds);
    const appliedLocalFallback = JSON.stringify(fallbackCards) !== JSON.stringify(activeCards);
    if (appliedLocalFallback) {
      setCards(fallbackCards);
      cardsRef.current = fallbackCards;
      setStatusMessage(`Coach local: ${dispatch.reasons.join(", ")}`);
    }

    try {
      coachInFlightRef.current = true;
      setCoachInFlight(true);
      const dispatchStartedAt = currentTimestampMs();
      setLastLlmCallAt(dispatchStartedAt);
      lastLlmCallAtRef.current = dispatchStartedAt;
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
        existingCards: activeCards,
        lastLlmCallAt: activeLastLlmCallAt,
        manualRecheck
      });

      setCards(response.cards);
      cardsRef.current = response.cards;
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

  useEffect(() => {
    runCoachRef.current = runCoach;
  });

  useEffect(() => {
    if (screen !== "session" || !sessionProfile) return;

    const intervalId = globalThis.setInterval(() => {
      const currentSegments = segmentsRef.current;
      if (!currentSegments.some((segment) => segment.isFinal)) return;
      void runCoachRef.current(currentSegments, false, true);
    }, COACH_GATE_HEARTBEAT_MS);

    return () => globalThis.clearInterval(intervalId);
  }, [screen, sessionProfile]);

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
    if (!user || !sessionProfile || !report) return;

    try {
      saveLocalSession(globalThis.localStorage, user.id, {
        sessionProfile,
        transcriptSegments: segments,
        cards,
        report
      });
      setSavedSessions(listLocalSessions(globalThis.localStorage, user.id));
      setStatusMessage("このブラウザに保存しました。保存済みセッションから再表示できます。");
    } catch {
      setStatusMessage(
        "ローカル保存に失敗しました。ブラウザのサイトデータ設定と空き容量を確認してください。"
      );
    }
  }

  function restoreSavedSession(sessionId: string) {
    if (!user) return;

    try {
      const storedSession = loadLocalSession(globalThis.localStorage, user.id, sessionId);
      if (!storedSession) {
        setStatusMessage("保存データを読み込めませんでした。破損している可能性があります。");
        return;
      }

      stopAudioTranscription();
      const payload = storedSession.payload;
      setSessionProfile(payload.sessionProfile);
      sessionProfileRef.current = payload.sessionProfile;
      setSetup({
        conversationType: payload.sessionProfile.conversationType,
        industry: payload.sessionProfile.industry,
        purpose: payload.sessionProfile.purpose,
        mustCheckText: payload.sessionProfile.mustCheckItems.join("\n"),
        audioSource: payload.sessionProfile.audioSource,
        consentNoServerStorage: true
      });
      setSegments(payload.transcriptSegments);
      segmentsRef.current = payload.transcriptSegments;
      setPartialSegment(null);
      setCards(payload.cards);
      cardsRef.current = payload.cards;
      setReport(payload.report);
      setLastLlmCallAt(0);
      lastLlmCallAtRef.current = 0;
      setLastDispatchKey(null);
      lastDispatchKeyRef.current = null;
      setCoachInFlight(false);
      coachInFlightRef.current = false;
      setScreen("report");
      setStatusMessage("保存済みセッションをこのブラウザから読み込みました。");
    } catch {
      setStatusMessage("保存データの読み込みに失敗しました。ブラウザ設定を確認してください。");
    }
  }

  function removeSavedSession(sessionId: string) {
    if (!user) return;

    try {
      deleteLocalSession(globalThis.localStorage, user.id, sessionId);
      setSavedSessions(listLocalSessions(globalThis.localStorage, user.id));
      setStatusMessage("保存済みセッションをこのブラウザから削除しました。");
    } catch {
      setStatusMessage("保存済みセッションを削除できませんでした。ブラウザ設定を確認してください。");
    }
  }

  function closeSavedSession() {
    stopAudioTranscription();
    setSessionProfile(null);
    setSegments([]);
    segmentsRef.current = [];
    setPartialSegment(null);
    setCards([]);
    cardsRef.current = [];
    setReport(null);
    setScreen("setup");
    setStatusMessage("保存済みデータを残してセッションを閉じました。");
  }

  function discardSession() {
    stopAudioTranscription();
    let localDeleteFailed = false;
    if (user && sessionProfile) {
      try {
        deleteLocalSession(globalThis.localStorage, user.id, sessionProfile.id);
        setSavedSessions(listLocalSessions(globalThis.localStorage, user.id));
      } catch {
        localDeleteFailed = true;
      }
    }
    setSessionProfile(null);
    setSegments([]);
    segmentsRef.current = [];
    setPartialSegment(null);
    setCards([]);
    cardsRef.current = [];
    setReport(null);
    setScreen("setup");
    setStatusMessage(
      localDeleteFailed
        ? "ブラウザメモリは破棄しましたが、ローカル保存データを削除できませんでした。"
        : "セッションデータをブラウザメモリとローカル保存から破棄しました。"
    );
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
          {user ? (
            <button
              type="button"
              onClick={() => {
                stopAudioTranscription();
                setCredentialRequired(false);
                setScreen("credential");
                setStatusMessage("OpenAI APIキーを更新できます。");
              }}
            >
              ユーザー設定
            </button>
          ) : null}
          {user ? (
            <button type="button" onClick={logout}>
              ログアウト
            </button>
          ) : null}
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

      {screen === "credential" ? (
        <section className="credential-view" aria-labelledby="credential-title">
          <div className="credential-card">
            <div className="credential-card-header">
              <div className="credential-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M7.5 10.5V8a4.5 4.5 0 0 1 9 0v2.5" />
                  <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
                  <path d="M12 14.25v2.5" />
                </svg>
              </div>
              <div>
                <p className="eyebrow">Provider settings</p>
                <h2 id="credential-title">OpenAI APIキー</h2>
              </div>
              <span className="credential-status">暗号化保存</span>
            </div>

            <p className="credential-lead">
              あなたのキーを登録すると、会話中の文字起こしと質問カード生成を利用できます。
            </p>

            <div className="credential-security-note" role="note">
              <span className="security-dot" aria-hidden="true" />
              <span>キー本体は画面に再表示せず、Supabase Vaultに暗号化して保存します。</span>
            </div>

            <form
              className="credential-form"
              onSubmit={(event) => {
                event.preventDefault();
                void saveCredential();
              }}
            >
              <div className="credential-field">
                <div className="credential-label-row">
                  <label htmlFor="openai-api-key">APIキー</label>
                  <span>必須</span>
                </div>
                <div className="secret-input-wrap">
                  <input
                    className="credential-input"
                    id="openai-api-key"
                    name="openai-api-key"
                    type={showApiKey ? "text" : "password"}
                    value={openAiApiKey}
                    placeholder="sk-…"
                    autoComplete="new-password"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    minLength={20}
                    maxLength={512}
                    aria-describedby="openai-api-key-help"
                    onChange={(event) => setOpenAiApiKey(event.target.value)}
                  />
                  <button
                    className="secret-toggle"
                    type="button"
                    aria-label={showApiKey ? "APIキーを隠す" : "APIキーを表示"}
                    onClick={() => setShowApiKey((visible) => !visible)}
                  >
                    {showApiKey ? "隠す" : "表示"}
                  </button>
                </div>
                <p className="credential-help" id="openai-api-key-help">
                  OpenAIのAPIキーを入力してください。入力内容はログやブラウザ保存には残りません。
                </p>
              </div>

              <button
                className="primary-action credential-submit"
                type="submit"
                disabled={savingCredential || !openAiApiKey.trim()}
              >
                {savingCredential ? "保存中…" : "安全に保存して続行"}
                {!savingCredential ? <span aria-hidden="true">→</span> : null}
              </button>
            </form>

            {!credentialRequired ? (
              <button className="credential-back" type="button" onClick={() => setScreen("setup")}>
                会話前の設定へ戻る
              </button>
            ) : null}
          </div>
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
          <section className="saved-sessions" aria-labelledby="saved-sessions-title">
            <div className="saved-sessions-header">
              <div>
                <p className="eyebrow">Browser Local Storage</p>
                <h3 id="saved-sessions-title">保存済みセッション</h3>
              </div>
              <span>{savedSessions.length}件</span>
            </div>
            <p className="saved-sessions-note">
              このブラウザに保存した設定・文字起こし・カード・レポートです。音声ファイルは含みません。
            </p>
            {savedSessions.length > 0 ? (
              <ul className="saved-session-list">
                {savedSessions.map((savedSession) => (
                  <li key={savedSession.sessionId} className="saved-session-item">
                    <div>
                      <strong>{savedSession.purpose}</strong>
                      <span>
                        {getConversationTypeLabel(savedSession.conversationType)} / 保存日時{" "}
                        <time dateTime={savedSession.savedAt}>
                          {savedSession.savedAt.replace("T", " ").slice(0, 16)}
                        </time>
                      </span>
                      <span>
                        文字起こし {savedSession.transcriptCount}件 / カード {savedSession.cardCount}件
                      </span>
                    </div>
                    <div className="saved-session-actions">
                      <button type="button" onClick={() => restoreSavedSession(savedSession.sessionId)}>
                        開く
                      </button>
                      <button
                        className="danger-action"
                        type="button"
                        onClick={() => removeSavedSession(savedSession.sessionId)}
                      >
                        削除
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="empty-state">このブラウザに保存済みのセッションはありません。</p>
            )}
          </section>
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
              <button
                type="button"
                disabled={sttActive}
                onClick={() => void startAudioTranscription()}
              >
                音声接続開始
              </button>
              <button type="button" disabled={!sttActive} onClick={stopAudioTranscription}>
                音声接続停止
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
            <button
              type="button"
              disabled={!savedSessions.some((savedSession) => savedSession.sessionId === sessionProfile.id)}
              onClick={closeSavedSession}
            >
              保存済みデータを残して終了
            </button>
            <button className="danger-action" type="button" onClick={discardSession}>
              破棄
            </button>
          </div>
          <p className="local-save-note">
            ローカル保存の対象は設定・文字起こし・カード・レポートです。音声ファイルは保存しません。
          </p>
        </section>
      ) : null}
    </main>
  );
}
