import { getProtocolLabel } from "./protocol-options.js";
import type {
  ChannelConfig,
  ModelConfig,
  ModelPriority,
  ResolvedModelGroup,
} from "../types/config.js";

export function buildResolvedGroups(
  channels: ChannelConfig[],
  models: ModelConfig[],
  priorities: ModelPriority[],
): ResolvedModelGroup[] {
  const channelById = new Map(channels.map((channel) => [channel.id, channel]));
  const priorityByModelId = new Map(priorities.map((entry) => [entry.modelId, entry.priority]));
  const groups = new Map<string, ResolvedModelGroup["items"]>();

  for (const model of models) {
    const channel = channelById.get(model.channelId);
    const items = groups.get(model.displayName) ?? [];

    items.push({
      modelId: model.id,
      channelId: model.channelId,
      channelName: channel?.name ?? "Unknown channel",
      protocolLabel: channel
        ? getProtocolLabel(channel.protocolType, channel.protocolName)
        : "Unknown protocol",
      providerModelName: model.providerModelName,
      enabled: model.enabled && Boolean(channel?.enabled),
      priority: priorityByModelId.get(model.id),
    });

    groups.set(model.displayName, items);
  }

  return Array.from(groups.entries())
    .map(([displayName, items]) => ({
      displayName,
      items: items.sort((left, right) => (right.priority ?? -1) - (left.priority ?? -1)),
    }))
    .sort((left, right) => left.displayName.localeCompare(right.displayName));
}
