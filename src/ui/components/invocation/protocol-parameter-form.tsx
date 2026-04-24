import {
  buildInvocationFormContext,
  type InvocationPlaybookRecipe,
  type ProtocolFormSpec,
  type InvocationMode,
} from "../../lib/protocol-form-specs.js";

type ProtocolParameterFormProps = {
  spec: ProtocolFormSpec;
  mode: InvocationMode;
  modelName: string;
  values: Record<string, unknown>;
  minimalMode?: boolean;
  onValueChange: (key: string, value: unknown) => void;
  onApplyRecipe: (recipe: InvocationPlaybookRecipe) => void;
};

export function ProtocolParameterForm(props: ProtocolParameterFormProps) {
  const { spec, mode, modelName, values, minimalMode = false, onValueChange, onApplyRecipe } = props;
  const context = buildInvocationFormContext({
    protocolType: spec.protocolType,
    mode,
    modelName,
  });
  const playbook = spec.getPlaybook(context);
  const visibleGroups = spec.groups
    .map((group) => ({
      ...group,
      visibleFields: group.fields.filter(
        (field) => !field.visibleWhen || field.visibleWhen(context),
      ),
    }))
    .filter((group) => group.visibleFields.length > 0);
  const summaryChips = [
    spec.protocolType,
    context.mode,
    `${visibleGroups.length} sections`,
    `${visibleGroups.reduce((count, group) => count + group.visibleFields.length, 0)} fields`,
  ];

  return (
    <section
      id="parameters"
      className={`panel invocation-panel ${minimalMode ? "invocation-panel--minimal" : ""}`}
    >
      <div className="invocation-panel__header">
        <div>
          <h2>Parameters</h2>
          {minimalMode ? null : (
            <p>Only open-ended fields are typed manually. Protocol-bounded values use selects.</p>
          )}
        </div>
        {minimalMode ? null : <div className="invocation-summary-bar__chips invocation-summary-bar__chips--header">
          {summaryChips.map((chip) => (
            <span key={chip}>{chip}</span>
          ))}
        </div>}
      </div>

      <div className="invocation-group-list">
        {visibleGroups.map((group) => (
          <section
            key={group.id}
            className={`invocation-group-card invocation-group-card--${group.id}`}
          >
            <header className="invocation-group-card__header">
              <div>
                <h3>{group.title}</h3>
                {group.description ? (
                  <p>
                    {typeof group.description === "function"
                      ? group.description(context)
                      : group.description}
                  </p>
                ) : null}
              </div>
              <span>{group.visibleFields.length} fields</span>
            </header>

            <div className="invocation-fields">
              {group.visibleFields.map((field) => {
                const helpText =
                  typeof field.helpText === "function" ? field.helpText(context) : field.helpText;
                const value = values[field.key];
                const options =
                  typeof field.options === "function" ? field.options(context) : field.options;

                return (
                  <label
                    key={field.key}
                    className={
                      field.kind === "checkbox"
                        ? "invocation-field invocation-field--checkbox"
                        : "invocation-field"
                    }
                  >
                    <span className="invocation-field__label">{field.label}</span>
                    {field.kind === "checkbox" ? (
                      <span className="invocation-toggle">
                        <span className="invocation-toggle__copy">
                          <span>{Boolean(value) ? "Enabled" : "Disabled"}</span>
                        </span>
                        <span className="invocation-toggle__control">
                          <input
                            type="checkbox"
                            checked={value === true || value === "true"}
                            onChange={(event) =>
                              onValueChange(field.key, event.target.checked)
                            }
                          />
                          <span aria-hidden="true" className="invocation-toggle__track" />
                        </span>
                      </span>
                    ) : field.kind === "textarea" || field.kind === "json" ? (
                      <textarea
                        className={field.kind === "json" ? "invocation-json" : undefined}
                        value={String(value ?? "")}
                        placeholder={field.placeholder}
                        onChange={(event) => onValueChange(field.key, event.target.value)}
                      />
                    ) : field.kind === "select" ? (
                      <select
                        value={String(value ?? "")}
                        onChange={(event) => onValueChange(field.key, event.target.value)}
                      >
                        {(options ?? []).map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type={field.kind === "number" ? "number" : "text"}
                        value={String(value ?? "")}
                        placeholder={field.placeholder}
                        onChange={(event) => onValueChange(field.key, event.target.value)}
                      />
                    )}
                    {helpText ? <small>{helpText}</small> : null}
                  </label>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {minimalMode ? null : <section className="invocation-playbook invocation-playbook--compact">
        <header className="invocation-playbook__header">
          <div>
            <h3>{playbook.title}</h3>
            <p>{playbook.description}</p>
          </div>
          <span>{playbook.recipes.length} templates</span>
        </header>

        <div className="invocation-playbook__grid">
          {playbook.recipes.map((recipe) => (
            <article key={recipe.id} className="invocation-recipe-card">
              <div className="invocation-recipe-card__top">
                <div>
                  <h4>{recipe.title}</h4>
                  <p>{recipe.summary}</p>
                </div>
                {recipe.badge ? <span>{recipe.badge}</span> : null}
              </div>
              {recipe.values ? (
                <button type="button" onClick={() => onApplyRecipe(recipe)}>
                  Apply
                </button>
              ) : null}
            </article>
          ))}
        </div>
      </section>}

      {minimalMode ? null : <details className="invocation-protocol-notes">
        <summary>
          {spec.title} · {spec.getFamilyLabel(context.modelFamily)}
        </summary>
        <div className="invocation-protocol-notes__body">
          <p>{spec.description}</p>
          <div className="invocation-family">
            <div className="invocation-family__badge">{spec.getFamilyLabel(context.modelFamily)}</div>
            <div className="invocation-family__meta">
              <strong>Model Family</strong>
              <span>{modelName}</span>
            </div>
          </div>
          <div className="invocation-hints">
            {spec.hints.map((hint) => (
              <p key={hint}>{hint}</p>
            ))}
          </div>
          <div className="invocation-family-notes">
            {spec.getFamilyNotes(context).map((note) => (
              <p key={note}>{note}</p>
            ))}
          </div>
          <p className="invocation-summary-bar__note">
            Structured controls override duplicate keys in Raw JSON Fallback.
          </p>
        </div>
      </details>}
    </section>
  );
}
