/*
  Configure Playwright to start the local app before browser tests run
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
    // Wait for Express as well as Vite so dashboard tests never call /api before it is ready
    url: "http://127.0.0.1:3001/api/health",
    reuseExistingServer: !process.env.CI,
  }
})
