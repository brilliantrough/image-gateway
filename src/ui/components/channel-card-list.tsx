import { useEffect, useRef, useState } from "react";
import type { ChannelConfig, ModelConfig, ModelConfigUpdate } from "../types/config.js";
import { ChannelCard } from "./channel-card.js";

export function ChannelCardList(props: {
  channels: ChannelConfig[];
  models: ModelConfig[];
  channelFieldErrors: Record<string, string[]>;
  onDeleteChannel(channelId: string): void;
  onChange(channelId: string, next: ChannelConfig): void;
  onAddModel(channelId: string, modelName: string): void;
  onModelChange(modelId: string, updater: ModelConfigUpdate): void;
  onDeleteModel(modelId: string): void;
}) {
  const [selectedChannelId, setSelectedChannelId] = useState(props.channels[0]?.id ?? "");
  const previousChannelIdsRef = useRef(props.channels.map((channel) => channel.id));
  const modelCountByChannelId = new Map<string, number>();
  const modelsByChannelId = new Map<string, ModelConfig[]>();

  for (const model of props.models) {
    modelCountByChannelId.set(model.channelId, (modelCountByChannelId.get(model.channelId) ?? 0) + 1);
    const channelModels = modelsByChannelId.get(model.channelId);
    if (channelModels) {
      channelModels.push(model);
      continue;
    }

    modelsByChannelId.set(model.channelId, [model]);
  }

  useEffect(() => {
    const currentChannelIds = props.channels.map((channel) => channel.id);
    const previousChannelIds = previousChannelIdsRef.current;

    if (currentChannelIds.length === 0) {
      setSelectedChannelId("");
      previousChannelIdsRef.current = currentChannelIds;
      return;
    }

    const newestChannelId = currentChannelIds.find(
      (channelId) => !previousChannelIds.includes(channelId),
    );

    if (newestChannelId) {
      setSelectedChannelId(newestChannelId);
      previousChannelIdsRef.current = currentChannelIds;
      return;
    }

    if (!currentChannelIds.includes(selectedChannelId)) {
      setSelectedChannelId(currentChannelIds[0] ?? "");
    }

    previousChannelIdsRef.current = currentChannelIds;
  }, [props.channels, selectedChannelId]);

  const selectedChannel =
    props.channels.find((channel) => channel.id === selectedChannelId) ?? props.channels[0] ?? null;
  const selectedChannelModels = selectedChannel
    ? modelsByChannelId.get(selectedChannel.id) ?? []
    : [];
  const selectedChannelErrors = selectedChannel
    ? props.channelFieldErrors[selectedChannel.id] ?? []
    : [];
  return (
    <section id="providers" className="channel-list">
      <div className="channel-list__header">
        <h2>Channel Configuration</h2>
        <p>
          {props.channels.length} channels and {props.models.length} provider-scoped models are currently
          in the draft.
        </p>
      </div>

      <div className="channel-list__grid channel-list__grid--detail">
        <aside className="panel channel-directory" aria-label="Provider channels">
          <div className="channel-directory__header">
            <p className="settings-section__eyebrow">Providers</p>
            <h3>Channel Directory</h3>
          </div>

          <div className="channel-directory__list">
            {props.channels.map((channel) => {
              const isActive = channel.id === selectedChannel?.id;
              return (
                <button
                  key={channel.id}
                  type="button"
                  className={`channel-directory__item ${isActive ? "is-active" : ""}`}
                  onClick={() => setSelectedChannelId(channel.id)}
                >
                  <span className="channel-directory__item-main">
                    <strong>{channel.name || "New Channel"}</strong>
                    <small>{channel.protocolType}</small>
                  </span>
                  <span className="channel-directory__item-meta">
                    <span>{modelCountByChannelId.get(channel.id) ?? 0} models</span>
                    <span>{channel.enabled ? "Enabled" : "Disabled"}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        <div className="channel-list__detail">
          {selectedChannel ? (
            <ChannelCard
              key={selectedChannel.id}
              channel={selectedChannel}
              modelCount={modelCountByChannelId.get(selectedChannel.id) ?? 0}
              models={selectedChannelModels}
              errors={selectedChannelErrors}
              onDelete={() => props.onDeleteChannel(selectedChannel.id)}
              onChange={(next) => props.onChange(selectedChannel.id, next)}
              onAddModel={(modelName) => props.onAddModel(selectedChannel.id, modelName)}
              onModelChange={props.onModelChange}
              onDeleteModel={props.onDeleteModel}
            />
          ) : (
            <section className="panel channel-list__empty">
              <h3>No channels yet</h3>
              <p>Add your first provider channel from the action bar to start configuring upstreams.</p>
            </section>
          )}
        </div>
      </div>
    </section>
  );
}
