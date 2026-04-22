import { z } from "zod";

const envSchema = z
  .object({
    HOST: z.string().default("0.0.0.0"),
    PORT: z.coerce.number().int().positive().default(3000),
    LOG_LEVEL: z.string().default("info"),
    OPENAI_API_KEY: z.string().default(""),
    OPENAI_BASE_URL: z.string().url().default("https://api.openai.com/v1"),
    UPSTREAM_CONFIG_PATH: z.string().trim().min(1).optional(),
  })
  .superRefine((env, ctx) => {
    if (!env.UPSTREAM_CONFIG_PATH && env.OPENAI_API_KEY.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["OPENAI_API_KEY"],
        message: "OPENAI_API_KEY is required when UPSTREAM_CONFIG_PATH is not set",
      });
    }
  });

export type AppEnv = z.infer<typeof envSchema>;

export function loadEnv(env: NodeJS.ProcessEnv = process.env): AppEnv {
  return envSchema.parse(env);
}
