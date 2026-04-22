import type { GatewayUpstreamConfig } from "../config/upstream-config.js";
import type { ImageProvider } from "../providers/types.js";

export type RuntimeConfigManager = {
  getProvider(): ImageProvider;
  getConfig(): GatewayUpstreamConfig | null;
  getConfigPath(): string | null;
  replace(next: {
    provider: ImageProvider;
    config: GatewayUpstreamConfig | null;
  }): void;
};

export function createRuntimeConfigManager(input: {
  provider: ImageProvider;
  config: GatewayUpstreamConfig | null;
  configPath: string | null;
}): RuntimeConfigManager {
  let provider = input.provider;
  let config = input.config;
  const configPath = input.configPath;

  return {
    getProvider() {
      return provider;
    },
    getConfig() {
      return config;
    },
    getConfigPath() {
      return configPath;
    },
    replace(next) {
      provider = next.provider;
      config = next.config;
    },
  };
}
