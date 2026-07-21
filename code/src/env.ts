import { z } from "zod";

import type { ProposalMode } from "./repair";

export type PublicProviderAvailability = {
  defaultMode: ProposalMode;
  qwen: { available: boolean; message: string };
  fixture: { available: true };
};

/* Validate the server-only settings used to select a proposal provider. */
const RepairEnvironmentSchema = z.object({
  QWEN_API_KEY: z.string().trim().min(1).optional(),
  QWEN_BASE_URL: z.string().trim().url().optional(),
  QWEN_MODEL: z.string().trim().min(1).default("qwen3.7-plus-2026-05-26"),
  REPAIR_PROPOSAL_PROVIDER: z.enum(["fixture", "qwen"]).optional(),
}).superRefine((environment, context) => {
  if (environment.REPAIR_PROPOSAL_PROVIDER !== "qwen") return;

  if (!environment.QWEN_API_KEY) {
    context.addIssue({ code: "custom", path: ["QWEN_API_KEY"], message: "QWEN_API_KEY is required for the Qwen provider." });
  }
  if (!environment.QWEN_BASE_URL) {
    context.addIssue({ code: "custom", path: ["QWEN_BASE_URL"], message: "QWEN_BASE_URL is required for the Qwen provider." });
  }
});

export type RepairEnvironment = Omit<z.infer<typeof RepairEnvironmentSchema>, "REPAIR_PROPOSAL_PROVIDER"> & {
  REPAIR_PROPOSAL_PROVIDER: ProposalMode;
};

/* Read local environment variables and apply safe defaults without exposing secrets to the browser. */
export function readRepairEnvironment(environment: NodeJS.ProcessEnv = process.env): RepairEnvironment {
  const parsed = RepairEnvironmentSchema.parse(environment);
  const hasQwenConfiguration = Boolean(parsed.QWEN_API_KEY && parsed.QWEN_BASE_URL);

  return {
    ...parsed,
    REPAIR_PROPOSAL_PROVIDER: parsed.REPAIR_PROPOSAL_PROVIDER ?? (hasQwenConfiguration ? "qwen" : "fixture"),
  };
}

export function getPublicProviderAvailability(environment: RepairEnvironment): PublicProviderAvailability {
  const qwenAvailable = Boolean(environment.QWEN_API_KEY && environment.QWEN_BASE_URL);

  return {
    defaultMode: environment.REPAIR_PROPOSAL_PROVIDER,
    qwen: {
      available: qwenAvailable,
      message: qwenAvailable
        ? "Live Qwen is available."
        : "Live Qwen is not configured. Use the offline fixture fallback.",
    },
    fixture: { available: true },
  };
}
