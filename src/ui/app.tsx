import { useMemo, useState } from "react";
import { ActionBar } from "./components/action-bar.js";
import { ChannelCardList } from "./components/channel-card-list.js";
import { GlobalValidationSummary } from "./components/global-summary.js";
import { ModelRegistryTable } from "./components/model-registry-table.js";
import { PriorityGroupList } from "./components/priority-group-list.js";
import type { ModelConfigUpdate } from "./types/config.js";
import {
  createEmptyChannelConfig,
  createEmptyModelConfig,
  exportConfig,
  upsertPriority,
} from "./lib/config-helpers.js";
import { buildResolvedGroups } from "./lib/resolved-groups.js";
import { validateConfig } from "./lib/validation.js";
import { initialConfig } from "./test-data/initial-config.js";
import "./styles.css";

export function UpstreamConfigPage() {
  const [channels, setChannels] = useState(initialConfig.channels);
  const [models, setModels] = useState(initialConfig.models);
  const [priorities, setPriorities] = useState(initialConfig.priorities);
  const [exportPreview, setExportPreview] = useState("");

  const updateModel = (modelId: string, updater: ModelConfigUpdate) => {
    setModels((current) =>
      current.map((model) => (model.id === modelId ? { ...model, ...updater } : model)),
    );
  };

  const removeModel = (modelId: string) => {
    setModels((current) => current.filter((model) => model.id !== modelId));
    setPriorities((current) => current.filter((priority) => priority.modelId !== modelId));
  };

  const removeChannel = (channelId: string) => {
    const removedModelIds = models
      .filter((model) => model.channelId === channelId)
      .map((model) => model.id);

    setChannels((current) => current.filter((channel) => channel.id !== channelId));
    setModels((current) => current.filter((model) => model.channelId !== channelId));
    setPriorities((current) =>
      current.filter((priority) => !removedModelIds.includes(priority.modelId)),
    );
  };

  const addModelToChannel = (channelId: string, modelName: string) => {
    const nextModelName = modelName.trim();
    if (!nextModelName) {
      return;
    }

    setModels((current) => [
      ...current,
      {
        ...createEmptyModelConfig(channelId),
        displayName: nextModelName,
        providerModelName: nextModelName,
      },
    ]);
  };

  const config = useMemo(
    () => ({
      version: 1 as const,
      channels,
      models,
      priorities,
    }),
    [channels, models, priorities],
  );

  const validation = validateConfig(config);
  const channelErrorSummary = Object.values(validation.channelFieldErrors).flat();
  const resolvedGroups = buildResolvedGroups(channels, models, priorities);

  return (
    <main className="page-shell">
      <h1>Upstream Config Center</h1>
      <ActionBar
        saveState={validation.canSave ? "Unsaved changes" : "Validation failed"}
        onAddChannel={() => setChannels((current) => [...current, createEmptyChannelConfig()])}
        onAddModel={() =>
          setModels((current) => [
            ...current,
            createEmptyModelConfig(channels.at(-1)?.id ?? channels[0]?.id ?? ""),
          ])
        }
        onValidate={() => {}}
        onSave={() => {}}
        onExport={() => setExportPreview(exportConfig(config))}
        disableAddModel={channels.length === 0}
        disableValidate
        disableExport={false}
        disableSave
      />
      <GlobalValidationSummary
        fieldErrors={[...validation.fieldErrors, ...channelErrorSummary]}
        globalErrors={validation.globalErrors}
        sectionErrors={validation.sectionErrors}
      />
      <ChannelCardList
        channels={channels}
        models={models}
        channelFieldErrors={validation.channelFieldErrors}
        onDeleteChannel={removeChannel}
        onAddModel={addModelToChannel}
        onModelChange={updateModel}
        onDeleteModel={removeModel}
        onChange={(channelId, next) =>
          setChannels((current) =>
            current.map((channel) => (channel.id === channelId ? next : channel)),
          )
        }
      />
      <ModelRegistryTable
        models={models}
        channels={channels}
        onChange={updateModel}
        onDelete={removeModel}
      />
      <PriorityGroupList
        groups={resolvedGroups}
        onPriorityChange={(modelId, priority) =>
          setPriorities((current) => upsertPriority(current, modelId, priority))
        }
      />
      {exportPreview ? (
        <section className="panel export-preview">
          <h2>Export Preview</h2>
          <p className={`export-preview__status ${validation.canSave ? "is-valid" : "is-invalid"}`}>
            {validation.canSave
              ? "Export is ready for backend loading."
              : "Export contains validation errors and may be rejected by the backend."}
          </p>
          <label>
            Export JSON Preview
            <textarea aria-label="Export JSON Preview" readOnly value={exportPreview} />
          </label>
        </section>
      ) : null}
    </main>
  );
}
