# Runtime Config Save Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the frontend save upstream config to `UPSTREAM_CONFIG_PATH` and make the backend apply the new config immediately without restart.

**Architecture:** Introduce a runtime config manager that owns the active config and current provider, expose config load/save APIs, and route image requests through the current provider reference. The frontend loads config from the backend on mount and saves the full config object through the new API while preserving independent JSON export preview.

**Tech Stack:** TypeScript, Fastify, React, Zod, Vitest, Testing Library

---

## File Map

### Files to create

- `src/runtime/config-manager.ts` - runtime holder for current config and current provider
- `src/routes/config.ts` - Fastify routes for `GET/POST /v1/config/upstreams`
- `src/schemas/upstream-config.ts` - request/response schema wrapper for config APIs
- `tests/unit/runtime-config-manager.test.ts` - manager behavior tests
- `tests/integration/config-routes.test.ts` - API-level config load/save tests

### Files to modify

- `/home/pzy000/Linewrite/TypeScripts/ai_sdk_dev/image-gateway/src/app.ts`
- `/home/pzy000/Linewrite/TypeScripts/ai_sdk_dev/image-gateway/src/server.ts`
- `/home/pzy000/Linewrite/TypeScripts/ai_sdk_dev/image-gateway/src/routes/images.ts`
- `/home/pzy000/Linewrite/TypeScripts/ai_sdk_dev/image-gateway/src/config/upstream-config.ts`
- `/home/pzy000/Linewrite/TypeScripts/ai_sdk_dev/image-gateway/src/ui/app.tsx`
- `/home/pzy000/Linewrite/TypeScripts/ai_sdk_dev/image-gateway/src/ui/components/action-bar.tsx`
- `/home/pzy000/Linewrite/TypeScripts/ai_sdk_dev/image-gateway/src/ui/styles.css`
- `/home/pzy000/Linewrite/TypeScripts/ai_sdk_dev/image-gateway/tests/component/ui/upstream-config-page.test.tsx`
- `/home/pzy000/Linewrite/TypeScripts/ai_sdk_dev/image-gateway/README.md`

## Task 1: Add Runtime Config Manager

**Files:**
- Create: `/home/pzy000/Linewrite/TypeScripts/ai_sdk_dev/image-gateway/src/runtime/config-manager.ts`
- Test: `/home/pzy000/Linewrite/TypeScripts/ai_sdk_dev/image-gateway/tests/unit/runtime-config-manager.test.ts`

- [ ] **Step 1: Write failing unit tests**

Create `tests/unit/runtime-config-manager.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { createRuntimeConfigManager } from "../../src/runtime/config-manager.js";

describe("runtime config manager", () => {
  it("returns the currently active provider", () => {
    const provider = { generateImage: vi.fn() };
    const manager = createRuntimeConfigManager({
      provider,
      config: null,
      configPath: "config/upstreams.json",
    });

    expect(manager.getProvider()).toBe(provider);
  });

  it("swaps provider and config atomically in memory", () => {
    const providerA = { generateImage: vi.fn() };
    const providerB = { generateImage: vi.fn() };
    const manager = createRuntimeConfigManager({
      provider: providerA,
      config: null,
      configPath: "config/upstreams.json",
    });

    manager.replace({
      provider: providerB,
      config: {
        version: 1,
        channels: [],
        models: [],
        priorities: [],
      },
    });

    expect(manager.getProvider()).toBe(providerB);
    expect(manager.getConfig()).toEqual({
      version: 1,
      channels: [],
      models: [],
      priorities: [],
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/unit/runtime-config-manager.test.ts`

Expected: FAIL because the runtime manager does not exist yet.

- [ ] **Step 3: Implement runtime config manager**

Create `src/runtime/config-manager.ts`:

```ts
import type { GatewayUpstreamConfig } from "../config/upstream-config.js";
import type { ImageProvider } from "../providers/types.js";

export type RuntimeConfigManager = {
  getProvider(): ImageProvider;
  getConfig(): GatewayUpstreamConfig | null;
  getConfigPath(): string | null;
  replace(next: { provider: ImageProvider; config: GatewayUpstreamConfig | null }): void;
};

export function createRuntimeConfigManager(input: {
  provider: ImageProvider;
  config: GatewayUpstreamConfig | null;
  configPath: string | null;
}): RuntimeConfigManager {
  let provider = input.provider;
  let config = input.config;
  const configPath = input.configPath;

  return {
    getProvider() {
      return provider;
    },
    getConfig() {
      return config;
    },
    getConfigPath() {
      return configPath;
    },
    replace(next) {
      provider = next.provider;
      config = next.config;
    },
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/unit/runtime-config-manager.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/runtime/config-manager.ts tests/unit/runtime-config-manager.test.ts
git commit -m "feat: add runtime config manager"
```

