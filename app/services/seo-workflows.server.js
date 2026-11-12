import { mapShopifyProductToSeoRow } from "../mappers/product.mapper.js";
import { CREDIT_COSTS } from "../utils/credits.js";
import { AI_FEATURES_ENABLED } from "../utils/feature-flags.js";
import { DEFAULT_GEMINI_MODEL } from "../utils/gemini-models.js";
import {
  suggestImageAltText,
  validateFocusKeyword,
  validateImageAlt,
  validateMetaDescription,
  validateMetaTitle,
  validateProductSeoInput,
  validateProductTitle,
  validateUrlHandle,
} from "../validators/seoValidators.js";
import {
  analyzeImageSizeHealth,
  formatBytes,
  normalizeCompressionOptions,
  summarizeCompressionRows,
} from "../validators/imageCompression.js";
import {
  compressImageBuffer,
  downloadImageBuffer,
  probeImageRowsBatch,
} from "./image-compression.server.js";
import { generateProductSeoFix, generateVisionImageAlt } from "./ai-provider.server.js";
import { getAppState, updateAppState } from "./app-state.server.js";
import { checkCreditBalance, deductCredits } from "./credit-manager.server.js";
import { applyIncrementalAuditPatch, runFullScan } from "./seo-engine.server.js";
import { generateSitemapUrls } from "./sitemap.server.js";
import {
  createUrlRedirect,
  fetchAllProducts,
  fetchProductById,
  fetchProductImages,
  fetchProducts,
  fetchProductsByIds,
  getShopContext,
  replaceProductImageWithCompressed,
  updateProductImageAlt,
  updateProductSeo,
} from "./shopify-admin.server.js";
import {
  checkStoreRouteAccess,
  getEffectivePlatformAiSettings,
  getOrCreateStoreControl,
} from "./store-control.server.js";
import prisma from "../db.server.js";

const IMAGE_HISTORY_LIMIT = 20;

function normalizeImageStatusFilter(value) {
  const clean = String(value || "all").trim().toLowerCase();
  if (clean === "needs-fix" || clean === "healthy") return clean;
  return "all";
}

function toImageHistorySummary(summary = {}) {
  return {
    total: Number(summary.total || 0),
    missing: Number(summary.missing || 0),
    tooLong: Number(summary.tooLong || 0),
    generic: Number(summary.generic || 0),
    tooShort: Number(summary.tooShort || 0),
    ideal: Number(summary.ideal || 0),
    needsFix: Number(summary.needsFix || 0),
  };
}

async function appendImageOptimizerHistory({
  shop,
  action,
  status,
  summary,
  attempted = 0,
  updated = 0,
  note = "",
}) {
  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    action: action === "fix" ? "fix" : "check",
    status: status === "failed" ? "failed" : "success",
    summary: toImageHistorySummary(summary),
    attempted: Number(attempted || 0),
    updated: Number(updated || 0),
    note: String(note || ""),
  };

  const next = await updateAppState(shop, (current) => ({
    ...current,
    imageOptimizerHistory: [entry, ...(current.imageOptimizerHistory || [])].slice(0, IMAGE_HISTORY_LIMIT),
  }));

  const history = Array.isArray(next.imageOptimizerHistory) ? next.imageOptimizerHistory : [];

  return {
    entry,
    history,
    lastRun: history[0] || null,
  };
}

export async function ensureScanData({ shop, storeDomain, token, apiVersion }) {
  const appState = await getAppState(shop);
  if (appState.lastScan) {
    return appState.lastScan;
  }

  if (!storeDomain || !token) {
    return null;
  }

  return runFullScan({
    shop,
    storeDomain,
    token,
    apiVersion,
  });
}

export async function loadProductsPage({
  shop,
  storeDomain,
  token,
  apiVersion,
  limit = 20,
  pageInfo = "",
  query = "",
  includeDescription = true,
}) {
  const appState = await getAppState(shop);

  const { products, pagination } = await fetchProducts({
    storeDomain,
    token,
    apiVersion,
    limit,
    pageInfo,
    query,
    includeDescription,
  });

  const rows = products.map((product) => {
    const state = appState.productSeo?.[String(product.id)] || {};
    return mapShopifyProductToSeoRow(product, state);
  });

  return {
    rows,
    pagination,
    appState,
  };
}

function normalizeImageCompressionFilter(value) {
  const clean = String(value || "all").trim().toLowerCase();
  if (clean === "needs-optimization" || clean === "critical" || clean === "optimal") {
    return clean;
  }
  return "all";
}

function buildSafeImageFilename({ productHandle, productTitle, position, extension }) {
  const baseRaw = String(productHandle || productTitle || "product-image")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  const base = baseRaw || "product-image";
  const pos = Math.max(1, Number(position || 1));
  const ext = String(extension || "jpg").replace(/[^a-z0-9]/gi, "").toLowerCase() || "jpg";
  return `${base}-v${pos}-opt.${ext}`;
}

async function appendImageCompressionHistory({
  shop,
  status,
  preset,
  attempted = 0,
  compressed = 0,
  skipped = 0,
  failed = 0,
  bytesBefore = 0,
  bytesAfter = 0,
  bytesSaved = 0,
  note = "",
}) {
  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    status: status === "failed" ? "failed" : "success",
    preset: String(preset || "pagespeed_balanced"),
    attempted: Number(attempted || 0),
    compressed: Number(compressed || 0),
    skipped: Number(skipped || 0),
    failed: Number(failed || 0),
    bytesBefore: Number(bytesBefore || 0),
    bytesAfter: Number(bytesAfter || 0),
    bytesSaved: Number(bytesSaved || 0),
    note: String(note || ""),
  };

  if (!shop) {
    return {
      entry,
      history: [entry],
      stats: {
        totalImagesOptimized: compressed,
        totalBytesBefore: bytesBefore,
        totalBytesAfter: bytesAfter,
        totalBytesSaved: bytesSaved,
        lastRunAt: entry.createdAt,
      },
      lastRun: entry,
    };
  }

  const next = await updateAppState(shop, (current) => {
    const prevStats = current.imageCompressionStats || {};
    const nextStats = {
      totalImagesOptimized: Number(prevStats.totalImagesOptimized || 0) + Number(compressed || 0),
      totalBytesBefore: Number(prevStats.totalBytesBefore || 0) + Number(bytesBefore || 0),
      totalBytesAfter: Number(prevStats.totalBytesAfter || 0) + Number(bytesAfter || 0),
      totalBytesSaved: Number(prevStats.totalBytesSaved || 0) + Number(bytesSaved || 0),
      lastRunAt: compressed > 0 ? entry.createdAt : prevStats.lastRunAt || null,
    };
    return {
      ...current,
      imageCompressionHistory: [entry, ...(current.imageCompressionHistory || [])].slice(
        0,
        IMAGE_HISTORY_LIMIT,
      ),
      imageCompressionStats: nextStats,
    };
  });

  const history = Array.isArray(next.imageCompressionHistory) ? next.imageCompressionHistory : [];
  return {
    entry,
    history,
    stats: next.imageCompressionStats || {},
    lastRun: history[0] || null,
  };
}

