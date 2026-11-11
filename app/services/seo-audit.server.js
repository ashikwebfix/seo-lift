import {
  validateFocusKeyword,
  validateMetaDescription,
  validateMetaTitle,
  validateProductTitle,
  validateRobotsRules,
  validateUrlHandle,
} from "../validators/seoValidators.js";

function addIssue(issues, severity, title, targetUrl, detail, fixPath, meta = null) {
  issues.push({
    id: `${severity}-${issues.length + 1}`,
    severity,
    title,
    targetUrl,
    detail,
    fixPath,
    ...(meta ? { meta } : {}),
  });
}

export function scoreFromIssues(issues, qualityChecks = {}) {
  const critical = issues.filter((issue) => issue.severity === "Critical").length;
  const warning = issues.filter((issue) => issue.severity === "Warning").length;
  const info = issues.filter((issue) => issue.severity === "Info").length;
  const qualityBonus = Object.values(qualityChecks).filter(Boolean).length;

  const score = Math.max(0, Math.min(100, 100 - critical * 12 - warning * 4 - info + qualityBonus));
  const health = score >= 80 ? "strong" : score >= 55 ? "steady" : "weak";

  return {
    score,
    health,
    counts: { critical, warning, info },
  };
}

function evaluateProductAuditIssues({ storeDomain, product, productState = {}, issues = [] }) {
  const productUrl = `https://${storeDomain}/products/${product.handle}`;
  const productMeta = {
    productId: String(product.id),
    productTitle: String(product.title || ""),
    handle: String(product.handle || ""),
    focusKeyword: String(productState.focusKeyword || ""),
    metaTitle: String(product.metafields_global_title_tag || ""),
    metaDescription: String(product.metafields_global_description_tag || ""),
  };

  const titleValid = validateProductTitle(product.title);
  if (!titleValid.valid) {
    addIssue(
      issues,
      "Warning",
      "Product title length issue",
      productUrl,
      "Product title should be between 25 and 70 characters.",
      `/app/products?focus=${product.id}`,
      productMeta,
    );
  }

  const focusKeywordValid = validateFocusKeyword(productState.focusKeyword || "");
  if (!focusKeywordValid.valid) {
    addIssue(
      issues,
      "Info",
      "Focus keyword missing or invalid",
      productUrl,
      "Set a focus keyword between 3 and 40 characters.",
      `/app/products?focus=${product.id}`,
      productMeta,
    );
  }

  const metaTitleValid = validateMetaTitle(product.metafields_global_title_tag || "");
  if (!metaTitleValid.valid) {
    addIssue(
      issues,
      "Critical",
      "Meta title exceeds hard limit",
      productUrl,
      "Meta title must be 65 characters or less.",
      `/app/products?focus=${product.id}`,
      productMeta,
    );
  } else if (!metaTitleValid.ideal) {
    addIssue(
      issues,
      "Warning",
      "Meta title outside ideal length",
      productUrl,
      "Ideal meta title length is 45-60 characters.",
      `/app/products?focus=${product.id}`,
      productMeta,
    );
  }

  const metaDescriptionValid = validateMetaDescription(product.metafields_global_description_tag || "");
  if (!metaDescriptionValid.valid) {
    addIssue(
      issues,
      "Critical",
      "Meta description exceeds hard limit",
      productUrl,
      "Meta description must be 160 characters or less.",
      `/app/products?focus=${product.id}`,
      productMeta,
    );
  } else if (!metaDescriptionValid.ideal) {
    addIssue(
      issues,
      "Warning",
      "Meta description outside ideal length",
      productUrl,
      "Ideal meta description length is 120-155 characters.",
      `/app/products?focus=${product.id}`,
      productMeta,
    );
  }

  const handleValid = validateUrlHandle(product.handle || "");
  if (!handleValid.valid) {
    addIssue(
      issues,
      "Critical",
      "URL handle normalization issue",
      productUrl,
      "URL handle must be lowercase, hyphenated, and 3-45 characters.",
      `/app/url-optimization?focus=${product.id}`,
      productMeta,
    );
  }

  return Boolean(titleValid.valid && metaTitleValid.valid && metaDescriptionValid.valid && handleValid.valid);
}

