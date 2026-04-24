import { useEffect, useRef, useState } from "react";
import type {
  ChannelConfig,
  ModelConfig,
  ModelConfigUpdate,
  ResolvedModelGroup,
} from "../types/config.js";

export function ModelRegistryTable(props: {
  models: ModelConfig[];
  channels: ChannelConfig[];
  groups: ResolvedModelGroup[];
  onChange(modelId: string, updater: ModelConfigUpdate): void;
  onDelete(modelId: string): void;
  onReorderGroup(displayName: string, sourceModelId: string, targetModelId: string): void;
}) {
  const [selectedGroupName, setSelectedGroupName] = useState(props.groups[0]?.displayName ?? "");
  const [draggedModelId, setDraggedModelId] = useState("");
  const previousGroupNamesRef = useRef(props.groups.map((group) => group.displayName));

  useEffect(() => {
    const currentGroupNames = props.groups.map((group) => group.displayName);
    const previousGroupNames = previousGroupNamesRef.current;

    if (currentGroupNames.length === 0) {
      setSelectedGroupName("");
      previousGroupNamesRef.current = currentGroupNames;
      return;
    }

    const newestGroupName = currentGroupNames.find((name) => !previousGroupNames.includes(name));
    if (newestGroupName) {
      setSelectedGroupName(newestGroupName);
      previousGroupNamesRef.current = currentGroupNames;
      return;
    }

    if (!currentGroupNames.includes(selectedGroupName)) {
      setSelectedGroupName(currentGroupNames[0] ?? "");
    }

    previousGroupNamesRef.current = currentGroupNames;
  }, [props.groups, selectedGroupName]);

  const selectedGroup =
    props.groups.find((group) => group.displayName === selectedGroupName) ?? props.groups[0] ?? null;
  const modelById = new Map(props.models.map((model) => [model.id, model]));
  const channelById = new Map(props.channels.map((channel) => [channel.id, channel]));
  const winner = selectedGroup?.items[0] ?? null;

  return (
    <section id="models" className="model-registry-shell">
      <div className="model-registry-shell__header">
        <div>
          <h2>Model Registry & Routing</h2>
          <p className="model-registry__lead">
            Select one public model name, edit every provider route that exposes it, then drag
            providers into the exact fallback order used by the gateway.
          </p>
        </div>
      </div>

      <div className="model-registry-shell__grid">
        <aside className="panel model-directory" aria-label="Routed models">
          <div className="model-directory__header">
            <p className="settings-section__eyebrow">Models</p>
            <h3>Public Model Groups</h3>
          </div>

          <div className="model-directory__list">
            {props.groups.map((group) => {
              const activeItem = group.items[0];
              const isActive = group.displayName === selectedGroup?.displayName;

              return (
                <button
                  key={group.displayName}
                  type="button"
                  className={`model-directory__item ${isActive ? "is-active" : ""}`}
                  onClick={() => setSelectedGroupName(group.displayName)}
                >
                  <span className="model-directory__item-main">
                    <strong>{group.displayName || "Unnamed Model"}</strong>
                    <small>{group.items.length} provider route{group.items.length === 1 ? "" : "s"}</small>
                  </span>
                  <span className="model-directory__item-sub">
                    <code>{activeItem?.providerModelName || "No provider model"}</code>
                    <span>First: {activeItem?.channelName || "Unassigned"}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        <div className="model-registry-shell__detail">
          {selectedGroup ? (
            <section className="panel model-registry">
              <div className="model-registry__detail-header">
                <div>
                  <p className="settings-section__eyebrow">Selected Public Model</p>
                  <h3>{selectedGroup.displayName || "Unnamed Model"}</h3>
                  <p className="model-registry__detail-copy">
                    Providers below are filtered automatically from channels that configured this
                    model. Drag a row higher to make that provider win for this public model name.
                  </p>
                </div>
                <div className="priority-winner-card">
                  <span>Current First Route</span>
                  <strong>{winner?.channelName || "Unassigned"}</strong>
                  <small>{winner?.providerModelName || "No provider target"}</small>
                </div>
              </div>

              <div className="model-registry__detail-meta">
                <div>
                  <span className="meta-label">Public Model</span>
                  <code className="model-registry__id">{selectedGroup.displayName || "Unnamed Model"}</code>
                </div>
                <div>
                  <span className="meta-label">Provider Routes</span>
                  <code>{selectedGroup.items.length}</code>
                </div>
                <div>
                  <span className="meta-label">Routing Rule</span>
                  <code>Top to bottom</code>
                </div>
              </div>

              <div className="provider-route-list" aria-label="Provider route order">
                {selectedGroup.items.map((item, index) => {
                  const model = modelById.get(item.modelId);
                  const channel = channelById.get(item.channelId);

                  if (!model) {
                    return null;
                  }

                  return (
                    <article
                      key={item.modelId}
                      className="provider-route-card"
                      draggable
                      onDragStart={() => setDraggedModelId(item.modelId)}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => {
                        event.preventDefault();
                        if (draggedModelId) {
                          props.onReorderGroup(selectedGroup.displayName, draggedModelId, item.modelId);
                        }
                        setDraggedModelId("");
                      }}
                      onDragEnd={() => setDraggedModelId("")}
                      data-testid={`priority-row-${selectedGroup.displayName}`}
                    >
                      <div className="provider-route-card__rank" aria-label={`Route rank ${index + 1}`}>
                        <span>{index + 1}</span>
                        <small>drag</small>
                      </div>

                      <div className="provider-route-card__body">
                        <div className="provider-route-card__topline">
                          <div>
                            <strong>{channel?.name || item.channelName || "Unassigned Channel"}</strong>
                            <p>{item.protocolLabel}</p>
                          </div>
                          <button
                            type="button"
                            aria-label={`Delete ${model.displayName || model.providerModelName}`}
                            onClick={() => props.onDelete(model.id)}
                          >
                            Delete
                          </button>
                        </div>

                        <div className="model-registry__detail-form provider-route-card__form">
                          <label>
                            Public Model Name
                            <input
                              aria-label="Route Display Name"
                              value={model.displayName}
                              onChange={(event) =>
                                props.onChange(model.id, { displayName: event.target.value })
                              }
                            />
                          </label>

                          <label>
                            Provider Model ID
                            <input
                              aria-label="Route Provider Model Name"
                              value={model.providerModelName}
                              onChange={(event) =>
                                props.onChange(model.id, { providerModelName: event.target.value })
                              }
                            />
                          </label>

                          <label>
                            Provider Channel
                            <select
                              aria-label="Route Model Channel"
                              value={model.channelId}
                              onChange={(event) =>
                                props.onChange(model.id, { channelId: event.target.value })
                              }
                            >
                              {props.channels.map((nextChannel) => (
                                <option key={nextChannel.id} value={nextChannel.id}>
                                  {nextChannel.name || "Unnamed Channel"}
                                </option>
                              ))}
                            </select>
                          </label>

                          <label className="model-registry__toggle">
                            <input
                              aria-label="Route Model Enabled"
                              type="checkbox"
                              checked={model.enabled}
                              onChange={(event) =>
                                props.onChange(model.id, { enabled: event.target.checked })
                              }
                            />
                            Enabled
                          </label>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ) : (
            <section className="panel model-registry model-registry--empty">
              <h3>No models yet</h3>
              <p>Create or quick-add a model from a provider channel to populate the registry.</p>
            </section>
          )}
        </div>
      </div>
    </section>
  );
}
