import { afterEach, describe, expect, it, vi } from "vitest";
import { ApimartAsyncImageProvider, toApimartAsyncRequest } from "../../src/providers/apimart-async/adapter.js";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("toApimartAsyncRequest", () => {
  it("maps image inputs to image_urls and omits response_format", () => {
    const payload = toApimartAsyncRequest({
      mode: "image-to-image",
      model: "qwen-image-2",
      prompt: "orange cat",
      size: "1:1",
      n: 1,
      response_format: "b64_json",
      image: "https://example.com/a.png",
      images: ["https://example.com/b.png"],
      extra_body: {
        resolution: "2k",
        image_urls: ["https://override.invalid/image.png"],
        prompt: "override me",
      },
    });

    expect(payload).toMatchObject({
      model: "qwen-image-2",
      prompt: "orange cat",
      size: "1:1",
      n: 1,
      resolution: "2k",
      image_urls: ["https://example.com/a.png", "https://example.com/b.png"],
    });
    expect(payload.response_format).toBeUndefined();
    expect(payload.prompt).toBe("orange cat");
    expect(payload.image_urls).toEqual(["https://example.com/a.png", "https://example.com/b.png"]);
  });

  it("maps Wan 2.7 fixed fields and filters Qwen-only fields", () => {
    const payload = toApimartAsyncRequest({
      mode: "text-to-image",
      model: "wan2.7-image-pro",
      prompt: "orange cat",
      size: "2K",
      n: 1,
      response_format: "url",
      images: [],
      extra_body: {
        thinking_mode: true,
        enable_sequential: false,
        negative_prompt: "low quality",
        seed: 123,
        watermark: false,
        bbox_list: [{ prompt: "cat", x: 10, y: 20 }],
        color_palette: ["#ffffff"],
        resolution: "2K",
      },
    });

    expect(payload).toMatchObject({
      model: "wan2.7-image-pro",
      prompt: "orange cat",
      size: "2K",
      n: 1,
      thinking_mode: true,
      enable_sequential: false,
      negative_prompt: "low quality",
      seed: 123,
      watermark: false,
      bbox_list: [{ prompt: "cat", x: 10, y: 20 }],
      color_palette: ["#ffffff"],
    });
    expect(payload.resolution).toBeUndefined();
  });
});

describe("ApimartAsyncImageProvider", () => {
  it("submits a task and polls until completion", async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            code: 200,
            data: [{ task_id: "task_123", status: "submitted" }],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            code: 200,
            data: {
              id: "task_123",
              status: "processing",
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            code: 200,
            data: {
              id: "task_123",
              status: "completed",
              result: {
                images: [{ url: ["https://cdn.example.com/output.png"] }],
              },
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    const provider = new ApimartAsyncImageProvider({
      apiKey: "test-key",
      baseUrl: "https://api.apimart.test/v1",
    });
    const promise = provider.generateImage({
      mode: "text-to-image",
      model: "qwen-image-2",
      prompt: "orange cat",
      size: "1:1",
      n: 1,
      response_format: "url",
      images: [],
      extra_body: {},
    });

    await vi.advanceTimersByTimeAsync(2_000);
    const result = await promise;

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://api.apimart.test/v1/images/generations");
    expect(fetchMock.mock.calls[1]?.[0]).toBe("https://api.apimart.test/v1/tasks/task_123?language=en");
    expect(result.data[0]?.url).toBe("https://cdn.example.com/output.png");
  });

  it("downloads generated assets when b64_json is requested", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            code: 200,
            data: [{ task_id: "task_123", status: "submitted" }],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            code: 200,
            data: {
              id: "task_123",
              status: "completed",
              result: {
                images: [{ url: ["https://cdn.example.com/output.png"] }],
              },
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

    const provider = new ApimartAsyncImageProvider({
      apiKey: "test-key",
      baseUrl: "https://api.apimart.test/v1",
    });
    const result = await provider.generateImage({
      mode: "text-to-image",
      model: "qwen-image-2",
      prompt: "orange cat",
      size: "1:1",
      n: 1,
      response_format: "b64_json",
      images: [],
      extra_body: {},
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(result.data[0]?.b64_json).toBe("AQID");
    expect(result.data[0]?.url).toBeNull();
  });

  it("treats business error codes as upstream failures even when http status is 200", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          code: 4001,
          message: "invalid prompt",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const provider = new ApimartAsyncImageProvider({
      apiKey: "test-key",
      baseUrl: "https://api.apimart.test/v1",
    });

    await expect(
      provider.generateImage({
        mode: "text-to-image",
        model: "qwen-image-2",
        prompt: "orange cat",
        size: "1:1",
        n: 1,
        response_format: "url",
        images: [],
        extra_body: {},
      }),
    ).rejects.toMatchObject({
      code: "apimart_request_failed",
      message: expect.stringContaining("code 4001"),
    });
  });

  it("accepts APIMart string success codes", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            code: "success",
            data: [{ task_id: "task_123", status: "submitted" }],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            code: "success",
            data: {
              id: "task_123",
              status: "completed",
              result: {
                images: [{ url: ["https://cdn.example.com/output.png"] }],
              },
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    const provider = new ApimartAsyncImageProvider({
      apiKey: "test-key",
      baseUrl: "https://api.apimart.test/v1",
    });
    const result = await provider.generateImage({
      mode: "text-to-image",
      model: "wan2.7-image-pro",
      prompt: "orange cat",
      size: "2K",
      n: 1,
      response_format: "url",
      images: [],
      extra_body: {},
    });

    expect(result.data[0]?.url).toBe("https://cdn.example.com/output.png");
  });
});
