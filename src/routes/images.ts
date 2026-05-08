import type { FastifyInstance } from "fastify";
import { imageGenerationRequestSchema } from "../schemas/image-generation.js";
import { createImageGenerationService } from "../services/image-generation-service.js";
import { GatewayError } from "../lib/errors.js";

export function registerImageRoutes(
  app: FastifyInstance,
  provider: { generateImage(request: unknown): Promise<unknown> },
) {
  const service = createImageGenerationService(provider as never);

  app.post("/v1/images/generations", async (request) => {
    const parsed = imageGenerationRequestSchema.parse(request.body);
    return service.generate(parsed);
  });

  app.post("/v1/images/edits", async (request) => {
    const parsed = imageGenerationRequestSchema.parse(normalizeEditRequestBody(request.body));

    if (!parsed.image && parsed.images.length === 0) {
      throw new GatewayError({
        statusCode: 400,
        type: "invalid_request_error",
        code: "missing_required_parameter",
        message: "The images edit endpoint requires 'image'.",
        param: "image",
      });
    }

    return service.generate(parsed);
  });
}

function normalizeEditRequestBody(body: unknown): unknown {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return body;
  }

  const draft = { ...(body as Record<string, unknown>) };

  if (Array.isArray(draft.image)) {
    draft.images = draft.image;
    delete draft.image;
  }

  return draft;
}
