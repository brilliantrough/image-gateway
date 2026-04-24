import { mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

export const protocolTypeSchema = z.enum([
  "openai",
  "azure-openai",
  "aliyun-qwen-image",
  "aliyun",
  "tencent",
  "volcengine-ark",
  "apimart-async",
  "google-gemini",
  "custom",
]);

export const channelConfigSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  protocolType: protocolTypeSchema,
  protocolName: z.string().optional(),
  baseUrl: z.string().url(),
  apiKey: z.string(),
  stripResponseFormat: z.boolean().default(false),
  enabled: z.boolean(),
  description: z.string().optional(),
}).strict();

export const modelConfigSchema = z.object({
  id: z.string().min(1),
  displayName: z.string(),
  providerModelName: z.string(),
  channelId: z.string().min(1),
  modelKind: z.literal("image-generation"),
  enabled: z.boolean(),
  description: z.string().optional(),
}).strict();

export const modelPrioritySchema = z.object({
  modelId: z.string().min(1),
  priority: z.number().int().positive(),
}).strict();

export const frontendSettingsSchema = z.object({
  invocationStudio: z.object({
    minimalMode: z.boolean().default(false),
  }).default({ minimalMode: false }),
}).default({ invocationStudio: { minimalMode: false } });

export const gatewayUpstreamConfigSchema = z.object({
  version: z.literal(1),
  channels: z.array(channelConfigSchema),
  models: z.array(modelConfigSchema),
  priorities: z.array(modelPrioritySchema),
  frontendSettings: frontendSettingsSchema,
}).strict();

export type ProtocolType = z.infer<typeof protocolTypeSchema>;
export type ChannelConfig = z.infer<typeof channelConfigSchema>;
export type ModelConfig = z.infer<typeof modelConfigSchema>;
export type ModelPriority = z.infer<typeof modelPrioritySchema>;
export type FrontendSettings = z.infer<typeof frontendSettingsSchema>;
export type GatewayUpstreamConfig = z.infer<typeof gatewayUpstreamConfigSchema>;

function findDuplicateId<T extends { id: string }>(items: T[]): string | null {
  const ids = new Set<string>();

  for (const item of items) {
    if (ids.has(item.id)) {
      return item.id;
    }

    ids.add(item.id);
  }

  return null;
}

export function validateUpstreamConfig(config: GatewayUpstreamConfig): GatewayUpstreamConfig {
  const duplicateChannelId = findDuplicateId(config.channels);
  if (duplicateChannelId) {
    throw new Error(`Duplicate channel id ${duplicateChannelId}`);
  }

  const duplicateModelId = findDuplicateId(config.models);
  if (duplicateModelId) {
    throw new Error(`Duplicate model id ${duplicateModelId}`);
  }

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

export async function saveUpstreamConfigFile(
  configPath: string,
  config: GatewayUpstreamConfig,
): Promise<void> {
  const directory = path.dirname(configPath);
  const tempDirectory = await mkdtemp(path.join(directory, ".upstreams-"));
  const tempFile = path.join(tempDirectory, path.basename(configPath));

  try {
    await writeFile(tempFile, `${JSON.stringify(config, null, 2)}\n`, "utf8");
    await rename(tempFile, configPath);
  } finally {
    await rm(tempDirectory, { recursive: true, force: true }).catch(() => {});
  }
}
