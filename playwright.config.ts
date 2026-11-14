import path from "node:path";
import { defineConfig } from "@playwright/test";

/**
 * Playwright config — E2E tests against the dev server.
 * The Next dev server is reused when already running (`reuseExistingServer`).
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false, // shared demo database — serial keeps it deterministic
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  globalSetup: path.join(__dirname, "e2e", "auth.setup.ts"),
  use: {
    baseURL: "http://localhost:3000",
    locale: "fr-FR",
    timezoneId: "Africa/Casablanca",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