## Task 2: Add Config Save/Load Backend APIs

**Files:**
- Create: `/home/pzy000/Linewrite/TypeScripts/ai_sdk_dev/image-gateway/src/routes/config.ts`
- Create: `/home/pzy000/Linewrite/TypeScripts/ai_sdk_dev/image-gateway/src/schemas/upstream-config.ts`
- Modify: `/home/pzy000/Linewrite/TypeScripts/ai_sdk_dev/image-gateway/src/config/upstream-config.ts`
- Modify: `/home/pzy000/Linewrite/TypeScripts/ai_sdk_dev/image-gateway/src/app.ts`
- Test: `/home/pzy000/Linewrite/TypeScripts/ai_sdk_dev/image-gateway/tests/integration/config-routes.test.ts`

- [ ] **Step 1: Write failing integration tests**

Create `tests/integration/config-routes.test.ts`:

```ts
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../../src/app.js";
import { createRuntimeConfigManager } from "../../src/runtime/config-manager.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
  tempDirs.length = 0;
});

describe("config routes", () => {
  it("returns the active upstream config", async () => {
    const manager = createRuntimeConfigManager({
      provider: { generateImage: vi.fn() },
      config: {
        version: 1,
        channels: [],
        models: [],
        priorities: [],
      },
      configPath: "config/upstreams.json",
    });

    const app = buildApp({ runtimeConfigManager: manager, provider: manager.getProvider() });
    await app.ready();

    try {
      const response = await app.inject({ method: "GET", url: "/v1/config/upstreams" });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ version: 1 });
    } finally {
      await app.close();
    }
  });

  it("saves config to disk and swaps runtime config", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "image-gateway-save-"));
    tempDirs.push(dir);
    const configPath = path.join(dir, "upstreams.json");
    const initialProvider = { generateImage: vi.fn() };
    const manager = createRuntimeConfigManager({
      provider: initialProvider,
      config: null,
      configPath,
    });

    const app = buildApp({ runtimeConfigManager: manager, provider: manager.getProvider() });
    await app.ready();

    try {
      const payload = {
        version: 1,
        channels: [
          {
            id: "ark",
            name: "Volcengine Ark",
            protocolType: "volcengine-ark",
            baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
            apiKey: "ark-key",
            enabled: true,
          },
        ],
        models: [
          {
            id: "m1",
            displayName: "gpt-image-1",
            providerModelName: "doubao-seedream-4-0",
            channelId: "ark",
            modelKind: "image-generation",
            enabled: true,
          },
        ],
        priorities: [{ modelId: "m1", priority: 200 }],
      };

      const response = await app.inject({
        method: "POST",
        url: "/v1/config/upstreams",
        payload,
      });

      expect(response.statusCode).toBe(200);
      expect(manager.getConfig()).toEqual(payload);
      expect(JSON.parse(await readFile(configPath, "utf8"))).toEqual(payload);
    } finally {
      await app.close();
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/integration/config-routes.test.ts`

Expected: FAIL because config routes and runtime manager wiring do not exist in `buildApp`.

- [ ] **Step 3: Extend upstream config module with save helper**

Append to `src/config/upstream-config.ts`:

```ts
import { mkdtemp, readFile, rename, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
```

Add:

```ts
export async function saveUpstreamConfigFile(
  configPath: string,
  config: GatewayUpstreamConfig,
): Promise<void> {
  const directory = path.dirname(configPath);
  const tempDirectory = await mkdtemp(path.join(directory, ".upstreams-"));
  const tempFile = path.join(tempDirectory, path.basename(configPath));

  await writeFile(tempFile, JSON.stringify(config, null, 2), "utf8");
  await rename(tempFile, configPath);
}
```

Remove any unused imports after editing.

