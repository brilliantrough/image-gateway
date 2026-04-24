import { randomUUID } from "node:crypto";
import { GatewayError } from "../../lib/errors.js";
import { getGeminiImageContract } from "../../lib/google-gemini-contract.js";
import { toNormalizedOpenAIResponse } from "../openai/mapper.js";
import type { ImageProvider } from "../types.js";
import type { NormalizedImageRequest } from "../../types/image.js";

type GoogleGeminiChannel = {
  apiKey: string;
  baseUrl: string;
};

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
        inlineData?: {
          mimeType?: string;
          data?: string;
        };
        inline_data?: {
          mime_type?: string;
          data?: string;
        };
      }>;
    };
  }>;
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
};

const RESERVED_EXTRA_BODY_FIELDS = new Set([
  "contents",
  "generationConfig",
  "model",
  "prompt",
  "size",
  "imageSize",
  "aspectRatio",
  "responseModalities",
  "image",
  "images",
  "mask",
  "n",
  "response_format",
]);

export class GoogleGeminiImageProvider implements ImageProvider {
  constructor(
    private readonly channel: GoogleGeminiChannel,
    private readonly providerName = "google-gemini",
  ) {}

  async generateImage(request: NormalizedImageRequest) {
    const endpoint = resolveGeminiGenerateContentEndpoint(this.channel.baseUrl, request.model, this.channel.apiKey);
    const upstreamRequest = toGoogleGeminiRequest(request);
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(upstreamRequest),
    });
    const payload = (await readJson(response)) as GeminiResponse;

    if (!response.ok || payload.error) {
      throw upstreamFailureFromResponse({
        provider: this.providerName,
        statusCode: response.status,
        payload,
      });
    }

    const data = extractGeminiImageData(payload);
    if (data.length === 0) {
      throw new GatewayError({
        statusCode: 502,
        type: "upstream_error",
        code: "google_gemini_missing_output",
        message: `${this.providerName} did not return inline image output.`,
        provider: this.providerName,
      });
    }

    return toNormalizedOpenAIResponse({
      created: Math.floor(Date.now() / 1000),
      data,
      request_id: randomUUID(),
    });
  }
}

export function toGoogleGeminiRequest(request: NormalizedImageRequest): Record<string, unknown> {
  const extraBody = Object.fromEntries(
    Object.entries(request.extra_body).filter(([key]) => !RESERVED_EXTRA_BODY_FIELDS.has(key)),
  );
  const contract = getGeminiImageContract(request.model);
  const aspectRatio = String(request.extra_body.aspectRatio ?? request.extra_body.aspect_ratio ?? request.size ?? contract.defaultAspectRatio);
  const imageSize = String(request.extra_body.imageSize ?? request.extra_body.image_size ?? request.quality ?? contract.defaultImageSize);
  validateGeminiImageConfig(request.model, aspectRatio, imageSize);

  return {
    ...extraBody,
    contents: [
      {
        role: "user",
        parts: buildGeminiParts(request),
      },
    ],
    generationConfig: {
      responseModalities: ["TEXT", "IMAGE"],
      imageConfig: {
        aspectRatio,
        imageSize,
      },
    },
  };
}

export function resolveGeminiGenerateContentEndpoint(baseUrl: string, model: string, apiKey: string): string {
  const trimmed = normalizeGeminiBaseUrl(baseUrl || "https://generativelanguage.googleapis.com/v1beta");
  const encodedModel = encodeURIComponent(stripModelPrefix(model));
  const endpoint = trimmed.endsWith(":generateContent")
    ? trimmed
    : `${trimmed}/models/${encodedModel}:generateContent`;
  const separator = endpoint.includes("?") ? "&" : "?";

  return `${endpoint}${separator}key=${encodeURIComponent(apiKey)}`;
}

function buildGeminiParts(request: NormalizedImageRequest): Array<Record<string, unknown>> {
  const parts: Array<Record<string, unknown>> = [{ text: request.prompt }];
  const images = [request.image, ...(request.images ?? [])].filter((value): value is string => Boolean(value));

  for (const image of images) {
    const inlineData = toGeminiInlineData(image);
    if (!inlineData) {
      throw new GatewayError({
        statusCode: 400,
        type: "unsupported_parameter",
        code: "provider_capability_mismatch",
        message: "Google Gemini image input currently requires a data:image/...;base64 source.",
        param: "image",
        provider: "google-gemini",
      });
    }

    parts.push({ inlineData });
  }

  return parts;
}

function toGeminiInlineData(image: string): { mimeType: string; data: string } | null {
  const match = image.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    return null;
  }

  return {
    mimeType: match[1]!,
    data: match[2]!,
  };
}

function validateGeminiImageConfig(model: string, aspectRatio: string, imageSize: string) {
  const contract = getGeminiImageContract(model);
  if (!contract.aspectRatios.includes(aspectRatio)) {
    throw new GatewayError({
      statusCode: 400,
      type: "unsupported_parameter",
      code: "provider_capability_mismatch",
      message: `Google Gemini model ${model} does not accept aspectRatio '${aspectRatio}'.`,
      param: "size",
      provider: "google-gemini",
    });
  }

  if (!contract.imageSizes.includes(imageSize)) {
    throw new GatewayError({
      statusCode: 400,
      type: "unsupported_parameter",
      code: "provider_capability_mismatch",
      message: `Google Gemini model ${model} does not accept imageSize '${imageSize}'.`,
      param: "quality",
      provider: "google-gemini",
    });
  }
}

function extractGeminiImageData(payload: GeminiResponse): Array<{ b64_json: string; url: null }> {
  return (payload.candidates ?? [])
    .flatMap((candidate) => candidate.content?.parts ?? [])
    .flatMap((part) => {
      const inlineData = part.inlineData ?? (part.inline_data ? { mimeType: part.inline_data.mime_type, data: part.inline_data.data } : undefined);
      return inlineData?.data ? [{ b64_json: inlineData.data, url: null }] : [];
    });
}

function upstreamFailureFromResponse(input: {
  provider: string;
  statusCode: number;
  payload: GeminiResponse;
}): GatewayError {
  const message = input.payload.error?.message ?? "Upstream request failed.";
  const code = input.payload.error?.status ?? input.payload.error?.code;
  const summary = [
    `status ${input.statusCode}`,
    typeof code !== "undefined" ? `code ${code}` : null,
    `message ${message}`,
  ]
    .filter((item): item is string => item !== null)
    .join(", ");

  return new GatewayError({
    statusCode: 502,
    type: "upstream_error",
    code: "google_gemini_request_failed",
    message: `${input.provider} request failed: ${summary}`,
    provider: input.provider,
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
    return { error: { message: text } };
  }
}

function stripModelPrefix(model: string): string {
  return model.startsWith("models/") ? model.slice("models/".length) : model;
}

function normalizeGeminiBaseUrl(baseUrl: string): string {
  const trimmed = trimTrailingSlash(baseUrl);

  if (trimmed.endsWith(":generateContent") || /\/v\d+(beta|alpha)?$/.test(trimmed)) {
    return trimmed;
  }

  return `${trimmed}/v1beta`;
}

function trimTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}
