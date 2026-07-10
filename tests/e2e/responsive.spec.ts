import { expect, test } from "@playwright/test";
import { login, startDefaultSession } from "./helpers";

async function expectNoHorizontalOverflow(pageWidth: number, scrollWidth: number) {
  expect(scrollWidth).toBeLessThanOrEqual(pageWidth + 1);
}

test("session setup fits desktop and tablet viewports", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await login(page);
  await expect(page.getByRole("heading", { name: "会話前の設定" })).toBeVisible();
  await expectNoHorizontalOverflow(
    1280,
    await page.evaluate(() => document.documentElement.scrollWidth)
  );
  expect((await page.screenshot()).byteLength).toBeGreaterThan(0);

  await page.setViewportSize({ width: 768, height: 900 });
  await expect(page.getByRole("heading", { name: "会話前の設定" })).toBeVisible();
  await expectNoHorizontalOverflow(
    768,
    await page.evaluate(() => document.documentElement.scrollWidth)
  );
  expect((await page.screenshot()).byteLength).toBeGreaterThan(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("heading", { name: "会話前の設定" })).toBeVisible();
  await expectNoHorizontalOverflow(
    390,
    await page.evaluate(() => document.documentElement.scrollWidth)
  );
  expect((await page.screenshot()).byteLength).toBeGreaterThan(0);
});

test("realtime session fits desktop and tablet viewports", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await startDefaultSession(page);
  await expect(page.getByLabel("文字起こし")).toContainText("承認者");
  await expectNoHorizontalOverflow(
    1280,
    await page.evaluate(() => document.documentElement.scrollWidth)
  );

  await page.setViewportSize({ width: 768, height: 900 });
  await expect(page.getByLabel("文字起こし")).toBeVisible();
  await expect(page.getByLabel("AI補助カード")).toBeVisible();
  await expectNoHorizontalOverflow(
    768,
    await page.evaluate(() => document.documentElement.scrollWidth)
  );
  expect((await page.screenshot()).byteLength).toBeGreaterThan(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByLabel("文字起こし")).toBeVisible();
  await expect(page.getByLabel("AI補助カード")).toBeVisible();
  await expectNoHorizontalOverflow(
    390,
    await page.evaluate(() => document.documentElement.scrollWidth)
  );
  expect((await page.screenshot()).byteLength).toBeGreaterThan(0);
});
