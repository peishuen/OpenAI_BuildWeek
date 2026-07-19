import { z } from "zod";

/* Validate the server-only settings used to select a proposal provider. */
const RepairEnvironmentSchema = z.object({
  OPENAI_API_KEY: z.string().trim().min(1).optional(),
  OPENAI_MODEL: z.string().trim().min(1).default("gpt-5.6"),
  REPAIR_PROPOSAL_PROVIDER: z.enum(["fixture", "openai"]).default("fixture"),
});

export type RepairEnvironment = z.infer<typeof RepairEnvironmentSchema>;

/* Read local environment variables and apply safe defaults without exposing secrets to the browser. */
export function readRepairEnvironment(environment: NodeJS.ProcessEnv = process.env): RepairEnvironment {
  return RepairEnvironmentSchema.parse(environment);
}
