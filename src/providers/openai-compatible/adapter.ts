import { randomUUID } from "node:crypto";
import type OpenAI from "openai";
import { GatewayError } from "../../lib/errors.js";
import type { NormalizedImageRequest } from "../../types/image.js";
import type { ImageProvider } from "../types.js";
import { toNormalizedOpenAIResponse, toOpenAIRequest } from "../openai/mapper.js";

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
    try {
      const payload = toOpenAIRequest(request, this.providerName, this.options);
      const response = await this.client.images.generate(payload as never);

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
    error_name: input.error instanceof Error ? input.error.name : typeof input.error,
  };

  console.error("[image-gateway] upstream failure", logPayload);
}
