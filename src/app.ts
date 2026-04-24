import fastifyStatic from "@fastify/static";
import path from "node:path";
import Fastify from "fastify";
import { ZodError } from "zod";
import type { AdminAuthConfig } from "./lib/admin-auth.js";
import { isGatewayError, toGatewayErrorPayload } from "./lib/errors.js";
import type { UpstreamProviderFactory } from "./providers/router/upstream-router.js";
import { registerAdminAuthRoutes } from "./routes/admin-auth.js";
import type { RuntimeConfigManager } from "./runtime/config-manager.js";
import { registerConfigRoutes } from "./routes/config.js";
import { registerImageRoutes } from "./routes/images.js";
import { registerInvocationRoutes } from "./routes/invocation.js";
import { registerPublicCatalogRoutes } from "./routes/public-catalog.js";

export function buildApp(options: {
  provider: { generateImage(request: unknown): Promise<unknown> };
  runtimeConfigManager?: RuntimeConfigManager;
  upstreamProviderFactory?: UpstreamProviderFactory;
  uiRoot?: string;
  adminAuth?: AdminAuthConfig;
}) {
  const app = Fastify({
    bodyLimit: 25 * 1024 * 1024,
  });
  const uiRoot = options.uiRoot ?? path.resolve("dist/ui");

  app.register(fastifyStatic, {
    root: uiRoot,
    index: false,
    wildcard: false,
  });

  app.get("/", async (_, reply) => {
    return reply.sendFile("index.html");
  });

  const runtimeConfigManager = options.runtimeConfigManager;
  const imageProvider = runtimeConfigManager
    ? {
        generateImage: (request: unknown) =>
          runtimeConfigManager.getProvider().generateImage(request as never),
      }
    : options.provider;

  registerImageRoutes(app, imageProvider);

  if (runtimeConfigManager) {
    registerAdminAuthRoutes(
      app,
      options.adminAuth ?? {
        apiToken: null,
        username: "admin",
        password: null,
        sessionSecret: null,
      },
    );
    registerPublicCatalogRoutes(app, runtimeConfigManager);
    registerConfigRoutes(
      app,
      runtimeConfigManager,
      options.upstreamProviderFactory,
      options.adminAuth ?? {
        apiToken: null,
        username: "admin",
        password: null,
        sessionSecret: null,
      },
    );
    registerInvocationRoutes(app, runtimeConfigManager, options.upstreamProviderFactory);
  }

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

    const httpError = toHttpError(error);
    if (httpError && httpError.statusCode >= 400) {
      return reply.status(httpError.statusCode).send({
        error: {
          type: "invalid_request",
          code: httpError.code ?? "request_failed",
          message: httpError.message,
          request_id: requestId,
        },
      });
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

function toHttpError(error: unknown): { statusCode: number; code?: string; message: string } | null {
  if (!error || typeof error !== "object") {
    return null;
  }

  const candidate = error as {
    statusCode?: unknown;
    code?: unknown;
    message?: unknown;
  };

  if (typeof candidate.statusCode !== "number" || typeof candidate.message !== "string") {
    return null;
  }

  return {
    statusCode: candidate.statusCode,
    code: typeof candidate.code === "string" ? candidate.code : undefined,
    message: candidate.message,
  };
}
