/*
    Define the safe data and state changes used by a repair run.
    Prevent a test-file patch from starting until a proposal is approved.
*/
import { z } from "zod";

// list every stage a repair run can enter
export const RunStatusSchema = z.enum([
    "capturingFailure",
    "awaitingApproval",
    "approved",
    "applyingPatch",
    "verifyingTarget",
    "verifyingSuite",
    "completed",
    "failed",
]);

export type RunStatus = z.infer<typeof RunStatusSchema>;

// describe the useful information captured when a Playwright test fails
export const FailureContextSchema = z.object({
    selector: z.string().min(1),
    errorExcerpt: z.string().min(1).max(1_000),
    sourcePath: z.string().min(1),
    sourceLine: z.number().int().positive(),
    domSnapshot: z.string().min(1).max(10_000),
})

export type FailureContext = z.infer<typeof FailureContextSchema>;

// describe the only information a repair proposal is allowed to contain
export const RepairProposalSchema = z.object({
    replacementSelector: z.string().min(1).max(200),
    diagnosis: z.string().min(1).max(300),
    evidence: z.string().min(1).max(500),
}).strict();

export type RepairProposal = z.infer<typeof RepairProposalSchema>;

// store the complete state of one repair attempt
export type RepairRun = {
  id: string;
  status: RunStatus;
  failure?: FailureContext;
  proposal?: RepairProposal;
  error?: string;
};

// describe the small event shape used later by the dashboard
export type RepairEvent = {
  runId: string;
  sequence: number;
  status: RunStatus;
  occurredAt: string;
  run: RepairRun;
};

// list the only safe next stages for every current stage
const allowedTransitions: Record<RunStatus, RunStatus[]> = {
  capturingFailure: ["awaitingApproval", "failed"],
  awaitingApproval: ["approved", "failed"],
  approved: ["applyingPatch", "failed"],
  applyingPatch: ["verifyingTarget", "failed"],
  verifyingTarget: ["verifyingSuite", "failed"],
  verifyingSuite: ["completed", "failed"],
  completed: [],
  failed: [],
};

// return turn only when the user has approved the repair proposal
export function canApplyPatch(run: RepairRun) {
    return run.status === "approved";
}

// move a repair run to its next stage only when that move is safe
export function transitionRun(run: RepairRun, nextStatus: RunStatus): RepairRun {
  
    // stop the program when it tries to skip a required stage
  if (!allowedTransitions[run.status].includes(nextStatus)) {
    throw new Error(`Cannot move from ${run.status} to ${nextStatus}.`);
  }

  return {
    ...run,
    status: nextStatus,
  }
}
