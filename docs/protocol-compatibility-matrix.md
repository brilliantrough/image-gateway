# Protocol Compatibility Matrix

This document tracks how the gateway's public image API maps to each upstream protocol.

Update this file whenever a protocol, model family, endpoint mapping, or capability changes.

## Gateway Public Contract

Public endpoints:

```text
POST /v1/images/generations
POST /v1/images/edits
```

Public request mode inference:

| Gateway input | Inferred mode | Intended behavior |
|---|---|---|
| `/v1/images/generations` + `prompt` only | `text-to-image` | Generate an image from text. |
| `/v1/images/generations` + `prompt` + `image` or `images` | `image-to-image` | Backward-compatible gateway extension. |
| `/v1/images/edits` + `prompt` + `image` or `images` | `image-to-image` | OpenAI-compatible image edit entrypoint. |
| either endpoint + `prompt` + `image` or `images` + `mask` | `edit` | Edit only the masked area when the upstream supports masks. |

Important schema behavior:

| Rule | Status |
|---|---|
| `image` and `images` are mutually exclusive in the public request schema. | Enforced |
| `mask` requires either `image` or `images`. | Enforced |
| `/v1/images/edits` requires `image` or array-valued OpenAI-style `image`. | Enforced |
| `/v1/images/edits` accepts JSON and multipart form-data image uploads. | Enforced |
| Public response is normalized to `data[].url` or `data[].b64_json`. | Enforced by adapters |
| Public `model` is the configured model `displayName`; the router sends `providerModelName` upstream. | Enforced |

## Capability Legend

| Status | Meaning |
|---|---|
| Supported | Implemented and intentionally mapped by the gateway. |
| Partial | The gateway forwards fields, but behavior depends on upstream/model support or is not using the ideal provider-specific endpoint. |
| Not supported | The backend rejects it or the protocol is only a placeholder. |
| Untested | The mapping exists but there is no direct automated or manual verification yet. |

## Protocol Summary

| Gateway `protocolType` | Runtime supported | Upstream class | Best fit |
|---|---:|---|---|
| `openai` | Yes | OpenAI Images API via OpenAI SDK | Official OpenAI-compatible image generation. |
| `azure-openai` | Yes | OpenAI-compatible Images API via OpenAI SDK | Azure deployments that expose compatible image generation. |
| `aihubmix-openai` | Yes | AIHubMix OpenAI-compatible Images API via OpenAI SDK | AIHubMix `gpt-image-*` models exposed through `/v1/images/*`. |
| `custom` | Yes | OpenAI-compatible Images API via OpenAI SDK | Third-party OpenAI-compatible providers. |
| `volcengine-ark` | Yes | 火山方舟 ImageGenerations API | ByteDance / 火山方舟 Seedream and SeedEdit image models. |
| `aliyun-qwen-image` | Yes | 阿里云 DashScope native Qwen Image API | Qwen Image models using `input.messages` and `parameters`. |
| `apimart-async` | Yes | APIMart task submission + polling | APIMart async image providers such as Qwen Image and Wan 2.7 Image tasks. |
| `google-gemini` | Yes | Google Gemini native `generateContent` API | Gemini image preview models using `imageConfig`. |
| `aliyun` | No | Placeholder only | Do not use for runtime calls. |
| `tencent` | No | Placeholder only | Do not use for runtime calls. |

## Endpoint Mapping

