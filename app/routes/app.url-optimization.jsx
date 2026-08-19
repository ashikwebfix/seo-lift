import { useMemo, useState } from "react";
import { Link, useFetcher, useLoaderData } from "react-router";
import seoStyles from "../styles/seo.css?url";
import { requireShopContext } from "../services/route-context.server";
import { applyUrlOptimizationsAndRescan, loadProductsPage } from "../services/seo-workflows.server";
import { normalizeHandle } from "../validators/seoValidators";

export const links = () => [{ rel: "stylesheet", href: seoStyles }];

export const loader = async ({ request }) => {
  const { shop, token, apiVersion, configError } = await requireShopContext(request);

  if (configError) {
    return { configError, rows: [] };
  }

  const result = await loadProductsPage({
    shop,
    storeDomain: shop,
    token,
    apiVersion,
    limit: 50,
  });

  return {
    configError: "",
    rows: result.rows.map((row) => ({
      ...row,
      suggestedHandle: normalizeHandle(row.focusKeyword ? `${row.focusKeyword} ${row.title}` : row.title),
    })),
  };
};

export const action = async ({ request }) => {
  const { shop, token, apiVersion, configError } = await requireShopContext(request);
  if (configError) {
    return { ok: false, error: configError };
  }

  const formData = await request.formData();
  const rows = JSON.parse(String(formData.get("rows") || "[]"));

  try {
    return await applyUrlOptimizationsAndRescan({
      shop,
      storeDomain: shop,
      token,
      apiVersion,
      rows,
    });
  } catch (error) {
    return {
      ok: false,
      error: error?.message || "Failed to apply URL optimizations.",
    };
  }
};

export default function UrlOptimizationRoute() {
  const data = useLoaderData();
  const fetcher = useFetcher();
  const [selected, setSelected] = useState({});
  const [manualHandles, setManualHandles] = useState({});

  const rows = useMemo(() => data.rows || [], [data.rows]);

  function toggle(id, checked) {
    setSelected((current) => ({ ...current, [id]: checked }));
  }

  function handleManualChange(id, value) {
    setManualHandles((current) => ({ ...current, [id]: value }));
  }

  function getHandleToApply(row) {
    return manualHandles[row.id] !== undefined ? manualHandles[row.id] : row.suggestedHandle;
  }

  function applySingle(row) {
    fetcher.submit(
      {
        rows: JSON.stringify([{
          id: row.id,
          title: row.title,
          handle: row.handle,
          suggestedHandle: getHandleToApply(row),
          metaTitle: row.metaTitle,
          metaDescription: row.metaDescription,
        }]),
      },
      { method: "post" }
    );
  }

  function applySelected() {
    const chosen = rows.filter((row) => selected[row.id]);
    fetcher.submit(
      {
        rows: JSON.stringify(chosen.map((row) => ({
          id: row.id,
          title: row.title,
          handle: row.handle,
          suggestedHandle: getHandleToApply(row),
          metaTitle: row.metaTitle,
          metaDescription: row.metaDescription,
        }))),
      },
      { method: "post" },
    );
  }

  return (
    <s-page full-width="true" heading="URL Optimization">
      <div className="seo-wrap seo-grid">
        {data.configError ? <div className="error-box">{data.configError}</div> : null}

        <div className="toolbar">
          <button className="seo-button" type="button" onClick={applySelected}>
            Bulk apply selected URLs
          </button>
          <Link to="/app">Dashboard</Link>
        </div>

        {fetcher.data?.error ? <div className="error-box">{fetcher.data.error}</div> : null}
        {fetcher.data?.ok ? <div className="section-card" style={{ borderLeft: "4px solid var(--seo-good)" }}>Updated {fetcher.data.updated} URLs successfully.</div> : null}

        {!rows.length ? (
          <div className="empty-box">No products found.</div>
        ) : (
          <div className="table-card table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: "60px" }}>Select</th>
                  <th style={{ width: "25%" }}>Product</th>
                  <th style={{ width: "20%" }}>Current handle</th>
                  <th style={{ width: "35%" }}>New handle (Auto / Manual)</th>
                  <th style={{ width: "120px" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const currentNewHandle = getHandleToApply(row);
                  const isDirty = row.handle !== currentNewHandle;
                  return (
                    <tr key={row.id} style={{ background: isDirty ? "rgba(223, 243, 241, 0.3)" : "transparent" }}>
                      <td>
                        <input
                          type="checkbox"
                          checked={Boolean(selected[row.id])}
                          onChange={(event) => toggle(row.id, event.target.checked)}
                        />
                      </td>
                      <td>{row.title}</td>
                      <td>
                        <span style={{ color: "var(--seo-muted)", fontSize: "13px" }}>{row.handle}</span>
                      </td>
                      <td>
                        <input
                          type="text"
                          className="seo-input"
                          style={{ padding: "6px 8px", fontSize: "13px", width: "100%", borderColor: isDirty ? "var(--seo-primary)" : "var(--seo-border)" }}
                          value={currentNewHandle}
                          onChange={(e) => handleManualChange(row.id, e.target.value)}
                        />
                      </td>
                      <td>
                        <button 
                          className="seo-button secondary" 
                          style={{ padding: "6px 12px", fontSize: "12px", width: "100%" }}
                          onClick={() => applySingle(row)}
                          disabled={!isDirty}
                        >
                          {isDirty ? "Apply" : "Optimized"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </s-page>
  );
}
