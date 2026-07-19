import { randomUUID } from "node:crypto";

import { createFailureContext } from "./failure-context";
import { applyValidatedPatch, restorePatch, type PatchSnapshot } from "./test-patcher";
import { validateRepairProposal, type ValidatedPatchPlan } from "./proposal-validator";
import { transitionRun, type RepairRun } from "./repair";
import type { ProposalProvider } from "./proposal-provider";
import { extractRepairTargetFailure, type PlaywrightTestRunner } from "./playwright-test-runner";

type StoredRun = {
  run: RepairRun;
  plan?: ValidatedPatchPlan;
  snapshot?: PatchSnapshot;
};

export type RepairOrchestratorOptions = {
  projectRoot: string;
  runner: PlaywrightTestRunner;
  proposalProvider: ProposalProvider;
  recordedDomSnapshot: string;
  createRunId?: () => string;
  onRunUpdate?: (run: RepairRun) => void;
};

function copyRun(run: RepairRun): RepairRun {
  return {
    ...run,
    failure: run.failure ? { ...run.failure } : undefined,
    proposal: run.proposal ? { ...run.proposal } : undefined,
  };
}

export class RepairOrchestrator {
  private readonly runs = new Map<string, StoredRun>();
  private readonly createRunId: () => string;

  constructor(private readonly options: RepairOrchestratorOptions) {
    this.createRunId = options.createRunId ?? randomUUID;
  }

  getRun(runId: string): Readonly<RepairRun> | undefined {
    const stored = this.runs.get(runId);
    return stored ? copyRun(stored.run) : undefined;
  }

  async start(): Promise<RepairRun> {
    const run: RepairRun = { id: this.createRunId(), status: "capturingFailure" };
    const stored: StoredRun = { run };
    this.runs.set(run.id, stored);
    this.publish(run);

    try {
      const targetResult = await this.options.runner.runTarget();
      if (targetResult.error || targetResult.exitCode === 0 || !targetResult.report) {
        return this.fail(stored, targetResult.error ?? "The repair target unexpectedly passed.");
      }

      const extracted = extractRepairTargetFailure(targetResult.report);
      if (!extracted.ok) {
        return this.fail(stored, extracted.message);
      }

      const failure = createFailureContext({ ...extracted.failure, domSnapshot: this.options.recordedDomSnapshot });
      const proposal = await this.options.proposalProvider.propose(failure);
      const validation = await validateRepairProposal(proposal, failure, { projectRoot: this.options.projectRoot });
      if (!validation.ok) {
        return this.fail(stored, validation.message);
      }

      stored.plan = validation.plan;
      stored.run = {
        ...transitionRun(stored.run, "awaitingApproval"),
        failure,
        proposal: validation.plan.proposal,
      };
      this.publish(stored.run);
      return copyRun(stored.run);
    } catch {
      return this.fail(stored, "The repair run could not capture a safe failure context.");
    }
  }

  async approve(runId: string): Promise<RepairRun | undefined> {
    const stored = this.runs.get(runId);
    if (!stored || stored.run.status !== "awaitingApproval" || !stored.plan) {
      return stored ? copyRun(stored.run) : undefined;
    }

    try {
      stored.run = transitionRun(stored.run, "approved");
      this.publish(stored.run);
      stored.run = transitionRun(stored.run, "applyingPatch");
      this.publish(stored.run);
      const applied = await applyValidatedPatch(stored.plan);
      if (!applied.ok) {
        return this.fail(stored, applied.message);
      }

      stored.snapshot = applied.snapshot;
      stored.run = transitionRun(stored.run, "verifyingTarget");
      this.publish(stored.run);
      const targetResult = await this.options.runner.runTarget();
      if (targetResult.error || targetResult.exitCode !== 0) {
        return this.restoreAndFail(stored, "The repaired target test did not pass.");
      }

      stored.run = transitionRun(stored.run, "verifyingSuite");
      this.publish(stored.run);
      const suiteResult = await this.options.runner.runSuite();
      if (suiteResult.error || suiteResult.exitCode !== 0) {
        return this.restoreAndFail(stored, "The complete Playwright suite did not pass.");
      }

      stored.run = transitionRun(stored.run, "completed");
      this.publish(stored.run);
      return copyRun(stored.run);
    } catch {
      return this.restoreAndFail(stored, "The approved repair could not be verified safely.");
    }
  }

  private async restoreAndFail(stored: StoredRun, message: string) {
    if (!stored.snapshot) {
      return this.fail(stored, message);
    }

    const restored = await restorePatch(stored.snapshot);
    return this.fail(stored, restored.ok ? message : `${message} ${restored.message}`);
  }

  private fail(stored: StoredRun, error: string) {
    if (stored.run.status !== "failed" && stored.run.status !== "completed") {
      stored.run = transitionRun(stored.run, "failed");
    }
    stored.run = { ...stored.run, error };
    this.publish(stored.run);
    return copyRun(stored.run);
  }

  private publish(run: RepairRun) {
    // Send a copy so API listeners cannot mutate stored repair state.
    this.options.onRunUpdate?.(copyRun(run));
  }
}
