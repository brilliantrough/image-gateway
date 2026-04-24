export type ProtocolType =
  | "openai"
  | "azure-openai"
  | "aliyun-qwen-image"
  | "aliyun"
  | "tencent"
  | "volcengine-ark"
  | "apimart-async"
  | "google-gemini"
  | "custom";

export type ChannelConfig = {
  id: string;
  name: string;
  protocolType: ProtocolType;
  protocolName?: string;
  baseUrl: string;
  apiKey: string;
  stripResponseFormat?: boolean;
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

export type EditableModelConfigFields = Pick<
  ModelConfig,
  "displayName" | "providerModelName" | "channelId" | "enabled" | "description"
>;

export type ModelConfigUpdate = Partial<EditableModelConfigFields>;

export type ModelPriority = {
  modelId: string;
  priority: number;
};

export type FrontendSettings = {
  invocationStudio: {
    minimalMode: boolean;
  };
};

export type GatewayUpstreamConfig = {
  version: 1;
  channels: ChannelConfig[];
  models: ModelConfig[];
  priorities: ModelPriority[];
  frontendSettings: FrontendSettings;
};

export type PublicChannelCatalogItem = Pick<
  ChannelConfig,
  "id" | "name" | "protocolType" | "protocolName" | "description"
>;

export type PublicModelCatalogItem = Pick<
  ModelConfig,
  "id" | "displayName" | "providerModelName" | "channelId" | "modelKind" | "description"
>;

export type PublicInvocationCatalog = {
  version: 1;
  channels: PublicChannelCatalogItem[];
  models: PublicModelCatalogItem[];
  priorities: ModelPriority[];
  frontendSettings?: FrontendSettings;
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
