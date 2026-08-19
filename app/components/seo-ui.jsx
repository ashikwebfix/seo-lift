import { Link } from "react-router";

export function StatusPill({ tone, children }) {
  return <span className={`pill pill-${tone}`}>{children}</span>;
}

export function MetricCard({ label, value, helpText }) {
  return (
    <div className="metric-card">
      <p className="metric-label">{label}</p>
      <h3>{value}</h3>
      {helpText ? <p className="metric-help">{helpText}</p> : null}
    </div>
  );
}

export function FeatureCard({ title, description, to }) {
  return (
    <Link to={to} className="feature-card">
      <h4>{title}</h4>
      <p>{description}</p>
      <span>Open</span>
    </Link>
  );
}
