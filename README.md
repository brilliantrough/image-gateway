# image-gateway

TypeScript image-generation gateway exposing `POST /v1/images/generations` with an OpenAI-compatible+ contract and an OpenAI upstream provider.

## Setup

```bash
npm install
cp .env.example .env
```

Fill `OPENAI_API_KEY` in `.env`.

## Run

```bash
npm run dev
```

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

## Notes

- `seed` and `negative_prompt` are accepted by the gateway protocol but rejected for provider `openai` in v1.
- `image`, `images`, and `mask` are part of the public contract and routed through the provider adapter when supported.
