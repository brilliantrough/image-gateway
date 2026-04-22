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

  return (
    <section className="channel-list">
      <h2>Channel Configuration</h2>
      <div className="channel-list__grid">
        {props.channels.map((channel) => (
          <ChannelCard
            key={channel.id}
            channel={channel}
            modelCount={modelCountByChannelId.get(channel.id) ?? 0}
            models={modelsByChannelId.get(channel.id) ?? []}
            errors={props.channelFieldErrors[channel.id] ?? []}
            onDelete={() => props.onDeleteChannel(channel.id)}
            onChange={(next) => props.onChange(channel.id, next)}
            onAddModel={(modelName) => props.onAddModel(channel.id, modelName)}
            onModelChange={props.onModelChange}
            onDeleteModel={props.onDeleteModel}
          />
        ))}
      </div>
    </section>
  );
}
