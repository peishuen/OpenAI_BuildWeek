/*
  Configure Playwright to start the local app before browser tests run.
  Source: https://playwright.dev/docs/test-configuration
*/
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 10_000,
  use: {
    baseURL: "http://127.0.0.1:5173",
  },
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: !process.env.CI,
  }
})