export async function loadImageOptimizerPage({
  shop,
  storeDomain,
  token,
  apiVersion,
  limit = 25,
  pageInfo = "",
  query = "",
  statusFilter = "all",
  tab = "alt",
  compressionFilter = "all",
}) {
  const activeTab = String(tab || "alt").trim().toLowerCase() === "compression" ? "compression" : "alt";
  const { rows, pagination } = await fetchProductImages({
    storeDomain,
    token,
    apiVersion,
    limit,
    pageInfo,
    query,
  });

  let workingRows = rows.map((row) => {
    const validation = validateImageAlt(row.altText);
    return {
      ...row,
      altText: validation.normalized,
      suggestedAlt: suggestImageAltText({
        productTitle: row.productTitle,
        position: row.position,
        currentAlt: row.altText,
      }),
      validation,
    };
  });

  let compressionSummary = null;
  if (activeTab === "compression") {
    workingRows = await probeImageRowsBatch(workingRows, { concurrency: 6 });
    compressionSummary = summarizeCompressionRows(workingRows);
  }

  const filter = normalizeImageStatusFilter(statusFilter);
  const compFilter = normalizeImageCompressionFilter(compressionFilter);

  const filteredRows = workingRows.filter((row) => {
    if (activeTab === "compression") {
      if (compFilter === "all") return true;
      const h = row.sizeHealth || analyzeImageSizeHealth(row);
      if (compFilter === "critical") return h.status === "critical";
      if (compFilter === "needs-optimization") return h.needsOptimization;
      if (compFilter === "optimal") return h.status === "optimal";
      return true;
    }

    if (filter === "all") return true;
    const needsFix = !row.validation.valid || row.validation.generic || row.validation.tooShort;
    return filter === "needs-fix" ? needsFix : !needsFix;
  });

  const pageCheck = validateImageAltRows(filteredRows);
  const appState = shop
    ? await getAppState(shop)
    : {
        imageOptimizerHistory: [],
        imageCompressionHistory: [],
        imageCompressionStats: {},
      };
  const history = Array.isArray(appState.imageOptimizerHistory) ? appState.imageOptimizerHistory : [];
  const compressionHistory = Array.isArray(appState.imageCompressionHistory)
    ? appState.imageCompressionHistory
    : [];
  const compressionStats = appState.imageCompressionStats || {
    totalImagesOptimized: 0,
    totalBytesBefore: 0,
    totalBytesAfter: 0,
    totalBytesSaved: 0,
    lastRunAt: null,
  };

  return {
    tab: activeTab,
    rows: filteredRows,
    pagination,
    summary: pageCheck.summary,
    statusFilter: filter,
    compressionFilter: compFilter,
    compressionSummary: compressionSummary || summarizeCompressionRows(filteredRows),
    compressionStats,
    compressionHistory: compressionHistory.slice(0, IMAGE_HISTORY_LIMIT),
    lastCompressionRun: compressionHistory[0] || null,
    history: history.slice(0, IMAGE_HISTORY_LIMIT),
    lastRun: history[0] || null,
  };
}

async function recordProductRevision({
  shop,
  productId,
  productTitle,
  changeType,
  beforeValues = {},
  afterValues = {},
  aiVerdict = null,
  redirectCreated = false,
}) {
  if (!shop || !productId) return;
  try {
    await prisma.productRevision.create({
      data: {
        shop,
        productId: String(productId),
        productTitle: productTitle ? String(productTitle).slice(0, 200) : null,
        changeType,
        beforeJson: JSON.stringify(beforeValues),
        afterJson: JSON.stringify(afterValues),
        aiVerdictJson: aiVerdict ? JSON.stringify(aiVerdict) : null,
        redirectCreated: Boolean(redirectCreated),
      },
    });
  } catch (revError) {
    console.warn("Could not save product revision history:", revError?.message);
  }
}

async function applyValidatedProductSeoUpdate({
  shop,
  storeDomain,
  token,
  apiVersion,
  productId,
  payload,
  normalized,
  changeType,
}) {
  const prevDesc = payload?.previousValues?.descriptionHtml;
  const hasDescPayload = typeof normalized.descriptionHtml === "string";
  const descriptionChanged =
    hasDescPayload && (typeof prevDesc !== "string" || normalized.descriptionHtml !== prevDesc);

  const shopifyPayload = {
    title: normalized.title,
    handle: normalized.handle,
    metaTitle: normalized.metaTitle,
    metaDescription: normalized.metaDescription,
    ...(descriptionChanged ? { descriptionHtml: normalized.descriptionHtml } : {}),
  };

  await updateProductSeo({
    storeDomain,
    token,
    apiVersion,
    productId,
    payload: shopifyPayload,
  });

  // Automatically create 301 redirect if handle was modified to prevent 404 errors
  let redirectCreated = false;
  const originalHandle = String(payload.originalHandle || "").trim();
  if (originalHandle && originalHandle !== normalized.handle) {
    const redirect = await createUrlRedirect({
      storeDomain,
      token,
      apiVersion,
      path: `/products/${originalHandle}`,
      target: `/products/${normalized.handle}`,
    });
    redirectCreated = Boolean(redirect);
  }

  const baseBefore = payload.previousValues || { handle: originalHandle };
  const revisionBefore = descriptionChanged
    ? baseBefore
    : { ...baseBefore, descriptionHtml: undefined };
  const revisionAfter = descriptionChanged
    ? normalized
    : { ...normalized, descriptionHtml: undefined };

  await recordProductRevision({
    shop,
    productId,
    productTitle: normalized.title,
    changeType: changeType || payload.changeType || (redirectCreated ? "HANDLE_EDIT" : descriptionChanged ? "CONTENT_EDIT" : "METADATA_EDIT"),
    beforeValues: revisionBefore,
    afterValues: revisionAfter,
    aiVerdict: payload.aiVerdict || null,
    redirectCreated,
  });

  await updateAppState(shop, (current) => ({
    ...current,
    productSeo: {
      ...current.productSeo,
      [String(productId)]: {
        ...(current.productSeo?.[String(productId)] || {}),
        focusKeyword: normalized.focusKeyword,
      },
    },
  }));

  return { redirectCreated, descriptionUpdated: descriptionChanged };
}

export async function saveProductSeoAndRescan({
  shop,
  storeDomain,
  token,
  apiVersion,
  productId,
  payload,
}) {
  const validation = validateProductSeoInput(payload);
  if (!validation.valid) {
    return {
      ok: false,
      errors: validation.errors,
      quality: validation.quality,
    };
  }

  const { redirectCreated, descriptionUpdated } = await applyValidatedProductSeoUpdate({
    shop,
    storeDomain,
    token,
    apiVersion,
    productId,
    payload,
    normalized: validation.normalized,
  });

  await applyIncrementalAuditPatch({
    shop,
    storeDomain,
    token,
    apiVersion,
    updatedProducts: [
      {
        id: String(productId),
        title: validation.normalized.title,
        handle: validation.normalized.handle,
        metafields_global_title_tag: validation.normalized.metaTitle,
        metafields_global_description_tag: validation.normalized.metaDescription,
      },
    ],
  });

  return {
    ok: true,
    productId: String(productId),
    normalized: validation.normalized,
    quality: validation.quality,
    redirectCreated,
    descriptionUpdated,
  };
}

