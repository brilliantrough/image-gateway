import type { GatewayUpstreamConfig } from "../types/config.js";
import { buildResolvedGroups } from "./resolved-groups.js";

export type ValidationResult = {
  fieldErrors: string[];
  sectionErrors: string[];
  globalErrors: string[];
  canSave: boolean;
};

export function validateConfig(config: GatewayUpstreamConfig): ValidationResult {
  const fieldErrors: string[] = [];
  const sectionErrors: string[] = [];
  const globalErrors: string[] = [];

  const seenChannelIds = new Set<string>();
  const seenModelIds = new Set<string>();
  const channelIds = new Set(config.channels.map((channel) => channel.id));
  const customProtocolNames = new Set<string>();
  const providerModelPairs = new Set<string>();
  const modelIds = new Set(config.models.map((model) => model.id));
  const priorityModelIds = new Set<string>();
  const priorityValues = new Set<number>();

  for (const channel of config.channels) {
    const channelName = channel.name.trim();

    if (seenChannelIds.has(channel.id)) {
      sectionErrors.push(`Duplicate channel id ${channel.id}`);
    } else {
      seenChannelIds.add(channel.id);
    }

    if (!channelName) {
      fieldErrors.push(`Channel ${channel.id} is missing a name`);
    }

    if (channel.enabled && !channel.baseUrl.trim()) {
      fieldErrors.push(`Channel ${channel.name || channel.id} is missing a base URL`);
    }

    if (channel.enabled && !channel.apiKey.trim()) {
      fieldErrors.push(`Channel ${channel.name || channel.id} is missing an API key`);
    }

    if (channel.protocolType === "custom") {
      const name = channel.protocolName?.trim();

      if (!name) {
        fieldErrors.push(`Channel ${channel.name || channel.id} requires a custom protocol name`);
      } else if (customProtocolNames.has(name)) {
        sectionErrors.push(`Duplicate custom protocol name ${name}`);
      } else {
        customProtocolNames.add(name);
      }
    }
  }

  for (const model of config.models) {
    const displayName = model.displayName.trim();
    const providerModelName = model.providerModelName.trim();

    if (seenModelIds.has(model.id)) {
      sectionErrors.push(`Duplicate model id ${model.id}`);
    } else {
      seenModelIds.add(model.id);
    }

    if (!displayName) {
      fieldErrors.push(`Model ${model.id} is missing a display name`);
    }

    if (!providerModelName) {
      fieldErrors.push(`Model ${model.id} is missing a provider model name`);
    }

    if (!channelIds.has(model.channelId)) {
      sectionErrors.push(`Model ${displayName || model.id} references a missing channel`);
    }

    const providerPair = `${model.channelId}:${providerModelName}`;
    if (providerModelPairs.has(providerPair)) {
      sectionErrors.push(
        `Duplicate provider model mapping ${providerModelName} for channel ${model.channelId}`,
      );
    } else {
      providerModelPairs.add(providerPair);
    }
  }

  for (const priority of config.priorities) {
    if (!modelIds.has(priority.modelId)) {
      sectionErrors.push(`Priority references missing model ${priority.modelId}`);
    }

    if (priorityModelIds.has(priority.modelId)) {
      sectionErrors.push(`Model ${priority.modelId} has more than one priority entry`);
    } else {
      priorityModelIds.add(priority.modelId);
    }

    if (!Number.isInteger(priority.priority) || priority.priority <= 0) {
      fieldErrors.push(`Priority for model ${priority.modelId} must be a positive integer`);
    }

    if (priorityValues.has(priority.priority)) {
      globalErrors.push(`Duplicate priority ${priority.priority}`);
    } else {
      priorityValues.add(priority.priority);
    }
  }

  for (const group of buildResolvedGroups(config.channels, config.models, config.priorities)) {
    if (group.items.length > 1 && group.items.some((item) => item.priority === undefined)) {
      globalErrors.push(`Display-name group ${group.displayName} has incomplete priority ordering`);
    }
  }

  return {
    fieldErrors,
    sectionErrors,
    globalErrors,
    canSave: fieldErrors.length === 0 && sectionErrors.length === 0 && globalErrors.length === 0,
  };
}
