// Source: https://vitest.dev/config/#include
// Keep fast unit tests separate from Playwright's browser test files.
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/unit/**/*.test.ts"],
  },
});
