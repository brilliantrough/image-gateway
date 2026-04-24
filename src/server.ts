import { buildApp } from "./app.js";
import { loadEnv } from "./config/env.js";
import { loadUpstreamConfigFile } from "./config/upstream-config.js";
import { OpenAIImageProvider } from "./providers/openai/adapter.js";
import { createOpenAIClient } from "./providers/openai/client.js";
import { ConfiguredUpstreamRouter } from "./providers/router/upstream-router.js";
import { createRuntimeConfigManager } from "./runtime/config-manager.js";

const env = loadEnv();
const initialConfig = env.UPSTREAM_CONFIG_PATH
  ? await loadUpstreamConfigFile(env.UPSTREAM_CONFIG_PATH)
  : null;
const provider = initialConfig
  ? new ConfiguredUpstreamRouter(initialConfig)
  : new OpenAIImageProvider(createOpenAIClient(env));
const runtimeConfigManager = createRuntimeConfigManager({
  provider,
  config: initialConfig,
  configPath: env.UPSTREAM_CONFIG_PATH ?? null,
});
const app = buildApp({
  provider,
  runtimeConfigManager,
  adminAuth: {
    apiToken: env.ADMIN_API_TOKEN ?? null,
    username: env.ADMIN_USERNAME,
    password: env.ADMIN_PASSWORD ?? null,
    sessionSecret: env.ADMIN_SESSION_SECRET ?? null,
  },
});

await app.listen({ host: env.HOST, port: env.PORT });
