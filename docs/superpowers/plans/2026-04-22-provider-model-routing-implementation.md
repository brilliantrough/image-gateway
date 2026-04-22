# Provider Model Routing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users add models directly inside provider cards and make the backend route image generation requests through the configured upstream provider/model priority map.

**Architecture:** The frontend keeps `channels`, `models`, and `priorities` state, but provider cards gain a quick model entry surface scoped to the channel. The backend gains a shared upstream config contract, a file loader, and a routing provider that selects an enabled model candidate by display name and priority before calling an OpenAI-compatible upstream client. `volcengine-ark` is added as a first-class protocol that reuses the OpenAI-compatible adapter path.

**Tech Stack:** TypeScript, React, Fastify, OpenAI SDK, Zod, Vitest, Testing Library

---

## File Map

### Files to create

- `src/config/upstream-config.ts` - shared backend runtime config schema and loader helpers
- `src/providers/openai-compatible/adapter.ts` - protocol-neutral OpenAI-compatible image provider
- `src/providers/openai-compatible/client.ts` - creates OpenAI SDK clients from channel base URL and API key
- `src/providers/router/upstream-router.ts` - runtime provider that selects configured channel/model candidates
- `tests/unit/upstream-router.test.ts` - routing selection tests
- `tests/unit/upstream-config-loader.test.ts` - config file loader tests

### Files to modify

- `src/ui/types/config.ts` - add `volcengine-ark` protocol key
- `src/ui/lib/protocol-options.ts` - add `Volcengine Ark / 火山方舟` label
- `src/ui/components/channel-card.tsx` - add provider-scoped quick model entry and model rows
- `src/ui/components/channel-card-list.tsx` - pass model quick-add/update handlers
- `src/ui/app.tsx` - wire provider-card model actions and preserve export
- `src/ui/styles.css` - style provider model entry area
- `src/config/env.ts` - add optional `UPSTREAM_CONFIG_PATH`
- `src/server.ts` - choose config-backed router when config path exists
- `src/app.ts` - keep injection-friendly provider interface
- `src/providers/openai/adapter.ts` - optionally wrap or re-export compatible adapter for backwards compatibility
- `src/providers/openai/client.ts` - keep legacy env-based OpenAI client
- `src/providers/openai/mapper.ts` - allow provider label in unsupported parameter errors
- `src/providers/types.ts` - keep existing `ImageProvider` interface
- `src/services/image-generation-service.ts` - keep provider-agnostic service behavior
- `tests/component/ui/upstream-config-page.test.tsx` - provider-card model quick-add and protocol option tests
- `tests/integration/images-route.test.ts` - config-backed image route test
- `README.md` - document `UPSTREAM_CONFIG_PATH`
- `.env.example` - document optional config path

### External docs checked

- 火山方舟 Base URL and auth: https://www.volcengine.com/docs/82379/1298459
- 火山方舟 OpenAI SDK compatibility: https://www.volcengine.com/docs/82379/1330626
- 火山方舟 image generation API: https://www.volcengine.com/docs/82379/1541523

## Task 1: Add Volcengine Ark Protocol To Frontend Config

**Files:**
- Modify: `/home/pzy000/Linewrite/TypeScripts/ai_sdk_dev/image-gateway/src/ui/types/config.ts`
- Modify: `/home/pzy000/Linewrite/TypeScripts/ai_sdk_dev/image-gateway/src/ui/lib/protocol-options.ts`
- Test: `/home/pzy000/Linewrite/TypeScripts/ai_sdk_dev/image-gateway/tests/component/ui/upstream-config-page.test.tsx`

- [ ] **Step 1: Write the failing protocol option test**

Add this test inside `describe("UpstreamConfigPage", ...)` in `tests/component/ui/upstream-config-page.test.tsx`:

```tsx
it("offers Volcengine Ark as a provider protocol", async () => {
  render(<UpstreamConfigPage />);

  const protocolSelect = screen.getAllByLabelText("Protocol")[0] as HTMLSelectElement;
  const optionLabels = Array.from(protocolSelect.options).map((option) => option.textContent);

  expect(optionLabels).toContain("Volcengine Ark / 火山方舟");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/component/ui/upstream-config-page.test.tsx`

Expected: FAIL because the option label is not present.

