type SaveState = "No changes" | "Unsaved changes" | "Validation failed" | "Ready to save" | "Saved";

export function ActionBar(props: {
  saveState: SaveState;
  onAddChannel(): void;
  onAddModel(): void;
  onValidate(): void;
  onSave(): void;
  onExport(): void;
  disableSave: boolean;
  disableAddModel?: boolean;
  disableValidate?: boolean;
  disableExport?: boolean;
}) {
  return (
    <div className="action-bar">
      <div className="action-group">
        <button type="button" onClick={props.onAddChannel}>
          Add Channel
        </button>
        <button type="button" onClick={props.onAddModel} disabled={props.disableAddModel}>
          Add Model
        </button>
        <button type="button" onClick={props.onValidate} disabled={props.disableValidate}>
          Validate Config
        </button>
        <button type="button" onClick={props.onSave} disabled={props.disableSave}>
          Save Config
        </button>
        <button type="button" onClick={props.onExport} disabled={props.disableExport}>
          Export JSON
        </button>
      </div>
      <div className="save-state">{props.saveState}</div>
    </div>
  );
}
