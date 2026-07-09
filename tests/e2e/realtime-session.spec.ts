import { expect, test } from "@playwright/test";
import { startDefaultSession } from "./helpers";

test("realtime session wires dummy transcript, coach cards, counts, and actions", async ({ page }) => {
  let coachRequestCount = 0;
  const coachRequestBodies: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url().includes("/api/coach")) {
      coachRequestCount += 1;
      coachRequestBodies.push(request.postData() ?? "");
    }
  });

  await startDefaultSession(page);
  await page.getByRole("button", { name: "診断" }).click();
  await expect(page.getByRole("status")).toContainText("Provider diagnostics OK:");
  await expect(page.getByRole("status")).not.toContainText("sk-");

  for (let index = 0; index < 3; index += 1) {
    await page.getByRole("button", { name: "ダミー文字起こし開始" }).click();
  }

  await expect(page.getByLabel("文字起こし")).toContainText("承認者");
  await expect(page.getByLabel("AI補助カード")).toContainText(/active [1-6]/);

  const activeText = await page.getByLabel("AI補助カード").locator(".pane-header span").innerText();
  const activeCount = Number(activeText.match(/active (\d+)/)?.[1] ?? "0");
  expect(activeCount).toBeLessThanOrEqual(6);

  const coachRequestsBeforeRecheck = coachRequestCount;
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.request().method() === "POST" && response.url().includes("/api/coach")
    ),
    page.getByRole("button", { name: "再判定" }).first().click()
  ]);
  expect(coachRequestCount).toBeGreaterThan(coachRequestsBeforeRecheck);
  expect(coachRequestBodies.at(-1)).toContain('"manualRecheck":true');
  await expect(page.getByRole("status")).toContainText("Coach gate:");

  await page.getByRole("button", { name: "固定" }).first().click();
  await expect(page.getByLabel("AI補助カード")).toContainText(/active [1-6]/);

  await page.getByRole("button", { name: "聞いた" }).first().click();
  await expect(page.getByLabel("AI補助カード")).toContainText("done 1");
});

test("six active cards remain reachable inside the scrollable coach pane", async ({ page }) => {
  const cards = Array.from({ length: 6 }, (_, index) => ({
    id: `scroll-card-${index + 1}`,
    title: `深掘り確認${index + 1}`,
    question: `論点${index + 1}について、担当者・条件・具体例をもう少し確認しますか？`,
    reason: "会話中に確認しておきたい不足情報があるため表示しています。",
    priority: "medium",
    score: 90 - index,
    status: "active",
    sourceSegmentIds: [`scroll-segment-${index + 1}`],
    ruleIds: ["scroll-limit-test"],
    createdAt: new Date(index * 1000).toISOString()
  }));

  await page.route("**/api/coach", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        provider: "mock",
        gate: { shouldCallLlm: true, reasons: ["scroll-limit-test"] },
        candidates: [],
        cards,
        storagePolicy: { persistedToServer: false, bodyLogged: false }
      })
    });
  });

  await startDefaultSession(page);
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.request().method() === "POST" && response.url().includes("/api/coach")
    ),
    page.getByRole("button", { name: "ダミー文字起こし開始" }).click()
  ]);

  const coachPane = page.getByLabel("AI補助カード");
  const coachList = coachPane.locator(".coach-list");
  await expect(coachPane).toContainText("active 6");
  await expect(coachList.locator(".coach-card")).toHaveCount(6);

  const scrollState = await coachList.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      clientHeight: element.clientHeight,
      overflowY: style.overflowY,
      scrollHeight: element.scrollHeight
    };
  });
  expect(scrollState.overflowY).toBe("auto");
  expect(scrollState.scrollHeight).toBeGreaterThan(scrollState.clientHeight);

  await coachList.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  expect(await coachList.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await expect(coachList.locator(".coach-card").last()).toContainText("深掘り確認6");
});

test("manual recheck double click does not create duplicate in-flight coach dispatches", async ({
  page
}) => {
  let coachRequestCount = 0;
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url().includes("/api/coach")) {
      coachRequestCount += 1;
    }
  });

  await startDefaultSession(page);
  await page.getByRole("button", { name: "ダミー文字起こし開始" }).click();
  await expect(page.getByLabel("AI補助カード")).toContainText("確認");

  await page.route("**/api/coach", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 200));
    await route.continue();
  });

  const before = coachRequestCount;
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.request().method() === "POST" && response.url().includes("/api/coach")
    ),
    page.getByRole("button", { name: "再判定" }).first().dblclick()
  ]);
  await page.waitForTimeout(300);

  expect(coachRequestCount - before).toBe(1);
});

test("local coach cards appear before delayed provider response", async ({ page }) => {
  await page.route("**/api/coach", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await route.continue();
  });

  await startDefaultSession(page);
  await page.getByRole("button", { name: "ダミー文字起こし開始" }).click();

  await expect(page.getByLabel("AI補助カード")).toContainText(/active [1-6]/, {
    timeout: 500
  });
  await expect(page.getByRole("status")).toContainText("Coach local", {
    timeout: 500
  });
});

test("provider diagnostics not-ready UI shows env names without secrets", async ({ page }) => {
  await startDefaultSession(page);
  await page.route("**/api/diagnostics", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        providerReady: false,
        llmProvider: "openai",
        sttProvider: "openai",
        missingRequiredServerKeys: ["OPENAI_API_KEY", "STT_API_KEY"]
      })
    });
  });

  await page.getByRole("button", { name: "診断" }).click();

  await expect(page.getByRole("status")).toContainText("Provider diagnostics not ready:");
  await expect(page.getByRole("status")).toContainText("OPENAI_API_KEY");
  await expect(page.getByRole("status")).not.toContainText("sk-");
});
