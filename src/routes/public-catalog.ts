import type { FastifyInstance } from "fastify";
import type { GatewayUpstreamConfig } from "../config/upstream-config.js";
import { GatewayError } from "../lib/errors.js";
import type { RuntimeConfigManager } from "../runtime/config-manager.js";

export function registerPublicCatalogRoutes(app: FastifyInstance, manager: RuntimeConfigManager) {
  app.get("/v1/public/catalog", async () => {
    const config = manager.getConfig();

    if (!config) {
      throw new GatewayError({
        statusCode: 400,
        type: "invalid_request",
        code: "config_persistence_unavailable",
        message: "Runtime upstream config persistence is not enabled.",
      });
    }

    return buildPublicCatalog(config);
  });
}

function buildPublicCatalog(config: GatewayUpstreamConfig) {
  return {
    version: 1 as const,
    channels: config.channels
      .filter((channel) => channel.enabled)
      .map((channel) => ({
        id: channel.id,
        name: channel.name,
        protocolType: channel.protocolType,
        protocolName: channel.protocolName,
        description: channel.description,
      })),
    models: config.models
      .filter((model) => model.enabled)
      .map((model) => ({
        id: model.id,
        displayName: model.displayName,
        providerModelName: model.providerModelName,
        channelId: model.channelId,
        modelKind: model.modelKind,
        description: model.description,
      })),
    priorities: config.priorities,
    frontendSettings: config.frontendSettings,
  };
}
