import { randomUUID } from "node:crypto";
import { GatewayError } from "../../lib/errors.js";
import { toNormalizedOpenAIResponse } from "../openai/mapper.js";
import type { ImageProvider } from "../types.js";
import type { NormalizedImageRequest } from "../../types/image.js";

type AliyunQwenImageChannel = {
  apiKey: string;
  baseUrl: string;
};

type AliyunQwenImageResponse = {
  request_id?: string;
  output?: {
    choices?: Array<{
      message?: {
        content?: Array<{
          type?: string;
          image?: string;
        }>;
      };
    }>;
  };
  code?: string;
  message?: string;
};

const RESERVED_EXTRA_BODY_FIELDS = new Set([
  "model",
  "input",
  "parameters",
  "prompt",
  "size",
  "n",
  "response_format",
  "image",
  "images",
  "mask",
  "seed",
  "negative_prompt",
  "user",
]);

export class AliyunQwenImageProvider implements ImageProvider {
  constructor(
    private readonly channel: AliyunQwenImageChannel,
    private readonly providerName = "aliyun-qwen-image",
  ) {}

  async generateImage(request: NormalizedImageRequest) {
    if (request.seed !== undefined) {
      throw unsupportedParameterError("seed", this.providerName);
    }

    if (request.user !== undefined) {
      throw unsupportedParameterError("user", this.providerName);
    }

    const response = await fetch(resolveAliyunEndpoint(this.channel.baseUrl), {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.channel.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(toAliyunQwenImageRequest(request)),
    });
    const payload = (await readJson(response)) as AliyunQwenImageResponse;

    if (!response.ok) {
      throw upstreamFailureFromResponse({
        provider: this.providerName,
        statusCode: response.status,
        payload,
      });
    }

    const imageUrls = extractImageUrls(payload);
    if (imageUrls.length === 0) {
      throw new GatewayError({
        statusCode: 502,
        type: "upstream_error",
        code: "aliyun_qwen_image_missing_output",
        message: `${this.providerName} did not return any image output.`,
        provider: this.providerName,
        requestId: payload.request_id ?? undefined,
      });
    }

    const data =
      request.response_format === "b64_json"
        ? await Promise.all(
            imageUrls.map(async (url) => ({
              b64_json: await fetchImageAsBase64(url),
              url: null,
            })),
          )
        : imageUrls.map((url) => ({ url, b64_json: null }));

    return toNormalizedOpenAIResponse({
      created: Math.floor(Date.now() / 1000),
      data,
      request_id: payload.request_id ?? randomUUID(),
      output_format: request.output_format,
    });
  }
}

export function toAliyunQwenImageRequest(request: NormalizedImageRequest): Record<string, unknown> {
  const extraBody = Object.fromEntries(
    Object.entries(request.extra_body).filter(([key]) => !RESERVED_EXTRA_BODY_FIELDS.has(key)),
  );
  const parameters: Record<string, unknown> = {
    size: normalizeAliyunSize(request.size),
    ...extraBody,
  };

  if (request.n > 1) {
    parameters.n = request.n;
  }

  if (request.negative_prompt) {
    parameters.negative_prompt = request.negative_prompt;
  }

  if (request.background) {
    parameters.background = request.background;
  }

  if (request.quality) {
    parameters.quality = request.quality;
  }

  if (request.style) {
    parameters.style = request.style;
  }

  const content: Array<Record<string, unknown>> = [
    {
      text: request.prompt,
    },
  ];
  const imageInputs = [request.image, ...(request.images ?? [])].filter(
    (value): value is string => Boolean(value),
  );

  for (const image of imageInputs) {
    content.push({
      image,
    });
  }

  if (request.mask) {
    content.push({
      mask: request.mask,
    });
  }

  return {
    model: request.model,
    input: {
      messages: [
        {
          role: "user",
          content,
        },
      ],
    },
    parameters,
  };
}

export function normalizeAliyunSize(size: string): string {
  const trimmed = size.trim();
  const match = trimmed.match(/^(\d+)\s*[xX*]\s*(\d+)$/);

  if (match) {
    return `${match[1]}*${match[2]}`;
  }

  return trimmed;
}

export function resolveAliyunEndpoint(baseUrl: string): string {
  const trimmed = trimTrailingSlash(baseUrl);

  if (trimmed.endsWith("/services/aigc/multimodal-generation/generation")) {
    return trimmed;
  }

  if (trimmed.endsWith("/compatible-mode/v1")) {
    return `${trimmed.slice(0, -"/compatible-mode/v1".length)}/api/v1/services/aigc/multimodal-generation/generation`;
  }

  if (trimmed.endsWith("/api/v1")) {
    return `${trimmed}/services/aigc/multimodal-generation/generation`;
  }

  return `${trimmed}/api/v1/services/aigc/multimodal-generation/generation`;
}

function extractImageUrls(payload: AliyunQwenImageResponse): string[] {
  return (payload.output?.choices ?? [])
    .flatMap((choice) => choice.message?.content ?? [])
    .flatMap((item) => (item.image ? [item.image] : []));
}

function unsupportedParameterError(param: string, providerName: string): GatewayError {
  return new GatewayError({
    statusCode: 400,
    type: "unsupported_parameter",
    code: "provider_capability_mismatch",
    message: `Parameter '${param}' is not supported by provider '${providerName}'.`,
    param,
    provider: providerName,
  });
}

function upstreamFailureFromResponse(input: {
  provider: string;
  statusCode: number;
  payload: {
    code?: string;
    message?: string;
    request_id?: string;
  };
}): GatewayError {
  const message = input.payload.message ?? "Upstream request failed.";
  const code = input.payload.code;
  const summary = [code ? `code ${code}` : null, `message ${message}`]
    .filter((item): item is string => item !== null)
    .join(", ");

  return new GatewayError({
    statusCode: 502,
    type: "upstream_error",
    code: "aliyun_qwen_image_request_failed",
    message: `${input.provider} request failed: ${summary}`,
    provider: input.provider,
    requestId: input.payload.request_id ?? undefined,
  });
}

async function fetchImageAsBase64(url: string): Promise<string> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new GatewayError({
      statusCode: 502,
      type: "upstream_error",
      code: "aliyun_qwen_image_asset_fetch_failed",
      message: `Failed to fetch generated image asset: status ${response.status}.`,
      provider: "aliyun-qwen-image",
    });
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer).toString("base64");
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
