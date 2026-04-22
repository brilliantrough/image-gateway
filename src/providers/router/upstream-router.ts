import type {
  ChannelConfig,
  GatewayUpstreamConfig,
  ModelConfig,
  ProtocolType,
} from "../../config/upstream-config.js";
import { GatewayError } from "../../lib/errors.js";
import type { NormalizedImageRequest } from "../../types/image.js";
import { OpenAICompatibleImageProvider } from "../openai-compatible/adapter.js";
import { createOpenAICompatibleClient } from "../openai-compatible/client.js";
import { OpenAIImageProvider } from "../openai/adapter.js";
import type { ImageProvider } from "../types.js";

export type UpstreamProviderFactory = (channel: ChannelConfig) => ImageProvider;

type RoutedCandidate = {
  channel: ChannelConfig;
  model: ModelConfig;
  priority: number;
};

export class ConfiguredUpstreamRouter implements ImageProvider {
  private readonly channelById: Map<string, ChannelConfig>;
  private readonly priorityByModelId: Map<string, number>;
  private readonly providerCache = new Map<string, ImageProvider>();

  constructor(
    private readonly config: GatewayUpstreamConfig,
    private readonly providerFactory: UpstreamProviderFactory = createProviderForChannel,
  ) {
    this.channelById = new Map(config.channels.map((channel) => [channel.id, channel]));
    this.priorityByModelId = new Map(
      config.priorities.map((priority) => [priority.modelId, priority.priority]),
    );
  }

  async generateImage(request: NormalizedImageRequest) {
    const candidate = this.findCandidate(request.model);
    if (!candidate) {
      throw new GatewayError({
        statusCode: 404,
        type: "invalid_request",
        code: "model_not_configured",
        message: `No enabled upstream route is configured for model '${request.model}'.`,
        param: "model",
      });
    }

    const provider = this.getProvider(candidate.channel);

    return provider.generateImage({
      ...request,
      model: candidate.model.providerModelName,
    });
  }

  private findCandidate(displayName: string): RoutedCandidate | undefined {
    const normalizedDisplayName = displayName.trim();

    return this.config.models
      .filter((model) => model.enabled && model.displayName.trim() === normalizedDisplayName)
      .map((model) => {
        const channel = this.channelById.get(model.channelId);
        if (!channel || !channel.enabled) {
          return null;
        }

        return {
          channel,
          model,
          priority: this.priorityByModelId.get(model.id) ?? 0,
        };
      })
      .filter((candidate): candidate is RoutedCandidate => candidate !== null)
      .sort((left, right) => right.priority - left.priority)[0];
  }

  private getProvider(channel: ChannelConfig): ImageProvider {
    const cached = this.providerCache.get(channel.id);
    if (cached) {
      return cached;
    }

    const provider = this.providerFactory(channel);
    this.providerCache.set(channel.id, provider);
    return provider;
  }
}

export function createProviderForChannel(channel: ChannelConfig): ImageProvider {
  const providerName = channel.protocolName?.trim() || channel.protocolType;

  switch (channel.protocolType) {
    case "openai":
      return new OpenAIImageProvider(createOpenAICompatibleClient(channel));
    case "azure-openai":
    case "volcengine-ark":
    case "custom":
      return new OpenAICompatibleImageProvider(
        createOpenAICompatibleClient(channel),
        providerName,
      );
    default:
      throw new GatewayError({
        statusCode: 400,
        type: "invalid_request",
        code: "unsupported_protocol",
        message: `Protocol '${formatProtocolLabel(channel.protocolType)}' is not supported.`,
      });
  }
}

function formatProtocolLabel(protocolType: ProtocolType): string {
  return protocolType;
}
