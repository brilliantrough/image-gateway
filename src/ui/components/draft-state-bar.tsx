type DraftStateBarProps = {
  saveState:
    | "Loading"
    | "No changes"
    | "Unsaved changes"
    | "Validation failed"
    | "Ready to save"
    | "Saving"
    | "Save failed"
    | "Saved";
  hasUnsavedChanges: boolean;
  isLoadingConfig: boolean;
  isSavingConfig: boolean;
  loadError: string;
  saveError: string;
  issueCount: number;
  validationCanSave: boolean;
};

export function DraftStateBar(props: DraftStateBarProps) {
  const draftStatus = props.isLoadingConfig
    ? "Loading backend config"
    : props.hasUnsavedChanges
      ? "Local draft changed"
      : "Draft matches saved config";
  const validationStatus = props.validationCanSave
    ? props.issueCount === 0
      ? "Validation clean"
      : `${props.issueCount} issues need review`
    : "Validation blocked";
  const runtimeStatus = props.loadError
    ? "Backend runtime unavailable"
    : props.isSavingConfig
      ? "Publishing runtime update"
      : props.saveError
        ? "Runtime publish failed"
        : props.hasUnsavedChanges
          ? "Runtime still on previous saved config"
          : "Runtime active";

  return (
    <section className="panel draft-state-bar" aria-label="Draft state">
      <div className="draft-state-bar__primary">
        <div>
          <p className="settings-section__eyebrow">Draft State</p>
          <h2>{props.saveState}</h2>
          <p>
            Track whether the current page is still a local draft, whether validation is blocking
            save, and whether the backend runtime is already using this version.
          </p>
        </div>
      </div>

      <div className="draft-state-bar__grid">
        <article className={`draft-state-card ${props.hasUnsavedChanges ? "is-warn" : "is-good"}`}>
          <span>Draft</span>
          <strong>{draftStatus}</strong>
          <p>{props.hasUnsavedChanges ? "There are local edits not yet published." : "No local drift detected."}</p>
        </article>

        <article
          className={`draft-state-card ${props.validationCanSave ? "is-good" : "is-warn"}`}
        >
          <span>Validation</span>
          <strong>{validationStatus}</strong>
          <p>
            {props.validationCanSave
              ? "The current config can be accepted by the backend."
              : "Fix validation errors before publishing."}
          </p>
        </article>

        <article
          className={`draft-state-card ${
            props.loadError || props.saveError ? "is-warn" : !props.hasUnsavedChanges ? "is-good" : ""
          }`}
        >
          <span>Runtime</span>
          <strong>{runtimeStatus}</strong>
          <p>
            {props.loadError
              ? "The page is operating on a local draft because runtime config loading failed."
              : props.hasUnsavedChanges
                ? "Requests are still using the previously saved backend config."
                : "Requests should now resolve against the same config shown here."}
          </p>
        </article>
      </div>
    </section>
  );
}
