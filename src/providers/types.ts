import type { NormalizedImageRequest, NormalizedImageResponse } from "../types/image.js";

export interface ImageProvider {
  generateImage(request: NormalizedImageRequest): Promise<NormalizedImageResponse>;
}
