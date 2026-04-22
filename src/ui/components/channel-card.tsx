import { useState } from "react";
import type { ChannelConfig, ModelConfig, ProtocolType } from "../types/config.js";
import { PROTOCOL_OPTIONS } from "../lib/protocol-options.js";

export function ChannelCard(props: {
  channel: ChannelConfig;
  onChange(next: ChannelConfig): void;
  modelCount: number;
  models: ModelConfig[];
  onAddModel(modelName: string): void;
  onModelChange(modelId: string, updater: Partial<ModelConfig>): void;
  errors: string[];
}) {
  const [quickAddModelName, setQuickAddModelName] = useState("");

  const commitQuickAdd = () => {
    const nextModelName = quickAddModelName.trim();
    if (!nextModelName) {
      return;
    }

    props.onAddModel(nextModelName);
    setQuickAddModelName("");
  };

  return (
    <article className="panel channel-card">
      <header className="channel-card__header">
        <div>
          <h3>{props.channel.name || "New Channel"}</h3>
          <p>{props.modelCount} models</p>
        </div>
        <span>{props.channel.enabled ? "Enabled" : "Disabled"}</span>
      </header>

      <label>
        Channel Name
        <input
          value={props.channel.name}
          onChange={(event) => props.onChange({ ...props.channel, name: event.target.value })}
        />
      </label>

      <label>
        Base URL
        <input
          value={props.channel.baseUrl}
          onChange={(event) => props.onChange({ ...props.channel, baseUrl: event.target.value })}
        />
      </label>

      <label>
        API Key
        <input
          type="password"
          value={props.channel.apiKey}
          onChange={(event) => props.onChange({ ...props.channel, apiKey: event.target.value })}
        />
      </label>

      <label className="channel-card__toggle">
        <input
          type="checkbox"
          checked={props.channel.enabled}
          onChange={(event) => props.onChange({ ...props.channel, enabled: event.target.checked })}
        />
        Enabled
      </label>

      <label>
        Protocol
        <select
          aria-label="Protocol"
          value={props.channel.protocolType}
          onChange={(event) =>
            props.onChange({
              ...props.channel,
              protocolType: event.target.value as ProtocolType,
            })
          }
        >
          {PROTOCOL_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      {props.channel.protocolType === "custom" ? (
        <label>
          Custom Protocol Name
          <input
            value={props.channel.protocolName ?? ""}
            onChange={(event) =>
              props.onChange({ ...props.channel, protocolName: event.target.value })
            }
          />
        </label>
      ) : null}

      <section className="provider-models">
        <div className="provider-models__header">
          <h4>Provider Models</h4>
          <p>Quick-add and edit models scoped to this provider.</p>
        </div>

        <div className="provider-models__quick-add">
          <input
            aria-label="Quick Add Provider Model"
            value={quickAddModelName}
            onChange={(event) => setQuickAddModelName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") {
                return;
              }

              event.preventDefault();
              commitQuickAdd();
            }}
          />
          <button type="button" onClick={commitQuickAdd}>
            Add
          </button>
        </div>

        <div className="provider-models__list">
          {props.models.map((model) => (
            <div key={model.id} className="provider-models__row">
              <label>
                Provider Card Display Name
                <input
                  aria-label="Provider Card Display Name"
                  value={model.displayName}
                  onChange={(event) =>
                    props.onModelChange(model.id, { displayName: event.target.value })
                  }
                />
              </label>
              <label>
                Provider Card Model Name
                <input
                  aria-label="Provider Card Model Name"
                  value={model.providerModelName}
                  onChange={(event) =>
                    props.onModelChange(model.id, { providerModelName: event.target.value })
                  }
                />
              </label>
              <label className="provider-models__toggle">
                <input
                  aria-label="Provider Card Model Enabled"
                  type="checkbox"
                  checked={model.enabled}
                  onChange={(event) =>
                    props.onModelChange(model.id, { enabled: event.target.checked })
                  }
                />
                Provider Card Model Enabled
              </label>
            </div>
          ))}
        </div>
      </section>

      {props.errors.map((error, index) => (
        <p key={`${index}-${error}`} className="field-error">
          {error}
        </p>
      ))}
    </article>
  );
}
