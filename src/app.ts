import Fastify from "fastify";
import { ZodError } from "zod";
import { isGatewayError, toGatewayErrorPayload } from "./lib/errors.js";
import { registerImageRoutes } from "./routes/images.js";

export function buildApp(options: {
  provider: { generateImage(request: unknown): Promise<unknown> };
}) {
  const app = Fastify();

  registerImageRoutes(app, options.provider);

  app.setErrorHandler((error, request, reply) => {
    const requestId = request.id;

    if (error instanceof ZodError) {
      return reply.status(400).send({
        error: {
          type: "validation_error",
          code: "invalid_request",
          message: error.issues[0]?.message ?? "Invalid request payload.",
          request_id: requestId,
        },
      });
    }

    if (isGatewayError(error)) {
      return reply.status(error.statusCode).send(toGatewayErrorPayload(error, requestId));
    }

    return reply.status(500).send({
      error: {
        type: "internal_error",
        code: "unexpected_error",
        message: "Unexpected gateway error.",
        request_id: requestId,
      },
    });
  });

  return app;
}
