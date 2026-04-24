import type { FastifyInstance } from "fastify";
import { GatewayError } from "../lib/errors.js";
import {
  createProviderForChannel,
  type UpstreamProviderFactory,
} from "../providers/router/upstream-router.js";
import type { RuntimeConfigManager } from "../runtime/config-manager.js";
import { invocationRunRequestSchema } from "../schemas/invocation-run.js";
import { inferImageRequestMode } from "../services/image-generation-service.js";

export function registerInvocationRoutes(
  app: FastifyInstance,
  manager: RuntimeConfigManager,
  providerFactory: UpstreamProviderFactory = createProviderForChannel,
) {
  app.post("/v1/invocation/run", async (request) => {
    const parsed = invocationRunRequestSchema.parse(request.body);
    const config = manager.getConfig();

    if (!config) {
      throw new GatewayError({
        statusCode: 400,
        type: "invalid_request",
        code: "config_persistence_unavailable",
        message: "Runtime upstream config persistence is not enabled.",
      });
    }

    const channel = config.channels.find((item) => item.id === parsed.channelId && item.enabled);
    if (!channel) {
      throw new GatewayError({
        statusCode: 404,
        type: "invalid_request",
        code: "invocation_channel_not_found",
        message: `Enabled channel '${parsed.channelId}' was not found.`,
        param: "channelId",
      });
    }

    const model = config.models.find(
      (item) => item.id === parsed.modelId && item.channelId === channel.id && item.enabled,
    );
    if (!model) {
      throw new GatewayError({
        statusCode: 404,
        type: "invalid_request",
        code: "invocation_model_not_found",
        message: `Enabled model '${parsed.modelId}' was not found on channel '${channel.id}'.`,
        param: "modelId",
      });
    }

    const provider = providerFactory(channel);
    const mode =
      parsed.mode === "group"
        ? "text-to-image"
        : parsed.mode ??
          inferImageRequestMode({
            ...parsed,
            model: model.providerModelName,
          });
    const response = await provider.generateImage({
      ...parsed,
      mode,
      model: model.providerModelName,
    });

    return {
      channelId: channel.id,
      channelName: channel.name,
      protocolType: channel.protocolType,
      modelId: model.id,
      displayName: model.displayName,
      providerModelName: model.providerModelName,
      mode: parsed.mode ?? mode,
      response,
    };
  });
}
