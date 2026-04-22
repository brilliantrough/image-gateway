import { describe, expect, it } from "vitest";
import { GatewayError } from "../../src/lib/errors.js";
import { toOpenAIRequest } from "../../src/providers/openai/mapper.js";

describe("toOpenAIRequest", () => {
  it("maps supported text generation fields", () => {
    const result = toOpenAIRequest({
      mode: "text-to-image",
      model: "gpt-image-1",
      prompt: "orange cat",
      size: "1024x1024",
      n: 1,
      response_format: "b64_json",
      images: [],
      extra_body: {},
    });

    expect(result).toMatchObject({
      model: "gpt-image-1",
      prompt: "orange cat",
      size: "1024x1024",
      n: 1,
    });
  });

  it("does not allow extra_body.model to override the routed model", () => {
    const result = toOpenAIRequest({
      mode: "text-to-image",
      model: "routed-model",
      prompt: "orange cat",
      size: "1024x1024",
      n: 1,
      response_format: "b64_json",
      images: [],
      extra_body: {
        model: "attacker-model",
      },
    });

    expect(result.model).toBe("routed-model");
  });

  it("forwards response_format", () => {
    const result = toOpenAIRequest({
      mode: "text-to-image",
      model: "gpt-image-1",
      prompt: "orange cat",
      size: "1024x1024",
      n: 1,
      response_format: "url",
      images: [],
      extra_body: {},
    });

    expect(result.response_format).toBe("url");
  });

  it("ignores reserved extra_body image fields", () => {
    const result = toOpenAIRequest({
      mode: "text-to-image",
      model: "gpt-image-1",
      prompt: "orange cat",
      images: [],
      extra_body: {
        image: "bypass-image",
        images: ["bypass-images"],
        mask: "bypass-mask",
      },
    });

    expect(result.image).toBeUndefined();
    expect(result.images).toBeUndefined();
    expect(result.mask).toBeUndefined();
  });

  it("rejects unsupported seed parameter", () => {
    expect(() =>
      toOpenAIRequest({
        mode: "text-to-image",
        model: "gpt-image-1",
        prompt: "orange cat",
        size: "1024x1024",
        n: 1,
        response_format: "b64_json",
        seed: 1,
        images: [],
        extra_body: {},
      }),
    ).toThrowError(GatewayError);
  });
});
