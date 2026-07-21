import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { RepairOrchestrator } from "../../src/repair-orchestrator";
import type { PlaywrightRunResult, PlaywrightTestRunner } from "../../src/playwright-test-runner";
import { ProposalProviderError, type ProposalProvider } from "../../src/proposal-provider";
import { validRepairProposal } from "../fixtures/repair-proposals";
import { targetFailureReport } from "../fixtures/playwright-reports";

const originalSource = [
  'import { test } from "@playwright/test";',
  "",
  'test("signs in with the repair-target selector @repair-target", async ({ page }) => {',
  '  await page.locator("#sign-in-button").click();',
  "});",
  "",
].join("\n");

const workspaces: string[] = [];

afterEach(async () => {
  await Promise.all(workspaces.splice(0).map((workspace) => rm(workspace, { force: true, recursive: true })));
});

async function createWorkspace() {
  const projectRoot = await mkdtemp(join(tmpdir(), "repair-orchestrator-"));
  workspaces.push(projectRoot);
  const testPath = join(projectRoot, "tests", "e2e", "login.spec.ts");
  await mkdir(join(projectRoot, "tests", "e2e"), { recursive: true });
  await writeFile(testPath, originalSource, "utf8");
  return { projectRoot, testPath };
}

function run(exitCode: number, report?: unknown): PlaywrightRunResult {
  return { exitCode, stdout: "", stderr: "", report };
}

class FakeRunner implements PlaywrightTestRunner {
  readonly calls: string[] = [];

  constructor(
    private readonly targetRuns: PlaywrightRunResult[],
    private readonly suiteRun: PlaywrightRunResult,
  ) {}

  async runTarget() {
    this.calls.push("target");
    return this.targetRuns.shift() ?? run(1);
  }

  async runSuite() {
    this.calls.push("suite");
    return this.suiteRun;
  }
}

class FixtureProvider implements ProposalProvider {
  constructor(private readonly proposal: unknown = validRepairProposal) {}

  async propose() {
    return this.proposal;
  }
}

describe("RepairOrchestrator", () => {
  it("publishes each repair status in workflow order", async () => {
    const workspace = await createWorkspace();
    const runner = new FakeRunner([run(1, targetFailureReport), run(0)], run(0));
    const statuses: string[] = [];
    const orchestrator = new RepairOrchestrator({
      projectRoot: workspace.projectRoot,
      runner,
      proposalProvider: new FixtureProvider(),
      recordedDomSnapshot: '<button id="sign-in-button-v2">Sign in</button>',
      createRunId: () => "run-1",
      onRunUpdate: (updatedRun) => statuses.push(updatedRun.status),
    });

    await orchestrator.start();
    await orchestrator.approve("run-1");

    expect(statuses).toEqual([
      "capturingFailure",
      "awaitingApproval",
      "approved",
      "applyingPatch",
      "verifyingTarget",
      "verifyingSuite",
      "completed",
    ]);
  });

  it("waits for approval before changing the test and completes target then suite verification", async () => {
    const workspace = await createWorkspace();
    const runner = new FakeRunner([run(1, targetFailureReport), run(0)], run(0));
    const orchestrator = new RepairOrchestrator({
      projectRoot: workspace.projectRoot,
      runner,
      proposalProvider: new FixtureProvider(),
      recordedDomSnapshot: '<button id="sign-in-button-v2">Sign in</button>',
      createRunId: () => "run-1",
    });

    const awaitingApproval = await orchestrator.start();
    expect(awaitingApproval.status).toBe("awaitingApproval");
    await expect(readFile(workspace.testPath, "utf8")).resolves.toBe(originalSource);

    const completed = await orchestrator.approve("run-1");
    expect(completed?.status).toBe("completed");
    expect(runner.calls).toEqual(["target", "target", "suite"]);
    await expect(readFile(workspace.testPath, "utf8")).resolves.toContain('page.locator("#sign-in-button-v2")');
  });

  it.each([
    ["target", [run(1, targetFailureReport), run(1)], run(0)],
    ["suite", [run(1, targetFailureReport), run(0)], run(1)],
  ])("restores the original test when %s verification fails", async (_stage, targetRuns, suiteRun) => {
    const workspace = await createWorkspace();
    const runner = new FakeRunner(targetRuns, suiteRun);
    const orchestrator = new RepairOrchestrator({
      projectRoot: workspace.projectRoot,
      runner,
      proposalProvider: new FixtureProvider(),
      recordedDomSnapshot: '<button id="sign-in-button-v2">Sign in</button>',
      createRunId: () => "run-1",
    });

    await orchestrator.start();
    const failed = await orchestrator.approve("run-1");

    expect(failed?.status).toBe("failed");
    await expect(readFile(workspace.testPath, "utf8")).resolves.toBe(originalSource);
  });

  it("fails safely for invalid proposals and invalid approval state without writing", async () => {
    const workspace = await createWorkspace();
    const runner = new FakeRunner([run(1, targetFailureReport)], run(0));
    const orchestrator = new RepairOrchestrator({
      projectRoot: workspace.projectRoot,
      runner,
      proposalProvider: new FixtureProvider({ replacementSelector: "[", diagnosis: "bad", evidence: "bad" }),
      recordedDomSnapshot: '<button id="sign-in-button-v2">Sign in</button>',
      createRunId: () => "run-1",
    });

    const failed = await orchestrator.start();
    expect(failed.status).toBe("failed");
    expect((await orchestrator.approve("run-1"))?.status).toBe("failed");
    await expect(readFile(workspace.testPath, "utf8")).resolves.toBe(originalSource);
  });

  it("surfaces an expected live-provider error without patching the test", async () => {
    const workspace = await createWorkspace();
    const runner = new FakeRunner([run(1, targetFailureReport)], run(0));
    const orchestrator = new RepairOrchestrator({
      projectRoot: workspace.projectRoot,
      runner,
      proposalProvider: {
        propose: async () => { throw new ProposalProviderError("A server-only Qwen API key is required for live proposals."); },
      },
      recordedDomSnapshot: '<button id="sign-in-button-v2">Sign in</button>',
      createRunId: () => "run-1",
    });

    const failed = await orchestrator.start();

    expect(failed).toMatchObject({
      status: "failed",
      error: "A server-only Qwen API key is required for live proposals.",
    });
    await expect(readFile(workspace.testPath, "utf8")).resolves.toBe(originalSource);
  });
});
