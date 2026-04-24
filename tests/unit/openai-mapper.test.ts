import { describe, expect, it } from "vitest";
import { GatewayError } from "../../src/lib/errors.js";
import { toOpenAIEditRequest, toOpenAIRequest } from "../../src/providers/openai/mapper.js";

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

  it("can omit response_format for non-standard upstreams", () => {
    const result = toOpenAIRequest(
      {
        mode: "text-to-image",
        model: "gpt-image-1",
        prompt: "orange cat",
        size: "1024x1024",
        n: 1,
        response_format: "b64_json",
        images: [],
        extra_body: {},
      },
      "openai",
      { stripResponseFormat: true },
    );

    expect(result.response_format).toBeUndefined();
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

  it("ignores seed and negative_prompt in extra_body", () => {
    const result = toOpenAIRequest({
      mode: "text-to-image",
      model: "gpt-image-1",
      prompt: "orange cat",
      images: [],
      extra_body: {
        seed: 123,
        negative_prompt: "bad",
      },
    });

    expect(result.seed).toBeUndefined();
    expect(result.negative_prompt).toBeUndefined();
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

  it("maps image-to-image requests to edit payload shape", () => {
    const result = toOpenAIEditRequest({
      mode: "image-to-image",
      model: "gpt-image-2",
      prompt: "turn this cat into cartoon style",
      size: "1024x1024",
      n: 1,
      response_format: "b64_json",
      image: "data:image/png;base64,abc",
      images: [],
      extra_body: {},
    });

    expect(result).toMatchObject({
      model: "gpt-image-2",
      prompt: "turn this cat into cartoon style",
      image: "data:image/png;base64,abc",
    });
  });

  it("maps multi-image edit requests to array-valued image", () => {
    const result = toOpenAIEditRequest({
      mode: "edit",
      model: "gpt-image-2",
      prompt: "combine the references",
      size: "1024x1024",
      n: 1,
      response_format: "b64_json",
      images: ["data:image/png;base64,aaa", "data:image/png;base64,bbb"],
      mask: "data:image/png;base64,ccc",
      extra_body: {},
    });

    expect(result.image).toEqual(["data:image/png;base64,aaa", "data:image/png;base64,bbb"]);
    expect(result.mask).toBe("data:image/png;base64,ccc");
  });

  it("rejects edit payloads without image input", () => {
    expect(() =>
      toOpenAIEditRequest({
        mode: "edit",
        model: "gpt-image-2",
        prompt: "edit this",
        size: "1024x1024",
        n: 1,
        response_format: "b64_json",
        images: [],
        extra_body: {},
      }),
    ).toThrowError(GatewayError);
  });

});
