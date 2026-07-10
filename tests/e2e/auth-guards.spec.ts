import { expect, test } from "@playwright/test";

test("guest cannot reach protected UI state or protected APIs", async ({ page, request }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Realtime Question Coach" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "会話前の設定" })).toHaveCount(0);

  const responses = await Promise.all([
    request.post("/api/session/init", { data: {} }),
    request.post("/api/coach", { data: {} }),
    request.post("/api/report", { data: {} }),
    request.post("/api/stt-token", { data: { audioSource: "dummy" } })
  ]);

  expect(responses.map((response) => response.status())).toEqual([401, 401, 401, 401]);
});

test("auth callback URL renders the app shell without exposing protected state", async ({ page }) => {
  await page.goto("/auth/callback?code=mock-code&next=/");

  await expect(page.getByRole("heading", { name: "Realtime Question Coach" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "会話前の設定" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Googleでログイン" })).toBeVisible();
});

test("an authenticated user can log out without deleting browser-local saved sessions", async ({
  page
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Googleでログイン" }).click();
  await expect(page.getByRole("heading", { name: "会話前の設定" })).toBeVisible();

  await page.getByRole("button", { name: "ログアウト" }).click();

  await expect(page.getByRole("heading", { name: "Realtime Question Coach" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "会話前の設定" })).toHaveCount(0);
  await expect(page.getByRole("status")).toContainText("ログアウトしました");
});
