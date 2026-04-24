import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../../src/app.js";
import { createRuntimeConfigManager } from "../../src/runtime/config-manager.js";
import type { GatewayUpstreamConfig } from "../../src/config/upstream-config.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
  tempDirs.length = 0;
});

function createConfig(): GatewayUpstreamConfig {
  return {
    version: 1,
    channels: [
      {
        id: "ark",
        name: "Volcengine Ark",
        protocolType: "aliyun-qwen-image",
        baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
        apiKey: "ark-key",
        stripResponseFormat: false,
        enabled: true,
      },
    ],
    models: [
      {
        id: "m1",
        displayName: "gpt-image-1",
        providerModelName: "qwen-image-2.0",
        channelId: "ark",
        modelKind: "image-generation",
        enabled: true,
      },
    ],
    priorities: [{ modelId: "m1", priority: 200 }],
    frontendSettings: {
      invocationStudio: {
        minimalMode: false,
      },
    },
  };
}

describe("config routes", () => {
  it("returns a public invocation catalog without sensitive channel fields", async () => {
    const config = createConfig();
    const manager = createRuntimeConfigManager({
      provider: { generateImage: vi.fn() },
      config,
      configPath: "config/upstreams.json",
    });
    const app = buildApp({ provider: manager.getProvider(), runtimeConfigManager: manager });
    await app.ready();

    try {
      const response = await app.inject({ method: "GET", url: "/v1/public/catalog" });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        version: 1,
        channels: [
          {
            id: "ark",
            name: "Volcengine Ark",
            protocolType: "aliyun-qwen-image",
          },
        ],
        models: [
          {
            id: "m1",
            displayName: "gpt-image-1",
            providerModelName: "qwen-image-2.0",
            channelId: "ark",
            modelKind: "image-generation",
          },
        ],
        priorities: [{ modelId: "m1", priority: 200 }],
        frontendSettings: {
          invocationStudio: {
            minimalMode: false,
          },
        },
      });
      expect(JSON.stringify(response.json())).not.toContain("ark-key");
      expect(JSON.stringify(response.json())).not.toContain("https://ark.cn-beijing.volces.com/api/v3");
    } finally {
      await app.close();
    }
  });

  it("requires admin authentication for config routes when admin token is configured", async () => {
    const config = createConfig();
    const manager = createRuntimeConfigManager({
      provider: { generateImage: vi.fn() },
      config,
      configPath: "config/upstreams.json",
    });
    const app = buildApp({
      provider: manager.getProvider(),
      runtimeConfigManager: manager,
      adminAuth: {
        apiToken: "admin-secret",
        username: "admin",
        password: null,
        sessionSecret: null,
      },
    });
    await app.ready();

    try {
      const response = await app.inject({ method: "GET", url: "/v1/config/upstreams" });

      expect(response.statusCode).toBe(401);
      expect(response.json()).toMatchObject({
        error: {
          code: "admin_auth_required",
        },
      });
    } finally {
      await app.close();
    }
  });

  it("accepts bearer admin token for config routes", async () => {
    const config = createConfig();
    const manager = createRuntimeConfigManager({
      provider: { generateImage: vi.fn() },
      config,
      configPath: "config/upstreams.json",
    });
    const app = buildApp({
      provider: manager.getProvider(),
      runtimeConfigManager: manager,
      adminAuth: {
        apiToken: "admin-secret",
        username: "admin",
        password: null,
        sessionSecret: null,
      },
    });
    await app.ready();

    try {
      const response = await app.inject({
        method: "GET",
        url: "/v1/config/upstreams",
        headers: {
          authorization: "Bearer admin-secret",
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual(config);
    } finally {
      await app.close();
    }
  });

  it("creates admin session cookie and accepts it on config routes", async () => {
    const config = createConfig();
    const manager = createRuntimeConfigManager({
      provider: { generateImage: vi.fn() },
      config,
      configPath: "config/upstreams.json",
    });
    const app = buildApp({
      provider: manager.getProvider(),
      runtimeConfigManager: manager,
      adminAuth: {
        apiToken: null,
        username: "admin",
        password: "123456",
        sessionSecret: "0123456789abcdef-session-secret",
      },
    });
    await app.ready();

    try {
      const loginResponse = await app.inject({
        method: "POST",
        url: "/v1/admin/login",
        payload: {
          username: "admin",
          password: "123456",
        },
      });

      expect(loginResponse.statusCode).toBe(200);
      const cookie = loginResponse.headers["set-cookie"];
      expect(cookie).toBeTruthy();

      const configResponse = await app.inject({
        method: "GET",
        url: "/v1/config/upstreams",
        headers: {
          cookie: String(cookie),
        },
      });

      expect(configResponse.statusCode).toBe(200);
      expect(configResponse.json()).toEqual(config);
    } finally {
      await app.close();
    }
  });

  it("returns the active upstream config", async () => {
    const config = createConfig();
    const manager = createRuntimeConfigManager({
      provider: { generateImage: vi.fn() },
      config,
      configPath: "config/upstreams.json",
    });
    const app = buildApp({ provider: manager.getProvider(), runtimeConfigManager: manager });
    await app.ready();

    try {
      const response = await app.inject({ method: "GET", url: "/v1/config/upstreams" });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual(config);
    } finally {
      await app.close();
    }
  });

  it("saves config to disk and swaps runtime config", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "image-gateway-save-"));
    tempDirs.push(dir);
    const configPath = path.join(dir, "upstreams.json");
    const initialProvider = { generateImage: vi.fn() };
    const manager = createRuntimeConfigManager({
      provider: initialProvider,
      config: null,
      configPath,
    });
    const app = buildApp({ provider: initialProvider, runtimeConfigManager: manager });
    await app.ready();
    const payload = createConfig();

    try {
      const response = await app.inject({
        method: "POST",
        url: "/v1/config/upstreams",
        payload,
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual(payload);
      expect(manager.getConfig()).toEqual(payload);
      expect(manager.getProvider()).not.toBe(initialProvider);
      expect(JSON.parse(await readFile(configPath, "utf8"))).toEqual(payload);
    } finally {
      await app.close();
    }
  });

  it("saves Google Gemini runtime config", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "image-gateway-save-"));
    tempDirs.push(dir);
    const configPath = path.join(dir, "upstreams.json");
    const initialProvider = { generateImage: vi.fn() };
    const manager = createRuntimeConfigManager({
      provider: initialProvider,
      config: null,
      configPath,
    });
    const app = buildApp({ provider: initialProvider, runtimeConfigManager: manager });
    await app.ready();
    const payload = createConfig();
    payload.channels = [
      {
        id: "gemini",
        name: "Google Gemini",
        protocolType: "google-gemini",
        baseUrl: "https://generativelanguage.googleapis.com/v1beta",
        apiKey: "gemini-key",
        stripResponseFormat: false,
        enabled: true,
      },
    ];
    payload.models = [
      {
        id: "gemini-image",
        displayName: "gemini-image",
        providerModelName: "gemini-3.1-flash-image-preview",
        channelId: "gemini",
        modelKind: "image-generation",
        enabled: true,
      },
    ];
    payload.priorities = [{ modelId: "gemini-image", priority: 200 }];

    try {
      const response = await app.inject({
        method: "POST",
        url: "/v1/config/upstreams",
        payload,
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual(payload);
      expect(manager.getConfig()).toEqual(payload);
      expect(manager.getProvider()).not.toBe(initialProvider);
      expect(JSON.parse(await readFile(configPath, "utf8"))).toEqual(payload);
    } finally {
      await app.close();
    }
  });

  it("does not swap runtime config when persistence is unavailable", async () => {
    const initialProvider = { generateImage: vi.fn() };
    const manager = createRuntimeConfigManager({
      provider: initialProvider,
      config: null,
      configPath: null,
    });
    const app = buildApp({ provider: initialProvider, runtimeConfigManager: manager });
    await app.ready();

    try {
      const response = await app.inject({
        method: "POST",
        url: "/v1/config/upstreams",
        payload: createConfig(),
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({
        error: {
          code: "config_persistence_unavailable",
        },
      });
      expect(manager.getConfig()).toBeNull();
      expect(manager.getProvider()).toBe(initialProvider);
    } finally {
      await app.close();
    }
  });

  it("does not swap runtime config when validation fails", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "image-gateway-save-"));
    tempDirs.push(dir);
    const initialProvider = { generateImage: vi.fn() };
    const manager = createRuntimeConfigManager({
      provider: initialProvider,
      config: null,
      configPath: path.join(dir, "upstreams.json"),
    });
    const app = buildApp({ provider: initialProvider, runtimeConfigManager: manager });
    await app.ready();
    const payload = createConfig();

    try {
      const response = await app.inject({
        method: "POST",
        url: "/v1/config/upstreams",
        payload: {
          ...payload,
          priorities: [
            { modelId: "m1", priority: 200 },
            { modelId: "missing", priority: 200 },
          ],
        },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({
        error: {
          code: "invalid_upstream_config",
        },
      });
      expect(manager.getConfig()).toBeNull();
      expect(manager.getProvider()).toBe(initialProvider);
    } finally {
      await app.close();
    }
  });

  it("does not persist or swap runtime config when an active protocol is unsupported", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "image-gateway-save-"));
    tempDirs.push(dir);
    const configPath = path.join(dir, "upstreams.json");
    const initialProvider = { generateImage: vi.fn() };
    const manager = createRuntimeConfigManager({
      provider: initialProvider,
      config: null,
      configPath,
    });
    const app = buildApp({ provider: initialProvider, runtimeConfigManager: manager });
    await app.ready();
    const payload = createConfig();
    payload.channels = payload.channels.map((channel) => ({
      ...channel,
      protocolType: "aliyun",
    }));

    try {
      const response = await app.inject({
        method: "POST",
        url: "/v1/config/upstreams",
        payload,
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({
        error: {
          code: "unsupported_protocol",
        },
      });
      expect(manager.getConfig()).toBeNull();
      expect(manager.getProvider()).toBe(initialProvider);
      await expect(readFile(configPath, "utf8")).rejects.toThrow();
    } finally {
      await app.close();
    }
  });

  it("does not swap runtime config when file persistence fails", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "image-gateway-save-"));
    tempDirs.push(dir);
    const initialProvider = { generateImage: vi.fn() };
    const manager = createRuntimeConfigManager({
      provider: initialProvider,
      config: null,
      configPath: path.join(dir, "missing", "upstreams.json"),
    });
    const app = buildApp({ provider: initialProvider, runtimeConfigManager: manager });
    await app.ready();

    try {
      const response = await app.inject({
        method: "POST",
        url: "/v1/config/upstreams",
        payload: createConfig(),
      });

      expect(response.statusCode).toBe(500);
      expect(response.json()).toMatchObject({
        error: {
          code: "config_persistence_failed",
        },
      });
      expect(manager.getConfig()).toBeNull();
      expect(manager.getProvider()).toBe(initialProvider);
    } finally {
      await app.close();
    }
  });

  it("tests a draft config against a specific provider model without saving it", async () => {
    const manager = createRuntimeConfigManager({
      provider: { generateImage: vi.fn() },
      config: createConfig(),
      configPath: "config/upstreams.json",
    });
    const providerFactory = vi.fn().mockReturnValue({
      generateImage: vi.fn().mockResolvedValue({
        created: 1,
        data: [{ b64_json: "abc", url: null, mime_type: "image/png", revised_prompt: null }],
        usage: { image_count: 1 },
        request_id: "req_test",
      }),
    });
    const app = buildApp({
      provider: manager.getProvider(),
      runtimeConfigManager: manager,
      upstreamProviderFactory: providerFactory,
    });
    await app.ready();
    const payload = createConfig();
    payload.channels[0] = {
      ...payload.channels[0]!,
      protocolType: "custom",
      protocolName: "draft-provider",
      stripResponseFormat: true,
    };

    try {
      const response = await app.inject({
        method: "POST",
        url: "/v1/config/upstreams/test-image",
        payload: {
          config: payload,
          modelId: "m1",
          prompt: "test prompt",
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        channelId: "ark",
        modelId: "m1",
        displayName: "gpt-image-1",
        providerModelName: "qwen-image-2.0",
        mode: "text-to-image",
        response: {
          data: [{ b64_json: "abc" }],
        },
      });
    } finally {
      await app.close();
    }
  });

  it("tests image-to-image against a specific provider model", async () => {
    const manager = createRuntimeConfigManager({
      provider: { generateImage: vi.fn() },
      config: createConfig(),
      configPath: "config/upstreams.json",
    });
    const generateImage = vi.fn().mockResolvedValue({
      created: 1,
      data: [{ b64_json: "abc", url: null, mime_type: "image/png", revised_prompt: null }],
      usage: { image_count: 1 },
      request_id: "req_test",
    });
    const providerFactory = vi.fn().mockReturnValue({ generateImage });
    const app = buildApp({
      provider: manager.getProvider(),
      runtimeConfigManager: manager,
      upstreamProviderFactory: providerFactory,
    });
    await app.ready();

    try {
      const response = await app.inject({
        method: "POST",
        url: "/v1/config/upstreams/test-image",
        payload: {
          config: createConfig(),
          modelId: "m1",
          prompt: "把图片里的猫换成卡通风格",
          image: "data:image/png;base64,Y2F0",
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        mode: "image-to-image",
      });
      expect(generateImage).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: "image-to-image",
          image: "data:image/png;base64,Y2F0",
          prompt: "把图片里的猫换成卡通风格",
        }),
      );
    } finally {
      await app.close();
    }
  });

  it("accepts provider test image payloads larger than the default Fastify body limit", async () => {
    const manager = createRuntimeConfigManager({
      provider: { generateImage: vi.fn() },
      config: createConfig(),
      configPath: "config/upstreams.json",
    });
    const generateImage = vi.fn().mockResolvedValue({
      created: 1,
      data: [{ b64_json: "abc", url: null, mime_type: "image/png", revised_prompt: null }],
      usage: { image_count: 1 },
      request_id: "req_test",
    });
    const providerFactory = vi.fn().mockReturnValue({ generateImage });
    const app = buildApp({
      provider: manager.getProvider(),
      runtimeConfigManager: manager,
      upstreamProviderFactory: providerFactory,
    });
    await app.ready();

    try {
      const largeImage = `data:image/png;base64,${"a".repeat(1_200_000)}`;
      const response = await app.inject({
        method: "POST",
        url: "/v1/config/upstreams/test-image",
        payload: {
          config: createConfig(),
          modelId: "m1",
          prompt: "把图片里的猫换成卡通风格",
          image: largeImage,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(generateImage).toHaveBeenCalledWith(
        expect.objectContaining({
          image: largeImage,
          mode: "image-to-image",
        }),
      );
    } finally {
      await app.close();
    }
  });

  it("runs an invocation directly against a selected channel and model", async () => {
    const config = createConfig();
    config.channels[0] = {
      ...config.channels[0]!,
      protocolType: "custom",
      protocolName: "direct-provider",
    };
    const manager = createRuntimeConfigManager({
      provider: { generateImage: vi.fn() },
      config,
      configPath: "config/upstreams.json",
    });
    const generateImage = vi.fn().mockResolvedValue({
      created: 1,
      data: [{ url: "https://cdn.example.com/output.png", b64_json: null, mime_type: null, revised_prompt: null }],
      usage: { image_count: 1 },
      request_id: "req_test",
    });
    const providerFactory = vi.fn().mockReturnValue({ generateImage });
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
          channelId: "ark",
          modelId: "m1",
          mode: "text-to-image",
          prompt: "test prompt",
          size: "1024x1024",
          response_format: "url",
          extra_body: { watermark: false },
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        channelId: "ark",
        modelId: "m1",
        providerModelName: "qwen-image-2.0",
        mode: "text-to-image",
        response: {
          data: [{ url: "https://cdn.example.com/output.png" }],
        },
      });
      expect(generateImage).toHaveBeenCalledWith(
        expect.objectContaining({
          model: "qwen-image-2.0",
          prompt: "test prompt",
          extra_body: { watermark: false },
        }),
      );
    } finally {
      await app.close();
    }
  });
});
