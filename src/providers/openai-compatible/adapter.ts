import { randomUUID } from "node:crypto";
import OpenAI, { toFile } from "openai";
import { GatewayError } from "../../lib/errors.js";
import type { NormalizedImageRequest } from "../../types/image.js";
import type { ImageProvider } from "../types.js";
import {
  type OpenAIImageEditRequest,
  type OpenAIImagesRequest,
  toNormalizedOpenAIResponse,
  toOpenAIEditRequest,
  toOpenAIRequest,
} from "../openai/mapper.js";

export class OpenAICompatibleImageProvider implements ImageProvider {
  constructor(
    protected readonly client: OpenAI,
    protected readonly providerName: string,
    protected readonly options: {
      stripResponseFormat?: boolean;
      supportsSeed?: boolean;
    } = {},
  ) {}

  async generateImage(request: NormalizedImageRequest) {
    const startedAt = Date.now();
    try {
      const payload = await this.toUpstreamPayload(request);
      logUpstreamStart({ providerName: this.providerName, request });
      const response =
        request.mode === "text-to-image"
          ? await this.client.images.generate(payload as never)
          : await this.client.images.edit(payload as never);
      logUpstreamSuccess({ providerName: this.providerName, request, durationMs: Date.now() - startedAt });

      return toNormalizedOpenAIResponse({
        created: Math.floor(Date.now() / 1000),
        data: (response.data ?? []).map((item) => ({
          b64_json: "b64_json" in item ? item.b64_json ?? null : null,
          url: "url" in item ? item.url ?? null : null,
          revised_prompt: "revised_prompt" in item ? item.revised_prompt ?? null : null,
        })),
        request_id: randomUUID(),
        output_format: request.output_format,
      });
    } catch (error) {
      if (error instanceof GatewayError) {
        throw error;
      }

       const detail = extractUpstreamErrorDetail(error);
       logUpstreamFailure({
         providerName: this.providerName,
         request,
         detail,
         error,
         durationMs: Date.now() - startedAt,
       });

      throw new GatewayError({
        statusCode: 502,
        type: "upstream_error",
        code: "openai_compatible_request_failed",
        message: detail.summary
          ? `${this.providerName} image generation request failed: ${detail.summary}`
          : `${this.providerName} image generation request failed.`,
        provider: this.providerName,
        requestId: detail.requestId ?? undefined,
      });
    }
  }

  private async toUpstreamPayload(
    request: NormalizedImageRequest,
  ): Promise<OpenAIImagesRequest | OpenAIImageEditRequest> {
    if (request.mode === "text-to-image") {
      return toOpenAIRequest(request, this.providerName, this.options);
    }

    const payload = toOpenAIEditRequest(request, this.providerName, this.options);

    return {
      ...payload,
      image: await toUploadableImage(payload.image, "image"),
      ...(payload.mask ? { mask: await toUploadableImage(payload.mask, "mask") } : {}),
    };
  }
}

async function toUploadableImage(
  input: string | string[],
  fieldName: "image" | "mask",
): Promise<unknown> {
  if (Array.isArray(input)) {
    return Promise.all(input.map((item, index) => toUploadableImageFile(item, `${fieldName}-${index}`)));
  }

  return toUploadableImageFile(input, fieldName);
}

async function toUploadableImageFile(input: string, fallbackName: string): Promise<unknown> {
  const dataUrl = parseDataUrl(input);
  if (dataUrl) {
    return toFile(Buffer.from(dataUrl.base64, "base64"), `${fallbackName}.${dataUrl.extension}`, {
      type: dataUrl.mimeType,
    });
  }

  if (isHttpUrl(input)) {
    const response = await fetch(input);
    if (!response.ok) {
      throw new GatewayError({
        statusCode: 400,
        type: "invalid_request",
        code: "image_fetch_failed",
        message: `Failed to fetch image URL '${input}': status ${response.status}.`,
        param: fallbackName,
      });
    }

    const contentType = response.headers.get("content-type") ?? "image/png";
    const buffer = Buffer.from(await response.arrayBuffer());
    return toFile(buffer, `${fallbackName}.${extensionFromMimeType(contentType)}`, {
      type: contentType,
    });
  }

  if (looksLikeBase64(input)) {
    return toFile(Buffer.from(input, "base64"), `${fallbackName}.png`, {
      type: "image/png",
    });
  }

  throw new GatewayError({
    statusCode: 400,
    type: "unsupported_parameter",
    code: "provider_capability_mismatch",
    message:
      "OpenAI-compatible image edit requests require image inputs as data:image/...;base64, plain base64, or an http(s) URL fetchable by the gateway.",
    param: fallbackName,
  });
}