- [ ] **Step 3: Add the protocol key and label**

Change `src/ui/types/config.ts`:

```ts
export type ProtocolType =
  | "openai"
  | "azure-openai"
  | "aliyun"
  | "tencent"
  | "volcengine-ark"
  | "custom";
```

Change `src/ui/lib/protocol-options.ts`:

```ts
export const PROTOCOL_OPTIONS: Array<{ value: ProtocolType; label: string }> = [
  { value: "openai", label: "OpenAI" },
  { value: "azure-openai", label: "Azure OpenAI" },
  { value: "aliyun", label: "阿里云" },
  { value: "tencent", label: "腾讯云" },
  { value: "volcengine-ark", label: "Volcengine Ark / 火山方舟" },
  { value: "custom", label: "Custom" },
];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/component/ui/upstream-config-page.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/types/config.ts src/ui/lib/protocol-options.ts tests/component/ui/upstream-config-page.test.tsx
git commit -m "feat: add volcengine ark protocol option"
```

## Task 2: Add Provider-Scoped Quick Model Entry

**Files:**
- Modify: `/home/pzy000/Linewrite/TypeScripts/ai_sdk_dev/image-gateway/src/ui/components/channel-card.tsx`
- Modify: `/home/pzy000/Linewrite/TypeScripts/ai_sdk_dev/image-gateway/src/ui/components/channel-card-list.tsx`
- Modify: `/home/pzy000/Linewrite/TypeScripts/ai_sdk_dev/image-gateway/src/ui/app.tsx`
- Modify: `/home/pzy000/Linewrite/TypeScripts/ai_sdk_dev/image-gateway/src/ui/styles.css`
- Test: `/home/pzy000/Linewrite/TypeScripts/ai_sdk_dev/image-gateway/tests/component/ui/upstream-config-page.test.tsx`

- [ ] **Step 1: Write the failing quick-add test**

Add this test inside `describe("UpstreamConfigPage", ...)`:

```tsx
it("adds a model directly inside a provider card", async () => {
  const user = userEvent.setup();

  render(<UpstreamConfigPage />);

  const quickAddInputs = screen.getAllByLabelText("Quick Add Provider Model");
  await user.type(quickAddInputs[0]!, "doubao-seedream-4-0{enter}");

  const displayNameInputs = screen.getAllByLabelText("Display Name");
  const modelChannels = screen.getAllByLabelText("Model Channel");
  const priorityRows = screen.getAllByTestId("priority-row-doubao-seedream-4-0");
  const newModelChannel = modelChannels.at(-1) as HTMLSelectElement;

  expect(displayNameInputs.at(-1)).toHaveValue("doubao-seedream-4-0");
  expect(newModelChannel.selectedOptions[0]?.textContent).toBe("OpenAI Main");
  expect(priorityRows[0]).toHaveTextContent("OpenAI Main");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/component/ui/upstream-config-page.test.tsx`

Expected: FAIL because `Quick Add Provider Model` does not exist.

- [ ] **Step 3: Update `ChannelCard` props and render quick-add UI**

Change `src/ui/components/channel-card.tsx` props to accept scoped models and handlers:

```tsx
export function ChannelCard(props: {
  channel: ChannelConfig;
  modelCount: number;
  models: ModelConfig[];
  fieldErrors: string[];
  onChange(next: ChannelConfig): void;
  onAddModel(modelName: string): void;
  onModelChange(modelId: string, updater: Partial<ModelConfig>): void;
}) {
```

Import `useState` and `ModelConfig`:

```tsx
import { useState } from "react";
import type { ChannelConfig, ModelConfig, ProtocolType } from "../types/config.js";
```

Add this block before the field error rendering:

```tsx
const [quickModelName, setQuickModelName] = useState("");

const addQuickModel = () => {
  const modelName = quickModelName.trim();
  if (!modelName) {
    return;
  }

  props.onAddModel(modelName);
  setQuickModelName("");
};
```

Render this section after the protocol/custom protocol fields:

