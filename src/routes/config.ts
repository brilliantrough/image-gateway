import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import {
  saveUpstreamConfigFile,
  validateUpstreamConfig,
  type ChannelConfig,
  type GatewayUpstreamConfig,
} from "../config/upstream-config.js";
import { GatewayError } from "../lib/errors.js";
import {
  ADMIN_SESSION_COOKIE,
  extractCookieValue,
  type AdminAuthConfig,
  verifyAdminSessionToken,
} from "../lib/admin-auth.js";
import {
  ConfiguredUpstreamRouter,
  createProviderForChannel,
  type UpstreamProviderFactory,
} from "../providers/router/upstream-router.js";
import type { RuntimeConfigManager } from "../runtime/config-manager.js";
import { upstreamConfigTestRequestSchema } from "../schemas/config-test.js";
import { upstreamConfigRequestSchema } from "../schemas/upstream-config.js";

export function registerConfigRoutes(
  app: FastifyInstance,
  manager: RuntimeConfigManager,
  providerFactory: UpstreamProviderFactory = createProviderForChannel,
  adminAuth: AdminAuthConfig = {
    apiToken: null,
    username: "admin",
    password: null,
    sessionSecret: null,
  },
) {
  const ensureAdmin = createAdminGuard(adminAuth);

  app.get("/v1/config/upstreams", { preHandler: ensureAdmin }, async () => {
    const config = manager.getConfig();

    if (!config) {
      throw new GatewayError({
        statusCode: 400,
        type: "invalid_request",
        code: "config_persistence_unavailable",
        message: "Runtime upstream config persistence is not enabled.",
      });
    }

    return config;
  });

  app.post("/v1/config/upstreams", { preHandler: ensureAdmin }, async (request) => {
    const configPath = manager.getConfigPath();

    if (!configPath) {
      throw new GatewayError({
        statusCode: 400,
        type: "invalid_request",
        code: "config_persistence_unavailable",
        message: "UPSTREAM_CONFIG_PATH is not configured.",
      });
    }

    const nextConfig = parseUpstreamConfigRequest(request.body);
    validateConfigIsBuildable(nextConfig);
    const nextProvider = new ConfiguredUpstreamRouter(nextConfig, providerFactory);

    await persistConfig(configPath, nextConfig);
    manager.replace({ provider: nextProvider, config: nextConfig });

    return nextConfig;
  });

  app.post("/v1/config/upstreams/test-image", { preHandler: ensureAdmin }, async (request) => {
    const parsed = upstreamConfigTestRequestSchema.parse(request.body);
    const testConfig = validateUpstreamConfig(parsed.config);
    validateConfigIsBuildable(testConfig);

    const model = testConfig.models.find((item) => item.id === parsed.modelId);
    if (!model) {
      throw new GatewayError({
        statusCode: 404,
        type: "invalid_request",
        code: "test_model_not_found",
        message: `Model '${parsed.modelId}' does not exist in the provided config draft.`,
        param: "modelId",
      });
    }

    const channel = testConfig.channels.find((item) => item.id === model.channelId);
    if (!channel) {
      throw new GatewayError({
        statusCode: 400,
        type: "invalid_request",
        code: "test_channel_not_found",
        message: `Model '${model.id}' references missing channel '${model.channelId}'.`,
        param: "modelId",
      });
    }

    const provider = providerFactory(channel);
    const mode = parsed.mask ? "edit" : parsed.image ? "image-to-image" : "text-to-image";
    const response = await provider.generateImage({
      mode,
      model: model.providerModelName,
      prompt: parsed.prompt,
      negative_prompt: parsed.negative_prompt,
      size: parsed.size,
      n: parsed.n,
      response_format: parsed.response_format,
      background: parsed.background,
      output_format: parsed.output_format,
      quality: parsed.quality,
      style: parsed.style,
      seed: parsed.seed,
      image: parsed.image,
      mask: parsed.mask,
      images: [],
      extra_body: parsed.extra_body,
    });

    return {
      channelId: channel.id,
      channelName: channel.name,
      modelId: model.id,
      displayName: model.displayName,
      providerModelName: model.providerModelName,
      mode,
      response,
    };
  });
}

function createAdminGuard(adminAuth: AdminAuthConfig) {
  return async (request: FastifyRequest) => {
    if (!adminAuth.apiToken && !adminAuth.password) {
      return;
    }

    const authorization = request.headers.authorization?.trim() ?? "";
    const headerToken = request.headers["x-admin-token"];
    const explicitToken = Array.isArray(headerToken) ? headerToken[0] : headerToken;
    const bearerToken = authorization.startsWith("Bearer ")
      ? authorization.slice("Bearer ".length).trim()
      : "";
    const sessionToken = extractCookieValue(request.headers.cookie, ADMIN_SESSION_COOKIE);

    if (
      (adminAuth.apiToken &&
        (explicitToken === adminAuth.apiToken || bearerToken === adminAuth.apiToken)) ||
      verifyAdminSessionToken(sessionToken, adminAuth)
    ) {
      return;
    }

    throw new GatewayError({
      statusCode: 401,
      type: "authentication_error",
      code: "admin_auth_required",
      message: "Admin authentication is required for config routes.",
    });
  };
}

function validateConfigIsBuildable(config: GatewayUpstreamConfig): void {
  const activeModelChannelIds = new Set(
    config.models.filter((model) => model.enabled).map((model) => model.channelId),
  );

  for (const channel of config.channels) {
    if (!channel.enabled || !activeModelChannelIds.has(channel.id)) {
      continue;
    }

    if (!isSupportedRuntimeProtocol(channel)) {
      throw unsupportedChannelError(channel);
    }
  }
}

function isSupportedRuntimeProtocol(channel: ChannelConfig): boolean {
  return (
    channel.protocolType === "openai" ||
    channel.protocolType === "azure-openai" ||
    channel.protocolType === "aliyun-qwen-image" ||
    channel.protocolType === "volcengine-ark" ||
    channel.protocolType === "apimart-async" ||
    channel.protocolType === "google-gemini" ||
    channel.protocolType === "custom"
  );
}

async function persistConfig(configPath: string, config: GatewayUpstreamConfig): Promise<void> {
  try {
    await saveUpstreamConfigFile(configPath, config);
  } catch (error) {
    throw new GatewayError({
      statusCode: 500,
      type: "internal_error",
      code: "config_persistence_failed",
      message:
        error instanceof Error
          ? `Failed to write upstream config file: ${error.message}`
          : "Failed to write upstream config file.",
    });
  }
}

function unsupportedChannelError(channel: ChannelConfig): GatewayError {
  return new GatewayError({
    statusCode: 400,
    type: "invalid_request",
    code: "unsupported_protocol",
    message: `Protocol '${channel.protocolType}' is not supported.`,
  });
}

function parseUpstreamConfigRequest(body: unknown): GatewayUpstreamConfig {
  try {
    return validateUpstreamConfig(upstreamConfigRequestSchema.parse(body));
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw error;
    }

    throw new GatewayError({
      statusCode: 400,
      type: "validation_error",
      code: "invalid_upstream_config",
      message: error instanceof Error ? error.message : "Invalid upstream config.",
    });
  }
}
