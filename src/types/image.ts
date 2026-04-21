import type {
  ImageGenerationRequest,
  ImageGenerationResponse,
} from "../schemas/image-generation.js";

export type ImageRequestMode = "text-to-image" | "image-to-image" | "edit";

export type NormalizedImageRequest = ImageGenerationRequest & {
  mode: ImageRequestMode;
};

export type NormalizedImageResponse = ImageGenerationResponse;
