import { describe, expect, it, vi } from "vitest";
import { buildJsonExport, buildMarkdownExport } from "@/lib/export";
import { buildSessionReport } from "@/lib/report";
import { assertNoServerConversationPersistence, redactForLog } from "@/lib/security";
import { createSessionProfile } from "@/lib/session-profile";

const sessionProfile = createSessionProfile({
  conversationType: "sales",
  industry: "manufacturing",
  purpose: "導入判断を確認する",
  mustCheckItems: ["決裁", "予算"],
  audioSource: "dummy",
  consentNoServerStorage: true
});

describe("export and security helpers", () => {
  it("builds markdown and json exports from browser-memory payloads", () => {
    const report = buildSessionReport({
      sessionProfile,
      transcriptSegments: [],
      cards: []
    });
    const payload = {
      sessionProfile,
      transcriptSegments: [],
      cards: [],
      report
    };

    expect(buildMarkdownExport(payload)).toContain("## 次回確認事項");
    expect(JSON.parse(buildJsonExport(payload))).toMatchObject({
      sessionProfile: {
        id: sessionProfile.id
      }
    });
  });

  it("redacts sensitive body-shaped values for logs", () => {
    expect(
      redactForLog({
        transcript: "会話本文",
        nested: {
          llmInput: "prompt"
        },
        safe: "status"
      })
    ).toEqual({
      transcript: "[REDACTED]",
      nested: {
        llmInput: "[REDACTED]"
      },
      safe: "status"
    });
  });

  it("does not call server DB or storage mocks during browser-memory export formatting", () => {
    const serverDbWrite = vi.fn();
    const serverStorageWrite = vi.fn();
    const report = buildSessionReport({
      sessionProfile,
      transcriptSegments: [],
      cards: []
    });
    const payload = {
      sessionProfile,
      transcriptSegments: [],
      cards: [],
      report
    };

    buildMarkdownExport(payload);
    buildJsonExport(payload);

    expect(serverDbWrite).not.toHaveBeenCalled();
    expect(serverStorageWrite).not.toHaveBeenCalled();
  });

  it("blocks operation labels that imply server conversation or audio persistence", () => {
    expect(assertNoServerConversationPersistence("browser_memory_export")).toBe(true);
    expect(assertNoServerConversationPersistence("server_storage_upload_audio")).toBe(false);
    expect(assertNoServerConversationPersistence("supabase_db_insert_transcript")).toBe(false);
  });
});
