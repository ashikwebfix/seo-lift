import { useState } from "react";
import { Link, useFetcher, useLoaderData } from "react-router";
import seoStyles from "../styles/seo.css?url";
import { WorkspaceSubnav } from "../components/seo-ui";
import prisma from "../db.server";
import { requireShopContext } from "../services/route-context.server";
import { rollbackProductRevision } from "../services/seo-workflows.server";

export const links = () => [{ rel: "stylesheet", href: seoStyles }];

function safeJsonParse(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

const REVISIONS_PAGE_SIZE = 25;

export const loader = async ({ request }) => {
  const { shop, configError } = await requireShopContext(request);
  if (configError || !shop) {
    return { configError, revisions: [], page: 1, totalPages: 1, totalCount: 0 };
  }

  const url = new URL(request.url);
  const requestedPage = Math.max(1, Math.floor(Number(url.searchParams.get("page") || 1) || 1));

  const totalCount = await prisma.productRevision.count({ where: { shop } });
  const totalPages = Math.max(1, Math.ceil(totalCount / REVISIONS_PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);

  const rows = await prisma.productRevision.findMany({
    where: { shop },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * REVISIONS_PAGE_SIZE,
    take: REVISIONS_PAGE_SIZE,
  });

  const revisions = rows.map((row) => ({
    id: row.id,
    productId: row.productId,
    productTitle: row.productTitle,
    changeType: row.changeType,
    before: safeJsonParse(row.beforeJson) || {},
    after: safeJsonParse(row.afterJson) || {},
    aiVerdict: safeJsonParse(row.aiVerdictJson),
    redirectCreated: row.redirectCreated,
    createdAt: row.createdAt,
  }));

  return { configError: "", revisions, page, totalPages, totalCount };
};

export const action = async ({ request }) => {
  const { shop, token, apiVersion, configError } = await requireShopContext(request);
  if (configError) {
    return { ok: false, error: configError };
  }

  const formData = await request.formData();
  const revisionId = String(formData.get("revisionId") || "").trim();

  if (!revisionId) {
    return { ok: false, error: "revisionId is required." };
  }

  try {
    const result = await rollbackProductRevision({
      shop,
      storeDomain: shop,
      token,
      apiVersion,
      revisionId,
    });
    return {
      ok: true,
      rolledBackId: revisionId,
      redirectCreated: Boolean(result?.redirectCreated),
    };
  } catch (error) {
    return {
      ok: false,
      error: error?.message || "Failed to rollback revision.",
    };
  }
};

const DIFF_FIELDS = [
  { key: "title", label: "Product Title" },
  { key: "focusKeyword", label: "Focus Keyword" },
  { key: "handle", label: "URL Handle" },
  { key: "metaTitle", label: "Meta Title" },
  { key: "metaDescription", label: "Meta Description" },
  { key: "descriptionHtml", label: "Product Description (HTML)" },
];

export default function RevisionsRoute() {
  const { configError, revisions, page = 1, totalPages = 1, totalCount = 0 } = useLoaderData();
  const fetcher = useFetcher();
  const [expandedId, setExpandedId] = useState(revisions[0]?.id || "");
  const [rollingBackId, setRollingBackId] = useState("");

  function handleRollback(revisionId) {
    setRollingBackId(revisionId);
    fetcher.submit({ revisionId }, { method: "post" });
  }

  return (
    <>
      <ui-title-bar title="Technical & History — Revisions" />
      <div className="seo-wrap seo-grid">
        <WorkspaceSubnav group="technical" />
        {configError ? <div className="error-box">{configError}</div> : null}
        {fetcher.data?.error ? <div className="error-box">{fetcher.data.error}</div> : null}
        {fetcher.data?.ok ? (
          <div className="status-banner banner-good" data-toast-title="Revision Restored">
            ✓ Revision restored in Shopify{fetcher.data.redirectCreated ? " and 301 redirect created" : ""}.
          </div>
        ) : null}

        <div className="toolbar" style={{ justifyContent: "space-between" }}>
          <p style={{ margin: 0, color: "var(--seo-muted)" }}>
            Inspect exact before/after field diffs, Gemini impact verdicts, and restore previous versions with 1 click.
          </p>
        </div>

        {!revisions.length ? (
          <div className="empty-box">
            No revisions recorded yet. Changes made in Product SEO, Bulk Meta, or URL Optimization will appear here.
          </div>
        ) : (
          <div className="seo-grid">
            {revisions.map((rev) => {
              const isOpen = expandedId === rev.id;
              const isRolling = fetcher.state !== "idle" && rollingBackId === rev.id;
              const changedFields = DIFF_FIELDS.filter(
                (f) => String(rev.before?.[f.key] ?? "") !== String(rev.after?.[f.key] ?? ""),
              );

              return (
                <div key={rev.id} className="section-card">
                  <div className="toolbar" style={{ justifyContent: "space-between", margin: 0 }}>
                    <div>
                      <strong style={{ fontSize: 15 }}>
                        {rev.productTitle || `Product #${rev.productId}`}
                      </strong>
                      <div style={{ display: "flex", gap: 8, marginTop: 4, flexWrap: "wrap", alignItems: "center" }}>
                        <span className="pill pill-info" style={{ fontSize: 11 }}>{rev.changeType}</span>
                        {rev.redirectCreated ? (
                          <span className="pill pill-good" style={{ fontSize: 11 }}>🛡️ 301 Redirect Active</span>
                        ) : null}
                        {rev.aiVerdict?.riskRating ? (
                          <span className="pill pill-warning" style={{ fontSize: 11 }}>
                            AI Risk: {rev.aiVerdict.riskRating} ({rev.aiVerdict.projectedCtrDelta})
                          </span>
                        ) : null}
                        <small style={{ color: "var(--seo-muted)" }}>
                          {new Date(rev.createdAt).toLocaleString()}
                        </small>
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <button
                        type="button"
                        className="seo-button secondary"
                        style={{ padding: "5px 10px", fontSize: 12 }}
                        onClick={() => setExpandedId(isOpen ? "" : rev.id)}
                      >
                        {isOpen ? "Hide Diff" : `Inspect Diff (${changedFields.length || "details"})`}
                      </button>
                      {rev.changeType !== "ROLLBACK" && (rev.before?.title || rev.before?.metaTitle || rev.before?.handle) ? (
                        <button
                          type="button"
                          className="seo-button"
                          style={{ padding: "5px 10px", fontSize: 12 }}
                          onClick={() => handleRollback(rev.id)}
                          disabled={fetcher.state !== "idle"}
                        >
                          {isRolling ? "Restoring..." : "↺ 1-Click Rollback"}
                        </button>
                      ) : null}
                    </div>
                  </div>

                  {isOpen ? (
                    <div style={{ marginTop: 14, borderTop: "1px solid var(--seo-border-soft)", paddingTop: 12 }}>
                      <table className="credit-usage-table">
                        <thead>
                          <tr>
                            <th style={{ width: 150 }}>Field</th>
                            <th>Before (Old)</th>
                            <th>After (New)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(changedFields.length ? changedFields : DIFF_FIELDS).map((f) => (
                            <tr key={f.key}>
                              <td><strong>{f.label}</strong></td>
                              <td style={{ background: "#fff5f5", color: "#8a2b2b", wordBreak: "break-word" }}>
                                {rev.before?.[f.key] || <em style={{ opacity: 0.6 }}>(empty)</em>}
                              </td>
                              <td style={{ background: "#f2fbf6", color: "#126b4f", wordBreak: "break-word" }}>
                                {rev.after?.[f.key] || <em style={{ opacity: 0.6 }}>(empty)</em>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      {rev.aiVerdict ? (
                        <div className="diff-verdict" style={{ marginTop: 10 }}>
                          <p style={{ margin: 0 }}>
                            <strong>🤖 Gemini Verdict:</strong> {rev.aiVerdict.verdict || rev.aiVerdict.intentShift}
                          </p>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}

        {totalPages > 1 ? (
          <div className="toolbar" style={{ justifyContent: "space-between" }}>
            <small>
              Page {page} of {totalPages} ({totalCount} total revisions)
            </small>
            <div style={{ display: "flex", gap: 8 }}>
              {page > 1 ? (
                <Link className="seo-button secondary" to={`/app/revisions?page=${page - 1}`}>
                  Previous page
                </Link>
              ) : null}
              {page < totalPages ? (
                <Link className="seo-button" to={`/app/revisions?page=${page + 1}`}>
                  Next page
                </Link>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}

