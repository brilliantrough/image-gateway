import { describe, expect, it } from "vitest";
import { buildResolvedGroups } from "../../../src/ui/lib/resolved-groups.js";

describe("buildResolvedGroups", () => {
  it("sorts duplicate display names by descending priority", () => {
    const groups = buildResolvedGroups(
      [
        {
          id: "c1",
          name: "OpenAI Main",
          protocolType: "openai",
          baseUrl: "https://api.openai.com/v1",
          apiKey: "k1",
          enabled: true,
        },
        {
          id: "c2",
          name: "Azure Backup",
          protocolType: "azure-openai",
          baseUrl: "https://example.azure.com",
          apiKey: "k2",
          enabled: true,
        },
      ],
      [
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
          providerModelName: "gpt-image-1",
          channelId: "c2",
          modelKind: "image-generation",
          enabled: true,
        },
      ],
      [
        { modelId: "m1", priority: 90 },
        { modelId: "m2", priority: 100 },
      ],
    );

    expect(groups[0]?.items.map((item) => item.channelName)).toEqual([
      "Azure Backup",
      "OpenAI Main",
    ]);
  });
});
