import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useFetcher, useLoaderData } from "react-router";
import seoStyles from "../styles/seo.css?url";
import { requireShopContext } from "../services/route-context.server";
import {
  applyImageAltFixesAndRescan,
  loadImageOptimizerPage,
  runImageAltCheck,
} from "../services/seo-workflows.server";
import { suggestImageAltText, validateImageAlt } from "../validators/seoValidators";

export const links = () => [{ rel: "stylesheet", href: seoStyles }];

function defaultSummary() {
  return {
    total: 0,
    missing: 0,
    tooLong: 0,
    generic: 0,
    tooShort: 0,
    ideal: 0,
    needsFix: 0,
  };
}

function normalizeStatusFilter(value) {
  const clean = String(value || "all").trim().toLowerCase();
  if (clean === "needs-fix" || clean === "healthy") return clean;
  return "all";
}

function normalizePageData(raw) {
  return {
    configError: raw?.configError || "",
    query: raw?.query || "",
    statusFilter: normalizeStatusFilter(raw?.statusFilter || "all"),
    rows: raw?.rows || [],
    pagination: raw?.pagination || { nextPageInfo: "", previousPageInfo: "" },
    summary: raw?.summary || defaultSummary(),
    history: raw?.history || [],
    lastRun: raw?.lastRun || null,
  };
}

export const loader = async ({ request }) => {
  const { shop, token, apiVersion, configError } = await requireShopContext(request);
  const url = new URL(request.url);
  const query = (url.searchParams.get("q") || "").trim();
  const pageInfo = url.searchParams.get("page_info") || "";
  const statusFilter = normalizeStatusFilter(url.searchParams.get("status") || "all");

  if (configError) {
    return normalizePageData({
      configError,
      query,
      statusFilter,
      rows: [],
      pagination: { nextPageInfo: "", previousPageInfo: "" },
      summary: defaultSummary(),
      history: [],
      lastRun: null,
    });
  }

  const result = await loadImageOptimizerPage({
    shop,
    storeDomain: shop,
    token,
    apiVersion,
    limit: 25,
    pageInfo,
    query,
    statusFilter,
  });

  return normalizePageData({
    configError: "",
    query,
    statusFilter: result.statusFilter,
    rows: result.rows,
    pagination: result.pagination,
    summary: result.summary,
    history: result.history,
    lastRun: result.lastRun,
  });
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

  try {
    const formData = await request.formData();
    const intent = String(formData.get("intent") || "checkAlt");
    const rows = JSON.parse(String(formData.get("rows") || "[]"));

    if (intent === "checkAlt") {
      const result = await runImageAltCheck({
        shop,
        rows,
      });
      return {
        ...result,
        intent,
      };
    }

    if (intent === "fixAlt") {
      const result = await applyImageAltFixesAndRescan({
        shop,
        storeDomain: shop,
        token,
        apiVersion,
        rows,
      });

      return {
        ...result,
        intent,
      };
    }

    return {
      ok: false,
      error: "Unknown action.",
    };
  } catch (error) {
    return {
      ok: false,
      error: error?.message || "Failed to process image optimizer action.",
    };
  }
};

function statusTone(status) {
  if (status?.missing || status?.tooLong) return "critical";
  if (status?.generic || status?.tooShort || !status?.ideal) return "warning";
  return "ok";
}

function statusLabel(status) {
  if (!status) return "Unchecked";
  if (status.missing) return "Missing ALT";
  if (status.tooLong) return "Too long";
  if (status.generic) return "Generic ALT";
  if (status.tooShort) return "Too short";
  if (!status.ideal) return "Can improve";
  return "Healthy";
}

function formatDate(value) {
  if (!value) return "N/A";
  return new Date(value).toLocaleString();
}

function toPatternAlt(row, pattern) {
  const cleanPattern = String(pattern || "").trim();
  if (!cleanPattern) {
    return suggestImageAltText({
      productTitle: row.productTitle,
      position: row.position,
      currentAlt: row.suggestedAlt || row.altText,
    });
  }

  const draft = cleanPattern
    .replaceAll("{title}", String(row.productTitle || "Product"))
    .replaceAll("{position}", String(row.position || 1))
    .replaceAll("{handle}", String(row.productHandle || ""));

  const normalized = draft.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return suggestImageAltText({
      productTitle: row.productTitle,
      position: row.position,
      currentAlt: row.suggestedAlt || row.altText,
    });
  }
  return normalized.length > 125 ? normalized.slice(0, 125).trimEnd() : normalized;
}

