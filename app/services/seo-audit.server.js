import {
  validateFocusKeyword,
  validateMetaDescription,
  validateMetaTitle,
  validateProductTitle,
  validateRobotsRules,
  validateUrlHandle,
} from "../validators/seoValidators";

function addIssue(issues, severity, title, targetUrl, detail, fixPath) {
  issues.push({
    id: `${severity}-${issues.length + 1}`,
    severity,
    title,
    targetUrl,
    detail,
    fixPath,
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

export function buildSeoAudit({ storeDomain, products, appState }) {
  const issues = [];
  let indexable = 0;

  for (const product of products) {
    const productUrl = `https://${storeDomain}/products/${product.handle}`;
    const productState = appState.productSeo?.[String(product.id)] || {};

    const titleValid = validateProductTitle(product.title);
    if (!titleValid.valid) {
      addIssue(
        issues,
        "Warning",
        "Product title length issue",
        productUrl,
        "Product title should be between 25 and 70 characters.",
        `/app/products?focus=${product.id}`,
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
      );
    } else if (!metaTitleValid.ideal) {
      addIssue(
        issues,
        "Warning",
        "Meta title outside ideal length",
        productUrl,
        "Ideal meta title length is 45-60 characters.",
        `/app/products?focus=${product.id}`,
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
      );
    } else if (!metaDescriptionValid.ideal) {
      addIssue(
        issues,
        "Warning",
        "Meta description outside ideal length",
        productUrl,
        "Ideal meta description length is 120-155 characters.",
        `/app/products?focus=${product.id}`,
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
      );
    }

    if (titleValid.valid && metaTitleValid.valid && metaDescriptionValid.valid && handleValid.valid) {
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
