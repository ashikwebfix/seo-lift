export const PLAN_ALLOWANCES = Object.freeze({
  FREE: 15,
  PRO: 50,
});

export const CREDIT_COSTS = Object.freeze({
  ai_chat: 1,
  image_compression: 1,
  meta_fix: 2,
  product_seo_minor: 2,
  product_seo_fix: 2,
  robots_txt_improvement: 2,
  audit_change: 2,
  vision_alt: 4,
  pagespeed_ai_fix: 4,
  product_content_fix: 6,
  product_content_expand: 6,
  catalog_cannibalization: 6,
  product_seo_full: 8,
  store_copilot: 10,
});

export const TOKEN_PRICING_CATALOG = Object.freeze([
  {
    key: "ai_chat",
    label: "AI Copilot Chat Message",
    unit: "per reply",
    cost: CREDIT_COSTS.ai_chat,
    category: "AI Chat & Audits",
    description: "Store-aware Copilot reply & action plan (0 tok if fallback is used).",
  },
  {
    key: "image_compression",
    label: "Image Compression (Sharp)",
    unit: "per compressed image",
    cost: CREDIT_COSTS.image_compression,
    category: "Images & Speed",
    description: "Compresses & replaces product image in Shopify. Skipped optimal images cost 0 tok.",
  },
  {
    key: "product_seo_fix",
    label: "Title, Focus Keyword & Meta Fix",
    unit: "per product",
    cost: CREDIT_COSTS.product_seo_fix,
    category: "Product SEO",
    description: "Optimizes product title, handle, focus keyword, meta title & meta description.",
  },
  {
    key: "meta_fix",
    label: "Bulk Meta Title & Description AI",
    unit: "per product",
    cost: CREDIT_COSTS.meta_fix,
    category: "Product SEO",
    description: "Generates SERP-compliant meta title & meta description per product.",
  },
  {
    key: "product_content_fix",
    label: "Product Description Fix (AI Copy)",
    unit: "per product",
    cost: CREDIT_COSTS.product_content_fix,
    category: "Product SEO",
    description: "Polishes, structures (H3/bullets), or rewrites rich HTML product description.",
  },
  {
    key: "product_seo_full",
    label: "Full Product SEO + Description Bundle",
    unit: "per product",
    cost: CREDIT_COSTS.product_seo_full,
    category: "Product SEO",
    description: "Updates Title/Meta/Keyword (2 tok) + Full Product Description HTML (6 tok).",
  },
  {
    key: "vision_alt",
    label: "Vision Image ALT Text (Gemini Vision)",
    unit: "per image",
    cost: CREDIT_COSTS.vision_alt,
    category: "Images & Speed",
    description: "Visual AI inspects the actual photo to craft descriptive SEO ALT text.",
  },
  {
    key: "robots_txt_improvement",
    label: "AI Robots.txt Optimization",
    unit: "per run",
    cost: CREDIT_COSTS.robots_txt_improvement,
    category: "Technical SEO",
    description: "Gemini-tailored robots.txt directives (best-practice template is Free).",
  },
  {
    key: "audit_change",
    label: "Gemini Diff Change Audit",
    unit: "per audit",
    cost: CREDIT_COSTS.audit_change,
    category: "AI Chat & Audits",
    description: "Before/After CTR & ranking risk evaluation before saving SEO edits.",
  },
  {
    key: "pagespeed_ai_fix",
    label: "PageSpeed Core Web Vitals AI Plan",
    unit: "per plan",
    cost: CREDIT_COSTS.pagespeed_ai_fix,
    category: "Images & Speed",
    description: "Generates Liquid/script/LCP remediation steps from live Lighthouse telemetry.",
  },
  {
    key: "catalog_cannibalization",
    label: "Keyword Cannibalization Resolver",
    unit: "per run",
    cost: CREDIT_COSTS.catalog_cannibalization,
    category: "Technical SEO",
    description: "Differentiates competing focus keywords across overlapping products.",
  },
  {
    key: "store_copilot",
    label: "Executive Store-Wide Copilot Brief",
    unit: "per brief",
    cost: CREDIT_COSTS.store_copilot,
    category: "AI Chat & Audits",
    description: "Full-store prioritized roadmap combining SEO Audit & Search Console data.",
  },
  {
    key: "free_tools",
    label: "Built-In Scans, Speed Test, Sitemap, 301s & Rollback",
    unit: "unlimited",
    cost: 0,
    category: "Free Tools",
    description: "SEO Audit scans, PageSpeed Insights tests, XML sitemap rebuilds, manual edits & rollbacks.",
  },
]);

