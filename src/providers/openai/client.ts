import OpenAI from "openai";
import type { AppEnv } from "../../config/env.js";

export function createOpenAIClient(env: AppEnv): OpenAI {
  return new OpenAI({
    apiKey: env.OPENAI_API_KEY,
    baseURL: env.OPENAI_BASE_URL,
    timeout: env.UPSTREAM_REQUEST_TIMEOUT_MS,
  });
}
