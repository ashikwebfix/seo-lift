import { mapShopifyProductToSeoRow } from "../mappers/product.mapper";
import {
  suggestImageAltText,
  validateImageAlt,
  validateMetaDescription,
  validateMetaTitle,
  validateProductSeoInput,
  validateUrlHandle,
} from "../validators/seoValidators";
import { getAppState, updateAppState } from "./app-state.server";
import { runFullScan } from "./seo-engine.server";
import { generateSitemapUrls } from "./sitemap.server";
import {
  fetchProductImages,
  fetchProducts,
  updateProductImageAlt,
  updateProductSeo,
} from "./shopify-admin.server";

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
}) {
  const appState = await getAppState(shop);

  const { products, pagination } = await fetchProducts({
    storeDomain,
    token,
    apiVersion,
    limit,
    pageInfo,
    query,
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

export async function loadImageOptimizerPage({
  shop,
  storeDomain,
  token,
  apiVersion,
  limit = 25,
  pageInfo = "",
  query = "",
  statusFilter = "all",
}) {
  const { rows, pagination } = await fetchProductImages({
    storeDomain,
    token,
    apiVersion,
    limit,
    pageInfo,
    query,
  });

  const normalizedRows = rows.map((row) => {
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
  const filter = normalizeImageStatusFilter(statusFilter);
  const filteredRows = normalizedRows.filter((row) => {
    if (filter === "all") return true;
    const needsFix = !row.validation.valid || row.validation.generic || row.validation.tooShort;
    return filter === "needs-fix" ? needsFix : !needsFix;
  });
  const pageCheck = validateImageAltRows(filteredRows);
  const appState = shop ? await getAppState(shop) : { imageOptimizerHistory: [] };
  const history = Array.isArray(appState.imageOptimizerHistory) ? appState.imageOptimizerHistory : [];

  return {
    rows: filteredRows,
    pagination,
    summary: pageCheck.summary,
    statusFilter: filter,
    history: history.slice(0, IMAGE_HISTORY_LIMIT),
    lastRun: history[0] || null,
  };
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

  await updateProductSeo({
    storeDomain,
    token,
    apiVersion,
    productId,
    payload: validation.normalized,
  });

  await updateAppState(shop, (current) => ({
    ...current,
    productSeo: {
      ...current.productSeo,
      [String(productId)]: {
        ...(current.productSeo?.[String(productId)] || {}),
        focusKeyword: validation.normalized.focusKeyword,
      },
    },
  }));

  await runFullScan({
    shop,
    storeDomain,
    token,
    apiVersion,
  });

  return {
    ok: true,
    productId: String(productId),
    normalized: validation.normalized,
    quality: validation.quality,
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

  await Promise.all(
    rows.map((row) =>
      updateProductSeo({
        storeDomain,
        token,
        apiVersion,
        productId: row.id,
        payload: {
          title: row.title,
          handle: validateUrlHandle(row.handle || row.title).normalized,
          metaTitle: String(row.metaTitle || "").trim(),
          metaDescription: String(row.metaDescription || "").trim(),
        },
      }),
    ),
  );

  await runFullScan({
    shop,
    storeDomain,
    token,
    apiVersion,
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

  await Promise.all(
    normalizedRows.map((row) =>
      updateProductSeo({
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
      }),
    ),
  );

  await runFullScan({
    shop,
    storeDomain,
    token,
    apiVersion,
  });

  return {
    ok: true,
    updated: normalizedRows.length,
  };
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

  try {
    await Promise.all(
      normalizedRows.map((row) =>
        updateProductImageAlt({
          storeDomain,
          token,
          apiVersion,
          productId: row.productId,
          imageId: row.id,
          altText: row.altText,
        }),
      ),
    );

    await runFullScan({
      shop,
      storeDomain,
      token,
      apiVersion,
    });
  } catch (error) {
    const historyState = await appendImageOptimizerHistory({
      shop,
      action: "fix",
      status: "failed",
      summary: preCheck.summary,
      attempted: normalizedRows.length,
      updated: 0,
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

  const { products } = await fetchProducts({
    storeDomain,
    token,
    apiVersion,
    limit: 250,
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
