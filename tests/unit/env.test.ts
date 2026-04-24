import { describe, expect, it } from "vitest";
import { loadEnv } from "../../src/config/env.js";

describe("loadEnv", () => {
  it("accepts UPSTREAM_CONFIG_PATH without OPENAI_API_KEY", () => {
    const env = loadEnv({
      UPSTREAM_CONFIG_PATH: "config/upstreams.json",
    });

    expect(env.UPSTREAM_CONFIG_PATH).toBe("config/upstreams.json");
  });

  it("rejects missing OPENAI_API_KEY when UPSTREAM_CONFIG_PATH is absent", () => {
    expect(() =>
      loadEnv({
        HOST: "127.0.0.1",
      }),
    ).toThrow(/OPENAI_API_KEY/i);
  });

  it("accepts OPENAI_API_KEY without UPSTREAM_CONFIG_PATH in legacy mode", () => {
    const env = loadEnv({
      OPENAI_API_KEY: "test-openai-key",
    });

    expect(env.OPENAI_API_KEY).toBe("test-openai-key");
    expect(env.UPSTREAM_CONFIG_PATH).toBeUndefined();
  });

  it("accepts ADMIN_API_TOKEN when present", () => {
    const env = loadEnv({
      OPENAI_API_KEY: "test-openai-key",
      ADMIN_API_TOKEN: "admin-secret",
    });

    expect(env.ADMIN_API_TOKEN).toBe("admin-secret");
  });
});
