import type { ProposalProvider } from "./proposal-provider";

export const recordedFailureDomSnapshot = '<button id="sign-in-button-v2">Sign in</button>';

export const recordedRepairProposal = {
  replacementSelector: "#sign-in-button-v2",
  diagnosis: "The sign-in button ID changed.",
  evidence: "The controlled fixture renders the v2 ID.",
};

export class FixtureProposalProvider implements ProposalProvider {
  async propose(): Promise<unknown> {
    return recordedRepairProposal;
  }
}
