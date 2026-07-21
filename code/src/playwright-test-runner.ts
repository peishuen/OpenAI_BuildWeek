import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const require = createRequire(import.meta.url);
const playwrightCliPath = require.resolve("@playwright/test/cli");

export type PlaywrightRunResult = {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  report?: unknown;
  error?: string;
};

export interface PlaywrightTestRunner {
  runTarget(): Promise<PlaywrightRunResult>;
  runSuite(): Promise<PlaywrightRunResult>;
}

export type PlaywrightCommand = {
  command: string;
  args: readonly string[];
  cwd: string;
  env: NodeJS.ProcessEnv;
  shell: false;
  writeReport(contents: string): Promise<void>;
};

export type PlaywrightCommandExecutor = (command: PlaywrightCommand) => Promise<{
  exitCode: number | null;
  stdout: string;
  stderr: string;
}>;

const MAXIMUM_OUTPUT_LENGTH = 1_000_000;

function appendOutput(current: string, chunk: Buffer) {
  if (current.length >= MAXIMUM_OUTPUT_LENGTH) {
    return current;
  }

  return `${current}${chunk.toString("utf8")}`.slice(0, MAXIMUM_OUTPUT_LENGTH);
}

const executePlaywrightCommand: PlaywrightCommandExecutor = async (command) => new Promise((resolve) => {
  const child = spawn(command.command, [...command.args], {
    cwd: command.cwd,
    env: command.env,
    shell: command.shell,
    windowsHide: true,
  });
  let stdout = "";
  let stderr = "";
  let settled = false;

  child.stdout.on("data", (chunk: Buffer) => {
    stdout = appendOutput(stdout, chunk);
  });
  child.stderr.on("data", (chunk: Buffer) => {
    stderr = appendOutput(stderr, chunk);
  });
  child.once("error", () => {
    if (!settled) {
      settled = true;
      resolve({ exitCode: null, stdout, stderr });
    }
  });
  child.once("close", (exitCode) => {
    if (!settled) {
      settled = true;
      resolve({ exitCode, stdout, stderr });
    }
  });
});

export type NodePlaywrightTestRunnerOptions = {
  projectRoot: string;
  execute?: PlaywrightCommandExecutor;
};

export class NodePlaywrightTestRunner implements PlaywrightTestRunner {
  private readonly execute: PlaywrightCommandExecutor;

  constructor(private readonly options: NodePlaywrightTestRunnerOptions) {
    this.execute = options.execute ?? executePlaywrightCommand;
  }

  runTarget() {
    return this.run(["test", "--grep", "@repair-target", "--reporter=json"]);
  }

  runSuite() {
    // Dashboard-only checks intentionally mutate or assert pre-regression state, so they cannot verify an active repaired fixture.
    return this.run(["test", "--grep-invert", "@baseline-only|@sandbox-only", "--reporter=json"]);
  }

  private async run(args: readonly string[]): Promise<PlaywrightRunResult> {
    const reportDirectory = await mkdtemp(join(tmpdir(), "repair-playwright-"));
    const reportPath = join(reportDirectory, "report.json");
    const command: PlaywrightCommand = {
      command: process.execPath,
      args: [playwrightCliPath, ...args],
      cwd: this.options.projectRoot,
      // A nested Playwright process must start the local server even when this runner was invoked by Vitest.
      env: { ...process.env, VITEST: undefined, PLAYWRIGHT_JSON_OUTPUT_FILE: reportPath, FORCE_COLOR: "0" },
      shell: false,
      writeReport: (contents) => writeFile(reportPath, contents, "utf8"),
    };

    try {
      const execution = await this.execute(command);
      let report: unknown;
      try {
        report = JSON.parse(await readFile(reportPath, "utf8"));
      } catch {
        return { ...execution, error: "Playwright did not write a valid JSON report." };
      }

      return { ...execution, report };
    } catch {
      return {
        exitCode: null,
        stdout: "",
        stderr: "",
        error: "The Playwright process could not be started safely.",
      };
    } finally {
      await rm(reportDirectory, { force: true, recursive: true });
    }
  }
}

type ReportFailure = {
  selector: string;
  errorExcerpt: string;
  sourcePath: string;
  sourceLine: number;
};

export type RepairTargetFailureResult =
  | { ok: true; failure: ReportFailure }
  | { ok: false; message: string };

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function asArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function collectSpecs(suite: unknown): Record<string, unknown>[] {
  const record = asRecord(suite);
  if (!record) return [];

  return [
    ...asArray(record.specs).flatMap((spec) => {
      const value = asRecord(spec);
      return value ? [value] : [];
    }),
    ...asArray(record.suites).flatMap(collectSpecs),
  ];
}

function normalizeSourcePath(sourcePath: string) {
  const normalized = sourcePath.replaceAll("\\", "/");
  const rootIndex = normalized.toLowerCase().lastIndexOf("tests/e2e/");
  return rootIndex >= 0 ? normalized.slice(rootIndex) : undefined;
}

export function extractRepairTargetFailure(report: unknown): RepairTargetFailureResult {
  const reportRecord = asRecord(report);
  if (!reportRecord) {
    return { ok: false, message: "The Playwright report is not an object." };
  }

  const specs = asArray(reportRecord.suites).flatMap(collectSpecs);
  const targetSpecs = specs
    .filter((spec) => {
      const title = typeof spec.title === "string" ? spec.title : "";
      const tags = asArray(spec.tags).filter((tag): tag is string => typeof tag === "string");
      return title.includes("@repair-target") || tags.includes("repair-target");
    });
  const failuresFor = (candidateSpecs: Record<string, unknown>[]) => candidateSpecs.flatMap((spec) => asArray(spec.tests).flatMap((test) => {
    const testRecord = asRecord(test);
    return testRecord ? asArray(testRecord.results).filter((result) => {
      const status = asRecord(result)?.status;
      return status === "failed" || status === "timedOut";
    }) : [];
  }));
  const failures = failuresFor(targetSpecs);

  if (targetSpecs.length !== 1 || failures.length !== 1 || failuresFor(specs).length !== 1) {
    return { ok: false, message: "Expected exactly one failed @repair-target test." };
  }

  const failureResult = asRecord(failures[0]);
  const failureErrors = asArray(failureResult?.errors).flatMap((error) => {
    const errorRecord = asRecord(error);
    return errorRecord ? [errorRecord] : [];
  });

  for (const failureError of failureErrors) {
    const message = typeof failureError.message === "string" ? failureError.message : "";
    const stack = typeof failureError.stack === "string" ? failureError.stack : "";
    const selector = /locator\((['"])(.*?)\1\)/.exec(`${message}\n${stack}`)?.[2];
    const sourceMatch = /((?:[A-Za-z]:)?[^\s()]*tests[\\/]e2e[\\/][^:\n()]+\.ts):(\d+)(?::\d+)?/.exec(`${stack}\n${message}`);
    const sourcePath = sourceMatch ? normalizeSourcePath(sourceMatch[1]) : undefined;
    const sourceLine = sourceMatch ? Number(sourceMatch[2]) : undefined;

    if (selector && sourcePath && sourceLine) {
      return {
        ok: true,
        failure: {
          selector,
          errorExcerpt: message.slice(0, 1_000),
          sourcePath,
          sourceLine,
        },
      };
    }
  }

  return { ok: false, message: "The repair-target failure did not contain a locator and source location." };
}
