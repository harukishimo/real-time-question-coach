export const REQUIRED_SCRIPTS = [
  "dev",
  "build",
  "start",
  "lint",
  "typecheck",
  "test",
  "test:e2e"
] as const;

export const FOUNDATION_STATUS = {
  workUnit: "RQC-W01",
  name: "Project foundation",
  appName: "Realtime Question Coach MVP",
  storagePolicy: "Browser memory first. No server DB for conversation data.",
  providerMode: "Mock-first foundations; real providers are added behind adapters in later work units."
} as const;