function parseDataUrl(value: string): { mimeType: string; base64: string; extension: string } | null {
  const match = value.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    return null;
  }

  const mimeType = match[1]!;
  return {
    mimeType,
    base64: match[2]!,
    extension: extensionFromMimeType(mimeType),
  };
}

function isHttpUrl(value: string): boolean {
  return value.startsWith("http://") || value.startsWith("https://");
}

function looksLikeBase64(value: string): boolean {
  return /^[A-Za-z0-9+/]+={0,2}$/.test(value) && value.length > 32;
}

function extensionFromMimeType(mimeType: string): string {
  const normalized = mimeType.toLowerCase().split(";")[0]?.trim();
  switch (normalized) {
    case "image/jpeg":
    case "image/jpg":
      return "jpg";
    case "image/webp":
      return "webp";
    case "image/png":
    default:
      return "png";
  }
}

function extractUpstreamErrorDetail(error: unknown): {
  status: number | null;
  requestId: string | null;
  code: string | null;
  type: string | null;
  message: string | null;
  summary: string | null;
} {
  const candidate = error as {
    status?: unknown;
    request_id?: unknown;
    code?: unknown;
    type?: unknown;
    message?: unknown;
    error?: {
      code?: unknown;
      type?: unknown;
      message?: unknown;
    };
  };

  const status = typeof candidate?.status === "number" ? candidate.status : null;
  const requestId = typeof candidate?.request_id === "string" ? candidate.request_id : null;
  const directCode = typeof candidate?.code === "string" ? candidate.code : null;
  const directType = typeof candidate?.type === "string" ? candidate.type : null;
  const directMessage = typeof candidate?.message === "string" ? candidate.message : null;
  const nestedCode = typeof candidate?.error?.code === "string" ? candidate.error.code : null;
  const nestedType = typeof candidate?.error?.type === "string" ? candidate.error.type : null;
  const nestedMessage =
    typeof candidate?.error?.message === "string" ? candidate.error.message : null;
  const code = nestedCode ?? directCode;
  const type = nestedType ?? directType;
  const message = nestedMessage ?? directMessage;

  const summaryParts = [
    status ? `status ${status}` : null,
    code ? `code ${code}` : null,
    type ? `type ${type}` : null,
    message ? `message ${message}` : null,
    requestId ? `request_id ${requestId}` : null,
  ].filter((part): part is string => part !== null);

  return {
    status,
    requestId,
    code,
    type,
    message,
    summary: summaryParts.length > 0 ? summaryParts.join(", ") : null,
  };
}

function logUpstreamFailure(input: {
  providerName: string;
  request: NormalizedImageRequest;
  detail: {
    status: number | null;
    requestId: string | null;
    code: string | null;
    type: string | null;
    message: string | null;
  };
  error: unknown;
  durationMs: number;
}) {
  const logPayload = {
    event: "upstream_image_generation_failed",
    provider: input.providerName,
    model: input.request.model,
    mode: input.request.mode,
    size: input.request.size,
    n: input.request.n,
    status: input.detail.status,
    request_id: input.detail.requestId,
    upstream_code: input.detail.code,
    upstream_type: input.detail.type,
    upstream_message: input.detail.message,
    duration_ms: input.durationMs,
    error_name: input.error instanceof Error ? input.error.name : typeof input.error,
  };

  console.error("[image-gateway] upstream failure", logPayload);
}

function logUpstreamStart(input: { providerName: string; request: NormalizedImageRequest }) {
  console.info("[image-gateway] upstream request", {
    event: "upstream_image_request_started",
    provider: input.providerName,
    model: input.request.model,
    mode: input.request.mode,
    size: input.request.size,
    n: input.request.n,
    has_image: Boolean(input.request.image || (input.request.images?.length ?? 0) > 0),
    has_mask: Boolean(input.request.mask),
  });
}

function logUpstreamSuccess(input: {
  providerName: string;
  request: NormalizedImageRequest;
  durationMs: number;
}) {
  console.info("[image-gateway] upstream success", {
    event: "upstream_image_request_succeeded",
    provider: input.providerName,
    model: input.request.model,
    mode: input.request.mode,
    duration_ms: input.durationMs,
  });
}
