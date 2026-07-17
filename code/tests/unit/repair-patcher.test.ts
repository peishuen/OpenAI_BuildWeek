import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { validateRepairProposal } from "../../src/proposal-validator";
import { applyValidatedPatch, restorePatch } from "../../src/test-patcher";
import { invalidSelectorProposal, validRepairProposal } from "../fixtures/repair-proposals";

const originalSource = [
  'import { test } from "@playwright/test";',
  "",
  'test("repairs the sign-in button", async ({ page }) => {',
  '  await page.locator("#sign-in-button").click();',
  "});",
  "",
].join("\n");

type Workspace = {
  root: string;
  projectRoot: string;
  testRoot: string;
  testPath: string;
};

const workspaces: string[] = [];

afterEach(async () => {
  await Promise.all(workspaces.splice(0).map((workspace) => rm(workspace, { force: true, recursive: true })));
});

async function createWorkspace(source = originalSource): Promise<Workspace> {
  const root = await mkdtemp(join(tmpdir(), "repair-patcher-"));
  const testRoot = join(root, "tests", "e2e");
  const testPath = join(testRoot, "login.spec.ts");

  workspaces.push(root);
  await mkdir(testRoot, { recursive: true });
  await writeFile(testPath, source, "utf8");

  return { root, projectRoot: root, testRoot, testPath };
}

function sourceLine(source: string, selector = "#sign-in-button") {
  return source.slice(0, source.indexOf(selector)).split("\n").length;
}

function failureContext(workspace: Workspace, source = originalSource, overrides: Partial<Record<string, unknown>> = {}) {
  return {
    selector: "#sign-in-button",
    errorExcerpt: "Locator did not match the sign-in button.",
    sourcePath: "tests/e2e/login.spec.ts",
    sourceLine: sourceLine(source),
    domSnapshot: '<button id="sign-in-button-v2">Sign in</button>',
    ...overrides,
  };
}

describe("validateRepairProposal", () => {
  it("creates one exact literal replacement plan for the known locator", async () => {
    const workspace = await createWorkspace();
    const result = await validateRepairProposal(validRepairProposal, failureContext(workspace), workspace);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.plan.originalBytes.toString("utf8")).toBe(originalSource);
    expect(result.plan.patchedBytes.toString("utf8")).toContain('page.locator("#sign-in-button-v2")');
    expect(result.plan.patchedBytes.toString("utf8")).not.toContain('page.locator("#sign-in-button")');
  });

  it("rejects a locator on a different source line without writing", async () => {
    const workspace = await createWorkspace();
    const result = await validateRepairProposal(
      validRepairProposal,
      failureContext(workspace, originalSource, { sourceLine: 1 }),
      workspace,
    );

    expect(result).toMatchObject({ ok: false, code: "targetNotFound" });
    await expect(readFile(workspace.testPath, "utf8")).resolves.toBe(originalSource);
  });

  it("rejects malformed TypeScript, invalid CSS, ambiguous locators, unsupported expressions, and out-of-root paths", async () => {
    const malformed = `${originalSource}\nconst broken = (`;
    const ambiguous = originalSource.replace(
      "});",
      '  await page.locator("#sign-in-button").focus();\n});',
    );
    const unsupported = originalSource.replace('"#sign-in-button"', "selector");
    const outside = await createWorkspace();
    const outsidePath = join(outside.root, "outside.spec.ts");
    await writeFile(outsidePath, originalSource, "utf8");

    const malformedWorkspace = await createWorkspace(malformed);
    const ambiguousWorkspace = await createWorkspace(ambiguous);
    const unsupportedWorkspace = await createWorkspace(unsupported);

    await expect(validateRepairProposal(validRepairProposal, failureContext(malformedWorkspace, malformed), malformedWorkspace))
      .resolves.toMatchObject({ ok: false, code: "invalidSource" });
    await expect(validateRepairProposal(invalidSelectorProposal, failureContext(ambiguousWorkspace, ambiguous), ambiguousWorkspace))
      .resolves.toMatchObject({ ok: false, code: "invalidSelector" });
    await expect(validateRepairProposal(validRepairProposal, failureContext(ambiguousWorkspace, ambiguous), ambiguousWorkspace))
      .resolves.toMatchObject({ ok: false, code: "ambiguousTarget" });
    await expect(validateRepairProposal(validRepairProposal, failureContext(unsupportedWorkspace, unsupported), unsupportedWorkspace))
      .resolves.toMatchObject({ ok: false, code: "targetNotFound" });
    await expect(validateRepairProposal(
      validRepairProposal,
      failureContext(outside, originalSource, { sourcePath: "outside.spec.ts" }),
      outside,
    )).resolves.toMatchObject({ ok: false, code: "pathNotAllowed" });
  });
});

describe("validated patch application", () => {
  it("patches exactly once and restores the original snapshot", async () => {
    const workspace = await createWorkspace();
    const validation = await validateRepairProposal(validRepairProposal, failureContext(workspace), workspace);
    expect(validation.ok).toBe(true);
    if (!validation.ok) return;

    const applied = await applyValidatedPatch(validation.plan);
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;

    await expect(readFile(workspace.testPath, "utf8")).resolves.toBe(
      originalSource.replace("#sign-in-button", "#sign-in-button-v2"),
    );

    const restored = await restorePatch(applied.snapshot);
    expect(restored).toEqual({ ok: true });
    await expect(readFile(workspace.testPath, "utf8")).resolves.toBe(originalSource);
  });

  it("refuses stale plans and stale restoration snapshots without clobbering edits", async () => {
    const workspace = await createWorkspace();
    const validation = await validateRepairProposal(validRepairProposal, failureContext(workspace), workspace);
    expect(validation.ok).toBe(true);
    if (!validation.ok) return;

    await writeFile(workspace.testPath, `${originalSource}// external edit\n`, "utf8");
    await expect(applyValidatedPatch(validation.plan)).resolves.toMatchObject({ ok: false, code: "staleFile" });

    await writeFile(workspace.testPath, originalSource, "utf8");
    const applied = await applyValidatedPatch(validation.plan);
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;

    const externalEdit = `${originalSource.replace("#sign-in-button", "#sign-in-button-v2")}// external edit\n`;
    await writeFile(workspace.testPath, externalEdit, "utf8");
    await expect(restorePatch(applied.snapshot)).resolves.toMatchObject({ ok: false, code: "staleFile" });
    await expect(readFile(workspace.testPath, "utf8")).resolves.toBe(externalEdit);
  });
});
