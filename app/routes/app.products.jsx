import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useFetcher, useLoaderData } from "react-router";
import seoStyles from "../styles/seo.css?url";
import { AiDiffInspector, WorkspaceSubnav, dispatchCreditsUpdate } from "../components/seo-ui";
import { showToast } from "../components/toast-viewport";
import { loadProductsPage, saveProductSeoAndRescan } from "../services/seo-workflows.server";
import { requireShopContext } from "../services/route-context.server";
import { AI_FEATURES_ENABLED } from "../utils/feature-flags";
import { CREDIT_COSTS } from "../utils/credits.js";
import {
  evaluateOnPageSeoSignals,
  normalizeHandle,
  sanitizeProductDescriptionHtml,
  stripHtmlTags,
  validateFocusKeyword,
  validateMetaDescription,
  validateMetaTitle,
  validateProductDescription,
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
      shop: shop || "",
      query,
      focusId,
      rows: [],
      pagination: { nextPageInfo: "", previousPageInfo: "" },
    };
  }

  try {
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
      shop: shop || "",
      query,
      focusId,
      rows: result.rows,
      pagination: result.pagination,
    };
  } catch (error) {
    return {
      configError: error?.message || "Unable to load Shopify products.",
      shop: shop || "",
      query,
      focusId,
      rows: [],
      pagination: { nextPageInfo: "", previousPageInfo: "" },
    };
  }
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
    description: validateProductDescription(row.descriptionHtml || "", row.focusKeyword || ""),
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
  if (!validation.description.valid) {
    items.push({ tone: "critical", label: validation.description.message });
  } else if (!validation.description.ideal && validation.description.message) {
    items.push({ tone: "warning", label: validation.description.message });
  }
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
    Boolean(validation.description.valid && validation.description.wordCount >= 80),
  ];
  const passed = checks.filter(Boolean).length;
  const percent = Math.round((passed / checks.length) * 100);

  if (checks.slice(0, 5).some((item) => !item) || !validation.description.valid) {
    return { tone: "red", label: "Needs fixes", percent };
  }
  if (!validation.metaTitle.ideal || !validation.metaDescription.ideal || !validation.description.ideal) {
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
  const keys = ["title", "focusKeyword", "metaTitle", "metaDescription", "handle", "descriptionHtml"];
  return keys.filter((key) => String(row[key] || "") !== String(original[key] || "")).length;
}

function buildMinorSeoPatch(row, { preserveHandle = true } = {}) {
  const cleanSpace = (text) => String(text || "").replace(/\s+/g, " ").trim();
  const nextTitle = cleanSpace(row.title);
  let nextKeyword = cleanSpace(row.focusKeyword);
  if (!nextKeyword && nextTitle) {
    nextKeyword = nextTitle.split(/\s+/).slice(0, 4).join(" ").slice(0, 40).trim();
  }

  let nextMetaTitle = cleanSpace(row.metaTitle);
  if (!nextMetaTitle && nextTitle) {
    nextMetaTitle = `${nextTitle}${nextKeyword ? ` | ${nextKeyword}` : ""}`.slice(0, 60).trim();
  }

  let nextMetaDescription = cleanSpace(row.metaDescription);
  if (!nextMetaDescription) {
    const plainBody = stripHtmlTags(row.descriptionHtml || "");
    const baseText = plainBody || `${nextTitle}. Quality craft, fast shipping, and dependable value for everyday buyers.`;
    nextMetaDescription = baseText.slice(0, 155).trim();
  }

  const nextHandle =
    preserveHandle && validateUrlHandle(row.handle || "").valid
      ? row.handle
      : normalizeHandle(row.handle || nextTitle);

  return {
    title: nextTitle,
    focusKeyword: nextKeyword,
    metaTitle: nextMetaTitle,
    metaDescription: nextMetaDescription,
    handle: nextHandle,
  };
}

