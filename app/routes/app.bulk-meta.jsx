import { useEffect, useMemo, useState } from "react";
import { Link, useFetcher, useLoaderData } from "react-router";
import seoStyles from "../styles/seo.css?url";
import { WorkspaceSubnav, dispatchCreditsUpdate } from "../components/seo-ui";
import { showToast } from "../components/toast-viewport";
import {
  loadProductsPage,
  saveBulkMetaAndRescan,
  validateBulkMetaRows,
} from "../services/seo-workflows.server";
import { requireShopContext } from "../services/route-context.server";
import { AI_FEATURES_ENABLED } from "../utils/feature-flags";

export const links = () => [{ rel: "stylesheet", href: seoStyles }];

export const loader = async ({ request }) => {
  const { shop, token, apiVersion, configError } = await requireShopContext(request);
  if (configError) {
    return { configError, rows: [] };
  }

  try {
    const result = await loadProductsPage({
      shop,
      storeDomain: shop,
      token,
      apiVersion,
      limit: 50,
      includeDescription: false,
    });

    return {
      configError: "",
      rows: result.rows,
    };
  } catch (error) {
    return {
      configError: error?.message || "Unable to load Shopify products.",
      rows: [],
    };
  }
};

export const action = async ({ request }) => {
  const { shop, token, apiVersion, configError } = await requireShopContext(request);
  if (configError) {
    return { ok: false, error: configError };
  }

  const formData = await request.formData();
  const intent = String(formData.get("intent") || "checkMeta");
  const rows = JSON.parse(String(formData.get("rows") || "[]"));

  if (intent === "checkMeta") {
    return {
      ok: true,
      ...validateBulkMetaRows(rows),
    };
  }

  if (intent === "saveMeta") {
    try {
      return await saveBulkMetaAndRescan({
        shop,
        storeDomain: shop,
        token,
        apiVersion,
        rows,
      });
    } catch (error) {
      return {
        ok: false,
        error: error?.message || "Failed to save bulk metadata.",
      };
    }
  }

  return {
    ok: false,
    error: "Unknown action.",
  };
};

function getRowStatus(statusById, id, field) {
  const status = statusById?.[id]?.[field];
  if (!status) return "Unchecked";
  if (!status.valid) return status.message;
  if (!status.ideal) return "Outside ideal range";
  return "Ideal";
}

