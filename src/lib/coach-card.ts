import type { CoachCard, CoachCardCandidate, CoachCardStatus } from "@/lib/types";

function makeCardId(candidate: CoachCardCandidate): string {
  return `card-${candidate.stableKey.replace(/[^a-zA-Z0-9一-龠ぁ-んァ-ン]/g, "-")}`;
}

function isSameCard(card: CoachCard, candidate: CoachCardCandidate): boolean {
  return card.id === makeCardId(candidate) || card.question === candidate.question;
}

function isDisplayCard(card: CoachCard): boolean {
  return card.status === "active" || card.status === "pinned";
}

export function applyCoachCardCandidates(
  existingCards: CoachCard[],
  candidates: CoachCardCandidate[]
): CoachCard[] {
  const dedupedCandidates = candidates.filter(
    (candidate) => !existingCards.some((card) => isSameCard(card, candidate))
  );

  const cards = [...existingCards];

  dedupedCandidates.forEach((candidate) => {
    const nextCard: CoachCard = {
      id: makeCardId(candidate),
      title: candidate.title,
      question: candidate.question,
      reason: candidate.reason,
      priority: candidate.priority,
      score: candidate.score,
      sourceSegmentIds: candidate.sourceSegmentIds,
      ruleIds: candidate.ruleIds,
      topicId: candidate.topicId,
      targetDimension: candidate.targetDimension,
      status: "active",
      createdAt: new Date().toISOString()
    };
    cards.push(nextCard);
  });

  return promoteQueuedCards(cards);
}

export function updateCardStatus(
  cards: CoachCard[],
  cardId: string,
  status: CoachCardStatus
): CoachCard[] {
  return promoteQueuedCards(
    cards.map((card) =>
      card.id === cardId
        ? {
            ...card,
            status
          }
        : card
    )
  );
}

export function promoteQueuedCards(cards: CoachCard[]): CoachCard[] {
  return cards.map((card) =>
    card.status === "queued"
      ? {
          ...card,
          status: "active"
        }
      : card
  );
}

export function countCardsByStatus(cards: CoachCard[]) {
  return {
    active: cards.filter(isDisplayCard).length,
    queued: cards.filter((card) => card.status === "queued").length,
    done: cards.filter((card) => card.status === "done").length,
    later: cards.filter((card) => card.status === "later").length,
    dismissed: cards.filter((card) => card.status === "dismissed").length
  };
}
