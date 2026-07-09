import type { CoachCard, SessionProfile, SessionReport, TranscriptSegment } from "@/lib/types";

export function buildSessionReport(input: {
  sessionProfile: SessionProfile;
  transcriptSegments: TranscriptSegment[];
  cards: CoachCard[];
}): SessionReport {
  const doneCards = input.cards.filter((card) => card.status === "done");
  const laterCards = input.cards.filter(
    (card) => card.status === "later" || card.status === "queued" || card.status === "active"
  );
  const dismissedCards = input.cards.filter((card) => card.status === "dismissed");
  const transcriptText = input.transcriptSegments.map((segment) => segment.text).join(" ");

  const missedMustCheckItems = input.sessionProfile.mustCheckItems.filter(
    (item) => !transcriptText.includes(item)
  );

  return {
    sessionId: input.sessionProfile.id,
    heardItems: doneCards.length
      ? doneCards.map((card) => card.title)
      : ["会話中に完了扱いにしたカードはまだありません。"],
    missedItems: [
      ...laterCards.map((card) => card.title),
      ...missedMustCheckItems.map((item) => `未確認: ${item}`)
    ].slice(0, 8),
    nextActions: [
      ...laterCards.map((card) => card.question),
      ...missedMustCheckItems.map((item) => `次回「${item}」を確認する`)
    ].slice(0, 8),
    cardStats: {
      total: input.cards.length,
      done: doneCards.length,
      later: laterCards.length,
      dismissed: dismissedCards.length
    },
    generatedAt: new Date().toISOString()
  };
}
