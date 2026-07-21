import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { resetSandboxFixture, toggleSandboxFixture } from "../src/sandbox-fixture.ts";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDirectory, "..");

function requireSuccess(result) {
  if (!result.ok) throw new Error(result.message);
  return result;
}

async function applyMutation() {
  const result = requireSuccess(await toggleSandboxFixture());
  console.log(`Applied the selector mutation (${result.state}).`);
}

async function resetMutation() {
  requireSuccess(await resetSandboxFixture());
  console.log("Restored the selector baseline.");
}

function runPlaywrightJson() {
  const isWindows = process.platform === "win32";
  const executable = isWindows ? process.env.ComSpec ?? "cmd.exe" : "npx";
  const commandArguments = isWindows
    ? ["/d", "/s", "/c", "npx playwright test --grep-invert @baseline-only --reporter=json"]
    : ["playwright", "test", "--grep-invert", "@baseline-only", "--reporter=json"];

  try {
    return {
      exitCode: 0,
      stdout: execFileSync(executable, commandArguments, {
        cwd: projectRoot,
        env: { ...process.env, FORCE_COLOR: "0" },
        encoding: "utf8",
        maxBuffer: 10 * 1024 * 1024,
      }),
      stderr: "",
    };
  } catch (error) {
    if (typeof error === "object" && error !== null && "status" in error) {
      return {
        exitCode: typeof error.status === "number" ? error.status : 1,
        stdout: typeof error.stdout === "string" ? error.stdout : "",
        stderr: typeof error.stderr === "string" ? error.stderr : "",
      };
    }

    throw error;
  }
}

function collectSpecs(suites) {
  return suites.flatMap((suite) => [
    ...(suite.specs ?? []),
    ...collectSpecs(suite.suites ?? []),
  ]);
}

function verifyMutationReport(report, exitCode) {
  const specs = collectSpecs(report.suites ?? []);
  const failedSpecs = specs.filter((spec) =>
    spec.tests.some((test) => test.results.some((result) => result.status !== "passed")),
  );

  if (exitCode === 0) {
    throw new Error("Expected the mutated suite to fail, but it passed.");
  }

  if (failedSpecs.length !== 1) {
    throw new Error(
      `Expected exactly one failed test after the mutation, found ${specs.length} tests and ${failedSpecs.length} failures.`,
    );
  }

  if (!failedSpecs[0].title.includes("@repair-target")) {
    throw new Error("Expected the only failing test to be tagged @repair-target.");
  }
}

async function verifyMutation() {
  await applyMutation();

  try {
    const { exitCode, stdout, stderr } = runPlaywrightJson();
    let report;

    try {
      report = JSON.parse(stdout);
    } catch {
      throw new Error(`Playwright did not produce a readable JSON report. ${stderr}`);
    }

    verifyMutationReport(report, exitCode);
    console.log("Verified that only the @repair-target test fails after mutation.");
  } finally {
    await applyMutation();
    console.log("Restored the previous selector state.");
  }
}

const mode = process.argv[2];

if (mode === "apply") {
  await applyMutation();
} else if (mode === "reset") {
  await resetMutation();
} else if (mode === "verify") {
  await verifyMutation();
} else {
  throw new Error("Usage: node scripts/repair-mutation.mjs <apply|reset|verify>");
}
