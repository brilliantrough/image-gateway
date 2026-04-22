export function GlobalValidationSummary(props: { globalErrors: string[] }) {
  return (
    <section className="panel">
      <h2>Global Rules</h2>
      <ul className="rule-list">
        <li>The page configures image gateway upstream routing.</li>
        <li>Protocol is configured at the channel level.</li>
        <li>Models with the same display name are selected by descending numeric priority.</li>
        <li>Larger priority numbers win.</li>
        <li>Priorities must be unique.</li>
        <li>Disabled channels and models remain visible but do not participate in routing.</li>
      </ul>

      <h3>Validation Summary</h3>
      {props.globalErrors.length === 0 ? (
        <p>No blocking issues.</p>
      ) : (
        <ul className="error-list">
          {props.globalErrors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
