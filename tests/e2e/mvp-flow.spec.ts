import { expect, test } from "@playwright/test";

test("runs the MVP login setup session report flow", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Realtime Question Coach" })).toBeVisible();
  await page.getByRole("button", { name: "Googleでログイン" }).click();

  await expect(page.getByRole("heading", { name: "会話前の設定" })).toBeVisible();
  await expect(page.getByLabel("会話タイプ")).toHaveValue("requirements");
  await page.getByRole("button", { name: "セッション開始" }).click();

  await expect(page.getByRole("heading", { name: "要件定義" })).toBeVisible();
  await page.getByRole("button", { name: "音声接続開始" }).click();
  await page.getByRole("button", { name: "ダミー文字起こし開始" }).click();

  await expect(page.getByLabel("文字起こし")).toContainText("承認者");
  await expect(page.getByLabel("AI補助カード")).toContainText("確認");
  await expect(page.getByLabel("AI補助カード")).toContainText(/active \d+/);

  await page.getByRole("button", { name: "聞いた" }).first().click();
  await page.getByRole("button", { name: "終了" }).click();

  await expect(page.getByRole("heading", { name: "振り返り" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "聞けたこと" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Markdown export" })).toBeVisible();
  await expect(page.getByRole("button", { name: "JSON export" })).toBeVisible();
});
