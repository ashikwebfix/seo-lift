/* eslint-disable react/prop-types */
import { useEffect, useState } from "react";
import { Link, useFetcher, useLoaderData, useLocation } from "react-router";
import seoStyles from "../styles/seo.css?url";
import { StatusPill } from "../components/seo-ui";
import { showToast } from "../components/toast-viewport";
import { getAppState } from "../services/app-state.server";
import { requireShopContext } from "../services/route-context.server";
import { runFullScan } from "../services/seo-engine.server";
import { ensureScanData } from "../services/seo-workflows.server";
import { getOrCreateCreditAccount } from "../services/credit-manager.server";
import { getOrCreateStoreControl } from "../services/store-control.server";
import { sanitizeGscForClient } from "../services/gsc.server";
import { validateRobotsRules } from "../validators/seoValidators";
import prisma from "../db.server";

export const links = () => [{ rel: "stylesheet", href: seoStyles }];

export const loader = async ({ request }) => {
  const context = await requireShopContext(request);
  const { shop, token, apiVersion, configError } = context;

  const appState = shop ? await getAppState(shop) : null;
  let scan = appState?.lastScan || null;
  let scanError = "";

  if (!scan && !configError) {
    try {
      scan = await ensureScanData({
        shop,
        storeDomain: shop,
        token,
        apiVersion,
      });
    } catch (error) {
      scanError = error?.message || "Unable to run initial SEO scan.";
    }
  }

  let creditAccount = null;
  let hasSuperAccess = false;
  let recentRevisions = [];
  let auditSnapshots = [];
  if (shop) {
    try {
      const [creditData, storeControl, revs, snaps] = await Promise.all([
        getOrCreateCreditAccount(shop),
        getOrCreateStoreControl(shop),
        prisma.productRevision.findMany({
          where: { shop },
          orderBy: { createdAt: "desc" },
          take: 5,
          select: {
            id: true,
            productId: true,
            productTitle: true,
            changeType: true,
            redirectCreated: true,
            createdAt: true,
          },
        }),
        prisma.seoAuditSnapshot.findMany({
          where: { shop },
          orderBy: { createdAt: "desc" },
          take: 8,
          select: {
            id: true,
            overallScore: true,
            serpScore: true,
            contentScore: true,
            technicalScore: true,
            visualScore: true,
            cannibalScore: true,
            criticalCount: true,
            warningCount: true,
            infoCount: true,
            createdAt: true,
          },
        }),
      ]);
      creditAccount = creditData;
      hasSuperAccess = Boolean(storeControl?.superAccess);
      recentRevisions = revs;
      auditSnapshots = snaps;
    } catch (dbErr) {
      console.warn("Could not load credit/revisions for dashboard:", dbErr?.message);
    }
  }

  const robotsValid = validateRobotsRules(appState?.robotsTxt || "").valid;
  const sitemapReady = Boolean(appState?.sitemapGeneratedAt);
  const autopilotEnabled = Boolean(appState?.autopilot?.enabled);
  const gscSummary = sanitizeGscForClient(appState?.gsc).summary;
  const pageSpeedSummary = appState?.pageSpeed?.mobile || appState?.pageSpeed?.desktop
    ? {
        performance:
          appState?.pageSpeed?.mobile?.scores?.performance ??
          appState?.pageSpeed?.desktop?.scores?.performance ??
          null,
        seo:
          appState?.pageSpeed?.mobile?.scores?.seo ??
          appState?.pageSpeed?.desktop?.scores?.seo ??
          null,
        lastTestedAt: appState?.pageSpeed?.lastTestedAt || null,
      }
    : null;

  const compactScan = scan
    ? {
        generatedAt: scan.generatedAt,
        pagesScanned: scan.pagesScanned,
        indexCoverage: scan.indexCoverage,
        truncated: Boolean(scan.truncated),
        summary: scan.summary,
        trend: scan.trend,
        issueCount: Array.isArray(scan.issues) ? scan.issues.length : Number(scan.issueCount || 0),
      }
    : null;

  return {
    configError,
    scanError,
    scan: compactScan,
    robotsValid,
    sitemapReady,
    autopilotEnabled,
    gscSummary,
    pageSpeedSummary,
    scoreHistory: appState?.scoreHistory || [],
    creditAccount: creditAccount
      ? {
          availableCredits: creditAccount.availableCredits,
          effectiveTotal: creditAccount.effectiveTotal,
          usedCredits: creditAccount.usedCredits,
          plan: creditAccount.plan,
          percentUsed: creditAccount.percentUsed,
        }
      : null,
    hasSuperAccess,
    recentRevisions,
    auditSnapshots: auditSnapshots.reverse(),
  };
};

