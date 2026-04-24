export function OverviewCards(props: {
  channelCount: number;
  enabledChannelCount: number;
  modelCount: number;
  enabledModelCount: number;
  routeGroupCount: number;
  issueCount: number;
}) {
  return (
    <section id="overview" className="overview-grid" aria-label="Gateway overview">
      <MetricCard
        eyebrow="Providers"
        value={`${props.enabledChannelCount}/${props.channelCount}`}
        label="enabled channels"
      />
      <MetricCard
        eyebrow="Models"
        value={`${props.enabledModelCount}/${props.modelCount}`}
        label="enabled model routes"
      />
      <MetricCard
        eyebrow="Routing"
        value={String(props.routeGroupCount)}
        label="public model groups"
      />
      <MetricCard
        eyebrow="Config"
        value={props.issueCount === 0 ? "Clean" : String(props.issueCount)}
        label={props.issueCount === 0 ? "validation ready" : "blocking issues"}
        tone={props.issueCount === 0 ? "good" : "warn"}
      />
    </section>
  );
}

function MetricCard(props: {
  eyebrow: string;
  value: string;
  label: string;
  tone?: "good" | "warn";
}) {
  return (
    <article className={`metric-card ${props.tone ? `metric-card--${props.tone}` : ""}`}>
      <p>{props.eyebrow}</p>
      <strong>{props.value}</strong>
      <span>{props.label}</span>
    </article>
  );
}
