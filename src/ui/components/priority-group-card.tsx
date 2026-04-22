import type { ResolvedModelGroup } from "../types/config.js";

export function PriorityGroupCard(props: {
  group: ResolvedModelGroup;
  onPriorityChange(modelId: string, priority: number | undefined): void;
}) {
  return (
    <article className="panel priority-group-card">
      <h3>{props.group.displayName || "Unnamed Model"}</h3>
      <div className="priority-group-card__rows">
        {props.group.items.map((item) => (
          <div
            key={item.modelId}
            data-testid={`priority-row-${props.group.displayName}`}
            className="priority-row"
          >
            <div>
              <strong>{item.channelName}</strong>
              <p>{item.protocolLabel}</p>
            </div>
            <div>
              <strong>{item.providerModelName || "Unnamed Provider Model"}</strong>
              <p>{item.enabled ? "Participates in routing" : "Inactive in routing"}</p>
            </div>
            <label>
              Priority
              <input
                aria-label="Priority"
                type="number"
                min={1}
                step={1}
                value={item.priority ?? ""}
                onChange={(event) => {
                  const value = event.target.value;
                  props.onPriorityChange(
                    item.modelId,
                    value === "" ? undefined : Number.parseInt(value, 10),
                  );
                }}
              />
            </label>
          </div>
        ))}
      </div>
    </article>
  );
}
