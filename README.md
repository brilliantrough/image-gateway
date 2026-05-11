# image-gateway

TypeScript image-generation gateway exposing OpenAI-compatible image endpoints with an OpenAI-compatible+ contract:

- `POST /v1/images/generations`
- `POST /v1/images/edits`

This version supports two backend modes:

- legacy single-upstream mode using `OPENAI_API_KEY` and `OPENAI_BASE_URL`
- multi-upstream config-router mode using `UPSTREAM_CONFIG_PATH`

## Setup

```bash
npm install
cp .env.example .env
cp config/upstreams.example.json config/upstreams.json
```

`.env.example` is only a template. The server reads `process.env`; it does not automatically load `.env`.
Export or source the values before running the app, for example:

```bash
set -a
source .env
set +a
npm run dev
```

### Legacy single OpenAI upstream mode

Set `OPENAI_API_KEY` in your environment, then run:

```bash
npm run dev
```

`OPENAI_API_KEY` is required only when `UPSTREAM_CONFIG_PATH` is not set.

### Multi-upstream config-router mode

In config-router mode, `OPENAI_API_KEY` is not required. The gateway loads channel credentials from the config file, and each channel uses its own `apiKey` value.

Start from the sanitized example config and edit it with your own upstream keys:

```bash
cp config/upstreams.example.json config/upstreams.json
```

The real `config/upstreams.json` is ignored by git because it may contain API keys. Keep `config/upstreams.example.json` safe for public sharing.

Then start the backend with:

```bash
UPSTREAM_CONFIG_PATH=config/upstreams.json npm run dev
```

## Frontend Config Center

During development, run the backend and frontend in separate terminals:

```bash
UPSTREAM_CONFIG_PATH=config/upstreams.json npm run dev
npm run dev:ui
```

The backend port can be changed with `PORT`:

```bash
PORT=3100 UPSTREAM_CONFIG_PATH=config/upstreams.json npm run dev
```

The frontend dev server port can be changed with Vite flags:

```bash
npm run dev:ui -- --host 0.0.0.0 --port 5174
```

The Vite dev server proxies `/v1/*` requests to `VITE_API_TARGET`, defaulting to `http://localhost:3000`. If the backend is not on port `3000`, set the proxy target when starting the frontend:

```bash
VITE_API_TARGET=http://localhost:3100 npm run dev:ui -- --host 0.0.0.0 --port 5174
```

Restart `npm run dev:ui` after changing `VITE_API_TARGET`.

Public dev URL:

```text
http://localhost:5173/
```

Admin dev URL:

```text
http://localhost:5173/?admin=1
```

The frontend page is a single-page config center for:

- channel configuration
- model registry
- grouped priority ordering
- provider test bench
- JSON export preview

Use the frontend to configure channels, models, and priorities, then export the upstream config JSON and save it to a file such as `config/upstreams.json` for backend use.

When the backend is started with `UPSTREAM_CONFIG_PATH`, the frontend also loads the active config from:

```text
GET /v1/config/upstreams
```

Clicking `Save Config` writes the edited config through:

```text
POST /v1/config/upstreams
```

The backend validates the full config, writes it to `UPSTREAM_CONFIG_PATH`, and switches routing to the new config immediately. A restart is not required. If validation or file persistence fails, the old in-memory routing config remains active.

### Provider Compatibility Toggle

Each channel can enable `stripResponseFormat`.

Use this when an upstream claims OpenAI compatibility but rejects the `response_format` request field on image generation. When enabled, the gateway will omit `response_format` when forwarding image requests to that channel.

### Provider Test Bench

The frontend includes a draft-safe provider test bench:

- choose a specific provider channel
- choose a specific provider model
- enter a custom prompt
- test the current unsaved draft config directly against that provider model
- preview the generated image in the browser

This is intended for checking compatibility toggles such as `stripResponseFormat` before saving the config.

### AIHubMix OpenAI-Compatible Image Models

For AIHubMix `gpt-image-*` models through its OpenAI-compatible Images API, configure the channel as an OpenAI-compatible upstream:

```json
{
  "protocolType": "aihubmix-openai",
  "baseUrl": "https://aihubmix.com/v1",
  "apiKey": "replace-with-aihubmix-api-key"
}
```

Use `providerModelName` for the upstream model name, for example `gpt-image-2`.

The gateway maps prompt-only requests to `/v1/images/generations`. Requests with `image`, `images`, or `mask` are mapped to `/v1/images/edits` and sent as multipart file uploads. Browser uploads are accepted as `data:image/...;base64`; http(s) image URLs are fetched by the gateway before forwarding.

