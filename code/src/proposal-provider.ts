import type { FailureContext, ProposalMode } from "./repair";

export interface ProposalProvider {
  propose(context: FailureContext): Promise<unknown>;
}

export type ProposalProviders = Readonly<Record<ProposalMode, ProposalProvider>>;

/* Carry only safe, user-facing provider failures to the repair orchestrator. */
export class ProposalProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProposalProviderError";
  }
}
