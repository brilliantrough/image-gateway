import type { GatewayUpstreamConfig } from "../types/config.js";

export const initialConfig: GatewayUpstreamConfig = {
  version: 1,
  channels: [
    {
      id: "channel-openai",
      name: "OpenAI Main",
      protocolType: "openai",
      baseUrl: "https://api.openai.com/v1",
      apiKey: "openai-key",
      enabled: true,
    },
    {
      id: "channel-azure",
      name: "Azure Backup",
      protocolType: "azure-openai",
      baseUrl: "https://example.azure.com",
      apiKey: "azure-key",
      enabled: true,
    },
  ],
  models: [
    {
      id: "model-openai-gpt-image-1",
      displayName: "gpt-image-1",
      providerModelName: "gpt-image-1",
      channelId: "channel-openai",
      modelKind: "image-generation",
      enabled: true,
    },
    {
      id: "model-azure-gpt-image-1",
      displayName: "gpt-image-1",
      providerModelName: "gpt-image-1",
      channelId: "channel-azure",
      modelKind: "image-generation",
      enabled: true,
    },
  ],
  priorities: [
    { modelId: "model-openai-gpt-image-1", priority: 100 },
    { modelId: "model-azure-gpt-image-1", priority: 90 },
  ],
};
