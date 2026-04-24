import type { ResolvedModelGroup } from "../types/config.js";

export function PriorityGroupCard(props: {
  group: ResolvedModelGroup;
  onPriorityChange(modelId: string, priority: number | undefined): void;
}) {
  const winner = props.group.items[0];
  const hasDuplicatePriorities = props.group.items.some((item, index) =>
    typeof item.priority === "number" &&
    props.group.items.some(
      (nextItem, nextIndex) => nextIndex !== index && nextItem.priority === item.priority,
    ),
  );

  return (
    <article className="panel priority-group-card">
      <div className="priority-group-card__header">
        <div>
          <p className="settings-section__eyebrow">Selected Group</p>
          <h3>{props.group.displayName || "Unnamed Model"}</h3>
          <p>
            This public model name has {props.group.items.length} upstream route
            {props.group.items.length === 1 ? "" : "s"}. The gateway tries the highest priority
            route first.
          </p>
        </div>
        <div className="priority-winner-card">
          <span>Current Winner</span>
          <strong>{winner?.channelName || "Unassigned"}</strong>
          <small>{winner?.priority ? `priority ${winner.priority}` : "priority unset"}</small>
        </div>
      </div>

      {hasDuplicatePriorities ? (
        <p className="field-error">
          This group contains duplicate priority values. Priorities must stay unique before saving.
        </p>
      ) : null}

      <div className="priority-group-card__rows">
        {props.group.items.map((item, index) => (
          <div
            key={item.modelId}
            data-testid={`priority-row-${props.group.displayName}`}
            className="priority-row"
          >
            <div>
              <span className="priority-row__rank">#{index + 1}</span>
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
