import type { GatewayUpstreamConfig } from "../types/config.js";

export const LOCAL_CONFIG_PACK_KEY = "image-gateway.config-pack";

export function readStoredConfigPack(): GatewayUpstreamConfig | null {
  const json = readStoredConfigPackJson();
  if (!json) {
    return null;
  }

  try {
    const parsed = JSON.parse(json) as unknown;
    if (!isGatewayUpstreamConfig(parsed)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function readStoredConfigPackJson(): string {
  if (typeof globalThis.localStorage === "undefined") {
    return "";
  }

  return globalThis.localStorage.getItem(LOCAL_CONFIG_PACK_KEY) ?? "";
}

export function writeStoredConfigPackJson(json: string) {
  if (typeof globalThis.localStorage === "undefined") {
    return;
  }

  globalThis.localStorage.setItem(LOCAL_CONFIG_PACK_KEY, json);
}

export function writeStoredConfigPack(config: GatewayUpstreamConfig) {
  writeStoredConfigPackJson(JSON.stringify(config, null, 2));
}

function isGatewayUpstreamConfig(value: unknown): value is GatewayUpstreamConfig {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<GatewayUpstreamConfig>;
  return (
    candidate.version === 1 &&
    Array.isArray(candidate.channels) &&
    Array.isArray(candidate.models) &&
    Array.isArray(candidate.priorities)
  );
}
