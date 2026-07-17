import { describe, expect, it } from "vitest";

import {
  extractRepairTargetFailure,
  NodePlaywrightTestRunner,
  type PlaywrightCommand,
} from "../../src/playwright-test-runner";
import { targetFailureReport, unrelatedFailureReport } from "../fixtures/playwright-reports";

describe("extractRepairTargetFailure", () => {
  it("extracts the locator and source location from one tagged Playwright failure", () => {
    expect(extractRepairTargetFailure(targetFailureReport)).toEqual({
      ok: true,
      failure: {
        selector: "#sign-in-button",
        errorExcerpt: "locator.click: Timeout exceeded while waiting for locator('#sign-in-button').",
        sourcePath: "tests/e2e/login.spec.ts",
        sourceLine: 4,
      },
    });
  });

  it("rejects reports without exactly one failed repair target", () => {
    expect(extractRepairTargetFailure(unrelatedFailureReport)).toMatchObject({ ok: false });
    expect(extractRepairTargetFailure({ suites: [] })).toMatchObject({ ok: false });
    expect(extractRepairTargetFailure({
      suites: [{ ...targetFailureReport.suites[0], specs: [
        targetFailureReport.suites[0].specs[0],
        targetFailureReport.suites[0].specs[0],
      ] }],
    })).toMatchObject({ ok: false });
    expect(extractRepairTargetFailure({
      suites: [targetFailureReport.suites[0], unrelatedFailureReport.suites[0]],
    })).toMatchObject({ ok: false });
  });
});

describe("NodePlaywrightTestRunner", () => {
  it("runs fixed shell-free Playwright commands and parses the JSON report file", async () => {
    const commands: PlaywrightCommand[] = [];
    const runner = new NodePlaywrightTestRunner({
      projectRoot: "C:/repair-console",
      execute: async (command) => {
        commands.push(command);
        await command.writeReport(JSON.stringify(targetFailureReport));
        return { exitCode: 1, stdout: "runner output", stderr: "" };
      },
    });

    const result = await runner.runTarget();

    expect(result).toMatchObject({ exitCode: 1, report: targetFailureReport });
    expect(commands).toHaveLength(1);
    expect(commands[0].args).toEqual(["playwright", "test", "--grep", "@repair-target", "--reporter=json"]);
    expect(commands[0].shell).toBe(false);
  });

  it("returns a safe error when the JSON report is malformed", async () => {
    const runner = new NodePlaywrightTestRunner({
      projectRoot: "C:/repair-console",
      execute: async (command) => {
        await command.writeReport("not-json");
        return { exitCode: 1, stdout: "", stderr: "" };
      },
    });

    await expect(runner.runTarget()).resolves.toMatchObject({
      error: "Playwright did not write a valid JSON report.",
    });
  });
});
