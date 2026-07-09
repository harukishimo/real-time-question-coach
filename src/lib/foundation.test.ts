import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FOUNDATION_STATUS, REQUIRED_SCRIPTS } from "./foundation";

type PackageJson = {
  scripts?: Record<string, string>;
};

describe("project foundation", () => {
  it("declares the W01 foundation status", () => {
    expect(FOUNDATION_STATUS.workUnit).toBe("RQC-W01");
    expect(FOUNDATION_STATUS.appName).toBe("Realtime Question Coach MVP");
    expect(FOUNDATION_STATUS.storagePolicy).toContain("No server DB");
  });

  it("provides the required package scripts", () => {
    const packageJson = JSON.parse(
      readFileSync(new URL("../../package.json", import.meta.url), "utf8")
    ) as PackageJson;

    for (const scriptName of REQUIRED_SCRIPTS) {
      expect(packageJson.scripts?.[scriptName]).toEqual(expect.any(String));
    }
  });
});
