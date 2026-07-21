import { describe, expect, it } from "vitest";

import {
  QwenProposalProvider,
  type QwenChatCompletionRequest,
  type QwenChatCompletionsClient,
} from "../../src/qwen-proposal-provider";
import { ProposalProviderError } from "../../src/proposal-provider";
import type { FailureContext } from "../../src/repair";

const failure: FailureContext = {
  selector: "#sign-in-button",
  errorExcerpt: "locator.click timed out.",
  sourcePath: "tests/e2e/login.spec.ts",
  sourceLine: 76,
  domSnapshot: '<button id="sign-in-button-v2">Sign in</button>',
};

function createClient(content: string | null): QwenChatCompletionsClient {
  return {
    chat: {
      completions: {
        create: async () => ({ choices: [{ message: { content } }] }),
      },
    },
  };
}

describe("QwenProposalProvider", () => {
  it("requests a JSON proposal with thinking disabled and returns parsed data", async () => {
    const calls: unknown[] = [];
    const client: QwenChatCompletionsClient = {
      chat: {
        completions: {
          create: async (request) => {
            calls.push(request);
            return {
              choices: [{
                message: {
                  content: JSON.stringify({
                    replacementSelector: "#sign-in-button-v2",
                    diagnosis: "The button ID changed.",
                    evidence: "The sanitized DOM contains the v2 button ID.",
                  }),
                },
              }],
            };
          },
        },
      },
    };
    const provider = new QwenProposalProvider({ apiKey: "test-key", client });

    await expect(provider.propose(failure)).resolves.toEqual({
      replacementSelector: "#sign-in-button-v2",
      diagnosis: "The button ID changed.",
      evidence: "The sanitized DOM contains the v2 button ID.",
    });

    expect(calls[0]).toMatchObject({
      model: "qwen3.7-plus-2026-05-26",
      enable_thinking: false,
      response_format: { type: "json_object" },
    });
    const request = calls[0] as QwenChatCompletionRequest;
    const userMessage = request.messages.find((message) => message.role === "user");
    expect(JSON.parse(userMessage?.content ?? "{}")).toMatchObject({
      failure: { sanitizedDomSnapshot: failure.domSnapshot },
    });
    expect(JSON.stringify(calls[0])).not.toContain("test-key");
  });

  it("returns a safe error when live mode has no API key", async () => {
    const provider = new QwenProposalProvider({ client: createClient("{}") });

    await expect(provider.propose(failure)).rejects.toEqual(
      new ProposalProviderError("A server-only Qwen API key is required for live proposals."),
    );
  });

  it("returns a safe error when Qwen returns malformed JSON", async () => {
    const provider = new QwenProposalProvider({ apiKey: "test-key", client: createClient("not JSON") });

    await expect(provider.propose(failure)).rejects.toEqual(
      new ProposalProviderError("The live repair proposal was not valid JSON. Try again or use the fixture proposal."),
    );
  });

  it("returns a safe error when the request times out", async () => {
    const client: QwenChatCompletionsClient = {
      chat: {
        completions: {
          create: async () => { throw new DOMException("Timed out", "TimeoutError"); },
        },
      },
    };
    const provider = new QwenProposalProvider({ apiKey: "test-key", client });

    await expect(provider.propose(failure)).rejects.toEqual(
      new ProposalProviderError("The live repair proposal timed out. Try again or use the fixture proposal."),
    );
  });
});