function buildAutoFixSeoPayload(product, suggestion) {
  const titleValid = validateProductTitle(product.title).valid;
  const handleCheck = validateUrlHandle(product.handle || "");
  const keywordValid = validateFocusKeyword(product.focusKeyword || "").valid;

  const candidate = {
    title: titleValid ? String(product.title).trim() : suggestion.title,
    focusKeyword: keywordValid ? String(product.focusKeyword).trim() : suggestion.focusKeyword,
    handle: handleCheck.valid ? handleCheck.normalized : suggestion.handle,
    metaTitle: suggestion.metaTitle,
    metaDescription: suggestion.metaDescription,
  };

  const checked = validateProductSeoInput(candidate);
  return checked.valid ? checked : validateProductSeoInput(suggestion);
}

/**
 * Generates and applies Gemini AI SEO fixes for 1 to 5 products from an audit,
 * creating 301 redirects when handles change, recording revisions, deducting credits,
 * and refreshing the store audit once after all updates complete.
 */
export async function runAiAutoFixProducts({
  shop,
  storeDomain,
  token,
  apiVersion,
  products = [],
}) {
  const uniqueProducts = [];
  const seenIds = new Set();
  for (const item of Array.isArray(products) ? products : []) {
    const id = String(item?.id || item?.productId || "").trim();
    if (!id || seenIds.has(id)) continue;
    seenIds.add(id);
    uniqueProducts.push({
      id,
      title: String(item?.title || item?.productTitle || ""),
      handle: String(item?.handle || ""),
      focusKeyword: String(item?.focusKeyword || ""),
      metaTitle: String(item?.metaTitle || ""),
      metaDescription: String(item?.metaDescription || ""),
    });
    if (uniqueProducts.length >= 5) break;
  }

  if (!uniqueProducts.length) {
    return { ok: false, error: "No valid product items selected for AI auto-fix." };
  }

  const [platformAi, access, appState] = await Promise.all([
    getEffectivePlatformAiSettings(),
    checkStoreRouteAccess(shop, "ai_features"),
    getAppState(shop),
  ]);

  if (!AI_FEATURES_ENABLED || !platformAi.isEnabled) {
    return { ok: false, error: "Platform AI features are currently disabled by administrator." };
  }
  if (!platformAi.apiKey) {
    return {
      ok: false,
      error: "Platform Gemini AI credentials are not configured yet. Ask your SuperAdmin to configure them in /superadmin/ai.",
    };
  }
  if (!access.allowed) {
    return { ok: false, error: access.reason };
  }

  const hasSuperAccess = Boolean(access.control?.superAccess);
  const aiSettings = {
    provider: platformAi.provider,
    model: platformAi.model,
    apiKey: platformAi.apiKey,
    temperature: platformAi.temperature,
  };

  const initialBalance = await checkCreditBalance(shop, "product_seo_fix");
  if (!hasSuperAccess && !initialBalance.allowed) {
    return {
      ok: false,
      outOfCredits: true,
      error: `Insufficient AI tokens. Auto-fix requires ${initialBalance.cost} tokens per product, but you have ${initialBalance.availableCredits} remaining.`,
    };
  }

  // Backfill product metadata via targeted node lookup for only missing IDs
  const missingIds = uniqueProducts
    .filter((item) => !item.title || !item.handle)
    .map((item) => item.id);
  if (missingIds.length > 0) {
    try {
      const lookedUp = await fetchProductsByIds({
        storeDomain,
        token,
        apiVersion,
        productIds: missingIds,
      });
      const byId = new Map((lookedUp || []).map((row) => [String(row.id), row]));
      for (const item of uniqueProducts) {
        const live = byId.get(item.id);
        if (!live) continue;
        if (!item.title) item.title = String(live.title || "");
        if (!item.handle) item.handle = String(live.handle || "");
        if (!item.metaTitle) item.metaTitle = String(live.metafields_global_title_tag || "");
        if (!item.metaDescription) item.metaDescription = String(live.metafields_global_description_tag || "");
        if (!item.descriptionHtml) item.descriptionHtml = String(live.body_html || "");
      }
    } catch {
      // Fall back to provided metadata if Shopify lookup fails
    }
  }

  const fixedProducts = [];
  const errors = [];
  let creditsDeducted = 0;
  let creditsRemaining = initialBalance.availableCredits;
  let stoppedReason = "";

  for (let index = 0; index < uniqueProducts.length; index += 1) {
    const product = uniqueProducts[index];
    const focusKeyword =
      product.focusKeyword || String(appState?.productSeo?.[product.id]?.focusKeyword || "");

    if (index > 0 && !hasSuperAccess) {
      const stepBalance = await checkCreditBalance(shop, "product_seo_fix");
      creditsRemaining = stepBalance.availableCredits;
      if (!stepBalance.allowed) {
        stoppedReason = `Stopped after ${fixedProducts.length} product(s): remaining AI credits (${stepBalance.availableCredits}) are below the ${stepBalance.cost}-credit cost per fix.`;
        break;
      }
    }

    try {
      const suggestion = await generateProductSeoFix({
        settings: aiSettings,
        title: product.title,
        focusKeyword,
        handle: product.handle,
        metaTitle: product.metaTitle,
        metaDescription: product.metaDescription,
        descriptionHtml: product.descriptionHtml || "",
        productType: product.productType || "",
        tags: product.tags || "",
        preserveHandle: validateUrlHandle(product.handle || "").valid,
      });

      if (suggestion?.fallbackUsed) {
        errors.push({ productId: product.id, error: "AI returned fallback output; skipped without charging credits." });
        continue;
      }

      const validation = buildAutoFixSeoPayload({ ...product, focusKeyword }, suggestion);
      if (!validation.valid) {
        const firstErr = Object.values(validation.errors || {})[0] || "Generated fields failed validation.";
        errors.push({ productId: product.id, error: firstErr });
        continue;
      }

      const { redirectCreated } = await applyValidatedProductSeoUpdate({
        shop,
        storeDomain,
        token,
        apiVersion,
        productId: product.id,
        payload: {
          originalHandle: product.handle,
          previousValues: {
            title: product.title,
            handle: product.handle,
            focusKeyword,
            metaTitle: product.metaTitle,
            metaDescription: product.metaDescription,
          },
          aiVerdict: {
            verdictSummary: suggestion.rationale || "1-Click AI SEO Auto-Fix from SEO Audit.",
            model: aiSettings.model || DEFAULT_GEMINI_MODEL,
          },
        },
        normalized: validation.normalized,
        changeType: "AI_AUTO_FIX",
      });

      const deduction = await deductCredits({
        shop,
        actionType: "product_seo_fix",
        productId: product.id,
        productTitle: validation.normalized.title,
        modelUsed: aiSettings.model || DEFAULT_GEMINI_MODEL,
        bypassLimit: hasSuperAccess,
      });

      creditsDeducted += deduction.deducted;
      creditsRemaining = deduction.remainingCredits;
      fixedProducts.push({
        productId: product.id,
        title: validation.normalized.title,
        handle: validation.normalized.handle,
        focusKeyword: validation.normalized.focusKeyword,
        metaTitle: validation.normalized.metaTitle,
        metaDescription: validation.normalized.metaDescription,
        rationale: suggestion.rationale,
        redirectCreated,
      });
    } catch (error) {
      errors.push({ productId: product.id, error: error?.message || "Failed to auto-fix product." });
    }
  }

  let scan = null;
  if (fixedProducts.length > 0) {
    scan = await applyIncrementalAuditPatch({
      shop,
      storeDomain,
      token,
      apiVersion,
      updatedProducts: fixedProducts.map((p) => ({
        id: String(p.productId),
        title: p.title,
        handle: p.handle,
        metafields_global_title_tag: p.metaTitle,
        metafields_global_description_tag: p.metaDescription,
      })),
    });
  }

  if (!fixedProducts.length) {
    return {
      ok: false,
      error: errors[0]?.error || "Unable to apply AI SEO fixes.",
      errors,
    };
  }

  return {
    ok: true,
    fixedCount: fixedProducts.length,
    fixedProducts,
    errors,
    creditsDeducted,
    creditsRemaining,
    superAccess: hasSuperAccess,
    stoppedReason,
    scan,
  };
}