- [ ] **Step 4: Add runtime-config-aware buildApp and config routes**

Create `src/schemas/upstream-config.ts`:

```ts
import { gatewayUpstreamConfigSchema } from "../config/upstream-config.js";

export { gatewayUpstreamConfigSchema as upstreamConfigRequestSchema };
```

Create `src/routes/config.ts`:

```ts
import type { FastifyInstance } from "fastify";
import { GatewayError } from "../lib/errors.js";
import type { RuntimeConfigManager } from "../runtime/config-manager.js";
import { upstreamConfigRequestSchema } from "../schemas/upstream-config.js";
import {
  loadUpstreamConfigFile,
  saveUpstreamConfigFile,
  type GatewayUpstreamConfig,
} from "../config/upstream-config.js";
import { ConfiguredUpstreamRouter } from "../providers/router/upstream-router.js";

export function registerConfigRoutes(app: FastifyInstance, manager: RuntimeConfigManager) {
  app.get("/v1/config/upstreams", async () => {
    const config = manager.getConfig();

    if (!config) {
      throw new GatewayError({
        statusCode: 400,
        type: "invalid_request",
        code: "config_persistence_unavailable",
        message: "Runtime upstream config persistence is not enabled.",
      });
    }

    return config;
  });

  app.post("/v1/config/upstreams", async (request) => {
    const configPath = manager.getConfigPath();

    if (!configPath) {
      throw new GatewayError({
        statusCode: 400,
        type: "invalid_request",
        code: "config_persistence_unavailable",
        message: "UPSTREAM_CONFIG_PATH is not configured.",
      });
    }

    const parsed = upstreamConfigRequestSchema.parse(request.body);
    const nextConfig = parsed as GatewayUpstreamConfig;
    const nextProvider = new ConfiguredUpstreamRouter(nextConfig);

    await saveUpstreamConfigFile(configPath, nextConfig);
    manager.replace({ provider: nextProvider, config: nextConfig });

    return nextConfig;
  });
}
```

Modify `src/app.ts` signature:

```ts
import { registerConfigRoutes } from "./routes/config.js";
import type { RuntimeConfigManager } from "./runtime/config-manager.js";

export function buildApp(options: {
  provider: { generateImage(request: unknown): Promise<unknown> };
  runtimeConfigManager?: RuntimeConfigManager;
  uiRoot?: string;
}) {
```

Register config routes when manager exists:

```ts
  registerImageRoutes(app, options.runtimeConfigManager ?? { getProvider: () => options.provider });

  if (options.runtimeConfigManager) {
    registerConfigRoutes(app, options.runtimeConfigManager);
  }
```

- [ ] **Step 5: Run integration tests and typecheck**

Run: `npm test -- tests/integration/config-routes.test.ts tests/integration/images-route.test.ts`

Expected: PASS.

