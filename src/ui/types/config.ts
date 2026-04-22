export type ProtocolType =
  | "openai"
  | "azure-openai"
  | "aliyun"
  | "tencent"
  | "custom";

export type ChannelConfig = {
  id: string;
  name: string;
  protocolType: ProtocolType;
  protocolName?: string;
  baseUrl: string;
  apiKey: string;
  enabled: boolean;
  description?: string;
};

export type ModelKind = "image-generation";

export type ModelConfig = {
  id: string;
  displayName: string;
  providerModelName: string;
  channelId: string;
  modelKind: ModelKind;
  enabled: boolean;
  description?: string;
};

export type ModelPriority = {
  modelId: string;
  priority: number;
};

export type GatewayUpstreamConfig = {
  version: 1;
  channels: ChannelConfig[];
  models: ModelConfig[];
  priorities: ModelPriority[];
};

export type ResolvedModelGroup = {
  displayName: string;
  items: Array<{
    modelId: string;
    channelId: string;
    channelName: string;
    protocolLabel: string;
    providerModelName: string;
    enabled: boolean;
    priority?: number;
  }>;
};
