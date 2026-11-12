import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useFetcher, useLoaderData } from "react-router";
import seoStyles from "../styles/seo.css?url";
import { WorkspaceSubnav, dispatchCreditsUpdate } from "../components/seo-ui";
import { showToast } from "../components/toast-viewport";
import { requireShopContext } from "../services/route-context.server";
import { getOrCreateStoreControl } from "../services/store-control.server";
import {
  applyImageAltFixesAndRescan,
  applyImageCompressionBatch,
  loadImageOptimizerPage,
  previewImageCompressionBatch,
  runImageAltCheck,
} from "../services/seo-workflows.server";
import { suggestImageAltText, validateImageAlt } from "../validators/seoValidators";
import {
  COMPRESSION_PRESETS,
  analyzeImageSizeHealth,
  formatBytes,
  normalizeCompressionOptions,
  summarizeCompressionRows,
} from "../validators/imageCompression";
import { CREDIT_COSTS } from "../utils/credits.js";

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

function defaultCompressionSummary() {
  return {
    total: 0,
    totalBytes: 0,
    totalFormatted: "Unknown",
    knownSizeCount: 0,
    critical: 0,
    warning: 0,
    needsOptimization: 0,
    optimal: 0,
    unchecked: 0,
    oversizedCount: 0,
    heavyCount: 0,
  };
}

function defaultCompressionStats() {
  return {
    totalImagesOptimized: 0,
    totalBytesBefore: 0,
    totalBytesAfter: 0,
    totalBytesSaved: 0,
    lastRunAt: null,
  };
}

function normalizeTab(value) {
  return String(value || "").trim().toLowerCase() === "compression" ? "compression" : "alt";
}

function normalizeStatusFilter(value) {
  const clean = String(value || "all").trim().toLowerCase();
  if (clean === "needs-fix" || clean === "healthy") return clean;
  return "all";
}

function normalizeCompressionFilter(value) {
  const clean = String(value || "all").trim().toLowerCase();
  if (clean === "needs-optimization" || clean === "critical" || clean === "optimal") return clean;
  return "all";
}

function normalizePageData(raw) {
  return {
    tab: normalizeTab(raw?.tab),
    configError: raw?.configError || "",
    query: raw?.query || "",
    statusFilter: normalizeStatusFilter(raw?.statusFilter || "all"),
    compressionFilter: normalizeCompressionFilter(raw?.compressionFilter || "all"),
    rows: raw?.rows || [],
    pagination: raw?.pagination || { nextPageInfo: "", previousPageInfo: "" },
    summary: raw?.summary || defaultSummary(),
    compressionSummary: raw?.compressionSummary || defaultCompressionSummary(),
    compressionStats: raw?.compressionStats || defaultCompressionStats(),
    compressionHistory: raw?.compressionHistory || [],
    lastCompressionRun: raw?.lastCompressionRun || null,
    history: raw?.history || [],
    lastRun: raw?.lastRun || null,
  };
}

