import { readFile, writeFile } from "node:fs/promises";

const loginPageUrl = new URL("./LoginPage.tsx", import.meta.url);
const baselineId = 'id="sign-in-button"';
const alternateId = 'id="sign-in-button-v2"';

export type SandboxFixtureState = "baseline" | "alternate";

export type SandboxFixtureResult =
  | { ok: true; state: SandboxFixtureState }
  | {
      ok: false;
      code: "invalidFixtureSource";
      message: "Expected exactly one known sign-in button ID in src/LoginPage.tsx.";
    };

function countOccurrences(source: string, value: string) {
  return source.split(value).length - 1;
}

function stateFromSource(source: string): SandboxFixtureResult {
  const baselineCount = countOccurrences(source, baselineId);
  const alternateCount = countOccurrences(source, alternateId);

  if (baselineCount === 1 && alternateCount === 0) {
    return { ok: true, state: "baseline" };
  }

  if (baselineCount === 0 && alternateCount === 1) {
    return { ok: true, state: "alternate" };
  }

  return {
    ok: false,
    code: "invalidFixtureSource",
    message: "Expected exactly one known sign-in button ID in src/LoginPage.tsx.",
  };
}

async function readFixture() {
  const source = await readFile(loginPageUrl, "utf8");
  return { source, result: stateFromSource(source) };
}

export async function getSandboxFixtureState(): Promise<SandboxFixtureResult> {
  const { result } = await readFixture();
  return result;
}

export async function toggleSandboxFixture(): Promise<SandboxFixtureResult> {
  const { source, result } = await readFixture();
  if (!result.ok) return result;

  const from = result.state === "baseline" ? baselineId : alternateId;
  const to = result.state === "baseline" ? alternateId : baselineId;
  const state: SandboxFixtureState = result.state === "baseline" ? "alternate" : "baseline";

  await writeFile(loginPageUrl, source.replace(from, to), "utf8");
  return { ok: true, state };
}

export async function resetSandboxFixture(): Promise<SandboxFixtureResult> {
  const { source, result } = await readFixture();
  if (!result.ok || result.state === "baseline") return result;

  await writeFile(loginPageUrl, source.replace(alternateId, baselineId), "utf8");
  return { ok: true, state: "baseline" };
}
