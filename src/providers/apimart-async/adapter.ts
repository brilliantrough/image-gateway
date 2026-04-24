import { randomUUID } from "node:crypto";
import { getApimartModelContract } from "../../lib/apimart-async-contract.js";
import { GatewayError } from "../../lib/errors.js";
import { toNormalizedOpenAIResponse } from "../openai/mapper.js";
import type { ImageProvider } from "../types.js";
import type { NormalizedImageRequest } from "../../types/image.js";

type ApimartAsyncChannel = {
  apiKey: string;
  baseUrl: string;
};

type SubmitResponse = {
  code?: number | string;
  message?: string;
  data?: Array<{
    task_id?: string;
    status?: string;
  }>;
};

type TaskStatusResponse = {
  code?: number | string;
  message?: string;
  data?: {
    id?: string;
    status?: string;
    progress?: number;
    result?: {
      images?: Array<{
        url?: string[];
        expires_at?: number;
      }>;
    };
    error?: {
      code?: number | string;
      message?: string;
      type?: string;
    };
  };
};

const RESERVED_EXTRA_BODY_FIELDS = new Set([
  "model",
  "prompt",
  "size",
  "n",
  "response_format",
  "image",
  "images",
  "image_urls",
  "mask",
  "user",
]);
const POLL_INTERVAL_MS = 2_000;
const MAX_POLL_ATTEMPTS = 45;

export class ApimartAsyncImageProvider implements ImageProvider {
  constructor(
    private readonly channel: ApimartAsyncChannel,
    private readonly providerName = "apimart-async",
  ) {}

  async generateImage(request: NormalizedImageRequest) {
    const taskId = await this.submitTask(request);
    const task = await this.pollTask(taskId);
    const imageUrls = flattenImageUrls(task.result?.images);

    if (imageUrls.length === 0) {
      throw new GatewayError({
        statusCode: 502,
        type: "upstream_error",
        code: "apimart_result_missing_images",
        message: `${this.providerName} task '${taskId}' completed without image results.`,
        provider: this.providerName,
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
        : imageUrls.map((url) => ({
            url,
            b64_json: null,
          }));

    return toNormalizedOpenAIResponse({
      created: Math.floor(Date.now() / 1000),
      data,
      request_id: task.id ?? randomUUID(),
    });
  }

  private async submitTask(request: NormalizedImageRequest): Promise<string> {
    const response = await fetch(`${trimTrailingSlash(this.channel.baseUrl)}/images/generations`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.channel.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(toApimartAsyncRequest(request)),
    });
    const payload = (await readJson(response)) as SubmitResponse;

    if (!response.ok || isApimartBusinessFailure(payload.code)) {
      throw upstreamFailureFromResponse({
        provider: this.providerName,
        statusCode: response.status,
        payload,
      });
    }

    const taskId = payload.data?.[0]?.task_id;
    if (!taskId) {
      throw new GatewayError({
        statusCode: 502,
        type: "upstream_error",
        code: "apimart_task_id_missing",
        message: `${this.providerName} did not return a task_id.`,
        provider: this.providerName,
      });
    }

    return taskId;
  }

  private async pollTask(taskId: string): Promise<NonNullable<TaskStatusResponse["data"]>> {
    for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt += 1) {
      const response = await fetch(
        `${trimTrailingSlash(this.channel.baseUrl)}/tasks/${taskId}?language=en`,
        {
          headers: {
            authorization: `Bearer ${this.channel.apiKey}`,
          },
        },
      );
      const payload = (await readJson(response)) as TaskStatusResponse;

      if (!response.ok || isApimartBusinessFailure(payload.code)) {
        throw upstreamFailureFromResponse({
          provider: this.providerName,
          statusCode: response.status,
          payload,
        });
      }

      const task = payload.data;
      if (!task) {
        throw new GatewayError({
          statusCode: 502,
          type: "upstream_error",
          code: "apimart_task_payload_invalid",
          message: `${this.providerName} returned an invalid task payload.`,
          provider: this.providerName,
        });
      }

      if (task.status === "completed") {
        return task;
      }

      if (task.status === "failed" || task.status === "cancelled") {
        throw new GatewayError({
          statusCode: 502,
          type: "upstream_error",
          code: "apimart_task_failed",
          message:
            task.error?.message ??
            `${this.providerName} task '${taskId}' ended with status '${task.status}'.`,
          provider: this.providerName,
        });
      }

      await wait(POLL_INTERVAL_MS);
    }

    throw new GatewayError({
      statusCode: 504,
      type: "upstream_error",
      code: "apimart_task_timeout",
      message: `${this.providerName} task polling timed out.`,
      provider: this.providerName,
    });
  }
}

export function toApimartAsyncRequest(request: NormalizedImageRequest): Record<string, unknown> {
  const contract = getApimartModelContract(request.model);
  const extraBody = Object.fromEntries(
    Object.entries(request.extra_body).filter(
      ([key]) => !RESERVED_EXTRA_BODY_FIELDS.has(key) && isApimartFieldAllowed(contract, key),
    ),
  );
  const payload: Record<string, unknown> = {
    ...extraBody,
    model: request.model,
    prompt: request.prompt,
    size: request.size,
    n: request.n,
  };

  const imageUrls = [request.image, ...(request.images ?? [])].filter(
    (value): value is string => Boolean(value),
  );

  if (imageUrls.length > 0) {
    payload.image_urls = imageUrls;
  }

  if (request.mask) {
    payload.mask = request.mask;
  }

  if (request.user) {
    payload.user = request.user;
  }

  return payload;
}

function isApimartFieldAllowed(
  contract: ReturnType<typeof getApimartModelContract>,
  key: string,
): boolean {
  return contract.family === "generic" || contract.fixedExtraFields.includes(key);
}

function flattenImageUrls(images: Array<{ url?: string[] }> | undefined): string[] {
  return (images ?? []).flatMap((item) => item.url ?? []).filter((item) => item.length > 0);
}

function upstreamFailureFromResponse(input: {
  provider: string;
  statusCode: number;
  payload: {
    code?: number | string;
    message?: string;
    error?: { message?: string; code?: number | string; type?: string };
  };
}): GatewayError {
  const message = input.payload.error?.message ?? input.payload.message ?? "Upstream request failed.";
  const code = input.payload.error?.code ?? input.payload.code;
  const type = input.payload.error?.type;
  const summary = [typeof code !== "undefined" ? `code ${code}` : null, type ? `type ${type}` : null, `message ${message}`]
    .filter((item): item is string => item !== null)
    .join(", ");

  return new GatewayError({
    statusCode: 502,
    type: "upstream_error",
    code: "apimart_request_failed",
    message: `${input.provider} request failed: ${summary}`,
    provider: input.provider,
  });
}

function isApimartBusinessFailure(code: number | string | undefined): boolean {
  if (typeof code === "number") {
    return code !== 200;
  }

  if (typeof code === "string") {
    const normalized = code.toLowerCase();
    return normalized !== "success" && normalized !== "ok" && normalized !== "200";
  }

  return false;
}

async function fetchImageAsBase64(url: string): Promise<string> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new GatewayError({
      statusCode: 502,
      type: "upstream_error",
      code: "apimart_asset_fetch_failed",
      message: `Failed to fetch generated image asset: status ${response.status}.`,
      provider: "apimart-async",
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

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
