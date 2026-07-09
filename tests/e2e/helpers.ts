import { expect, type Page } from "@playwright/test";

export async function login(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Googleでログイン" }).click();
  await expect(page.getByRole("heading", { name: "会話前の設定" })).toBeVisible();
}

export async function startDefaultSession(page: Page) {
  await login(page);
  await page.getByRole("button", { name: "セッション開始" }).click();
  await expect(page.getByRole("heading", { name: "要件定義" })).toBeVisible();
}

export async function buildReport(page: Page) {
  await startDefaultSession(page);
  await page.getByRole("button", { name: "ダミー文字起こし開始" }).click();
  await expect(page.getByLabel("文字起こし")).toContainText("承認者");
  await page.getByRole("button", { name: "終了" }).click();
  await expect(page.getByRole("heading", { name: "振り返り" })).toBeVisible();
}
