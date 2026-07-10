import type { ExportPayload } from "@/lib/export";
import type {
  CoachCard,
  ConversationType,
  SessionProfile,
  SessionReport,
  TranscriptSegment
} from "@/lib/types";

export const LOCAL_SESSION_KEY_PREFIX = "rqc:";
export const LOCAL_SESSION_SCHEMA_VERSION = 2;

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem" | "key" | "length">;

export type LocalSessionRecord = {
  schemaVersion: typeof LOCAL_SESSION_SCHEMA_VERSION;
  ownerUserId: string;
  savedAt: string;
  payload: ExportPayload;
};

export type LocalSessionSummary = {
  sessionId: string;
  conversationType: ConversationType;
  purpose: string;
  savedAt: string;
  transcriptCount: number;
  cardCount: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isConversationType(value: unknown): value is ConversationType {
  return ["sales", "requirements", "recruiting", "user_research"].includes(String(value));
}

function isSessionProfile(value: unknown): value is SessionProfile {
  if (!isRecord(value)) return false;

  return (
    typeof value.id === "string" &&
    isConversationType(value.conversationType) &&
    typeof value.industry === "string" &&
    typeof value.purpose === "string" &&
    typeof value.audioSource === "string" &&
    typeof value.knowledgeSetId === "string" &&
    typeof value.playbookTitle === "string" &&
    typeof value.playbookDescription === "string" &&
    typeof value.createdAt === "string" &&
    isStringArray(value.mustCheckItems) &&
    isStringArray(value.playbookMustCheck) &&
    isStringArray(value.importantTerms) &&
    isStringArray(value.ambiguousTerms) &&
    isStringArray(value.mustAskTemplates) &&
    isStringArray(value.avoidQuestions) &&
    isStringArray(value.completionCriteria) &&
    isStringArray(value.cardRules)
  );
}

function isTranscriptSegment(value: unknown): value is TranscriptSegment {
  if (!isRecord(value) || !isRecord(value.speaker)) return false;

  return (
    typeof value.id === "string" &&
    typeof value.sequence === "number" &&
    typeof value.text === "string" &&
    typeof value.isFinal === "boolean" &&
    typeof value.startedAtMs === "number" &&
    (value.endedAtMs === undefined || typeof value.endedAtMs === "number") &&
    typeof value.createdAt === "string" &&
    typeof value.speaker.id === "string" &&
    typeof value.speaker.label === "string" &&
    typeof value.speaker.source === "string" &&
    typeof value.speaker.confidence === "number"
  );
}

function isCoachCard(value: unknown): value is CoachCard {
  if (!isRecord(value)) return false;

  return (
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    typeof value.question === "string" &&
    typeof value.reason === "string" &&
    typeof value.priority === "string" &&
    typeof value.score === "number" &&
    typeof value.status === "string" &&
    typeof value.createdAt === "string" &&
    isStringArray(value.sourceSegmentIds) &&
    isStringArray(value.ruleIds)
  );
}

function isSessionReport(value: unknown): value is SessionReport {
  if (!isRecord(value) || !isRecord(value.cardStats)) return false;

  return (
    typeof value.sessionId === "string" &&
    isStringArray(value.heardItems) &&
    isStringArray(value.missedItems) &&
    isStringArray(value.nextActions) &&
    typeof value.cardStats.total === "number" &&
    typeof value.cardStats.done === "number" &&
    typeof value.cardStats.later === "number" &&
    typeof value.cardStats.dismissed === "number" &&
    typeof value.generatedAt === "string"
  );
}

function isExportPayload(value: unknown): value is ExportPayload {
  if (!isRecord(value)) return false;

  return (
    isSessionProfile(value.sessionProfile) &&
    Array.isArray(value.transcriptSegments) &&
    value.transcriptSegments.every(isTranscriptSegment) &&
    Array.isArray(value.cards) &&
    value.cards.every(isCoachCard) &&
    isSessionReport(value.report) &&
    value.report.sessionId === value.sessionProfile.id
  );
}

type ParsedLocalSession = Omit<LocalSessionRecord, "ownerUserId"> & {
  ownerUserId: string | null;
};

function parseLocalSession(rawValue: string): ParsedLocalSession | null {
  try {
    const parsed: unknown = JSON.parse(rawValue);

    if (
      isRecord(parsed) &&
      parsed.schemaVersion === LOCAL_SESSION_SCHEMA_VERSION &&
      typeof parsed.ownerUserId === "string" &&
      typeof parsed.savedAt === "string" &&
      isExportPayload(parsed.payload)
    ) {
      return parsed as LocalSessionRecord;
    }

    if (
      isRecord(parsed) &&
      parsed.schemaVersion === 1 &&
      typeof parsed.savedAt === "string" &&
      isExportPayload(parsed.payload)
    ) {
      return {
        schemaVersion: LOCAL_SESSION_SCHEMA_VERSION,
        ownerUserId: null,
        savedAt: parsed.savedAt,
        payload: parsed.payload
      };
    }

    if (isExportPayload(parsed)) {
      return {
        schemaVersion: LOCAL_SESSION_SCHEMA_VERSION,
        ownerUserId: null,
        savedAt: parsed.report.generatedAt,
        payload: parsed
      };
    }
  } catch {
    return null;
  }

  return null;
}

function localSessionKey(ownerUserId: string, sessionId: string): string {
  return `${LOCAL_SESSION_KEY_PREFIX}${encodeURIComponent(ownerUserId)}:${encodeURIComponent(sessionId)}`;
}

function toSummary(record: ParsedLocalSession): LocalSessionSummary {
  return {
    sessionId: record.payload.sessionProfile.id,
    conversationType: record.payload.sessionProfile.conversationType,
    purpose: record.payload.sessionProfile.purpose,
    savedAt: record.savedAt,
    transcriptCount: record.payload.transcriptSegments.length,
    cardCount: record.payload.cards.length
  };
}

export function saveLocalSession(
  storage: StorageLike,
  ownerUserId: string,
  payload: ExportPayload,
  savedAt = new Date().toISOString()
): LocalSessionSummary {
  const record: LocalSessionRecord = {
    schemaVersion: LOCAL_SESSION_SCHEMA_VERSION,
    ownerUserId,
    savedAt,
    payload
  };

  storage.setItem(localSessionKey(ownerUserId, payload.sessionProfile.id), JSON.stringify(record));
  return toSummary(record);
}

export function loadLocalSession(
  storage: StorageLike,
  ownerUserId: string,
  sessionId: string
): LocalSessionRecord | null {
  const rawValue = storage.getItem(localSessionKey(ownerUserId, sessionId));
  const record = rawValue ? parseLocalSession(rawValue) : null;
  return record?.ownerUserId === ownerUserId ? (record as LocalSessionRecord) : null;
}

export function listLocalSessions(
  storage: StorageLike,
  ownerUserId: string
): LocalSessionSummary[] {
  const summaries: LocalSessionSummary[] = [];

  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (!key?.startsWith(LOCAL_SESSION_KEY_PREFIX)) continue;

    const rawValue = storage.getItem(key);
    const record = rawValue ? parseLocalSession(rawValue) : null;
    if (record?.ownerUserId === ownerUserId) summaries.push(toSummary(record));
  }

  return summaries.sort((left, right) => right.savedAt.localeCompare(left.savedAt));
}

export function deleteLocalSession(
  storage: StorageLike,
  ownerUserId: string,
  sessionId: string
): void {
  storage.removeItem(localSessionKey(ownerUserId, sessionId));
}

export function migrateLegacyLocalSessions(
  storage: StorageLike,
  ownerUserId: string
): number {
  const legacyEntries: Array<{ key: string; record: ParsedLocalSession }> = [];

  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (!key?.startsWith(LOCAL_SESSION_KEY_PREFIX)) continue;

    const rawValue = storage.getItem(key);
    const record = rawValue ? parseLocalSession(rawValue) : null;
    if (record && record.ownerUserId === null) legacyEntries.push({ key, record });
  }

  legacyEntries.forEach(({ key, record }) => {
    saveLocalSession(storage, ownerUserId, record.payload, record.savedAt);
    storage.removeItem(key);
  });

  return legacyEntries.length;
}
