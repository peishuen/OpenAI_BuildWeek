import { z } from "zod";

/* Validate the server-only settings used to select a proposal provider. */
const RepairEnvironmentSchema = z.object({
  QWEN_API_KEY: z.string().trim().min(1).optional(),
  QWEN_BASE_URL: z.string().trim().url().optional(),
  QWEN_MODEL: z.string().trim().min(1).default("qwen3.7-plus-2026-05-26"),
  REPAIR_PROPOSAL_PROVIDER: z.enum(["fixture", "qwen"]).default("fixture"),
}).superRefine((environment, context) => {
  if (environment.REPAIR_PROPOSAL_PROVIDER !== "qwen") return;

  if (!environment.QWEN_API_KEY) {
    context.addIssue({ code: "custom", path: ["QWEN_API_KEY"], message: "QWEN_API_KEY is required for the Qwen provider." });
  }
  if (!environment.QWEN_BASE_URL) {
    context.addIssue({ code: "custom", path: ["QWEN_BASE_URL"], message: "QWEN_BASE_URL is required for the Qwen provider." });
  }
});

export type RepairEnvironment = z.infer<typeof RepairEnvironmentSchema>;

/* Read local environment variables and apply safe defaults without exposing secrets to the browser. */
export function readRepairEnvironment(environment: NodeJS.ProcessEnv = process.env): RepairEnvironment {
  return RepairEnvironmentSchema.parse(environment);
}
