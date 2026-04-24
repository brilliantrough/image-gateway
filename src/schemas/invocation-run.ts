import { z } from "zod";
import { imageSourceSchema, responseFormatSchema } from "./image-generation.js";

export const invocationModeSchema = z.enum(["text-to-image", "image-to-image", "edit", "group"]);

export const invocationRunRequestSchema = z
  .object({
    channelId: z.string().min(1),
    modelId: z.string().min(1),
    mode: invocationModeSchema.optional(),
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
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.image && value.images.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Use either 'image' or 'images', not both.",
        path: ["images"],
      });
    }

    if (value.mask && !value.image && value.images.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A mask requires 'image' or 'images'.",
        path: ["mask"],
      });
    }
  });

export type InvocationRunRequest = z.infer<typeof invocationRunRequestSchema>;
