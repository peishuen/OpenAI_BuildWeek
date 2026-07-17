import { readFile, realpath, stat } from "node:fs/promises";
import { extname, isAbsolute, relative, resolve, sep } from "node:path";

import { JSDOM } from "jsdom";
import ts from "typescript";

import {
  FailureContextSchema,
  RepairProposalSchema,
  type FailureContext,
  type RepairProposal,
} from "./repair";
import { markValidatedPatchPlan } from "./test-patcher";

export type RepairPatchWorkspace = {
  projectRoot: string;
};

export type RepairValidationFailureCode =
  | "invalidProposal"
  | "invalidContext"
  | "invalidSelector"
  | "pathNotAllowed"
  | "invalidSource"
  | "targetNotFound"
  | "ambiguousTarget"
  | "ioFailure";

export type ValidatedPatchPlan = {
  canonicalPath: string;
  canonicalTestRoot: string;
  literalStart: number;
  literalEnd: number;
  expectedLiteral: string;
  originalBytes: Buffer;
  patchedBytes: Buffer;
  proposal: RepairProposal;
};

export type RepairValidationResult =
  | { ok: true; plan: ValidatedPatchPlan }
  | { ok: false; code: RepairValidationFailureCode; message: string };

type LocatorCandidate = {
  literalStart: number;
  literalEnd: number;
  selector: string;
  literalSource: string;
};

function failure(code: RepairValidationFailureCode, message: string): RepairValidationResult {
  return { ok: false, code, message };
}

function isPathInside(root: string, candidate: string) {
  const pathFromRoot = relative(root, candidate);
  return (
    pathFromRoot.length > 0
    && !pathFromRoot.startsWith(`..${sep}`)
    && pathFromRoot !== ".."
    && !isAbsolute(pathFromRoot)
  );
}

function decodeUtf8(bytes: Buffer) {
  const source = bytes.toString("utf8");
  return Buffer.from(source, "utf8").equals(bytes) ? source : undefined;
}

function isStandardCssSelector(selector: string) {
  const selectorPrefix = selector.trimStart().toLowerCase();
  if (/^(css|xpath|text|role|id|data-testid)\s*=/.test(selectorPrefix)) {
    return false;
  }

  const dom = new JSDOM("<!doctype html><html><body></body></html>");
  try {
    dom.window.document.querySelector(selector);
    return true;
  } catch {
    return false;
  } finally {
    dom.window.close();
  }
}

function hasPlaywrightTestImport(sourceFile: ts.SourceFile) {
  return sourceFile.statements.some((statement) => {
    if (
      !ts.isImportDeclaration(statement)
      || !ts.isStringLiteral(statement.moduleSpecifier)
      || statement.moduleSpecifier.text !== "@playwright/test"
    ) {
      return false;
    }

    const bindings = statement.importClause?.namedBindings;
    return bindings !== undefined
      && ts.isNamedImports(bindings)
      && bindings.elements.some((element) => element.name.text === "test" && (element.propertyName?.text ?? "test") === "test");
  });
}

function hasPageFixtureParameter(callback: ts.ArrowFunction | ts.FunctionExpression) {
  return callback.parameters.some((parameter) => {
    if (!ts.isObjectBindingPattern(parameter.name)) {
      return false;
    }

    return parameter.name.elements.some((element) => {
      const propertyName = element.propertyName?.getText();
      return (propertyName === undefined || propertyName === "page") && element.name.getText() === "page";
    });
  });
}

function isTestCallback(callback: ts.ArrowFunction | ts.FunctionExpression) {
  const parent = callback.parent;
  return (
    ts.isCallExpression(parent)
    && parent.arguments.includes(callback)
    && ts.isIdentifier(parent.expression)
    && parent.expression.text === "test"
    && ts.getModifiers(callback)?.some((modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword) === true
    && hasPageFixtureParameter(callback)
  );
}

function hasShadowingPageDeclaration(callback: ts.ArrowFunction | ts.FunctionExpression, locator: ts.Node) {
  let isShadowed = false;

  function visit(node: ts.Node): void {
    if (isShadowed || node === locator) {
      return;
    }

    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === "page") {
      isShadowed = true;
      return;
    }

    if (node !== callback && (ts.isArrowFunction(node) || ts.isFunctionExpression(node) || ts.isFunctionDeclaration(node))) {
      return;
    }

    ts.forEachChild(node, visit);
  }

  ts.forEachChild(callback, visit);
  return isShadowed;
}

function isSupportedLocatorCall(node: ts.Node, sourceFile: ts.SourceFile) {
  if (!ts.isCallExpression(node) || node.arguments.length !== 1 || node.questionDotToken) {
    return undefined;
  }

  if (!ts.isPropertyAccessExpression(node.expression) || node.expression.questionDotToken) {
    return undefined;
  }

  if (!ts.isIdentifier(node.expression.expression) || node.expression.expression.text !== "page") {
    return undefined;
  }

  if (node.expression.name.text !== "locator" || !ts.isStringLiteral(node.arguments[0])) {
    return undefined;
  }

  const literal = node.arguments[0];
  const literalStart = literal.getStart(sourceFile);
  const literalSource = sourceFile.text.slice(literalStart, literal.getEnd());
  if (literalSource[0] !== "\"" && literalSource[0] !== "'") {
    return undefined;
  }

  let ancestor: ts.Node | undefined = node.parent;
  while (ancestor) {
    if (ts.isArrowFunction(ancestor) || ts.isFunctionExpression(ancestor)) {
      if (!isTestCallback(ancestor) || hasShadowingPageDeclaration(ancestor, node)) {
        return undefined;
      }
      return {
        literalStart,
        literalEnd: literal.getEnd(),
        literalSource,
        selector: literal.text,
      };
    }
    ancestor = ancestor.parent;
  }

  return undefined;
}