Do not configure the channel `baseUrl` as an AIHubMix prediction endpoint when using the OpenAI-compatible protocol. Prediction-style APIs need a provider-native adapter instead of `aihubmix-openai`.

Image-to-image and edit calls can take much longer than prompt-only generation. If the browser reports a plain `Request failed with status 504`, check whether the response came from a dev proxy or reverse proxy before changing model parameters. For local one-port deployment, inspect backend logs with:

```bash
bash deploy/local-3100.sh logs
```

The backend logs OpenAI-compatible upstream request start, success, failure, mode, model, and duration. If no upstream request log appears, the request probably did not reach this backend instance.

### image2chat Upstream Setup

`image2chat` can use this gateway as its upstream OpenAI Images API when you only need official OpenAI Image Generation models routed through `image-gateway`.

Run `image-gateway` on one port, for example `3100`, then configure `image2chat` with:

```bash
OPENAI_BASE_URL=http://127.0.0.1:3100/v1
OPENAI_API_KEY=not-used-by-gateway-but-required-by-image2chat
IMAGES_API_MODE=native
```

`image2chat` will call `/v1/images/generations` for text-to-image and `/v1/images/edits` for image-to-image / iterative chat refinement. The gateway maps those requests to the configured upstream provider and normalizes the response.

For `/v1/images/edits`, both JSON and multipart form-data are accepted. Multipart uploads from `image2chat` are converted to internal `data:image/...;base64` inputs before routing to the configured upstream. The OpenAI `moderation` field is accepted and forwarded for OpenAI-compatible upstreams.

For a production-style build and local server startup:

```bash
npm run build
npm start
```

After build, the Fastify server serves the frontend shell at `/`.

Public production URL:

```text
http://localhost:3000/
```

Admin production URL:

```text
http://localhost:3000/?admin=1
```

### One-Port Local Deployment

For a local deployment on port `3100`, use the included helper script:

```bash
npm install
cp config/upstreams.example.json config/upstreams.json
mkdir -p .local
cp deploy/local-3100.env.example .local/image-gateway-3100.env
bash deploy/local-3100.sh restart
```

Then open:

```text
http://127.0.0.1:3100/
http://127.0.0.1:3100/?admin=1
```

The helper builds the app, starts the single Fastify process, and writes logs to `.local/image-gateway-3100.log`. Use `bash deploy/local-3100.sh logs`, `status`, `restart`, or `stop` for operation.

## Admin Authentication

Private config routes and the admin UI can be protected with environment variables:

```bash
ADMIN_USERNAME=admin
ADMIN_PASSWORD=replace-with-your-password
ADMIN_SESSION_SECRET=replace-with-a-long-random-secret
```

Optional API-token access for private routes:

```bash
ADMIN_API_TOKEN=replace-with-a-long-random-token
```

Private config routes accept any of:

- signed admin session cookie
- `Authorization: Bearer <ADMIN_API_TOKEN>`
- `x-admin-token: <ADMIN_API_TOKEN>`

If neither `ADMIN_PASSWORD` nor `ADMIN_API_TOKEN` is set, config routes are not protected. That is acceptable for local prototyping only.

## Routing Behavior

When `UPSTREAM_CONFIG_PATH` is set, the gateway routes requests with the configured upstream router:

- the public request `model` is matched against configured model `displayName`
- enabled models with the same `displayName` are routing candidates
- disabled channels and disabled models are skipped
- higher numeric priority wins
- missing priority defaults to `0`
- duplicate explicit priority numbers in `priorities` are invalid globally at config load
- the selected candidate's `providerModelName` is sent to the upstream provider
- backend-supported protocol types are `openai`, `azure-openai`, `aliyun-qwen-image`, `volcengine-ark`, `apimart-async`, `google-gemini`, `aihubmix-openai`, and `custom`
- the frontend/schema may still expose placeholder protocol families such as `aliyun` and `tencent`, but the backend router returns `unsupported_protocol` for them until native adapters are added

For the detailed protocol-to-upstream endpoint mapping and feature support status, see:

```text
docs/protocol-compatibility-matrix.md
```

## 阿里云 Qwen Image

For 阿里云 `qwen-image-*` channels in the upstream config:

