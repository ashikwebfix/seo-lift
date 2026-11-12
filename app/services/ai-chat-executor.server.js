import prisma from "../db.server.js";
import { CREDIT_COSTS } from "../utils/credits.js";
import { mapShopifyProductToSeoRow } from "../mappers/product.mapper.js";
import { validateProductDescription, validateRobotsRules } from "../validators/seoValidators.js";
import { aiRobotsImprovement } from "./ai-fixes.server.js";
import {
  AI_CHAT_ACTION_TYPES,
  generateAiRobotsSuggestion,
  generateProductContentFix,
  generateVisionImageAlt,
} from "./ai-provider.server.js";
import { getAppState, updateAppState } from "./app-state.server.js";
import {
  checkCreditBalance,
  deductCredits,
  getOrCreateCreditAccount,
} from "./credit-manager.server.js";
import {
  normalizePageSpeedTargetUrl,
  runLivePageSpeedTest,
} from "./pagespeed.server.js";
import { applyIncrementalAuditPatch, runFullScan } from "./seo-engine.server.js";
import {
  applyImageAltFixesAndRescan,
  applyImageCompressionBatch,
  loadImageOptimizerPage,
  loadProductsPage,
  regenerateSitemap,
  rollbackProductRevision,
  runAiAutoFixProducts,
  saveProductSeoAndRescan,
  updateAutopilotSettings,
} from "./seo-workflows.server.js";
import { fetchProductById, fetchProducts } from "./shopify-admin.server.js";
import { getEffectivePageSpeedConfig } from "./store-control.server.js";

const DEFAULT_CHAT_EXECUTOR_DEPS = {
  getAppState,
  updateAppState,
  runFullScan,
  applyIncrementalAuditPatch,
  runAiAutoFixProducts,
  saveProductSeoAndRescan,
  rollbackProductRevision,
  loadProductsPage,
  loadImageOptimizerPage,
  applyImageAltFixesAndRescan,
  applyImageCompressionBatch,
  regenerateSitemap,
  updateAutopilotSettings,
  aiRobotsImprovement,
  generateAiRobotsSuggestion,
  generateProductContentFix,
  generateVisionImageAlt,
  runLivePageSpeedTest,
  getEffectivePageSpeedConfig,
  checkCreditBalance,
  deductCredits,
  getOrCreateCreditAccount,
  fetchProductById,
  fetchProducts,
  findLatestRevision: async (shop, productId = "") => {
    try {
      return await prisma.productRevision.findFirst({
        where: {
          shop: String(shop || ""),
          ...(productId ? { productId: String(productId) } : {}),
        },
        orderBy: { createdAt: "desc" },
      });
    } catch {
      return null;
    }
  },
};

function severityRank(severity) {
  if (severity === "Critical") return 0;
  if (severity === "Warning") return 1;
  return 2;
}

