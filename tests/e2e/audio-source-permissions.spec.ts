import { expect, test, type Page } from "@playwright/test";
import { login } from "./helpers";

declare global {
  interface Window {
    __rqcMediaCalls: string[];
  }
}

async function installMediaDevices(page: Page, mode: "allow" | "deny-display" | "unsupported-display") {
  await page.addInitScript((selectedMode) => {
    window.__rqcMediaCalls = [];
    const createAudioStream = () => {
      const audioWindow = window as Window & typeof globalThis & {
        webkitAudioContext?: typeof AudioContext;
      };
      const AudioContextConstructor = audioWindow.AudioContext || audioWindow.webkitAudioContext;
      if (!AudioContextConstructor) return new MediaStream();
      const context = new AudioContextConstructor();
      const oscillator = context.createOscillator();
      const destination = context.createMediaStreamDestination();
      oscillator.connect(destination);
      oscillator.start();
      return destination.stream;
    };
    const mediaDevices = {
      getUserMedia: async (constraints: MediaStreamConstraints) => {
        window.__rqcMediaCalls.push(`getUserMedia:${JSON.stringify(constraints)}`);
        return createAudioStream();
      },
      getDisplayMedia:
        selectedMode === "unsupported-display"
          ? undefined
          : async (constraints: DisplayMediaStreamOptions) => {
              window.__rqcMediaCalls.push(`getDisplayMedia:${JSON.stringify(constraints)}`);
              if (selectedMode === "deny-display") {
                throw new Error("display denied");
              }
              return createAudioStream();
            }
    };

    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: mediaDevices
    });
  }, mode);
}

test("microphone source requests getUserMedia before STT token boundary", async ({ page }) => {
  await installMediaDevices(page, "allow");
  await login(page);

  await page.getByLabel("音声ソース").selectOption("microphone");
  await page.getByRole("button", { name: "セッション開始" }).click();
  await page.getByRole("button", { name: "音声接続開始" }).click();

  await expect(page.getByRole("status")).toContainText("マイクの音声ストリームを取得しました。");
  await expect(page.getByRole("status")).toContainText("Mock STT token ready.");
  await expect.poll(() => page.evaluate(() => window.__rqcMediaCalls)).toContainEqual(
    'getUserMedia:{"audio":true}'
  );
});

test("playwright browser grants microphone permission and exposes an audio stream", async ({
  baseURL,
  context,
  page
}) => {
  await context.grantPermissions(["microphone"], { origin: baseURL });
  await login(page);

  const microphoneProbe = await page.evaluate(async () => {
    const permissionStatus = await navigator.permissions.query({
      name: "microphone" as PermissionName
    });
    const devices = await navigator.mediaDevices.enumerateDevices();
    const deviceSummary = devices.map((device) => ({
      kind: device.kind,
      label: device.label
    }));

    const timeout = new Promise((resolve) => {
      window.setTimeout(
        () =>
          resolve({
            audioTrackCount: 0,
            devices: deviceSummary,
            firstTrackEnabled: null,
            firstTrackKind: null,
            firstTrackReadyState: null,
            permissionState: permissionStatus.state,
            secureContext: window.isSecureContext,
            timedOut: true
          }),
        8_000
      );
    });

    const capture = (async () => {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const tracks = stream.getAudioTracks();
      const result = {
        audioTrackCount: tracks.length,
        devices: deviceSummary,
        firstTrackEnabled: tracks[0]?.enabled ?? false,
        firstTrackKind: tracks[0]?.kind ?? null,
        firstTrackReadyState: tracks[0]?.readyState ?? null,
        permissionState: permissionStatus.state,
        secureContext: window.isSecureContext,
        timedOut: false
      };

      tracks.forEach((track) => track.stop());

      return result;
    })();

    return Promise.race([capture, timeout]);
  });

  expect(
    microphoneProbe,
    `Playwright browser microphone probe failed: ${JSON.stringify(microphoneProbe)}`
  ).toMatchObject({
    audioTrackCount: 1,
    firstTrackEnabled: true,
    firstTrackKind: "audio",
    firstTrackReadyState: "live",
    permissionState: "granted",
    secureContext: true,
    timedOut: false
  });

  await page.getByLabel("音声ソース").selectOption("microphone");
  await page.getByRole("button", { name: "セッション開始" }).click();
  await page.getByRole("button", { name: "音声接続開始" }).click();

  await expect(page.getByRole("status")).toContainText("マイクの音声ストリームを取得しました。");
  await expect(page.getByRole("status")).toContainText("Mock STT token ready.");
});

test("playwright browser reports microphone permission and fake audio devices", async ({
  baseURL,
  context,
  page
}) => {
  await context.grantPermissions(["microphone"], { origin: baseURL });
  await login(page);

  const microphoneEnvironment = await page.evaluate(async () => {
    const permissionStatus = await navigator.permissions.query({
      name: "microphone" as PermissionName
    });
    const devices = await navigator.mediaDevices.enumerateDevices();

    return {
      audioInputCount: devices.filter((device) => device.kind === "audioinput").length,
      permissionState: permissionStatus.state,
      secureContext: window.isSecureContext
    };
  });

  expect(microphoneEnvironment).toMatchObject({
    audioInputCount: expect.any(Number),
    permissionState: "granted"
  });
  expect(microphoneEnvironment.audioInputCount).toBeGreaterThan(0);
});

test("browser tab source requests getDisplayMedia and falls back to dummy when denied", async ({
  page
}) => {
  await installMediaDevices(page, "deny-display");
  await login(page);

  await page.getByLabel("音声ソース").selectOption("browser_tab");
  await page.getByRole("button", { name: "セッション開始" }).click();
  await page.getByRole("button", { name: "音声接続開始" }).click();

  await expect(page.getByRole("status")).toContainText(
    "Webタブ音声の権限が拒否されたため、ダミー文字起こしへ切り替えました。"
  );
  await expect.poll(() => page.evaluate(() => window.__rqcMediaCalls)).toContainEqual(
    'getDisplayMedia:{"audio":true,"video":true}'
  );
});

test("system audio source shows unsupported fallback when display capture is unavailable", async ({
  page
}) => {
  await installMediaDevices(page, "unsupported-display");
  await login(page);

  await page.getByLabel("音声ソース").selectOption("system_audio");
  await page.getByRole("button", { name: "セッション開始" }).click();
  await page.getByRole("button", { name: "音声接続開始" }).click();

  await expect(page.getByRole("status")).toContainText(
    "システム音声はこのブラウザで利用できないため、ダミー文字起こしへ切り替えました。"
  );
});