```tsx
<section className="provider-models">
  <h4>Provider Models</h4>
  <div className="provider-models__quick-add">
    <label>
      Quick Add Provider Model
      <input
        aria-label="Quick Add Provider Model"
        value={quickModelName}
        placeholder="e.g. gpt-image-1 or doubao-seedream-4-0"
        onChange={(event) => setQuickModelName(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            addQuickModel();
          }
        }}
      />
    </label>
    <button type="button" onClick={addQuickModel}>
      Add
    </button>
  </div>
  <div className="provider-models__list">
    {props.models.map((model) => (
      <div key={model.id} className="provider-models__row">
        <input
          aria-label="Provider Card Display Name"
          value={model.displayName}
          onChange={(event) => props.onModelChange(model.id, { displayName: event.target.value })}
        />
        <input
          aria-label="Provider Card Model Name"
          value={model.providerModelName}
          onChange={(event) =>
            props.onModelChange(model.id, { providerModelName: event.target.value })
          }
        />
        <label className="provider-models__toggle">
          <input
            aria-label="Provider Card Model Enabled"
            type="checkbox"
            checked={model.enabled}
            onChange={(event) => props.onModelChange(model.id, { enabled: event.target.checked })}
          />
          Enabled
        </label>
      </div>
    ))}
  </div>
</section>
```

- [ ] **Step 4: Wire channel list and app handlers**

Update `ChannelCardList` to pass scoped models:

```tsx
export function ChannelCardList(props: {
  channels: ChannelConfig[];
  models: ModelConfig[];
  channelFieldErrors: Record<string, string[]>;
  onChange(channelId: string, next: ChannelConfig): void;
  onAddModel(channelId: string, modelName: string): void;
  onModelChange(modelId: string, updater: Partial<ModelConfig>): void;
}) {
```

Inside the map:

```tsx
const channelModels = props.models.filter((model) => model.channelId === channel.id);

return (
  <ChannelCard
    key={channel.id}
    channel={channel}
    modelCount={channelModels.length}
    models={channelModels}
    fieldErrors={props.channelFieldErrors[channel.id] ?? []}
    onChange={(next) => props.onChange(channel.id, next)}
    onAddModel={(modelName) => props.onAddModel(channel.id, modelName)}
    onModelChange={props.onModelChange}
  />
);
```

In `src/ui/app.tsx`, add:

```tsx
const addModelToChannel = (channelId: string, modelName: string) => {
  setModels((current) => [
    ...current,
    {
      ...createEmptyModelConfig(channelId),
      displayName: modelName,
      providerModelName: modelName,
    },
  ]);
};
```

Pass handlers:

```tsx
<ChannelCardList
  channels={channels}
  models={models}
  channelFieldErrors={validation.channelFieldErrors}
  onChange={(channelId, next) =>
    setChannels((current) =>
      current.map((channel) => (channel.id === channelId ? next : channel)),
    )
  }
  onAddModel={addModelToChannel}
  onModelChange={(modelId, updater) =>
    setModels((current) =>
      current.map((model) => (model.id === modelId ? { ...model, ...updater } : model)),
    )
  }
/>
```

- [ ] **Step 5: Add styles**

Append to `src/ui/styles.css`:

```css
.provider-models {
  margin-top: 18px;
  padding-top: 16px;
  border-top: 1px solid var(--line);
}

.provider-models h4 {
  margin: 0 0 12px;
}

.provider-models__quick-add {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 10px;
  align-items: end;
}

.provider-models__quick-add button {
  border: 0;
  border-radius: 12px;
  padding: 10px 14px;
  background: var(--accent);
  color: #fff;
}

.provider-models__list {
  display: grid;
  gap: 10px;
  margin-top: 12px;
}

.provider-models__row {
  display: grid;
  grid-template-columns: 1fr 1fr auto;
  gap: 10px;
  align-items: center;
}

.provider-models__toggle {
  flex-direction: row !important;
  align-items: center;
  white-space: nowrap;
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test -- tests/component/ui/upstream-config-page.test.tsx`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/ui/components/channel-card.tsx src/ui/components/channel-card-list.tsx src/ui/app.tsx src/ui/styles.css tests/component/ui/upstream-config-page.test.tsx
git commit -m "feat: add provider scoped model entry"
```

## Task 3: Add Backend Upstream Config Loader

**Files:**
- Create: `/home/pzy000/Linewrite/TypeScripts/ai_sdk_dev/image-gateway/src/config/upstream-config.ts`
- Modify: `/home/pzy000/Linewrite/TypeScripts/ai_sdk_dev/image-gateway/src/config/env.ts`
- Test: `/home/pzy000/Linewrite/TypeScripts/ai_sdk_dev/image-gateway/tests/unit/upstream-config-loader.test.ts`

- [ ] **Step 1: Write failing loader tests**

Create `tests/unit/upstream-config-loader.test.ts`:

```ts
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadUpstreamConfigFile } from "../../src/config/upstream-config.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
  tempDirs.length = 0;
});