- set `protocolType` to `aliyun-qwen-image`
- set `baseUrl` to either:
  - `https://dashscope.aliyuncs.com`
  - `https://dashscope.aliyuncs.com/api/v1`
  - or the full endpoint `https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation`
  - for Token Plan, `https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1` is accepted and rewritten to the image endpoint automatically
- put the 阿里云 / 百炼 API key in the channel `apiKey` field

This protocol is not OpenAI Images API compatible. The gateway maps requests to Aliyun's `model + input.messages + parameters` format and parses images from `output.choices[].message.content[].image`.

The gateway also converts public request sizes like `1024x1024` into Aliyun's `1024*1024` format automatically.

## APIMart Async

For APIMart async image channels in the upstream config:

- set `protocolType` to `apimart-async`
- set `baseUrl` to the APIMart async API root, for example `https://api.apimart.example/v1`
- put the APIMart API key in the channel `apiKey` field

This path submits `POST /images/generations`, polls `GET /tasks/{task_id}?language=en`, and now supports both:

- `response_format=url`: returns upstream image URLs directly
- `response_format=b64_json`: downloads the returned URLs and converts them into base64 payloads

Reserved gateway fields such as `model`, `prompt`, `size`, `n`, `image`, `images`, `mask`, and `user` cannot be overridden through `extra_body`.

## Google Gemini Image

For Google Gemini image channels in the upstream config:

- set `protocolType` to `google-gemini`
- set `baseUrl` to either a Google-compatible Gemini API root, or an AIHubMix Gemini root such as `https://aihubmix.com/gemini`
- put the Gemini-compatible API key in the channel `apiKey` field

The adapter calls Gemini `generateContent`, sends image generation through `generationConfig.responseModalities = ["TEXT", "IMAGE"]`, and reads inline image data from the returned parts. AIHubMix `/gemini` roots are normalized to `/gemini/v1beta` automatically.

Example model names include:

- `gemini-3.1-flash-image-preview`
- `gemini-3-pro-image-preview`

## Volcengine Ark / 火山方舟

For 火山方舟 channels in the upstream config:

- set `protocolType` to `volcengine-ark`
- set `baseUrl` to the Ark data-plane endpoint, for example `https://ark.cn-beijing.volces.com/api/v3`
- put the Ark API key in the channel `apiKey` field

This path is the recommended protocol for ByteDance / 火山方舟 Seed 系列图片模型. Based on the official 火山方舟图片生成 API and Seedream / SeedEdit tutorials updated on April 1-2, 2026, Seed 系列模型 uses the Ark image generation API rather than a separate vendor-native gateway contract.

Example model names include:

- `doubao-seedream-5-0-lite-260128`
- `doubao-seedream-4-5-250828`
- `doubao-seedream-4-0-250828`
- `doubao-seedream-3-0-t2i-250415`
- `doubao-seededit-3-0-i2i-250628`

Other Ark-specific image parameters such as `watermark`, `guidance_scale`, and `sequential_image_generation` can be passed through `extra_body`.

Implementation note: `volcengine-ark` uses a dedicated Ark ImageGenerations adapter. It posts JSON to `{baseUrl}/images/generations`, sends image inputs as `image[]`, and only forwards `seed` for the documented Seedream 3.0 t2i / SeedEdit 3.0 models. For Seedream 4.0/4.5/5.0, `seed` is omitted to avoid upstream `InvalidParameter` errors.

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

- `negative_prompt` is accepted by the gateway protocol but rejected by the OpenAI-compatible adapter path in v1 unless a provider-specific adapter supports it.
- `seed` is supported only for documented `volcengine-ark` Seedream 3.0 t2i / SeedEdit 3.0 models and rejected or omitted elsewhere.
- `image`, `images`, and `mask` are part of the public contract and routed through the provider adapter when supported.

## Deployment

For deployment env vars, reverse proxy examples, admin login setup, and a `systemd` service example, see:

```text
docs/deployment.md
```

Ready-to-edit deployment templates are included in:

```text
deploy/
```

## Open Source Hygiene

Before publishing or pushing a public branch, run:

```bash
npm run check:release
```

The check fails if local-only files such as `config/upstreams.json`, `knowledge.md`, `.local/`, `.agents/`, `.superpowers/`, or `docs/superpowers/` are tracked, and it scans tracked files for common secret-like API key patterns.

The repository intentionally includes sanitized templates only:

- `.env.example`
- `config/upstreams.example.json`
- `deploy/*.example`

Do not commit real upstream configs, API keys, local prompt research notes, runtime logs, pid files, or agent planning artifacts.
