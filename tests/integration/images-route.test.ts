import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { buildApp } from "../../src/app.js";
import { createRuntimeConfigManager } from "../../src/runtime/config-manager.js";

describe("POST /v1/images/generations", () => {
  const provider = {
    generateImage: vi.fn(),
  };

  const app = buildApp({ provider });

  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns normalized image data", async () => {
    provider.generateImage.mockReset();
    provider.generateImage.mockResolvedValueOnce({
      created: 1,
      data: [{ b64_json: "abc", url: null, mime_type: "image/png", revised_prompt: null }],
      usage: { image_count: 1 },
      request_id: "req_test",
    });

    const response = await app.inject({
      method: "POST",
      url: "/v1/images/generations",
      payload: {
        model: "gpt-image-1",
        prompt: "orange cat",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(provider.generateImage).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gpt-image-1",
      }),
    );
    expect(response.json()).toMatchObject({
      data: [{ b64_json: "abc" }],
      request_id: "req_test",
    });
  });

  it("returns 400 for invalid payloads", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/v1/images/generations",
      payload: {
        prompt: "missing model",
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: {
        type: "validation_error",
      },
    });
  });
});

describe("POST /v1/images/generations with runtime config manager", () => {
  it("uses the latest provider without rebuilding the app", async () => {
    const providerA = {
      generateImage: vi.fn().mockResolvedValue({
        created: 1,
        data: [{ b64_json: "a", url: null, mime_type: "image/png", revised_prompt: null }],
        request_id: "req_a",
      }),
    };
    const providerB = {
      generateImage: vi.fn().mockResolvedValue({
        created: 2,
        data: [{ b64_json: "b", url: null, mime_type: "image/png", revised_prompt: null }],
        request_id: "req_b",
      }),
    };
    const manager = createRuntimeConfigManager({
      provider: providerA,
      config: null,
      configPath: null,
    });
    const app = buildApp({ provider: providerA, runtimeConfigManager: manager });
    await app.ready();

    try {
      const first = await app.inject({
        method: "POST",
        url: "/v1/images/generations",
        payload: {
          model: "gpt-image-1",
          prompt: "orange cat",
        },
      });

      manager.replace({ provider: providerB, config: null });

      const second = await app.inject({
        method: "POST",
        url: "/v1/images/generations",
        payload: {
          model: "gpt-image-1",
          prompt: "orange cat",
        },
      });

      expect(first.json()).toMatchObject({ request_id: "req_a" });
      expect(second.json()).toMatchObject({ request_id: "req_b" });
      expect(providerA.generateImage).toHaveBeenCalledTimes(1);
      expect(providerB.generateImage).toHaveBeenCalledTimes(1);
    } finally {
      await app.close();
    }
  });
});
