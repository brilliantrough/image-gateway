import { describe, expect, it, vi } from "vitest";
import { buildApp } from "../../src/app.js";
import { createRuntimeConfigManager } from "../../src/runtime/config-manager.js";
import type { GatewayUpstreamConfig } from "../../src/config/upstream-config.js";

function createConfig(): GatewayUpstreamConfig {
  return {
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
        id: "seed",
        name: "Seed",
        protocolType: "volcengine-ark",
        baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
        apiKey: "seed-key",
        enabled: true,
      },
    ],
    models: [
      {
        id: "model-openai",
        displayName: "gpt-image-1",
        providerModelName: "gpt-image-1",
        channelId: "openai-main",
        modelKind: "image-generation",
        enabled: true,
      },
      {
        id: "model-seed",
        displayName: "gpt-image-1",
        providerModelName: "doubao-seedream-5-0-250428",
        channelId: "seed",
        modelKind: "image-generation",
        enabled: true,
      },
    ],
    priorities: [
      { modelId: "model-openai", priority: 10 },
      { modelId: "model-seed", priority: 999 },
    ],
  };
}

describe("invocation routes", () => {
  it("invokes the explicitly selected channel and model", async () => {
    const generateImage = vi.fn().mockResolvedValue({
      created: 1,
      data: [{ url: "https://example.com/cat.png" }],
      request_id: "req_123",
    });
    const providerFactory = vi.fn().mockReturnValue({ generateImage });
    const manager = createRuntimeConfigManager({
      provider: { generateImage: vi.fn() },
      config: createConfig(),
      configPath: "config/upstreams.json",
    });
    const app = buildApp({
      provider: manager.getProvider(),
      runtimeConfigManager: manager,
      upstreamProviderFactory: providerFactory,
    });
    await app.ready();

    try {
      const response = await app.inject({
        method: "POST",
        url: "/v1/invocation/run",
        payload: {
          channelId: "openai-main",
          modelId: "model-openai",
          prompt: "draw a cat",
          size: "1024x1024",
          response_format: "url",
        },
      });

      expect(response.statusCode).toBe(200);
      expect(providerFactory).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "openai-main",
        }),
      );
      expect(generateImage).toHaveBeenCalledWith(
        expect.objectContaining({
          model: "gpt-image-1",
          prompt: "draw a cat",
        }),
      );
      expect(response.json()).toMatchObject({
        channelId: "openai-main",
        modelId: "model-openai",
        providerModelName: "gpt-image-1",
      });
    } finally {
      await app.close();
    }
  });

  it("returns 404 when the selected model does not belong to the selected channel", async () => {
    const manager = createRuntimeConfigManager({
      provider: { generateImage: vi.fn() },
      config: createConfig(),
      configPath: "config/upstreams.json",
    });
    const app = buildApp({
      provider: manager.getProvider(),
      runtimeConfigManager: manager,
    });
    await app.ready();

    try {
      const response = await app.inject({
        method: "POST",
        url: "/v1/invocation/run",
        payload: {
          channelId: "openai-main",
          modelId: "model-seed",
          prompt: "draw a cat",
          size: "1024x1024",
          response_format: "url",
        },
      });

      expect(response.statusCode).toBe(404);
      expect(response.json()).toMatchObject({
        error: {
          code: "invocation_model_not_found",
        },
      });
    } finally {
      await app.close();
    }
  });
});