export const action = async ({ request }) => {
  const { shop, token, apiVersion, configError } = await requireShopContext(request);
  if (configError || !shop) {
    return { ok: false, error: configError || "Shop session required." };
  }

  try {
    const scan = await runFullScan({
      shop,
      storeDomain: shop,
      token,
      apiVersion,
    });
    const compactScan = scan
      ? {
          generatedAt: scan.generatedAt,
          pagesScanned: scan.pagesScanned,
          indexCoverage: scan.indexCoverage,
          truncated: Boolean(scan.truncated),
          summary: scan.summary,
          trend: scan.trend,
          issueCount: Array.isArray(scan.issues) ? scan.issues.length : 0,
        }
      : null;
    return { ok: true, scan: compactScan };
  } catch (error) {
    return { ok: false, error: error?.message || "Unable to complete store scan." };
  }
};

function scoreRingColor(score) {
  if (score >= 80) return "#15803d";
  if (score >= 55) return "#b45309";
  return "#b91c1c";
}

export default function DashboardPage() {
  const {
    configError,
    scanError,
    scan: loaderScan,
    robotsValid,
    sitemapReady,
    autopilotEnabled,
    gscSummary,
    pageSpeedSummary,
    scoreHistory,
    recentRevisions,
    auditSnapshots = [],
  } = useLoaderData();

  const scanFetcher = useFetcher();
  const location = useLocation();
  const [showAnalytics, setShowAnalytics] = useState(false);

  useEffect(() => {
    if (location.hash === "#analytics") {
      setShowAnalytics(true);
    }
  }, [location.hash]);

  const scan = scanFetcher.data?.scan || loaderScan;
  const summary = scan?.summary || null;
  const pillars = summary?.pillars || null;
  const pagesScanned = scan?.pagesScanned || 0;
  const indexCoverage = scan?.indexCoverage || 0;
  const trend = scan?.trend || null;
  const counts = summary?.counts || { critical: 0, warning: 0, info: 0 };
  const issueCount = scan?.issueCount ?? scan?.issues?.length ?? 0;
  const score = summary?.score ?? 0;

  useEffect(() => {
    if (scanFetcher.state === "idle" && scanFetcher.data?.ok && scanFetcher.data?.scan) {
      showToast({
        tone: "success",
        title: "Store Scan Complete",
        message: `Latest SEO score: ${scanFetcher.data.scan.summary?.score ?? 0}/100.`,
      });
    }
  }, [scanFetcher.state, scanFetcher.data]);

  const chartScoreHistory = auditSnapshots.length
    ? auditSnapshots.map((snap) => ({ date: snap.createdAt, score: snap.overallScore }))
    : [...(scoreHistory || [])];
  if (typeof summary?.score === "number" && !auditSnapshots.length && !chartScoreHistory.some((entry) => entry?.date === summary?.lastScanDate)) {
    chartScoreHistory.push({ date: summary.lastScanDate || new Date().toISOString(), score: summary.score });
  }
  const latestScores = chartScoreHistory.slice(-8);

  const prevSnapshot = auditSnapshots.length >= 2 ? auditSnapshots[auditSnapshots.length - 2] : null;
  const currSnapshot = auditSnapshots.length >= 1 ? auditSnapshots[auditSnapshots.length - 1] : null;
  const getPillarDelta = (key, currentVal) => {
    if (!prevSnapshot) return null;
    const prevVal = prevSnapshot[key];
    const nowVal = currSnapshot ? currSnapshot[key] : currentVal;
    if (typeof prevVal !== "number" || typeof nowVal !== "number") return null;
    return nowVal - prevVal;
  };

  const actionableCount = counts.critical + counts.warning;
  const visualScore = pillars?.visualScore ?? 100;

  return (
    <>
      <ui-title-bar title="Ecom SEO — Easy Workflow" />
      <div className="seo-wrap">
        <div className="audit-page-stack">
          {configError ? <div className="error-box">{configError}</div> : null}
          {scanError ? <div className="error-box">{scanError}</div> : null}
          {scanFetcher.data?.error ? <div className="error-box">{scanFetcher.data.error}</div> : null}

          {/* ── Simple Score Hero & Next Action ───────────────────────────────── */}
          <section className="audit-hero">
            <div className="score-ring-wrap">
              <div
                className="score-ring"
                style={{
                  "--score": summary ? score : 0,
                  "--ring-color": scoreRingColor(score),
                }}
              >
                <div className="score-ring-inner">
                  <span className="score-ring-value">{summary ? score : "--"}</span>
                  <span className="score-ring-max">/ 100</span>
                </div>
              </div>
              <StatusPill
                tone={
                  !summary
                    ? "info"
                    : summary.health === "strong"
                      ? "good"
                      : summary.health === "steady"
                        ? "warning"
                        : "critical"
                }
              >
                {summary?.health === "strong"
                  ? "Healthy"
                  : summary?.health === "steady"
                    ? "Needs Work"
                    : summary
                      ? "At Risk"
                      : "Pending Scan"}
              </StatusPill>
            </div>

            <div className="audit-hero-body">
              <div className="audit-hero-top">
                <div className="audit-hero-heading">
                  <h1 className="page-title">Easy Store SEO Workflow</h1>
                  <p className="seo-muted">
                    {summary ? (
                      <>
                        <strong>{pagesScanned} pages</strong> scanned · <strong>{indexCoverage}%</strong> indexable ·{" "}
                        <strong>{issueCount}</strong> total findings · {trend?.label || "Ready to optimize"}
                      </>
                    ) : (
                      "Follow the 3 simple steps below to scan your store, fix issues with Gemini AI, and keep technical SEO green."
                    )}
                  </p>
                </div>

                <div className="audit-hero-actions">
                  <scanFetcher.Form method="post">
                    <button
                      type="submit"
                      className="seo-button secondary"
                      disabled={scanFetcher.state !== "idle" || Boolean(configError)}
                    >
                      {scanFetcher.state !== "idle" ? "Scanning..." : "Re-Scan Store"}
                    </button>
                  </scanFetcher.Form>
                  <Link to="/app/seo-audit" className="seo-button">
                    {actionableCount > 0 ? `Auto-Fix ${actionableCount} Issues with AI →` : "Open AI Audit & Fix →"}
                  </Link>
                </div>
              </div>
            </div>
          </section>

          {/* ── Guided 1-2-3 Step Checklist ───────────────────────────────────── */}
          <section className="workflow-grid" aria-label="3-Step SEO Checklist">
            <article className="workflow-step-card">
              <div className="workflow-step-head">
                <span className="workflow-step-num">1</span>
                <StatusPill tone={actionableCount === 0 ? "good" : counts.critical > 0 ? "critical" : "warning"}>
                  {actionableCount === 0 ? "All Clear" : `${actionableCount} Needs Fix`}
                </StatusPill>
              </div>
              <h3>Fix Metadata &amp; Keywords with AI</h3>
              <p className="seo-muted">
                Let Gemini AI inspect your products, push position 8–20 keywords, and auto-optimize new products in the background.
              </p>
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                <StatusPill tone={autopilotEnabled ? "good" : "info"}>
                  Autopilot: {autopilotEnabled ? "ON" : "Off"}
                </StatusPill>
                {gscSummary ? (
                  <StatusPill tone="info">GSC Quick Wins: {gscSummary.quickWinsCount || 0}</StatusPill>
                ) : null}
              </div>
              <div className="workflow-step-actions">
                <Link to="/app/seo-audit" className="seo-button" style={{ fontSize: "12.5px", padding: "7px 13px" }}>
                  AI Auto-Fix →
                </Link>
                <Link to="/app/products" className="seo-button secondary" style={{ fontSize: "12.5px", padding: "7px 13px" }}>
                  Edit Products
                </Link>
              </div>
            </article>

            <article className="workflow-step-card">
              <div className="workflow-step-head">
                <span className="workflow-step-num">2</span>
                <StatusPill tone={visualScore >= 85 ? "good" : visualScore >= 60 ? "warning" : "critical"}>
                  Visual SEO: {visualScore}%
                </StatusPill>
              </div>
              <h3>Optimize Images &amp; Clean URLs</h3>
              <p className="seo-muted">
                Generate descriptive ALT tags with Vision AI and shorten messy handles with automatic Shopify 301 redirects.
              </p>
              <div className="workflow-step-actions">
                <Link to="/app/image-optimizer" className="seo-button secondary" style={{ fontSize: "12.5px", padding: "7px 13px" }}>
                  Image ALT
                </Link>
                <Link to="/app/url-optimization" className="seo-button secondary" style={{ fontSize: "12.5px", padding: "7px 13px" }}>
                  URLs &amp; 301s
                </Link>
              </div>
            </article>

            <article className="workflow-step-card">
              <div className="workflow-step-head">
                <span className="workflow-step-num">3</span>
                <StatusPill tone={robotsValid && sitemapReady ? "good" : "info"}>
                  {pageSpeedSummary?.performance !== null && pageSpeedSummary?.performance !== undefined
                    ? `Speed: ${pageSpeedSummary.performance}/100`
                    : robotsValid && sitemapReady
                      ? "Ready"
                      : "Review Setup"}
                </StatusPill>
              </div>
              <h3>Technical Setup, Speed &amp; History</h3>
              <p className="seo-muted">
                Test live Google PageSpeed &amp; Core Web Vitals with AI/manual fixes, valid robots.txt, XML sitemaps, and 1-click rollback.
              </p>
              <div className="workflow-step-actions">
                <Link to="/app/pagespeed" className="seo-button" style={{ fontSize: "12.5px", padding: "7px 13px" }}>
                  PageSpeed Test
                </Link>
                <Link to="/app/robots" className="seo-button secondary" style={{ fontSize: "12.5px", padding: "7px 13px" }}>
                  Robots &amp; Sitemap
                </Link>
                <Link to="/app/revisions" className="seo-button secondary" style={{ fontSize: "12.5px", padding: "7px 13px" }}>
                  History ({recentRevisions.length})
                </Link>
              </div>
            </article>
          </section>

          {/* ── Collapsible Analytics & Revision History Drawer ───────────────── */}
          <section id="analytics" className="section-card audit-section">
            <div className="section-header" style={{ alignItems: "center" }}>
              <div>
                <h2 style={{ margin: "0 0 2px", fontSize: "16px" }}>Detailed Analytics &amp; Recent Changes</h2>
                <p className="seo-muted" style={{ fontSize: "13px" }}>
                  5-pillar breakdowns, historical score chart, and latest product SEO edits ({recentRevisions.length} recent).
                </p>
              </div>
              <button
                type="button"
                className="seo-button secondary"
                style={{ padding: "7px 14px", fontSize: "12.5px" }}
                onClick={() => setShowAnalytics((prev) => !prev)}
              >
                {showAnalytics ? "Hide Charts & History ▲" : "Show Charts & History ▼"}
              </button>
            </div>

            {showAnalytics ? (
              <div style={{ display: "grid", gap: "18px" }}>
                <div className="grid-5">
                  <PillarScoreCard
                    label="SERP & CTR"
                    score={pillars?.serpScore ?? 75}
                    delta={getPillarDelta("serpScore", pillars?.serpScore)}
                    description="Title & Meta snippet length compliance"
                  />
                  <PillarScoreCard
                    label="Content Intent"
                    score={pillars?.contentScore ?? 80}
                    delta={getPillarDelta("contentScore", pillars?.contentScore)}
                    description="Product title & focus keyword density"
                  />
                  <PillarScoreCard
                    label="Technical SEO"
                    score={pillars?.technicalScore ?? 90}
                    delta={getPillarDelta("technicalScore", pillars?.technicalScore)}
                    description="Clean handles & robots crawl access"
                  />
                  <PillarScoreCard
                    label="Visual SEO"
                    score={pillars?.visualScore ?? 70}
                    delta={getPillarDelta("visualScore", pillars?.visualScore)}
                    description="Image ALT tag richness"
                  />
                  <PillarScoreCard
                    label="Cannibalization"
                    score={pillars?.cannibalScore ?? 100}
                    delta={getPillarDelta("cannibalScore", pillars?.cannibalScore)}
                    description="Unique vs conflicting focus keywords"
                  />
                </div>

                <div className="seo-grid grid-2">
                  <IssuePieChart counts={summary?.counts} />
                  <HealthTrendGraph points={latestScores} />
                </div>

                <div>
                  <div className="toolbar" style={{ justifyContent: "space-between", marginBottom: 10 }}>
                    <h3 style={{ margin: 0, fontSize: "15px" }}>Recent Product Edits</h3>
                    <Link to="/app/revisions" style={{ fontSize: 13 }}>
                      Open Full History &amp; Rollback →
                    </Link>
                  </div>

                  {!recentRevisions?.length ? (
                    <p className="seo-muted">No product SEO edits logged yet.</p>
                  ) : (
                    <div style={{ overflowX: "auto" }}>
                      <table className="credit-usage-table">
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Product</th>
                            <th>Change Type</th>
                            <th>301 Redirect</th>
                            <th>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {recentRevisions.map((rev) => (
                            <tr key={rev.id}>
                              <td suppressHydrationWarning>{new Date(rev.createdAt).toLocaleDateString()}</td>
                              <td>
                                <strong>{rev.productTitle || `Product #${rev.productId}`}</strong>
                              </td>
                              <td>
                                <span className="pill pill-info" style={{ fontSize: 11 }}>
                                  {rev.changeType}
                                </span>
                              </td>
                              <td>
                                {rev.redirectCreated ? (
                                  <span style={{ color: "var(--seo-good)", fontWeight: 600 }}>🛡️ Active</span>
                                ) : (
                                  <span style={{ color: "var(--seo-muted)" }}>—</span>
                                )}
                              </td>
                              <td style={{ display: "flex", gap: 10 }}>
                                <Link to={`/app/products?focus=${rev.productId}`} style={{ fontSize: 12 }}>
                                  Edit
                                </Link>
                                <Link to="/app/revisions" style={{ fontSize: 12 }}>
                                  Diff / Rollback
                                </Link>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </>
  );
}

function PillarScoreCard({ label, score, delta, description }) {
  const tone = score >= 80 ? "good" : score >= 55 ? "warn" : "bad";
  const clamped = Math.max(0, Math.min(100, Number(score) || 0));
  return (
    <div className="pillar-card">
      <p className="metric-label">{label}</p>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <h3 style={{ margin: 0, fontSize: 24, color: `var(--seo-${tone})` }}>{clamped}%</h3>
        {typeof delta === "number" && delta !== 0 ? (
          <small style={{ margin: 0, color: delta > 0 ? "var(--seo-good)" : "var(--seo-bad)", fontWeight: 700 }}>
            {delta > 0 ? `▲ +${delta}` : `▼ ${delta}`}
          </small>
        ) : null}
      </div>
      <div className="pillar-bar-track">
        <div className={`pillar-bar-fill ${tone}`} style={{ width: `${clamped}%` }} />
      </div>
      <p className="metric-help" style={{ fontSize: 11.5, margin: 0 }}>{description}</p>
    </div>
  );
}

function IssuePieChart({ counts }) {
  const critical = counts?.critical ?? 0;
  const warning = counts?.warning ?? 0;
  const info = counts?.info ?? 0;
  const total = critical + warning + info;
  const safeTotal = Math.max(1, total);
  const criticalPct = (critical / safeTotal) * 100;
  const warningPct = (warning / safeTotal) * 100;
  const infoPct = Math.max(0, 100 - criticalPct - warningPct);
  const formatPct = (value) => `${Math.round(value)}%`;
  const pieGradient = total
    ? `conic-gradient(
      #ef4444 0% ${criticalPct}%,
      #f59e0b ${criticalPct}% ${criticalPct + warningPct}%,
      #3b82f6 ${criticalPct + warningPct}% ${criticalPct + warningPct + infoPct}%
    )`
    : "conic-gradient(#e2e8f0 0% 100%)";

  return (
    <div className="health-chart-card">
      <div>
        <h4>Issue Distribution</h4>
        <p>{total ? `${total} prioritized issues found` : "No issues found in latest scan"}</p>
      </div>

      <div className="pie-wrap">
        <div
          className="pie-chart"
          role="img"
          aria-label="Issue distribution donut chart"
          style={{ background: pieGradient }}
        >
          <div className="donut-hole">
            <strong>{total}</strong>
            <small>{total === 1 ? "issue" : "issues"}</small>
          </div>
        </div>
      </div>

      <div className="chart-legend">
        <p><span className="dot dot-critical" /> Critical: <strong>{critical}</strong> ({formatPct(criticalPct)})</p>
        <p><span className="dot dot-warning" /> Warning: <strong>{warning}</strong> ({formatPct(warningPct)})</p>
        <p><span className="dot dot-info" /> Info: <strong>{info}</strong> ({formatPct(infoPct)})</p>
      </div>
    </div>
  );
}

function HealthTrendGraph({ points = [] }) {
  const graphPoints = points.length
    ? points.map((point) => ({ score: point?.score ?? 0, date: point?.date }))
    : [{ score: 0, date: null }];

  const width = 360;
  const height = 170;
  const padding = 20;
  const maxX = width - padding * 2;
  const maxY = height - padding * 2;
  const xStep = graphPoints.length > 1 ? maxX / (graphPoints.length - 1) : 0;

  const toY = (score) => padding + (100 - Math.max(0, Math.min(100, score))) * (maxY / 100);
  const coords = graphPoints.map((point, index) => ({
    x: graphPoints.length > 1 ? padding + index * xStep : padding + maxX / 2,
    y: toY(point.score),
    score: point.score,
    date: point.date,
  }));
  const polylinePoints = coords.map((p) => `${p.x},${p.y}`).join(" ");
  const areaPoints = coords.length > 1
    ? `${coords[0].x},${height - padding} ${polylinePoints} ${coords[coords.length - 1].x},${height - padding}`
    : "";

  const latest = graphPoints.at(-1)?.score ?? 0;
  const first = graphPoints[0]?.score ?? latest;
  const change = latest - first;
  const direction = change > 0 ? "up" : change < 0 ? "down" : "flat";

  return (
    <div className="health-chart-card">
      <div>
        <h4>Health Score Trend</h4>
        <p>{direction === "flat" ? "Steady across selected timeline" : `${change > 0 ? "+" : ""}${change} points over timeline`}</p>
      </div>

      <svg className="trend-graph" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="SEO health score trend graph">
        <defs>
          <linearGradient id="seoTrendFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#0f766e" stopOpacity="0.24" />
            <stop offset="100%" stopColor="#0f766e" stopOpacity="0.01" />
          </linearGradient>
        </defs>
        <line x1={padding} y1={toY(100)} x2={width - padding} y2={toY(100)} className="grid-line" />
        <line x1={padding} y1={toY(50)} x2={width - padding} y2={toY(50)} className="grid-line" />
        <line x1={padding} y1={padding} x2={padding} y2={height - padding} className="axis-line" />
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} className="axis-line" />
        {areaPoints ? <polygon points={areaPoints} fill="url(#seoTrendFill)" /> : null}
        {coords.length > 1 ? <polyline points={polylinePoints} className="trend-line" /> : null}
        {coords.map((point, index) => (
          <circle key={`${point.date || "point"}-${index}`} cx={point.x} cy={point.y} r="4.5" className="trend-point" />
        ))}
      </svg>

      <div className="chart-footnote" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <small style={{ margin: 0 }}>Latest score: <strong>{latest}/100</strong></small>
        <small style={{ margin: 0 }}>{graphPoints.length} scan{graphPoints.length === 1 ? "" : "s"}</small>
      </div>
    </div>
  );
}
