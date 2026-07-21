import { describe, expect, it } from "vitest";

import {
  approvalHintFor,
  canResetSandbox,
  canSimulateRegression,
  canStartRepair,
} from "../../src/repair-console-status";

describe("approvalHintFor", () => {
  it("explains that a proposal is still read-only while awaiting approval", () => {
    expect(approvalHintFor("awaitingApproval"))
      .toBe("No file has changed. Approval is required before patching.");
  });

  it("reports that an approved repair is being applied and verified", () => {
    expect(approvalHintFor("verifyingTarget"))
      .toBe("Approved repair is being applied and verified.");
  });

  it("reports successful application after all verification completes", () => {
    expect(approvalHintFor("completed"))
      .toBe("Approved repair applied successfully. Target test and full suite passed.");
  });

  it("does not show an approval hint after a failed repair", () => {
    expect(approvalHintFor("failed")).toBeUndefined();
  });
});

describe("sandbox console status", () => {
  it("allows only an available provider to start a repair", () => {
    expect(canStartRepair("qwen", false, false)).toBe(false);
    expect(canStartRepair("fixture", false, false)).toBe(true);
    expect(canStartRepair("qwen", true, true)).toBe(false);
  });

  it("allows one controlled mutation from either known fixture state while an action is not in progress", () => {
    expect(canSimulateRegression("baseline", false, undefined)).toBe(true);
    expect(canSimulateRegression("alternate", false, "completed")).toBe(true);
    expect(canSimulateRegression("baseline", true, undefined)).toBe(false);
    expect(canSimulateRegression("alternate", true, "completed")).toBe(false);
    expect(canSimulateRegression("alternate", false, "awaitingApproval")).toBe(false);
    expect(canResetSandbox(true, false)).toBe(true);
    expect(canResetSandbox(false, false)).toBe(false);
    expect(canResetSandbox(true, true)).toBe(false);
  });
});
