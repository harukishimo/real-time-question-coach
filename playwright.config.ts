import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.PORT ?? 3100);
const baseURL = `http://127.0.0.1:${port}`;
const fakeMediaLaunchOptions = {
  args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"]
};

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  expect: {
    timeout: 5_000
  },
  fullyParallel: true,
  reporter: [["list"]],
  use: {
    baseURL,
    launchOptions: fakeMediaLaunchOptions,
    permissions: ["microphone"],
    trace: "retain-on-first-failure",
    screenshot: {
      mode: "only-on-failure",
      fullPage: true
    }
  },
  webServer: {
    command: `DEV_AUTH_ENABLED=true RQC_LOCAL_RUNTIME=true NEXT_PUBLIC_RQC_AUTH_MODE=mock npm run build && DEV_AUTH_ENABLED=true RQC_LOCAL_RUNTIME=true NEXT_PUBLIC_RQC_AUTH_MODE=mock npm run start -- --hostname 127.0.0.1 --port ${port}`,
    url: baseURL,
    timeout: 180_000,
    reuseExistingServer: false
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: fakeMediaLaunchOptions,
        permissions: ["microphone"]
      }
    }
  ]
});
