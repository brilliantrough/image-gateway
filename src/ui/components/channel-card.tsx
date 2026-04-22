import type { ChannelConfig, ProtocolType } from "../types/config.js";
import { PROTOCOL_OPTIONS } from "../lib/protocol-options.js";

export function ChannelCard(props: {
  channel: ChannelConfig;
  onChange(next: ChannelConfig): void;
  modelCount: number;
  errors: string[];
}) {
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

      {props.errors.map((error, index) => (
        <p key={`${index}-${error}`} className="field-error">
          {error}
        </p>
      ))}
    </article>
  );
}
