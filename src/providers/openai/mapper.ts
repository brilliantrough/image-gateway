import { GatewayError } from "../../lib/errors.js";
import type { NormalizedImageRequest, NormalizedImageResponse } from "../../types/image.js";

export type OpenAIImagesRequest = Record<string, unknown>;

const RESERVED_EXTRA_BODY_FIELDS = new Set([
  "model",
  "prompt",
  "size",
  "n",
  "response_format",
  "quality",
  "style",
  "background",
  "output_format",
  "output_compression",
  "user",
  "image",
  "images",
  "mask",
  "seed",
  "negative_prompt",
]);

export function toOpenAIRequest(
  request: NormalizedImageRequest,
  providerName = "openai",
  options: {
    stripResponseFormat?: boolean;
    supportsSeed?: boolean;
  } = {},
): OpenAIImagesRequest {
  if (request.seed !== undefined && !options.supportsSeed) {
    throw new GatewayError({
      statusCode: 400,
      type: "unsupported_parameter",
      code: "provider_capability_mismatch",
      message: `Parameter 'seed' is not supported by provider '${providerName}'.`,
      param: "seed",
      provider: providerName,
    });
  }

  if (request.negative_prompt !== undefined) {
    throw new GatewayError({
      statusCode: 400,
      type: "unsupported_parameter",
      code: "provider_capability_mismatch",
      message: `Parameter 'negative_prompt' is not supported by provider '${providerName}'.`,
      param: "negative_prompt",
      provider: providerName,
    });
  }

  const extraBody = Object.fromEntries(
    Object.entries(request.extra_body).filter(([key]) => !RESERVED_EXTRA_BODY_FIELDS.has(key)),
  );

  const payload: OpenAIImagesRequest = {
    ...extraBody,
    model: request.model,
    prompt: request.prompt,
    size: request.size,
    n: request.n,
    quality: request.quality,
    style: request.style,
    background: request.background,
    output_format: request.output_format,
    output_compression: request.output_compression,
    user: request.user,
  };

  if (!options.stripResponseFormat) {
    payload.response_format = request.response_format;
  }

  if (request.image) {
    payload.image = request.image;
  }

  if ((request.images?.length ?? 0) > 0) {
    payload.image = request.images;
  }

  if (request.mask) {
    payload.mask = request.mask;
  }

  if (options.supportsSeed && request.seed !== undefined) {
    payload.seed = request.seed;
  }

  return payload;
}

export function toNormalizedOpenAIResponse(input: {
  created?: number;
  data: Array<{
    b64_json?: string | null;
    url?: string | null;
    revised_prompt?: string | null;
  }>;
  request_id: string;
  output_format?: string;
}): NormalizedImageResponse {
  const mimeType = input.output_format ? `image/${input.output_format}` : null;

  return {
    created: input.created ?? Math.floor(Date.now() / 1000),
    data: input.data.map((item) => ({
      b64_json: item.b64_json ?? null,
      url: item.url ?? null,
      mime_type: mimeType,
      revised_prompt: item.revised_prompt ?? null,
    })),
    usage: {
      image_count: input.data.length,
    },
    request_id: input.request_id,
  };
}
