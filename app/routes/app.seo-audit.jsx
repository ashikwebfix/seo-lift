import { Form, Link, useActionData, useLoaderData, useNavigation } from "react-router";
import seoStyles from "../styles/seo.css?url";
import { StatusPill } from "../components/seo-ui";
import { getAppState } from "../services/app-state.server";
import { requireShopContext } from "../services/route-context.server";
import { runFullScan } from "../services/seo-engine.server";

export const links = () => [{ rel: "stylesheet", href: seoStyles }];

export const loader = async ({ request }) => {
  const { shop, token, apiVersion, configError } = await requireShopContext(request);
  const appState = shop ? await getAppState(shop) : null;

  return {
    configError,
    scan: appState?.lastScan || null,
  };
};

export const action = async ({ request }) => {
  const { shop, token, apiVersion, configError } = await requireShopContext(request);
  if (configError) {
    return { ok: false, error: configError };
  }

  try {
    const scan = await runFullScan({
      shop,
      storeDomain: shop,
      token,
      apiVersion,
    });

    return {
      ok: true,
      scan,
    };
  } catch (error) {
    return {
      ok: false,
      error: error?.message || "Failed to run SEO scan.",
    };
  }
};

const severityRank = {
  Critical: 0,
  Warning: 1,
  Info: 2,
};

function severityTone(severity) {
  if (severity === "Critical") return "critical";
  if (severity === "Warning") return "warning";
  return "info";
}

export default function SeoAuditRoute() {
  const data = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const scan = actionData?.scan || data.scan;

  const issues = [...(scan?.issues || [])].sort((a, b) => {
    return (severityRank[a.severity] ?? 99) - (severityRank[b.severity] ?? 99);
  });

  const isSubmitting = navigation.state === "submitting";

  return (
    <s-page full-width="true" heading="SEO Audit / Scan">
      <div className="seo-wrap seo-grid">
        {data.configError ? <div className="error-box">{data.configError}</div> : null}
        {actionData?.error ? <div className="error-box">{actionData.error}</div> : null}

        <div className="toolbar">
          <Form method="post">
            <button className="seo-button" type="submit" disabled={Boolean(data.configError)}>
              {isSubmitting ? "Scanning..." : "Run store-wide scan"}
            </button>
          </Form>
          <Link to="/app">Back to dashboard</Link>
        </div>

        <div className="seo-grid grid-4">
          <div className="metric-card">
            <p className="metric-label">Critical</p>
            <h3>{scan?.summary?.counts?.critical ?? 0}</h3>
          </div>
          <div className="metric-card">
            <p className="metric-label">Warning</p>
            <h3>{scan?.summary?.counts?.warning ?? 0}</h3>
          </div>
          <div className="metric-card">
            <p className="metric-label">Info</p>
            <h3>{scan?.summary?.counts?.info ?? 0}</h3>
          </div>
          <div className="metric-card">
            <p className="metric-label">Last Scan</p>
            <h3 style={{ fontSize: 16 }}>{scan?.summary?.lastScanDate ? new Date(scan.summary.lastScanDate).toLocaleString() : "Never"}</h3>
          </div>
        </div>

        {!issues.length ? (
          <div className="empty-box">No findings yet. Run a scan to generate prioritized issues.</div>
        ) : (
          <div className="section-card seo-grid">
            <h3 style={{ margin: 0 }}>Prioritized Findings</h3>
            {issues.map((issue) => (
              <div key={issue.id} className="table-card">
                <div className="toolbar" style={{ justifyContent: "space-between" }}>
                  <strong>{issue.title}</strong>
                  <StatusPill tone={severityTone(issue.severity)}>{issue.severity}</StatusPill>
                </div>
                <p style={{ marginBottom: 8 }}>{issue.detail}</p>
                <p style={{ margin: "0 0 10px", color: "#5f6f86" }}>{issue.targetUrl}</p>
                <Link to={issue.fixPath}>Fix now</Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </s-page>
  );
}