export const TOKEN_PACKAGES = Object.freeze([
  {
    id: "pack_100",
    tokens: 100,
    price: 5,
    label: "100 Tokens",
    tag: "Starter Top-Up",
    pricePerToken: "$0.05 / token",
    packName: "100 AI Tokens Package",
    featured: false,
  },
  {
    id: "pack_250",
    tokens: 250,
    price: 10,
    label: "250 Tokens",
    tag: "Popular · Save 20%",
    pricePerToken: "$0.04 / token",
    packName: "250 AI Tokens Package",
    featured: true,
  },
  {
    id: "pack_500",
    tokens: 500,
    price: 18,
    label: "500 Tokens",
    tag: "Best Value · Save 28%",
    pricePerToken: "$0.036 / token",
    packName: "500 AI Tokens Package",
    featured: false,
  },
]);

export function getTokenPackageById(packageId) {
  const cleanId = String(packageId || "").trim();
  return TOKEN_PACKAGES.find((pkg) => pkg.id === cleanId) || TOKEN_PACKAGES[0];
}

/**
 * Resolves purchased token count strictly from the verified Shopify charge amount/name
 * (never trusting mutable URL query parameters for the token amount).
 */
export function resolvePackageFromShopifyPurchase(purchase, fallbackPackageId = "") {
  if (!purchase) return null;
  const purchaseName = String(purchase.name || "").trim();
  const amount = Number(purchase?.price?.amount);

  const byName = TOKEN_PACKAGES.find((pkg) => pkg.packName === purchaseName);
  if (byName) return byName;

  if (Number.isFinite(amount) && amount > 0) {
    const byPrice = TOKEN_PACKAGES.find((pkg) => Math.abs(pkg.price - amount) < 0.01);
    if (byPrice) return byPrice;
  }

  return getTokenPackageById(fallbackPackageId);
}

/**
 * Computes realistic token cost for an AI action, accounting for lightweight vs heavy modes.
 */
export function resolveActionCreditCost(actionType, payload = {}) {
  if (actionType === "product_seo_fix") {
    return payload?.mode === "full"
      ? CREDIT_COSTS.product_seo_full
      : CREDIT_COSTS.product_seo_fix;
  }
  if (actionType === "product_content_fix") {
    return payload?.goal === "expand"
      ? CREDIT_COSTS.product_content_expand
      : CREDIT_COSTS.product_content_fix;
  }
  if (actionType === "robots_txt_improvement" && payload?.useAi === false) {
    return 0;
  }
  return CREDIT_COSTS[actionType] ?? 1;
}

function clampCount(value, min, max, fallback) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(min, Math.min(max, Math.round(num)));
}

/**
 * Computes the pre-execution token estimate for any AI Mode chat action.
 */
export function estimateChatActionTokens(action = {}, context = {}) {
  const type = String(action?.type || "").trim().toUpperCase();
  const params = action?.params && typeof action.params === "object" ? action.params : {};
  const superAccess = Boolean(context?.superAccess);
  const selectedProduct = context?.selectedProduct || null;

  let unitCost = 0;
  let count = 1;
  let unitLabel = "run";
  let isVariable = false;
  let scopeNote = "";

  if (type === "AUTO_FIX_PRODUCTS") {
    const ids = Array.isArray(params.productIds) ? params.productIds.filter(Boolean) : [];
    count = ids.length > 0 ? ids.length : clampCount(params.maxProducts, 1, 5, 3);
    unitCost = CREDIT_COSTS.product_seo_fix;
    unitLabel = "product";
    isVariable = ids.length === 0;
    scopeNote = "2 tok per product updated (Title, Keyword, Handle & Meta)";
  } else if (type === "FIX_PRODUCT_DESCRIPTION") {
    const ids = Array.isArray(params.productIds) ? params.productIds.filter(Boolean) : [];
    count = ids.length > 0 ? ids.length : clampCount(params.maxProducts, 1, 5, selectedProduct ? 1 : 3);
    unitCost = CREDIT_COSTS.product_content_fix;
    unitLabel = "product";
    isVariable = ids.length === 0;
    scopeNote = "6 tok per product description updated";
  } else if (type === "COMPRESS_HEAVY_IMAGES") {
    const explicitCount = Number(context?.candidateImageCount || 0);
    count = explicitCount > 0 ? explicitCount : clampCount(params.maxImages, 1, 15, 8);
    unitCost = CREDIT_COSTS.image_compression;
    unitLabel = "image";
    isVariable = true;
    scopeNote = "1 tok per image compressed (skipped optimal images = 0 tok)";
  } else if (type === "FIX_IMAGE_ALT") {
    if (params.useAi) {
      count = clampCount(params.maxImages, 1, 20, 5);
      unitCost = CREDIT_COSTS.vision_alt;
      unitLabel = "image";
      isVariable = true;
      scopeNote = "4 tok per image via Vision AI";
    } else {
      unitCost = 0;
      count = 0;
      scopeNote = "Heuristic SEO ALT fill is free";
    }
  } else if (type === "FIX_ROBOTS_TXT" && params.useAi) {
    unitCost = CREDIT_COSTS.robots_txt_improvement;
    count = 1;
    unitLabel = "run";
    scopeNote = "2 tok for Gemini robots.txt rules";
  }

  const standardTotal = Math.max(0, unitCost * Math.max(0, count));
  const estimatedTokens = superAccess ? 0 : standardTotal;
  const isBulk = count > 1 && unitCost > 0;
  const pluralUnit = count === 1 ? unitLabel : `${unitLabel}s`;

  let badgeLabel = "0 tok · Free";
  if (superAccess && standardTotal > 0) {
    badgeLabel = `Super Access (0 tok · std ${standardTotal})`;
  } else if (standardTotal > 0) {
    badgeLabel = isVariable
      ? `Up to ${standardTotal} tok (${count} × ${unitCost} tok/${unitLabel})`
      : `${standardTotal} tok (${count} ${pluralUnit} × ${unitCost} tok)`;
  }

  return {
    type,
    unitCost,
    count,
    unitLabel,
    isBulk,
    isVariable,
    standardTotal,
    estimatedTokens,
    superAccess,
    badgeLabel,
    scopeNote,
  };
}

