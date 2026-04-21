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
  return value instanceof GatewayError;
}
