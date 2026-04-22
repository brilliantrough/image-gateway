import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadUpstreamConfigFile } from "../../src/config/upstream-config.js";

const tempDirs: string[] = [];

async function writeTempConfig(config: unknown): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "upstream-config-"));
  tempDirs.push(dir);

  const configPath = path.join(dir, "upstreams.json");
  await writeFile(configPath, JSON.stringify(config), "utf8");

  return configPath;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("loadUpstreamConfigFile", () => {
  it("loads a Volcengine Ark channel and provider model mapping", async () => {
    const configPath = await writeTempConfig({
      version: 1,
      channels: [
        {
          id: "volcengine-ark",
          name: "Volcengine Ark",
          protocolType: "volcengine-ark",
          baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
          apiKey: "ark-key",
          enabled: true,
        },
      ],
      models: [
        {
          id: "doubao-seedream",
          displayName: "gpt-image-1",
          providerModelName: "doubao-seedream-4-0",
          channelId: "volcengine-ark",
          modelKind: "image-generation",
          enabled: true,
        },
      ],
      priorities: [{ modelId: "doubao-seedream", priority: 200 }],
    });

    const config = await loadUpstreamConfigFile(configPath);

    expect(config.channels[0]?.protocolType).toBe("volcengine-ark");
    expect(config.models[0]?.providerModelName).toBe("doubao-seedream-4-0");
  });

  it("rejects duplicate priority values", async () => {
    const configPath = await writeTempConfig({
      version: 1,
      channels: [
        {
          id: "openai-main",
          name: "OpenAI Main",
          protocolType: "openai",
          baseUrl: "https://api.openai.com/v1",
          apiKey: "openai-key",
          enabled: true,
        },
      ],
      models: [
        {
          id: "primary",
          displayName: "gpt-image-1",
          providerModelName: "gpt-image-1",
          channelId: "openai-main",
          modelKind: "image-generation",
          enabled: true,
        },
        {
          id: "backup",
          displayName: "gpt-image-1",
          providerModelName: "gpt-image-1-alt",
          channelId: "openai-main",
          modelKind: "image-generation",
          enabled: true,
        },
      ],
      priorities: [
        { modelId: "primary", priority: 100 },
        { modelId: "backup", priority: 100 },
      ],
    });

    await expect(loadUpstreamConfigFile(configPath)).rejects.toThrow(/Duplicate priority 100/);
  });

  it("rejects unknown top-level keys", async () => {
    const configPath = await writeTempConfig({
      version: 1,
      channels: [],
      models: [],
      priorities: [],
      unexpected: true,
    });

    await expect(loadUpstreamConfigFile(configPath)).rejects.toThrow(/unrecognized key/i);
  });

  it("rejects unknown nested keys", async () => {
    const configPath = await writeTempConfig({
      version: 1,
      channels: [
        {
          id: "openai-main",
          name: "OpenAI Main",
          protocolType: "openai",
          baseUrl: "https://api.openai.com/v1",
          apiKey: "openai-key",
          enabled: true,
          timeoutMs: 30_000,
        },
      ],
      models: [],
      priorities: [],
    });

    await expect(loadUpstreamConfigFile(configPath)).rejects.toThrow(/unrecognized key/i);
  });

  it("rejects invalid channel baseUrl values", async () => {
    const configPath = await writeTempConfig({
      version: 1,
      channels: [
        {
          id: "openai-main",
          name: "OpenAI Main",
          protocolType: "openai",
          baseUrl: "not-a-url",
          apiKey: "openai-key",
          enabled: true,
        },
      ],
      models: [],
      priorities: [],
    });

    await expect(loadUpstreamConfigFile(configPath)).rejects.toThrow(/invalid url/i);
  });

  it("rejects duplicate channel ids", async () => {
    const configPath = await writeTempConfig({
      version: 1,
      channels: [
        {
          id: "openai-main",
          name: "OpenAI Main",
          protocolType: "openai",
          baseUrl: "https://api.openai.com/v1",
          apiKey: "openai-key",
          enabled: true,
        },
        {
          id: "openai-main",
          name: "OpenAI Backup",
          protocolType: "openai",
          baseUrl: "https://api.openai.com/v1",
          apiKey: "openai-key-2",
          enabled: true,
        },
      ],
      models: [],
      priorities: [],
    });

    await expect(loadUpstreamConfigFile(configPath)).rejects.toThrow("Duplicate channel id openai-main");
  });

  it("rejects duplicate model ids", async () => {
    const configPath = await writeTempConfig({
      version: 1,
      channels: [
        {
          id: "openai-main",
          name: "OpenAI Main",
          protocolType: "openai",
          baseUrl: "https://api.openai.com/v1",
          apiKey: "openai-key",
          enabled: true,
        },
      ],
      models: [
        {
          id: "gpt-image-1",
          displayName: "gpt-image-1",
          providerModelName: "gpt-image-1",
          channelId: "openai-main",
          modelKind: "image-generation",
          enabled: true,
        },
        {
          id: "gpt-image-1",
          displayName: "gpt-image-1 backup",
          providerModelName: "gpt-image-1-backup",
          channelId: "openai-main",
          modelKind: "image-generation",
          enabled: true,
        },
      ],
      priorities: [],
    });

    await expect(loadUpstreamConfigFile(configPath)).rejects.toThrow("Duplicate model id gpt-image-1");
  });
});
