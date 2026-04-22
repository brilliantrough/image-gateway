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

  const channelIds = new Set(config.channels.map((channel) => channel.id));
  const customProtocolNames = new Set<string>();
  const providerModelPairs = new Set<string>();
  const priorityValues = new Set<number>();

  for (const channel of config.channels) {
    if (!channel.name.trim()) {
      fieldErrors.push(`Channel ${channel.id} is missing a name`);
    }

    if (!channel.baseUrl.trim()) {
      fieldErrors.push(`Channel ${channel.name || channel.id} is missing a base URL`);
    }

    if (!channel.apiKey.trim()) {
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
    if (!channelIds.has(model.channelId)) {
      sectionErrors.push(`Model ${model.displayName || model.id} references a missing channel`);
    }

    const providerPair = `${model.channelId}:${model.providerModelName}`;
    if (providerModelPairs.has(providerPair)) {
      sectionErrors.push(
        `Duplicate provider model mapping ${model.providerModelName} for channel ${model.channelId}`,
      );
    } else {
      providerModelPairs.add(providerPair);
    }
  }

  for (const priority of config.priorities) {
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
