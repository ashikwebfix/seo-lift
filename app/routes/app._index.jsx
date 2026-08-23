/* eslint-disable react/prop-types */
import { Link, useLoaderData } from "react-router";
import seoStyles from "../styles/seo.css?url";
import { FeatureCard, MetricCard, StatusPill } from "../components/seo-ui";
import { getAppState } from "../services/app-state.server";
import { requireShopContext } from "../services/route-context.server";
import { ensureScanData } from "../services/seo-workflows.server";

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

  return {
    configError,
    scanError,
    summary: scan?.summary || null,
    pagesScanned: scan?.pagesScanned || 0,
    issueCount: scan?.issues?.length || 0,
    indexCoverage: scan?.indexCoverage || 0,
    lastScanDate: scan?.summary?.lastScanDate || null,
    trend: scan?.trend || null,
    scoreHistory: appState?.scoreHistory || [],
  };
};

function formatDate(value) {
  if (!value) return "No scan yet";
  return new Date(value).toLocaleString();
}

export default function DashboardPage() {
  const { configError, scanError, summary, pagesScanned, issueCount, indexCoverage, lastScanDate, trend, scoreHistory } = useLoaderData();
  const chartScoreHistory = [...(scoreHistory || [])];
  if (typeof summary?.score === "number" && !chartScoreHistory.some((entry) => entry?.date === summary?.lastScanDate)) {
    chartScoreHistory.push({ date: summary.lastScanDate || new Date().toISOString(), score: summary.score });
  }
  const latestScores = chartScoreHistory.slice(-8);

  return (
    <>
      <ui-title-bar title="Ecom SEO Dashboard" />
      <div className="seo-wrap seo-grid">
        {configError ? <div className="error-box">{configError}</div> : null}
        {scanError ? <div className="error-box">{scanError}</div> : null}

        <div className="toolbar" style={{ justifyContent: "space-between" }}>
          <p style={{ margin: 0 }}>
            Overall health{" "}
            <StatusPill tone={summary?.health === "strong" ? "good" : summary?.health === "steady" ? "warning" : "critical"}>
              {summary?.health || "unknown"}
            </StatusPill>
          </p>
          <Link to="/app/seo-audit">Open SEO Audit</Link>
        </div>
        <p style={{ margin: 0, color: "#5f6f86" }}>{trend?.label || "Run recurring scans to track score trend."}</p>

        <div className="seo-grid grid-4">
          <MetricCard label="SEO Score" value={summary?.score ?? "-"} helpText="Calculated from issues and quality checks" />
          <MetricCard label="Pages Scanned" value={pagesScanned} helpText="Products plus core crawl surfaces" />
          <MetricCard label="Issues" value={issueCount} helpText="Critical, warning, and info findings" />
          <MetricCard label="Index Coverage" value={`${indexCoverage}%`} helpText={`Last scan: ${formatDate(lastScanDate)}`} />
        </div>

        <div className="section-card overall-health-visuals">
          <div className="toolbar" style={{ justifyContent: "space-between" }}>
            <h3 style={{ margin: 0 }}>Overall Health Visuals</h3>
            <small style={{ margin: 0 }}>Based on latest scan and score history</small>
          </div>
          <div className="seo-grid grid-2">
            <IssuePieChart counts={summary?.counts} />
            <HealthTrendGraph points={latestScores} />
          </div>
        </div>

        <div className="seo-grid grid-3">
          <FeatureCard title="SEO Audit / Scan" description="Run a full scan and resolve prioritized findings." to="/app/seo-audit" />
          <FeatureCard title="Product SEO" description="Edit product title, keyword, metadata, and URL handle." to="/app/products" />
          <FeatureCard title="Bulk Meta Editor" description="Check and save meta title/description in bulk." to="/app/bulk-meta" />
          <FeatureCard title="Image Optimizer" description="Audit image ALT text quality and bulk-fix weak ALT tags." to="/app/image-optimizer" />
          <FeatureCard title="URL Optimization" description="Normalize and apply cleaner product handles." to="/app/url-optimization" />
          <FeatureCard title="Robots.txt Manager" description="Maintain robots rules and validate crawl directives." to="/app/robots" />
          <FeatureCard title="Sitemap Manager" description="Regenerate sitemap URL inventory with manual additions." to="/app/sitemap" />
        </div>
      </div>
        </>
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
      #d95f5f 0% ${criticalPct}%,
      #d6a246 ${criticalPct}% ${criticalPct + warningPct}%,
      #4f82bb ${criticalPct + warningPct}% ${criticalPct + warningPct + infoPct}%
    )`
    : "conic-gradient(#b8c7d8 0% 100%)";

  return (
    <div className="health-chart-card">
      <div>
        <h4>Issue Distribution</h4>
        <p>{total ? `${total} issues found` : "No issues found in latest scan"}</p>
      </div>

      <div className="pie-wrap">
        <div
          className="pie-chart"
          role="img"
          aria-label="Issue distribution pie chart"
          style={{ background: pieGradient }}
        />
      </div>

      <div className="chart-legend">
        <p><span className="dot dot-critical" /> Critical: {critical} ({formatPct(criticalPct)})</p>
        <p><span className="dot dot-warning" /> Warning: {warning} ({formatPct(warningPct)})</p>
        <p><span className="dot dot-info" /> Info: {info} ({formatPct(infoPct)})</p>
      </div>
    </div>
  );
}

function HealthTrendGraph({ points = [] }) {
  const graphPoints = points.length
    ? points.map((point) => ({ score: point?.score ?? 0, date: point?.date }))
    : [{ score: 0, date: null }];

  const width = 360;
  const height = 160;
  const padding = 16;
  const maxX = width - padding * 2;
  const maxY = height - padding * 2;
  const xStep = graphPoints.length > 1 ? maxX / (graphPoints.length - 1) : 0;

  const toY = (score) => padding + (100 - Math.max(0, Math.min(100, score))) * (maxY / 100);
  const polylinePoints = graphPoints.map((point, index) => `${padding + index * xStep},${toY(point.score)}`).join(" ");

  const latest = graphPoints.at(-1)?.score ?? 0;
  const first = graphPoints[0]?.score ?? latest;
  const change = latest - first;
  const direction = change > 0 ? "up" : change < 0 ? "down" : "flat";

  return (
    <div className="health-chart-card">
      <div>
        <h4>Health Score Trend</h4>
        <p>{direction === "flat" ? "No change in selected timeline" : `${change > 0 ? "+" : ""}${change} points over timeline`}</p>
      </div>

      <svg className="trend-graph" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="SEO health score trend graph">
        <line x1={padding} y1={padding} x2={padding} y2={height - padding} className="axis-line" />
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} className="axis-line" />
        <polyline points={polylinePoints} className="trend-line" />
        {graphPoints.map((point, index) => (
          <circle key={`${point.date || "point"}-${index}`} cx={padding + index * xStep} cy={toY(point.score)} r="4" className="trend-point" />
        ))}
      </svg>

      <div className="chart-footnote">
        <small>Latest score: {latest}</small>
      </div>
    </div>
  );
}
