import type { ProposalProvider } from "./proposal-provider";

const baselineSelector = "#sign-in-button";
const alternateSelector = "#sign-in-button-v2";

export function getAlternateFixtureSelector(selector: string) {
  return selector === alternateSelector ? baselineSelector : alternateSelector;
}

export function recordedFailureDomSnapshot(selector: string) {
  const replacementSelector = getAlternateFixtureSelector(selector);
  return `<button id="${replacementSelector.slice(1)}">Sign in</button>`;
}

export const recordedRepairProposal = {
  replacementSelector: alternateSelector,
  diagnosis: "The sign-in button ID changed.",
  evidence: "The controlled fixture renders the v2 ID.",
};

export class FixtureProposalProvider implements ProposalProvider {
  async propose(context: { selector: string }): Promise<unknown> {
    const replacementSelector = getAlternateFixtureSelector(context.selector);
    return {
      replacementSelector,
      diagnosis: "The sign-in button ID changed.",
      evidence: `The controlled fixture renders ${replacementSelector}.`,
    };
  }
}
