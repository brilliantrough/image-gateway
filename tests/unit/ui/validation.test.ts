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

  it("flags missing model references and duplicate model priority entries", () => {
    const result = validateConfig({
      version: 1,
      channels: [
        {
          id: "c1",
          name: "OpenAI Main",
          protocolType: "openai",
          baseUrl: "",
          apiKey: "",
          enabled: false,
        },
      ],
      models: [
        {
          id: "m1",
          displayName: "  gpt-image-1  ",
          providerModelName: "gpt-image-1",
          channelId: "c1",
          modelKind: "image-generation",
          enabled: true,
        },
      ],
      priorities: [
        { modelId: "m1", priority: 100 },
        { modelId: "m1", priority: 90 },
        { modelId: "missing-model", priority: 80 },
      ],
    });

    expect(result.sectionErrors).toContainEqual(
      expect.stringContaining("more than one priority entry"),
    );
    expect(result.sectionErrors).toContainEqual(
      expect.stringContaining("Priority references missing model"),
    );
    expect(result.fieldErrors).toHaveLength(0);
  });
});
