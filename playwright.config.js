// Config Playwright pour la suite E2E. Boote un serveur Galatee dedie sur le
// port 3199 avec une base SQLite isolee (via e2e/test-server.mjs). La vraie
// base backend/data/galatee.sqlite n'est jamais touchee.

import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT || 3199);
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./e2e/tests",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false, // partagent le meme backend + DB : on serialise
  workers: 1,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  retries: process.env.CI ? 2 : 0,

  use: {
    baseURL: BASE_URL,
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    trace: "retain-on-failure",
    // Simule un vrai navigateur, respecte les cookies HttpOnly.
    storageState: undefined,
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  webServer: {
    // On lance le test-server (qui monte createApp + seed) et on attend la
    // ligne "E2E server ready" avant de lancer les tests.
    command: "node e2e/test-server.mjs",
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      E2E_PORT: String(PORT),
    },
  },
});
