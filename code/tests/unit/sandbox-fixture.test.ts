import { beforeEach, describe, expect, it, vi } from "vitest";

const { fixture, readFile, writeFile } = vi.hoisted(() => {
  const fixture = { source: "" };
  const readFile = vi.fn(async (path: URL, encoding: "utf8") => {
    void path;
    void encoding;
    return fixture.source;
  });
  const writeFile = vi.fn(async (path: URL, source: string, encoding: "utf8") => {
    void path;
    void encoding;
    fixture.source = source;
  });

  return { fixture, readFile, writeFile };
});

vi.mock("node:fs/promises", () => ({ readFile, writeFile }));

import {
  getSandboxFixtureState,
  resetSandboxFixture,
  toggleSandboxFixture,
} from "../../src/sandbox-fixture";

const baselineSource = '<button id="sign-in-button" type="submit">Sign in</button>';
const alternateSource = '<button id="sign-in-button-v2" type="submit">Sign in</button>';

beforeEach(() => {
  fixture.source = baselineSource;
  vi.clearAllMocks();
});

describe("sandbox fixture", () => {
  it("reports the baseline state from the fixed login fixture", async () => {
    await expect(getSandboxFixtureState()).resolves.toEqual({ ok: true, state: "baseline" });
    expect(String(readFile.mock.calls[0]?.[0])).toContain("/src/LoginPage.tsx");
  });

  it("toggles the known baseline button ID to the alternate state", async () => {
    await expect(toggleSandboxFixture()).resolves.toEqual({ ok: true, state: "alternate" });
    expect(fixture.source).toBe(alternateSource);
  });

  it("resets the alternate button ID to the baseline state", async () => {
    fixture.source = alternateSource;

    await expect(resetSandboxFixture()).resolves.toEqual({ ok: true, state: "baseline" });
    expect(fixture.source).toBe(baselineSource);
  });

  it("rejects invalid fixture source without writing", async () => {
    fixture.source = `${baselineSource}\n${alternateSource}`;

    await expect(toggleSandboxFixture()).resolves.toMatchObject({
      ok: false,
      code: "invalidFixtureSource",
    });
    expect(writeFile).not.toHaveBeenCalled();
  });
});