export function validateBulkMetaRows(rows = []) {
  const statusById = {};
  let hasHardError = false;

  for (const row of rows) {
    const id = String(row.id || "");
    const titleCheck = validateMetaTitle(row.metaTitle || "");
    const descriptionCheck = validateMetaDescription(row.metaDescription || "");

    if (!titleCheck.valid || !descriptionCheck.valid) {
      hasHardError = true;
    }

    statusById[id] = {
      metaTitle: titleCheck,
      metaDescription: descriptionCheck,
    };
  }

  return {
    hasHardError,
    statusById,
  };
}

export function validateImageAltRows(rows = []) {
  const statusById = {};
  const summary = {
    total: rows.length,
    missing: 0,
    tooLong: 0,
    generic: 0,
    tooShort: 0,
    ideal: 0,
    needsFix: 0,
  };

  for (const row of rows) {
    const id = String(row.id || "");
    const validation = validateImageAlt(row.altText || "");
    const suggested = suggestImageAltText({
      productTitle: row.productTitle,
      position: row.position,
      currentAlt: row.suggestedAlt || row.altText || "",
    });
    const suggestedCheck = validateImageAlt(suggested);
    const needsFix = !validation.valid || validation.generic || validation.tooShort;

    if (validation.missing) summary.missing += 1;
    if (validation.tooLong) summary.tooLong += 1;
    if (validation.generic) summary.generic += 1;
    if (validation.tooShort) summary.tooShort += 1;
    if (validation.ideal) summary.ideal += 1;
    if (needsFix) summary.needsFix += 1;

    statusById[id] = {
      ...validation,
      needsFix,
      suggestedAlt: suggested,
      suggestedValid: suggestedCheck.valid,
    };
  }

  return {
    statusById,
    summary,
    hasIssues: summary.needsFix > 0,
  };
}

export async function runImageAltCheck({
  shop,
  rows,
}) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const check = validateImageAltRows(safeRows);
  const historyState = await appendImageOptimizerHistory({
    shop,
    action: "check",
    status: "success",
    summary: check.summary,
    attempted: safeRows.length,
    updated: 0,
    note: check.summary.needsFix
      ? `${check.summary.needsFix} image ALT item(s) require fixes.`
      : "All checked image ALT values look healthy.",
  });

  return {
    ok: true,
    statusById: check.statusById,
    summary: check.summary,
    hasIssues: check.hasIssues,
    history: historyState.history,
    lastRun: historyState.lastRun,
  };
}

export async function saveBulkMetaAndRescan({
  shop,
  storeDomain,
  token,
  apiVersion,
  rows,
}) {
  const check = validateBulkMetaRows(rows);
  if (check.hasHardError) {
    return {
      ok: false,
      message: "Fix rows that exceed hard length limits before saving.",
      statusById: check.statusById,
    };
  }

  // Apply updates sequentially to stay safely within Shopify API rate limits and avoid SQLite write contention.
  for (const row of rows) {
    const normalizedHandle = validateUrlHandle(row.handle || row.title).normalized;
    const nextMetaTitle = String(row.metaTitle || "").trim();
    const nextMetaDescription = String(row.metaDescription || "").trim();

    await updateProductSeo({
      storeDomain,
      token,
      apiVersion,
      productId: row.id,
      payload: {
        title: row.title,
        handle: normalizedHandle,
        metaTitle: nextMetaTitle,
        metaDescription: nextMetaDescription,
      },
    });

    const prev = row.previousValues || {};
    const changed =
      prev.metaTitle !== nextMetaTitle || prev.metaDescription !== nextMetaDescription;
    if (changed) {
      await recordProductRevision({
        shop,
        productId: row.id,
        productTitle: row.title,
        changeType: "BULK_META_EDIT",
        beforeValues: {
          title: prev.title ?? row.title,
          handle: prev.handle ?? normalizedHandle,
          metaTitle: prev.metaTitle ?? "",
          metaDescription: prev.metaDescription ?? "",
        },
        afterValues: {
          title: row.title,
          handle: normalizedHandle,
          metaTitle: nextMetaTitle,
          metaDescription: nextMetaDescription,
        },
      });
    }
  }

  await applyIncrementalAuditPatch({
    shop,
    storeDomain,
    token,
    apiVersion,
    updatedProducts: rows.map((row) => ({
      id: String(row.id),
      title: row.title,
      handle: validateUrlHandle(row.handle || row.title).normalized,
      metafields_global_title_tag: String(row.metaTitle || "").trim(),
      metafields_global_description_tag: String(row.metaDescription || "").trim(),
    })),
  });

  return {
    ok: true,
    saved: rows.length,
    statusById: check.statusById,
  };
}

export async function applyUrlOptimizationsAndRescan({
  shop,
  storeDomain,
  token,
  apiVersion,
  rows,
}) {
  const normalizedRows = rows.map((row) => {
    const normalizedHandle = validateUrlHandle(row.suggestedHandle || row.handle || row.title).normalized;
    return {
      ...row,
      normalizedHandle,
    };
  });

  for (const row of normalizedRows) {
    await updateProductSeo({
      storeDomain,
      token,
      apiVersion,
      productId: row.id,
      payload: {
        title: row.title,
        handle: row.normalizedHandle,
        metaTitle: row.metaTitle,
        metaDescription: row.metaDescription,
      },
    });

    let redirectCreated = false;
    if (row.handle && row.handle !== row.normalizedHandle) {
      const redirect = await createUrlRedirect({
        storeDomain,
        token,
        apiVersion,
        path: `/products/${row.handle}`,
        target: `/products/${row.normalizedHandle}`,
      });
      redirectCreated = Boolean(redirect);

      await recordProductRevision({
        shop,
        productId: row.id,
        productTitle: row.title,
        changeType: "URL_OPTIMIZATION",
        beforeValues: {
          title: row.title,
          handle: row.handle,
          metaTitle: row.metaTitle,
          metaDescription: row.metaDescription,
        },
        afterValues: {
          title: row.title,
          handle: row.normalizedHandle,
          metaTitle: row.metaTitle,
          metaDescription: row.metaDescription,
        },
        redirectCreated,
      });
    }
  }

  await applyIncrementalAuditPatch({
    shop,
    storeDomain,
    token,
    apiVersion,
    updatedProducts: normalizedRows.map((row) => ({
      id: String(row.id),
      title: row.title,
      handle: row.normalizedHandle,
      metafields_global_title_tag: row.metaTitle || "",
      metafields_global_description_tag: row.metaDescription || "",
    })),
  });

  return {
    ok: true,
    updated: normalizedRows.length,
  };
}

