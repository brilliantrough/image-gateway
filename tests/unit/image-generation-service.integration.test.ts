import { describe, expect, it, vi } from "vitest";
import { createImageGenerationService } from "../../src/services/image-generation-service.js";

describe("createImageGenerationService", () => {
  it("forwards normalized requests to the provider", async () => {
    const provider = {
      generateImage: vi.fn().mockResolvedValue({
        created: 1,
        data: [{ b64_json: "abc", url: null, mime_type: "image/png", revised_prompt: null }],
        usage: { image_count: 1 },
        request_id: "req_test",
      }),
    };

    const service = createImageGenerationService(provider);

    const result = await service.generate({
      model: "gpt-image-1",
      prompt: "orange cat",
      images: [],
      extra_body: {},
    });

    expect(provider.generateImage).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "text-to-image", prompt: "orange cat" }),
    );
    expect(result.request_id).toBe("req_test");
  });
});
