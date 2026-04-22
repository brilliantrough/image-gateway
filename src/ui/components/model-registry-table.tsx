import type { ChannelConfig, ModelConfig } from "../types/config.js";

export function ModelRegistryTable(props: {
  models: ModelConfig[];
  channels: ChannelConfig[];
  onChange(modelId: string, updater: Partial<ModelConfig>): void;
}) {
  return (
    <section className="panel model-registry">
      <h2>Model Registry</h2>
      <table>
        <thead>
          <tr>
            <th>Display Name</th>
            <th>Provider Model Name</th>
            <th>Channel</th>
            <th>Enabled</th>
          </tr>
        </thead>
        <tbody>
          {props.models.map((model) => (
            <tr key={model.id}>
              <td>
                <input
                  aria-label="Display Name"
                  value={model.displayName}
                  onChange={(event) =>
                    props.onChange(model.id, { displayName: event.target.value })
                  }
                />
              </td>
              <td>
                <input
                  aria-label="Provider Model Name"
                  value={model.providerModelName}
                  onChange={(event) =>
                    props.onChange(model.id, { providerModelName: event.target.value })
                  }
                />
              </td>
              <td>
                <select
                  aria-label="Model Channel"
                  value={model.channelId}
                  onChange={(event) => props.onChange(model.id, { channelId: event.target.value })}
                >
                  {props.channels.map((channel) => (
                    <option key={channel.id} value={channel.id}>
                      {channel.name || "Unnamed Channel"}
                    </option>
                  ))}
                </select>
              </td>
              <td>
                <input
                  aria-label="Model Enabled"
                  type="checkbox"
                  checked={model.enabled}
                  onChange={(event) => props.onChange(model.id, { enabled: event.target.checked })}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
