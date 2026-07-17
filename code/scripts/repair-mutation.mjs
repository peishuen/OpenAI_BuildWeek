import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDirectory, "..");
const loginPagePath = resolve(projectRoot, "src/LoginPage.tsx");
const baselineId = 'id="sign-in-button"';
const mutatedId = 'id="sign-in-button-v2"';

function countOccurrences(source, value) {
  return source.split(value).length - 1;
}

async function replaceExactlyOnce(from, to, action) {
  const source = await readFile(loginPagePath, "utf8");
  const fromCount = countOccurrences(source, from);
  const toCount = countOccurrences(source, to);

  if (fromCount !== 1 || toCount !== 0) {
    throw new Error(
      `Cannot ${action}: expected one ${JSON.stringify(from)} and no ${JSON.stringify(to)} in src/LoginPage.tsx.`,
    );
  }

  await writeFile(loginPagePath, source.replace(from, to), "utf8");
}

async function applyMutation() {
  await replaceExactlyOnce(baselineId, mutatedId, "apply the selector mutation");
  console.log("Applied the selector mutation.");
}

async function resetMutation() {
  await replaceExactlyOnce(mutatedId, baselineId, "reset the selector mutation");
  console.log("Restored the selector baseline.");
}

function runPlaywrightJson() {
  const isWindows = process.platform === "win32";
  const executable = isWindows ? process.env.ComSpec ?? "cmd.exe" : "npx";
  const commandArguments = isWindows
    ? ["/d", "/s", "/c", "npx playwright test --reporter=json"]
    : ["playwright", "test", "--reporter=json"];

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

  if (specs.length !== 4 || failedSpecs.length !== 1) {
    throw new Error(
      `Expected four tests with exactly one failure, found ${specs.length} tests and ${failedSpecs.length} failures.`,
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
    await resetMutation();
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
