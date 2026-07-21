import type { FailureContext } from "./repair";

export interface ProposalProvider {
  propose(context: FailureContext): Promise<unknown>;
}

/* Carry only safe, user-facing provider failures to the repair orchestrator. */
export class ProposalProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProposalProviderError";
  }
}
