import { afterEach, describe, expect, it, vi } from "vitest";
import { GatewayError } from "../../src/lib/errors.js";
import {
  normalizeVolcengineArkSize,
  resolveArkImageEndpoint,
  toVolcengineArkRequest,
  VolcengineArkImageProvider,
} from "../../src/providers/volcengine-ark/adapter.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("resolveArkImageEndpoint", () => {
  it("appends the image generation path to an Ark base URL", () => {
    expect(resolveArkImageEndpoint("https://ark.cn-beijing.volces.com/api/v3")).toBe(
      "https://ark.cn-beijing.volces.com/api/v3/images/generations",
    );
    expect(
      resolveArkImageEndpoint("https://ark.cn-beijing.volces.com/api/v3/images/generations"),
    ).toBe("https://ark.cn-beijing.volces.com/api/v3/images/generations");
  });
});

describe("normalizeVolcengineArkSize", () => {
  it("normalizes documented preset values to the lowercase values accepted by Ark", () => {
    expect(normalizeVolcengineArkSize("doubao-seedream-5-0-lite-260128", "2K")).toBe("2k");
    expect(normalizeVolcengineArkSize("doubao-seedream-4-5-251128", "4K")).toBe("4k");
    expect(normalizeVolcengineArkSize("doubao-seedream-4-0-250828", "1K")).toBe("1k");
  });

  it("rejects sizes that are outside the documented model-specific Ark contract", () => {
    expect(() =>
      normalizeVolcengineArkSize("doubao-seedream-5-0-lite-260128", "1024x1024"),
    ).toThrow(/does not accept size '1024x1024'/);
    expect(() =>
      normalizeVolcengineArkSize("doubao-seedream-5-0-lite-260128", "1:1"),
    ).toThrow(/Use one of 'WIDTHxHEIGHT', '2k', '3k'/);
    expect(() =>
      normalizeVolcengineArkSize("doubao-seedream-5-0-lite-260128", "4k"),
    ).toThrow(/Use one of 'WIDTHxHEIGHT', '2k', '3k'/);
  });
});

describe("toVolcengineArkRequest", () => {
  it("maps image-to-image to Ark ImageGenerations shape", () => {
    const payload = toVolcengineArkRequest({
      mode: "image-to-image",
      model: "doubao-seedream-4-0-250828",
      prompt: "把图片里的猫换成卡通风格",
      size: "2k",
      n: 1,
      response_format: "url",
      seed: 123,
      image: "data:image/png;base64,Y2F0",
      images: [],
      extra_body: {
        watermark: false,
        stream: true,
      },
    });

    expect(payload).toMatchObject({
      model: "doubao-seedream-4-0-250828",
      prompt: "把图片里的猫换成卡通风格",
      image: ["data:image/png;base64,Y2F0"],
      size: "2k",
      response_format: "url",
      stream: false,
      watermark: false,
      sequential_image_generation: "disabled",
    });
    expect(payload.seed).toBeUndefined();
  });

  it("forwards seed only for documented Seedream 3 / SeedEdit 3 models", () => {
    const seedream3Payload = toVolcengineArkRequest({
      mode: "text-to-image",
      model: "doubao-seedream-3-0-t2i-250415",
      prompt: "cat",
      size: "1024x1024",
      n: 1,
      response_format: "url",
      seed: 123,
      images: [],
      extra_body: {},
    });
    const seedream4Payload = toVolcengineArkRequest({
      mode: "text-to-image",
      model: "doubao-seedream-4-0-250828",
      prompt: "cat",
      size: "2k",
      n: 1,
      response_format: "url",
      seed: 123,
      images: [],
      extra_body: {},
    });

    expect(seedream3Payload.seed).toBe(123);
    expect(seedream4Payload.seed).toBeUndefined();
  });

  it("maps n greater than 1 to sequential image generation for supported models", () => {
    const payload = toVolcengineArkRequest({
      mode: "text-to-image",
      model: "doubao-seedream-4-5-251128",
      prompt: "cat story",
      size: "2k",
      n: 3,
      response_format: "url",
      images: [],
      extra_body: {},
    });

    expect(payload).toMatchObject({
      sequential_image_generation: "auto",
      sequential_image_generation_options: {
        max_images: 3,
      },
    });
  });
});

describe("VolcengineArkImageProvider", () => {
  it("calls Ark ImageGenerations directly and normalizes the response", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          model: "doubao-seedream-4-0-250828",
          created: 1757321139,
          data: [{ url: "https://cdn.example.com/output.png", size: "2048x2048" }],
          usage: {
            generated_images: 1,
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const provider = new VolcengineArkImageProvider({
      apiKey: "ark-key",
      baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
    });
    const result = await provider.generateImage({
      mode: "text-to-image",
      model: "doubao-seedream-4-0-250828",
      prompt: "cat",
      size: "2k",
      n: 1,
      response_format: "url",
      images: [],
      extra_body: {
        watermark: false,
      },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://ark.cn-beijing.volces.com/api/v3/images/generations",
      expect.objectContaining({
        method: "POST",
      }),
    );
    expect(result.data[0]?.url).toBe("https://cdn.example.com/output.png");
    expect(result.usage.image_count).toBe(1);
  });

  it("returns a gateway error instead of an unexpected error for invalid upstream output", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          model: "doubao-seedream-4-0-250828",
          data: [],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const provider = new VolcengineArkImageProvider({
      apiKey: "ark-key",
      baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
    });

    await expect(
      provider.generateImage({
        mode: "image-to-image",
        model: "doubao-seedream-4-0-250828",
        prompt: "cat",
        size: "2k",
        n: 1,
        response_format: "url",
        image: "data:image/png;base64,Y2F0",
        images: [],
        extra_body: {},
      }),
    ).rejects.toMatchObject<GatewayError>({
      statusCode: 502,
      code: "volcengine_ark_missing_output",
    });
  });
});