export const loader = async ({ request }) => {
  const { shop, token, apiVersion, configError } = await requireShopContext(request);
  const url = new URL(request.url);
  const tab = normalizeTab(url.searchParams.get("tab"));
  const query = (url.searchParams.get("q") || "").trim();
  const pageInfo = url.searchParams.get("page_info") || "";
  const statusFilter = normalizeStatusFilter(url.searchParams.get("status") || "all");
  const compressionFilter = normalizeCompressionFilter(url.searchParams.get("cstatus") || "all");

  if (configError) {
    return normalizePageData({
      tab,
      configError,
      query,
      statusFilter,
      compressionFilter,
      rows: [],
      pagination: { nextPageInfo: "", previousPageInfo: "" },
      summary: defaultSummary(),
      compressionSummary: defaultCompressionSummary(),
      compressionStats: defaultCompressionStats(),
      compressionHistory: [],
      lastCompressionRun: null,
      history: [],
      lastRun: null,
    });
  }

  try {
    const result = await loadImageOptimizerPage({
      shop,
      storeDomain: shop,
      token,
      apiVersion,
      limit: 25,
      pageInfo,
      query,
      statusFilter,
      tab,
      compressionFilter,
    });

    return normalizePageData({
      configError: "",
      tab: result.tab,
      query,
      statusFilter: result.statusFilter,
      compressionFilter: result.compressionFilter,
      rows: result.rows,
      pagination: result.pagination,
      summary: result.summary,
      compressionSummary: result.compressionSummary,
      compressionStats: result.compressionStats,
      compressionHistory: result.compressionHistory,
      lastCompressionRun: result.lastCompressionRun,
      history: result.history,
      lastRun: result.lastRun,
    });
  } catch (error) {
    return normalizePageData({
      tab,
      configError: error?.message || "Unable to load Shopify product images.",
      query,
      statusFilter,
      compressionFilter,
      rows: [],
      pagination: { nextPageInfo: "", previousPageInfo: "" },
      summary: defaultSummary(),
      compressionSummary: defaultCompressionSummary(),
      compressionStats: defaultCompressionStats(),
      compressionHistory: [],
      lastCompressionRun: null,
      history: [],
      lastRun: null,
    });
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

    if (intent === "previewCompress") {
      const options = JSON.parse(String(formData.get("options") || "{}"));
      const result = await previewImageCompressionBatch({
        rows,
        compressionOptions: options,
      });
      return {
        ...result,
        intent,
      };
    }

    if (intent === "compressImages") {
      const options = JSON.parse(String(formData.get("options") || "{}"));
      const storeControl = await getOrCreateStoreControl(shop);
      const result = await applyImageCompressionBatch({
        shop,
        storeDomain: shop,
        token,
        apiVersion,
        rows,
        compressionOptions: options,
        hasSuperAccess: Boolean(storeControl?.superAccess),
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

function compressionTone(health) {
  if (!health) return "warning";
  if (health.status === "critical") return "critical";
  if (health.status === "needs-optimization") return "warning";
  if (health.status === "optimal") return "ok";
  return "warning";
}

function compressionLabel(health) {
  if (!health) return "Unchecked";
  if (health.status === "critical") return "Critical Weight";
  if (health.status === "needs-optimization") return "Needs Compression";
  if (health.status === "optimal") return "PageSpeed Optimal";
  return "Size Unknown";
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
  const aiFetcher = useFetcher();
  const selectAllRef = useRef(null);

  const [pageData, setPageData] = useState(() => normalizePageData(loaderData));
  const [activeTab, setActiveTab] = useState(() => normalizeTab(loaderData.tab));
  const [rows, setRows] = useState(() => loaderData.rows || []);
  const [searchQuery, setSearchQuery] = useState(loaderData.query || "");
  const [statusFilter, setStatusFilter] = useState(loaderData.statusFilter || "all");
  const [compressionFilter, setCompressionFilter] = useState(loaderData.compressionFilter || "all");
  const [selected, setSelected] = useState({});
  const [localError, setLocalError] = useState("");
  const [bulkPattern, setBulkPattern] = useState("{title} - product image view {position}");
  const [activeIntent, setActiveIntent] = useState("");
  const [pendingFixRows, setPendingFixRows] = useState([]);
  const [aiImageId, setAiImageId] = useState("");
  const [lastVisionImageId, setLastVisionImageId] = useState("");

  // Deterministic compression configuration & live dry-run / applied state
  const [preset, setPreset] = useState("pagespeed_balanced");
  const [customMaxWidth, setCustomMaxWidth] = useState(2048);
  const [customQuality, setCustomQuality] = useState(80);
  const [customFormat, setCustomFormat] = useState("smart");
  const [customTargetMaxKb, setCustomTargetMaxKb] = useState(0);
  const [compressionPreviews, setCompressionPreviews] = useState({});
  const [compressionAppliedById, setCompressionAppliedById] = useState({});

  const effectiveOptions = useMemo(
    () =>
      normalizeCompressionOptions({
        preset,
        maxWidth: customMaxWidth,
        maxHeight: customMaxWidth,
        quality: customQuality,
        format: customFormat,
        targetMaxKb: customTargetMaxKb,
      }),
    [preset, customMaxWidth, customQuality, customFormat, customTargetMaxKb],
  );

  const syncPageData = useCallback((raw) => {
    const next = normalizePageData(raw);
    setPageData(next);
    setActiveTab(next.tab);
    setRows(next.rows);
    setSearchQuery(next.query);
    setStatusFilter(next.statusFilter);
    setCompressionFilter(next.compressionFilter);
    setSelected({});
    setLocalError("");
    setCompressionPreviews({});
    setCompressionAppliedById({});
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

  useEffect(() => {
    if (actionFetcher.data?.intent === "previewCompress" && actionFetcher.data?.ok) {
      const nextMap = {};
      for (const item of actionFetcher.data.previews || []) {
        if (item?.id) nextMap[String(item.id)] = item;
      }
      setCompressionPreviews(nextMap);
    }
  }, [actionFetcher.data]);

  useEffect(() => {
    if (actionFetcher.data?.intent === "compressImages") {
      if (actionFetcher.data?.creditsRemaining !== undefined) {
        dispatchCreditsUpdate({
          availableCredits: actionFetcher.data.creditsRemaining,
          plan: actionFetcher.data.plan,
          superAccess: Boolean(actionFetcher.data.superAccess),
        });
      }
      if (Array.isArray(actionFetcher.data?.results)) {
      const resultsById = new Map(
        actionFetcher.data.results.map((entry) => [String(entry.id), entry]),
      );
      if (resultsById.size > 0) {
        const appliedNext = {};
        setRows((current) =>
          current.map((row) => {
            const res = resultsById.get(String(row.id));
            if (!res) return row;
            if (res.ok && !res.skipped) {
              const newId = String(res.newImageId || row.id);
              appliedNext[newId] = res;
              return {
                ...row,
                id: newId,
                imageUrl: res.newImageUrl || row.imageUrl,
                width: res.width || row.width,
                height: res.height || row.height,
                fileSizeBytes: res.compressedBytes,
                fileSizeLabel: formatBytes(res.compressedBytes),
                format: res.format || row.format,
                sizeHealth:
                  res.sizeHealth ||
                  analyzeImageSizeHealth({
                    width: res.width || row.width,
                    height: res.height || row.height,
                    fileSizeBytes: res.compressedBytes,
                    format: res.format || row.format,
                  }),
              };
            }
            if (res.ok && res.skipped) {
              appliedNext[String(row.id)] = res;
            }
            return row;
          }),
        );
        setCompressionAppliedById((prev) => ({ ...prev, ...appliedNext }));
        setCompressionPreviews({});
        setSelected({});
      }
      }
    }
  }, [actionFetcher.data]);

  const checkedStatusById = useMemo(
    () => (actionFetcher.data?.intent === "checkAlt" && actionFetcher.data?.ok ? actionFetcher.data.statusById || {} : {}),
    [actionFetcher.data],
  );

  const summary = useMemo(() => {
    if (actionFetcher.data?.summary) return actionFetcher.data.summary;
    return pageData.summary || defaultSummary();
  }, [actionFetcher.data, pageData.summary]);

  const liveCompressionSummary = useMemo(
    () => summarizeCompressionRows(rows),
    [rows],
  );

  const compressionStats = useMemo(() => {
    if (actionFetcher.data?.compressionStats) return actionFetcher.data.compressionStats;
    return pageData.compressionStats || defaultCompressionStats();
  }, [actionFetcher.data, pageData.compressionStats]);

  const compressionHistory = useMemo(() => {
    if (Array.isArray(actionFetcher.data?.compressionHistory)) {
      return actionFetcher.data.compressionHistory;
    }
    return pageData.compressionHistory || [];
  }, [actionFetcher.data, pageData.compressionHistory]);

  const lastCompressionRun = useMemo(() => {
    if (actionFetcher.data?.lastCompressionRun) return actionFetcher.data.lastCompressionRun;
    return pageData.lastCompressionRun;
  }, [actionFetcher.data, pageData.lastCompressionRun]);

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

  const compressionSegments = useMemo(() => {
    const total = Math.max(1, Number(liveCompressionSummary.total || 0));
    return [
      { key: "optimal", label: "Optimal (<=200 KB)", value: Number(liveCompressionSummary.optimal || 0), color: "#13795b" },
      { key: "warning", label: "Needs Compression", value: Number(liveCompressionSummary.warning || 0), color: "#c77d00" },
      { key: "critical", label: "Critical Weight / Res", value: Number(liveCompressionSummary.critical || 0), color: "#a33636" },
      { key: "unchecked", label: "Unchecked", value: Number(liveCompressionSummary.unchecked || 0), color: "#64748b" },
    ].map((segment) => ({
      ...segment,
      percent: Math.round((segment.value / total) * 100),
    }));
  }, [liveCompressionSummary]);

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

  useEffect(() => {
    if (aiFetcher.data?.ok && aiFetcher.data?.creditsRemaining !== undefined) {
      dispatchCreditsUpdate({
        availableCredits: aiFetcher.data.creditsRemaining,
        plan: aiFetcher.data.plan,
        superAccess: Boolean(aiFetcher.data.superAccess),
      });
    }
    if (aiFetcher.data?.ok && aiFetcher.data?.actionType === "vision_alt" && aiImageId) {
      const generatedAlt = aiFetcher.data.result?.altText;
      if (generatedAlt) {
        patchRow(aiImageId, { suggestedAlt: generatedAlt });
      }
      setLastVisionImageId(aiImageId);
      setAiImageId("");
      showToast({
        tone: "info",
        title: "Vision ALT Generated",
        message: "AI suggested ALT text populated for review.",
      });
    }
    if (aiFetcher.data?.error) {
      setAiImageId("");
    }
  }, [aiFetcher.data, aiImageId]);

  function generateVisionAlt(row) {
    setAiImageId(row.id);
    aiFetcher.submit(
      {
        payload: JSON.stringify({
          actionType: "vision_alt",
          imageUrl: row.imageUrl,
          productTitle: row.productTitle,
          productId: row.productId,
        }),
      },
      { method: "post", action: "/app/api/ai" },
    );
  }

  const updateAddressBar = useCallback((query, pageInfo = "", filter = "all", tab = "alt", cFilter = "all") => {
    if (typeof window === "undefined") return;

    const url = new URL(window.location.href);
    if (tab === "compression") {
      url.searchParams.set("tab", "compression");
    } else {
      url.searchParams.delete("tab");
    }

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

    if (cFilter && cFilter !== "all" && tab === "compression") {
      url.searchParams.set("cstatus", cFilter);
    } else {
      url.searchParams.delete("cstatus");
    }

    window.history.pushState({}, "", `${url.pathname}${url.search}`);
  }, []);

  const loadList = useCallback(
    (query, pageInfo = "", filter = "all", nextTab = activeTab, nextCFilter = compressionFilter) => {
      const normalizedTab = normalizeTab(nextTab);
      const params = new URLSearchParams();
      if (normalizedTab === "compression") params.set("tab", "compression");
      if (query) params.set("q", query);
      if (pageInfo) params.set("page_info", pageInfo);
      if (filter && filter !== "all") params.set("status", filter);
      if (normalizedTab === "compression" && nextCFilter && nextCFilter !== "all") {
        params.set("cstatus", nextCFilter);
      }

      const href = params.toString() ? `/app/image-optimizer?${params.toString()}` : "/app/image-optimizer";
      listFetcher.load(href);
      updateAddressBar(query, pageInfo, filter, normalizedTab, nextCFilter);
    },
    [activeTab, compressionFilter, listFetcher, updateAddressBar],
  );

  function switchTab(nextTab) {
    const normalized = normalizeTab(nextTab);
    if (normalized === activeTab) return;
    setActiveTab(normalized);
    loadList(searchQuery.trim(), "", statusFilter, normalized, compressionFilter);
  }

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
      if (activeTab === "compression") {
        const health = row.sizeHealth || analyzeImageSizeHealth(row);
        if (health.needsOptimization) {
          next[row.id] = true;
        }
      } else {
        const status = checkedStatusById[row.id] || validateImageAlt(row.altText);
        const needsFix = !status.valid || status.generic || status.tooShort;
        if (needsFix) {
          next[row.id] = true;
        }
      }
    }
    setSelected(next);
  }

  function selectCriticalCompressionOnly() {
    const next = {};
    for (const row of rows) {
      const health = row.sizeHealth || analyzeImageSizeHealth(row);
      if (health.status === "critical") {
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

  function serializeCompressionRows(list) {
    return list.map((row) => ({
      id: row.id,
      productId: row.productId,
      productTitle: row.productTitle,
      productHandle: row.productHandle,
      position: row.position,
      altText: row.altText || "",
      imageUrl: row.imageUrl,
      width: row.width,
      height: row.height,
      variantIds: row.variantIds || [],
    }));
  }

  function runCompressionPreview() {
    const chosen = rows.filter((row) => selected[row.id]);
    const targets = chosen.length ? chosen : rows;
    if (!targets.length) {
      setLocalError("No product images loaded on this page to analyze.");
      return;
    }
    setLocalError("");
    setActiveIntent("previewCompress");
    actionFetcher.submit(
      {
        intent: "previewCompress",
        options: JSON.stringify(effectiveOptions),
        rows: JSON.stringify(serializeCompressionRows(targets)),
      },
      { method: "post" },
    );
  }

  function runCompressSelected() {
    const chosen = rows.filter((row) => selected[row.id]);
    if (!chosen.length) {
      setLocalError("Select at least one image row before compressing.");
      return;
    }
    setLocalError("");
    setActiveIntent("compressImages");
    actionFetcher.submit(
      {
        intent: "compressImages",
        options: JSON.stringify(effectiveOptions),
        rows: JSON.stringify(serializeCompressionRows(chosen)),
      },
      { method: "post" },
    );
  }

  function runCompressHeavyOnPage() {
    const heavy = rows.filter((row) => (row.sizeHealth || analyzeImageSizeHealth(row)).needsOptimization);
    const targets = heavy.length ? heavy : rows;
    if (!targets.length) {
      setLocalError("No images available on this page to compress.");
      return;
    }
    const nextSel = {};
    for (const row of targets) nextSel[row.id] = true;
    setSelected(nextSel);
    setLocalError("");
    setActiveIntent("compressImages");
    actionFetcher.submit(
      {
        intent: "compressImages",
        options: JSON.stringify(effectiveOptions),
        rows: JSON.stringify(serializeCompressionRows(targets)),
      },
      { method: "post" },
    );
  }

  function handleSearchSubmit(event) {
    event.preventDefault();
    loadList(searchQuery.trim(), "", statusFilter, activeTab, compressionFilter);
  }

  function handleStatusChange(event) {
    const nextFilter = normalizeStatusFilter(event.target.value);
    setStatusFilter(nextFilter);
    loadList(searchQuery.trim(), "", nextFilter, activeTab, compressionFilter);
  }

  function handleCompressionFilterChange(event) {
    const nextCFilter = normalizeCompressionFilter(event.target.value);
    setCompressionFilter(nextCFilter);
    loadList(searchQuery.trim(), "", statusFilter, activeTab, nextCFilter);
  }

  const actionBusy = actionFetcher.state !== "idle";
  const liveStatus = actionBusy
    ? activeIntent === "fixAlt"
      ? "Updating ALT..."
      : activeIntent === "previewCompress"
        ? "Estimating KB Savings..."
        : activeIntent === "compressImages"
          ? "Compressing & Uploading..."
          : "Checking ALT..."
    : actionFetcher.data?.error
      ? "Last run failed"
      : actionFetcher.data?.ok
        ? "Last run successful"
        : "Idle";

  const liveStatusTone = actionFetcher.data?.error ? "critical" : actionBusy ? "warning" : "ok";

  return (
    <>
      <ui-title-bar title="Products & Media — Image Optimizer" />
      <div className="seo-wrap seo-grid">
        <WorkspaceSubnav group="products" />

        <div className="section-card image-mode-switch">
          <div className="image-mode-tabs" role="tablist" aria-label="Image Optimizer Mode">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "compression"}
              className={activeTab === "compression" ? "seo-button" : "seo-button secondary"}
              onClick={() => switchTab("compression")}
              disabled={listFetcher.state !== "idle"}
            >
              🗜️ Image Size Compression (PageSpeed)
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "alt"}
              className={activeTab === "alt" ? "seo-button" : "seo-button secondary"}
              onClick={() => switchTab("alt")}
              disabled={listFetcher.state !== "idle"}
            >
              🖼️ Image ALT &amp; Gemini Vision
            </button>
          </div>
          <span className={activeTab === "compression" ? "pill pill-good" : "pill pill-info"}>
            {activeTab === "compression"
              ? "⚡ Fixed Deterministic Engine • 0 AI Tokens"
              : "Rule Suggestions (0 tok) + Gemini Vision (4 tok)"}
          </span>
        </div>

        {pageData.configError ? <div className="error-box">{pageData.configError}</div> : null}
        {localError ? <div className="error-box">{localError}</div> : null}
        {actionFetcher.data?.error ? <div className="error-box">{actionFetcher.data.error}</div> : null}
        {aiFetcher.data?.error ? (
          <div className="error-box">
            {aiFetcher.data.error}{" "}
            {aiFetcher.data?.outOfCredits ? <Link to="/app/billing">Upgrade or manage credits</Link> : null}
          </div>
        ) : null}

        <form method="get" className="toolbar" onSubmit={handleSearchSubmit}>
          <input
            className="seo-input"
            name="q"
            placeholder="Search product title"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            style={{ maxWidth: 320 }}
          />
          {activeTab === "compression" ? (
            <select
              className="seo-input"
              value={compressionFilter}
              onChange={handleCompressionFilterChange}
              style={{ maxWidth: 240 }}
            >
              <option value="all">All sizes</option>
              <option value="needs-optimization">Needs compression only</option>
              <option value="critical">Critical weight (&gt;600 KB / &gt;3000px)</option>
              <option value="optimal">Already optimal</option>
            </select>
          ) : (
            <select className="seo-input" value={statusFilter} onChange={handleStatusChange} style={{ maxWidth: 220 }}>
              <option value="all">All statuses</option>
              <option value="needs-fix">Needs fixes only</option>
              <option value="healthy">Healthy only</option>
            </select>
          )}
          <button className="seo-button" type="submit" disabled={listFetcher.state !== "idle"}>
            {listFetcher.state !== "idle" ? "Loading..." : "Search"}
          </button>
        </form>

        {activeTab === "compression" ? (
          <>
            <div className="seo-grid grid-4">
              <div className="metric-card">
                <p className="metric-label">Engine Status</p>
                <h3>{liveStatus}</h3>
                <small className={`issue-chip ${liveStatusTone}`}>{actionBusy ? "Processing" : "Ready (0 AI tok)"}</small>
                <p className="metric-help">Last run: {formatDate(lastCompressionRun?.createdAt)}</p>
              </div>
              <div className="metric-card">
                <p className="metric-label">Total Store Savings</p>
                <h3>{formatBytes(compressionStats.totalBytesSaved || 0)}</h3>
                <p className="metric-help">
                  {compressionStats.totalImagesOptimized || 0} product image(s) compressed cleanly
                </p>
              </div>
              <div className="metric-card">
                <p className="metric-label">Current Page Weight</p>
                <h3>{liveCompressionSummary.totalFormatted}</h3>
                <p className="metric-help">
                  {liveCompressionSummary.needsOptimization || 0} heavy ({liveCompressionSummary.critical || 0} critical)
                </p>
              </div>
              <div className="metric-card">
                <p className="metric-label">Selection</p>
                <h3>{selectedCount} Selected</h3>
                <p className="metric-help">Select images to estimate savings or compress live.</p>
              </div>
            </div>

            <div className="section-card">
              <div className="toolbar" style={{ justifyContent: "space-between" }}>
                <h3 style={{ margin: 0 }}>PageSpeed Image Weight Breakdown</h3>
                <small>{liveCompressionSummary.total || 0} image(s) inspected</small>
              </div>
              <div className="image-results-track">
                {compressionSegments.map((segment) => (
                  <div
                    key={segment.key}
                    className="image-results-segment"
                    style={{ width: `${segment.percent}%`, background: segment.color }}
                    title={`${segment.label}: ${segment.value}`}
                  />
                ))}
              </div>
              <div className="image-results-grid">
                {compressionSegments.map((segment) => (
                  <small key={`comp-legend-${segment.key}`}>
                    <strong>{segment.label}:</strong> {segment.value} ({segment.percent}%)
                  </small>
                ))}
              </div>
            </div>

            <div className="section-card seo-grid">
              <div className="toolbar" style={{ justifyContent: "space-between", marginBottom: 0 }}>
                <div>
                  <h3 style={{ margin: 0 }}>Fixed PageSpeed Compression Rules (Deterministic)</h3>
                  <small style={{ color: "var(--seo-muted)" }}>
                    Strips EXIF/XMP metadata, normalizes orientation, caps excessive dimensions, and skips re-upload if a file is already smaller. Variants, gallery position &amp; ALT text stay intact.
                  </small>
                </div>
              </div>

              <div className="compression-preset-grid">
                {Object.values(COMPRESSION_PRESETS).map((item) => {
                  const isActive = preset === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`compression-preset-card ${isActive ? "active" : ""}`}
                      onClick={() => setPreset(item.id)}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
                        <strong>{item.label}</strong>
                      </div>
                      <span className={isActive ? "pill pill-good" : "pill pill-info"} style={{ justifySelf: "start", fontSize: 11 }}>
                        {item.badge}
                      </span>
                      <p>{item.description}</p>
                    </button>
                  );
                })}
              </div>

              {preset === "custom" ? (
                <div className="seo-grid grid-4">
                  <label className="editor-field">
                    <span>Max Width / Height (px)</span>
                    <input
                      type="number"
                      min={400}
                      max={4096}
                      className="seo-input"
                      value={customMaxWidth}
                      onChange={(e) => setCustomMaxWidth(Number(e.target.value || 2048))}
                    />
                  </label>
                  <label className="editor-field">
                    <span>Quality (45 - 95)</span>
                    <input
                      type="number"
                      min={45}
                      max={95}
                      className="seo-input"
                      value={customQuality}
                      onChange={(e) => setCustomQuality(Number(e.target.value || 80))}
                    />
                  </label>
                  <label className="editor-field">
                    <span>Output Format Rule</span>
                    <select
                      className="seo-input"
                      value={customFormat}
                      onChange={(e) => setCustomFormat(e.target.value)}
                    >
                      <option value="smart">Smart PageSpeed (MozJPEG / WebP)</option>
                      <option value="webp">Force WebP</option>
                      <option value="jpeg">Force MozJPEG Progressive</option>
                      <option value="png">Palette PNG</option>
                      <option value="preserve">Preserve Original Format</option>
                    </select>
                  </label>
                  <label className="editor-field">
                    <span>Max File Size Target (KB, 0 = off)</span>
                    <input
                      type="number"
                      min={0}
                      max={5000}
                      className="seo-input"
                      value={customTargetMaxKb}
                      onChange={(e) => setCustomTargetMaxKb(Number(e.target.value || 0))}
                    />
                  </label>
                </div>
              ) : (
                <div className="status-banner" data-no-toast="true" style={{ padding: "8px 12px" }}>
                  <strong>Active Rule:</strong> Max dimension <code>{effectiveOptions.maxWidth}px</code> • Quality{" "}
                  <code>{effectiveOptions.quality}</code> • Format <code>{effectiveOptions.format.toUpperCase()}</code>
                  {effectiveOptions.targetMaxKb > 0 ? (
                    <>
                      {" "}• Max ceiling <code>&lt;= {effectiveOptions.targetMaxKb} KB</code>
                    </>
                  ) : null}
                </div>
              )}

              <div className="toolbar">
                <button className="seo-button secondary" type="button" onClick={() => setSelectAll(true)}>
                  Select all on page
                </button>
                <button className="seo-button secondary" type="button" onClick={selectIssuesOnly}>
                  Select heavy / oversized
                </button>
                <button className="seo-button secondary" type="button" onClick={selectCriticalCompressionOnly}>
                  Select critical only
                </button>
                <button className="seo-button secondary" type="button" onClick={() => setSelectAll(false)}>
                  Clear
                </button>
                <button
                  className="seo-button secondary"
                  type="button"
                  onClick={runCompressionPreview}
                  disabled={actionBusy}
                >
                  {actionBusy && activeIntent === "previewCompress"
                    ? "Measuring..."
                    : "📊 Estimate Savings (Dry Run)"}
                </button>
                <button
                  className="seo-button"
                  type="button"
                  onClick={runCompressSelected}
                  disabled={actionBusy}
                  title={`Compresses selected heavy images and updates them in Shopify (${CREDIT_COSTS.image_compression} token per compressed image)`}
                >
                  {actionBusy && activeIntent === "compressImages"
                    ? "Compressing..."
                    : `🗜️ Compress Selected (${CREDIT_COSTS.image_compression} tok/img)`}
                </button>
                <button
                  className="seo-button"
                  type="button"
                  onClick={runCompressHeavyOnPage}
                  disabled={actionBusy}
                  title={`Compresses all heavy images (>200 KB) on this page (${CREDIT_COSTS.image_compression} token per compressed image)`}
                >
                  ⚡ Compress All Heavy on Page ({CREDIT_COSTS.image_compression} tok/img)
                </button>
              </div>
            </div>

            {actionFetcher.data?.intent === "compressImages" && actionFetcher.data?.error ? (
              <div className="status-banner banner-danger" data-toast-title="Image Compression Notice">
                <strong>Compression stopped:</strong> {actionFetcher.data.error}{" "}
                {actionFetcher.data?.outOfCredits ? (
                  <Link to="/app/billing" style={{ marginLeft: 8, fontWeight: 700 }}>
                    Top Up Tokens →
                  </Link>
                ) : null}
              </div>
            ) : null}

            {actionFetcher.data?.intent === "previewCompress" && actionFetcher.data?.ok ? (
              <div className="status-banner" data-toast="info" data-toast-title="Dry Run Estimate">
                <strong>Estimated PageSpeed Savings ({actionFetcher.data.totals?.optimizableCount || 0} of {actionFetcher.data.totals?.checked || 0} optimizable):</strong>{" "}
                {formatBytes(actionFetcher.data.totals?.totalOriginalBytes)} →{" "}
                <strong>{formatBytes(actionFetcher.data.totals?.totalCompressedBytes)}</strong>{" "}
                (saves <strong>{formatBytes(actionFetcher.data.totals?.totalSavedBytes)}</strong> /{" "}
                <strong>-{actionFetcher.data.totals?.totalSavedPercent || 0}%</strong>). Review below and click Compress Selected to push to Shopify.
              </div>
            ) : null}

            {actionFetcher.data?.intent === "compressImages" && actionFetcher.data?.compressedCount !== undefined ? (
              <div
                className={actionFetcher.data.ok ? "status-banner banner-good" : "status-banner"}
                data-toast-title="Image Compression Complete"
              >
                <strong>Compression run finished:</strong> {actionFetcher.data.compressedCount || 0} compressed (saved{" "}
                <strong>{formatBytes(actionFetcher.data.totalBytesSaved || 0)}</strong> /{" "}
                <strong>-{actionFetcher.data.totalSavedPercent || 0}%</strong>),{" "}
                {actionFetcher.data.skippedCount || 0} skipped (already optimal),{" "}
                {actionFetcher.data.failedCount || 0} failed.{" "}
                {actionFetcher.data.superAccess ? (
                  <span>Super Access: 0 tokens charged.</span>
                ) : (
                  <span>
                    Tokens used: <strong>{actionFetcher.data.creditsDeducted || 0}</strong> (
                    {typeof actionFetcher.data.creditsRemaining === "number"
                      ? `${actionFetcher.data.creditsRemaining} remaining`
                      : "balance synced"}
                    ).
                  </span>
                )}
                {actionFetcher.data.stoppedReason ? ` ${actionFetcher.data.stoppedReason}` : ""}
              </div>
            ) : null}

            {!rows.length ? (
              <div className="empty-box">No product images matched the current filter.</div>
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
                      <th>Current Size &amp; Specs</th>
                      <th>Estimated / Optimized Output</th>
                      <th>PageSpeed Health</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => {
                      const health = row.sizeHealth || analyzeImageSizeHealth(row);
                      const tone = compressionTone(health);
                      const preview = compressionPreviews[String(row.id)];
                      const applied = compressionAppliedById[String(row.id)];

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
                            <small>
                              Image #{row.position}
                              {row.variantIds?.length ? ` • ${row.variantIds.length} variant(s)` : ""}
                            </small>
                          </td>
                          <td>
                            <div>
                              <strong>{health.fileSizeLabel}</strong>{" "}
                              <span className="pill" style={{ fontSize: 11 }}>
                                {String(health.format || "unknown").toUpperCase()}
                              </span>
                            </div>
                            <small style={{ display: "block", marginTop: 4 }}>
                              Dimensions: {health.dimensionsLabel}
                            </small>
                          </td>
                          <td>
                            {applied ? (
                              applied.skipped ? (
                                <small>{applied.reason || "Skipped (already optimal)."}</small>
                              ) : (
                                <div>
                                  <span className="issue-chip ok">
                                    ✓ Saved {formatBytes(applied.savedBytes)} (-{applied.savedPercent}%)
                                  </span>
                                  <small style={{ display: "block", marginTop: 4 }}>
                                    {formatBytes(applied.originalBytes)} → {formatBytes(applied.compressedBytes)} •{" "}
                                    {applied.width}×{applied.height} • {String(applied.format || "").toUpperCase()}
                                  </small>
                                </div>
                              )
                            ) : preview ? (
                              !preview.ok ? (
                                <small style={{ color: "#a33636" }}>{preview.error}</small>
                              ) : preview.skipped ? (
                                <small>{preview.reason}</small>
                              ) : (
                                <div>
                                  <span className="issue-chip ok">
                                    Est. -{formatBytes(preview.savedBytes)} (-{preview.savedPercent}%)
                                  </span>
                                  <small style={{ display: "block", marginTop: 4 }}>
                                    {formatBytes(preview.originalBytes)} → {formatBytes(preview.compressedBytes)} •{" "}
                                    {preview.width}×{preview.height} • {String(preview.format || "").toUpperCase()}
                                  </small>
                                </div>
                              )
                            ) : (
                              <small style={{ color: "var(--seo-muted)" }}>
                                {health.needsOptimization
                                  ? `Estimated ~${health.estimatedSavablePercent}% smaller with ${effectiveOptions.preset}`
                                  : "Click Estimate Savings to inspect exact KB output."}
                              </small>
                            )}
                          </td>
                          <td>
                            <span className={`issue-chip ${tone}`}>{compressionLabel(health)}</span>
                            {health.reasons?.length ? (
                              <small style={{ display: "block", marginTop: 4 }}>{health.reasons[0]}</small>
                            ) : (
                              <small style={{ display: "block", marginTop: 4 }}>
                                Meets 200 KB &amp; 2048px PageSpeed guidelines.
                              </small>
                            )}
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
                  onClick={() =>
                    loadList(
                      pageData.query || "",
                      pageData.pagination.previousPageInfo,
                      pageData.statusFilter || "all",
                      "compression",
                      pageData.compressionFilter || "all",
                    )
                  }
                  disabled={listFetcher.state !== "idle"}
                >
                  Previous page
                </button>
              ) : null}
              {pageData.pagination.nextPageInfo ? (
                <button
                  className="seo-button"
                  type="button"
                  onClick={() =>
                    loadList(
                      pageData.query || "",
                      pageData.pagination.nextPageInfo,
                      pageData.statusFilter || "all",
                      "compression",
                      pageData.compressionFilter || "all",
                    )
                  }
                  disabled={listFetcher.state !== "idle"}
                >
                  Next page
                </button>
              ) : null}
            </div>

            <div className="section-card">
              <div className="toolbar" style={{ justifyContent: "space-between" }}>
                <h3 style={{ margin: 0 }}>Image Compression History</h3>
                <small>Saved Shopify asset optimizations &amp; byte reductions</small>
              </div>
              {!compressionHistory.length ? (
                <div className="empty-box">No image compression runs yet.</div>
              ) : (
                <div className="table-wrap image-history-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Time</th>
                        <th>Preset</th>
                        <th>Status</th>
                        <th>Compressed</th>
                        <th>Skipped / Failed</th>
                        <th>Bytes Saved</th>
                        <th>Note</th>
                      </tr>
                    </thead>
                    <tbody>
                      {compressionHistory.slice(0, 10).map((entry) => (
                        <tr key={entry.id}>
                          <td>{formatDate(entry.createdAt)}</td>
                          <td>{entry.preset}</td>
                          <td>
                            <span className={`issue-chip ${entry.status === "failed" ? "critical" : "ok"}`}>
                              {entry.status === "failed" ? "Failed" : "Success"}
                            </span>
                          </td>
                          <td>{entry.compressed || 0}</td>
                          <td>
                            {entry.skipped || 0} / {entry.failed || 0}
                          </td>
                          <td>{formatBytes(entry.bytesSaved || 0)}</td>
                          <td>{entry.note || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        ) : (
          <>
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
              <div className="status-banner" data-toast="info" data-toast-title="Image ALT Audit">
                <strong>Check complete:</strong>{" "}
                {actionFetcher.data.summary?.needsFix || 0} need fixes, {actionFetcher.data.summary?.ideal || 0} are healthy,{" "}
                {actionFetcher.data.summary?.missing || 0} missing ALT.
              </div>
            ) : null}

            {actionFetcher.data?.ok && actionFetcher.data?.intent === "fixAlt" ? (
              <div className="status-banner banner-good" data-toast-title="Image ALT Updated">
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
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4, flexWrap: "wrap", gap: 4 }}>
                              <small>Used by Fix selected</small>
                              <button
                                type="button"
                                className="seo-button secondary"
                                style={{ fontSize: 11, padding: "3px 8px" }}
                                onClick={() => generateVisionAlt(row)}
                                disabled={aiFetcher.state !== "idle" && aiImageId === row.id}
                                title={`Analyze this actual image with Gemini Vision (${CREDIT_COSTS.vision_alt} tokens)`}
                              >
                                {aiFetcher.state !== "idle" && aiImageId === row.id
                                  ? "Analyzing..."
                                  : `👁️ Gemini Vision (${CREDIT_COSTS.vision_alt} tok)`}
                              </button>
                            </div>
                            {aiFetcher.data?.ok && lastVisionImageId === row.id ? (
                              <small style={{ color: "var(--seo-primary)", display: "block", marginTop: 2 }}>
                                {aiFetcher.data.superAccess
                                  ? "★ Super Access (0 tokens deducted)."
                                  : aiFetcher.data.creditsDeducted
                                    ? `⚡ Deducted ${aiFetcher.data.creditsDeducted} tokens. ${aiFetcher.data.creditsRemaining} remaining.`
                                    : "Fallback ALT applied (0 tokens charged)."}
                              </small>
                            ) : null}
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
                  onClick={() =>
                    loadList(
                      pageData.query || "",
                      pageData.pagination.previousPageInfo,
                      pageData.statusFilter || "all",
                      "alt",
                      "all",
                    )
                  }
                  disabled={listFetcher.state !== "idle"}
                >
                  Previous page
                </button>
              ) : null}
              {pageData.pagination.nextPageInfo ? (
                <button
                  className="seo-button"
                  type="button"
                  onClick={() =>
                    loadList(
                      pageData.query || "",
                      pageData.pagination.nextPageInfo,
                      pageData.statusFilter || "all",
                      "alt",
                      "all",
                    )
                  }
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
          </>
        )}
      </div>
    </>
  );
}
