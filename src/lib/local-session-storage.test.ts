import { describe, expect, it } from "vitest";
import { createEmptyReportPayload } from "@/lib/export";
import {
  deleteLocalSession,
  listLocalSessions,
  loadLocalSession,
  migrateLegacyLocalSessions,
  saveLocalSession
} from "@/lib/local-session-storage";
import type { SessionProfile } from "@/lib/types";

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

const profile: SessionProfile = {
  id: "session-local-001",
  conversationType: "requirements",
  industry: "it",
  purpose: "重要な確認事項を整理する",
  mustCheckItems: ["担当者"],
  audioSource: "dummy",
  knowledgeSetId: "requirements/default",
  playbookTitle: "要件定義",
  playbookDescription: "要件を確認する",
  playbookMustCheck: ["対象範囲"],
  importantTerms: ["承認者"],
  ambiguousTerms: ["なるべく"],
  mustAskTemplates: ["担当者は誰ですか？"],
  avoidQuestions: [],
  completionCriteria: ["担当者が明確"],
  cardRules: [],
  createdAt: "2026-07-10T00:00:00.000Z"
};

describe("local session storage", () => {
  it("saves, lists, loads, and deletes a versioned local session", () => {
    const storage = new MemoryStorage();
    const payload = createEmptyReportPayload(profile);

    const summary = saveLocalSession(
      storage,
      "user-001",
      payload,
      "2026-07-10T01:00:00.000Z"
    );

    expect(summary.sessionId).toBe(profile.id);
    expect(listLocalSessions(storage, "user-001")).toEqual([summary]);
    expect(listLocalSessions(storage, "user-002")).toEqual([]);
    expect(loadLocalSession(storage, "user-001", profile.id)?.payload).toEqual(payload);
    expect(loadLocalSession(storage, "user-002", profile.id)).toBeNull();

    deleteLocalSession(storage, "user-001", profile.id);
    expect(listLocalSessions(storage, "user-001")).toEqual([]);
  });

  it("lets the previously exclusive owner migrate legacy unscoped sessions", () => {
    const storage = new MemoryStorage();
    const payload = createEmptyReportPayload(profile);
    storage.setItem(`rqc:${profile.id}`, JSON.stringify(payload));

    expect(listLocalSessions(storage, "owner-001")).toEqual([]);
    expect(migrateLegacyLocalSessions(storage, "owner-001")).toBe(1);
    expect(loadLocalSession(storage, "owner-001", profile.id)?.payload).toEqual(payload);
    expect(listLocalSessions(storage, "owner-001")[0]?.savedAt).toBe(
      payload.report.generatedAt
    );
  });

  it("ignores malformed or unrelated browser storage entries", () => {
    const storage = new MemoryStorage();
    storage.setItem("rqc:broken", "{not-json");
    storage.setItem("other:setting", "true");

    expect(listLocalSessions(storage, "user-001")).toEqual([]);
    expect(loadLocalSession(storage, "user-001", "broken")).toBeNull();
  });
});
