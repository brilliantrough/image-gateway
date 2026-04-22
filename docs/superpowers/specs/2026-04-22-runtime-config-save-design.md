# Runtime Config Save Design

## Overview

This spec adds runtime configuration persistence and hot reload for the image gateway.

The current project can:

- edit upstream channels, models, and priorities in the frontend
- export JSON manually
- start the backend with `UPSTREAM_CONFIG_PATH`
- route requests with a config-backed upstream router

The missing piece is persistence. Operators need the frontend `Save Config` action to write the current config to `UPSTREAM_CONFIG_PATH` and make the backend use the new config immediately without restart.

## Goals

- Let the frontend load the currently active upstream config from the backend.
- Let the frontend save the current upstream config to the configured file path.
- Make successful saves take effect for new requests immediately, without backend restart.
- Ensure failed saves do not partially apply in memory or on disk.

## Non-Goals

- No optimistic locking or multi-user conflict handling.
- No config version history or rollback UI.
- No background file watching for external edits.
- No partial patch API. Saves replace the full config object.

## Backend Design

### Runtime Manager

Add a runtime config manager service that owns:

- the currently active `GatewayUpstreamConfig`
- the currently active image provider/router
- the configured file path from `UPSTREAM_CONFIG_PATH`

This manager becomes the source of truth for runtime routing. The image route does not hold a fixed provider anymore. Instead, each request resolves the current provider from the manager.

### Startup Behavior

At startup:

1. load environment variables
2. if `UPSTREAM_CONFIG_PATH` is set:
   - load config file
   - build the configured upstream router
   - initialize runtime manager with config and router
3. if `UPSTREAM_CONFIG_PATH` is not set:
   - initialize runtime manager with `null` config and legacy single OpenAI provider

Legacy single-provider mode remains supported.

### Config APIs

Add:

- `GET /v1/config/upstreams`
- `POST /v1/config/upstreams`

`GET /v1/config/upstreams`

- if runtime manager has an active config, return it
- if no config-path mode is enabled, return a clear error stating runtime config persistence is unavailable

`POST /v1/config/upstreams`

Request body:

- full `GatewayUpstreamConfig`

Execution order:

1. validate request body against backend config schema
2. perform semantic config validation
3. build a new configured upstream router from the request body
4. only if steps 1-3 succeed, attempt file persistence
5. write to a temporary file in the target directory
6. atomically rename the temp file onto `UPSTREAM_CONFIG_PATH`
7. only after file persistence succeeds, atomically replace the runtime manager’s current config and current provider

This ordering satisfies the selected requirement:

- if any step fails, no in-memory switch should happen
- if file write fails, the current runtime config remains active
- if config build fails, the file is not changed

### Persistence Rules

- saving requires `UPSTREAM_CONFIG_PATH`
- if it is not configured, `POST /v1/config/upstreams` returns a clear 400-style gateway error
- file persistence uses UTF-8 JSON with pretty printing
- writes are atomic through temp file + rename

## Frontend Design

### Initial Load

The frontend page should fetch `GET /v1/config/upstreams` on mount.

Behavior:

- if successful, populate `channels`, `models`, and `priorities` from backend config
- if unavailable because config-path mode is off, fall back to local `initialConfig` and show a save warning

### Save Flow

The action bar `Save Config` button should:

1. validate current frontend config
2. if invalid, remain blocked and surface existing validation errors
3. if valid, call `POST /v1/config/upstreams`
4. if successful, update save state to `Saved`
5. if failed, show save-state error and keep local edits intact

The save button should no longer be a placeholder.

### Export Flow

`Export JSON` remains available independently of save.

- it still shows the export preview
- it does not write to disk
- it is useful as draft inspection or manual backup

## Error Handling

### Backend

Return gateway-shaped errors for:

- save attempted without `UPSTREAM_CONFIG_PATH`
- config validation errors
- unsupported protocol in selected config
- file write failures
- file rename failures
- get attempted when runtime config mode is unavailable

### Frontend

Show explicit state for:

- loading current config
- save in progress
- save success
- save failure
- runtime config persistence unavailable

## Testing

### Backend tests

- manager returns the current provider for routing
- saving valid config writes file and swaps runtime provider
- save without `UPSTREAM_CONFIG_PATH` returns error
- failed router construction does not change runtime provider
- failed file write does not change runtime provider
- `GET /v1/config/upstreams` returns active config in config-path mode

### Frontend tests

- page bootstraps from `GET /v1/config/upstreams`
- save posts the full config
- successful save updates save state to `Saved`
- failed save preserves local edits and shows error
- export still works independently of save
