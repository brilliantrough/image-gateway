export function SidebarNav(props: {
  title?: string;
  subtitle?: string;
  items?: Array<{ href: string; label: string; meta: string }>;
  actions?: React.ReactNode;
  issueCount?: number;
  channelCount?: number;
  modelCount?: number;
  routeGroupCount?: number;
  testableModelCount?: number;
}) {
  const items =
    props.items ??
    [
      {
        href: "#overview",
        label: "Overview",
        meta: props.issueCount === 0 ? "Ready" : `${props.issueCount} issues`,
      },
      { href: "#providers", label: "Providers", meta: `${props.channelCount} channels` },
      {
        href: "#models",
        label: "Models & Routing",
        meta: `${props.modelCount} entries / ${props.routeGroupCount} groups`,
      },
      { href: "#test-bench", label: "Test Bench", meta: `${props.testableModelCount} targets` },
      { href: "#export", label: "JSON", meta: "Preview" },
    ];

  return (
    <section className="section-nav" aria-label="Config sections">
      <div className="section-nav__brand">
        <span className="brand-mark">IG</span>
        <div>
          <strong>{props.title ?? "Image Gateway"}</strong>
          <p>{props.subtitle ?? "Routing Control"}</p>
        </div>
      </div>
      <nav className="section-nav__items">
        {items.map((item) => (
          <a key={item.href} href={item.href}>
            <span>{item.label}</span>
            <small>{item.meta}</small>
          </a>
        ))}
      </nav>
      {props.actions ? <div className="section-nav__actions">{props.actions}</div> : null}
    </section>
  );
}