export function buildSeoAudit({ storeDomain, products, appState }) {
  const issues = [];
  let indexable = 0;

  for (const product of products) {
    const productState = appState.productSeo?.[String(product.id)] || {};
    if (evaluateProductAuditIssues({ storeDomain, product, productState, issues })) {
      indexable += 1;
    }
  }

  const robotsCheck = validateRobotsRules(appState.robotsTxt);
  if (!robotsCheck.valid) {
    addIssue(
      issues,
      "Critical",
      "robots.txt missing required disallow rules",
      `https://${storeDomain}/robots.txt`,
      robotsCheck.message,
      "/app/robots",
    );
  }

  // ─── Super-Advanced 5-Pillar Health Scorecard & Cannibalization Radar ───────
  const totalProducts = Math.max(1, products.length);

  const serpScore = Math.round(
    (products.filter((p) => {
      const mt = validateMetaTitle(p.metafields_global_title_tag || "");
      const md = validateMetaDescription(p.metafields_global_description_tag || "");
      return mt.valid && md.valid;
    }).length /
      totalProducts) *
      100,
  );

  const contentScore = Math.round(
    (products.filter((p) => {
      const tv = validateProductTitle(p.title);
      const kv = validateFocusKeyword(appState.productSeo?.[String(p.id)]?.focusKeyword || "");
      return tv.valid && kv.valid;
    }).length /
      totalProducts) *
      100,
  );

  const technicalScore = Math.min(
    100,
    Math.round(
      (products.filter((p) => validateUrlHandle(p.handle).valid).length / totalProducts) * 80 +
        (robotsCheck.valid ? 20 : 0),
    ),
  );

  const visualScore = Math.max(0, 100 - issues.filter((i) => i.title.includes("ALT")).length * 5);

  // Detect Catalog Keyword Cannibalization
  const keywordMap = new Map();
  for (const p of products) {
    const kw = (appState.productSeo?.[String(p.id)]?.focusKeyword || "").trim().toLowerCase();
    if (kw && kw.length >= 3) {
      if (!keywordMap.has(kw)) keywordMap.set(kw, []);
      keywordMap.get(kw).push({
        id: String(p.id),
        title: String(p.title || ""),
        handle: String(p.handle || ""),
        metaTitle: String(p.metafields_global_title_tag || ""),
      });
    }
  }

  const cannibalizedGroups = Array.from(keywordMap.entries())
    .filter(([_, list]) => list.length > 1)
    .map(([keyword, groupProducts]) => ({
      keyword,
      count: groupProducts.length,
      products: groupProducts.slice(0, 10),
    }));

  const cannibalScore = Math.max(0, 100 - cannibalizedGroups.length * 15);

  for (const group of cannibalizedGroups) {
    addIssue(
      issues,
      "Warning",
      `Keyword cannibalization: "${group.keyword}" used on ${group.count} products`,
      `https://${storeDomain}/products`,
      `Multiple products share the focus keyword "${group.keyword}", causing internal search competition in Google rankings. Differentiate focus keywords to rank higher.`,
      "/app/products",
    );
  }

  const qualityChecks = {
    robotsValid: robotsCheck.valid,
    sitemapGenerated: Boolean(appState.sitemapGeneratedAt),
    hasManualUrls: appState.sitemapManualUrls.length >= 0,
  };

  const scoring = scoreFromIssues(issues, qualityChecks);
  const pagesScanned = products.length + 2;

  return {
    generatedAt: new Date().toISOString(),
    pagesScanned,
    indexCoverage: pagesScanned ? Math.round((indexable / Math.max(1, products.length)) * 100) : 0,
    issues,
    summary: {
      ...scoring,
      lastScanDate: new Date().toISOString(),
      pillars: {
        serpScore,
        contentScore,
        technicalScore,
        visualScore,
        cannibalScore,
        cannibalizedKeywordsCount: cannibalizedGroups.length,
      },
      cannibalizedGroups: cannibalizedGroups.slice(0, 10),
    },
  };
}