/**
 * Calculates total required AI tokens and recommends a top-up pack for the Token Calculator UI.
 */
export function calculateTokenEstimateSummary(counts = {}, availableCredits = 0, superAccess = false) {
  const safe = (v) => Math.max(0, Math.min(100000, Math.floor(Number(v) || 0)));

  const items = [
    {
      key: "productSeoFixes",
      label: "Title, Meta Title & Meta Description Fix",
      qty: safe(counts.productSeoFixes),
      rate: CREDIT_COSTS.product_seo_fix,
      unit: "product",
    },
    {
      key: "productDescriptionFixes",
      label: "Product Description Fix (HTML Copy)",
      qty: safe(counts.productDescriptionFixes),
      rate: CREDIT_COSTS.product_content_fix,
      unit: "product",
    },
    {
      key: "imageCompressions",
      label: "Image Compression (Sharp Optimizer)",
      qty: safe(counts.imageCompressions),
      rate: CREDIT_COSTS.image_compression,
      unit: "image",
    },
    {
      key: "visionAltImages",
      label: "AI Vision Image ALT Tags",
      qty: safe(counts.visionAltImages),
      rate: CREDIT_COSTS.vision_alt,
      unit: "image",
    },
    {
      key: "chatMessages",
      label: "AI Mode Chat Prompts",
      qty: safe(counts.chatMessages),
      rate: CREDIT_COSTS.ai_chat,
      unit: "message",
    },
    {
      key: "aiRobotsFixes",
      label: "AI Robots.txt / Diff Audit",
      qty: safe(counts.aiRobotsFixes),
      rate: CREDIT_COSTS.robots_txt_improvement,
      unit: "run",
    },
    {
      key: "pagespeedAiPlans",
      label: "PageSpeed AI Fix Plan",
      qty: safe(counts.pagespeedAiPlans),
      rate: CREDIT_COSTS.pagespeed_ai_fix,
      unit: "plan",
    },
    {
      key: "copilotBriefs",
      label: "Executive Store Copilot Brief",
      qty: safe(counts.copilotBriefs),
      rate: CREDIT_COSTS.store_copilot,
      unit: "brief",
    },
  ].map((item) => ({
    ...item,
    subtotal: item.qty * item.rate,
  }));

  const standardTokens = items.reduce((sum, item) => sum + item.subtotal, 0);
  const billableTokens = superAccess ? 0 : standardTokens;
  const balance = Math.max(0, Number(availableCredits) || 0);
  const shortfallTokens = superAccess ? 0 : Math.max(0, billableTokens - balance);
  const coveredByBalance = superAccess || billableTokens <= balance;

  const recommendedPackage =
    shortfallTokens > 0
      ? TOKEN_PACKAGES.find((pkg) => pkg.tokens >= shortfallTokens) ||
        TOKEN_PACKAGES[TOKEN_PACKAGES.length - 1]
      : null;

  return {
    items,
    standardTokens,
    billableTokens,
    availableCredits: balance,
    shortfallTokens,
    coveredByBalance,
    recommendedPackage,
    superAccess: Boolean(superAccess),
  };
}
