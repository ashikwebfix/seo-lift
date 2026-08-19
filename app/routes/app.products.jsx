import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useFetcher, useLoaderData } from "react-router";
import seoStyles from "../styles/seo.css?url";
import { loadProductsPage, saveProductSeoAndRescan } from "../services/seo-workflows.server";
import { requireShopContext } from "../services/route-context.server";
import { AI_FEATURES_ENABLED } from "../utils/feature-flags";
import {
  validateFocusKeyword,
  validateMetaDescription,
  validateMetaTitle,
  validateProductTitle,
  validateUrlHandle,
} from "../validators/seoValidators";

export const links = () => [{ rel: "stylesheet", href: seoStyles }];

export const loader = async ({ request }) => {
  const { shop, token, apiVersion, configError } = await requireShopContext(request);
  const url = new URL(request.url);
  const query = (url.searchParams.get("q") || "").trim();
  const pageInfo = url.searchParams.get("page_info") || "";
  const focusId = url.searchParams.get("focus") || "";

  if (configError) {
    return {
      configError,
      query,
      focusId,
      rows: [],
      pagination: { nextPageInfo: "", previousPageInfo: "" },
    };
  }

  const result = await loadProductsPage({
    shop,
    storeDomain: shop,
    token,
    apiVersion,
    query,
    pageInfo,
    limit: 20,
  });

  return {
    configError: "",
    query,
    focusId,
    rows: result.rows,
    pagination: result.pagination,
  };
};

export function shouldRevalidate({ formMethod, defaultShouldRevalidate }) {
  if (String(formMethod || "").toUpperCase() === "POST") {
    return false;
  }

  return defaultShouldRevalidate;
}

export const action = async ({ request }) => {
  const { shop, token, apiVersion, configError } = await requireShopContext(request);
  if (configError) {
    return { ok: false, error: configError };
  }

  const formData = await request.formData();
  const payloadRaw = formData.get("payload");

  try {
    const payload = JSON.parse(String(payloadRaw || "{}"));
    const result = await saveProductSeoAndRescan({
      shop,
      storeDomain: shop,
      token,
      apiVersion,
      productId: payload.id,
      payload,
    });

    if (!result?.ok && !result?.error && result?.errors) {
      const firstError = Object.values(result.errors).find(Boolean);
      return {
        ...result,
        error: firstError || "Unable to save product SEO changes.",
      };
    }

    return result;
  } catch (error) {
    return {
      ok: false,
      error: error?.message || "Failed to save product SEO changes.",
    };
  }
};

