import { defineConfig } from "@playwright/test";

const port = Number(process.env.E2E_PORT || 3199);

export default defineConfig({
  testDir: "./e2e/tests",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    headless: true,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: "node e2e/test-server.mjs",
    url: `http://127.0.0.1:${port}/health/live`,
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
  },
});
