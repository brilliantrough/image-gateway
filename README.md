# image-gateway

TypeScript image-generation gateway exposing `POST /v1/images/generations` with an OpenAI-compatible+ contract.

This version supports two backend modes:

- legacy single-upstream mode using `OPENAI_API_KEY` and `OPENAI_BASE_URL`
- multi-upstream config-router mode using `UPSTREAM_CONFIG_PATH`

## Setup

```bash
npm install
cp .env.example .env
```

### Legacy single OpenAI upstream mode

Set `OPENAI_API_KEY` in `.env`, then run:

```bash
npm run dev
```

`OPENAI_API_KEY` is required only when `UPSTREAM_CONFIG_PATH` is not set.

### Multi-upstream config-router mode

In config-router mode, `OPENAI_API_KEY` is not required. The gateway loads channel credentials from the config file, and each channel uses its own `apiKey` value.

Save an exported upstream config JSON file from the frontend config center, for example:

```text
config/upstreams.json
```

Then start the backend with:

```bash
UPSTREAM_CONFIG_PATH=config/upstreams.json npm run dev
```

## Frontend Config Center

During development, run the backend and frontend in separate terminals:

```bash
npm run dev
npm run dev:ui
```

The frontend page is a single-page config center for:

- channel configuration
- model registry
- grouped priority ordering
- JSON export preview

Use the frontend to configure channels, models, and priorities, then export the upstream config JSON and save it to a file such as `config/upstreams.json` for backend use.

For a production-style build and local server startup:

```bash
npm run build
npm start
```

After build, the Fastify server serves the frontend shell at `/`.

## Routing Behavior

When `UPSTREAM_CONFIG_PATH` is set, the gateway routes requests with the configured upstream router:

- the public request `model` is matched against configured model `displayName`
- enabled models with the same `displayName` are routing candidates
- disabled channels and disabled models are skipped
- higher numeric priority wins
- the selected candidate's `providerModelName` is sent to the upstream provider
- `openai`, `azure-openai`, `volcengine-ark`, and `custom` are handled by the OpenAI-compatible image adapter in this version

## Volcengine Ark / 火山方舟

For 火山方舟 channels in the upstream config:

- set `protocolType` to `volcengine-ark`
- set `baseUrl` to the Ark data-plane endpoint, for example `https://ark.cn-beijing.volces.com/api/v3`
- put the Ark API key in the channel `apiKey` field

## Example request

```bash
curl -X POST http://localhost:3000/v1/images/generations \
  -H "content-type: application/json" \
  -d '{
    "model": "gpt-image-1",
    "prompt": "一只坐在窗边的橘猫，电影光影",
    "response_format": "b64_json"
  }'
```

In config-router mode, the public `model` above is the configured `displayName`, not necessarily the upstream provider's native model name.

## Notes

- `seed` and `negative_prompt` are accepted by the gateway protocol but rejected for provider `openai` in v1.
- `image`, `images`, and `mask` are part of the public contract and routed through the provider adapter when supported.
