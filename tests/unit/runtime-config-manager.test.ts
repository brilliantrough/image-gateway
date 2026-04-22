import { describe, expect, it, vi } from "vitest";
import { createRuntimeConfigManager } from "../../src/runtime/config-manager.js";

describe("runtime config manager", () => {
  it("returns the currently active provider", () => {
    const provider = { generateImage: vi.fn() };
    const manager = createRuntimeConfigManager({
      provider,
      config: null,
      configPath: "config/upstreams.json",
    });

    expect(manager.getProvider()).toBe(provider);
  });

  it("swaps provider and config atomically in memory", () => {
    const providerA = { generateImage: vi.fn() };
    const providerB = { generateImage: vi.fn() };
    const manager = createRuntimeConfigManager({
      provider: providerA,
      config: null,
      configPath: "config/upstreams.json",
    });

    manager.replace({
      provider: providerB,
      config: {
        version: 1,
        channels: [],
        models: [],
        priorities: [],
      },
    });

    expect(manager.getProvider()).toBe(providerB);
    expect(manager.getConfig()).toEqual({
      version: 1,
      channels: [],
      models: [],
      priorities: [],
    });
  });
});
