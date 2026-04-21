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
