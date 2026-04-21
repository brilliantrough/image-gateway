import { describe, expect, it } from "vitest";
import {
  imageGenerationDataSchema,
  imageGenerationRequestSchema,
  imageGenerationResponseSchema,
} from "../../src/schemas/image-generation.js";
import { inferImageRequestMode } from "../../src/services/image-generation-service.js";

describe("inferImageRequestMode", () => {
  it("classifies text-to-image requests", () => {
    const parsed = imageGenerationRequestSchema.parse({
      model: "gpt-image-1",
      prompt: "orange cat",
    });

    expect(inferImageRequestMode(parsed)).toBe("text-to-image");
  });

  it("classifies image-to-image requests", () => {
    const parsed = imageGenerationRequestSchema.parse({
      model: "gpt-image-1",
      prompt: "make this cinematic",
      image: "https://example.com/image.png",
    });

    expect(inferImageRequestMode(parsed)).toBe("image-to-image");
  });

  it("classifies edit requests when mask is present", () => {
    const parsed = imageGenerationRequestSchema.parse({
      model: "gpt-image-1",
      prompt: "replace the sky",
      image: "https://example.com/image.png",
      mask: "https://example.com/mask.png",
    });

    expect(inferImageRequestMode(parsed)).toBe("edit");
  });

  it("rejects requests that provide both image and images", () => {
    expect(() =>
      imageGenerationRequestSchema.parse({
        model: "gpt-image-1",
        prompt: "orange cat",
        image: "https://example.com/image.png",
        images: ["https://example.com/image-2.png"],
      }),
    ).toThrow(/either 'image' or 'images'/i);
  });

  it("rejects mask-only edit requests without input images", () => {
    expect(() =>
      imageGenerationRequestSchema.parse({
        model: "gpt-image-1",
        prompt: "replace the sky",
        mask: "https://example.com/mask.png",
      }),
    ).toThrow(/mask requires 'image' or 'images'/i);
  });

  it("rejects image results without a payload", () => {
    expect(() =>
      imageGenerationDataSchema.parse({
        b64_json: null,
        url: null,
        mime_type: "image/png",
        revised_prompt: null,
      }),
    ).toThrow(/must include either 'b64_json' or 'url'/i);
  });

  it("rejects unknown top-level request fields", () => {
    expect(() =>
      imageGenerationRequestSchema.parse({
        model: "gpt-image-1",
        prompt: "orange cat",
        foo: "bar",
      }),
    ).toThrow(/unrecognized key/i);
  });

  it("requires request_id and usage.image_count in responses", () => {
    expect(() =>
      imageGenerationResponseSchema.parse({
        created: 1,
        data: [
          {
            b64_json: "abc",
            url: null,
            mime_type: "image/png",
            revised_prompt: null,
          },
        ],
        usage: {},
      }),
    ).toThrow();
  });
});
