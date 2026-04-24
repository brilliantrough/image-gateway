import { z } from "zod";
import { gatewayUpstreamConfigSchema } from "../config/upstream-config.js";
import { imageSourceSchema, responseFormatSchema } from "./image-generation.js";

export const upstreamConfigTestRequestSchema = z.object({
  config: gatewayUpstreamConfigSchema,
  modelId: z.string().min(1),
  prompt: z.string().min(1),
  negative_prompt: z.string().min(1).optional(),
  size: z.string().min(1).default("1024x1024"),
  n: z.number().int().positive().default(1),
  response_format: responseFormatSchema.default("b64_json"),
  background: z.string().min(1).optional(),
  output_format: z.string().min(1).optional(),
  quality: z.string().min(1).optional(),
  style: z.string().min(1).optional(),
  seed: z.number().int().optional(),
  extra_body: z.record(z.unknown()).default({}),
  image: imageSourceSchema.optional(),
  mask: imageSourceSchema.optional(),
});

export type UpstreamConfigTestRequest = z.infer<typeof upstreamConfigTestRequestSchema>;
