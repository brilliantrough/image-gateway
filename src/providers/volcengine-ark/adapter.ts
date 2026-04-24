import { randomUUID } from "node:crypto";
import { GatewayError } from "../../lib/errors.js";
import { getArkModelContract } from "../../lib/volcengine-ark-contract.js";
import { toNormalizedOpenAIResponse } from "../openai/mapper.js";
import type { ImageProvider } from "../types.js";
import type { NormalizedImageRequest } from "../../types/image.js";

type VolcengineArkChannel = {
  apiKey: string;
  baseUrl: string;
};

type VolcengineArkResponse = {
  model?: string;
  created?: number;
  data?: Array<{
    url?: string;
    b64_json?: string;
    revised_prompt?: string;
  }>;
  error?: {
    code?: string;
    message?: string;
    type?: string;
  };
  code?: string;
  message?: string;
  request_id?: string;
};

const RESERVED_EXTRA_BODY_FIELDS = new Set([
  "model",
  "prompt",
  "image",
  "size",
  "seed",
  "stream",
  "response_format",
]);

export class VolcengineArkImageProvider implements ImageProvider {
  constructor(
    private readonly channel: VolcengineArkChannel,
    private readonly providerName = "volcengine-ark",
  ) {}

  async generateImage(request: NormalizedImageRequest) {
    const endpoint = resolveArkImageEndpoint(this.channel.baseUrl);
    const upstreamRequest = toVolcengineArkRequest(request);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.channel.apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(upstreamRequest),
      });
      const payload = (await readJson(response)) as VolcengineArkResponse;

      if (!response.ok) {
        throw upstreamFailureFromResponse({
          provider: this.providerName,
          statusCode: response.status,
          payload,
        });
      }

      const data = (payload.data ?? []).map((item) => ({
        url: item.url ?? null,
        b64_json: item.b64_json ?? null,
        revised_prompt: item.revised_prompt ?? null,
      }));
      if (data.length === 0) {
        throw new GatewayError({
          statusCode: 502,
          type: "upstream_error",
          code: "volcengine_ark_missing_output",
          message: `${this.providerName} did not return any image output.`,
          provider: this.providerName,
          requestId: payload.request_id ?? undefined,
        });
      }

      return toNormalizedOpenAIResponse({
        created: payload.created ?? Math.floor(Date.now() / 1000),
        data,
        request_id: payload.request_id ?? randomUUID(),
        output_format: request.output_format,
      });
    } catch (error) {
      if (error instanceof GatewayError) {
        throw error;
      }

      logVolcengineArkFailure({
        providerName: this.providerName,
        endpoint,
        request,
        upstreamRequest,
        error,
      });

      throw new GatewayError({
        statusCode: 502,
        type: "upstream_error",
        code: "volcengine_ark_request_failed",
        message:
          error instanceof Error
            ? `${this.providerName} image generation request failed: ${error.message}`
            : `${this.providerName} image generation request failed.`,
        provider: this.providerName,
      });
    }
  }
}

export function toVolcengineArkRequest(request: NormalizedImageRequest): Record<string, unknown> {
  const extraBody = Object.fromEntries(
    Object.entries(request.extra_body).filter(([key]) => !RESERVED_EXTRA_BODY_FIELDS.has(key)),
  );
  const payload: Record<string, unknown> = {
    ...extraBody,
    model: request.model,
    prompt: request.prompt,
    size: normalizeVolcengineArkSize(request.model, request.size),
    response_format: request.response_format,
    stream: false,
  };

  const imageInputs = [request.image, ...(request.images ?? [])].filter(
    (value): value is string => Boolean(value),
  );
  if (imageInputs.length > 0) {
    payload.image = imageInputs;
  }

  if (request.output_format) {
    payload.output_format = request.output_format;
  }

  if (request.n > 1 && supportsSequentialImageGeneration(request.model)) {
    payload.sequential_image_generation = "auto";
    payload.sequential_image_generation_options = {
      max_images: request.n,
    };
  } else if (
    supportsSequentialImageGeneration(request.model) &&
    !("sequential_image_generation" in payload)
  ) {
    payload.sequential_image_generation = "disabled";
  }

  if (request.seed !== undefined && supportsSeed(request.model)) {
    payload.seed = request.seed;
  }

  return payload;
}

export function resolveArkImageEndpoint(baseUrl: string): string {
  const trimmed = trimTrailingSlash(baseUrl);

  if (trimmed.endsWith("/images/generations")) {
    return trimmed;
  }

  return `${trimmed}/images/generations`;
}

