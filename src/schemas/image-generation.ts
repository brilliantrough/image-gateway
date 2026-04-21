import { z } from "zod";

export const responseFormatSchema = z.enum(["b64_json", "url"]);
export const imageSourceSchema = z.string().min(1);

export const imageGenerationRequestSchema = z.object({
  model: z.string().min(1),
  prompt: z.string().min(1),
  negative_prompt: z.string().min(1).optional(),
  size: z.string().min(1).default("1024x1024"),
  n: z.number().int().positive().default(1),
  response_format: responseFormatSchema.default("b64_json"),
  background: z.string().min(1).optional(),
  output_format: z.string().min(1).optional(),
  output_compression: z.number().int().min(0).max(100).optional(),
  quality: z.string().min(1).optional(),
  style: z.string().min(1).optional(),
  seed: z.number().int().optional(),
  image: imageSourceSchema.optional(),
  images: z.array(imageSourceSchema).default([]),
  mask: imageSourceSchema.optional(),
  user: z.string().min(1).optional(),
  extra_body: z.record(z.unknown()).default({}),
});

export const imageGenerationDataSchema = z.object({
  b64_json: z.string().nullable().default(null),
  url: z.string().nullable().default(null),
  mime_type: z.string().nullable().default(null),
  revised_prompt: z.string().nullable().default(null),
});

export const imageGenerationResponseSchema = z.object({
  created: z.number().int(),
  data: z.array(imageGenerationDataSchema),
  usage: z.object({
    image_count: z.number().int().nonnegative(),
  }),
  request_id: z.string().min(1),
});

export type ImageGenerationRequest = z.infer<typeof imageGenerationRequestSchema>;
export type ImageGenerationResponse = z.infer<typeof imageGenerationResponseSchema>;