export async function rollbackProductRevision({
  shop,
  storeDomain,
  token,
  apiVersion,
  revisionId,
}) {
  const revision = await prisma.productRevision.findFirst({
    where: { id: String(revisionId || ""), shop },
  });

  if (!revision) {
    throw new Error("Revision record not found.");
  }

  const before = JSON.parse(revision.beforeJson || "{}");
  const after = JSON.parse(revision.afterJson || "{}");

  const nextPayload = {
    title: String(before.title || after.title || revision.productTitle || "").trim(),
    handle: validateUrlHandle(before.handle || after.handle || before.title || "").normalized,
    metaTitle: String(before.metaTitle ?? after.metaTitle ?? "").trim(),
    metaDescription: String(before.metaDescription ?? after.metaDescription ?? "").trim(),
    focusKeyword: String(before.focusKeyword ?? after.focusKeyword ?? "").trim(),
    ...(typeof before.descriptionHtml === "string"
      ? { descriptionHtml: before.descriptionHtml }
      : {}),
  };

  if (!nextPayload.title) {
    throw new Error("Cannot rollback: previous product title is unavailable in this revision.");
  }

  return saveProductSeoAndRescan({
    shop,
    storeDomain,
    token,
    apiVersion,
    productId: revision.productId,
    payload: {
      ...nextPayload,
      originalHandle: after.handle || "",
      previousValues: after,
      changeType: "ROLLBACK",
    },
  });
}

export async function applyImageAltFixesAndRescan({
  shop,
  storeDomain,
  token,
  apiVersion,
  rows,
}) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const preCheck = validateImageAltRows(safeRows);

  if (!safeRows.length) {
    const historyState = await appendImageOptimizerHistory({
      shop,
      action: "fix",
      status: "failed",
      summary: preCheck.summary,
      attempted: 0,
      updated: 0,
      note: "No image rows were selected for update.",
    });

    return {
      ok: false,
      error: "Select at least one image to fix.",
      summary: preCheck.summary,
      history: historyState.history,
      lastRun: historyState.lastRun,
    };
  }

  const normalizedRows = safeRows.map((row) => {
    const check = validateImageAlt(row.altText || "");
    return {
      id: String(row.id || ""),
      productId: String(row.productId || ""),
      altText: check.normalized,
      valid: check.valid,
    };
  });

  const invalidRows = normalizedRows.filter((row) => !row.valid || !row.id || !row.productId);
  if (invalidRows.length) {
    const historyState = await appendImageOptimizerHistory({
      shop,
      action: "fix",
      status: "failed",
      summary: preCheck.summary,
      attempted: normalizedRows.length,
      updated: 0,
      note: "One or more selected image ALT values were invalid.",
    });

    return {
      ok: false,
      error: "One or more selected ALT values are invalid. Ensure each ALT is 1-125 characters.",
      summary: preCheck.summary,
      history: historyState.history,
      lastRun: historyState.lastRun,
    };
  }

  let updatedCount = 0;
  try {
    // REST image ALT updates share Shopify's 2 req/s REST bucket, so apply sequentially.
    for (const row of normalizedRows) {
      await updateProductImageAlt({
        storeDomain,
        token,
        apiVersion,
        productId: row.productId,
        imageId: row.id,
        altText: row.altText,
      });
      updatedCount += 1;
    }

    await applyIncrementalAuditPatch({
      shop,
      storeDomain,
      token,
      apiVersion,
      updatedProducts: [],
    });
  } catch (error) {
    const historyState = await appendImageOptimizerHistory({
      shop,
      action: "fix",
      status: "failed",
      summary: preCheck.summary,
      attempted: normalizedRows.length,
      updated: updatedCount,
      note: error?.message || "Failed to update one or more image ALT values.",
    });

    return {
      ok: false,
      error: error?.message || "Failed to update image ALT values.",
      summary: preCheck.summary,
      history: historyState.history,
      lastRun: historyState.lastRun,
    };
  }

  const appliedRows = normalizedRows.map((row) => ({
    id: row.id,
    altText: row.altText,
  }));
  const appliedCheck = validateImageAltRows(appliedRows);
  const historyState = await appendImageOptimizerHistory({
    shop,
    action: "fix",
    status: "success",
    summary: appliedCheck.summary,
    attempted: normalizedRows.length,
    updated: normalizedRows.length,
    note: `Updated ALT text for ${normalizedRows.length} image(s).`,
  });

  return {
    ok: true,
    updated: normalizedRows.length,
    summary: appliedCheck.summary,
    history: historyState.history,
    lastRun: historyState.lastRun,
  };
}

export async function previewImageCompressionBatch({
  rows = [],
  compressionOptions = {},
}) {
  const safeRows = (Array.isArray(rows) ? rows : []).filter((r) => r?.id && r?.imageUrl);
  if (!safeRows.length) {
    return {
      ok: false,
      error: "Select at least one image row to estimate compression savings.",
      previews: [],
    };
  }

  const options = normalizeCompressionOptions(compressionOptions);
  const previews = new Array(safeRows.length);
  let cursor = 0;

  async function worker() {
    while (cursor < safeRows.length) {
      const idx = cursor;
      cursor += 1;
      const row = safeRows[idx];
      try {
        const downloaded = await downloadImageBuffer(row.imageUrl);
        const compressed = await compressImageBuffer(downloaded.buffer, options);
        previews[idx] = {
          id: String(row.id),
          ok: true,
          skipped: compressed.skipped,
          reason: compressed.reason,
          originalBytes: compressed.originalBytes,
          compressedBytes: compressed.compressedBytes,
          savedBytes: compressed.savedBytes,
          savedPercent: compressed.savedPercent,
          originalWidth: compressed.originalWidth,
          originalHeight: compressed.originalHeight,
          width: compressed.width,
          height: compressed.height,
          originalFormat: compressed.originalFormat,
          format: compressed.format,
          resized: compressed.resized,
          formatChanged: compressed.formatChanged,
        };
      } catch (error) {
        previews[idx] = {
          id: String(row.id),
          ok: false,
          skipped: false,
          error: error?.message || "Failed to analyze image bytes.",
        };
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(3, safeRows.length) }, () => worker()));

  let totalOriginalBytes = 0;
  let totalCompressedBytes = 0;
  let totalSavedBytes = 0;
  let optimizableCount = 0;

  for (const item of previews) {
    if (!item?.ok) continue;
    totalOriginalBytes += Number(item.originalBytes || 0);
    totalCompressedBytes += Number(item.compressedBytes || 0);
    totalSavedBytes += Number(item.savedBytes || 0);
    if (!item.skipped && item.savedBytes > 0) {
      optimizableCount += 1;
    }
  }

  const totalSavedPercent =
    totalOriginalBytes > 0
      ? Math.round((totalSavedBytes / totalOriginalBytes) * 1000) / 10
      : 0;

  return {
    ok: true,
    options,
    previews,
    totals: {
      checked: previews.length,
      optimizableCount,
      totalOriginalBytes,
      totalCompressedBytes,
      totalSavedBytes,
      totalSavedPercent,
    },
  };
}

