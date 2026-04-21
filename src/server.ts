import { buildApp } from "./app.js";
import { loadEnv } from "./config/env.js";
import { OpenAIImageProvider } from "./providers/openai/adapter.js";
import { createOpenAIClient } from "./providers/openai/client.js";

const env = loadEnv();
const client = createOpenAIClient(env);
const provider = new OpenAIImageProvider(client);
const app = buildApp({ provider });

await app.listen({
  host: env.HOST,
  port: env.PORT,
});
