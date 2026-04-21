import { describe, expect, it } from "vitest";
import { imageGenerationRequestSchema } from "../../src/schemas/image-generation.js";
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
});