export async function applyImageCompressionBatch({
  shop,
  storeDomain,
  token,
  apiVersion,
  rows = [],
  compressionOptions = {},
  hasSuperAccess,
}) {
  const safeRows = (Array.isArray(rows) ? rows : []).filter(
    (r) => r?.id && r?.productId && r?.imageUrl,
  );
  const options = normalizeCompressionOptions(compressionOptions);

  if (!safeRows.length) {
    const historyState = await appendImageCompressionHistory({
      shop,
      status: "failed",
      preset: options.preset,
      attempted: 0,
      note: "No valid product images were selected for compression.",
    });

    return {
      ok: false,
      error: "Select at least one image row with a valid URL to compress.",
      results: [],
      compressionHistory: historyState.history,
      compressionStats: historyState.stats,
      lastCompressionRun: historyState.lastRun,
    };
  }

  let effectiveSuperAccess = Boolean(hasSuperAccess);
  if (shop && typeof hasSuperAccess !== "boolean") {
    const control = await getOrCreateStoreControl(shop).catch(() => null);
    effectiveSuperAccess = Boolean(control?.superAccess);
  }

  let creditsDeducted = 0;
  let creditsRemaining;
  let accountPlan = "FREE";
  let stoppedReason = "";

  if (shop && !effectiveSuperAccess) {
    const initialBalance = await checkCreditBalance(shop, "image_compression");
    creditsRemaining = initialBalance.availableCredits;
    accountPlan = initialBalance.plan || "FREE";
    if (!initialBalance.allowed) {
      return {
        ok: false,
        outOfCredits: true,
        error: `Insufficient AI tokens. Image compression requires ${initialBalance.cost} token per compressed image, but you have ${initialBalance.availableCredits} remaining.`,
        results: [],
        creditsDeducted: 0,
        creditsRemaining: initialBalance.availableCredits,
        plan: accountPlan,
        superAccess: false,
      };
    }
  } else if (shop && effectiveSuperAccess) {
    const initialBalance = await checkCreditBalance(shop, "image_compression").catch(() => null);
    creditsRemaining = initialBalance?.availableCredits;
    accountPlan = initialBalance?.plan || "PRO";
  }

  const results = [];
  let compressedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;
  let totalBytesBefore = 0;
  let totalBytesAfter = 0;
  let totalBytesSaved = 0;

  for (const row of safeRows) {
    if (shop && !effectiveSuperAccess && compressedCount > 0) {
      const stepBalance = await checkCreditBalance(shop, "image_compression");
      creditsRemaining = stepBalance.availableCredits;
      if (!stepBalance.allowed) {
        stoppedReason = `Stopped after ${compressedCount} compressed image(s): insufficient remaining AI tokens (${stepBalance.availableCredits} left, requires ${CREDIT_COSTS.image_compression}/image).`;
        break;
      }
    }

    try {
      const downloaded = await downloadImageBuffer(row.imageUrl);
      const compressed = await compressImageBuffer(downloaded.buffer, options);

      if (compressed.skipped) {
        skippedCount += 1;
        results.push({
          id: String(row.id),
          productId: String(row.productId),
          productTitle: row.productTitle || "",
          ok: true,
          skipped: true,
          reason: compressed.reason || "Already optimal.",
          originalBytes: compressed.originalBytes,
          compressedBytes: compressed.originalBytes,
          savedBytes: 0,
          savedPercent: 0,
          width: compressed.width,
          height: compressed.height,
          format: compressed.format,
        });
        continue;
      }

      const filename = buildSafeImageFilename({
        productHandle: row.productHandle,
        productTitle: row.productTitle,
        position: row.position,
        extension: compressed.extension,
      });

      const replaced = await replaceProductImageWithCompressed({
        storeDomain,
        token,
        apiVersion,
        productId: row.productId,
        imageId: row.id,
        buffer: compressed.buffer,
        filename,
        mimeType: compressed.mimeType,
        altText: row.altText || "",
        position: row.position || 1,
        variantIds: row.variantIds || [],
      });

      const finalWidth = Number(replaced.width || compressed.width || row.width || 0);
      const finalHeight = Number(replaced.height || compressed.height || row.height || 0);
      const sizeHealth = analyzeImageSizeHealth({
        width: finalWidth,
        height: finalHeight,
        fileSizeBytes: compressed.compressedBytes,
        format: compressed.format,
      });

      compressedCount += 1;
      totalBytesBefore += compressed.originalBytes;
      totalBytesAfter += compressed.compressedBytes;
      totalBytesSaved += compressed.savedBytes;

      if (shop) {
        const deduction = await deductCredits({
          shop,
          actionType: "image_compression",
          customCost: CREDIT_COSTS.image_compression,
          productId: row.productId,
          productTitle: row.productTitle || `Product #${row.productId}`,
          modelUsed: "sharp-image-optimizer",
          bypassLimit: effectiveSuperAccess,
        });
        creditsDeducted += deduction.deducted;
        creditsRemaining = deduction.remainingCredits;
        accountPlan = deduction.plan || accountPlan;
      }

      await recordProductRevision({
        shop,
        productId: row.productId,
        productTitle: row.productTitle || `Product #${row.productId}`,
        changeType: "IMAGE_COMPRESSED",
        beforeValues: {
          imageId: String(row.id),
          imageUrl: row.imageUrl,
          imageFileSize: formatBytes(compressed.originalBytes),
          imageDimensions: `${compressed.originalWidth}×${compressed.originalHeight}`,
          imageFormat: compressed.originalFormat.toUpperCase(),
        },
        afterValues: {
          imageId: replaced.newImageId || String(row.id),
          imageUrl: replaced.newImageUrl || row.imageUrl,
          imageFileSize: `${formatBytes(compressed.compressedBytes)} (-${compressed.savedPercent}%)`,
          imageDimensions: `${finalWidth}×${finalHeight}`,
          imageFormat: compressed.format.toUpperCase(),
        },
      });

      results.push({
        id: String(row.id),
        newImageId: replaced.newImageId || String(row.id),
        newImageUrl: replaced.newImageUrl || row.imageUrl,
        productId: String(row.productId),
        productTitle: row.productTitle || "",
        ok: true,
        skipped: false,
        originalBytes: compressed.originalBytes,
        compressedBytes: compressed.compressedBytes,
        savedBytes: compressed.savedBytes,
        savedPercent: compressed.savedPercent,
        originalWidth: compressed.originalWidth,
        originalHeight: compressed.originalHeight,
        width: finalWidth,
        height: finalHeight,
        format: compressed.format,
        sizeHealth,
      });
    } catch (error) {
      failedCount += 1;
      results.push({
        id: String(row.id),
        productId: String(row.productId),
        productTitle: row.productTitle || "",
        ok: false,
        skipped: false,
        error: error?.message || "Failed to compress and upload image.",
      });
    }
  }

  const savedPercent =
    totalBytesBefore > 0
      ? Math.round((totalBytesSaved / totalBytesBefore) * 1000) / 10
      : 0;

  const noteParts = [];
  if (compressedCount > 0) {
    noteParts.push(
      `Compressed ${compressedCount} image(s), saved ${formatBytes(totalBytesSaved)} (${savedPercent}%).`,
    );
  }
  if (skippedCount > 0) noteParts.push(`${skippedCount} already optimal.`);
  if (failedCount > 0) noteParts.push(`${failedCount} failed.`);
  if (stoppedReason) noteParts.push(stoppedReason);

  const historyState = await appendImageCompressionHistory({
    shop,
    status: compressedCount === 0 && failedCount > 0 ? "failed" : "success",
    preset: options.preset,
    attempted: safeRows.length,
    compressed: compressedCount,
    skipped: skippedCount,
    failed: failedCount,
    bytesBefore: totalBytesBefore,
    bytesAfter: totalBytesAfter,
    bytesSaved: totalBytesSaved,
    note: noteParts.join(" ") || "No changes applied.",
  });

  const firstFailure = results.find((item) => !item.ok)?.error || "";
  const allFailed = compressedCount === 0 && skippedCount === 0 && failedCount > 0;

  return {
    ok: !allFailed,
    error: allFailed
      ? firstFailure || "Failed to compress selected images."
      : failedCount > 0
        ? `${failedCount} image(s) failed: ${firstFailure}`
        : "",
    options,
    compressedCount,
    skippedCount,
    failedCount,
    totalBytesBefore,
    totalBytesAfter,
    totalBytesSaved,
    totalSavedPercent: savedPercent,
    creditsDeducted,
    creditsRemaining,
    plan: accountPlan,
    superAccess: effectiveSuperAccess,
    stoppedReason,
    outOfCredits: Boolean(stoppedReason),
    results,
    compressionHistory: historyState.history,
    compressionStats: historyState.stats,
    lastCompressionRun: historyState.lastRun,
  };
}

