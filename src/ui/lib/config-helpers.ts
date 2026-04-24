import type {
  ChannelConfig,
  GatewayUpstreamConfig,
  ModelConfig,
  ModelPriority,
  ResolvedModelGroup,
} from "../types/config.js";

export function createEmptyChannelConfig(): ChannelConfig {
  return {
    id: crypto.randomUUID(),
    name: "",
    protocolType: "openai",
    baseUrl: "",
    apiKey: "",
    stripResponseFormat: false,
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

export function reorderResolvedGroup(
  groups: ResolvedModelGroup[],
  displayName: string,
  sourceModelId: string,
  targetModelId: string,
): ModelPriority[] {
  const nextGroups = groups.map((group) => {
    if (group.displayName !== displayName) {
      return group;
    }

    const items = [...group.items];
    const sourceIndex = items.findIndex((item) => item.modelId === sourceModelId);
    const targetIndex = items.findIndex((item) => item.modelId === targetModelId);

    if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) {
      return group;
    }

    const [movedItem] = items.splice(sourceIndex, 1);
    items.splice(targetIndex, 0, movedItem!);

    return {
      ...group,
      items,
    };
  });

  return prioritiesFromResolvedGroups(nextGroups);
}

export function prioritiesFromResolvedGroups(groups: ResolvedModelGroup[]): ModelPriority[] {
  const orderedModelIds = groups.flatMap((group) => group.items.map((item) => item.modelId));
  const maxPriority = orderedModelIds.length;

  return orderedModelIds.map((modelId, index) => ({
    modelId,
    priority: maxPriority - index,
  }));
}

export function exportConfig(config: GatewayUpstreamConfig): string {
  return JSON.stringify(config, null, 2);
}
