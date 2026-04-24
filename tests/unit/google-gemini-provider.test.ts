import { afterEach, describe, expect, it, vi } from "vitest";
import {
  GoogleGeminiImageProvider,
  resolveGeminiGenerateContentEndpoint,
  toGoogleGeminiRequest,
} from "../../src/providers/google-gemini/adapter.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("resolveGeminiGenerateContentEndpoint", () => {
  it("appends the v1beta model generateContent path", () => {
    expect(
      resolveGeminiGenerateContentEndpoint(
        "https://generativelanguage.googleapis.com/v1beta",
        "gemini-3.1-flash-image-preview",
        "test-key",
      ),
    ).toBe(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent?key=test-key",
    );
  });

  it("uses a full generateContent endpoint as-is", () => {
    expect(
      resolveGeminiGenerateContentEndpoint(
        "https://generativelanguage.googleapis.com/v1beta/models/custom:generateContent",
        "ignored",
        "test-key",
      ),
    ).toBe(
      "https://generativelanguage.googleapis.com/v1beta/models/custom:generateContent?key=test-key",
    );
  });

  it("appends v1beta for AIHubMix Gemini base URLs", () => {
    expect(
      resolveGeminiGenerateContentEndpoint(
        "https://aihubmix.com/gemini",
        "gemini-3.1-flash-image-preview",
        "test-key",
      ),
    ).toBe(
      "https://aihubmix.com/gemini/v1beta/models/gemini-3.1-flash-image-preview:generateContent?key=test-key",
    );
  });
});

describe("toGoogleGeminiRequest", () => {
  it("maps gateway fields to Gemini generateContent image config", () => {
    const payload = toGoogleGeminiRequest({
      mode: "text-to-image",
      model: "gemini-3.1-flash-image-preview",
      prompt: "orange cat",
      size: "16:9",
      quality: "2K",
      n: 1,
      response_format: "b64_json",
      images: [],
      extra_body: {},
    });

    expect(payload).toMatchObject({
      contents: [
        {
          role: "user",
          parts: [{ text: "orange cat" }],
        },
      ],
      generationConfig: {
        responseModalities: ["TEXT", "IMAGE"],
        imageConfig: {
          aspectRatio: "16:9",
          imageSize: "2K",
        },
      },
    });
  });

  it("maps data URL image input to inlineData", () => {
    const payload = toGoogleGeminiRequest({
      mode: "image-to-image",
      model: "gemini-3-pro-image-preview",
      prompt: "turn this into a poster",
      size: "1:1",
      quality: "1K",
      n: 1,
      response_format: "b64_json",
      image: "data:image/png;base64,AQID",
      images: [],
      extra_body: {},
    });

    expect(payload).toMatchObject({
      contents: [
        {
          parts: [
            { text: "turn this into a poster" },
            { inlineData: { mimeType: "image/png", data: "AQID" } },
          ],
        },
      ],
    });
  });

  it("rejects image sizes outside the model contract", () => {
    expect(() =>
      toGoogleGeminiRequest({
        mode: "text-to-image",
        model: "gemini-3-pro-image-preview",
        prompt: "orange cat",
        size: "1:1",
        quality: "512",
        n: 1,
        response_format: "b64_json",
        images: [],
        extra_body: {},
      }),
    ).toThrow(/does not accept imageSize '512'/);
  });
});

describe("GoogleGeminiImageProvider", () => {
  it("calls generateContent and normalizes inline image output", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    inlineData: {
                      mimeType: "image/png",
                      data: "AQID",
                    },
                  },
                ],
              },
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const provider = new GoogleGeminiImageProvider({
      apiKey: "test-key",
      baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    });
    const result = await provider.generateImage({
      mode: "text-to-image",
      model: "gemini-3.1-flash-image-preview",
      prompt: "orange cat",
      size: "1:1",
      quality: "1K",
      n: 1,
      response_format: "b64_json",
      images: [],
      extra_body: {},
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent?key=test-key",
      expect.objectContaining({ method: "POST" }),
    );
    expect(result.data[0]?.b64_json).toBe("AQID");
  });
});
