# Upstream Config Frontend Design

## Overview

This spec defines a frontend configuration page for managing multiple upstream channels used by the image gateway. The page is a single configuration center that lets operators:

- define upstream channels
- choose a protocol per channel
- register models under each channel
- assign unique numeric priorities across duplicate display names
- export a normalized JSON configuration

The page is intended for configuration management, not end-user inference. It should prioritize clarity, auditability, and immediate validation over wizard-style flow.

## Goals

- Provide a single-page configuration center for upstream routing.
- Support multiple channels with protocol selection.
- Support protocol names based on major vendors now, while keeping protocol labels extensible.
- Allow custom model registration per channel.
- Resolve duplicate model display names with explicit numeric priorities.
- Enforce strict ordering rules: higher number means higher priority, and duplicate priorities are not allowed.
- Keep disabled channels and models visible without deleting their history from the page state.
- Allow export of the resolved configuration as JSON.

## Non-Goals

- Backend persistence in this iteration.
- Auth, RBAC, or multi-user collaboration.
- Approval workflows or version history.
- Secret encryption beyond masked input presentation.
- Drag-and-drop ranking.
- Protocol-specific deep configuration beyond the common channel fields.

## Page Shape

The page is a single configuration center with five top-level sections:

1. Action bar
2. Global rules and validation summary
3. Channel configuration
4. Model registry
5. Priority ordering

The page should behave like a control panel, not like a linear form wizard. Users can edit any section directly, while the page continuously recalculates global validity.

## Section Design

### 1. Action Bar

The top action bar should contain:

- `Add Channel`
- `Add Model`
- `Validate Config`
- `Save Config`
- `Export JSON`

The bar should also show page-level save state:

- `No changes`
- `Unsaved changes`
- `Validation failed`
- `Ready to save`
- `Saved`

## 2. Global Rules And Validation Summary

This section explains the routing behavior and surfaces page-level issues.

Displayed rules:

- the page configures image gateway upstream routing
- protocol is configured at the channel level
- models with the same display name are selected by descending numeric priority
- larger priority numbers win
- priorities must be unique
- disabled channels and models remain visible but do not participate in routing

Displayed validation summary:

- duplicate priority conflicts
- incomplete duplicate-model ranking groups
- invalid channel definitions
- invalid model definitions
- references to missing channels

The summary should distinguish blocking errors from warnings.

### 3. Channel Configuration

This section manages upstream channels using expandable cards.

Card summary:

- channel name
- protocol label
- enabled/disabled state
- number of registered models

Expanded card fields:

- `channel_id` - generated, read-only
- `channel_name` - required
- `protocol_type` - required
- `protocol_name` - required only when protocol type is custom
- `base_url` - required
- `api_key` - required
- `enabled` - boolean
- `description` - optional

Protocol selection options in v1:

- `OpenAI`
- `Azure OpenAI`
- `阿里云`
- `腾讯云`
- `Custom`

Internal protocol keys should still remain extensible even if the UI labels start with vendor names.

Channel interaction rules:

- users choose protocol before filling remaining channel details
- predefined protocol options do not require manual protocol naming
- `Custom` requires a unique protocol name
- disabling a channel keeps its models on screen but marks them as inactive for routing

### 4. Model Registry

This section uses a table because the objects are repetitive and benefit from batch scanning.

Fields per model row:

- `model_id` - generated, read-only
- `display_name` - required
- `provider_model_name` - required
- `channel_id` - required
- `model_kind` - required, v1 only supports `image-generation`
- `enabled` - boolean
- `description` - optional

Key rules:

- `display_name` may repeat
- `provider_model_name + channel_id` should be unique
- each model must reference an existing channel
- disabled models remain visible but do not participate in routing
- if the related channel is disabled, the model row should visually reflect that inherited inactive state

### 5. Priority Ordering

This is the core routing section. It should not be a generic editable table. It should be grouped by `display_name`.

For each display-name group, show:

- group header with `display_name`
- each candidate channel-model entry
- channel name
- protocol label
- provider model name
- enabled state
- numeric priority

Priority rules:

- sort each group by priority descending in real time
- priority must be a positive integer
- duplicate priorities are not allowed
- duplicate display-name groups with more than one candidate must be completely ranked before saving
- groups with only one candidate still display their effective order
- inactive entries stay visible but are marked as not participating in routing

The page must not allow duplicate priorities anywhere in the configuration. Ordering must therefore always be strict and deterministic.

## Information Model

The frontend state should use three persisted entities and one derived view.

### Persisted Entities