export async function regenerateSitemap({
  shop,
  storeDomain,
  token,
  apiVersion,
  extraManualUrl = "",
}) {
  const appState = await getAppState(shop);
  const manualUrls = [...appState.sitemapManualUrls];
  const cleanManual = String(extraManualUrl || "").trim();

  if (cleanManual) {
    manualUrls.push(cleanManual);
  }

  const { products } = await fetchAllProducts({
    storeDomain,
    token,
    apiVersion,
    maxProducts: 10000,
  });

  const urls = generateSitemapUrls({
    storeDomain,
    products,
    manualUrls,
  });

  const generatedAt = new Date().toISOString();

  const next = await updateAppState(shop, (current) => ({
    ...current,
    sitemapManualUrls: Array.from(new Set(manualUrls)),
    sitemapUrls: urls,
    sitemapGeneratedAt: generatedAt,
  }));

  return {
    generatedAt,
    urls: next.sitemapUrls,
    manualUrls: next.sitemapManualUrls,
  };
}

export async function updateAutopilotSettings({
  shop,
  enabled,
  optimizeMeta = true,
  optimizeAlt = true,
  maxImagesPerProduct = 3,
}) {
  const cleanShop = String(shop || "").trim().toLowerCase();
  const next = await updateAppState(cleanShop, (current) => ({
    ...current,
    autopilot: {
      ...(current.autopilot || {}),
      enabled: Boolean(enabled),
      optimizeMeta: Boolean(optimizeMeta),
      optimizeAlt: Boolean(optimizeAlt),
      maxImagesPerProduct: Math.max(1, Math.min(10, Number(maxImagesPerProduct || 3) || 3)),
      lastRuns: Array.isArray(current.autopilot?.lastRuns) ? current.autopilot.lastRuns : [],
    },
  }));
  return next.autopilot;
}

async function appendAutopilotRunLog(shop, entry) {
  await updateAppState(shop, (current) => {
    const prevRuns = Array.isArray(current.autopilot?.lastRuns) ? current.autopilot.lastRuns : [];
    const filtered = prevRuns.filter(
      (item) => !(String(item.productId) === String(entry.productId) && item.status === "RUNNING"),
    );
    return {
      ...current,
      autopilot: {
        ...(current.autopilot || {}),
        lastRuns: [entry, ...filtered].slice(0, 25),
      },
    };
  });
}

/**
 * Background Autopilot pipeline triggered by Shopify `products/create` webhook.
 * Automatically generates SEO meta tags, focus keywords, and Vision ALT text for
 * newly created/imported products when the merchant enables Autopilot.
 */
