import type OpenAI from "openai";
import { GatewayError } from "../../lib/errors.js";
import type { NormalizedImageRequest } from "../../types/image.js";
import type { ImageProvider } from "../types.js";
import { toNormalizedOpenAIResponse, toOpenAIRequest } from "./mapper.js";

export class OpenAIImageProvider implements ImageProvider {
  constructor(private readonly client: OpenAI) {}

  async generateImage(request: NormalizedImageRequest) {
    try {
      const payload = toOpenAIRequest(request);
      const response = await this.client.images.generate(payload as never);

      return toNormalizedOpenAIResponse({
        created: Math.floor(Date.now() / 1000),
        data: (response.data ?? []).map((item) => ({
          b64_json: "b64_json" in item ? item.b64_json ?? null : null,
          url: "url" in item ? item.url ?? null : null,
          revised_prompt: "revised_prompt" in item ? item.revised_prompt ?? null : null,
        })),
        request_id: crypto.randomUUID(),
        output_format: request.output_format,
      });
    } catch (error) {
      if (error instanceof GatewayError) {
        throw error;
      }

      throw new GatewayError({
        statusCode: 502,
        type: "upstream_error",
        code: "openai_request_failed",
        message: "OpenAI image generation request failed.",
        provider: "openai",
      });
    }
  }
}