```ts
type ProtocolType =
  | "openai"
  | "azure-openai"
  | "aliyun"
  | "tencent"
  | "custom";

type ChannelConfig = {
  id: string;
  name: string;
  protocolType: ProtocolType;
  protocolName?: string;
  baseUrl: string;
  apiKey: string;
  enabled: boolean;
  description?: string;
};

type ModelKind = "image-generation";

type ModelConfig = {
  id: string;
  displayName: string;
  providerModelName: string;
  channelId: string;
  modelKind: ModelKind;
  enabled: boolean;
  description?: string;
};

type ModelPriority = {
  modelId: string;
  priority: number;
};
```

### Derived View

```ts
type ResolvedModelGroup = {
  displayName: string;
  items: Array<{
    modelId: string;
    channelId: string;
    channelName: string;
    protocolLabel: string;
    providerModelName: string;
    enabled: boolean;
    priority?: number;
  }>;
};
```

`ResolvedModelGroup` should not be stored directly. It is recalculated from channels, models, and priorities after every mutation.

## Saved Configuration Shape

The page should export a normalized configuration object:

```ts
type GatewayUpstreamConfig = {
  version: 1;
  channels: ChannelConfig[];
  models: ModelConfig[];
  priorities: ModelPriority[];
};
```

This object is the handoff format for future persistence or server integration.

## Data Flow

The page should follow this state flow:

1. load an initial configuration object
2. edit `channels`
3. edit `models`
4. edit `priorities`
5. recompute `resolvedGroups`
6. run validation at field, section, and global levels
7. allow save/export only when global validation passes

The page should use immediate recalculation rather than delayed submit-time normalization.

## Validation Design

Validation should be layered.

### Field-Level Validation

Examples:

- required text missing
- base URL invalid
- API key empty
- priority not an integer
- custom protocol missing a protocol name

### Section-Level Validation

Examples:

- model rows referencing missing channels
- duplicate `provider_model_name + channelId`
- channel cards missing required fields
- duplicate custom protocol names

### Global Validation

Examples:

- duplicate priorities
- incomplete ranking inside duplicate display-name groups
- inactive but referenced routing candidates

Global validation results should appear in the summary section and block save.

## Interaction Design

### Editing Model

This page should be optimized for editing structured objects, not guiding novice users step-by-step.

- channel cards are collapsed by default and expandable
- model registry is table-based
- priority ordering uses numeric inputs, not drag-and-drop
- changing a priority should immediately reorder its group
- disabling a channel or model should never silently delete dependent entries

### Feedback And States

The UI should surface three scopes of feedback:

- input-level inline messages
- section-level status messages
- page-level validation summary

The save action should remain visible at all times, but disabled when the configuration is invalid.

## Suggested Frontend Components

The page should be decomposed into focused UI units:

- `UpstreamConfigPage`
- `ActionBar`
- `GlobalValidationSummary`
- `ChannelCardList`
- `ChannelCard`
- `ModelRegistryTable`
- `PriorityGroupList`
- `PriorityGroupCard`

Supporting logic units:

- protocol option catalog
- config normalization utilities
- priority conflict detection
- resolved-group selector
- validation helpers

## Error Handling

The frontend should preserve user edits even when validation fails.

Rules:

- invalid sections remain editable
- save/export is blocked only for blocking errors
- warnings remain visible but do not erase data
- disabled entities should display why they are excluded from routing

## Initial UI Scope

This iteration should implement a locally usable frontend page that can:

- add/edit/remove channels
- add/edit/remove models
- assign priorities
- validate configuration in real time
- import an initial config object
- export the final config as JSON

This iteration should not implement:

- server persistence
- auth
- revision history
- approval pipeline
- encrypted secret storage

## Testing Scope

### Unit Tests

- protocol field rules
- duplicate priority detection
- duplicate display-name grouping
- resolved-group generation
- save eligibility calculation

### Component Tests

- channel card editing
- model registry row editing
- priority group ordering and conflict display
- disabled-state rendering

### Integration Tests

- add channel -> add model -> assign priorities -> export JSON
- duplicate priority rejection
- custom protocol validation
- missing channel reference handling
- disabled channel/model routing exclusion indicators

## Key Decisions

### Single-Page Configuration Center

Decision:

Keep the entire feature on one page.

Reasoning:

The problem is one connected configuration graph. Splitting too early would increase navigation cost and make ranking harder to understand.

### Protocol At Channel Level

Decision:

Protocol is a property of the channel, not the model.

Reasoning:

Protocol determines upstream request semantics, auth shape, and routing behavior at the channel boundary.

### Numeric Priority Instead Of Drag Sorting

Decision:

Use numeric priority inputs.

Reasoning:

The routing contract is explicitly numeric, auditable, and deterministic. Numeric editing also scales better for future import/export workflows.

### Global Priority Uniqueness

Decision:

Priorities must be unique across the configuration.

Reasoning:

This matches the requested behavior and guarantees strict ordering with no ambiguity.

## Next Step

After user approval, the next step is to write an implementation plan for the frontend page and then implement it in the existing project.
