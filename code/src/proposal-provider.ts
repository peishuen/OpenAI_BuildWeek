import type { FailureContext } from "./repair";

export interface ProposalProvider {
  propose(context: FailureContext): Promise<unknown>;
}