| Gateway `protocolType` | Gateway mode | Upstream endpoint / SDK call | Upstream request shape |
|---|---|---|---|
| `openai` | `text-to-image` | `client.images.generate()` | `{ model, prompt, size, n, response_format, ... }` |
| `openai` | `image-to-image` | `client.images.edit()` / `/images/edits` | multipart `{ model, prompt, image, size, n, ... }` |
| `openai` | `edit` | `client.images.edit()` / `/images/edits` | multipart `{ model, prompt, image, mask, size, n, ... }` |
| `azure-openai` | `text-to-image` | `client.images.generate()` | OpenAI-compatible JSON request body |
| `azure-openai` | `image-to-image`, `edit` | `client.images.edit()` / `/images/edits` | OpenAI-compatible multipart edit body |
| `aihubmix-openai` | `text-to-image` | `client.images.generate()` / `/images/generations` | OpenAI-compatible JSON request body |
| `aihubmix-openai` | `image-to-image`, `edit` | `client.images.edit()` / `/images/edits` | OpenAI-compatible multipart edit body |
| `custom` | `text-to-image` | `client.images.generate()` | OpenAI-compatible JSON request body |
| `custom` | `image-to-image`, `edit` | `client.images.edit()` / `/images/edits` | OpenAI-compatible multipart edit body |
| `volcengine-ark` | all modes | `POST {baseUrl}/images/generations` | Ark ImageGenerations JSON request, with `image` always sent as an array |
| `aliyun-qwen-image` | all modes | `POST {baseUrl}/api/v1/services/aigc/multimodal-generation/generation` | `{ model, input: { messages: [...] }, parameters: {...} }` |
| `apimart-async` | all modes | `POST {baseUrl}/images/generations`, then `GET {baseUrl}/tasks/{task_id}?language=en` | Submit task, poll task result |
| `google-gemini` | `text-to-image`, `image-to-image` | `POST {baseUrl}/models/{model}:generateContent?key=...` | `{ contents, generationConfig: { responseModalities: ["TEXT", "IMAGE"], imageConfig } }` |

Current OpenAI-compatible caveat:

| Protocol | Caveat |
|---|---|
| `openai`, `azure-openai`, `aihubmix-openai`, `custom` | `text-to-image` uses `/images/generations`; `image-to-image` and `edit` use `/images/edits`. Image inputs are converted by the gateway to multipart files from `data:image/...;base64`, plain base64, or http(s) URLs. Third-party providers must implement OpenAI-compatible `/images/edits`; otherwise use a provider-native adapter. |

## Feature Support Matrix

| `protocolType` | Text-to-image | Image-to-image | Edit with mask | `seed` | `negative_prompt` | `response_format=url` | `response_format=b64_json` | Notes |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| `openai` | Supported | Supported | Supported | Not supported | Not supported | Supported | Supported | Image-to-image and masked edit use `/images/edits`. |
| `azure-openai` | Partial | Partial | Partial | Not supported | Not supported | Partial | Partial | Depends on Azure deployment/model compatibility and whether `/images/edits` is exposed. |
| `aihubmix-openai` | Supported | Supported | Supported | Not supported | Not supported | Partial | Partial | AIHubMix OpenAI-compatible Images API for `gpt-image-*`; use `baseUrl=https://aihubmix.com/v1`. |
| `custom` | Partial | Partial | Partial | Not supported | Not supported | Partial | Partial | Depends on upstream OpenAI compatibility and whether `/images/edits` is exposed. `stripResponseFormat` can be enabled for providers that reject `response_format`. |
| `volcengine-ark` | Supported | Supported | Partial | Partial | Not supported | Supported | Supported | Dedicated Ark adapter. `seed` is forwarded only for documented Seedream 3.0 t2i / SeedEdit 3.0 models. |
| `aliyun-qwen-image` | Supported | Supported | Supported | Not supported | Supported | Supported | Supported | Converts `1024x1024` to `1024*1024`; downloads image URLs when public response wants `b64_json`. |
| `apimart-async` | Supported | Supported | Partial | Via `extra_body` only | Via `extra_body` only | Supported | Supported | Submit response is async. Adapter now downloads public result URLs when the caller requests `b64_json`. |
| `google-gemini` | Supported | Supported | Not supported | Not supported | Not supported | Not supported | Supported | Native `generateContent`; image inputs currently require data URLs. |
| `aliyun` | Not supported | Not supported | Not supported | Not supported | Not supported | Not supported | Not supported | Placeholder protocol family. |
| `tencent` | Not supported | Not supported | Not supported | Not supported | Not supported | Not supported | Not supported | Placeholder protocol family. |

## Field Mapping Detail

### OpenAI-compatible path

Used by:

- `openai`
- `azure-openai`
- `aihubmix-openai`
- `custom`

