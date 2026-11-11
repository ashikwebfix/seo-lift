import { useEffect, useState } from "react";
import { Link, useLocation, useMatches } from "react-router";
import { PLAN_ALLOWANCES } from "../utils/credits.js";

export function dispatchCreditsUpdate(detail) {
  if (typeof window === "undefined" || !detail) return;
  window.dispatchEvent(new CustomEvent("ecomseo:credits", { detail }));
}

const WORKSPACE_GROUPS = Object.freeze({
  products: {
    title: "Products & Media",
    subtitle: "Edit product listings, bulk meta tags, URL handles with 301 safety, and image ALT tags.",
    tabs: [
      { key: "products", label: "Product SEO", to: "/app/products" },
      { key: "bulk_meta", label: "Bulk Meta", to: "/app/bulk-meta" },
      { key: "url_optimization", label: "URLs & 301s", to: "/app/url-optimization" },
      { key: "image_optimizer", label: "Image ALT & Vision", to: "/app/image-optimizer" },
    ],
  },
  technical: {
    title: "Technical, PageSpeed & History",
    subtitle: "Manage Google crawl directives, XML sitemaps, live PageSpeed Core Web Vitals, and 1-click rollback history.",
    tabs: [
      { key: "pagespeed", label: "PageSpeed & CWV", to: "/app/pagespeed" },
      { key: "robots", label: "Robots.txt", to: "/app/robots" },
      { key: "sitemap", label: "XML Sitemap", to: "/app/sitemap" },
      { key: "revisions", label: "History & Rollback", to: "/app/revisions" },
    ],
  },
});

export const APP_MENU_GROUPS = Object.freeze([
  {
    id: "home",
    label: "Home",
    to: "/app",
    submenus: [
      { label: "SEO Checklist", to: "/app" },
      { label: "Analytics & Trends", to: "/app#analytics" },
    ],
  },
  {
    id: "audit",
    label: "AI Audit",
    featureKey: "seo_audit",
    to: "/app/seo-audit",
    submenus: [
      { label: "Store Health Scan", to: "/app/seo-audit", featureKey: "seo_audit" },
      { label: "Autopilot", to: "/app/seo-audit#autopilot", featureKey: "seo_audit" },
      { label: "Search Console (GSC)", to: "/app/seo-audit#gsc", featureKey: "seo_audit" },
      { label: "Issues & Keywords", to: "/app/seo-audit#issues", featureKey: "seo_audit" },
    ],
  },
  {
    id: "products",
    label: "Products & Media",
    to: "/app/products",
    submenus: [
      { label: "Product SEO", to: "/app/products", featureKey: "products" },
      { label: "Bulk Meta", to: "/app/bulk-meta", featureKey: "bulk_meta" },
      { label: "URLs & 301s", to: "/app/url-optimization", featureKey: "url_optimization" },
      { label: "Image ALT & Vision", to: "/app/image-optimizer", featureKey: "image_optimizer" },
    ],
  },
  {
    id: "pagespeed",
    label: "PageSpeed",
    featureKey: "pagespeed",
    to: "/app/pagespeed",
    submenus: [
      { label: "Live Speed Test", to: "/app/pagespeed", featureKey: "pagespeed" },
      { label: "AI Speed Fixing", to: "/app/pagespeed?mode=ai", featureKey: "pagespeed" },
      { label: "Manual Fixing", to: "/app/pagespeed?mode=manual", featureKey: "pagespeed" },
      { label: "Test History", to: "/app/pagespeed#history", featureKey: "pagespeed" },
    ],
  },
  {
    id: "technical",
    label: "Technical SEO",
    to: "/app/robots",
    submenus: [
      { label: "Robots.txt", to: "/app/robots", featureKey: "robots" },
      { label: "XML Sitemap", to: "/app/sitemap", featureKey: "sitemap" },
      { label: "History & Rollback", to: "/app/revisions", featureKey: "revisions" },
    ],
  },
  {
    id: "billing",
    label: "Subscription",
    to: "/app/billing",
    submenus: [
      { label: "Plans & Balance", to: "/app/billing" },
      { label: "Token Packages", to: "/app/billing#packages" },
      { label: "Usage Logs", to: "/app/billing#usage" },
    ],
  },
]);

