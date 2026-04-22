import { useMemo, useState } from "react";
import { ActionBar } from "./components/action-bar.js";
import { ChannelCardList } from "./components/channel-card-list.js";
import { GlobalValidationSummary } from "./components/global-summary.js";
import { createEmptyChannelConfig } from "./lib/config-helpers.js";
import { validateConfig } from "./lib/validation.js";
import { initialConfig } from "./test-data/initial-config.js";
import "./styles.css";

export function UpstreamConfigPage() {
  const [channels, setChannels] = useState(initialConfig.channels);
  const [models] = useState(initialConfig.models);
  const [priorities] = useState(initialConfig.priorities);

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

  return (
    <main className="page-shell">
      <h1>Upstream Config Center</h1>
      <ActionBar
        saveState={validation.canSave ? "Unsaved changes" : "Validation failed"}
        onAddChannel={() => setChannels((current) => [...current, createEmptyChannelConfig()])}
        onAddModel={() => {}}
        onValidate={() => {}}
        onSave={() => {}}
        onExport={() => {}}
        disableAddModel
        disableValidate
        disableExport
        disableSave
      />
      <GlobalValidationSummary
        fieldErrors={validation.fieldErrors}
        globalErrors={validation.globalErrors}
        sectionErrors={validation.sectionErrors}
      />
      <ChannelCardList
        channels={channels}
        models={models}
        channelFieldErrors={validation.channelFieldErrors}
        onChange={(channelId, next) =>
          setChannels((current) =>
            current.map((channel) => (channel.id === channelId ? next : channel)),
          )
        }
      />
    </main>
  );
}
