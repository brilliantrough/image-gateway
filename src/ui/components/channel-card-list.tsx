import type { ChannelConfig, ModelConfig } from "../types/config.js";
import { ChannelCard } from "./channel-card.js";

export function ChannelCardList(props: {
  channels: ChannelConfig[];
  models: ModelConfig[];
  fieldErrors: string[];
  onChange(channelId: string, next: ChannelConfig): void;
}) {
  return (
    <section className="channel-list">
      <h2>Channel Configuration</h2>
      <div className="channel-list__grid">
        {props.channels.map((channel) => (
          <ChannelCard
            key={channel.id}
            channel={channel}
            modelCount={props.models.filter((model) => model.channelId === channel.id).length}
            errors={props.fieldErrors.filter((error) => error.includes(channel.id))}
            onChange={(next) => props.onChange(channel.id, next)}
          />
        ))}
      </div>
    </section>
  );
}