/**
 * Incrementally updates a cached audit for modified products and/or robots rules
 * in O(edited + issues) without downloading the entire Shopify product catalog.
 */
export function patchCachedSeoAudit({
  existingScan,
  storeDomain,
  updatedProducts = [],
  appState,
}) {
  if (!existingScan || !Array.isArray(existingScan.issues)) {
    return null;
  }

  const updatedIds = new Set(
    (Array.isArray(updatedProducts) ? updatedProducts : [])
      .map((p) => String(p?.id || ""))
      .filter(Boolean),
  );

  const retainedIssues = existingScan.issues.filter((issue) => {
    if (issue?.fixPath === "/app/robots") return false;
    const pid = issue?.meta?.productId ? String(issue.meta.productId) : "";
    if (pid && updatedIds.has(pid)) return false;
    return true;
  });

  const nextIssues = retainedIssues.map((issue, idx) => ({
    ...issue,
    id: `${issue.severity}-${idx + 1}`,
  }));

  for (const product of Array.isArray(updatedProducts) ? updatedProducts : []) {
    if (!product?.id) continue;
    const pid = String(product.id);
    const productState = appState?.productSeo?.[pid] || {};
    evaluateProductAuditIssues({
      storeDomain,
      product,
      productState,
      issues: nextIssues,
    });
  }

  const robotsCheck = validateRobotsRules(appState?.robotsTxt || "");
  if (!robotsCheck.valid) {
    addIssue(
      nextIssues,
      "Critical",
      "robots.txt missing required disallow rules",
      `https://${storeDomain}/robots.txt`,
      robotsCheck.message,
      "/app/robots",
    );
  }

  const qualityChecks = {
    robotsValid: robotsCheck.valid,
    sitemapGenerated: Boolean(appState?.sitemapGeneratedAt),
    hasManualUrls: Array.isArray(appState?.sitemapManualUrls),
  };

  const scoring = scoreFromIssues(nextIssues, qualityChecks);
  const existingPillars = existingScan.summary?.pillars || {};
  const pagesScanned = existingScan.pagesScanned || (Array.isArray(updatedProducts) ? updatedProducts.length + 2 : 2);
  const totalProducts = Math.max(1, pagesScanned - 2);
  const brokenProductIds = new Set(
    nextIssues
      .filter((issue) => issue.severity === "Critical" && issue.meta?.productId)
      .map((issue) => String(issue.meta.productId)),
  );
  const estimatedIndexable = Math.max(0, totalProducts - brokenProductIds.size);

  return {
    ...existingScan,
    generatedAt: new Date().toISOString(),
    pagesScanned,
    indexCoverage: Math.round((estimatedIndexable / totalProducts) * 100),
    issues: nextIssues,
    summary: {
      ...(existingScan.summary || {}),
      ...scoring,
      lastScanDate: new Date().toISOString(),
      pillars: {
        ...existingPillars,
        visualScore: Math.max(0, 100 - nextIssues.filter((i) => i.title.includes("ALT")).length * 5),
      },
    },
  };
}

export function buildTrendSummary(scoreHistory, currentScore) {
  const history = Array.isArray(scoreHistory) ? scoreHistory : [];
  const previous = history.at(-1)?.score;

  if (typeof previous !== "number") {
    return { direction: "flat", delta: 0, label: "First scan baseline" };
  }

  const delta = currentScore - previous;
  if (delta > 0) {
    return { direction: "up", delta, label: `Up ${delta} points from last scan` };
  }
  if (delta < 0) {
    return { direction: "down", delta, label: `Down ${Math.abs(delta)} points from last scan` };
  }
  return { direction: "flat", delta: 0, label: "No score change from last scan" };
}
