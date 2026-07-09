import { describe, expect, it } from "vitest";
import {
  createSessionProfile,
  normalizeMustCheckItems,
  validateSessionSetupInput
} from "@/lib/session-profile";

describe("session profile", () => {
  it("validates setup input and creates a profile with resolved knowledge", () => {
    const validation = validateSessionSetupInput({
      conversationType: "requirements",
      industry: "it",
      purpose: "権限と保存方針を確認する",
      mustCheckItems: ["権限", "保存方針"],
      audioSource: "dummy",
      consentNoServerStorage: true
    });

    expect(validation.ok).toBe(true);
    if (!validation.ok) return;

    const profile = createSessionProfile(validation.value);
    expect(profile.knowledgeSetId).toBe("requirements/default");
    expect(profile.playbookTitle).toBe("要件定義ヒアリング");
    expect(profile.playbookMustCheck).toContain("MVPで必ず成立させる業務成果と対象外範囲");
    expect(profile.mustAskTemplates).toContain(
      "MVPで最初に業務上達成できていないと困ることは何ですか？"
    );
    expect(profile.cardRules).toContain(
      "権限が登場したらロール・操作・対象データ・承認者を分解する"
    );
    expect(profile.importantTerms).toContain("権限");
    expect(profile.mustCheckItems).toEqual(["権限", "保存方針"]);
  });

  it("accepts the minimum required setup fields and defaults non-required settings", () => {
    const validation = validateSessionSetupInput({
      conversationType: "sales",
      industry: "manufacturing",
      purpose: "導入判断を確認する"
    });

    expect(validation.ok).toBe(true);
    if (!validation.ok) return;
    expect(validation.value.audioSource).toBe("dummy");
    expect(validation.value.consentNoServerStorage).toBe(true);
  });

  it("rejects setup that explicitly opts into unsupported server conversation storage", () => {
    const validation = validateSessionSetupInput({
      conversationType: "sales",
      industry: "manufacturing",
      purpose: "導入判断を確認する",
      mustCheckItems: [],
      audioSource: "dummy",
      consentNoServerStorage: false
    });

    expect(validation.ok).toBe(false);
  });

  it("normalizes must-check text", () => {
    expect(normalizeMustCheckItems("権限\n保存方針,導入時期")).toEqual([
      "権限",
      "保存方針",
      "導入時期"
    ]);
  });
});
