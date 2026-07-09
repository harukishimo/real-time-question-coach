import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const secretLikePattern = /(sk-[a-zA-Z0-9_-]{8,}|Bearer\s+[a-zA-Z0-9._-]+|service_role[a-zA-Z0-9_-]+)/;
const personalUrlPattern = /https:\/\/(?!<your-app-domain>)[a-z0-9.-]+\.(vercel\.app|supabase\.co)/i;

function read(path: string) {
  return readFileSync(path, "utf8");
}

describe("deploy readiness docs security scan", () => {
  it("keeps .env.example as placeholders without real-looking secrets", () => {
    const envExample = read(".env.example");

    expect(envExample).toContain("OPENAI_API_KEY=");
    expect(envExample).toContain("ANTHROPIC_API_KEY=");
    expect(envExample).toContain("RUN_REAL_PROVIDER_SMOKE=0");
    expect(envExample).not.toMatch(secretLikePattern);
  });

  it("documents env/callback/human-run boundaries without personal production values", () => {
    const readme = read("README.md");

    expect(readme).toContain("http://localhost:3000/auth/callback");
    expect(readme).toContain("https://<your-app-domain>/auth/callback");
    expect(readme).toContain("RUN_REAL_PROVIDER_SMOKE=1");
    expect(readme).toContain("human-run");
    expect(readme).not.toMatch(secretLikePattern);
    expect(readme).not.toMatch(personalUrlPattern);
  });
});
