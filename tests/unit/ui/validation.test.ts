import { describe, expect, it } from "vitest";
import { validateConfig } from "../../../src/ui/lib/validation.js";

describe("validateConfig", () => {
  it("flags duplicate priorities", () => {
    const result = validateConfig({
      version: 1,
      channels: [
        {
          id: "c1",
          name: "OpenAI Main",
          protocolType: "openai",
          baseUrl: "https://api.openai.com/v1",
          apiKey: "k1",
          enabled: true,
        },
      ],
      models: [
        {
          id: "m1",
          displayName: "gpt-image-1",
          providerModelName: "gpt-image-1",
          channelId: "c1",
          modelKind: "image-generation",
          enabled: true,
        },
        {
          id: "m2",
          displayName: "gpt-image-1",
          providerModelName: "gpt-image-1-alt",
          channelId: "c1",
          modelKind: "image-generation",
          enabled: true,
        },
      ],
      priorities: [
        { modelId: "m1", priority: 100 },
        { modelId: "m2", priority: 100 },
      ],
    });

    expect(result.globalErrors).toContainEqual(expect.stringContaining("Duplicate priority"));
  });
});
