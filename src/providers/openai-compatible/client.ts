import OpenAI from "openai";
import type { ChannelConfig } from "../../config/upstream-config.js";

export function createOpenAICompatibleClient(
  channel: Pick<ChannelConfig, "apiKey" | "baseUrl">,
): OpenAI {
  return new OpenAI({
    apiKey: channel.apiKey,
    baseURL: channel.baseUrl,
  });
}