function formatBytesShort(bytes = 0) {
  const value = Number(bytes || 0);
  if (!Number.isFinite(value) || value <= 0) return "0 B";
  if (value >= 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(2)} MB`;
  if (value >= 1024) return `${Math.round(value / 1024)} KB`;
  return `${Math.round(value)} B`;
}

function clipText(val, max = 90) {
  const s = String(val || "").replace(/\s+/g, " ").trim();
  if (!s) return "(empty)";
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

function extractScanScore(appState) {
  const raw = appState?.lastScan?.summary?.score ?? appState?.lastScan?.score;
  return Number.isFinite(Number(raw)) ? Number(raw) : null;
}

function buildScoreReportMeta(beforeState, afterState) {
  const beforeScore = extractScanScore(beforeState);
  const afterScore = extractScanScore(afterState);
  const scoreDelta =
    beforeScore != null && afterScore != null ? afterScore - beforeScore : null;
  return { beforeScore, afterScore, scoreDelta };
}

function buildFieldDiffs(labelPrefix, beforeObj = {}, afterObj = {}) {
  const fields = [
    { key: "title", label: "Product Title" },
    { key: "focusKeyword", label: "Focus Keyword" },
    { key: "handle", label: "URL Handle" },
    { key: "metaTitle", label: "Meta Title" },
    { key: "metaDescription", label: "Meta Description" },
  ];
  const diffs = [];
  for (const f of fields) {
    const prev = String(beforeObj?.[f.key] ?? "").trim();
    const next = String(afterObj?.[f.key] ?? "").trim();
    if (prev !== next && next) {
      diffs.push({
        label: labelPrefix ? `${labelPrefix} · ${f.label}` : f.label,
        before: clipText(prev, 70),
        after: clipText(next, 70),
      });
    }
  }
  return diffs;
}

export function collectChatFixableProducts(issues = [], limit = 5, filterIds = []) {
  const wanted = new Set((Array.isArray(filterIds) ? filterIds : []).map(String).filter(Boolean));
  const sorted = [...(Array.isArray(issues) ? issues : [])].sort(
    (a, b) => severityRank(a?.severity) - severityRank(b?.severity),
  );
  const selected = [];
  const seen = new Set();

  for (const issue of sorted) {
    const meta = issue?.meta;
    const focusMatch = String(issue?.fixPath || "").match(/[?&]focus=(\d+)/);
    const productId = meta?.productId ? String(meta.productId) : focusMatch?.[1] || "";
    if (!productId || seen.has(productId)) continue;
    if (wanted.size > 0 && !wanted.has(productId)) continue;

    seen.add(productId);
    const handleMatch = String(issue?.targetUrl || "").match(/\/products\/([^/?#]+)/);
    selected.push({
      id: productId,
      title: String(meta?.productTitle || ""),
      handle: String(meta?.handle || handleMatch?.[1] || ""),
      focusKeyword: String(meta?.focusKeyword || ""),
      metaTitle: String(meta?.metaTitle || ""),
      metaDescription: String(meta?.metaDescription || ""),
      targetUrl: String(issue?.targetUrl || ""),
      fixPath: String(issue?.fixPath || `/app/products?focus=${productId}`),
    });

    if (selected.length >= limit) break;
  }

  return selected;
}

export function buildAiChatStoreContext({ shop, appState }) {
  const scan = appState?.lastScan || null;
  const issues = Array.isArray(scan?.issues) ? scan.issues : [];
  const missingAltCount = issues.filter((issue) =>
    String(issue?.title || "").toLowerCase().includes("alt"),
  ).length;
  const metaIssueProducts = collectChatFixableProducts(issues, 12).length;
  const robotsValidation = validateRobotsRules(appState?.robotsTxt || "");

  return {
    shop: String(shop || ""),
    hasScan: Boolean(scan),
    scan: scan
      ? {
          healthScore: scan.summary?.score ?? scan.score ?? null,
          health: scan.summary?.health || "",
          pagesScanned: Number(scan.pagesScanned || 0),
          criticalCount: Number(scan.summary?.counts?.critical ?? 0),
          warningCount: Number(scan.summary?.counts?.warning ?? 0),
          infoCount: Number(scan.summary?.counts?.info ?? 0),
          missingAltCount,
          metaIssueProducts,
          pillars: scan.summary?.pillars || null,
          topIssues: issues.slice(0, 8).map((issue) => ({
            title: String(issue?.title || ""),
            severity: String(issue?.severity || "Info"),
            productId: issue?.meta?.productId ? String(issue.meta.productId) : null,
            productTitle: issue?.meta?.productTitle ? String(issue.meta.productTitle) : null,
            detail: String(issue?.detail || "").slice(0, 140),
          })),
          topFixableProducts: collectChatFixableProducts(issues, 5).map((product) => ({
            id: product.id,
            title: product.title,
            handle: product.handle,
          })),
        }
      : null,
    robots: {
      configured: Boolean(String(appState?.robotsTxt || "").trim()),
      valid: Boolean(robotsValidation.valid),
      message: robotsValidation.message || "",
    },
    sitemap: {
      urlCount: Array.isArray(appState?.sitemapUrls) ? appState.sitemapUrls.length : 0,
      lastGeneratedAt: appState?.sitemapGeneratedAt || null,
    },
    pageSpeed: {
      lastTestedUrl: appState?.pageSpeed?.lastTestedUrl || "",
      lastTestedAt: appState?.pageSpeed?.lastTestedAt || null,
      mobileScore: appState?.pageSpeed?.mobile?.scores?.performance ?? null,
      mobileLcp: appState?.pageSpeed?.mobile?.metrics?.lcp?.displayValue || null,
      desktopScore: appState?.pageSpeed?.desktop?.scores?.performance ?? null,
    },
    imageCompression: {
      totalImagesOptimized: Number(appState?.imageCompressionStats?.totalImagesOptimized || 0),
      totalBytesSaved: Number(appState?.imageCompressionStats?.totalBytesSaved || 0),
    },
    autopilot: {
      enabled: Boolean(appState?.autopilot?.enabled),
      optimizeMeta: appState?.autopilot?.optimizeMeta !== false,
      optimizeAlt: appState?.autopilot?.optimizeAlt !== false,
    },
    gsc: {
      connected: Boolean(appState?.gsc?.connected),
      quickWinsCount: Number(appState?.gsc?.summary?.quickWinsCount || 0),
    },
  };
}

export async function loadAiChatCatalogSummary({
  shop,
  storeDomain,
  token,
  apiVersion,
  query = "",
  limit = 25,
  deps = DEFAULT_CHAT_EXECUTOR_DEPS,
}) {
  const appState = shop ? await deps.getAppState(shop) : null;
  const savedSeoMap = appState?.productSeo || {};
  const issueCounts = new Map();

  for (const issue of appState?.lastScan?.issues || []) {
    const pid = issue?.meta?.productId ? String(issue.meta.productId) : "";
    if (!pid) continue;
    issueCounts.set(pid, (issueCounts.get(pid) || 0) + 1);
  }

  if (token && (storeDomain || shop)) {
    try {
      const { products } = await deps.fetchProducts({
        storeDomain: storeDomain || shop,
        token,
        apiVersion,
        limit,
        query: String(query || "").trim(),
        includeDescription: false,
      });

      if (Array.isArray(products)) {
        return products.map((product) => {
          const row = mapShopifyProductToSeoRow(product, savedSeoMap[String(product.id)] || {});
          return {
            id: String(row.id),
            title: String(row.title || ""),
            handle: String(row.handle || ""),
            focusKeyword: String(row.focusKeyword || ""),
            metaTitle: String(row.metaTitle || ""),
            metaDescription: String(row.metaDescription || ""),
            seoScore: typeof row.seoScore === "number" ? row.seoScore : null,
            issueCount: issueCounts.get(String(row.id)) || 0,
          };
        });
      }
    } catch {
      // Fall back to scan-extracted products below
    }
  }

  const scanProducts = collectChatFixableProducts(appState?.lastScan?.issues || [], limit);
  const q = String(query || "").trim().toLowerCase();
  return scanProducts
    .filter((p) => !q || p.title.toLowerCase().includes(q) || p.handle.toLowerCase().includes(q))
    .map((p) => ({
      id: p.id,
      title: p.title,
      handle: p.handle,
      focusKeyword: savedSeoMap[p.id]?.focusKeyword || p.focusKeyword || "",
      metaTitle: p.metaTitle || "",
      metaDescription: p.metaDescription || "",
      seoScore: null,
      issueCount: issueCounts.get(p.id) || 1,
    }));
}

export function normalizeStoredChatMessage(raw = {}) {
  const role = raw?.role === "user" ? "user" : "assistant";
  const content = String(raw?.content || "").trim().slice(0, 4000);
  if (!content) return null;

  return {
    id: String(raw?.id || `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`),
    role,
    content,
    createdAt: raw?.createdAt || new Date().toISOString(),
    suggestedActions: Array.isArray(raw?.suggestedActions) ? raw.suggestedActions.slice(0, 4) : [],
    quickReplies: Array.isArray(raw?.quickReplies) ? raw.quickReplies.slice(0, 4) : [],
    executedActions:
      raw?.executedActions && typeof raw.executedActions === "object" ? raw.executedActions : {},
    actionResult:
      raw?.actionResult && typeof raw.actionResult === "object" ? raw.actionResult : null,
    fallbackUsed: Boolean(raw?.fallbackUsed),
  };
}

export async function appendAiChatMessages(
  shop,
  messages = [],
  { markActionId = "", markMessageId = "", actionResult = null, deps = DEFAULT_CHAT_EXECUTOR_DEPS } = {},
) {
  const normalizedAdditions = (Array.isArray(messages) ? messages : [])
    .map(normalizeStoredChatMessage)
    .filter(Boolean);

  const nextState = await deps.updateAppState(shop, (current) => {
    let existing = Array.isArray(current.aiChatHistory)
      ? current.aiChatHistory.map(normalizeStoredChatMessage).filter(Boolean)
      : [];

    if (markActionId) {
      existing = existing.map((entry) => {
        if (markMessageId && entry.id !== markMessageId) return entry;
        const hasAction = Array.isArray(entry.suggestedActions)
          ? entry.suggestedActions.some((act) => act?.id === markActionId)
          : false;
        if (!hasAction) return entry;
        return {
          ...entry,
          executedActions: {
            ...(entry.executedActions || {}),
            [markActionId]: {
              ok: Boolean(actionResult?.ok),
              summary: String(actionResult?.summary || actionResult?.error || "Completed"),
              executedAt: new Date().toISOString(),
            },
          },
        };
      });
    }

    return {
      ...current,
      aiChatHistory: [...existing, ...normalizedAdditions].slice(-30),
    };
  });

  return nextState.aiChatHistory || [];
}

function toCompactPageSpeedEntry(report) {
  if (!report) return null;
  return {
    testedAt: report.fetchTime || new Date().toISOString(),
    url: report.testedUrl,
    strategy: report.strategy,
    performance: report.scores?.performance ?? null,
    seo: report.scores?.seo ?? null,
    accessibility: report.scores?.accessibility ?? null,
    bestPractices: report.scores?.bestPractices ?? null,
    lcp: report.metrics?.lcp?.displayValue || "N/A",
    cls: report.metrics?.cls?.displayValue || "N/A",
    passwordProtected: Boolean(report.passwordProtected),
  };
}

async function resolveTargetProductsForAutoFix({
  shop,
  storeDomain,
  token,
  apiVersion,
  appState,
  params,
  deps,
  includeDescription = false,
}) {
  const maxProducts = Math.max(1, Math.min(5, Number(params?.maxProducts || 3)));
  const requestedIds = Array.isArray(params?.productIds)
    ? params.productIds.map(String).filter(Boolean)
    : [];

  let candidates = includeDescription
    ? []
    : collectChatFixableProducts(appState?.lastScan?.issues || [], maxProducts, requestedIds);
  if (candidates.length > 0 && requestedIds.length === 0) {
    return candidates;
  }

  // If user targeted specific productId(s) not present in scan issues (or description is needed), fetch directly from Shopify
  const idsToFetch = requestedIds.length > 0
    ? requestedIds
    : collectChatFixableProducts(appState?.lastScan?.issues || [], maxProducts).map((item) => String(item.id));

  if (idsToFetch.length > 0 && token && typeof deps.fetchProductById === "function") {
    const foundIds = new Set(candidates.map((c) => String(c.id)));
    for (const reqId of idsToFetch) {
      if (foundIds.has(reqId)) continue;
      try {
        const prod = await deps.fetchProductById({
          storeDomain: storeDomain || shop,
          token,
          apiVersion,
          productId: reqId,
        });
        if (prod) {
          const row = mapShopifyProductToSeoRow(prod, appState?.productSeo?.[String(prod.id)] || {});
          candidates.push({
            id: String(row.id),
            title: String(row.title || ""),
            handle: String(row.handle || ""),
            focusKeyword: String(row.focusKeyword || ""),
            metaTitle: String(row.metaTitle || ""),
            metaDescription: String(row.metaDescription || ""),
            ...(includeDescription
              ? {
                  descriptionHtml: String(row.descriptionHtml || prod.body_html || ""),
                  productType: String(prod.product_type || ""),
                  tags: String(prod.tags || ""),
                }
              : {}),
          });
          foundIds.add(String(row.id));
        }
      } catch {
        // Fallback handled below
      }
    }
    if (candidates.length > 0) return candidates.slice(0, maxProducts);
  }

  const page = await deps.loadProductsPage({
    shop,
    storeDomain,
    token,
    apiVersion,
    limit: 15,
    includeDescription,
  });
  const rows = Array.isArray(page?.rows) ? page.rows : [];
  const wantedSet = new Set(requestedIds);
  const filtered = wantedSet.size
    ? rows.filter((row) => wantedSet.has(String(row.id)))
    : rows.filter((row) => Number(row.seoScore ?? 0) < 90);

  candidates = (filtered.length ? filtered : rows).slice(0, maxProducts).map((row) => ({
    id: String(row.id),
    title: String(row.title || ""),
    handle: String(row.handle || ""),
    focusKeyword: String(row.focusKeyword || ""),
    metaTitle: String(row.metaTitle || ""),
    metaDescription: String(row.metaDescription || ""),
    ...(includeDescription
      ? {
          descriptionHtml: String(row.descriptionHtml || ""),
          productType: String(row.productType || ""),
          tags: String(row.tags || ""),
        }
      : {}),
  }));

  return candidates;
}

export async function executeAiChatFixAction({
  shop,
  storeDomain,
  token,
  apiVersion,
  action = {},
  aiSettings = null,
  aiAllowed = true,
  hasSuperAccess = false,
  deps: partialDeps = {},
}) {
  const deps = { ...DEFAULT_CHAT_EXECUTOR_DEPS, ...partialDeps };
  const type = String(action?.type || "").trim().toUpperCase();
  const params = action?.params && typeof action.params === "object" ? action.params : {};

  if (!AI_CHAT_ACTION_TYPES.includes(type)) {
    return {
      ok: false,
      actionType: type || "UNKNOWN",
      error: `Unsupported AI Mode action type: ${type || "empty"}.`,
    };
  }

  if (type === "OPEN_ROUTE") {
    const route = String(params.route || "/app/seo-audit");
    return {
      ok: true,
      actionType: type,
      title: "Opening Workspace",
      summary: `Navigate to ${route}`,
      navigateTo: route,
    };
  }

  if (!shop || !token) {
    if (type !== "TOGGLE_AUTOPILOT" && type !== "RUN_PAGESPEED_TEST") {
      return {
        ok: false,
        actionType: type,
        error: "Active Shopify session token is required to apply this store fix.",
      };
    }
  }

  const beforeState = shop ? await deps.getAppState(shop) : null;
  const checkedAt = new Date().toISOString();

  if (type === "RUN_FULL_SCAN") {
    const scan = await deps.runFullScan({ storeDomain: storeDomain || shop, token, apiVersion, shop });
    const score = scan?.summary?.score ?? scan?.score ?? 0;
    const criticalCount = scan?.summary?.counts?.critical ?? 0;
    const warningCount = scan?.summary?.counts?.warning ?? 0;
    const afterState = shop ? await deps.getAppState(shop) : { lastScan: scan };
    const beforeScore = extractScanScore(beforeState);

    return {
      ok: true,
      actionType: type,
      title: "Full Store SEO Scan Complete",
      summary: `SEO Score: ${score}/100 across ${scan?.pagesScanned || 0} pages (${criticalCount} critical, ${warningCount} warnings).`,
      details: Array.isArray(scan?.issues)
        ? scan.issues.slice(0, 4).map((issue) => `${issue.severity}: ${issue.title}`)
        : [],
      metrics: {
        score,
        pagesScanned: scan?.pagesScanned || 0,
        criticalCount,
        warningCount,
      },
      liveReport: {
        beforeScore,
        afterScore: Number.isFinite(Number(score)) ? Number(score) : null,
        scoreDelta: beforeScore != null ? Number(score) - beforeScore : null,
        checkedAt,
        diffs: [
          ...(beforeScore != null
            ? [{ label: "Store SEO Score", before: `${beforeScore}/100`, after: `${score}/100` }]
            : [{ label: "Store SEO Score", before: "Unscanned", after: `${score}/100` }]),
          {
            label: "Catalog Coverage",
            before: `${beforeState?.lastScan?.pagesScanned ?? 0} pages`,
            after: `${scan?.pagesScanned ?? afterState?.lastScan?.pagesScanned ?? 0} pages`,
          },
          {
            label: "Critical / Warning Issues",
            before: `${beforeState?.lastScan?.summary?.counts?.critical ?? "-"} / ${beforeState?.lastScan?.summary?.counts?.warning ?? "-"}`,
            after: `${criticalCount} / ${warningCount}`,
          },
        ],
      },
    };
  }

  if (type === "UPDATE_SPECIFIC_PRODUCT") {
    const productId = String(params.productId || params.id || "").trim();
    if (!productId) {
      return {
        ok: false,
        actionType: type,
        error: "Select a product or specify a product ID to update.",
      };
    }

    const liveProduct = await deps.fetchProductById({
      storeDomain: storeDomain || shop,
      token,
      apiVersion,
      productId,
    });

    if (!liveProduct) {
      return {
        ok: false,
        actionType: type,
        error: `Shopify product ${productId} could not be found.`,
      };
    }

    const currentRow = mapShopifyProductToSeoRow(
      liveProduct,
      beforeState?.productSeo?.[productId] || {},
    );

    const nextPayload = {
      title: String(params.title || currentRow.title || "").trim(),
      handle: String(params.handle || currentRow.handle || "").trim(),
      focusKeyword: String(params.focusKeyword ?? currentRow.focusKeyword ?? "").trim(),
      metaTitle: String(params.metaTitle ?? currentRow.metaTitle ?? "").trim(),
      metaDescription: String(params.metaDescription ?? currentRow.metaDescription ?? "").trim(),
      descriptionHtml: currentRow.descriptionHtml || "",
      originalHandle: currentRow.handle || "",
      previousValues: {
        title: currentRow.title,
        handle: currentRow.handle,
        focusKeyword: currentRow.focusKeyword,
        metaTitle: currentRow.metaTitle,
        metaDescription: currentRow.metaDescription,
      },
    };

    const result = await deps.saveProductSeoAndRescan({
      shop,
      storeDomain: storeDomain || shop,
      token,
      apiVersion,
      productId,
      payload: nextPayload,
    });

    if (!result?.ok) {
      const firstErr = result?.errors ? Object.values(result.errors).find(Boolean) : "";
      return {
        ok: false,
        actionType: type,
        title: "Product SEO Validation Error",
        error: result?.error || firstErr || "Could not save product SEO updates.",
      };
    }

    const afterState = shop ? await deps.getAppState(shop) : beforeState;
    const scoreMeta = buildScoreReportMeta(beforeState, afterState);
    const saved = result.normalized || nextPayload;
    const diffs = buildFieldDiffs(saved.title || currentRow.title, currentRow, saved);
    if (result.redirectCreated) {
      diffs.push({
        label: "Shopify 301 Redirect",
        before: `/products/${currentRow.handle}`,
        after: `/products/${saved.handle}`,
      });
    }
    if (scoreMeta.afterScore != null) {
      diffs.push({
        label: "Store SEO Score",
        before: scoreMeta.beforeScore != null ? `${scoreMeta.beforeScore}/100` : "-",
        after: `${scoreMeta.afterScore}/100`,
      });
    }

    const latestRev = await deps.findLatestRevision(shop, productId);

    return {
      ok: true,
      actionType: type,
      title: `Updated "${saved.title || currentRow.title}"`,
      summary: `Saved live Shopify SEO fields for "${saved.title || currentRow.title}"${result.redirectCreated ? " and created a 301 redirect" : ""}.`,
      details: diffs.map((d) => `${d.label}: ${d.before} -> ${d.after}`),
      liveReport: {
        ...scoreMeta,
        checkedAt,
        diffs,
        rollbackRevisionId: latestRev?.id || "",
      },
    };
  }

  if (type === "AUTO_FIX_PRODUCTS") {
    if (!aiAllowed) {
      return {
        ok: false,
        actionType: type,
        error: "AI Auto-Fix is currently disabled for this store.",
      };
    }

    const products = await resolveTargetProductsForAutoFix({
      shop,
      storeDomain: storeDomain || shop,
      token,
      apiVersion,
      appState: beforeState,
      params,
      deps,
    });

    if (!products.length) {
      return {
        ok: true,
        actionType: type,
        title: "Catalog Looks Healthy",
        summary: "No Shopify products requiring meta or SEO fixes were found in the current scan.",
        details: [],
      };
    }

    const beforeMap = new Map(products.map((p) => [String(p.id), p]));

    const result = await deps.runAiAutoFixProducts({
      shop,
      storeDomain: storeDomain || shop,
      token,
      apiVersion,
      products,
    });

    const afterState = shop ? await deps.getAppState(shop) : beforeState;
    const scoreMeta = buildScoreReportMeta(beforeState, afterState);
    const diffs = [];
    let rollbackRevisionId = "";

    for (const fixed of Array.isArray(result?.fixedProducts) ? result.fixedProducts : []) {
      const beforeItem = beforeMap.get(String(fixed.id)) || {};
      const itemDiffs = buildFieldDiffs(fixed.title || beforeItem.title || fixed.id, beforeItem, fixed);
      diffs.push(...itemDiffs);
      if (fixed.redirectCreated) {
        diffs.push({
          label: `${fixed.title || fixed.id} · 301 Redirect`,
          before: beforeItem.handle ? `/products/${beforeItem.handle}` : "Old URL",
          after: fixed.handle ? `/products/${fixed.handle}` : "Redirect Active",
        });
      }
      if (!rollbackRevisionId) {
        const rev = await deps.findLatestRevision(shop, String(fixed.id));
        if (rev?.id) rollbackRevisionId = rev.id;
      }
    }

    if (scoreMeta.afterScore != null) {
      diffs.push({
        label: "Store SEO Score",
        before: scoreMeta.beforeScore != null ? `${scoreMeta.beforeScore}/100` : "-",
        after: `${scoreMeta.afterScore}/100`,
      });
    }

    return {
      ok: Boolean(result?.ok),
      actionType: type,
      title: result?.ok ? `AI Fixed ${result.fixedCount || 0} Product(s)` : "AI Product Auto-Fix",
      summary: result?.ok
        ? `Updated ${result.fixedCount || 0} product(s) in Shopify and refreshed your SEO score.${result.stoppedReason ? ` ${result.stoppedReason}` : ""}`
        : result?.error || "Could not complete product auto-fix.",
      details: Array.isArray(result?.fixedProducts)
        ? result.fixedProducts.map(
            (item) => `${item.title || item.id}${item.redirectCreated ? " (301 redirect created)" : ""}`,
          )
        : [],
      error: result?.error || "",
      outOfCredits: Boolean(result?.outOfCredits),
      creditInfo: {
        creditsDeducted: Number(result?.creditsDeducted || 0),
        creditsRemaining:
          typeof result?.creditsRemaining === "number" ? result.creditsRemaining : undefined,
        superAccess: Boolean(result?.superAccess || hasSuperAccess),
      },
      liveReport: result?.ok
        ? {
            ...scoreMeta,
            checkedAt,
            diffs: diffs.slice(0, 12),
            rollbackRevisionId,
          }
        : null,
    };
  }

  if (type === "FIX_PRODUCT_DESCRIPTION") {
    if (!aiAllowed) {
      return {
        ok: false,
        actionType: type,
        error: "AI product description updates are currently disabled for this store.",
      };
    }

    const products = await resolveTargetProductsForAutoFix({
      shop,
      storeDomain: storeDomain || shop,
      token,
      apiVersion,
      appState: beforeState,
      params,
      deps,
      includeDescription: true,
    });

    if (!products.length) {
      return {
        ok: true,
        actionType: type,
        title: "Product Descriptions Checked",
        summary: "No matching products were found to rewrite descriptions.",
        details: [],
      };
    }

    const initialBalance = await deps.checkCreditBalance(shop, "product_content_fix");
    if (!hasSuperAccess && !initialBalance.allowed) {
      return {
        ok: false,
        actionType: type,
        outOfCredits: true,
        error: `Insufficient AI tokens (${initialBalance.availableCredits} left, requires ${initialBalance.cost} tokens per product description fix).`,
      };
    }

    const goal = ["polish", "structure", "expand"].includes(String(params.goal || ""))
      ? String(params.goal)
      : "expand";
    const updated = [];
    const diffs = [];
    let creditsDeducted = 0;
    let creditsRemaining;
    let outOfCredits = false;
    let stoppedReason = "";
    let rollbackRevisionId = "";
    let lastError = "";

    for (let i = 0; i < products.length; i += 1) {
      const item = products[i];
      if (i > 0 && !hasSuperAccess) {
        const nextBalance = await deps.checkCreditBalance(shop, "product_content_fix");
        if (!nextBalance.allowed) {
          outOfCredits = true;
          stoppedReason = `Stopped after ${updated.length} product(s): insufficient AI tokens remaining (${nextBalance.availableCredits} left, needs ${nextBalance.cost}).`;
          break;
        }
      }

      try {
        const beforeWords = validateProductDescription(
          item.descriptionHtml || "",
          item.focusKeyword || "",
        ).wordCount;
        const aiRes = await deps.generateProductContentFix({
          settings: aiSettings,
          title: item.title,
          focusKeyword: item.focusKeyword || item.title,
          descriptionHtml: item.descriptionHtml || "",
          productType: item.productType || "",
          tags: item.tags || "",
          goal,
        });

        const nextHtml = String(aiRes?.descriptionHtml || "").trim();
        if (!nextHtml) {
          lastError = `AI returned an empty description for "${item.title || item.id}".`;
          continue;
        }

        const saveRes = await deps.saveProductSeoAndRescan({
          shop,
          storeDomain: storeDomain || shop,
          token,
          apiVersion,
          productId: item.id,
          payload: {
            title: item.title,
            handle: item.handle,
            focusKeyword: item.focusKeyword,
            metaTitle: item.metaTitle,
            metaDescription: item.metaDescription,
            descriptionHtml: nextHtml,
            originalHandle: item.handle,
            previousValues: {
              title: item.title,
              handle: item.handle,
              focusKeyword: item.focusKeyword,
              metaTitle: item.metaTitle,
              metaDescription: item.metaDescription,
            },
          },
        });

        if (!saveRes?.ok) {
          lastError = saveRes?.error || `Failed to save description for "${item.title || item.id}".`;
          continue;
        }

        const afterWords =
          Number(aiRes?.wordCount) ||
          validateProductDescription(nextHtml, item.focusKeyword || "").wordCount;
        updated.push({
          id: item.id,
          title: item.title || item.id,
          beforeWords,
          afterWords,
        });
        diffs.push({
          label: `${item.title || item.id} · Description`,
          before: `${beforeWords} words`,
          after: `${afterWords} words (${goal})`,
        });

        if (!rollbackRevisionId) {
          const rev = await deps.findLatestRevision(shop, String(item.id));
          if (rev?.id) rollbackRevisionId = rev.id;
        }

        if (!aiRes?.fallbackUsed) {
          const debit = await deps.deductCredits({
            shop,
            actionType: "product_content_fix",
            customCost: CREDIT_COSTS.product_content_fix,
            productId: item.id,
            productTitle: item.title,
            ...(aiSettings?.model ? { modelUsed: aiSettings.model } : {}),
            bypassLimit: hasSuperAccess,
          });
          creditsDeducted += Number(debit?.deducted || 0);
          if (typeof debit?.remainingCredits === "number") {
            creditsRemaining = debit.remainingCredits;
          }
        }
      } catch (err) {
        lastError = err?.message || `AI description update failed for "${item.title || item.id}".`;
      }
    }

    const afterState = shop ? await deps.getAppState(shop) : beforeState;
    const scoreMeta = buildScoreReportMeta(beforeState, afterState);
    if (scoreMeta.afterScore != null) {
      diffs.push({
        label: "Store SEO Score",
        before: scoreMeta.beforeScore != null ? `${scoreMeta.beforeScore}/100` : "-",
        after: `${scoreMeta.afterScore}/100`,
      });
    }

    return {
      ok: updated.length > 0,
      actionType: type,
      title: updated.length
        ? `AI Updated ${updated.length} Product Description(s)`
        : "AI Product Description Fix",
      summary: updated.length
        ? `Rewrote and saved descriptions for ${updated.length} product(s) in Shopify (${creditsDeducted} token${creditsDeducted === 1 ? "" : "s"} used).${stoppedReason ? ` ${stoppedReason}` : ""}`
        : stoppedReason || lastError || "Could not update product descriptions.",
      details: updated.map((entry) => `${entry.title}: ${entry.beforeWords}w -> ${entry.afterWords}w`),
      error: updated.length ? "" : stoppedReason || lastError || "Could not update product descriptions.",
      outOfCredits,
      creditInfo: {
        creditsDeducted,
        creditsRemaining,
        superAccess: hasSuperAccess,
      },
      liveReport: updated.length
        ? {
            ...scoreMeta,
            checkedAt,
            diffs: diffs.slice(0, 12),
            rollbackRevisionId,
          }
        : null,
    };
  }

  if (type === "FIX_IMAGE_ALT") {
    const maxImages = Math.max(1, Math.min(20, Number(params.maxImages || 10)));
    const useAi = Boolean(params.useAi);
    const wantedIds = new Set((Array.isArray(params.productIds) ? params.productIds : []).map(String).filter(Boolean));

    const imagePage = await deps.loadImageOptimizerPage({
      shop,
      storeDomain: storeDomain || shop,
      token,
      apiVersion,
      limit: 25,
      tab: "alt",
      statusFilter: "needs-fix",
    });

    let candidates = Array.isArray(imagePage?.rows) ? imagePage.rows : [];
    if (wantedIds.size > 0) {
      const matched = candidates.filter((row) => wantedIds.has(String(row.productId)));
      if (matched.length > 0) candidates = matched;
    }

    const picked = candidates.slice(0, maxImages);
    if (!picked.length) {
      return {
        ok: true,
        actionType: type,
        title: "Image ALT Audit Clean",
        summary: "All checked product images already have descriptive ALT text.",
        details: [],
      };
    }

    let creditsDeducted = 0;
    let creditsRemaining;
    let outOfCredits = false;
    let stoppedReason = "";
    const aiRowsById = new Map();

    if (useAi) {
      if (!aiAllowed) {
        return {
          ok: false,
          actionType: type,
          error: "AI Vision ALT generation is currently disabled for this store.",
        };
      }
      const initialBalance = await deps.checkCreditBalance(shop, "vision_alt");
      if (!hasSuperAccess && !initialBalance.allowed) {
        return {
          ok: false,
          actionType: type,
          outOfCredits: true,
          error: `Insufficient AI tokens (${initialBalance.availableCredits} left, requires ${initialBalance.cost} tokens per AI Vision ALT image).`,
        };
      }

      for (let i = 0; i < picked.length; i += 1) {
        const row = picked[i];
        if (i > 0 && !hasSuperAccess) {
          const nextBalance = await deps.checkCreditBalance(shop, "vision_alt");
          if (!nextBalance.allowed) {
            outOfCredits = true;
            stoppedReason = `Stopped after ${aiRowsById.size} image(s): insufficient AI tokens remaining.`;
            break;
          }
        }
        try {
          const aiAlt = await deps.generateVisionImageAlt({
            settings: aiSettings,
            imageUrl: row.imageUrl,
            productTitle: row.productTitle || "Product",
          });
          if (aiAlt?.altText) {
            aiRowsById.set(String(row.id), aiAlt);
          }
        } catch {
          // Fall back to pattern suggestion for this image
        }
      }
    }

    const targetPicked = useAi && aiRowsById.size > 0
      ? picked.filter((row) => aiRowsById.has(String(row.id)))
      : picked;

    const rowsToFix = targetPicked.map((row) => {
      const aiAlt = aiRowsById.get(String(row.id));
      const altText = aiAlt?.altText || row.suggestedAlt || `${row.productTitle || "Product"} photo`;
      return {
        id: String(row.id),
        productId: String(row.productId),
        altText: String(altText).slice(0, 125),
      };
    });

    const result = await deps.applyImageAltFixesAndRescan({
      shop,
      storeDomain: storeDomain || shop,
      token,
      apiVersion,
      rows: rowsToFix,
    });

    if (result?.ok && useAi) {
      for (const row of targetPicked) {
        const aiAlt = aiRowsById.get(String(row.id));
        if (!aiAlt || aiAlt.fallbackUsed) continue;
        const debit = await deps.deductCredits({
          shop,
          actionType: "vision_alt",
          customCost: CREDIT_COSTS.vision_alt,
          productId: row.productId,
          productTitle: row.productTitle,
          ...(aiSettings?.model ? { modelUsed: aiSettings.model } : {}),
          bypassLimit: hasSuperAccess,
        });
        creditsDeducted += Number(debit?.deducted || 0);
        if (typeof debit?.remainingCredits === "number") {
          creditsRemaining = debit.remainingCredits;
        }
      }
    }

    const afterState = shop ? await deps.getAppState(shop) : beforeState;
    const scoreMeta = buildScoreReportMeta(beforeState, afterState);
    const fixedAltMap = new Map(rowsToFix.map((r) => [r.id, r.altText]));
    const diffs = targetPicked.slice(0, 6).map((row) => ({
      label: row.productTitle || `Image ${row.id}`,
      before: clipText(row.altText || "(missing ALT)", 55),
      after: clipText(fixedAltMap.get(String(row.id)) || row.suggestedAlt || "", 55),
    }));

    return {
      ok: Boolean(result?.ok),
      actionType: type,
      title: result?.ok ? "Product Image ALT Updated" : "Image ALT Update Issue",
      summary: result?.ok
        ? `Updated ALT text on ${result.updated ?? rowsToFix.length} product image(s) in Shopify and refreshed audit score.${stoppedReason ? ` ${stoppedReason}` : ""}`
        : result?.error || "Failed to update image ALT tags.",
      details: targetPicked.slice(0, 4).map(
        (row) => `${row.productTitle || row.productId}: "${String(fixedAltMap.get(String(row.id)) || "").slice(0, 65)}"`,
      ),
      error: result?.error || "",
      outOfCredits,
      ...(useAi
        ? {
            creditInfo: {
              creditsDeducted,
              creditsRemaining,
              superAccess: hasSuperAccess,
            },
          }
        : {}),
      liveReport: result?.ok
        ? {
            ...scoreMeta,
            checkedAt,
            diffs,
          }
        : null,
    };
  }

  if (type === "COMPRESS_HEAVY_IMAGES") {
    const preset = ["balanced", "lossless", "high"].includes(String(params.preset || ""))
      ? String(params.preset)
      : "balanced";
    const maxImages = Math.max(1, Math.min(15, Number(params.maxImages || 8)));
    const wantedIds = new Set((Array.isArray(params.productIds) ? params.productIds : []).map(String).filter(Boolean));

    let imagePage = await deps.loadImageOptimizerPage({
      shop,
      storeDomain: storeDomain || shop,
      token,
      apiVersion,
      limit: 25,
      tab: "compression",
      compressionFilter: wantedIds.size > 0 ? "all" : "needs-optimization",
    });

    let rows = Array.isArray(imagePage?.rows) ? imagePage.rows : [];
    if (wantedIds.size > 0) {
      const matched = rows.filter((row) => wantedIds.has(String(row.productId)));
      if (matched.length > 0) rows = matched;
    }

    if (!rows.length) {
      imagePage = await deps.loadImageOptimizerPage({
        shop,
        storeDomain: storeDomain || shop,
        token,
        apiVersion,
        limit: 20,
        tab: "compression",
        compressionFilter: "all",
      });
      rows = (Array.isArray(imagePage?.rows) ? imagePage.rows : []).filter(
        (row) => Number(row.sizeBytes || 0) > 100 * 1024,
      );
    }

    const targetRows = rows.slice(0, maxImages);
    if (!targetRows.length) {
      return {
        ok: true,
        actionType: type,
        title: "Images Already Optimized",
        summary: "No heavy product images needing compression were found on the current page.",
        details: [],
      };
    }

    const creditCheck = await deps.checkCreditBalance(shop, "image_compression");
    if (!hasSuperAccess && !creditCheck.allowed) {
      return {
        ok: false,
        actionType: type,
        outOfCredits: true,
        error: `Insufficient AI tokens (${creditCheck.availableCredits} left, requires ${creditCheck.cost} token per compressed image).`,
      };
    }

    const result = await deps.applyImageCompressionBatch({
      shop,
      storeDomain: storeDomain || shop,
      token,
      apiVersion,
      rows: targetRows,
      compressionOptions: { preset },
      hasSuperAccess,
    });

    const diffs = Array.isArray(result?.results)
      ? result.results
          .filter((item) => !item.skipped && item.ok)
          .slice(0, 6)
          .map((item) => ({
            label: item.productTitle || `Image ${item.id}`,
            before: formatBytesShort(item.originalBytes || 0),
            after: `${formatBytesShort(item.compressedBytes || 0)} (-${item.savedPercent || 0}%)`,
          }))
      : [];

    const creditsDeducted = Number(result?.creditsDeducted || 0);
    const creditsRemaining =
      typeof result?.creditsRemaining === "number" ? result.creditsRemaining : undefined;
    const superAccessFlag = Boolean(result?.superAccess || hasSuperAccess);

    return {
      ok: Boolean(result?.ok),
      actionType: type,
      title: result?.ok ? "Catalog Images Compressed" : "Image Compression Issue",
      summary: result?.ok
        ? `Compressed ${result.compressedCount || 0} image(s) (saved ${formatBytesShort(result.totalBytesSaved || 0)} / -${result.totalSavedPercent || 0}%), skipped ${result.skippedCount || 0}.${result?.stoppedReason ? ` ${result.stoppedReason}` : ""}`
        : result?.error || "Image compression batch failed.",
      details: diffs.map((d) => `${d.label}: ${d.before} -> ${d.after}`),
      error: result?.error || "",
      outOfCredits: Boolean(result?.outOfCredits),
      creditInfo: {
        creditsDeducted,
        creditsRemaining,
        superAccess: superAccessFlag,
      },
      liveReport: result?.ok
        ? {
            beforeScore: extractScanScore(beforeState),
            afterScore: extractScanScore(beforeState),
            scoreDelta: null,
            checkedAt,
            diffs: [
              {
                label: "Preset Used",
                before: "Original Storefront Asset(s)",
                after: `${preset.toUpperCase()} (${result.compressedCount || 0} updated · ${superAccessFlag ? "Super Access" : `${creditsDeducted} tok`})`,
              },
              ...diffs,
            ],
          }
        : null,
    };
  }

  if (type === "FIX_ROBOTS_TXT") {
    const currentRules = beforeState?.robotsTxt || "";
    let nextRobots = "";
    let rationale = "";
    let creditsDeducted = 0;
    let creditsRemaining;

    if (typeof params.customRules === "string" && params.customRules.trim()) {
      nextRobots = params.customRules.trim();
      rationale = "Applied your custom robots.txt rules.";
    } else if (params.useAi && aiAllowed) {
      const creditCheck = await deps.checkCreditBalance(shop, "robots_txt_improvement");
      if (!hasSuperAccess && !creditCheck.allowed) {
        return {
          ok: false,
          actionType: type,
          outOfCredits: true,
          error: `Insufficient AI tokens (${creditCheck.availableCredits} left, requires ${creditCheck.cost}).`,
        };
      }
      const aiRes = await deps.generateAiRobotsSuggestion({
        settings: aiSettings,
        currentRules,
        storeDomain: storeDomain || shop,
      });
      nextRobots = String(aiRes?.robotsTxt || "").trim();
      rationale = String(aiRes?.rationale || "");
      if (nextRobots && !aiRes?.fallbackUsed) {
        const debit = await deps.deductCredits({
          shop,
          actionType: "robots_txt_improvement",
          customCost: creditCheck.cost,
          productTitle: "Robots.txt Rules (AI)",
          ...(aiSettings?.model ? { modelUsed: aiSettings.model } : {}),
          bypassLimit: hasSuperAccess,
        });
        creditsDeducted = Number(debit?.deducted || 0);
        creditsRemaining = debit?.remainingCredits;
      }
    }

    if (!nextRobots) {
      const heuristic = deps.aiRobotsImprovement({ currentRules });
      nextRobots = heuristic.robotsTxt;
      rationale = heuristic.rationale;
    }

    await deps.updateAppState(shop, (current) => ({
      ...current,
      robotsTxt: nextRobots,
    }));

    if (token) {
      await deps.applyIncrementalAuditPatch({
        shop,
        storeDomain: storeDomain || shop,
        token,
        apiVersion,
        updatedProducts: [],
      });
    }

    const afterState = shop ? await deps.getAppState(shop) : beforeState;
    const scoreMeta = buildScoreReportMeta(beforeState, afterState);
    const validation = validateRobotsRules(nextRobots);

    return {
      ok: true,
      actionType: type,
      title: "Robots.txt Directives Updated",
      summary: `${rationale || "Applied crawl best-practice rules."} Validation: ${validation.valid ? "Valid" : validation.message}. Export to templates/robots.txt.liquid in Robots.txt if your theme customizes robots.`,
      details: nextRobots.split("\n").slice(0, 6),
      creditInfo: creditsDeducted
        ? { creditsDeducted, creditsRemaining, superAccess: hasSuperAccess }
        : undefined,
      liveReport: {
        ...scoreMeta,
        checkedAt,
        diffs: [
          {
            label: "Robots Directives",
            before: `${currentRules ? currentRules.split("\n").filter(Boolean).length : 0} line(s)`,
            after: `${nextRobots.split("\n").filter(Boolean).length} line(s) (${validation.valid ? "Valid" : "Needs Check"})`,
          },
        ],
      },
    };
  }

  if (type === "REGENERATE_SITEMAP") {
    const beforeCount = Array.isArray(beforeState?.sitemapUrls) ? beforeState.sitemapUrls.length : 0;
    const result = await deps.regenerateSitemap({
      shop,
      storeDomain: storeDomain || shop,
      token,
      apiVersion,
      extraManualUrl: String(params.extraManualUrl || "").trim(),
    });
    const urlCount = Array.isArray(result?.urls) ? result.urls.length : 0;
    return {
      ok: true,
      actionType: type,
      title: "XML Sitemap Rebuilt",
      summary: `Generated ${urlCount} active URL(s) in your storefront sitemap inventory.`,
      details: Array.isArray(result?.urls) ? result.urls.slice(0, 4) : [],
      liveReport: {
        beforeScore: extractScanScore(beforeState),
        afterScore: extractScanScore(beforeState),
        scoreDelta: null,
        checkedAt,
        diffs: [
          {
            label: "Indexed Sitemap URLs",
            before: `${beforeCount} URL(s)`,
            after: `${urlCount} URL(s)`,
          },
        ],
      },
    };
  }

  if (type === "RUN_PAGESPEED_TEST") {
    const requestedStrat = String(params.strategy || "").toLowerCase();
    const strategyMode = requestedStrat === "desktop" ? "desktop" : requestedStrat === "both" ? "both" : "mobile";
    const normalizedUrl = normalizePageSpeedTargetUrl(shop, params.targetUrl || "");
    const cfg = await deps.getEffectivePageSpeedConfig();

    const prevMobilePerf = beforeState?.pageSpeed?.mobile?.scores?.performance ?? null;
    const prevDesktopPerf = beforeState?.pageSpeed?.desktop?.scores?.performance ?? null;

    const [mobileReport, desktopReport] =
      strategyMode === "both"
        ? await Promise.all([
            deps.runLivePageSpeedTest({ url: normalizedUrl, shop, strategy: "mobile", apiKey: cfg?.apiKey || "" }),
            deps.runLivePageSpeedTest({ url: normalizedUrl, shop, strategy: "desktop", apiKey: cfg?.apiKey || "" }),
          ])
        : strategyMode === "desktop"
          ? [null, await deps.runLivePageSpeedTest({ url: normalizedUrl, shop, strategy: "desktop", apiKey: cfg?.apiKey || "" })]
          : [await deps.runLivePageSpeedTest({ url: normalizedUrl, shop, strategy: "mobile", apiKey: cfg?.apiKey || "" }), null];

    const newHistoryItems = [
      toCompactPageSpeedEntry(mobileReport),
      toCompactPageSpeedEntry(desktopReport),
    ].filter(Boolean);
    const testedAt = new Date().toISOString();

    await deps.updateAppState(shop, (current) => {
      const prevPs = current.pageSpeed || {};
      const urlChanged = prevPs.lastTestedUrl && prevPs.lastTestedUrl !== normalizedUrl;
      return {
        ...current,
        pageSpeed: {
          ...prevPs,
          lastTestedUrl: normalizedUrl,
          lastTestedAt: testedAt,
          mobile: mobileReport || (urlChanged ? null : prevPs.mobile),
          desktop: desktopReport || (urlChanged ? null : prevPs.desktop),
          history: [...newHistoryItems, ...(Array.isArray(prevPs.history) ? prevPs.history : [])]
            .filter(Boolean)
            .slice(0, 15),
        },
      };
    });

    const diffs = [];
    if (mobileReport) {
      diffs.push({
        label: "Mobile Performance",
        before: prevMobilePerf != null ? `${prevMobilePerf}/100` : "Untested",
        after: `${mobileReport.scores?.performance ?? "N/A"}/100`,
      });
      diffs.push({
        label: "Mobile LCP / CLS",
        before: beforeState?.pageSpeed?.mobile?.metrics?.lcp?.displayValue || "-",
        after: `${mobileReport.metrics?.lcp?.displayValue || "N/A"} · CLS ${mobileReport.metrics?.cls?.displayValue || "N/A"}`,
      });
    }
    if (desktopReport) {
      diffs.push({
        label: "Desktop Performance",
        before: prevDesktopPerf != null ? `${prevDesktopPerf}/100` : "Untested",
        after: `${desktopReport.scores?.performance ?? "N/A"}/100`,
      });
      diffs.push({
        label: "Desktop LCP / CLS",
        before: beforeState?.pageSpeed?.desktop?.metrics?.lcp?.displayValue || "-",
        after: `${desktopReport.metrics?.lcp?.displayValue || "N/A"} · CLS ${desktopReport.metrics?.cls?.displayValue || "N/A"}`,
      });
    }

    const primaryReport = mobileReport || desktopReport;
    const perf = primaryReport?.scores?.performance ?? "N/A";
    const lcp = primaryReport?.metrics?.lcp?.displayValue || "N/A";
    const cls = primaryReport?.metrics?.cls?.displayValue || "N/A";

    return {
      ok: true,
      actionType: type,
      title: `${strategyMode === "both" ? "Mobile & Desktop" : strategyMode === "desktop" ? "Desktop" : "Mobile"} PageSpeed Result`,
      summary: `Performance ${perf}/100 · SEO ${primaryReport?.scores?.seo ?? "N/A"}/100 · LCP ${lcp} · CLS ${cls} (${normalizedUrl}).`,
      details: diffs.map((d) => `${d.label}: ${d.after}`),
      liveReport: {
        beforeScore: extractScanScore(beforeState),
        afterScore: extractScanScore(beforeState),
        scoreDelta: null,
        checkedAt,
        diffs,
      },
    };
  }

  if (type === "TOGGLE_AUTOPILOT") {
    const enabled = params.enabled !== false;
    const prevEnabled = Boolean(beforeState?.autopilot?.enabled);
    const autopilot = await deps.updateAutopilotSettings({
      shop,
      enabled,
      optimizeMeta: params.optimizeMeta !== false,
      optimizeAlt: params.optimizeAlt !== false,
    });
    return {
      ok: true,
      actionType: type,
      title: autopilot?.enabled ? "SEO Autopilot Enabled" : "SEO Autopilot Paused",
      summary: autopilot?.enabled
        ? "Newly created/imported Shopify products will now be auto-optimized."
        : "Automatic optimization for newly created products has been paused.",
      liveReport: {
        beforeScore: extractScanScore(beforeState),
        afterScore: extractScanScore(beforeState),
        scoreDelta: null,
        checkedAt,
        diffs: [
          {
            label: "Autopilot Status",
            before: prevEnabled ? "Enabled" : "Paused",
            after: autopilot?.enabled ? "Enabled (Meta + ALT)" : "Paused",
          },
        ],
      },
    };
  }

  if (type === "ROLLBACK_REVISION") {
    let targetRevId = String(params.revisionId || "").trim();
    if (!targetRevId) {
      const latest = await deps.findLatestRevision(shop);
      targetRevId = latest?.id ? String(latest.id) : "";
    }
    if (!targetRevId) {
      return {
        ok: false,
        actionType: type,
        error: "No saved product SEO revision was found to rollback.",
      };
    }

    const rollbackResult = await deps.rollbackProductRevision({
      shop,
      storeDomain: storeDomain || shop,
      token,
      apiVersion,
      revisionId: targetRevId,
    });

    const afterState = shop ? await deps.getAppState(shop) : beforeState;
    const scoreMeta = buildScoreReportMeta(beforeState, afterState);

    return {
      ok: Boolean(rollbackResult?.ok ?? true),
      actionType: type,
      title: "Product SEO Rolled Back",
      summary: `Reverted Shopify product to its previous revision${rollbackResult?.redirectCreated ? " and restored redirect safely" : ""}.`,
      liveReport: {
        ...scoreMeta,
        checkedAt,
        diffs: [
          {
            label: "Restored Revision",
            before: targetRevId.slice(0, 12),
            after: rollbackResult?.normalized?.title || "Previous SEO state restored",
          },
          ...(scoreMeta.afterScore != null
            ? [
                {
                  label: "Store SEO Score",
                  before: scoreMeta.beforeScore != null ? `${scoreMeta.beforeScore}/100` : "-",
                  after: `${scoreMeta.afterScore}/100`,
                },
              ]
            : []),
        ],
      },
    };
  }

  return {
    ok: false,
    actionType: type,
    error: "Action could not be dispatched.",
  };
}
