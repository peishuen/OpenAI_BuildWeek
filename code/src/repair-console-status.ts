import type { ProposalMode, RunStatus } from "./repair";

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

export function canStartRepair(mode: ProposalMode, qwenAvailable: boolean, isBusy: boolean) {
  return !isBusy && (mode === "fixture" || qwenAvailable);
}

export function canSimulateRegression(
  state: "baseline" | "alternate" | undefined,
  isBusy: boolean,
  runStatus: RunStatus | undefined,
) {
  return state !== undefined && !isBusy && (runStatus === undefined || runStatus === "completed" || runStatus === "failed");
}

export function canResetSandbox(canReset: boolean, isBusy: boolean) {
  return canReset && !isBusy;
}
