import type { FastifyInstance, FastifyRequest } from "fastify";
import type { MultipartFile, MultipartValue } from "@fastify/multipart";
import { imageGenerationRequestSchema } from "../schemas/image-generation.js";
import { createImageGenerationService } from "../services/image-generation-service.js";
import { GatewayError } from "../lib/errors.js";

export function registerImageRoutes(
  app: FastifyInstance,
  provider: { generateImage(request: unknown): Promise<unknown> },
) {
  const service = createImageGenerationService(provider as never);

  app.post("/v1/images/generations", async (request) => {
    const parsed = imageGenerationRequestSchema.parse(request.body);
    return service.generate(parsed);
  });

  app.post("/v1/images/edits", async (request) => {
    const body = request.isMultipart()
      ? await readMultipartEditRequest(request)
      : normalizeEditRequestBody(request.body);
    const parsed = imageGenerationRequestSchema.parse(body);

    if (!parsed.image && parsed.images.length === 0) {
      throw new GatewayError({
        statusCode: 400,
        type: "invalid_request_error",
        code: "missing_required_parameter",
        message: "The images edit endpoint requires 'image'.",
        param: "image",
      });
    }

    return service.generate(parsed);
  });
}

async function readMultipartEditRequest(request: FastifyRequest): Promise<Record<string, unknown>> {
  const fields: Record<string, unknown> = {};
  const images: string[] = [];
  let mask: string | undefined;

  for await (const part of request.parts()) {
    if (part.type === "file") {
      const dataUrl = await multipartFileToDataUrl(part);
      if (part.fieldname === "image") {
        images.push(dataUrl);
        continue;
      }
      if (part.fieldname === "mask") {
        mask = dataUrl;
        continue;
      }

      continue;
    }

    assignMultipartField(fields, part);
  }

  if (images.length === 1) {
    fields.image = images[0];
  } else if (images.length > 1) {
    fields.images = images;
  }

  if (mask) {
    fields.mask = mask;
  }

  return fields;
}

async function multipartFileToDataUrl(part: MultipartFile): Promise<string> {
  const chunks: Buffer[] = [];

  for await (const chunk of part.file) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const mimeType = part.mimetype || "application/octet-stream";
  return `data:${mimeType};base64,${Buffer.concat(chunks).toString("base64")}`;
}

function assignMultipartField(fields: Record<string, unknown>, part: MultipartValue) {
  const value = String(part.value ?? "");

  if (part.fieldname === "n" || part.fieldname === "output_compression" || part.fieldname === "seed") {
    const numberValue = Number(value);
    if (Number.isFinite(numberValue)) {
      fields[part.fieldname] = numberValue;
    }
    return;
  }

  if (part.fieldname === "extra_body") {
    fields.extra_body = parseMultipartExtraBody(value);
    return;
  }

  fields[part.fieldname] = value;
}

function parseMultipartExtraBody(value: string): unknown {
  if (!value.trim()) {
    return {};
  }

  try {
    return JSON.parse(value) as unknown;
  } catch {
    throw new GatewayError({
      statusCode: 400,
      type: "validation_error",
      code: "invalid_request",
      message: "Multipart field 'extra_body' must be valid JSON.",
      param: "extra_body",
    });
  }
}

function normalizeEditRequestBody(body: unknown): unknown {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return body;
  }

  const draft = { ...(body as Record<string, unknown>) };

  if (Array.isArray(draft.image)) {
    draft.images = draft.image;
    delete draft.image;
  }

  return draft;
}