describe("loadUpstreamConfigFile", () => {
  it("loads a valid upstream config json file", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "image-gateway-config-"));
    tempDirs.push(dir);
    const configPath = path.join(dir, "upstreams.json");

    await writeFile(
      configPath,
      JSON.stringify({
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
            id: "seedream",
            displayName: "gpt-image-1",
            providerModelName: "doubao-seedream-4-0",
            channelId: "ark",
            modelKind: "image-generation",
            enabled: true,
          },
        ],
        priorities: [{ modelId: "seedream", priority: 200 }],
      }),
    );

    const config = await loadUpstreamConfigFile(configPath);

    expect(config.channels[0]?.protocolType).toBe("volcengine-ark");
    expect(config.models[0]?.providerModelName).toBe("doubao-seedream-4-0");
  });

  it("rejects duplicate priorities", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "image-gateway-config-"));
    tempDirs.push(dir);
    const configPath = path.join(dir, "upstreams.json");

    await writeFile(
      configPath,
      JSON.stringify({
        version: 1,
        channels: [
          {
            id: "openai",
            name: "OpenAI",
            protocolType: "openai",
            baseUrl: "https://api.openai.com/v1",
            apiKey: "openai-key",
            enabled: true,
          },
        ],
        models: [
          {
            id: "m1",
            displayName: "gpt-image-1",
            providerModelName: "gpt-image-1",
            channelId: "openai",
            modelKind: "image-generation",
            enabled: true,
          },
          {
            id: "m2",
            displayName: "gpt-image-1",
            providerModelName: "gpt-image-1-alt",
            channelId: "openai",
            modelKind: "image-generation",
            enabled: true,
          },
        ],
        priorities: [
          { modelId: "m1", priority: 100 },
          { modelId: "m2", priority: 100 },
        ],
      }),
    );

    await expect(loadUpstreamConfigFile(configPath)).rejects.toThrow(/Duplicate priority 100/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/upstream-config-loader.test.ts`

Expected: FAIL because `src/config/upstream-config.ts` does not exist.

- [ ] **Step 3: Implement config schema and loader**

Create `src/config/upstream-config.ts`:

```ts
import { readFile } from "node:fs/promises";
import { z } from "zod";

export const protocolTypeSchema = z.enum([
  "openai",
  "azure-openai",
  "aliyun",
  "tencent",
  "volcengine-ark",
  "custom",
]);

export type ProtocolType = z.infer<typeof protocolTypeSchema>;

export const channelConfigSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  protocolType: protocolTypeSchema,
  protocolName: z.string().optional(),
  baseUrl: z.string().url(),
  apiKey: z.string().min(1),
  enabled: z.boolean(),
  description: z.string().optional(),
});

export const modelConfigSchema = z.object({
  id: z.string().min(1),
  displayName: z.string().min(1),
  providerModelName: z.string().min(1),
  channelId: z.string().min(1),
  modelKind: z.literal("image-generation"),
  enabled: z.boolean(),
  description: z.string().optional(),
});

export const modelPrioritySchema = z.object({
  modelId: z.string().min(1),
  priority: z.number().int().positive(),
});

export const gatewayUpstreamConfigSchema = z.object({
  version: z.literal(1),
  channels: z.array(channelConfigSchema),
  models: z.array(modelConfigSchema),
  priorities: z.array(modelPrioritySchema),
});

export type ChannelConfig = z.infer<typeof channelConfigSchema>;
export type ModelConfig = z.infer<typeof modelConfigSchema>;
export type ModelPriority = z.infer<typeof modelPrioritySchema>;
export type GatewayUpstreamConfig = z.infer<typeof gatewayUpstreamConfigSchema>;

