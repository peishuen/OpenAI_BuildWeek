import type { RunStatus } from "./repair";

export function approvalHintFor(status: RunStatus | undefined) {
  if (status === "awaitingApproval") {
    return "No file has changed. Approval is required before patching.";
  }
  if (status === "approved" || status === "applyingPatch" || status === "verifyingTarget" || status === "verifyingSuite") {
    return "Approved repair is being applied and verified.";
  }
  if (status === "completed") {
    return "Approved repair applied successfully. Target test and full suite passed.";
  }
  return undefined;
}
