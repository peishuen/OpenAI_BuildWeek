import { describe, expect, it } from "vitest";

import { FixtureProposalProvider } from "../../src/fixture-proposal-provider";
import type { FailureContext } from "../../src/repair";

function failureContext(selector: string): FailureContext {
  return {
    selector,
    errorExcerpt: "The locator did not match.",
    sourcePath: "tests/e2e/login.spec.ts",
    sourceLine: 1,
    domSnapshot: '<button id="sign-in-button">Sign in</button>',
  };
}

describe("FixtureProposalProvider", () => {
  it("proposes the alternate fixture selector for either repair cycle", async () => {
    const provider = new FixtureProposalProvider();

    await expect(provider.propose(failureContext("#sign-in-button")))
      .resolves.toMatchObject({ replacementSelector: "#sign-in-button-v2" });
    await expect(provider.propose(failureContext("#sign-in-button-v2")))
      .resolves.toMatchObject({ replacementSelector: "#sign-in-button" });
  });
});