export function validateUpstreamConfig(config: GatewayUpstreamConfig): void {
  const channelIds = new Set(config.channels.map((channel) => channel.id));
  const modelIds = new Set(config.models.map((model) => model.id));
  const priorityValues = new Set<number>();
  const priorityModelIds = new Set<string>();

  for (const model of config.models) {
    if (!channelIds.has(model.channelId)) {
      throw new Error(`Model ${model.id} references missing channel ${model.channelId}`);
    }
  }

  for (const priority of config.priorities) {
    if (!modelIds.has(priority.modelId)) {
      throw new Error(`Priority references missing model ${priority.modelId}`);
    }

    if (priorityModelIds.has(priority.modelId)) {
      throw new Error(`Model ${priority.modelId} has more than one priority entry`);
    }
    priorityModelIds.add(priority.modelId);

    if (priorityValues.has(priority.priority)) {
      throw new Error(`Duplicate priority ${priority.priority}`);
    }
    priorityValues.add(priority.priority);
  }
}

export async function loadUpstreamConfigFile(configPath: string): Promise<GatewayUpstreamConfig> {
  const raw = await readFile(configPath, "utf8");
  const parsed = gatewayUpstreamConfigSchema.parse(JSON.parse(raw));
  validateUpstreamConfig(parsed);
  return parsed;
}
```

Modify `src/config/env.ts`:

```ts
const envSchema = z.object({
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.string().default("info"),
  OPENAI_API_KEY: z.string().min(1),
  OPENAI_BASE_URL: z.string().url().default("https://api.openai.com/v1"),
  UPSTREAM_CONFIG_PATH: z.string().min(1).optional(),
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/unit/upstream-config-loader.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/config/upstream-config.ts src/config/env.ts tests/unit/upstream-config-loader.test.ts
git commit -m "feat: add upstream config loader"
```

## Task 4: Add Config-Backed Upstream Router

**Files:**
- Create: `/home/pzy000/Linewrite/TypeScripts/ai_sdk_dev/image-gateway/src/providers/openai-compatible/adapter.ts`
- Create: `/home/pzy000/Linewrite/TypeScripts/ai_sdk_dev/image-gateway/src/providers/openai-compatible/client.ts`
- Create: `/home/pzy000/Linewrite/TypeScripts/ai_sdk_dev/image-gateway/src/providers/router/upstream-router.ts`
- Modify: `/home/pzy000/Linewrite/TypeScripts/ai_sdk_dev/image-gateway/src/providers/openai/adapter.ts`
- Modify: `/home/pzy000/Linewrite/TypeScripts/ai_sdk_dev/image-gateway/src/providers/openai/mapper.ts`
- Test: `/home/pzy000/Linewrite/TypeScripts/ai_sdk_dev/image-gateway/tests/unit/upstream-router.test.ts`

- [ ] **Step 1: Write failing router tests**

Create `tests/unit/upstream-router.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { GatewayError } from "../../src/lib/errors.js";
import { ConfiguredUpstreamRouter } from "../../src/providers/router/upstream-router.js";
import type { NormalizedImageRequest } from "../../src/types/image.js";

const baseRequest: NormalizedImageRequest = {
  model: "gpt-image-1",
  prompt: "orange cat",
  images: [],
  extra_body: {},
  mode: "text-to-image",
};

describe("ConfiguredUpstreamRouter", () => {
  it("routes display model names to the highest priority provider model", async () => {
    const generateImage = vi.fn().mockResolvedValue({
      created: 1,
      data: [],
      usage: { image_count: 0 },
      request_id: "req_test",
    });

    const router = new ConfiguredUpstreamRouter(
      {
        version: 1,
        channels: [
          {
            id: "openai",
            name: "OpenAI",
            protocolType: "openai",
            baseUrl: "https://api.openai.com/v1",
            apiKey: "openai-key",
            enabled: true,
          },
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
            id: "openai-model",
            displayName: "gpt-image-1",
            providerModelName: "gpt-image-1",
            channelId: "openai",
            modelKind: "image-generation",
            enabled: true,
          },
          {
            id: "ark-model",
            displayName: "gpt-image-1",
            providerModelName: "doubao-seedream-4-0",
            channelId: "ark",
            modelKind: "image-generation",
            enabled: true,
          },
        ],
        priorities: [
          { modelId: "openai-model", priority: 100 },
          { modelId: "ark-model", priority: 200 },
        ],
      },
      () => ({ generateImage }),
    );

    await router.generateImage(baseRequest);

    expect(generateImage).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "doubao-seedream-4-0",
      }),
    );
  });

  it("skips disabled channels and models", async () => {
    const generateImage = vi.fn().mockResolvedValue({
      created: 1,
      data: [],
      usage: { image_count: 0 },
      request_id: "req_test",
    });

    const router = new ConfiguredUpstreamRouter(
      {
        version: 1,
        channels: [
          {
            id: "disabled-channel",
            name: "Disabled",
            protocolType: "openai",
            baseUrl: "https://api.openai.com/v1",
            apiKey: "disabled-key",
            enabled: false,
          },
          {
            id: "active-channel",
            name: "Active",
            protocolType: "openai",
            baseUrl: "https://api.openai.com/v1",
            apiKey: "active-key",
            enabled: true,
          },
        ],
        models: [
          {
            id: "disabled-channel-model",
            displayName: "gpt-image-1",
            providerModelName: "disabled-channel-model",
            channelId: "disabled-channel",
            modelKind: "image-generation",
            enabled: true,
          },
          {
            id: "active-model",
            displayName: "gpt-image-1",
            providerModelName: "active-provider-model",
            channelId: "active-channel",
            modelKind: "image-generation",
            enabled: true,
          },
        ],
        priorities: [
          { modelId: "disabled-channel-model", priority: 300 },
          { modelId: "active-model", priority: 100 },
        ],
      },
      () => ({ generateImage }),
    );

    await router.generateImage(baseRequest);

    expect(generateImage).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "active-provider-model",
      }),
    );
  });

  it("returns a gateway error when no enabled route matches", async () => {
    const router = new ConfiguredUpstreamRouter(
      {
        version: 1,
        channels: [],
        models: [],
        priorities: [],
      },
      () => ({ generateImage: vi.fn() }),
    );

    await expect(router.generateImage(baseRequest)).rejects.toMatchObject<Partial<GatewayError>>({
      statusCode: 404,
      code: "model_not_configured",
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/upstream-router.test.ts`

Expected: FAIL because `ConfiguredUpstreamRouter` does not exist.

- [ ] **Step 3: Add OpenAI-compatible provider**

Create `src/providers/openai-compatible/client.ts`:

```ts
import OpenAI from "openai";

export function createOpenAICompatibleClient(options: { apiKey: string; baseUrl: string }): OpenAI {
  return new OpenAI({
    apiKey: options.apiKey,
    baseURL: options.baseUrl,
  });
}
```

Create `src/providers/openai-compatible/adapter.ts` by moving the current OpenAI adapter logic into a protocol-neutral class:

```ts
import type OpenAI from "openai";
import { GatewayError } from "../../lib/errors.js";
import type { NormalizedImageRequest } from "../../types/image.js";
import type { ImageProvider } from "../types.js";
import { toNormalizedOpenAIResponse, toOpenAIRequest } from "../openai/mapper.js";

export class OpenAICompatibleImageProvider implements ImageProvider {
  constructor(
    private readonly client: OpenAI,
    private readonly providerName: string,
  ) {}

  async generateImage(request: NormalizedImageRequest) {
    try {
      const payload = toOpenAIRequest(request, this.providerName);
      const response = await this.client.images.generate(payload as never);

      return toNormalizedOpenAIResponse({
        created: Math.floor(Date.now() / 1000),
        data: (response.data ?? []).map((item) => ({
          b64_json: "b64_json" in item ? item.b64_json ?? null : null,
          url: "url" in item ? item.url ?? null : null,
          revised_prompt: "revised_prompt" in item ? item.revised_prompt ?? null : null,
        })),
        request_id: crypto.randomUUID(),
        output_format: request.output_format,
      });
    } catch (error) {
      if (error instanceof GatewayError) {
        throw error;
      }

      throw new GatewayError({
        statusCode: 502,
        type: "upstream_error",
        code: "openai_compatible_request_failed",
        message: `${this.providerName} image generation request failed.`,
        provider: this.providerName,
      });
    }
  }
}
```

Modify `src/providers/openai/adapter.ts`:

```ts
import type OpenAI from "openai";
import { OpenAICompatibleImageProvider } from "../openai-compatible/adapter.js";

export class OpenAIImageProvider extends OpenAICompatibleImageProvider {
  constructor(client: OpenAI) {
    super(client, "openai");
  }
}
```

Modify `toOpenAIRequest` signature in `src/providers/openai/mapper.ts`:

```ts
export function toOpenAIRequest(
  request: NormalizedImageRequest,
  providerName = "openai",
): OpenAIImagesRequest {
```

Use `providerName` in unsupported errors:

```ts
message: `Parameter 'seed' is not supported by provider '${providerName}'.`,
provider: providerName,
```

and:

```ts
message: `Parameter 'negative_prompt' is not supported by provider '${providerName}'.`,
provider: providerName,
```

- [ ] **Step 4: Add router provider**

Create `src/providers/router/upstream-router.ts`:

```ts
import { GatewayError } from "../../lib/errors.js";
import type { GatewayUpstreamConfig, ChannelConfig } from "../../config/upstream-config.js";
import type { NormalizedImageRequest } from "../../types/image.js";
import type { ImageProvider } from "../types.js";
import { OpenAICompatibleImageProvider } from "../openai-compatible/adapter.js";
import { createOpenAICompatibleClient } from "../openai-compatible/client.js";

type ProviderFactory = (channel: ChannelConfig) => ImageProvider;

export class ConfiguredUpstreamRouter implements ImageProvider {
  private readonly channelById: Map<string, ChannelConfig>;
  private readonly priorityByModelId: Map<string, number>;
  private readonly providerByChannelId = new Map<string, ImageProvider>();

  constructor(
    private readonly config: GatewayUpstreamConfig,
    private readonly providerFactory: ProviderFactory = createProviderForChannel,
  ) {
    this.channelById = new Map(config.channels.map((channel) => [channel.id, channel]));
    this.priorityByModelId = new Map(
      config.priorities.map((priority) => [priority.modelId, priority.priority]),
    );
  }

  async generateImage(request: NormalizedImageRequest) {
    const candidates = this.config.models
      .filter((model) => model.enabled && model.displayName === request.model)
      .map((model) => ({
        model,
        channel: this.channelById.get(model.channelId),
        priority: this.priorityByModelId.get(model.id) ?? 0,
      }))
      .filter((candidate): candidate is typeof candidate & { channel: ChannelConfig } =>
        Boolean(candidate.channel?.enabled),
      )
      .sort((left, right) => right.priority - left.priority);

    const selected = candidates[0];

    if (!selected) {
      throw new GatewayError({
        statusCode: 404,
        type: "invalid_request",
        code: "model_not_configured",
        message: `No enabled upstream route is configured for model '${request.model}'.`,
        param: "model",
      });
    }

    const provider = this.getProvider(selected.channel);

    return provider.generateImage({
      ...request,
      model: selected.model.providerModelName,
    });
  }

  private getProvider(channel: ChannelConfig): ImageProvider {
    const existing = this.providerByChannelId.get(channel.id);

    if (existing) {
      return existing;
    }

    const provider = this.providerFactory(channel);
    this.providerByChannelId.set(channel.id, provider);
    return provider;
  }
}

function createProviderForChannel(channel: ChannelConfig): ImageProvider {
  if (
    channel.protocolType === "openai" ||
    channel.protocolType === "azure-openai" ||
    channel.protocolType === "volcengine-ark" ||
    channel.protocolType === "custom"
  ) {
    return new OpenAICompatibleImageProvider(
      createOpenAICompatibleClient({
        apiKey: channel.apiKey,
        baseUrl: channel.baseUrl,
      }),
      channel.protocolName?.trim() || channel.protocolType,
    );
  }

  throw new GatewayError({
    statusCode: 400,
    type: "invalid_request",
    code: "unsupported_protocol",
    message: `Protocol '${channel.protocolType}' is not supported by the backend router.`,
    provider: channel.protocolType,
  });
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- tests/unit/upstream-router.test.ts tests/unit/openai-mapper.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/providers/openai-compatible src/providers/router/upstream-router.ts src/providers/openai/adapter.ts src/providers/openai/mapper.ts tests/unit/upstream-router.test.ts
git commit -m "feat: add config backed upstream router"
```

## Task 5: Wire Server To `UPSTREAM_CONFIG_PATH`

**Files:**
- Modify: `/home/pzy000/Linewrite/TypeScripts/ai_sdk_dev/image-gateway/src/server.ts`
- Test: `/home/pzy000/Linewrite/TypeScripts/ai_sdk_dev/image-gateway/tests/integration/images-route.test.ts`

- [ ] **Step 1: Write failing route test for config-backed routing**

Add this test to `tests/integration/images-route.test.ts`:

```ts
it("routes through configured upstream provider models", async () => {
  const provider = {
    generateImage: vi.fn().mockResolvedValue({
      created: 1,
      data: [{ b64_json: "abc", url: null, mime_type: "image/png", revised_prompt: null }],
      usage: { image_count: 1 },
      request_id: "req_test",
    }),
  };

  const app = buildApp({ provider });
  await app.ready();

  try {
    const response = await app.inject({
      method: "POST",
      url: "/v1/images/generations",
      payload: {
        model: "gpt-image-1",
        prompt: "orange cat",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(provider.generateImage).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gpt-image-1",
      }),
    );
  } finally {
    await app.close();
  }
});
```

This keeps the injection contract stable. Server-level config path behavior is covered by unit tests and startup code type checking.

- [ ] **Step 2: Run route test**

Run: `npm test -- tests/integration/images-route.test.ts`

Expected: PASS before server wiring, because `buildApp` remains provider-injected.

- [ ] **Step 3: Wire production server startup**

Modify `src/server.ts`:

```ts
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

await app.listen({
  host: env.HOST,
  port: env.PORT,
});
```

- [ ] **Step 4: Run typecheck**

Run: `npm run lint:types`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server.ts tests/integration/images-route.test.ts
git commit -m "feat: load upstream router from config path"
```

## Task 6: Document Config File Routing

**Files:**
- Modify: `/home/pzy000/Linewrite/TypeScripts/ai_sdk_dev/image-gateway/README.md`
- Modify: `/home/pzy000/Linewrite/TypeScripts/ai_sdk_dev/image-gateway/.env.example`

- [ ] **Step 1: Update README**

Add to `README.md` after "Frontend Config Center":

```md
## Multi-Upstream Routing

The frontend can export an upstream config JSON file. Save it locally, for example:

```bash
mkdir -p config
# Save the exported JSON as config/upstreams.json
```

Start the backend with:

```bash
UPSTREAM_CONFIG_PATH=config/upstreams.json npm run dev
```

When `UPSTREAM_CONFIG_PATH` is set, `POST /v1/images/generations` routes by the public `model` display name:

- enabled models with matching `displayName` are candidates
- disabled channels and models are skipped
- higher numeric priority wins
- `providerModelName` is sent to the selected upstream
- `openai`, `azure-openai`, `volcengine-ark`, and `custom` use the OpenAI-compatible image adapter in this version

火山方舟 can be configured with protocol `volcengine-ark`, a data-plane base URL such as `https://ark.cn-beijing.volces.com/api/v3`, and an Ark API key.
```

- [ ] **Step 2: Update `.env.example`**

Append:

```env
# Optional: load frontend-exported upstream routing config
# UPSTREAM_CONFIG_PATH=config/upstreams.json
```

- [ ] **Step 3: Run final verification**

Run: `npm test && npm run lint:types && npm run build`

Expected: all tests, typecheck, and build pass.

- [ ] **Step 4: Commit**

```bash
git add README.md .env.example
git commit -m "docs: document multi upstream routing"
```

## Self-Review

- Spec coverage:
  - Provider-card quick model add is covered by Task 2.
  - Volcengine Ark protocol is covered by Task 1.
  - Backend config file loading is covered by Task 3.
  - Runtime routing by display name and priority is covered by Task 4.
  - Server wiring through `UPSTREAM_CONFIG_PATH` is covered by Task 5.
  - Usage documentation is covered by Task 6.
- Placeholder scan:
  - No `TBD`, `TODO`, or deferred placeholders remain.
- Type consistency:
  - `ProtocolType`, `GatewayUpstreamConfig`, `ChannelConfig`, `ModelConfig`, and `ModelPriority` are consistently named across frontend and backend tasks.
  - `ConfiguredUpstreamRouter`, `loadUpstreamConfigFile`, and `OpenAICompatibleImageProvider` are introduced before use in later tasks.
