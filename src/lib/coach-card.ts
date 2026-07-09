import type { CoachCard, CoachCardCandidate, CoachCardStatus } from "@/lib/types";

const ACTIVE_CARD_LIMIT = 6;

function makeCardId(candidate: CoachCardCandidate): string {
  return `card-${candidate.stableKey.replace(/[^a-zA-Z0-9一-龠ぁ-んァ-ン]/g, "-")}`;
}

function isSameCard(card: CoachCard, candidate: CoachCardCandidate): boolean {
  return card.id === makeCardId(candidate) || card.question === candidate.question;
}

function isDisplayCard(card: CoachCard): boolean {
  return card.status === "active" || card.status === "pinned";
}

export function getActiveCardLimit() {
  return ACTIVE_CARD_LIMIT;
}

export function normalizeActiveCardLimit(cards: CoachCard[]): CoachCard[] {
  const displayCards = cards.filter(isDisplayCard);
  if (displayCards.length <= ACTIVE_CARD_LIMIT) {
    return cards;
  }

  const keptPinnedCards = new Set(
    displayCards
      .filter((card) => card.status === "pinned")
      .sort((a, b) => b.score - a.score)
      .slice(0, ACTIVE_CARD_LIMIT)
  );
  const remainingSlots = Math.max(0, ACTIVE_CARD_LIMIT - keptPinnedCards.size);
  const keptActiveCards = new Set(
    displayCards
      .filter((card) => card.status === "active")
      .sort((a, b) => b.score - a.score)
      .slice(0, remainingSlots)
  );

  return cards.map((card) => {
    if (!isDisplayCard(card)) {
      return card;
    }
    if (card.status === "pinned" && keptPinnedCards.has(card)) {
      return card;
    }
    if (card.status === "active" && keptActiveCards.has(card)) {
      return card;
    }

    return {
      ...card,
      status: "queued"
    };
  });
}

export function applyCoachCardCandidates(
  existingCards: CoachCard[],
  candidates: CoachCardCandidate[]
): CoachCard[] {
  const normalizedExistingCards = normalizeActiveCardLimit(existingCards);
  const dedupedCandidates = candidates.filter(
    (candidate) => !normalizedExistingCards.some((card) => isSameCard(card, candidate))
  );

  const cards = [...normalizedExistingCards];

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
      status: "queued",
      createdAt: new Date().toISOString()
    };

    const activeCards = cards.filter(isDisplayCard);
    const demotableCards = activeCards.filter((card) => card.status === "active");

    if (activeCards.length < ACTIVE_CARD_LIMIT) {
      cards.push({
        ...nextCard,
        status: "active"
      });
      return;
    }

    const lowestDemotable = [...demotableCards].sort((a, b) => a.score - b.score)[0];

    if (lowestDemotable && candidate.score > lowestDemotable.score) {
      const index = cards.findIndex((card) => card === lowestDemotable);
      cards[index] = {
        ...lowestDemotable,
        status: "queued"
      };
      cards.push({
        ...nextCard,
        status: "active"
      });
      return;
    }

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
  const normalizedCards = normalizeActiveCardLimit(cards);
  const activeCount = normalizedCards.filter(isDisplayCard).length;
  const slots = Math.max(0, ACTIVE_CARD_LIMIT - activeCount);
  const promotedCards = new Set(
    normalizedCards
      .filter((card) => card.status === "queued")
      .sort((a, b) => b.score - a.score)
      .slice(0, slots)
  );

  return normalizedCards.map((card) => {
    if (!promotedCards.has(card)) {
      return card;
    }

    return {
      ...card,
      status: "active"
    };
  });
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
