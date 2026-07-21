import { describe, expect, it } from "vitest";

import { approvalHintFor } from "../../src/repair-console-status";

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