Run: `npm run lint:types`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/config/upstream-config.ts src/routes/config.ts src/schemas/upstream-config.ts src/app.ts tests/integration/config-routes.test.ts
git commit -m "feat: add runtime config save api"
```

## Task 3: Route Image Requests Through Runtime Manager

**Files:**
- Modify: `/home/pzy000/Linewrite/TypeScripts/ai_sdk_dev/image-gateway/src/routes/images.ts`
- Modify: `/home/pzy000/Linewrite/TypeScripts/ai_sdk_dev/image-gateway/src/server.ts`
- Test: `/home/pzy000/Linewrite/TypeScripts/ai_sdk_dev/image-gateway/tests/integration/images-route.test.ts`

- [ ] **Step 1: Write the failing runtime-provider route test**

Add to `tests/integration/images-route.test.ts`:

```ts
it("uses the current runtime provider reference", async () => {
  const providerA = { generateImage: vi.fn().mockResolvedValue({
    created: 1,
    data: [{ b64_json: "a", url: null, mime_type: "image/png", revised_prompt: null }],
    usage: { image_count: 1 },
    request_id: "req_a",
  }) };
  const providerB = { generateImage: vi.fn().mockResolvedValue({
    created: 1,
    data: [{ b64_json: "b", url: null, mime_type: "image/png", revised_prompt: null }],
    usage: { image_count: 1 },
    request_id: "req_b",
  }) };
  const manager = createRuntimeConfigManager({
    provider: providerA,
    config: null,
    configPath: "config/upstreams.json",
  });
  const app = buildApp({ provider: providerA, runtimeConfigManager: manager });
  await app.ready();

  try {
    await app.inject({
      method: "POST",
      url: "/v1/images/generations",
      payload: { model: "gpt-image-1", prompt: "orange cat" },
    });

    manager.replace({ provider: providerB, config: null });

    await app.inject({
      method: "POST",
      url: "/v1/images/generations",
      payload: { model: "gpt-image-1", prompt: "orange cat" },
    });

    expect(providerA.generateImage).toHaveBeenCalledTimes(1);
    expect(providerB.generateImage).toHaveBeenCalledTimes(1);
  } finally {
    await app.close();
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/integration/images-route.test.ts`

Expected: FAIL because image routes still use a fixed provider.

- [ ] **Step 3: Make image routes read the current provider**

Modify `src/routes/images.ts`:

```ts
export function registerImageRoutes(
  app: FastifyInstance,
  providerSource: {
    getProvider(): { generateImage(request: unknown): Promise<unknown> };
  },
) {
  app.post("/v1/images/generations", async (request) => {
    const parsed = imageGenerationRequestSchema.parse(request.body);
    const service = createImageGenerationService(providerSource.getProvider() as never);
    return service.generate(parsed);
  });
}
```

Modify `src/server.ts`:

```ts
import { createRuntimeConfigManager } from "./runtime/config-manager.js";

const env = loadEnv();
const runtimeConfigPath = env.UPSTREAM_CONFIG_PATH ?? null;
const initialConfig = runtimeConfigPath ? await loadUpstreamConfigFile(runtimeConfigPath) : null;
const initialProvider = initialConfig
  ? new ConfiguredUpstreamRouter(initialConfig)
  : new OpenAIImageProvider(createOpenAIClient(env));
const runtimeConfigManager = createRuntimeConfigManager({
  provider: initialProvider,
  config: initialConfig,
  configPath: runtimeConfigPath,
});
const app = buildApp({
  provider: initialProvider,
  runtimeConfigManager,
});
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npm test -- tests/integration/images-route.test.ts tests/integration/config-routes.test.ts`

Expected: PASS.

Run: `npm run lint:types`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/routes/images.ts src/server.ts tests/integration/images-route.test.ts
git commit -m "feat: route requests through runtime config manager"
```

## Task 4: Load Config In Frontend And Save It

**Files:**
- Modify: `/home/pzy000/Linewrite/TypeScripts/ai_sdk_dev/image-gateway/src/ui/app.tsx`
- Modify: `/home/pzy000/Linewrite/TypeScripts/ai_sdk_dev/image-gateway/src/ui/components/action-bar.tsx`
- Modify: `/home/pzy000/Linewrite/TypeScripts/ai_sdk_dev/image-gateway/src/ui/styles.css`
- Test: `/home/pzy000/Linewrite/TypeScripts/ai_sdk_dev/image-gateway/tests/component/ui/upstream-config-page.test.tsx`

- [ ] **Step 1: Write failing frontend save/load tests**

Add to `tests/component/ui/upstream-config-page.test.tsx`:

```tsx
it("loads runtime config from the backend on mount", async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      version: 1,
      channels: [
        {
          id: "runtime-channel",
          name: "Runtime Channel",
          protocolType: "openai",
          baseUrl: "https://api.openai.com/v1",
          apiKey: "k1",
          enabled: true,
        },
      ],
      models: [],
      priorities: [],
    }),
  });

  vi.stubGlobal("fetch", fetchMock);
  render(<UpstreamConfigPage />);

  expect(await screen.findByRole("heading", { name: "Runtime Channel" })).toBeInTheDocument();
});

it("saves config to the backend", async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: { message: "Runtime upstream config persistence is not enabled." } }),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        version: 1,
        channels: [],
        models: [],
        priorities: [],
      }),
    });

  vi.stubGlobal("fetch", fetchMock);
  const user = userEvent.setup();

  render(<UpstreamConfigPage />);

  await user.click(screen.getByRole("button", { name: "Save Config" }));

  expect(fetchMock).toHaveBeenCalledWith(
    "/v1/config/upstreams",
    expect.objectContaining({ method: "POST" }),
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/component/ui/upstream-config-page.test.tsx`

Expected: FAIL because the page does not use `fetch`.

- [ ] **Step 3: Implement frontend load/save behavior**

Modify `src/ui/app.tsx`:

```tsx
import { useEffect, useMemo, useState } from "react";
```

Add state:

```tsx
const [saveState, setSaveState] = useState<"No changes" | "Unsaved changes" | "Validation failed" | "Ready to save" | "Saved" | "Saving..." | "Save failed">("Unsaved changes");
const [loadError, setLoadError] = useState("");
```

Add effect:

```tsx
useEffect(() => {
  let cancelled = false;

  async function loadConfig() {
    try {
      const response = await fetch("/v1/config/upstreams");
      if (!response.ok) {
        const payload = await response.json();
        if (!cancelled) {
          setLoadError(payload.error?.message ?? "Runtime config load is unavailable.");
        }
        return;
      }

      const nextConfig = await response.json();
      if (!cancelled) {
        setChannels(nextConfig.channels);
        setModels(nextConfig.models);
        setPriorities(nextConfig.priorities);
        setSaveState("Saved");
      }
    } catch {
      if (!cancelled) {
        setLoadError("Runtime config load failed.");
      }
    }
  }

  void loadConfig();

  return () => {
    cancelled = true;
  };
}, []);
```

Add save handler:

```tsx
const handleSave = async () => {
  if (!validation.canSave) {
    setSaveState("Validation failed");
    return;
  }

  setSaveState("Saving...");

  try {
    const response = await fetch("/v1/config/upstreams", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(config),
    });

    const payload = await response.json();

    if (!response.ok) {
      setSaveState("Save failed");
      setLoadError(payload.error?.message ?? "Save failed.");
      return;
    }

    setChannels(payload.channels);
    setModels(payload.models);
    setPriorities(payload.priorities);
    setLoadError("");
    setSaveState("Saved");
  } catch {
    setSaveState("Save failed");
    setLoadError("Save failed.");
  }
};
```

Use:

```tsx
saveState={validation.canSave ? saveState === "Save failed" ? "Validation failed" : saveState : "Validation failed"}
onSave={handleSave}
disableSave={false}
```

Render load/save warning above summary:

```tsx
{loadError ? <section className="panel"><p className="field-error">{loadError}</p></section> : null}
```

Update `ActionBar` save-state union to include `Saving...` and `Save failed`.

Add minimal CSS if needed for the warning panel spacing.

- [ ] **Step 4: Run tests and typecheck**

Run: `npm test -- tests/component/ui/upstream-config-page.test.tsx`

Expected: PASS.

Run: `npm run lint:types`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/app.tsx src/ui/components/action-bar.tsx src/ui/styles.css tests/component/ui/upstream-config-page.test.tsx
git commit -m "feat: load and save runtime config in frontend"
```

## Task 5: Document Save + Hot Reload Workflow

**Files:**
- Modify: `/home/pzy000/Linewrite/TypeScripts/ai_sdk_dev/image-gateway/README.md`

- [ ] **Step 1: Update README**

Add to `README.md`:

```md
## Save And Apply Config

When `UPSTREAM_CONFIG_PATH` is set, the frontend `Save Config` button will:

1. validate the current config
2. send the full config to `POST /v1/config/upstreams`
3. write the config to `UPSTREAM_CONFIG_PATH`
4. switch the backend runtime to the new config without restart

This applies only to new requests after save succeeds.

If `UPSTREAM_CONFIG_PATH` is not configured, save/apply is unavailable and the frontend will show an explicit error.
```

- [ ] **Step 2: Run final verification**

Run: `npm test && npm run lint:types && npm run build`

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: add runtime config save workflow"
```

## Self-Review

- Spec coverage:
  - runtime manager is covered by Task 1
  - config GET/POST APIs are covered by Task 2
  - hot-swapped request routing is covered by Task 3
  - frontend load/save integration is covered by Task 4
  - user-facing save workflow docs are covered by Task 5
- Placeholder scan:
  - no `TBD`, `TODO`, or deferred placeholders remain
- Type consistency:
  - `GatewayUpstreamConfig`, `RuntimeConfigManager`, `ConfiguredUpstreamRouter`, `loadUpstreamConfigFile`, and `saveUpstreamConfigFile` are consistently named across tasks
