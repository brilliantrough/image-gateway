import { ActionBar } from "./components/action-bar.js";
import { GlobalValidationSummary } from "./components/global-summary.js";
import { validateConfig } from "./lib/validation.js";
import { initialConfig } from "./test-data/initial-config.js";
import "./styles.css";

export function UpstreamConfigPage() {
  const validation = validateConfig(initialConfig);

  return (
    <main className="page-shell">
      <h1>Upstream Config Center</h1>
      <ActionBar
        saveState={validation.canSave ? "Ready to save" : "Validation failed"}
        onAddChannel={() => {}}
        onAddModel={() => {}}
        onValidate={() => {}}
        onSave={() => {}}
        onExport={() => {}}
        disableAll
        disableSave={!validation.canSave}
      />
      <GlobalValidationSummary globalErrors={validation.globalErrors} />
    </main>
  );
}
