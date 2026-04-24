import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OpenAICompatibleImageProvider } from "../../src/providers/openai-compatible/adapter.js";

function createClientMock() {
  return {
    images: {
      generate: vi.fn().mockResolvedValue({ data: [{ b64_json: "generated" }] }),
      edit: vi.fn().mockResolvedValue({ data: [{ b64_json: "edited" }] }),
    },
  };
}

describe("OpenAICompatibleImageProvider", () => {
  beforeEach(() => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses images.generate for text-to-image requests", async () => {
    const client = createClientMock();
    const provider = new OpenAICompatibleImageProvider(client as never, "test-openai-compatible");

    await provider.generateImage({
      mode: "text-to-image",
      model: "gpt-image-2",
      prompt: "orange cat",
      size: "1024x1024",
      n: 1,
      response_format: "b64_json",
      images: [],
      extra_body: {},
    });

    expect(client.images.generate).toHaveBeenCalledTimes(1);
    expect(client.images.edit).not.toHaveBeenCalled();
  });

  it("uses images.edit with multipart file input for image-to-image requests", async () => {
    const client = createClientMock();
    const provider = new OpenAICompatibleImageProvider(client as never, "test-openai-compatible");

    await provider.generateImage({
      mode: "image-to-image",
      model: "gpt-image-2",
      prompt: "turn this cat into cartoon style",
      size: "1024x1024",
      n: 1,
      response_format: "b64_json",
      image: "data:image/png;base64,aGVsbG8=",
      images: [],
      extra_body: {},
    });

    expect(client.images.generate).not.toHaveBeenCalled();
    expect(client.images.edit).toHaveBeenCalledTimes(1);
    expect(client.images.edit).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gpt-image-2",
        prompt: "turn this cat into cartoon style",
        image: expect.objectContaining({ name: "image.png" }),
      }),
    );
  });

  it("uses images.edit and includes mask for edit requests", async () => {
    const client = createClientMock();
    const provider = new OpenAICompatibleImageProvider(client as never, "test-openai-compatible");

    await provider.generateImage({
      mode: "edit",
      model: "gpt-image-2",
      prompt: "replace the background",
      size: "1024x1024",
      n: 1,
      response_format: "b64_json",
      image: "data:image/png;base64,aGVsbG8=",
      mask: "data:image/png;base64,aGVsbG8=",
      images: [],
      extra_body: {},
    });

    expect(client.images.edit).toHaveBeenCalledWith(
      expect.objectContaining({
        image: expect.objectContaining({ name: "image.png" }),
        mask: expect.objectContaining({ name: "mask.png" }),
      }),
    );
  });
});
