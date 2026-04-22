import type {
  ChannelConfig,
  GatewayUpstreamConfig,
  ModelConfig,
  ModelPriority,
} from "../types/config.js";

export function createEmptyChannelConfig(): ChannelConfig {
  return {
    id: crypto.randomUUID(),
    name: "",
    protocolType: "openai",
    baseUrl: "",
    apiKey: "",
    enabled: true,
    description: "",
  };
}

export function createEmptyModelConfig(channelId = ""): ModelConfig {
  return {
    id: crypto.randomUUID(),
    displayName: "",
    providerModelName: "",
    channelId,
    modelKind: "image-generation",
    enabled: true,
    description: "",
  };
}

export function upsertPriority(
  priorities: ModelPriority[],
  modelId: string,
  priority?: number,
): ModelPriority[] {
  const next = priorities.filter((entry) => entry.modelId !== modelId);

  if (priority === undefined || Number.isNaN(priority)) {
    return next;
  }

  return [...next, { modelId, priority }];
}

export function exportConfig(config: GatewayUpstreamConfig): string {
  return JSON.stringify(config, null, 2);
}
