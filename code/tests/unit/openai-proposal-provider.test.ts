import { describe, expect, it } from "vitest";

import {
  OpenAiProposalProvider,
  ProposalProviderError,
  type OpenAiResponsesClient,
} from "../../src/openai-proposal-provider";
import type { FailureContext } from "../../src/repair";

const failure: FailureContext = {
  selector: "#sign-in-button",
  errorExcerpt: "locator.click timed out.",
  sourcePath: "tests/e2e/login.spec.ts",
  sourceLine: 76,
  domSnapshot: '<button id="sign-in-button-v2">Sign in</button>',
};

/* Create a deterministic Responses API double so tests never call the network. */
function createClient(output: unknown): OpenAiResponsesClient {
  return {
    responses: {
      parse: async () => ({ output_parsed: output }),
    },
  };
}

describe("OpenAiProposalProvider", () => {
  it("sends only the sanitized failure context and returns structured proposal data", async () => {
    const calls: unknown[] = [];
    const client: OpenAiResponsesClient = {
      responses: {
        parse: async (request) => {
          calls.push(request);
          return {
            output_parsed: {
              replacementSelector: "#sign-in-button-v2",
              diagnosis: "The button ID changed.",
              evidence: "The sanitized DOM contains the v2 button ID.",
            },
          };
        },
      },
    };
    const provider = new OpenAiProposalProvider({ apiKey: "test-key", client });

    await expect(provider.propose(failure)).resolves.toEqual({
      replacementSelector: "#sign-in-button-v2",
      diagnosis: "The button ID changed.",
      evidence: "The sanitized DOM contains the v2 button ID.",
    });

    /* Inspect the serialized prompt without exposing the test key. */
    const request = calls[0] as { input: Array<{ content: string }> };
    expect(JSON.parse(request.input[1]?.content ?? "{}"))
      .toMatchObject({ failure: { sanitizedDomSnapshot: failure.domSnapshot } });
    expect(JSON.stringify(calls[0])).not.toContain("test-key");
  });

  it("returns a safe error when live mode has no API key", async () => {
    const provider = new OpenAiProposalProvider({ client: createClient({}) });

    await expect(provider.propose(failure)).rejects.toEqual(
      new ProposalProviderError("A server-only OpenAI API key is required for live proposals."),
    );
  });

  it("returns a safe error when the request times out", async () => {
    const client: OpenAiResponsesClient = {
      responses: {
        parse: async () => { throw new DOMException("Timed out", "TimeoutError"); },
      },
    };
    const provider = new OpenAiProposalProvider({ apiKey: "test-key", client });

    await expect(provider.propose(failure)).rejects.toEqual(
      new ProposalProviderError("The live repair proposal timed out. Try again or use the fixture proposal."),
    );
  });
});