export function normalizeVolcengineArkSize(model: string, size: string): string {
  const trimmed = size.trim();
  const profile = getArkModelContract(model);
  const normalizedPreset = trimmed.toLowerCase();

  if (profile.sizePresets.includes(normalizedPreset)) {
    return normalizedPreset;
  }

  const dimensions = parsePixelDimensions(trimmed);
  if (dimensions !== null) {
    validateArkPixelSize(model, trimmed, dimensions, profile);
    return `${dimensions.width}x${dimensions.height}`;
  }

  if (profile.sizePresets.length > 0) {
    throw unsupportedArkSize(model, trimmed, profile);
  }

  return trimmed;
}

function supportsSeed(model: string): boolean {
  return getArkModelContract(model).supportsSeed;
}

function supportsSequentialImageGeneration(model: string): boolean {
  return getArkModelContract(model).supportsSequentialImageGeneration;
}

function parsePixelDimensions(size: string): { width: number; height: number } | null {
  const match = size.match(/^(\d+)\s*[xX*]\s*(\d+)$/);

  if (!match) {
    return null;
  }

  return {
    width: Number(match[1]),
    height: Number(match[2]),
  };
}

function validateArkPixelSize(
  model: string,
  originalSize: string,
  dimensions: { width: number; height: number },
  profile: ReturnType<typeof getArkModelContract>,
) {
  if (!profile.allowPixelSize) {
    throw unsupportedArkSize(model, originalSize, profile);
  }

  const ratio = dimensions.width / dimensions.height;
  if (ratio < 1 / 16 || ratio > 16) {
    throw unsupportedArkSize(model, originalSize, profile, "width/height ratio must be within [1/16, 16]");
  }

  const pixels = dimensions.width * dimensions.height;
  if (profile.minPixels !== undefined && pixels < profile.minPixels) {
    throw unsupportedArkSize(
      model,
      originalSize,
      profile,
      `total pixels must be at least ${profile.minPixels}`,
    );
  }

  if (profile.maxPixels !== undefined && pixels > profile.maxPixels) {
    throw unsupportedArkSize(
      model,
      originalSize,
      profile,
      `total pixels must be at most ${profile.maxPixels}`,
    );
  }
}

function unsupportedArkSize(
  model: string,
  size: string,
  profile: ReturnType<typeof getArkModelContract>,
  detail?: string,
): GatewayError {
  const allowed = profile.sizePresets.length > 0 ? `'WIDTHxHEIGHT', ${profile.sizePresets.map((value) => `'${value}'`).join(", ")}` : "'WIDTHxHEIGHT'";
  const suffix = detail ? ` ${detail}.` : "";

  return new GatewayError({
    statusCode: 400,
    type: "provider_capability_mismatch",
    code: "provider_capability_mismatch",
    message: `volcengine-ark model ${model} does not accept size '${size}'. Use one of ${allowed}.${suffix}`,
    provider: "volcengine-ark",
  });
}

function upstreamFailureFromResponse(input: {
  provider: string;
  statusCode: number;
  payload: VolcengineArkResponse;
}): GatewayError {
  const message = input.payload.error?.message ?? input.payload.message ?? "Upstream request failed.";
  const code = input.payload.error?.code ?? input.payload.code;
  const type = input.payload.error?.type;
  const summary = [
    `status ${input.statusCode}`,
    code ? `code ${code}` : null,
    type ? `type ${type}` : null,
    `message ${message}`,
    input.payload.request_id ? `request_id ${input.payload.request_id}` : null,
  ]
    .filter((item): item is string => item !== null)
    .join(", ");

  return new GatewayError({
    statusCode: 502,
    type: "upstream_error",
    code: "volcengine_ark_request_failed",
    message: `${input.provider} image generation request failed: ${summary}`,
    provider: input.provider,
    requestId: input.payload.request_id ?? undefined,
  });
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { message: text };
  }
}

function trimTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function logVolcengineArkFailure(input: {
  providerName: string;
  endpoint: string;
  request: NormalizedImageRequest;
  upstreamRequest: Record<string, unknown>;
  error: unknown;
}) {
  const imageValue = input.upstreamRequest.image;
  const imageCount = Array.isArray(imageValue) ? imageValue.length : imageValue ? 1 : 0;

  console.error("[image-gateway] upstream failure", {
    event: "upstream_image_generation_failed",
    provider: input.providerName,
    endpoint: input.endpoint,
    model: input.request.model,
    mode: input.request.mode,
    size: input.upstreamRequest.size,
    response_format: input.upstreamRequest.response_format,
    image_count: imageCount,
    error_name: input.error instanceof Error ? input.error.name : typeof input.error,
    error_message: input.error instanceof Error ? input.error.message : null,
  });
}
