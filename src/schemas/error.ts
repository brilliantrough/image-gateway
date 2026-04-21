import { z } from "zod";

export const gatewayErrorSchema = z.object({
  error: z.object({
    type: z.string().min(1),
    code: z.string().min(1),
    message: z.string().min(1),
    param: z.string().min(1).optional(),
    provider: z.string().min(1).optional(),
    request_id: z.string().min(1),
  }),
});

export type GatewayErrorPayload = z.infer<typeof gatewayErrorSchema>;
