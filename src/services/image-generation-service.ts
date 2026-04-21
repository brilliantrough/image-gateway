import type { ImageGenerationRequest } from "../schemas/image-generation.js";
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
