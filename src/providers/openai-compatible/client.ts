import OpenAI from "openai";
import type { ChannelConfig } from "../../config/upstream-config.js";

export function createOpenAICompatibleClient(
  channel: Pick<ChannelConfig, "apiKey" | "baseUrl">,
): OpenAI {
  return new OpenAI({
    apiKey: channel.apiKey,
    baseURL: channel.baseUrl,
    timeout: getUpstreamRequestTimeoutMs(),
  });
}

function getUpstreamRequestTimeoutMs(): number {
  const raw = process.env.UPSTREAM_REQUEST_TIMEOUT_MS;
  const parsed = raw ? Number(raw) : 1_800_000;

  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1_800_000;
}
