import { chmod, open, readFile, realpath, rename, rm, stat } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { isAbsolute, relative, sep } from "node:path";

import type { ValidatedPatchPlan } from "./proposal-validator";

const validatedPlans = new WeakSet<ValidatedPatchPlan>();

export function markValidatedPatchPlan(plan: ValidatedPatchPlan) {
  validatedPlans.add(plan);
  return plan;
}

export type PatchSnapshot = {
  canonicalPath: string;
  canonicalTestRoot: string;
  originalBytes: Buffer;
  patchedBytes: Buffer;
};

export type PatchResult =
  | { ok: true; snapshot: PatchSnapshot }
  | { ok: false; code: "staleFile" | "pathNotAllowed" | "ioFailure"; message: string };

export type RestoreResult =
  | { ok: true }
  | { ok: false; code: "staleFile" | "pathNotAllowed" | "ioFailure"; message: string };

function isPathInside(root: string, candidate: string) {
  const pathFromRoot = relative(root, candidate);
  return (
    pathFromRoot.length > 0
    && pathFromRoot !== ".."
    && !pathFromRoot.startsWith(`..${sep}`)
    && !isAbsolute(pathFromRoot)
  );
}

async function targetStillAllowed(canonicalPath: string, canonicalTestRoot: string) {
  const [currentPath, currentRoot] = await Promise.all([realpath(canonicalPath), realpath(canonicalTestRoot)]);
  const fileStats = await stat(currentPath);
  return currentPath === canonicalPath && currentRoot === canonicalTestRoot && fileStats.isFile() && isPathInside(currentRoot, currentPath);
}

async function replaceWithBytes(canonicalPath: string, bytes: Buffer) {
  const temporaryPath = `${canonicalPath}.repair-${randomUUID()}.tmp`;
  let handle: Awaited<ReturnType<typeof open>> | undefined;

  try {
    const sourceStats = await stat(canonicalPath);
    handle = await open(temporaryPath, "wx", 0o600);
    await handle.writeFile(bytes);
    await handle.close();
    handle = undefined;
    await chmod(temporaryPath, sourceStats.mode);
    await rename(temporaryPath, canonicalPath);
  } catch (error) {
    await handle?.close().catch(() => undefined);
    await rm(temporaryPath, { force: true }).catch(() => undefined);
    throw error;
  }
}

export async function applyValidatedPatch(plan: ValidatedPatchPlan): Promise<PatchResult> {
  try {
    if (!validatedPlans.has(plan)) {
      return { ok: false, code: "pathNotAllowed", message: "The repair plan was not created by the validator." };
    }

    if (!(await targetStillAllowed(plan.canonicalPath, plan.canonicalTestRoot))) {
      return { ok: false, code: "pathNotAllowed", message: "The repair target is no longer an allowed test file." };
    }

    const currentBytes = await readFile(plan.canonicalPath);
    if (!currentBytes.equals(plan.originalBytes)) {
      return { ok: false, code: "staleFile", message: "The test file changed after the repair was validated." };
    }

    await replaceWithBytes(plan.canonicalPath, plan.patchedBytes);
    return {
      ok: true,
      snapshot: {
        canonicalPath: plan.canonicalPath,
        canonicalTestRoot: plan.canonicalTestRoot,
        originalBytes: Buffer.from(plan.originalBytes),
        patchedBytes: Buffer.from(plan.patchedBytes),
      },
    };
  } catch {
    return { ok: false, code: "ioFailure", message: "The validated repair could not be applied safely." };
  }
}

export async function restorePatch(snapshot: PatchSnapshot): Promise<RestoreResult> {
  try {
    if (!(await targetStillAllowed(snapshot.canonicalPath, snapshot.canonicalTestRoot))) {
      return { ok: false, code: "pathNotAllowed", message: "The repair target is no longer an allowed test file." };
    }

    const currentBytes = await readFile(snapshot.canonicalPath);
    if (!currentBytes.equals(snapshot.patchedBytes)) {
      return { ok: false, code: "staleFile", message: "The test file changed after the repair was applied." };
    }

    await replaceWithBytes(snapshot.canonicalPath, snapshot.originalBytes);
    return { ok: true };
  } catch {
    return { ok: false, code: "ioFailure", message: "The original test file could not be restored safely." };
  }
}