export default function ProductSeoRoute() {
  const data = useLoaderData();
  const saveFetcher = useFetcher();
  const listFetcher = useFetcher();
  const aiFetcher = useFetcher();
  const [pageData, setPageData] = useState(() => ({
    configError: data.configError || "",
    shop: data.shop || "",
    query: data.query || "",
    focusId: data.focusId || "",
    rows: data.rows || [],
    pagination: data.pagination || { nextPageInfo: "", previousPageInfo: "" },
  }));
  const [searchQuery, setSearchQuery] = useState(data.query || "");
  const [listFilter, setListFilter] = useState("all");
  const { rows, patchRow, clearRow } = useDraftStore(pageData.rows || []);
  const [openRowId, setOpenRowId] = useState(data.focusId || "");
  const [savingRowId, setSavingRowId] = useState("");
  const [aiRowId, setAiRowId] = useState("");
  const [aiActionLabel, setAiActionLabel] = useState("");
  const [lastAiAppliedRowId, setLastAiAppliedRowId] = useState("");
  const [aiNotesById, setAiNotesById] = useState({});
  const [auditResultsById, setAuditResultsById] = useState({});
  const [previewDescById, setPreviewDescById] = useState({});
  const [preserveHandleById, setPreserveHandleById] = useState({});

  const syncPageData = useCallback((nextData) => {
    setPageData({
      configError: nextData.configError || "",
      shop: nextData.shop || "",
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

      if (pageData.rows.length === 1) {
        return pageData.rows[0].id;
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
      showToast({
        tone: "success",
        title: "Product SEO Saved",
        message: `Saved "${normalized.title || "Product"}"${saveFetcher.data.redirectCreated ? " and created 301 redirect" : ""}.`,
      });
    }
    if (saveFetcher.data?.error) {
      setSavingRowId("");
    }
  }, [saveFetcher.data, clearRow]);

  useEffect(() => {
    if (aiFetcher.data?.ok && aiFetcher.data?.creditsRemaining !== undefined) {
      dispatchCreditsUpdate({
        availableCredits: aiFetcher.data.creditsRemaining,
        plan: aiFetcher.data.plan,
        superAccess: Boolean(aiFetcher.data.superAccess),
      });
    }
    if (aiFetcher.data?.ok && aiFetcher.data?.actionType === "product_seo_fix" && aiRowId) {
      const result = aiFetcher.data.result || {};
      const patch = {
        title: result.title,
        focusKeyword: result.focusKeyword,
        handle: result.handle,
        metaTitle: result.metaTitle,
        metaDescription: result.metaDescription,
        ...(typeof result.descriptionHtml === "string" && result.descriptionHtml
          ? { descriptionHtml: result.descriptionHtml }
          : {}),
      };
      patchRow(aiRowId, patch);
      if (result.rationale) {
        setAiNotesById((current) => ({ ...current, [aiRowId]: result.rationale }));
      }
      setLastAiAppliedRowId(aiRowId);
      setAiRowId("");
      setAiActionLabel("");
      showToast({
        tone: "info",
        title: "AI SEO Suggestion Ready",
        message: result.rationale || "Gemini SEO & content fields populated. Review and click Save Product SEO.",
      });
    }

    if (aiFetcher.data?.ok && aiFetcher.data?.actionType === "product_content_fix" && aiRowId) {
      const result = aiFetcher.data.result || {};
      if (typeof result.descriptionHtml === "string") {
        patchRow(aiRowId, { descriptionHtml: result.descriptionHtml });
      }
      if (result.summary) {
        setAiNotesById((current) => ({ ...current, [aiRowId]: result.summary }));
      }
      setLastAiAppliedRowId(aiRowId);
      setAiRowId("");
      setAiActionLabel("");
      showToast({
        tone: "info",
        title: "Product Copy Updated",
        message: result.summary || "Gemini improved product description HTML. Review and save to Shopify.",
      });
    }

    if (aiFetcher.data?.ok && aiFetcher.data?.actionType === "audit_change" && aiRowId) {
      setAuditResultsById((current) => ({
        ...current,
        [aiRowId]: aiFetcher.data.result,
      }));
      setLastAiAppliedRowId(aiRowId);
      setAiRowId("");
      setAiActionLabel("");
      showToast({
        tone: "info",
        title: "AI Impact Analysis Complete",
        message: aiFetcher.data.result?.verdict || "Review the Gemini Diff Audit card below.",
      });
    }

    if (aiFetcher.data?.error) {
      setAiRowId("");
      setAiActionLabel("");
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
    const original = originalById[row.id] || {};
    saveFetcher.submit(
      {
        payload: JSON.stringify({
          ...row,
          originalHandle: original.handle || "",
          previousValues: original,
          aiVerdict: auditResultsById[row.id] || null,
        }),
      },
      { method: "post" },
    );
  }

  function isHandleLocked(row) {
    if (preserveHandleById[row.id] !== undefined) {
      return preserveHandleById[row.id];
    }
    return validateUrlHandle(originalById[row.id]?.handle || row.handle || "").valid;
  }

  function runAiFix(row, mode = "full") {
    const keepHandle = isHandleLocked(row);
    setAiRowId(row.id);
    setAiActionLabel(mode === "minor" ? "minor" : "full");
    aiFetcher.submit(
      {
        payload: JSON.stringify({
          actionType: "product_seo_fix",
          mode,
          preserveHandle: keepHandle,
          productId: row.id,
          title: row.title,
          focusKeyword: row.focusKeyword,
          handle: row.handle,
          metaTitle: row.metaTitle,
          metaDescription: row.metaDescription,
          descriptionHtml: row.descriptionHtml || "",
          productType: row.productType || "",
          tags: row.tags || "",
        }),
      },
      { method: "post", action: "/app/api/ai" },
    );
  }

  function runAiContentFix(row, goal = "polish") {
    setAiRowId(row.id);
    setAiActionLabel(`content_${goal}`);
    aiFetcher.submit(
      {
        payload: JSON.stringify({
          actionType: "product_content_fix",
          goal,
          productId: row.id,
          title: row.title,
          focusKeyword: row.focusKeyword,
          descriptionHtml: row.descriptionHtml || "",
          productType: row.productType || "",
          tags: row.tags || "",
        }),
      },
      { method: "post", action: "/app/api/ai" },
    );
  }

  function runAiAudit(row) {
    setAiRowId(row.id);
    setAiActionLabel("audit");
    const original = originalById[row.id] || {};
    aiFetcher.submit(
      {
        payload: JSON.stringify({
          actionType: "audit_change",
          productId: row.id,
          title: row.title,
          currentValues: original,
          newValues: row,
        }),
      },
      { method: "post", action: "/app/api/ai" },
    );
  }

  function applyLocalMinorTuneUp(row) {
    const patch = buildMinorSeoPatch(row, { preserveHandle: isHandleLocked(row) });
    patchRow(row.id, patch);
    showToast({
      tone: "info",
      title: "Minor SEO Tune-Up Applied",
      message: "Cleaned spacing, filled missing essentials, and preserved existing copy. Click Save to apply.",
    });
  }

  function applyCleanSlug(row) {
    const cleanSlug = normalizeHandle(row.handle || row.title || "");
    patchRow(row.id, { handle: cleanSlug });
  }

  function revertDraft(rowId) {
    clearRow(rowId);
    setAiNotesById((current) => {
      const next = { ...current };
      delete next[rowId];
      return next;
    });
    showToast({
      tone: "info",
      title: "Draft Reverted",
      message: "Restored product fields to saved Shopify values.",
    });
  }

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (listFilter === "all") return true;
      const validation = getLiveValidation(row);
      const changed = getChangedFieldCount(row, originalById[row.id]) > 0;
      if (listFilter === "unsaved") return changed;
      if (listFilter === "thin_copy") return validation.description.wordCount < 80;
      if (listFilter === "needs_fix") return getIssueItems(validation).length > 0;
      return true;
    });
  }, [rows, listFilter, originalById]);

  return (
    <>
      <ui-title-bar title="Products & Media — Product SEO" />
      <div className="seo-wrap seo-grid">
        <WorkspaceSubnav group="products" />
        {pageData.configError ? <div className="error-box">{pageData.configError}</div> : null}

        <div className="toolbar" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <form method="get" style={{ display: "flex", gap: 8, flex: "1 1 320px", alignItems: "center" }} onSubmit={handleSearchSubmit}>
            <input
              className="seo-input"
              name="q"
              placeholder="Search product title..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              style={{ maxWidth: 320 }}
            />
            <button className="seo-button" type="submit" disabled={listFetcher.state !== "idle"}>
              {listFetcher.state !== "idle" ? "Searching..." : "Search"}
            </button>
          </form>

          <div className="filter-pills" role="group" aria-label="Quick product SEO filter">
            {[
              { id: "all", label: `All (${rows.length})` },
              { id: "needs_fix", label: "Needs Fixes" },
              { id: "thin_copy", label: "Thin Copy (<80w)" },
              { id: "unsaved", label: "Unsaved Drafts" },
            ].map((pill) => (
              <button
                key={pill.id}
                type="button"
                className={`filter-pill${listFilter === pill.id ? " active" : ""}`}
                onClick={() => setListFilter(pill.id)}
              >
                {pill.label}
              </button>
            ))}
          </div>
        </div>

        {saveFetcher.data?.error ? <div className="error-box">{saveFetcher.data.error}</div> : null}
        {aiFetcher.data?.error ? <div className="error-box">{aiFetcher.data.error}</div> : null}

        {!filteredRows.length ? (
          <div className="empty-box">No products found for the current filter.</div>
        ) : (
          <div className="table-card product-list-card">
            <div className="product-list">
              {filteredRows.map((row) => {
                const validation = getLiveValidation(row);
                const issues = getIssueItems(validation);
                const health = getHealthStatus(validation);
                const signals = evaluateOnPageSeoSignals(row);
                const isOpen = openRowId === row.id;
                const changedCount = getChangedFieldCount(row, originalById[row.id]);
                const titleLen = getLengthState(row.title, { min: 25, max: 70 });
                const keywordLen = getLengthState(row.focusKeyword, { min: 3, max: 40 });
                const metaTitleLen = getLengthState(row.metaTitle, { idealMin: 45, idealMax: 60, hardMax: 65 });
                const metaDescriptionLen = getLengthState(row.metaDescription, { idealMin: 120, idealMax: 155, hardMax: 160 });
                const handleLen = getLengthState(row.handle, { min: 3, max: 45 });
                const handleLocked = isHandleLocked(row);
                const isAiBusy = aiFetcher.state !== "idle" && aiRowId === row.id;
                const showPreview = Boolean(previewDescById[row.id]);
                const serpHost = pageData.shop || "your-store.myshopify.com";
                const serpTitle = String(row.metaTitle || row.title || "Untitled Product").trim();
                const serpDesc =
                  String(row.metaDescription || "").trim() ||
                  stripHtmlTags(row.descriptionHtml || "").slice(0, 155) ||
                  "Add a compelling 120-155 character meta description to improve organic CTR from Google Search.";

                return (
                  <article key={row.id} className={`product-list-item${isOpen ? " open" : ""}`}>
                    <button type="button" className="product-list-head" onClick={() => setOpenRowId(isOpen ? "" : row.id)}>
                      <div className="product-head-main">
                        <h4>{row.title || "Untitled product"}</h4>
                        <small>
                          /products/{row.handle || "no-handle"} · {validation.description.wordCount} words
                          {row.productType ? ` · ${row.productType}` : ""}
                        </small>
                      </div>

                      <div className="product-head-side">
                        {changedCount > 0 ? (
                          <span className="issue-chip neutral" title="You have unsaved edits for this product">
                            {changedCount} Unsaved
                          </span>
                        ) : null}
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
                            <strong>Live On-Page SEO Score ({signals.passedCount}/{signals.totalCount} signals)</strong>
                            <span className={`health-text ${health.tone}`}>{signals.scorePercent}%</span>
                          </div>
                          <div className="live-health-track">
                            <div className={`live-health-bar ${health.tone}`} style={{ width: `${signals.scorePercent}%` }} />
                          </div>
                          <div className="live-info-grid">
                            <small>{issues.length ? `${issues.length} active issue${issues.length > 1 ? "s" : ""}` : "No active SEO issues."}</small>
                            <small>{changedCount ? `${changedCount} unsaved change${changedCount > 1 ? "s" : ""}` : "Synced with Shopify"}</small>
                          </div>
                          <div className="signal-chips">
                            {[
                              { label: "Keyword in Title", passed: signals.keywordInTitle },
                              { label: "Keyword in Meta Title", passed: signals.keywordInMetaTitle },
                              { label: "Keyword in Meta Desc", passed: signals.keywordInMetaDescription },
                              { label: "Keyword in URL", passed: signals.keywordInHandle },
                              { label: "Keyword in Content", passed: signals.keywordInDescription },
                              {
                                label: `${validation.description.wordCount}w Content`,
                                passed: validation.description.wordCount >= 80 && validation.description.hasStructure,
                              },
                            ].map((chip) => (
                              <span key={chip.label} className={`signal-chip ${chip.passed ? "pass" : "miss"}`}>
                                {chip.passed ? "✓" : "○"} {chip.label}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Live Google Search Snippet Preview */}
                        <div className="serp-preview-box" aria-label="Google search snippet preview">
                          <div className="serp-preview-label">Google SERP Live Preview</div>
                          <div className="serp-preview-url">
                            https://{serpHost} › products › {row.handle || "handle"}
                          </div>
                          <div className="serp-preview-title">
                            {serpTitle.length > 60 ? `${serpTitle.slice(0, 60)}...` : serpTitle}
                          </div>
                          <div className="serp-preview-desc">
                            {serpDesc.length > 155 ? `${serpDesc.slice(0, 155)}...` : serpDesc}
                          </div>
                        </div>

                        {/* Quick Minor Change & Safe Lock Controls */}
                        <div className="minor-tune-bar">
                          <div className="minor-tune-buttons">
                            <button
                              type="button"
                              className="seo-button secondary small-btn"
                              onClick={() => applyLocalMinorTuneUp(row)}
                              title="Cleans spaces & populates missing meta/keyword without replacing valid copy"
                            >
                              🧹 Quick Minor Tune-Up (Free)
                            </button>
                            <button
                              type="button"
                              className="seo-button secondary small-btn"
                              onClick={() => applyCleanSlug(row)}
                              title="Format URL handle cleanly lowercase-hyphenated"
                            >
                              🔗 Format Slug
                            </button>
                            {changedCount > 0 ? (
                              <button
                                type="button"
                                className="seo-button secondary small-btn"
                                onClick={() => revertDraft(row.id)}
                              >
                                ↺ Discard Unsaved ({changedCount})
                              </button>
                            ) : null}
                          </div>
                          <label className="safe-lock-toggle">
                            <input
                              type="checkbox"
                              checked={handleLocked}
                              onChange={(event) =>
                                setPreserveHandleById((current) => ({
                                  ...current,
                                  [row.id]: event.target.checked,
                                }))
                              }
                            />
                            <span>Lock existing URL handle (skip 301 change)</span>
                          </label>
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

                          <label className="editor-field">
                            <span>URL Handle</span>
                            <input className="seo-input" value={row.handle} onChange={(event) => patchRow(row.id, { handle: event.target.value })} />
                            <div className="field-meta">
                              <small className={`counter ${handleLen.tone}`}>{handleLen.label}</small>
                              <small className="field-status">{fieldStatusMessage(validation.handle)}</small>
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

                          <div className="editor-field editor-field-wide">
                            <div className="content-editor-header">
                              <span>Product Description Content (Shopify HTML)</span>
                              <div className="content-ai-bar">
                                <button
                                  type="button"
                                  className={`filter-pill${!showPreview ? " active" : ""}`}
                                  onClick={() => setPreviewDescById((c) => ({ ...c, [row.id]: false }))}
                                >
                                  HTML Edit
                                </button>
                                <button
                                  type="button"
                                  className={`filter-pill${showPreview ? " active" : ""}`}
                                  onClick={() => setPreviewDescById((c) => ({ ...c, [row.id]: true }))}
                                >
                                  Preview
                                </button>
                                {AI_FEATURES_ENABLED ? (
                                  <>
                                    <button
                                      type="button"
                                      className="seo-button secondary small-btn"
                                      disabled={isAiBusy}
                                      onClick={() => runAiContentFix(row, "polish")}
                                      title={`Minor grammar & natural keyword polish preserving specs (${CREDIT_COSTS.product_content_fix} tokens)`}
                                    >
                                      {isAiBusy && aiActionLabel === "content_polish"
                                        ? "Polishing..."
                                        : `✨ Polish Copy (${CREDIT_COSTS.product_content_fix} tok)`}
                                    </button>
                                    <button
                                      type="button"
                                      className="seo-button secondary small-btn"
                                      disabled={isAiBusy}
                                      onClick={() => runAiContentFix(row, "structure")}
                                      title={`Add H3 headings & scannable bullets without altering facts (${CREDIT_COSTS.product_content_fix} tokens)`}
                                    >
                                      {isAiBusy && aiActionLabel === "content_structure"
                                        ? "Formatting..."
                                        : `📝 Add Bullets (${CREDIT_COSTS.product_content_fix} tok)`}
                                    </button>
                                    <button
                                      type="button"
                                      className="seo-button secondary small-btn"
                                      disabled={isAiBusy}
                                      onClick={() => runAiContentFix(row, "expand")}
                                      title={`Write complete 120-190w conversion SEO copy from product details (${CREDIT_COSTS.product_content_expand} tokens)`}
                                    >
                                      {isAiBusy && aiActionLabel === "content_expand"
                                        ? "Writing..."
                                        : `✍️ Write Full Copy (${CREDIT_COSTS.product_content_expand} tok)`}
                                    </button>
                                  </>
                                ) : null}
                              </div>
                            </div>

                            {showPreview ? (
                              <div
                                className="description-preview-box"
                                dangerouslySetInnerHTML={{
                                  __html:
                                    sanitizeProductDescriptionHtml(row.descriptionHtml || "") ||
                                    "<p><em>No product description yet. Use AI Write Full Copy or switch to HTML Edit.</em></p>",
                                }}
                              />
                            ) : (
                              <textarea
                                className="seo-textarea"
                                rows={6}
                                placeholder="<p>Write SEO-rich product overview, <h3>Key Features</h3>, and bullet highlights...</p>"
                                value={row.descriptionHtml || ""}
                                onChange={(event) => patchRow(row.id, { descriptionHtml: event.target.value })}
                              />
                            )}

                            <div className="field-meta">
                              <small className={`counter ${validation.description.ideal ? "good" : validation.description.valid ? "warning" : "critical"}`}>
                                {validation.description.wordCount} words
                                {validation.description.hasStructure ? " · Structured HTML" : " · Plain text"}
                                {validation.description.hasKeyword ? " · Keyword present" : ""}
                              </small>
                              <small className="field-status">
                                {validation.description.message || "Strong scannable on-page product copy."}
                              </small>
                            </div>
                          </div>
                        </div>

                        {aiNotesById[row.id] ? (
                          <div className="status-banner banner-info" data-no-toast="true">
                            <strong>Gemini SEO Note:</strong> {aiNotesById[row.id]}
                          </div>
                        ) : null}

                        {issues.length ? (
                          <div className="live-issues-area">
                            {issues.map((issue, index) => (
                              <p key={`${row.id}-detail-${index}`} className={`live-issue-line ${issue.tone}`}>{issue.label}</p>
                            ))}
                          </div>
                        ) : null}

                        {/* ─── Gemini AI Diff & Impact Inspector ─── */}
                        {auditResultsById[row.id] ? (
                          <AiDiffInspector auditResult={auditResultsById[row.id]} />
                        ) : null}

                        <div className="row-actions">
                          {AI_FEATURES_ENABLED ? (
                            <>
                              <button
                                className="seo-button secondary"
                                type="button"
                                onClick={() => runAiFix(row, "minor")}
                                disabled={isAiBusy}
                                title={`Gentle surgical refinement: fixes weak meta/keywords & light content polish without full rewrite (${CREDIT_COSTS.product_seo_minor} tokens)`}
                              >
                                {isAiBusy && aiActionLabel === "minor"
                                  ? "Polishing..."
                                  : `✨ AI Minor Polish (${CREDIT_COSTS.product_seo_minor} tok)`}
                              </button>
                              <button
                                className="seo-button secondary"
                                type="button"
                                onClick={() => runAiFix(row, "full")}
                                disabled={isAiBusy}
                                title={`Optimizes title, keyword, metadata & writes rich structured description HTML (${CREDIT_COSTS.product_seo_full} tokens)`}
                              >
                                {isAiBusy && aiActionLabel === "full"
                                  ? "Generating..."
                                  : `⚡ AI Full SEO + Content (${CREDIT_COSTS.product_seo_full} tok)`}
                              </button>
                              <button
                                className="seo-button secondary"
                                type="button"
                                onClick={() => runAiAudit(row)}
                                disabled={isAiBusy}
                                title={`Audits proposed changes, projected CTR and warns of SEO risks (${CREDIT_COSTS.audit_change} tokens)`}
                              >
                                {isAiBusy && aiActionLabel === "audit"
                                  ? "Auditing..."
                                  : `🤖 Gemini Diff Audit (${CREDIT_COSTS.audit_change} tok)`}
                              </button>
                            </>
                          ) : null}
                          <button className="seo-button" type="button" onClick={() => saveRow(row)} disabled={saveFetcher.state !== "idle" && savingRowId === row.id}>
                            {saveFetcher.state !== "idle" && savingRowId === row.id
                              ? "Saving..."
                              : changedCount > 0
                                ? `Save Changes (${changedCount})`
                                : "Save Product SEO"}
                          </button>
                          <Link to="/app/seo-audit">Open SEO Audit</Link>
                        </div>
                        {saveFetcher.data?.ok && saveFetcher.data.redirectCreated ? (
                          <div style={{ background: "#ddf7ea", color: "var(--seo-good)", padding: "8px 12px", borderRadius: 6, fontSize: 13, marginTop: 8 }}>
                            🛡️ 301 URL Redirect automatically created in Shopify to protect your Google rankings!
                          </div>
                        ) : null}
                        {aiFetcher.data?.outOfCredits ? (
                          <div className="error-box" data-no-toast="true" style={{ marginTop: 8 }}>
                            {aiFetcher.data.error} <Link to="/app/billing">Upgrade to Pro</Link>
                          </div>
                        ) : null}
                        {AI_FEATURES_ENABLED && aiFetcher.data?.creditsRemaining !== undefined && lastAiAppliedRowId === row.id ? (
                          <small style={{ color: "var(--seo-primary)", display: "block", marginTop: 4 }}>
                            {aiFetcher.data.superAccess || aiFetcher.data.creditsDeducted === 0
                              ? "★ Super Access active (0 tokens deducted)."
                              : `⚡ Deducted ${aiFetcher.data.creditsDeducted} token(s). Balance: ${aiFetcher.data.creditsRemaining} remaining.`}
                          </small>
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
        </>
  );
}