Endpoint resolution:

| Request mode | SDK call / path | Notes |
|---|---|---|
| `text-to-image` | `client.images.generate()` / `/images/generations` | JSON request body. |
| `image-to-image` | `client.images.edit()` / `/images/edits` | Multipart request body with `image`. |
| `edit` | `client.images.edit()` / `/images/edits` | Multipart request body with `image` and optional `mask`. |

AIHubMix OpenAI-compatible example:

| Provider | Recommended gateway protocol | Recommended `baseUrl` | Notes |
|---|---|---|---|
| AIHubMix `gpt-image-*` through OpenAI-compatible Images API | `aihubmix-openai` | `https://aihubmix.com/v1` | Do not set `baseUrl` to a prediction endpoint. The gateway calls `/v1/images/generations` for prompt-only requests and `/v1/images/edits` for image-to-image/edit requests. |

Mapping:

| Gateway field | Upstream field | Notes |
|---|---|---|
| `model` | `model` | Router replaces public display name with `providerModelName`. |
| `prompt` | `prompt` | Direct. |
| `size` | `size` | Direct. |
| `n` | `n` | Direct. |
| `response_format` | `response_format` | Only upstream-supported for DALL-E style models. `gpt-image-*` should be treated as base64-first. Omitted when channel `stripResponseFormat` is enabled. |
| `quality` | `quality` | Direct. |
| `style` | `style` | Officially for `dall-e-3`; not a `gpt-image-*` fixed field. |
| `background` | `background` | Officially for `gpt-image-*`. |
| `output_format` | `output_format` | Officially for `gpt-image-*`. |
| `output_compression` | `output_compression` | Officially for `gpt-image-*` with `jpeg/webp`. |
| `extra_body.moderation` | `moderation` | Officially for `gpt-image-*`; the current adapter passes it via `extra_body`. |
| `user` | `user` | Direct. |
| `image` | `image` | In edit modes, converted to multipart file upload for OpenAI-compatible upstreams. Public `/v1/images/edits` accepts JSON strings, JSON string arrays, and multipart file fields. |
| `images` | `image` | In edit modes, converted to array-valued multipart file upload. |
| `mask` | `mask` | In edit mode, converted to multipart file upload. |
| `moderation` | `moderation` | Accepted for OpenAI-compatible `gpt-image-*` calls and forwarded directly. |
| `seed` | `seed` | Only forwarded when adapter option `supportsSeed` is enabled. No runtime protocol currently uses this generic path for seed. |
| `negative_prompt` | None | Rejected by this adapter path. |
| `extra_body` | merged request fields | Reserved fields cannot override routed/core fields. |

### Volcengine Ark ImageGenerations path

Used by:

- `volcengine-ark`

Endpoint resolution:

| Configured `baseUrl` | Actual endpoint |
|---|---|
| `https://ark.cn-beijing.volces.com/api/v3` | `https://ark.cn-beijing.volces.com/api/v3/images/generations` |
| full `/images/generations` endpoint | used as-is |

Mapping:

| Gateway field | Upstream field | Notes |
|---|---|---|
| `model` | `model` | Direct after router replacement. |
| `prompt` | `prompt` | Direct. |
| `image` | `image[]` | Wrapped as a one-item array. Supports URL or `data:image/<format>;base64,...` per Ark docs. |
| `images` | `image[]` | Direct array. |
| `size` | `size` | Strictly model-specific now. Seedream 5.0 accepts `2k` / `3k` / `WIDTHxHEIGHT`; Seedream 4.5 accepts `2k` / `4k` / `WIDTHxHEIGHT`; Seedream 4.0 accepts `1k` / `2k` / `4k` / `WIDTHxHEIGHT`. Ratio strings like `1:1` are rejected. |
| `n` | `sequential_image_generation_options.max_images` | Only when `n > 1` and the model supports sequential image generation. |
| `response_format` | `response_format` | Direct. |
| `seed` | `seed` | Only forwarded for `seedream-3-0-t2i` and `seededit-3-0-i2i`; omitted for Seedream 4.0/4.5/5.0. |
| `output_format` | `output_format` | Kept as a fixed control only for Seedream 5.x. |
| `extra_body.watermark` | `watermark` | Pass-through fixed field. |
| `extra_body.sequential_image_generation` | `sequential_image_generation` | Pass-through unless `n > 1` sets grouped generation. |
| `extra_body.sequential_image_generation_options` | `sequential_image_generation_options` | Pass-through unless `n > 1` sets grouped generation. |
| `extra_body.stream` | `stream` | Optional raw fallback only; not exposed as a fixed form field. |

