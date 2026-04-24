import { describe, expect, it, vi } from "vitest";
import type { GatewayUpstreamConfig } from "../../src/config/upstream-config.js";
import { GatewayError } from "../../src/lib/errors.js";
import { ConfiguredUpstreamRouter } from "../../src/providers/router/upstream-router.js";
import type { ImageProvider } from "../../src/providers/types.js";
import type { NormalizedImageRequest, NormalizedImageResponse } from "../../src/types/image.js";

function createBaseRequest(): NormalizedImageRequest {
  return {
    mode: "text-to-image",
    model: "gpt-image-1",
    prompt: "orange cat",
    size: "1024x1024",
    n: 1,
    response_format: "b64_json",
    images: [],
    extra_body: {},
  };
}

function createResponse(): NormalizedImageResponse {
  return {
    created: 1,
    data: [{ b64_json: "abc", url: null, mime_type: "image/png", revised_prompt: null }],
    usage: { image_count: 1 },
    request_id: "req_test",
  };
}

function createConfig(): GatewayUpstreamConfig {
  return {
    version: 1,
    channels: [
      {
        id: "openai-main",
        name: "OpenAI",
        protocolType: "openai",
        baseUrl: "https://api.openai.com/v1",
        apiKey: "test-openai",
        enabled: true,
      },
      {
        id: "ark-main",
        name: "Aliyun Qwen Image",
        protocolType: "aliyun-qwen-image",
        baseUrl: "https://dashscope.aliyuncs.com",
        apiKey: "test-aliyun",
        enabled: true,
      },
      {
        id: "aihubmix-main",
        name: "AIHubMix OpenAI",
        protocolType: "aihubmix-openai",
        baseUrl: "https://aihubmix.com/v1",
        apiKey: "test-aihubmix",
        enabled: true,
      },
      {
        id: "backup-main",
        name: "Backup",
        protocolType: "custom",
        protocolName: "backup-compatible",
        baseUrl: "https://backup.example.com/v1",
        apiKey: "test-backup",
        enabled: true,
      },
    ],
    models: [
      {
        id: "openai-gpt-image-1",
        displayName: "gpt-image-1",
        providerModelName: "gpt-image-1",
        channelId: "openai-main",
        modelKind: "image-generation",
        enabled: true,
      },
      {
        id: "ark-gpt-image-1",
        displayName: "gpt-image-1",
        providerModelName: "qwen-image-2.0",
        channelId: "ark-main",
        modelKind: "image-generation",
        enabled: true,
      },
      {
        id: "aihubmix-gpt-image-1",
        displayName: "gpt-image-2",
        providerModelName: "gpt-image-2",
        channelId: "aihubmix-main",
        modelKind: "image-generation",
        enabled: true,
      },
      {
        id: "backup-gpt-image-1",
        displayName: "gpt-image-1",
        providerModelName: "backup-image-model",
        channelId: "backup-main",
        modelKind: "image-generation",
        enabled: true,
      },
    ],
    priorities: [
      { modelId: "openai-gpt-image-1", priority: 100 },
      { modelId: "ark-gpt-image-1", priority: 200 },
      { modelId: "aihubmix-gpt-image-1", priority: 150 },
      { modelId: "backup-gpt-image-1", priority: 50 },
    ],
  };
}

describe("ConfiguredUpstreamRouter", () => {
  it("routes display model names to highest priority provider model", async () => {
    const provider: ImageProvider = {
      generateImage: vi.fn().mockResolvedValue(createResponse()),
    };
    const providerFactory = vi.fn().mockReturnValue(provider);
    const router = new ConfiguredUpstreamRouter(createConfig(), providerFactory);

    await router.generateImage(createBaseRequest());

    expect(providerFactory).toHaveBeenCalledWith(
      expect.objectContaining({ id: "ark-main", protocolType: "aliyun-qwen-image" }),
    );
    expect(provider.generateImage).toHaveBeenCalledWith(
      expect.objectContaining({ model: "qwen-image-2.0" }),
    );
  });

  it("skips disabled channels and models", async () => {
    const config = createConfig();
    config.channels = config.channels.map((channel) =>
      channel.id === "ark-main" ? { ...channel, enabled: false } : channel,
    );
    config.models = config.models.map((model) => {
      if (model.id === "openai-gpt-image-1") {
        return { ...model, enabled: false };
      }

      return model;
    });

    const provider: ImageProvider = {
      generateImage: vi.fn().mockResolvedValue(createResponse()),
    };
    const providerFactory = vi.fn().mockReturnValue(provider);
    const router = new ConfiguredUpstreamRouter(config, providerFactory);

    await router.generateImage(createBaseRequest());

    expect(providerFactory).toHaveBeenCalledWith(
      expect.objectContaining({ id: "backup-main", protocolType: "custom" }),
    );
    expect(provider.generateImage).toHaveBeenCalledWith(
      expect.objectContaining({ model: "backup-image-model" }),
    );
  });

  it("returns model_not_configured when no enabled route matches", async () => {
    const config = createConfig();
    config.channels = config.channels.map((channel) => ({ ...channel, enabled: false }));
    const router = new ConfiguredUpstreamRouter(config, vi.fn());

    await expect(router.generateImage(createBaseRequest())).rejects.toMatchObject<GatewayError>({
      statusCode: 404,
      type: "invalid_request",
      code: "model_not_configured",
      param: "model",
    });
  });

  it("matches trimmed display names", async () => {
    const config = createConfig();
    config.models = config.models.map((model) =>
      model.id === "ark-gpt-image-1" ? { ...model, displayName: "  gpt-image-1  " } : model,
    );

    const provider: ImageProvider = {
      generateImage: vi.fn().mockResolvedValue(createResponse()),
    };
    const providerFactory = vi.fn().mockReturnValue(provider);
    const router = new ConfiguredUpstreamRouter(config, providerFactory);

    await router.generateImage(createBaseRequest());

    expect(providerFactory).toHaveBeenCalledWith(
      expect.objectContaining({ id: "ark-main", protocolType: "aliyun-qwen-image" }),
    );
    expect(provider.generateImage).toHaveBeenCalledWith(
      expect.objectContaining({ model: "qwen-image-2.0" }),
    );
  });

  it("routes aihubmix-openai as a first-class OpenAI-compatible protocol", async () => {
    const request = { ...createBaseRequest(), model: "gpt-image-2" };
    const provider: ImageProvider = {
      generateImage: vi.fn().mockResolvedValue(createResponse()),
    };
    const providerFactory = vi.fn().mockReturnValue(provider);
    const router = new ConfiguredUpstreamRouter(createConfig(), providerFactory);

    await router.generateImage(request);

    expect(providerFactory).toHaveBeenCalledWith(
      expect.objectContaining({ id: "aihubmix-main", protocolType: "aihubmix-openai" }),
    );
    expect(provider.generateImage).toHaveBeenCalledWith(
      expect.objectContaining({ model: "gpt-image-2" }),
    );
  });
});
