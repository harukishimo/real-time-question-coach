import { describe, expect, it } from "vitest";
import { KNOWLEDGE_SETS, resolveKnowledgeSet } from "@/lib/knowledge";
import type { ConversationType } from "@/lib/types";

const conversationTypes: ConversationType[] = [
  "sales",
  "requirements",
  "recruiting",
  "user_research"
];

describe("playbook knowledge sets", () => {
  it("loads repository playbooks for every conversation type", () => {
    conversationTypes.forEach((conversationType) => {
      expect(
        KNOWLEDGE_SETS.some((knowledgeSet) => knowledgeSet.conversationType === conversationType)
      ).toBe(true);
    });
  });

  it("keeps playbooks bounded for realtime coach cards", () => {
    KNOWLEDGE_SETS.forEach((knowledgeSet) => {
      expect(knowledgeSet.mustCheck.length).toBeGreaterThan(0);
      expect(knowledgeSet.mustCheck.length).toBeLessThanOrEqual(8);
      expect(knowledgeSet.signals.length).toBeGreaterThan(0);
      expect(knowledgeSet.signals.length).toBeLessThanOrEqual(12);
      expect(knowledgeSet.ambiguousTerms.length).toBeGreaterThan(0);
      expect(knowledgeSet.ambiguousTerms.length).toBeLessThanOrEqual(8);
      expect(knowledgeSet.mustAskTemplates.length).toBeGreaterThan(0);
      expect(knowledgeSet.mustAskTemplates.length).toBeLessThanOrEqual(10);
      expect(knowledgeSet.avoid.length).toBeGreaterThan(0);
      expect(knowledgeSet.avoid.length).toBeLessThanOrEqual(6);
      expect(knowledgeSet.completionCriteria.length).toBeGreaterThan(0);
      expect(knowledgeSet.completionCriteria.length).toBeLessThanOrEqual(8);
      expect(knowledgeSet.cardRules.length).toBeGreaterThan(0);
      expect(knowledgeSet.cardRules.length).toBeLessThanOrEqual(6);
    });
  });

  it("resolves industry-specific playbooks before defaults", () => {
    expect(resolveKnowledgeSet("sales", "manufacturing").id).toBe("sales/manufacturing");
    expect(resolveKnowledgeSet("sales", "it").id).toBe("sales/default");
    expect(resolveKnowledgeSet("requirements", "finance").id).toBe("requirements/default");
  });
});
