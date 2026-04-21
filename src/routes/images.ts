import type { FastifyInstance } from "fastify";
import { imageGenerationRequestSchema } from "../schemas/image-generation.js";
import { createImageGenerationService } from "../services/image-generation-service.js";

export function registerImageRoutes(
  app: FastifyInstance,
  provider: { generateImage(request: unknown): Promise<unknown> },
) {
  const service = createImageGenerationService(provider as never);

  app.post("/v1/images/generations", async (request) => {
    const parsed = imageGenerationRequestSchema.parse(request.body);
    return service.generate(parsed);
  });
}
