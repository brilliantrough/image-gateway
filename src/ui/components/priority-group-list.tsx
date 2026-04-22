import type { ResolvedModelGroup } from "../types/config.js";
import { PriorityGroupCard } from "./priority-group-card.js";

export function PriorityGroupList(props: {
  groups: ResolvedModelGroup[];
  onPriorityChange(modelId: string, priority: number | undefined): void;
}) {
  return (
    <section className="priority-group-list">
      <h2>Priority Ordering</h2>
      <div className="priority-group-list__grid">
        {props.groups.map((group) => (
          <PriorityGroupCard
            key={group.displayName}
            group={group}
            onPriorityChange={props.onPriorityChange}
          />
        ))}
      </div>
    </section>
  );
}