function findLocatorCandidates(sourceFile: ts.SourceFile) {
  const candidates: LocatorCandidate[] = [];

  function visit(node: ts.Node): void {
    const candidate = isSupportedLocatorCall(node, sourceFile);
    if (candidate) {
      candidates.push(candidate);
    }
    ts.forEachChild(node, visit);
  }

  ts.forEachChild(sourceFile, visit);
  return candidates;
}

function encodeStringLiteral(selector: string, quote: string) {
  let escaped = "";

  for (const character of selector) {
    const codePoint = character.codePointAt(0);
    if (character === "\\") {
      escaped += "\\\\";
    } else if (character === quote) {
      escaped += `\\${quote}`;
    } else if (character === "\n") {
      escaped += "\\n";
    } else if (character === "\r") {
      escaped += "\\r";
    } else if (character === "\t") {
      escaped += "\\t";
    } else if (codePoint !== undefined && (codePoint < 0x20 || codePoint === 0x2028 || codePoint === 0x2029)) {
      escaped += `\\u${codePoint.toString(16).padStart(4, "0")}`;
    } else {
      escaped += character;
    }
  }

  return `${quote}${escaped}${quote}`;
}

async function resolvePatchTarget(context: FailureContext, workspace: RepairPatchWorkspace) {
  const canonicalTestRoot = await realpath(resolve(workspace.projectRoot, "tests", "e2e"));
  const canonicalPath = await realpath(resolve(workspace.projectRoot, context.sourcePath));
  const fileStats = await stat(canonicalPath);

  if (!isPathInside(canonicalTestRoot, canonicalPath) || !fileStats.isFile() || extname(canonicalPath).toLowerCase() !== ".ts") {
    return undefined;
  }

  return { canonicalPath, canonicalTestRoot };
}

export async function validateRepairProposal(
  input: unknown,
  rawContext: unknown,
  workspace: RepairPatchWorkspace,
): Promise<RepairValidationResult> {
  const proposalResult = RepairProposalSchema.safeParse(input);
  if (!proposalResult.success) {
    return failure("invalidProposal", "The repair proposal does not match the required schema.");
  }

  const contextResult = FailureContextSchema.safeParse(rawContext);
  if (!contextResult.success) {
    return failure("invalidContext", "The captured failure context is not valid.");
  }

  const { proposal } = { proposal: proposalResult.data };
  const context = contextResult.data;
  if (!isStandardCssSelector(proposal.replacementSelector)) {
    return failure("invalidSelector", "The replacement must be a standard CSS selector.");
  }

  let target: { canonicalPath: string; canonicalTestRoot: string } | undefined;
  let originalBytes: Buffer | undefined;
  try {
    target = await resolvePatchTarget(context, workspace);
    if (!target) {
      return failure("pathNotAllowed", "The repair target must be a TypeScript test below tests/e2e.");
    }
    originalBytes = await readFile(target.canonicalPath);
  } catch {
    return failure("ioFailure", "The repair target could not be read safely.");
  }

  if (!target || !originalBytes) {
    return failure("ioFailure", "The repair target could not be read safely.");
  }

  const source = decodeUtf8(originalBytes);
  if (source === undefined) {
    return failure("invalidSource", "The repair target must be valid UTF-8 source text.");
  }

  const sourceFile = ts.createSourceFile(target.canonicalPath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const syntaxDiagnostics = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.Latest },
    reportDiagnostics: true,
  }).diagnostics ?? [];
  if (
    syntaxDiagnostics.some((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error)
    || !hasPlaywrightTestImport(sourceFile)
  ) {
    return failure("invalidSource", "The repair target must be valid Playwright TypeScript source.");
  }

  const candidates = findLocatorCandidates(sourceFile).filter((candidate) => candidate.selector === context.selector);
  if (candidates.length > 1) {
    return failure("ambiguousTarget", "The failed selector appears in more than one supported locator.");
  }

  const candidate = candidates[0];
  if (!candidate || sourceFile.getLineAndCharacterOfPosition(candidate.literalStart).line + 1 !== context.sourceLine) {
    return failure("targetNotFound", "The failed selector was not found at the recorded source line.");
  }

  const replacementLiteral = encodeStringLiteral(proposal.replacementSelector, candidate.literalSource[0]);
  const patchedSource = `${source.slice(0, candidate.literalStart)}${replacementLiteral}${source.slice(candidate.literalEnd)}`;

  return {
    ok: true,
    plan: markValidatedPatchPlan({
      canonicalPath: target.canonicalPath,
      canonicalTestRoot: target.canonicalTestRoot,
      literalStart: candidate.literalStart,
      literalEnd: candidate.literalEnd,
      expectedLiteral: candidate.literalSource,
      originalBytes: Buffer.from(originalBytes),
      patchedBytes: Buffer.from(patchedSource, "utf8"),
      proposal,
    }),
  };
}
