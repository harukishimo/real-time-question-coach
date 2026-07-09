import { expect, test } from "@playwright/test";
import { buildReport, startDefaultSession } from "./helpers";

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
  await expect(page.getByRole("status")).toContainText("Saved locally in this browser.");
  await expect
    .poll(() => page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith("rqc:")).length))
    .toBe(1);

  await page.getByRole("button", { name: "破棄" }).click();
  await expect(page.getByRole("heading", { name: "会話前の設定" })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith("rqc:")).length))
    .toBe(0);
});

test("failed report generation is not treated as exportable report", async ({ page }) => {
  await startDefaultSession(page);
  await page.getByRole("button", { name: "ダミー文字起こし開始" }).click();
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