function isSubmenuTargetActive(targetTo, pathname, search, hash) {
  const [targetPathAndQuery, targetHash = ""] = String(targetTo || "").split("#");
  const [targetPath, targetQuery = ""] = targetPathAndQuery.split("?");
  if (pathname !== targetPath) return false;

  if (targetHash) {
    return hash === `#${targetHash}`;
  }
  if (targetQuery) {
    const expected = new URLSearchParams(targetQuery);
    const current = new URLSearchParams(search || "");
    for (const [k, v] of expected.entries()) {
      if (current.get(k) !== v) return false;
    }
    return true;
  }
  if (hash) return false;
  if (targetPath === "/app/pagespeed") {
    const mode = new URLSearchParams(search || "").get("mode");
    return !mode;
  }
  return true;
}

export function AppMenuShell({ creditAccount = null, storeControl = null }) {
  const { pathname, search, hash } = useLocation();
  const [clientHash, setClientHash] = useState("");
  const isSuspended = storeControl?.accessLevel === "SUSPENDED";
  const allowedSet = new Set(storeControl?.allowedFeatures || []);

  useEffect(() => {
    setClientHash(hash || "");
    if (!hash || typeof document === "undefined") return;
    const id = hash.slice(1);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [pathname, hash]);

  if (isSuspended) return null;

  const canSee = (featureKey) => {
    if (!featureKey) return true;
    if (!storeControl || storeControl.accessLevel === "FULL") return true;
    return allowedSet.has(featureKey);
  };

  const visibleGroups = APP_MENU_GROUPS.map((group) => {
    const visibleSubmenus = group.submenus.filter((sub) => canSee(sub.featureKey));
    const allowed = canSee(group.featureKey) && visibleSubmenus.length > 0;
    return {
      ...group,
      primaryTo: visibleSubmenus[0]?.to || group.to,
      submenus: visibleSubmenus,
      allowed,
    };
  }).filter((g) => g.allowed);

  const activeGroup =
    visibleGroups.find((group) =>
      group.submenus.some((sub) => pathname === sub.to.split("#")[0].split("?")[0]),
    ) || visibleGroups[0];

  const hasSuperAccess = Boolean(storeControl?.superAccess);

  return (
    <div className="app-nav-wrap">
      <header className="app-nav-shell">
        <div className="app-nav-primary">
          <nav className="app-nav-groups" aria-label="Primary application navigation">
            {visibleGroups.map((group) => {
              const isGroupActive = activeGroup?.id === group.id;
              return (
                <div key={group.id} className="app-nav-group">
                  <Link
                    to={group.primaryTo}
                    className={`app-nav-item ${isGroupActive ? "active" : ""}`}
                  >
                    <span>{group.label}</span>
                    {group.submenus.length > 1 ? (
                      <span className="app-nav-caret" aria-hidden="true">▾</span>
                    ) : null}
                  </Link>
                  {group.submenus.length > 1 ? (
                    <div className="app-nav-dropdown" role="menu" aria-label={`${group.label} submenus`}>
                      {group.submenus.map((sub) => {
                        const subActive = isSubmenuTargetActive(sub.to, pathname, search, clientHash);
                        return (
                          <Link
                            key={sub.to}
                            to={sub.to}
                            className={`app-nav-dropdown-link ${subActive ? "active" : ""}`}
                          >
                            {sub.label}
                          </Link>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </nav>

          {creditAccount || hasSuperAccess ? (
            <CreditPill
              available={creditAccount?.availableCredits ?? 0}
              total={creditAccount?.effectiveTotal ?? PLAN_ALLOWANCES.FREE}
              plan={creditAccount?.plan || "FREE"}
              superAccess={hasSuperAccess}
            />
          ) : null}
        </div>

        {activeGroup?.submenus?.length ? (
          <nav className="app-submenu-strip" aria-label={`${activeGroup.label} submenus`}>
            <span className="app-submenu-label">{activeGroup.label}:</span>
            {activeGroup.submenus.map((sub) => {
              const subActive = isSubmenuTargetActive(sub.to, pathname, search, clientHash);
              return (
                <Link
                  key={sub.to}
                  to={sub.to}
                  className={`app-submenu-tab ${subActive ? "active" : ""}`}
                >
                  {sub.label}
                </Link>
              );
            })}
          </nav>
        ) : null}
      </header>
    </div>
  );
}

export function WorkspaceSubnav({ group }) {
  const { pathname } = useLocation();
  const matches = useMatches();
  const config = WORKSPACE_GROUPS[group];
  if (!config) return null;

  const appData = matches.find((m) => m.data && m.data.storeControl !== undefined)?.data;
  const storeControl = appData?.storeControl;
  const allowedSet = new Set(storeControl?.allowedFeatures || []);

  const visibleTabs = config.tabs.filter((tab) => {
    if (!storeControl || storeControl.accessLevel === "FULL") return true;
    return allowedSet.has(tab.key);
  });
  const activeTab = visibleTabs.find((tab) => pathname === tab.to);

  return (
    <section className="workspace-header-card">
      <div className="workspace-header-top">
        <div style={{ display: "grid", gap: "4px" }}>
          <h1 className="page-title" style={{ fontSize: "20px" }}>
            {activeTab ? `${config.title} — ${activeTab.label}` : config.title}
          </h1>
          <p className="seo-muted" style={{ fontSize: "13px" }}>
            {config.subtitle}
          </p>
        </div>
      </div>
    </section>
  );
}

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

export function CreditPill({ available = 0, total = PLAN_ALLOWANCES.FREE, plan = "FREE", superAccess = false }) {
  const [live, setLive] = useState({ available, total, plan, superAccess });

  useEffect(() => {
    setLive({ available, total, plan, superAccess });
  }, [available, total, plan, superAccess]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handleUpdate = (event) => {
      const detail = event?.detail || {};
      setLive((current) => ({
        available:
          typeof detail.availableCredits === "number" ? detail.availableCredits : current.available,
        total: typeof detail.totalCredits === "number" ? detail.totalCredits : current.total,
        plan: detail.plan || current.plan,
        superAccess:
          typeof detail.superAccess === "boolean" ? detail.superAccess : current.superAccess,
      }));
    };
    window.addEventListener("ecomseo:credits", handleUpdate);
    return () => window.removeEventListener("ecomseo:credits", handleUpdate);
  }, []);

  if (live.superAccess) {
    return (
      <Link to="/app/billing" className="credit-pill super" title="Super Access: Unlimited AI Usage">
        <span className="credit-icon">★</span>
        <span className="credit-text">Super Access · Unlimited</span>
      </Link>
    );
  }

  const isLow = live.available <= 3;
  return (
    <Link to="/app/billing" className={`credit-pill ${isLow ? "low" : "normal"}`} title="View Billing & AI Tokens">
      <span className="credit-icon">⚡</span>
      <span className="credit-text">{live.available} / {live.total} Tokens</span>
      {live.plan === "PRO" ? <span className="credit-badge-pro">PRO</span> : null}
    </Link>
  );
}

export function AiDiffInspector({ auditResult }) {
  if (!auditResult) return null;
  return (
    <div className="ai-diff-card">
      <div className="ai-diff-head">
        <div>
          <h4>🤖 Gemini SEO Impact Analysis</h4>
          <span className={`pill pill-${auditResult.riskRating === "LOW" ? "good" : auditResult.riskRating === "MODERATE" ? "warning" : "critical"}`}>
            Risk: {auditResult.riskRating}
          </span>
        </div>
        <span className="ctr-badge">Projected CTR: {auditResult.projectedCtrDelta}</span>
      </div>

      <p style={{ margin: "4px 0", fontSize: 13 }}>
        <strong>Intent Shift:</strong> {auditResult.intentShift}
      </p>

      {auditResult.keyImprovements?.length ? (
        <div className="diff-improvements">
          <strong>Key Improvements:</strong>
          <ul>
            {auditResult.keyImprovements.map((imp, idx) => (
              <li key={idx}>✅ {imp}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {auditResult.warnings?.length ? (
        <div className="diff-warnings">
          <strong>Alerts:</strong>
          <ul>
            {auditResult.warnings.map((warn, idx) => (
              <li key={idx}>⚠️ {warn}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="diff-verdict">
        <p><strong>Verdict:</strong> {auditResult.verdict}</p>
      </div>
    </div>
  );
}
