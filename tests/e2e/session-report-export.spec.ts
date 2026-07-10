import { expect, test } from "@playwright/test";
import { buildReport, login, startDefaultSession } from "./helpers";

test("session report supports markdown/json export, local save, and discard", async ({ page }) => {
  await buildReport(page);

  const markdownDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Markdown export" }).click();
  const markdownDownload = await markdownDownloadPromise;
  expect(markdownDownload.suggestedFilename()).toBe("realtime-question-coach-report.md");

  const jsonDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "JSON export" }).click();
  const jsonDownload = await jsonDownloadPromise;
  expect(jsonDownload.suggestedFilename()).toBe("realtime-question-coach-report.json");

  await page.getByRole("button", { name: "ローカル保存" }).click();
  await expect(page.getByRole("status")).toContainText("このブラウザに保存しました");
  await expect
    .poll(() => page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith("rqc:")).length))
    .toBe(1);

  const savedRecord = await page.evaluate(() => {
    const key = Object.keys(localStorage).find((candidate) => candidate.startsWith("rqc:"));
    return key ? JSON.parse(localStorage.getItem(key) ?? "null") : null;
  });
  expect(savedRecord.schemaVersion).toBe(2);
  expect(savedRecord.ownerUserId).toBe("dev-user-001");
  expect(savedRecord.payload.transcriptSegments.length).toBeGreaterThan(0);
  expect(savedRecord.payload.report.sessionId).toBe(savedRecord.payload.sessionProfile.id);

  await page.getByRole("button", { name: "保存済みデータを残して終了" }).click();
  await expect(page.getByRole("heading", { name: "保存済みセッション" })).toBeVisible();
  await expect(page.getByLabel("保存済みセッション")).toContainText("文字起こし 1件");

  await page.reload();
  await login(page);
  await expect(page.getByLabel("保存済みセッション")).toContainText("MVPで必ず確認すべき要件");
  await page.getByLabel("保存済みセッション").getByRole("button", { name: "開く" }).click();
  await expect(page.getByRole("heading", { name: "振り返り" })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("保存済みセッションをこのブラウザから読み込みました");

  await page.getByRole("button", { name: "破棄" }).click();
  await expect(page.getByRole("heading", { name: "会話前の設定" })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith("rqc:")).length))
    .toBe(0);
});

test("local save reports browser storage failures without losing the report", async ({ page }) => {
  await buildReport(page);
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("Storage is unavailable", "QuotaExceededError");
    };
  });

  await page.getByRole("button", { name: "ローカル保存" }).click();

  await expect(page.getByRole("status")).toContainText("ローカル保存に失敗しました");
  await expect(page.getByRole("heading", { name: "振り返り" })).toBeVisible();
  await expect(page.getByRole("button", { name: "保存済みデータを残して終了" })).toBeDisabled();
});

test("failed report generation is not treated as exportable report", async ({ page }) => {
  await startDefaultSession(page);
  await expect(page.getByLabel("文字起こし")).toContainText("承認者");
  await page.route("**/api/report", async (route) => {
    await route.fulfill({
      status: 422,
      contentType: "application/json",
      body: JSON.stringify({
        error: {
          code: "schema_mismatch",
          message: "LLM report response did not match the expected schema."
        },
        diagnostic: {
          code: "schema_mismatch",
          category: "report",
          provider: "openai",
          retryable: false,
          severity: "error"
        }
      })
    });
  });

  await page.getByRole("button", { name: "終了" }).click();

  await expect(page.getByRole("heading", { name: "要件定義" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "振り返り" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Markdown export" })).toHaveCount(0);
});