function useDraftStore(rows) {
  const [drafts, setDrafts] = useState({});

  useEffect(() => {
    const raw = localStorage.getItem("seo-product-drafts");
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      setDrafts(parsed && typeof parsed === "object" ? parsed : {});
    } catch {
      setDrafts({});
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("seo-product-drafts", JSON.stringify(drafts));
  }, [drafts]);

  const mergedRows = useMemo(() => {
    return rows.map((row) => ({
      ...row,
      ...drafts[row.id],
    }));
  }, [rows, drafts]);

  const patchRow = useCallback((id, patch) => {
    setDrafts((current) => ({
      ...current,
      [id]: {
        ...(current[id] || {}),
        ...patch,
      },
    }));
  }, []);

  const clearRow = useCallback((id) => {
    setDrafts((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  }, []);

  return {
    rows: mergedRows,
    patchRow,
    clearRow,
    drafts,
  };
}

function fieldStatusMessage(validation) {
  if (!validation) return "";
  if (!validation.valid) return validation.message;
  if (typeof validation.ideal === "boolean" && !validation.ideal) {
    return "Outside ideal range";
  }
  return "Looks good";
}

function getLiveValidation(row) {
  return {
    title: validateProductTitle(row.title),
    focusKeyword: validateFocusKeyword(row.focusKeyword),
    metaTitle: validateMetaTitle(row.metaTitle),
    metaDescription: validateMetaDescription(row.metaDescription),
    handle: validateUrlHandle(row.handle),
  };
}

function getIssueItems(validation) {
  const items = [];
  if (!validation.title.valid) items.push({ tone: "critical", label: validation.title.message });
  if (!validation.focusKeyword.valid) items.push({ tone: "warning", label: validation.focusKeyword.message });
  if (!validation.metaTitle.valid) items.push({ tone: "critical", label: validation.metaTitle.message });
  if (validation.metaTitle.valid && !validation.metaTitle.ideal) items.push({ tone: "warning", label: "Meta title is outside ideal length (45-60)." });
  if (!validation.metaDescription.valid) items.push({ tone: "critical", label: validation.metaDescription.message });
  if (validation.metaDescription.valid && !validation.metaDescription.ideal) items.push({ tone: "warning", label: "Meta description is outside ideal length (120-155)." });
  if (!validation.handle.valid) items.push({ tone: "critical", label: validation.handle.message });
  return items;
}

function getHealthStatus(validation) {
  const checks = [
    validation.title.valid,
    validation.focusKeyword.valid,
    validation.metaTitle.valid,
    validation.metaDescription.valid,
    validation.handle.valid,
    Boolean(validation.metaTitle.ideal),
    Boolean(validation.metaDescription.ideal),
  ];
  const passed = checks.filter(Boolean).length;
  const percent = Math.round((passed / checks.length) * 100);

  if (checks.slice(0, 5).some((item) => !item)) {
    return { tone: "red", label: "Needs fixes", percent };
  }
  if (!validation.metaTitle.ideal || !validation.metaDescription.ideal) {
    return { tone: "orange", label: "Good, can improve", percent };
  }
  return { tone: "green", label: "Healthy", percent };
}

function getLengthState(value, rules) {
  const len = String(value || "").trim().length;
  const hardMax = rules.hardMax ?? rules.max;

  if (len > hardMax) {
    return {
      tone: "critical",
      label: `${len}/${hardMax} (${len - hardMax} over limit)`,
    };
  }
  if (typeof rules.min === "number" && len < rules.min) {
    return {
      tone: "warning",
      label: `${len}/${hardMax} (${rules.min - len} short)`,
    };
  }
  if (typeof rules.idealMin === "number" && typeof rules.idealMax === "number" && (len < rules.idealMin || len > rules.idealMax)) {
    return {
      tone: "warning",
      label: `${len}/${hardMax} (ideal ${rules.idealMin}-${rules.idealMax})`,
    };
  }
  return {
    tone: "good",
    label: `${len}/${hardMax} in range`,
  };
}

function getChangedFieldCount(row, original) {
  if (!original) return 0;
  const keys = ["title", "focusKeyword", "metaTitle", "metaDescription", "handle"];
  return keys.filter((key) => String(row[key] || "") !== String(original[key] || "")).length;
}

export default function ProductSeoRoute() {
  const data = useLoaderData();
  const saveFetcher = useFetcher();
  const listFetcher = useFetcher();
  const aiFetcher = useFetcher();
  const [pageData, setPageData] = useState(() => ({
    configError: data.configError || "",
    query: data.query || "",
    focusId: data.focusId || "",
    rows: data.rows || [],
    pagination: data.pagination || { nextPageInfo: "", previousPageInfo: "" },
  }));
  const [searchQuery, setSearchQuery] = useState(data.query || "");
  const { rows, patchRow, clearRow } = useDraftStore(pageData.rows || []);
  const [openRowId, setOpenRowId] = useState(data.focusId || "");
  const [savingRowId, setSavingRowId] = useState("");
  const [aiRowId, setAiRowId] = useState("");
  const [lastAiAppliedRowId, setLastAiAppliedRowId] = useState("");

  const syncPageData = useCallback((nextData) => {
    setPageData({
      configError: nextData.configError || "",
      query: nextData.query || "",
      focusId: nextData.focusId || "",
      rows: nextData.rows || [],
      pagination: nextData.pagination || { nextPageInfo: "", previousPageInfo: "" },
    });
    setSearchQuery(nextData.query || "");
  }, []);

  const originalById = useMemo(() => {
    return (pageData.rows || []).reduce((acc, row) => {
      acc[row.id] = row;
      return acc;
    }, {});
  }, [pageData.rows]);

  useEffect(() => {
    syncPageData(data);
  }, [data, syncPageData]);

  useEffect(() => {
    setOpenRowId((current) => {
      if (!pageData.rows?.length) return "";

      if (pageData.focusId && pageData.rows.some((row) => row.id === pageData.focusId)) {
        return pageData.focusId;
      }

      if (!current) return "";
      if (pageData.rows.some((row) => row.id === current)) return current;
      return "";
    });
  }, [pageData.rows, pageData.focusId]);

  useEffect(() => {
    if (listFetcher.data) {
      syncPageData(listFetcher.data);
    }
  }, [listFetcher.data, syncPageData]);

  useEffect(() => {
    if (saveFetcher.data?.ok && saveFetcher.data?.productId) {
      const productId = String(saveFetcher.data.productId);
      const normalized = saveFetcher.data.normalized || {};

      setPageData((current) => ({
        ...current,
        rows: current.rows.map((row) =>
          String(row.id) === productId
            ? {
                ...row,
                ...normalized,
                id: row.id,
              }
            : row,
        ),
      }));
      clearRow(productId);
      setSavingRowId("");
    }
    if (saveFetcher.data?.error) {
      setSavingRowId("");
    }
  }, [saveFetcher.data, clearRow]);

  useEffect(() => {
    if (aiFetcher.data?.ok && aiFetcher.data?.actionType === "product_seo_fix" && aiRowId) {
      patchRow(aiRowId, aiFetcher.data.result || {});
      setLastAiAppliedRowId(aiRowId);
      setAiRowId("");
    }

    if (aiFetcher.data?.error) {
      setAiRowId("");
    }
  }, [aiFetcher.data, aiRowId, patchRow]);

  const updateAddressBar = useCallback((query, pageInfo = "") => {
    if (typeof window === "undefined") return;

    const url = new URL(window.location.href);
    if (query) {
      url.searchParams.set("q", query);
    } else {
      url.searchParams.delete("q");
    }

    if (pageInfo) {
      url.searchParams.set("page_info", pageInfo);
    } else {
      url.searchParams.delete("page_info");
    }

    url.searchParams.delete("focus");
    window.history.pushState({}, "", `${url.pathname}${url.search}`);
  }, []);

  const loadList = useCallback((query, pageInfo = "") => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (pageInfo) params.set("page_info", pageInfo);

    const href = params.toString() ? `/app/products?${params.toString()}` : "/app/products";
    listFetcher.load(href);
    updateAddressBar(query, pageInfo);
  }, [listFetcher, updateAddressBar]);

  function handleSearchSubmit(event) {
    event.preventDefault();
    loadList(searchQuery.trim(), "");
  }

  function saveRow(row) {
    setSavingRowId(row.id);
    saveFetcher.submit(
      { payload: JSON.stringify(row) },
      { method: "post" },
    );
  }

  function runAiFix(row) {
    setAiRowId(row.id);
    aiFetcher.submit(
      {
        payload: JSON.stringify({
          actionType: "product_seo_fix",
          title: row.title,
          focusKeyword: row.focusKeyword,
          handle: row.handle,
          metaTitle: row.metaTitle,
          metaDescription: row.metaDescription,
        }),
      },
      { method: "post", action: "/app/api/ai" },
    );
  }

  return (
    <s-page full-width="true" heading="Product SEO Management">
      <div className="seo-wrap seo-grid">
        {pageData.configError ? <div className="error-box">{pageData.configError}</div> : null}

        <form method="get" className="toolbar" onSubmit={handleSearchSubmit}>
          <input
            className="seo-input"
            name="q"
            placeholder="Search product title"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            style={{ maxWidth: 320 }}
          />
          <button className="seo-button" type="submit" disabled={listFetcher.state !== "idle"}>
            {listFetcher.state !== "idle" ? "Searching..." : "Search"}
          </button>
          <Link to="/app">Dashboard</Link>
        </form>

        {saveFetcher.data?.error ? <div className="error-box">{saveFetcher.data.error}</div> : null}
        {aiFetcher.data?.error ? <div className="error-box">{aiFetcher.data.error}</div> : null}

        {!rows.length ? (
          <div className="empty-box">No products found for the current filter.</div>
        ) : (
          <div className="table-card product-list-card">
            <div className="product-list">
              {rows.map((row) => {
                const validation = getLiveValidation(row);
                const issues = getIssueItems(validation);
                const health = getHealthStatus(validation);
                const isOpen = openRowId === row.id;
                const changedCount = getChangedFieldCount(row, originalById[row.id]);
                const titleLen = getLengthState(row.title, { min: 25, max: 70 });
                const keywordLen = getLengthState(row.focusKeyword, { min: 3, max: 40 });
                const metaTitleLen = getLengthState(row.metaTitle, { idealMin: 45, idealMax: 60, hardMax: 65 });
                const metaDescriptionLen = getLengthState(row.metaDescription, { idealMin: 120, idealMax: 155, hardMax: 160 });
                const handleLen = getLengthState(row.handle, { min: 3, max: 45 });

                return (
                  <article key={row.id} className={`product-list-item${isOpen ? " open" : ""}`}>
                    <button type="button" className="product-list-head" onClick={() => setOpenRowId(isOpen ? "" : row.id)}>
                      <div className="product-head-main">
                        <h4>{row.title || "Untitled product"}</h4>
                        <small>/products/{row.handle || "no-handle"}</small>
                      </div>

                      <div className="product-head-side">
                        <span className={`live-health-pill ${health.tone}`}>{health.label}</span>
                        <div className="row-issues-box">
                          {issues.length ? (
                            <>
                              {issues.slice(0, 2).map((issue, index) => (
                                <span key={`${row.id}-issue-${index}`} className={`issue-chip ${issue.tone}`}>
                                  {issue.tone === "critical" ? "Critical" : "Warning"}
                                </span>
                              ))}
                              {issues.length > 2 ? <span className="issue-chip neutral">+{issues.length - 2}</span> : null}
                            </>
                          ) : (
                            <span className="issue-chip ok">No issues</span>
                          )}
                        </div>
                        <span className={`dropdown-icon${isOpen ? " open" : ""}`} aria-hidden="true">▾</span>
                      </div>
                    </button>

                    {isOpen ? (
                      <div className="product-edit-panel">
                        <div className="live-health-block">
                          <div className="live-health-head">
                            <strong>Live SEO Status</strong>
                            <span className={`health-text ${health.tone}`}>{health.percent}%</span>
                          </div>
                          <div className="live-health-track">
                            <div className={`live-health-bar ${health.tone}`} style={{ width: `${health.percent}%` }} />
                          </div>
                          <div className="live-info-grid">
                            <small>{issues.length ? `${issues.length} active issue${issues.length > 1 ? "s" : ""}` : "No active SEO issues."}</small>
                            <small>{changedCount ? `${changedCount} unsaved field change${changedCount > 1 ? "s" : ""}` : "No unsaved changes."}</small>
                          </div>
                        </div>

                        <div className="editor-grid">
                          <label className="editor-field">
                            <span>Product Title</span>
                            <input className="seo-input" value={row.title} onChange={(event) => patchRow(row.id, { title: event.target.value })} />
                            <div className="field-meta">
                              <small className={`counter ${titleLen.tone}`}>{titleLen.label}</small>
                              <small className="field-status">{fieldStatusMessage(validation.title)}</small>
                            </div>
                          </label>

                          <label className="editor-field">
                            <span>Focus Keyword</span>
                            <input className="seo-input" value={row.focusKeyword || ""} onChange={(event) => patchRow(row.id, { focusKeyword: event.target.value })} />
                            <div className="field-meta">
                              <small className={`counter ${keywordLen.tone}`}>{keywordLen.label}</small>
                              <small className="field-status">{fieldStatusMessage(validation.focusKeyword)}</small>
                            </div>
                          </label>

                          <label className="editor-field">
                            <span>Meta Title</span>
                            <input className="seo-input" value={row.metaTitle} onChange={(event) => patchRow(row.id, { metaTitle: event.target.value })} />
                            <div className="field-meta">
                              <small className={`counter ${metaTitleLen.tone}`}>{metaTitleLen.label}</small>
                              <small className="field-status">{fieldStatusMessage(validation.metaTitle)}</small>
                            </div>
                          </label>

                          <label className="editor-field editor-field-wide">
                            <span>Meta Description</span>
                            <textarea
                              className="seo-textarea seo-textarea-compact"
                              rows={3}
                              value={row.metaDescription}
                              onChange={(event) => patchRow(row.id, { metaDescription: event.target.value })}
                            />
                            <div className="field-meta">
                              <small className={`counter ${metaDescriptionLen.tone}`}>{metaDescriptionLen.label}</small>
                              <small className="field-status">{fieldStatusMessage(validation.metaDescription)}</small>
                            </div>
                          </label>

                          <label className="editor-field">
                            <span>URL Handle</span>
                            <input className="seo-input" value={row.handle} onChange={(event) => patchRow(row.id, { handle: event.target.value })} />
                            <div className="field-meta">
                              <small className={`counter ${handleLen.tone}`}>{handleLen.label}</small>
                              <small className="field-status">{fieldStatusMessage(validation.handle)}</small>
                            </div>
                          </label>
                        </div>

                        {issues.length ? (
                          <div className="live-issues-area">
                            {issues.map((issue, index) => (
                              <p key={`${row.id}-detail-${index}`} className={`live-issue-line ${issue.tone}`}>{issue.label}</p>
                            ))}
                          </div>
                        ) : null}

                        <div className="row-actions">
                          {AI_FEATURES_ENABLED ? (
                            <button
                              className="seo-button secondary"
                              type="button"
                              onClick={() => runAiFix(row)}
                              disabled={aiFetcher.state !== "idle" && aiRowId === row.id}
                            >
                              {aiFetcher.state !== "idle" && aiRowId === row.id ? "AI Fixing..." : "AI Fix"}
                            </button>
                          ) : null}
                          <button className="seo-button" type="button" onClick={() => saveRow(row)} disabled={saveFetcher.state !== "idle" && savingRowId === row.id}>
                            {saveFetcher.state !== "idle" && savingRowId === row.id ? "Saving..." : "Save Product SEO"}
                          </button>
                          <Link to="/app/seo-audit">Open SEO Audit</Link>
                        </div>
                        {AI_FEATURES_ENABLED && aiFetcher.data?.ok && lastAiAppliedRowId === row.id ? (
                          <small>{aiFetcher.data.result?.rationale || "AI suggestion applied to the form. Review and save when ready."}</small>
                        ) : null}
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </div>
        )}

        <div className="toolbar">
          <small>Showing 20 products per page</small>
          {pageData.pagination.previousPageInfo ? (
            <button
              className="seo-button"
              type="button"
              onClick={() => loadList(pageData.query || "", pageData.pagination.previousPageInfo)}
              disabled={listFetcher.state !== "idle"}
            >
              Previous page
            </button>
          ) : null}
          {pageData.pagination.nextPageInfo ? (
            <button
              className="seo-button"
              type="button"
              onClick={() => loadList(pageData.query || "", pageData.pagination.nextPageInfo)}
              disabled={listFetcher.state !== "idle"}
            >
              Next page
            </button>
          ) : null}
        </div>
      </div>
    </s-page>
  );
}