export default function BulkMetaRoute() {
  const data = useLoaderData();
  const fetcher = useFetcher();
  const aiFetcher = useFetcher();
  const [rows, setRows] = useState(data.rows || []);
  const [aiRowId, setAiRowId] = useState("");
  const [lastAiAppliedRowId, setLastAiAppliedRowId] = useState("");

  const originalById = useMemo(() => {
    return (data.rows || []).reduce((acc, row) => {
      acc[row.id] = row;
      return acc;
    }, {});
  }, [data.rows]);

  const statusById = useMemo(() => fetcher.data?.statusById || {}, [fetcher.data]);

  function patchRow(id, patch) {
    setRows((current) =>
      current.map((row) =>
        row.id === id
          ? {
              ...row,
              ...patch,
            }
          : row,
      ),
    );
  }

  function submitIntent(intent) {
    fetcher.submit(
      {
        intent,
        rows: JSON.stringify(rows.map((row) => ({
          id: row.id,
          title: row.title,
          handle: row.handle,
          metaTitle: row.metaTitle,
          metaDescription: row.metaDescription,
          previousValues: originalById[row.id] || null,
        }))),
      },
      { method: "post" },
    );
  }

  useEffect(() => {
    if (aiFetcher.data?.ok && aiFetcher.data?.creditsRemaining !== undefined) {
      dispatchCreditsUpdate({
        availableCredits: aiFetcher.data.creditsRemaining,
        plan: aiFetcher.data.plan,
        superAccess: Boolean(aiFetcher.data.superAccess),
      });
    }
    if (aiFetcher.data?.ok && aiFetcher.data?.actionType === "meta_fix" && aiRowId) {
      patchRow(aiRowId, {
        metaTitle: aiFetcher.data.result?.metaTitle || "",
        metaDescription: aiFetcher.data.result?.metaDescription || "",
      });
      setLastAiAppliedRowId(aiRowId);
      setAiRowId("");
      showToast({
        tone: "info",
        title: "AI Meta Applied",
        message: aiFetcher.data.result?.rationale || "Suggested meta title & description applied. Click Save meta to publish.",
      });
    }

    if (aiFetcher.data?.error) {
      setAiRowId("");
    }
  }, [aiFetcher.data, aiRowId]);

  function runAiFix(row) {
    setAiRowId(row.id);
    aiFetcher.submit(
      {
        payload: JSON.stringify({
          actionType: "meta_fix",
          productId: row.id,
          title: row.title,
          focusKeyword: row.focusKeyword,
          currentMetaTitle: row.metaTitle,
          currentMetaDescription: row.metaDescription,
        }),
      },
      { method: "post", action: "/app/api/ai" },
    );
  }

  return (
    <>
      <ui-title-bar title="Products & Media — Bulk Meta" />
      <div className="seo-wrap seo-grid">
        <WorkspaceSubnav group="products" />
        {data.configError ? <div className="error-box">{data.configError}</div> : null}

        <div className="toolbar">
          <button className="seo-button secondary" type="button" onClick={() => submitIntent("checkMeta")}>
            Check meta
          </button>
          <button className="seo-button" type="button" onClick={() => submitIntent("saveMeta")} disabled={fetcher.state !== "idle"}>
            {fetcher.state !== "idle" ? "Saving..." : "Save meta"}
          </button>
        </div>

        {fetcher.data?.error ? <div className="error-box">{fetcher.data.error}</div> : null}
        {fetcher.data?.message ? <div className="error-box">{fetcher.data.message}</div> : null}
        {fetcher.data?.ok && fetcher.data?.saved ? (
          <div className="status-banner banner-good" data-toast-title="Bulk Metadata Saved">
            ✓ Saved metadata for {fetcher.data.saved} products and updated revision history.
          </div>
        ) : null}
        {aiFetcher.data?.error ? (
          <div className="error-box">
            {aiFetcher.data.error}{" "}
            {aiFetcher.data?.outOfCredits ? <Link to="/app/billing">Upgrade or manage credits</Link> : null}
          </div>
        ) : null}

        {!rows.length ? (
          <div className="empty-box">No rows available for bulk editing.</div>
        ) : (
          <div className="table-card table-wrap bulk-meta-table">
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Meta title</th>
                  <th>Meta description</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.title}</td>
                    <td>
                      <input
                        className="seo-input"
                        value={row.metaTitle}
                        onChange={(event) => patchRow(row.id, { metaTitle: event.target.value })}
                      />
                      <small>{row.metaTitle.length} chars - {getRowStatus(statusById, row.id, "metaTitle")}</small>
                    </td>
                    <td>
                      <textarea
                        rows={3}
                        className="seo-textarea"
                        value={row.metaDescription}
                        onChange={(event) => patchRow(row.id, { metaDescription: event.target.value })}
                      />
                      <small>{row.metaDescription.length} chars - {getRowStatus(statusById, row.id, "metaDescription")}</small>
                    </td>
                    <td>
                      {AI_FEATURES_ENABLED ? (
                        <button
                          className="seo-button secondary"
                          type="button"
                          onClick={() => runAiFix(row)}
                          disabled={aiFetcher.state !== "idle" && aiRowId === row.id}
                          title="Generate click-worthy meta title & description (1 token)"
                        >
                          {aiFetcher.state !== "idle" && aiRowId === row.id ? "Generating..." : "⚡ AI Fix (1 tok)"}
                        </button>
                      ) : null}
                      {AI_FEATURES_ENABLED && aiFetcher.data?.ok && lastAiAppliedRowId === row.id ? (
                        <small style={{ display: "block", marginTop: 4, color: "var(--seo-primary)" }}>
                          {aiFetcher.data.result?.rationale || "AI suggestion applied."}
                          {aiFetcher.data?.superAccess || aiFetcher.data?.creditsDeducted === 0
                            ? " (Super Access · 0 tok)"
                            : aiFetcher.data?.creditsRemaining !== undefined
                              ? ` (Balance: ${aiFetcher.data.creditsRemaining} tok left)`
                              : ""}
                        </small>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
