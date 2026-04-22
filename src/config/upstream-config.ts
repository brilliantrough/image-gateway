import { readFile } from "node:fs/promises";
import { z } from "zod";

export const protocolTypeSchema = z.enum([
  "openai",
  "azure-openai",
  "aliyun",
  "tencent",
  "volcengine-ark",
  "custom",
]);

export const channelConfigSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  protocolType: protocolTypeSchema,
  protocolName: z.string().optional(),
  baseUrl: z.string(),
  apiKey: z.string(),
  enabled: z.boolean(),
  description: z.string().optional(),
});

export const modelConfigSchema = z.object({
  id: z.string().min(1),
  displayName: z.string(),
  providerModelName: z.string(),
  channelId: z.string().min(1),
  modelKind: z.literal("image-generation"),
  enabled: z.boolean(),
  description: z.string().optional(),
});

export const modelPrioritySchema = z.object({
  modelId: z.string().min(1),
  priority: z.number().int().positive(),
});

export const gatewayUpstreamConfigSchema = z.object({
  version: z.literal(1),
  channels: z.array(channelConfigSchema),
  models: z.array(modelConfigSchema),
  priorities: z.array(modelPrioritySchema),
});

export type ProtocolType = z.infer<typeof protocolTypeSchema>;
export type ChannelConfig = z.infer<typeof channelConfigSchema>;
export type ModelConfig = z.infer<typeof modelConfigSchema>;
export type ModelPriority = z.infer<typeof modelPrioritySchema>;
export type GatewayUpstreamConfig = z.infer<typeof gatewayUpstreamConfigSchema>;

export function validateUpstreamConfig(config: GatewayUpstreamConfig): GatewayUpstreamConfig {
  const channelIds = new Set(config.channels.map((channel) => channel.id));
  const modelIds = new Set(config.models.map((model) => model.id));
  const priorityModelIds = new Set<string>();
  const priorityValues = new Set<number>();

  for (const model of config.models) {
    if (!channelIds.has(model.channelId)) {
      throw new Error(`Model ${model.id} references missing channel ${model.channelId}`);
    }
  }

  for (const priority of config.priorities) {
    if (!modelIds.has(priority.modelId)) {
      throw new Error(`Priority references missing model ${priority.modelId}`);
    }

    if (priorityModelIds.has(priority.modelId)) {
      throw new Error(`Model ${priority.modelId} has more than one priority entry`);
    }
    priorityModelIds.add(priority.modelId);

    if (priorityValues.has(priority.priority)) {
      throw new Error(`Duplicate priority ${priority.priority}`);
    }
    priorityValues.add(priority.priority);
  }

  return config;
}

export async function loadUpstreamConfigFile(configPath: string): Promise<GatewayUpstreamConfig> {
  const content = await readFile(configPath, "utf8");
  const parsedJson = JSON.parse(content) as unknown;
  const config = gatewayUpstreamConfigSchema.parse(parsedJson);

  return validateUpstreamConfig(config);
}
