import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AliyunQwenImageProvider,
  normalizeAliyunSize,
  resolveAliyunEndpoint,
  toAliyunQwenImageRequest,
} from "../../src/providers/aliyun-qwen-image/adapter.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("normalizeAliyunSize", () => {
  it("converts OpenAI-style sizes to Aliyun format", () => {
    expect(normalizeAliyunSize("1024x1024")).toBe("1024*1024");
    expect(normalizeAliyunSize("1024X1536")).toBe("1024*1536");
    expect(normalizeAliyunSize("2048*2048")).toBe("2048*2048");
    expect(normalizeAliyunSize("1:1")).toBe("1:1");
  });
});

describe("resolveAliyunEndpoint", () => {
  it("accepts root, api root, and full endpoint forms", () => {
    expect(resolveAliyunEndpoint("https://dashscope.aliyuncs.com")).toBe(
      "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation",
    );
    expect(resolveAliyunEndpoint("https://dashscope.aliyuncs.com/api/v1")).toBe(
      "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation",
    );
    expect(
      resolveAliyunEndpoint(
        "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation",
      ),
    ).toBe("https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation");
  });

  it("rewrites Token Plan compatible-mode base URLs to the image endpoint", () => {
    expect(
      resolveAliyunEndpoint("https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1"),
    ).toBe(
      "https://token-plan.cn-beijing.maas.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation",
    );
  });
});

describe("toAliyunQwenImageRequest", () => {
  it("maps text-to-image request into model/input.messages/parameters", () => {
    const payload = toAliyunQwenImageRequest({
      mode: "text-to-image",
      model: "qwen-image-2.0",
      prompt: "orange cat",
      size: "1024x1024",
      n: 2,
      response_format: "url",
      negative_prompt: "blurry",
      images: [],
      extra_body: {
        prompt_extend: true,
        watermark: false,
      },
    });

    expect(payload).toEqual({
      model: "qwen-image-2.0",
      input: {
        messages: [
          {
            role: "user",
            content: [{ text: "orange cat" }],
          },
        ],
      },
      parameters: {
        size: "1024*1024",
        n: 2,
        prompt_extend: true,
        watermark: false,
        negative_prompt: "blurry",
      },
    });
  });

  it("includes image and mask inputs for edit mode", () => {
    const payload = toAliyunQwenImageRequest({
      mode: "edit",
      model: "qwen-image-edit",
      prompt: "replace background",
      size: "1536x1024",
      n: 1,
      response_format: "url",
      image: "https://example.com/input.png",
      images: ["https://example.com/alt.png"],
      mask: "https://example.com/mask.png",
      extra_body: {},
    });

    expect(payload).toMatchObject({
      input: {
        messages: [
          {
            content: [
              { text: "replace background" },
              { image: "https://example.com/input.png" },
              { image: "https://example.com/alt.png" },
              { mask: "https://example.com/mask.png" },
            ],
          },
        ],
      },
      parameters: {
        size: "1536*1024",
      },
    });
  });

  it("omits n when image count is the default single image", () => {
    const payload = toAliyunQwenImageRequest({
      mode: "text-to-image",
      model: "qwen-image-2.0",
      prompt: "orange cat",
      size: "1024x1024",
      n: 1,
      response_format: "url",
      images: [],
      extra_body: {},
    });

    expect(payload).toMatchObject({
      parameters: {
        size: "1024*1024",
      },
    });
    expect((payload.parameters as Record<string, unknown>).n).toBeUndefined();
  });
});

describe("AliyunQwenImageProvider", () => {
  it("calls Aliyun and returns URL output", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          request_id: "req_123",
          output: {
            choices: [
              {
                message: {
                  content: [{ type: "image", image: "https://cdn.example.com/output.png" }],
                },
              },
            ],
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const provider = new AliyunQwenImageProvider({
      apiKey: "test-key",
      baseUrl: "https://dashscope.aliyuncs.com",
    });
    const result = await provider.generateImage({
      mode: "text-to-image",
      model: "qwen-image-2.0",
      prompt: "orange cat",
      size: "1024x1024",
      n: 1,
      response_format: "url",
      images: [],
      extra_body: {},
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation",
      expect.objectContaining({
        method: "POST",
      }),
    );
    expect(result.data[0]?.url).toBe("https://cdn.example.com/output.png");
    expect(result.request_id).toBe("req_123");
  });

  it("downloads generated assets when b64_json is requested", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            request_id: "req_456",
            output: {
              choices: [
                {
                  message: {
                    content: [{ image: "https://cdn.example.com/output.png" }],
                  },
                },
              ],
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(new Uint8Array([1, 2, 3]), {
          status: 200,
          headers: { "content-type": "image/png" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const provider = new AliyunQwenImageProvider({
      apiKey: "test-key",
      baseUrl: "https://dashscope.aliyuncs.com/api/v1",
    });
    const result = await provider.generateImage({
      mode: "text-to-image",
      model: "qwen-image-2.0",
      prompt: "orange cat",
      size: "1024x1024",
      n: 1,
      response_format: "b64_json",
      images: [],
      extra_body: {},
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.data[0]?.b64_json).toBe("AQID");
    expect(result.data[0]?.url).toBeNull();
  });
});
