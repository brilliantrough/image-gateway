type SaveState = "No changes" | "Unsaved changes" | "Validation failed" | "Ready to save" | "Saved";

export function ActionBar(props: {
  saveState: SaveState;
  onAddChannel(): void;
  onAddModel(): void;
  onValidate(): void;
  onSave(): void;
  onExport(): void;
  disableSave: boolean;
}) {
  return (
    <div className="action-bar">
      <div className="action-group">
        <button type="button" onClick={props.onAddChannel}>
          Add Channel
        </button>
        <button type="button" onClick={props.onAddModel}>
          Add Model
        </button>
        <button type="button" onClick={props.onValidate}>
          Validate Config
        </button>
        <button type="button" onClick={props.onSave} disabled={props.disableSave}>
          Save Config
        </button>
        <button type="button" onClick={props.onExport}>
          Export JSON
        </button>
      </div>
      <div className="save-state">{props.saveState}</div>
    </div>
  );
}
