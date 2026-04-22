import { buildApp } from "./app.js";
import { loadEnv } from "./config/env.js";
import { loadUpstreamConfigFile } from "./config/upstream-config.js";
import { OpenAIImageProvider } from "./providers/openai/adapter.js";
import { createOpenAIClient } from "./providers/openai/client.js";
import { ConfiguredUpstreamRouter } from "./providers/router/upstream-router.js";

const env = loadEnv();
const provider = env.UPSTREAM_CONFIG_PATH
  ? new ConfiguredUpstreamRouter(await loadUpstreamConfigFile(env.UPSTREAM_CONFIG_PATH))
  : new OpenAIImageProvider(createOpenAIClient(env));
const app = buildApp({ provider });

await app.listen({ host: env.HOST, port: env.PORT });