export default function ImageOptimizerRoute() {
  const loaderData = useLoaderData();
  const actionFetcher = useFetcher();
  const listFetcher = useFetcher();
  const selectAllRef = useRef(null);

  const [pageData, setPageData] = useState(() => normalizePageData(loaderData));
  const [rows, setRows] = useState(() => loaderData.rows || []);
  const [searchQuery, setSearchQuery] = useState(loaderData.query || "");
  const [statusFilter, setStatusFilter] = useState(loaderData.statusFilter || "all");
  const [selected, setSelected] = useState({});
  const [localError, setLocalError] = useState("");
  const [bulkPattern, setBulkPattern] = useState("{title} - product image view {position}");
  const [activeIntent, setActiveIntent] = useState("");
  const [pendingFixRows, setPendingFixRows] = useState([]);

  const syncPageData = useCallback((raw) => {
    const next = normalizePageData(raw);
    setPageData(next);
    setRows(next.rows);
    setSearchQuery(next.query);
    setStatusFilter(next.statusFilter);
    setSelected({});
    setLocalError("");
  }, []);

  useEffect(() => {
    syncPageData(loaderData);
  }, [loaderData, syncPageData]);

  useEffect(() => {
    if (listFetcher.data) {
      syncPageData(listFetcher.data);
    }
  }, [listFetcher.data, syncPageData]);

  useEffect(() => {
    if (actionFetcher.state === "idle") {
      setActiveIntent("");
    }
  }, [actionFetcher.state]);

  useEffect(() => {
    if (actionFetcher.data?.intent === "fixAlt") {
      if (actionFetcher.data?.ok && pendingFixRows.length) {
        const fixedById = new Map(
          pendingFixRows.map((row) => [String(row.id), String(row.altText || "").trim()]),
        );
        setRows((current) =>
          current.map((row) => {
            const nextAlt = fixedById.get(String(row.id));
            if (!nextAlt) return row;
            return {
              ...row,
              altText: nextAlt,
              suggestedAlt: nextAlt,
              validation: validateImageAlt(nextAlt),
            };
          }),
        );
        setSelected({});
      }
      setPendingFixRows([]);
    }
  }, [actionFetcher.data, pendingFixRows]);

  const checkedStatusById = useMemo(
    () => (actionFetcher.data?.intent === "checkAlt" && actionFetcher.data?.ok ? actionFetcher.data.statusById || {} : {}),
    [actionFetcher.data],
  );

  const summary = useMemo(() => {
    if (actionFetcher.data?.summary) return actionFetcher.data.summary;
    return pageData.summary || defaultSummary();
  }, [actionFetcher.data, pageData.summary]);

  const history = useMemo(() => {
    if (Array.isArray(actionFetcher.data?.history)) return actionFetcher.data.history;
    return pageData.history || [];
  }, [actionFetcher.data, pageData.history]);

  const lastRun = useMemo(() => {
    if (actionFetcher.data?.lastRun) return actionFetcher.data.lastRun;
    return pageData.lastRun;
  }, [actionFetcher.data, pageData.lastRun]);

  const selectedCount = rows.filter((row) => selected[row.id]).length;
  const allVisibleSelected = rows.length > 0 && selectedCount === rows.length;
  const someVisibleSelected = selectedCount > 0 && !allVisibleSelected;

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someVisibleSelected;
    }
  }, [someVisibleSelected]);

  const resultSegments = useMemo(() => {
    const total = Math.max(1, Number(summary.total || 0));
    return [
      { key: "healthy", label: "Healthy", value: Number(summary.ideal || 0), color: "#13795b" },
      { key: "needsFix", label: "Needs Fix", value: Number(summary.needsFix || 0), color: "#c77d00" },
      { key: "missing", label: "Missing", value: Number(summary.missing || 0), color: "#a33636" },
      { key: "generic", label: "Generic", value: Number(summary.generic || 0), color: "#7c5a00" },
      { key: "tooLong", label: "Too Long", value: Number(summary.tooLong || 0), color: "#87413f" },
      { key: "tooShort", label: "Too Short", value: Number(summary.tooShort || 0), color: "#8b6a16" },
    ].map((segment) => ({
      ...segment,
      percent: Math.round((segment.value / total) * 100),
    }));
  }, [summary]);

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

  const updateAddressBar = useCallback((query, pageInfo = "", filter = "all") => {
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

    if (filter && filter !== "all") {
      url.searchParams.set("status", filter);
    } else {
      url.searchParams.delete("status");
    }

    window.history.pushState({}, "", `${url.pathname}${url.search}`);
  }, []);

  const loadList = useCallback((query, pageInfo = "", filter = "all") => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (pageInfo) params.set("page_info", pageInfo);
    if (filter && filter !== "all") params.set("status", filter);

    const href = params.toString() ? `/app/image-optimizer?${params.toString()}` : "/app/image-optimizer";
    listFetcher.load(href);
    updateAddressBar(query, pageInfo, filter);
  }, [listFetcher, updateAddressBar]);

  function submitCheck() {
    setLocalError("");
    setActiveIntent("checkAlt");
    actionFetcher.submit(
      {
        intent: "checkAlt",
        rows: JSON.stringify(
          rows.map((row) => ({
            id: row.id,
            productId: row.productId,
            productTitle: row.productTitle,
            position: row.position,
            altText: row.altText,
            suggestedAlt: row.suggestedAlt,
          })),
        ),
      },
      { method: "post" },
    );
  }

  function applyPatternToAllSuggestions() {
    setRows((current) =>
      current.map((row) => ({
        ...row,
        suggestedAlt: toPatternAlt(row, bulkPattern),
      })),
    );
  }

  function setSelectAll(checked) {
    setSelected((current) => {
      const next = { ...current };
      if (checked) {
        for (const row of rows) {
          next[row.id] = true;
        }
      } else {
        for (const row of rows) {
          delete next[row.id];
        }
      }
      return next;
    });
  }

  function selectIssuesOnly() {
    const next = {};
    for (const row of rows) {
      const status = checkedStatusById[row.id] || validateImageAlt(row.altText);
      const needsFix = !status.valid || status.generic || status.tooShort;
      if (needsFix) {
        next[row.id] = true;
      }
    }
    setSelected(next);
  }

  function submitFix(payloadRows) {
    setLocalError("");
    setPendingFixRows(payloadRows);
    setActiveIntent("fixAlt");
    actionFetcher.submit(
      {
        intent: "fixAlt",
        rows: JSON.stringify(payloadRows),
      },
      { method: "post" },
    );
  }

  function applySelectedFixes() {
    const chosen = rows.filter((row) => selected[row.id]);
    if (!chosen.length) {
      setLocalError("Select at least one image row before applying fixes.");
      return;
    }

    const payloadRows = chosen.map((row) => ({
      id: row.id,
      productId: row.productId,
      altText: String(row.suggestedAlt || toPatternAlt(row, bulkPattern)).trim(),
    }));
    submitFix(payloadRows);
  }

  function applyAllVisibleFixes() {
    if (!rows.length) {
      setLocalError("No rows available to update on this page.");
      return;
    }

    const payloadRows = rows.map((row) => ({
      id: row.id,
      productId: row.productId,
      altText: String(row.suggestedAlt || toPatternAlt(row, bulkPattern)).trim(),
    }));
    submitFix(payloadRows);
  }

  function handleSearchSubmit(event) {
    event.preventDefault();
    loadList(searchQuery.trim(), "", statusFilter);
  }

  function handleStatusChange(event) {
    const nextFilter = normalizeStatusFilter(event.target.value);
    setStatusFilter(nextFilter);
    loadList(searchQuery.trim(), "", nextFilter);
  }

  const actionBusy = actionFetcher.state !== "idle";
  const liveStatus = actionBusy
    ? activeIntent === "fixAlt"
      ? "Updating ALT..."
      : "Checking ALT..."
    : actionFetcher.data?.error
      ? "Last run failed"
      : actionFetcher.data?.ok
        ? "Last run successful"
        : "Idle";

  const liveStatusTone = actionFetcher.data?.error ? "critical" : actionBusy ? "warning" : "ok";

  return (
    <s-page full-width="true" heading="Image Optimizer">
      <div className="seo-wrap seo-grid">
        {pageData.configError ? <div className="error-box">{pageData.configError}</div> : null}
        {localError ? <div className="error-box">{localError}</div> : null}
        {actionFetcher.data?.error ? <div className="error-box">{actionFetcher.data.error}</div> : null}

        <form method="get" className="toolbar" onSubmit={handleSearchSubmit}>
          <input
            className="seo-input"
            name="q"
            placeholder="Search product title"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            style={{ maxWidth: 320 }}
          />
          <select className="seo-input" value={statusFilter} onChange={handleStatusChange} style={{ maxWidth: 220 }}>
            <option value="all">All statuses</option>
            <option value="needs-fix">Needs fixes only</option>
            <option value="healthy">Healthy only</option>
          </select>
          <button className="seo-button" type="submit" disabled={listFetcher.state !== "idle"}>
            {listFetcher.state !== "idle" ? "Loading..." : "Search"}
          </button>
          <Link to="/app">Dashboard</Link>
        </form>

        <div className="seo-grid grid-3">
          <div className="metric-card">
            <p className="metric-label">Live Status</p>
            <h3>{liveStatus}</h3>
            <small className={`issue-chip ${liveStatusTone}`}>{actionBusy ? "Running" : "Ready"}</small>
            <p className="metric-help">Last run: {formatDate(lastRun?.createdAt)}</p>
          </div>
          <div className="metric-card">
            <p className="metric-label">Current Results</p>
            <h3>{summary.needsFix || 0} Need Fixes</h3>
            <p className="metric-help">{summary.ideal || 0} healthy out of {summary.total || 0} checked rows</p>
          </div>
          <div className="metric-card">
            <p className="metric-label">Selection</p>
            <h3>{selectedCount} Selected</h3>
            <p className="metric-help">Use Select all or Select issues for bulk updates.</p>
          </div>
        </div>

        <div className="section-card">
          <div className="toolbar" style={{ justifyContent: "space-between" }}>
            <h3 style={{ margin: 0 }}>Result Chart</h3>
            <small>{summary.total || 0} row(s) in current view</small>
          </div>
          <div className="image-results-track">
            {resultSegments.map((segment) => (
              <div
                key={segment.key}
                className="image-results-segment"
                style={{ width: `${segment.percent}%`, background: segment.color }}
                title={`${segment.label}: ${segment.value}`}
              />
            ))}
          </div>
          <div className="image-results-grid">
            {resultSegments.map((segment) => (
              <small key={`legend-${segment.key}`}>
                <strong>{segment.label}:</strong> {segment.value} ({segment.percent}%)
              </small>
            ))}
          </div>
        </div>

        <div className="section-card">
          <div className="toolbar" style={{ justifyContent: "space-between" }}>
            <h3 style={{ margin: 0 }}>Update All ALT At Once</h3>
            <small>Tokens: {"{title}"}, {"{position}"}, {"{handle}"}</small>
          </div>
          <label className="editor-field">
            <span>Bulk ALT pattern</span>
            <input
              className="seo-input"
              value={bulkPattern}
              onChange={(event) => setBulkPattern(event.target.value)}
              placeholder="{title} - product image view {position}"
            />
          </label>
          <div className="toolbar">
            <button className="seo-button secondary" type="button" onClick={applyPatternToAllSuggestions}>
              Apply pattern to all suggestions
            </button>
            <button className="seo-button secondary" type="button" onClick={() => setSelectAll(true)}>
              Select all on page
            </button>
            <button className="seo-button secondary" type="button" onClick={() => setSelectAll(false)}>
              Clear selection
            </button>
            <button className="seo-button secondary" type="button" onClick={selectIssuesOnly}>
              Select issues
            </button>
            <button className="seo-button secondary" type="button" onClick={submitCheck}>
              Check image ALT
            </button>
            <button className="seo-button" type="button" onClick={applySelectedFixes}>
              Fix selected ALT
            </button>
            <button className="seo-button" type="button" onClick={applyAllVisibleFixes}>
              Update all visible ALT
            </button>
          </div>
        </div>

        {actionFetcher.data?.ok && actionFetcher.data?.intent === "checkAlt" ? (
          <div className="section-card">
            <strong>Check complete:</strong>{" "}
            {actionFetcher.data.summary?.needsFix || 0} need fixes, {actionFetcher.data.summary?.ideal || 0} are healthy,{" "}
            {actionFetcher.data.summary?.missing || 0} missing ALT.
          </div>
        ) : null}

        {actionFetcher.data?.ok && actionFetcher.data?.intent === "fixAlt" ? (
          <div className="section-card">
            Updated ALT text for {actionFetcher.data.updated || 0} image{actionFetcher.data.updated === 1 ? "" : "s"}.
          </div>
        ) : null}

        {!rows.length ? (
          <div className="empty-box">No product images were found in the current filter.</div>
        ) : (
          <div className="table-card table-wrap image-optimizer-table">
            <table>
              <thead>
                <tr>
                  <th>
                    <input
                      ref={selectAllRef}
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={(event) => setSelectAll(event.target.checked)}
                      aria-label="Select all images on this page"
                    />
                  </th>
                  <th>Image</th>
                  <th>Product</th>
                  <th>Current ALT</th>
                  <th>Suggested ALT</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const status = checkedStatusById[row.id] || validateImageAlt(row.altText);
                  const tone = statusTone(status);

                  return (
                    <tr key={`${row.productId}-${row.id}`}>
                      <td>
                        <input
                          type="checkbox"
                          checked={Boolean(selected[row.id])}
                          onChange={(event) =>
                            setSelected((current) => ({
                              ...current,
                              [row.id]: event.target.checked,
                            }))
                          }
                        />
                      </td>
                      <td>
                        {row.imageUrl ? (
                          <img
                            src={row.imageUrl}
                            alt=""
                            loading="lazy"
                            width={72}
                            height={72}
                            style={{ objectFit: "cover", border: "1px solid rgba(16, 38, 59, 0.12)" }}
                          />
                        ) : (
                          <small>No preview</small>
                        )}
                      </td>
                      <td>
                        <strong>{row.productTitle}</strong>
                        <small>Image #{row.position}</small>
                      </td>
                      <td>
                        <textarea
                          rows={2}
                          className="seo-textarea"
                          value={row.altText}
                          onChange={(event) => {
                            const nextAlt = event.target.value;
                            patchRow(row.id, {
                              altText: nextAlt,
                              suggestedAlt: suggestImageAltText({
                                productTitle: row.productTitle,
                                position: row.position,
                                currentAlt: nextAlt,
                              }),
                            });
                          }}
                        />
                        <small>{String(row.altText || "").trim().length} chars</small>
                      </td>
                      <td>
                        <textarea
                          rows={2}
                          className="seo-textarea"
                          value={row.suggestedAlt}
                          onChange={(event) => patchRow(row.id, { suggestedAlt: event.target.value })}
                        />
                        <small>Used by Fix selected / Update all visible</small>
                      </td>
                      <td>
                        <span className={`issue-chip ${tone}`}>{statusLabel(status)}</span>
                        {status.message ? <small>{status.message}</small> : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="toolbar">
          <small>Showing up to 25 images per page</small>
          {pageData.pagination.previousPageInfo ? (
            <button
              className="seo-button"
              type="button"
              onClick={() => loadList(pageData.query || "", pageData.pagination.previousPageInfo, pageData.statusFilter || "all")}
              disabled={listFetcher.state !== "idle"}
            >
              Previous page
            </button>
          ) : null}
          {pageData.pagination.nextPageInfo ? (
            <button
              className="seo-button"
              type="button"
              onClick={() => loadList(pageData.query || "", pageData.pagination.nextPageInfo, pageData.statusFilter || "all")}
              disabled={listFetcher.state !== "idle"}
            >
              Next page
            </button>
          ) : null}
        </div>

        <div className="section-card">
          <div className="toolbar" style={{ justifyContent: "space-between" }}>
            <h3 style={{ margin: 0 }}>Previous Results</h3>
            <small>Stored history from recent check/fix runs</small>
          </div>
          {!history.length ? (
            <div className="empty-box">No previous Image Optimizer runs yet.</div>
          ) : (
            <div className="table-wrap image-history-table">
              <table>
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Action</th>
                    <th>Status</th>
                    <th>Needs Fix</th>
                    <th>Updated</th>
                    <th>Checked</th>
                    <th>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {history.slice(0, 10).map((entry) => (
                    <tr key={entry.id}>
                      <td>{formatDate(entry.createdAt)}</td>
                      <td>{entry.action === "fix" ? "Fix ALT" : "Check ALT"}</td>
                      <td>
                        <span className={`issue-chip ${entry.status === "failed" ? "critical" : "ok"}`}>
                          {entry.status === "failed" ? "Failed" : "Success"}
                        </span>
                      </td>
                      <td>{entry.summary?.needsFix || 0}</td>
                      <td>{entry.updated || 0}</td>
                      <td>{entry.summary?.total || entry.attempted || 0}</td>
                      <td>{entry.note || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </s-page>
  );
}