Response mapping:

| Upstream field | Gateway field |
|---|---|
| `data[].url` | `data[].url` |
| `data[].b64_json` | `data[].b64_json` |

### Aliyun Qwen Image path

Used by:

- `aliyun-qwen-image`

Endpoint resolution:

| Configured `baseUrl` | Actual endpoint |
|---|---|
| `https://dashscope.aliyuncs.com` | `https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation` |
| `https://dashscope.aliyuncs.com/api/v1` | `https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation` |
| `https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1` | `https://token-plan.cn-beijing.maas.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation` |
| full generation endpoint | used as-is |

Mapping:

| Gateway field | Upstream field | Notes |
|---|---|---|
| `model` | `model` | Direct after router replacement. |
| `prompt` | `input.messages[0].content[].text` | Direct. |
| `image` | `input.messages[0].content[].image` | Direct. |
| `images` | multiple `content[].image` entries | Direct. |
| `mask` | `input.messages[0].content[].mask` | Direct. |
| `size` | `parameters.size` | Converts `1024x1024` / `1024X1024` to `1024*1024`. |
| `n` | `parameters.n` | Sent only when `n > 1`; omitted for default single-image calls to match Token Plan examples. |
| `negative_prompt` | `parameters.negative_prompt` | Direct. |
| `extra_body.prompt_extend` | `parameters.prompt_extend` | Fixed field, documented by Aliyun. |
| `extra_body.watermark` | `parameters.watermark` | Fixed field, documented by Aliyun. |
| `background` | `parameters.background` | Adapter supports it, but it is not exposed as a fixed UI field because it was not verified in the Qwen Image native page used for this audit. |
| `quality` | `parameters.quality` | Same note as `background`. |
| `style` | `parameters.style` | Same note as `background`. |
| `seed` | None | Rejected. |
| `user` | None | Rejected. |
| `extra_body` | merged into `parameters` | Reserved fields cannot override routed/core fields. |

Response mapping:

| Upstream field | Gateway field |
|---|---|
| `output.choices[].message.content[].image` | `data[].url` |
| image URL downloaded by gateway | `data[].b64_json` when requested |

### APIMart async path

Used by:

- `apimart-async`

Mapping:

| Gateway field | Upstream field | Notes |
|---|---|---|
| `model` | `model` | Direct after router replacement. |
| `prompt` | `prompt` | Direct. |
| `size` | `size` | Direct. |
| `extra_body.resolution` | `resolution` | APIMart Qwen Image fixed field. Filtered for Wan 2.7 Image. |
| `n` | `n` | Direct. |
| `extra_body.negative_prompt` | `negative_prompt` | APIMart Qwen Image and Wan 2.7 Image fixed field. |
| `extra_body.thinking_mode` | `thinking_mode` | APIMart Wan 2.7 Image fixed field. |
| `extra_body.enable_sequential` | `enable_sequential` | APIMart Wan 2.7 Image fixed field. |
| `extra_body.seed` | `seed` | APIMart Wan 2.7 Image fixed field. |
| `extra_body.watermark` | `watermark` | APIMart Wan 2.7 Image fixed field. |
| `extra_body.bbox_list` | `bbox_list` | APIMart Wan 2.7 Image fixed array field. |
| `extra_body.color_palette` | `color_palette` | APIMart Wan 2.7 Image fixed array field. |
| `image` | `image_urls[]` | Direct. |
| `images` | `image_urls[]` | Direct. |
| `mask` | `mask` | Direct. |
| `user` | `user` | Direct. |
| `response_format` | None | Gateway-local only. Used to decide whether result URLs should be downloaded as `b64_json`. |
| `extra_body` | merged submit fields | Reserved fields cannot override routed/core fields. Recognized APIMart model families filter unsupported fixed fields instead of mixing Qwen and Wan parameters. |

