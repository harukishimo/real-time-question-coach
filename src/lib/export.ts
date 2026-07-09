import type { CoachCard, SessionProfile, SessionReport, TranscriptSegment } from "@/lib/types";

export type ExportPayload = {
  sessionProfile: SessionProfile;
  transcriptSegments: TranscriptSegment[];
  cards: CoachCard[];
  report: SessionReport;
};

export function buildMarkdownExport(payload: ExportPayload): string {
  const report = payload.report;
  return [
    `# Realtime Question Coach Report`,
    "",
    `Session: ${report.sessionId}`,
    `Generated: ${report.generatedAt}`,
    `Conversation Type: ${payload.sessionProfile.conversationType}`,
    `Industry: ${payload.sessionProfile.industry}`,
    "",
    "## 聞けたこと",
    ...report.heardItems.map((item) => `- ${item}`),
    "",
    "## 聞けなかったこと",
    ...report.missedItems.map((item) => `- ${item}`),
    "",
    "## 次回確認事項",
    ...report.nextActions.map((item) => `- ${item}`),
    "",
    "## Card Stats",
    `- total: ${report.cardStats.total}`,
    `- done: ${report.cardStats.done}`,
    `- later: ${report.cardStats.later}`,
    `- dismissed: ${report.cardStats.dismissed}`
  ].join("\n");
}

export function buildJsonExport(payload: ExportPayload): string {
  return JSON.stringify(payload, null, 2);
}

export function createEmptyReportPayload(sessionProfile: SessionProfile): ExportPayload {
  return {
    sessionProfile,
    transcriptSegments: [],
    cards: [],
    report: {
      sessionId: sessionProfile.id,
      heardItems: [],
      missedItems: [],
      nextActions: [],
      cardStats: {
        total: 0,
        done: 0,
        later: 0,
        dismissed: 0
      },
      generatedAt: new Date().toISOString()
    }
  };
}
