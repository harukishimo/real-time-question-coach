import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test("session setup validates required fields and excludes counterpart role", async ({ page }) => {
  await login(page);

  await expect(page.getByLabel("会話タイプ")).toHaveValue("requirements");
  await expect(page.getByLabel("業界")).toHaveValue("it");
  await expect(page.getByLabel("相手役職")).toHaveCount(0);

  await page.getByLabel("今回の目的").fill("");
  await expect(page.getByRole("button", { name: "セッション開始" })).toBeDisabled();

  await page.getByLabel("今回の目的").fill("権限と保存方針を確認する");
  await expect(page.getByText("会話本文・音声・AIカードはサーバーDBに保存しません。")).toBeVisible();
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "セッション開始" })).toBeEnabled();
});
