import { describe, expect, it } from "vitest";

import { readRepairEnvironment } from "../../src/env";

describe("readRepairEnvironment", () => {
  it("reads the server-only Qwen configuration", () => {
    expect(readRepairEnvironment({
      QWEN_API_KEY: "test-key",
      QWEN_BASE_URL: "https://workspace.example/compatible-mode/v1",
      REPAIR_PROPOSAL_PROVIDER: "qwen",
    })).toEqual({
      QWEN_API_KEY: "test-key",
      QWEN_BASE_URL: "https://workspace.example/compatible-mode/v1",
      QWEN_MODEL: "qwen3.7-plus-2026-05-26",
      REPAIR_PROPOSAL_PROVIDER: "qwen",
    });
  });

  it("keeps fixture mode as the safe default", () => {
    expect(readRepairEnvironment({})).toMatchObject({
      QWEN_MODEL: "qwen3.7-plus-2026-05-26",
      REPAIR_PROPOSAL_PROVIDER: "fixture",
    });
  });
});
