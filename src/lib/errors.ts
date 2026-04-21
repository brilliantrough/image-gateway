import type { GatewayErrorPayload } from "../schemas/error.js";

export class GatewayError extends Error {
  readonly statusCode: number;
  readonly type: string;
  readonly code: string;
  readonly param?: string;
  readonly provider?: string;
  readonly requestId?: string;

  constructor(options: {
    statusCode: number;
    type: string;
    code: string;
    message: string;
    param?: string;
    provider?: string;
    requestId?: string;
  }) {
    super(options.message);
    this.name = "GatewayError";
    this.statusCode = options.statusCode;
    this.type = options.type;
    this.code = options.code;
    this.param = options.param;
    this.provider = options.provider;
    this.requestId = options.requestId;
  }
}

export function isGatewayError(value: unknown): value is GatewayError {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.statusCode === "number" &&
    typeof candidate.type === "string" &&
    typeof candidate.code === "string" &&
    typeof candidate.message === "string"
  );
}

export function toGatewayErrorPayload(
  error: GatewayError,
  fallbackRequestId: string,
): GatewayErrorPayload {
  return {
    error: {
      type: error.type,
      code: error.code,
      message: error.message,
      param: error.param,
      provider: error.provider,
      request_id: error.requestId ?? fallbackRequestId,
    },
  };
}
