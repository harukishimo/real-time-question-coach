import type { ConversationType, Industry } from "@/lib/types";
import recruitingDefault from "../../playbooks/recruiting/default.json";
import requirementsDefault from "../../playbooks/requirements/default.json";
import salesDefault from "../../playbooks/sales/default.json";
import salesManufacturing from "../../playbooks/sales/manufacturing.json";
import userResearchDefault from "../../playbooks/user-research/default.json";

export type KnowledgeSet = {
  id: string;
  conversationType: ConversationType;
  industry: Industry | "any";
  title: string;
  description: string;
  mustCheck: string[];
  signals: string[];
  importantTerms: string[];
  ambiguousTerms: string[];
  mustAskTemplates: string[];
  avoid: string[];
  completionCriteria: string[];
  cardRules: string[];
};

type PlaybookSource = {
  id: string;
  conversationType: ConversationType;
  industry: Industry | "any";
  title: string;
  description: string;
  mustCheck: string[];
  signals: string[];
  ambiguousTerms: string[];
  goodQuestions: string[];
  avoid: string[];
  completionCriteria: string[];
  cardRules: string[];
};

const playbookSources = [
  salesManufacturing as PlaybookSource,
  salesDefault as PlaybookSource,
  requirementsDefault as PlaybookSource,
  recruitingDefault as PlaybookSource,
  userResearchDefault as PlaybookSource
];

const genericImportantTerms = [
  "決裁",
  "予算",
  "導入時期",
  "権限",
  "承認",
  "例外",
  "データ",
  "保存",
  "転職理由",
  "期待",
  "懸念",
  "条件",
  "頻度",
  "代替",
  "判断",
  "失敗"
];

function toKnowledgeSet(playbook: PlaybookSource): KnowledgeSet {
  const importantTerms = [
    ...genericImportantTerms,
    ...playbook.signals,
    ...playbook.mustCheck,
    ...playbook.ambiguousTerms
  ];

  return {
    id: playbook.id,
    conversationType: playbook.conversationType,
    industry: playbook.industry,
    title: playbook.title,
    description: playbook.description,
    mustCheck: playbook.mustCheck,
    signals: playbook.signals,
    importantTerms: [...new Set(importantTerms)],
    ambiguousTerms: playbook.ambiguousTerms,
    mustAskTemplates: playbook.goodQuestions,
    avoid: playbook.avoid,
    completionCriteria: playbook.completionCriteria,
    cardRules: playbook.cardRules
  };
}

export const KNOWLEDGE_SETS: KnowledgeSet[] = playbookSources.map(toKnowledgeSet);

export function resolveKnowledgeSet(
  conversationType: ConversationType,
  industry: Industry
): KnowledgeSet {
  return (
    KNOWLEDGE_SETS.find(
      (item) => item.conversationType === conversationType && item.industry === industry
    ) ??
    KNOWLEDGE_SETS.find(
      (item) => item.conversationType === conversationType && item.industry === "any"
    ) ??
    KNOWLEDGE_SETS[1]
  );
}
