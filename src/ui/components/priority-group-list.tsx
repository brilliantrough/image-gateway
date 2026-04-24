import { useEffect, useRef, useState } from "react";
import type { ResolvedModelGroup } from "../types/config.js";
import { PriorityGroupCard } from "./priority-group-card.js";

export function PriorityGroupList(props: {
  groups: ResolvedModelGroup[];
  onPriorityChange(modelId: string, priority: number | undefined): void;
}) {
  const [selectedGroupName, setSelectedGroupName] = useState(props.groups[0]?.displayName ?? "");
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

  return (
    <section id="routing" className="priority-group-list">
      <div className="priority-group-list__header">
        <h2>Priority Ordering</h2>
        <p>
          Larger numbers win. Each duplicate public model name resolves to the highest priority
          enabled provider entry.
        </p>
      </div>

      <div className="priority-group-list__workspace">
        <aside className="panel priority-directory" aria-label="Priority groups">
          <div className="priority-directory__header">
            <p className="settings-section__eyebrow">Routing Groups</p>
            <h3>Duplicate Name Groups</h3>
          </div>

          <div className="priority-directory__list">
            {props.groups.map((group) => {
              const activeItem = group.items[0];
              const isActive = group.displayName === selectedGroup?.displayName;
              return (
                <button
                  key={group.displayName}
                  type="button"
                  className={`priority-directory__item ${isActive ? "is-active" : ""}`}
                  onClick={() => setSelectedGroupName(group.displayName)}
                >
                  <span className="priority-directory__item-main">
                    <strong>{group.displayName || "Unnamed Model"}</strong>
                    <small>{group.items.length} routes</small>
                  </span>
                  <span className="priority-directory__item-meta">
                    <span>
                      Winner: {activeItem?.channelName || "Unassigned"} · {activeItem?.priority ?? "unset"}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        <div className="priority-group-list__detail">
          {selectedGroup ? (
            <PriorityGroupCard
              group={selectedGroup}
              onPriorityChange={props.onPriorityChange}
            />
          ) : (
            <section className="panel priority-group-card">
              <h3>No duplicate groups yet</h3>
              <p className="model-registry__lead">
                Priority controls appear here once two or more upstream models share the same public
                display name.
              </p>
            </section>
          )}
        </div>
      </div>
    </section>
  );
}