Endpoint flow:

| Step | Endpoint | Purpose |
|---|---|---|
| Submit | `POST {baseUrl}/images/generations` | Creates async image task. |
| Poll | `GET {baseUrl}/tasks/{task_id}?language=en` | Waits until task status is `completed`. |

Response mapping:

| Upstream field | Gateway field |
|---|---|
| `data.result.images[].url[]` | `data[].url` |
| image URL downloaded by gateway | `data[].b64_json` when requested |

### Google Gemini native path

Used by:

- `google-gemini`

Endpoint resolution:

| Configured `baseUrl` | Actual endpoint |
|---|---|
| `https://generativelanguage.googleapis.com/v1beta` | `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={apiKey}` |
| `https://aihubmix.com/gemini` | `https://aihubmix.com/gemini/v1beta/models/{model}:generateContent?key={apiKey}` |
| full `.../models/{model}:generateContent` endpoint | used as-is, with `key` appended |

Mapping:

| Gateway field | Upstream field | Notes |
|---|---|---|
| `model` | URL path model | `models/` prefix is stripped if present. |
| `prompt` | `contents[0].parts[].text` | Direct. |
| `image` / `images` | `contents[0].parts[].inlineData` | Data URL inputs only in this adapter. |
| `size` | `generationConfig.imageConfig.aspectRatio` | Fixed select in Invocation Studio. |
| `quality` | `generationConfig.imageConfig.imageSize` | `512` only for Flash Image; `1K/2K/4K` for Flash and Pro. |
| fixed generation config | `generationConfig.responseModalities` | Uses `["TEXT", "IMAGE"]`, matching Gemini image generation examples. |
| `response_format` | None | Gateway-local. Gemini returns inline image data, so public response is `b64_json`. |
| `extra_body` | merged top-level fields | Reserved fields cannot override `contents` or `generationConfig`. |

Response mapping:

| Upstream field | Gateway field |
|---|---|
| `candidates[].content.parts[].inlineData.data` | `data[].b64_json` |

## Model Family Notes

| Model family | Recommended `protocolType` | Notes |
|---|---|---|
| OpenAI `gpt-image-*` | `openai` | Use official OpenAI base URL. Edit support needs adapter improvement. |
| ByteDance / 火山方舟 Seedream | `volcengine-ark` | Use Ark base URL such as `https://ark.cn-beijing.volces.com/api/v3`. |
| ByteDance / 火山方舟 SeedEdit | `volcengine-ark` | Use `image` and optionally `mask`; actual behavior depends on selected SeedEdit model. |
| Aliyun Qwen Image | `aliyun-qwen-image` | Do not use placeholder `aliyun`. |
| APIMart Qwen Image async | `apimart-async` | Use provider async endpoint and task polling. |
| APIMart Wan 2.7 Image async | `apimart-async` | Same async transport as Qwen, but model-specific parameters differ. |
| Google Gemini image preview | `google-gemini` | Use base URL `https://generativelanguage.googleapis.com/v1beta`; for AIHubMix use `https://aihubmix.com/gemini`. The gateway appends the version and `/models/{model}:generateContent` when needed. |

Seedream test-bench note:

| Protocol | Test default | Reason |
|---|---|---|
| `volcengine-ark` | `size=2k`, `response_format=url`, `extra_body={"watermark":false,"stream":false}` | Seedream 4.5/5 reject undersized pixel values like `1024x1024`. For Seedream 5.0, `size` also rejects `4k` and ratio strings such as `1:1`. |

## Maintenance Checklist

When adding or changing a protocol/model family:

1. Update `Protocol Summary`.
2. Update `Endpoint Mapping`.
3. Update `Feature Support Matrix`.
4. Update the relevant `Field Mapping Detail` section or add a new one.
5. Add or update `Model Family Notes`.
6. Add tests proving the mapping if behavior changed.