export async function runAutopilotForCreatedProduct({ shop, productPayload }) {
  const cleanShop = String(shop || "").trim().toLowerCase();
  const productId = String(productPayload?.id || "").trim();
  if (!cleanShop || !productId) {
    return { skipped: true, reason: "missing_context" };
  }

  const appState = await getAppState(cleanShop);
  const autopilot = appState?.autopilot || {};
  if (!autopilot.enabled) {
    return { skipped: true, reason: "autopilot_disabled" };
  }

  // Deduplicate Shopify webhook retries for the same product within 10 minutes
  const recentDuplicate = (autopilot.lastRuns || []).find((run) => {
    if (String(run.productId) !== productId) return false;
    const ageMs = Date.now() - new Date(run.createdAt || 0).getTime();
    return ageMs < 10 * 60 * 1000 && (run.status === "COMPLETED" || run.status === "RUNNING");
  });
  if (recentDuplicate) {
    return { skipped: true, reason: "duplicate_webhook" };
  }

  const productTitleFallback = String(productPayload?.title || `Product #${productId}`);
  const [offlineSession, platformAi, access] = await Promise.all([
    prisma.session.findFirst({ where: { shop: cleanShop, isOnline: false }, orderBy: { id: "desc" } }),
    getEffectivePlatformAiSettings(),
    checkStoreRouteAccess(cleanShop, "ai_features"),
  ]);

  const ctx = getShopContext({
    sessionShop: cleanShop,
    sessionToken: offlineSession?.accessToken || "",
  });

  if (ctx.configError || !ctx.token) {
    await appendAutopilotRunLog(cleanShop, {
      productId,
      productTitle: productTitleFallback,
      status: "SKIPPED",
      metaUpdated: false,
      imagesUpdated: 0,
      creditsDeducted: 0,
      error: ctx.configError || "No offline Shopify access token available.",
      createdAt: new Date().toISOString(),
    });
    return { skipped: true, reason: "missing_shopify_token" };
  }

  if (!AI_FEATURES_ENABLED || !platformAi?.isEnabled || !platformAi?.apiKey || !access.allowed) {
    await appendAutopilotRunLog(cleanShop, {
      productId,
      productTitle: productTitleFallback,
      status: "SKIPPED",
      metaUpdated: false,
      imagesUpdated: 0,
      creditsDeducted: 0,
      error: !access.allowed ? access.reason : "Platform Gemini AI is unavailable.",
      createdAt: new Date().toISOString(),
    });
    return { skipped: true, reason: "ai_unavailable" };
  }

  await appendAutopilotRunLog(cleanShop, {
    productId,
    productTitle: productTitleFallback,
    status: "RUNNING",
    metaUpdated: false,
    imagesUpdated: 0,
    creditsDeducted: 0,
    error: "",
    createdAt: new Date().toISOString(),
  });

  const hasSuperAccess = Boolean(access.control?.superAccess);
  const aiSettings = {
    provider: platformAi.provider,
    model: platformAi.model,
    apiKey: platformAi.apiKey,
    temperature: platformAi.temperature,
  };

  let metaUpdated = false;
  let imagesUpdated = 0;
  let creditsDeducted = 0;
  let runError = "";
  let liveTitle = productTitleFallback;

  try {
    const liveProduct =
      (await fetchProductById({
        storeDomain: ctx.storeDomain,
        token: ctx.token,
        apiVersion: ctx.apiVersion,
        productId,
      }).catch(() => null)) || {
        id: productId,
        title: productTitleFallback,
        handle: String(productPayload?.handle || ""),
        metafields_global_title_tag: "",
        metafields_global_description_tag: "",
        images: Array.isArray(productPayload?.images) ? productPayload.images : [],
      };

    liveTitle = liveProduct.title || productTitleFallback;
    const currentFocusKw = String(appState?.productSeo?.[productId]?.focusKeyword || "");

    // 1. Auto-optimize SEO metadata & focus keyword when incomplete
    let optimizedProduct = null;
    if (autopilot.optimizeMeta) {
      const needsMeta =
        !validateProductTitle(liveProduct.title).valid ||
        !validateUrlHandle(liveProduct.handle).valid ||
        !validateFocusKeyword(currentFocusKw).valid ||
        !validateMetaTitle(liveProduct.metafields_global_title_tag).valid ||
        !validateMetaTitle(liveProduct.metafields_global_title_tag).ideal ||
        !validateMetaDescription(liveProduct.metafields_global_description_tag).valid ||
        !validateMetaDescription(liveProduct.metafields_global_description_tag).ideal;

      if (needsMeta) {
        const metaBalance = await checkCreditBalance(cleanShop, "product_seo_fix");
        if (hasSuperAccess || metaBalance.allowed) {
          const suggestion = await generateProductSeoFix({
            settings: aiSettings,
            title: liveProduct.title,
            focusKeyword: currentFocusKw,
            handle: liveProduct.handle,
            metaTitle: liveProduct.metafields_global_title_tag,
            metaDescription: liveProduct.metafields_global_description_tag,
            descriptionHtml: liveProduct.body_html || "",
            productType: liveProduct.product_type || "",
            tags: liveProduct.tags || "",
            preserveHandle: validateUrlHandle(liveProduct.handle || "").valid,
          });

          if (!suggestion?.fallbackUsed) {
            const validation = buildAutoFixSeoPayload(
              { ...liveProduct, focusKeyword: currentFocusKw },
              suggestion,
            );
            if (validation.valid) {
              await applyValidatedProductSeoUpdate({
                shop: cleanShop,
                storeDomain: ctx.storeDomain,
                token: ctx.token,
                apiVersion: ctx.apiVersion,
                productId,
                payload: {
                  originalHandle: liveProduct.handle,
                  previousValues: {
                    title: liveProduct.title,
                    handle: liveProduct.handle,
                    focusKeyword: currentFocusKw,
                    metaTitle: liveProduct.metafields_global_title_tag,
                    metaDescription: liveProduct.metafields_global_description_tag,
                  },
                  aiVerdict: {
                    verdictSummary: suggestion.rationale || "Autopilot auto-optimized on product create.",
                    model: aiSettings.model || DEFAULT_GEMINI_MODEL,
                  },
                },
                normalized: validation.normalized,
                changeType: "AUTOPILOT_CREATE",
              });

              const deduction = await deductCredits({
                shop: cleanShop,
                actionType: "product_seo_fix",
                productId,
                productTitle: validation.normalized.title,
                modelUsed: aiSettings.model || DEFAULT_GEMINI_MODEL,
                bypassLimit: hasSuperAccess,
              });
              creditsDeducted += deduction.deducted;
              metaUpdated = true;
              optimizedProduct = {
                id: String(productId),
                title: validation.normalized.title,
                handle: validation.normalized.handle,
                metafields_global_title_tag: validation.normalized.metaTitle,
                metafields_global_description_tag: validation.normalized.metaDescription,
              };
            }
          }
        } else {
          runError = "Insufficient AI tokens for product metadata.";
        }
      }
    }

    // 2. Auto-optimize missing/weak image ALT tags with Gemini Vision
    if (autopilot.optimizeAlt && Array.isArray(liveProduct.images) && liveProduct.images.length) {
      const targetImages = liveProduct.images
        .filter((img) => {
          const check = validateImageAlt(img.alt || "");
          return !check.valid || check.generic || check.tooShort;
        })
        .slice(0, autopilot.maxImagesPerProduct || 3);

      for (const img of targetImages) {
        const imgId = String(img.id || "").trim();
        const imgUrl = String(img.src || "").trim();
        if (!imgId || !imgUrl) continue;

        const imgBalance = await checkCreditBalance(cleanShop, "vision_alt");
        if (!hasSuperAccess && !imgBalance.allowed) {
          if (!runError) runError = "Insufficient AI tokens for remaining image ALT tags.";
          break;
        }

        const vision = await generateVisionImageAlt({
          settings: aiSettings,
          imageUrl: imgUrl,
          productTitle: liveTitle,
        });

        if (vision?.fallbackUsed || !vision?.altText) continue;

        const altCheck = validateImageAlt(vision.altText);
        if (!altCheck.valid) continue;

        await updateProductImageAlt({
          storeDomain: ctx.storeDomain,
          token: ctx.token,
          apiVersion: ctx.apiVersion,
          productId,
          imageId: imgId,
          altText: altCheck.normalized,
        });

        const deduction = await deductCredits({
          shop: cleanShop,
          actionType: "vision_alt",
          productId,
          productTitle: `${liveTitle} (Image ${img.position || 1})`,
          modelUsed: aiSettings.model || DEFAULT_GEMINI_MODEL,
          bypassLimit: hasSuperAccess,
        });
        creditsDeducted += deduction.deducted;
        imagesUpdated += 1;
      }
    }

    if (metaUpdated || imagesUpdated > 0) {
      await applyIncrementalAuditPatch({
        shop: cleanShop,
        storeDomain: ctx.storeDomain,
        token: ctx.token,
        apiVersion: ctx.apiVersion,
        updatedProducts: optimizedProduct
          ? [optimizedProduct]
          : [
              {
                id: String(productId),
                title: liveProduct.title,
                handle: liveProduct.handle,
                metafields_global_title_tag: liveProduct.metafields_global_title_tag,
                metafields_global_description_tag: liveProduct.metafields_global_description_tag,
              },
            ],
      }).catch(() => {});
    }

    await appendAutopilotRunLog(cleanShop, {
      productId,
      productTitle: liveTitle,
      status: metaUpdated || imagesUpdated > 0 ? "COMPLETED" : "NO_CHANGES",
      metaUpdated,
      imagesUpdated,
      creditsDeducted,
      error: runError,
      createdAt: new Date().toISOString(),
    });

    return { ok: true, productId, metaUpdated, imagesUpdated, creditsDeducted };
  } catch (error) {
    await appendAutopilotRunLog(cleanShop, {
      productId,
      productTitle: liveTitle,
      status: "FAILED",
      metaUpdated,
      imagesUpdated,
      creditsDeducted,
      error: error?.message || "Autopilot failed.",
      createdAt: new Date().toISOString(),
    });
    return { ok: false, error: error?.message };
  }
}
