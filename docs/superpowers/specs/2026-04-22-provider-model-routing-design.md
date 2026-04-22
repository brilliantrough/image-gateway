# Provider Model Routing Design

## Overview

This spec updates the image gateway configuration center and backend routing so upstream providers are not only exported by the frontend, but also used by the backend at runtime.

The work has two user-facing goals:

- Reduce model setup friction by letting users add many models directly inside a provider card.
- Route `POST /v1/images/generations` to the configured upstream provider/model with strict priority ordering.

## Frontend Design

The provider card becomes the primary place to manage models for that provider.

Each provider card keeps the existing channel fields:

- provider/channel name
- protocol
- base URL
- API key
- enabled state
- optional custom protocol name

Each provider card also gains an inline model entry area:

- quick-add input for model names
- pressing Enter or clicking Add creates a model under that provider
- the same text is used for both `displayName` and `providerModelName` by default
- existing provider models are shown as editable rows or chips in that card
- each model remains individually enabled/disabled

The global model registry can remain as an advanced overview, but the fast path should no longer require users to go to a separate model table after adding a provider.

Priority ordering remains a separate global section grouped by `displayName`. This keeps cross-provider routing explicit and auditable. Duplicate display names are sorted by descending numeric priority. Duplicate priorities remain invalid.

## Protocol Design

Add a first-class `volcengine-ark` protocol option with label `Volcengine Ark / 火山方舟`.

Research summary:

- 火山方舟 data-plane APIs support API key auth with `Authorization: Bearer $ARK_API_KEY`.
- 火山方舟 documents OpenAI SDK compatibility by changing `base_url`, `api_key`, and `model`.
- Image generation examples use an OpenAI-compatible `$BASE_URL/images/generations` shape.

References:

- https://www.volcengine.com/docs/82379/1298459
- https://www.volcengine.com/docs/82379/1330626
- https://www.volcengine.com/docs/82379/1541523

Because the current gateway already has an OpenAI-compatible image provider adapter, the first backend implementation should treat `volcengine-ark` as an OpenAI-compatible protocol. It should not create a separate provider class yet.

A separate provider should only be added later if we need capabilities outside the compatible surface, such as Access Key signing, task-based APIs, video/3D generation, or provider-specific request/response fields that cannot safely pass through `extra_body`.

## Backend Routing Design

The backend loads the frontend-exported `GatewayUpstreamConfig` from a local JSON file:

```text
UPSTREAM_CONFIG_PATH=config/upstreams.json
```

At startup:

1. Load environment variables.
2. If `UPSTREAM_CONFIG_PATH` is set, read and validate the JSON file.
3. Build a runtime router from channels, models, and priorities.
4. Register image routes with the router provider.
5. If `UPSTREAM_CONFIG_PATH` is not set, keep the current single OpenAI provider behavior for backwards compatibility.

Routing algorithm for each image request:

1. Use `request.model` as the public display name.
2. Find enabled models whose `displayName` equals `request.model`.
3. Keep only models whose channel exists and is enabled.
4. Sort candidates by descending priority.
5. Reject the request if no candidate exists.
6. Rewrite `request.model` to the selected candidate's `providerModelName`.
7. Call the selected channel using that channel's `protocolType`, `baseUrl`, and `apiKey`.

The response remains the gateway's normalized image response.

## Error Handling

Startup errors:

- malformed config file fails startup
- duplicate priorities fail startup
- enabled models referencing missing channels fail startup
- unsupported protocol in an enabled selected route fails startup or route construction

Runtime errors:

- unknown requested model returns `404` with a gateway error
- no enabled route for requested model returns `404`
- upstream failure remains `502`

Disabled channels and models stay visible in exported config but do not participate in routing.

## Testing

Frontend tests should cover:

- adding a provider model directly inside a provider card
- the added model is attached to that provider
- the added model appears in priority ordering
- `volcengine-ark` appears as a selectable protocol
- exported JSON includes provider models and protocol type

Backend tests should cover:

- config file loading from `UPSTREAM_CONFIG_PATH`
- request model display name maps to selected provider model name
- higher priority candidate is selected
- disabled channels/models are skipped
- unknown display name returns a gateway error
- `volcengine-ark` uses the OpenAI-compatible adapter path

## Non-Goals

- No backend config save API in this iteration.
- No hot reload of the upstream config file.
- No database persistence.
- No Access Key signed 火山方舟 requests.
- No task-style video or 3D generation APIs.
