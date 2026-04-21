import type { ImageProvider } from "../providers/types.js";
import type { ImageGenerationRequest } from "../schemas/image-generation.js";
import type { NormalizedImageResponse } from "../types/image.js";
import type { ImageRequestMode } from "../types/image.js";

export function inferImageRequestMode(request: ImageGenerationRequest): ImageRequestMode {
  const imageCount = request.images?.length ?? 0;

  if (request.mask) {
    return "edit";
  }

  if (request.image || imageCount > 0) {
    return "image-to-image";
  }

  return "text-to-image";
}

export function createImageGenerationService(provider: ImageProvider) {
  return {
    async generate(request: ImageGenerationRequest): Promise<NormalizedImageResponse> {
      return provider.generateImage({
        ...request,
        images: request.images ?? [],
        extra_body: request.extra_body ?? {},
        mode: inferImageRequestMode(request),
      });
    },
  };
}
