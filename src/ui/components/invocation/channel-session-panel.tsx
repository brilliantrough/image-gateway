import type { PublicChannelCatalogItem, PublicModelCatalogItem } from "../../types/config.js";
import type { InvocationMode, ProtocolFormSpec } from "../../lib/protocol-form-specs.js";

type ChannelSessionPanelProps = {
  channels: PublicChannelCatalogItem[];
  availableModels: PublicModelCatalogItem[];
  activeChannel: PublicChannelCatalogItem;
  activeModel: PublicModelCatalogItem;
  spec: ProtocolFormSpec;
  mode: InvocationMode;
  isRunning: boolean;
  minimalMode?: boolean;
  onRun: () => void;
  onChannelChange: (channelId: string) => void;
  onModelChange: (modelId: string) => void;
  onModeChange: (mode: InvocationMode) => void;
};

export function ChannelSessionPanel(props: ChannelSessionPanelProps) {
  const {
    channels,
    availableModels,
    activeChannel,
    activeModel,
    spec,
    mode,
    isRunning,
    minimalMode = false,
    onRun,
    onChannelChange,
    onModelChange,
    onModeChange,
  } = props;

  return (
    <section
      id="session"
      className={`panel invocation-panel ${minimalMode ? "invocation-panel--minimal" : ""}`}
    >
      <div className="invocation-panel__header">
        <div>
          <h2>{minimalMode ? "Create Image" : "Session"}</h2>
          {minimalMode ? null : (
            <p>Pick a channel, model, and mode, then send the request through the trusted gateway.</p>
          )}
        </div>
      </div>

      <div className="invocation-panel__form-grid">
        {minimalMode ? null : (
          <label>
            Channel
            <select value={activeChannel.id} onChange={(event) => onChannelChange(event.target.value)}>
              {channels.map((channel) => (
                <option key={channel.id} value={channel.id}>
                  {channel.name || channel.id}
                </option>
              ))}
            </select>
          </label>
        )}

        <label>
          Model
          <select value={activeModel.id} onChange={(event) => onModelChange(event.target.value)}>
            {availableModels.map((model) => (
              <option key={model.id} value={model.id}>
                {minimalMode ? model.displayName || model.providerModelName : model.providerModelName}
              </option>
            ))}
          </select>
        </label>

        <label>
          Mode
          <select value={mode} onChange={(event) => onModeChange(event.target.value as InvocationMode)}>
            {spec.supportedModes.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="invocation-run-bar">
        <div>
          <strong>{minimalMode ? "Ready to create" : "Ready to run"}</strong>
          <span>
            {minimalMode
              ? "Generate with the selected model."
              : "Send this prompt and parameter set through the gateway."}
          </span>
        </div>
        <button
          type="button"
          className="invocation-run-button"
          onClick={onRun}
          disabled={isRunning}
        >
          {isRunning ? "Running…" : "Run Invocation"}
        </button>
      </div>

      {minimalMode ? null : <div className="invocation-meta">
        <div>
          <span className="meta-label">Protocol</span>
          <code>{activeChannel.protocolType}</code>
        </div>
        <div>
          <span className="meta-label">Display Name</span>
          <code>{activeModel.displayName}</code>
        </div>
        <div>
          <span className="meta-label">Provider Model</span>
          <code>{activeModel.providerModelName}</code>
        </div>
      </div>}
    </section>
  );
}
