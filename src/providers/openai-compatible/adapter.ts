import type OpenAI from "openai";
import { GatewayError } from "../../lib/errors.js";
import type { NormalizedImageRequest } from "../../types/image.js";
import type { ImageProvider } from "../types.js";
import { toNormalizedOpenAIResponse, toOpenAIRequest } from "../openai/mapper.js";

export class OpenAICompatibleImageProvider implements ImageProvider {
  constructor(
    protected readonly client: OpenAI,
    protected readonly providerName: string,
  ) {}

  async generateImage(request: NormalizedImageRequest) {
    try {
      const payload = toOpenAIRequest(request, this.providerName);
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
        code: "openai_compatible_request_failed",
        message: `${this.providerName} image generation request failed.`,
        provider: this.providerName,
      });
    }
  }
}
