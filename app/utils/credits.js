export const PLAN_ALLOWANCES = Object.freeze({
  FREE: 15,
  PRO: 50,
});

export const CREDIT_COSTS = Object.freeze({
  meta_fix: 1,
  product_content_fix: 2,
  product_content_expand: 3,
  robots_txt_improvement: 2,
  product_seo_minor: 2,
  product_seo_fix: 3,
  audit_change: 2,
  vision_alt: 4,
  pagespeed_ai_fix: 4,
  catalog_cannibalization: 6,
  store_copilot: 10,
});

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
    return payload?.mode === "minor"
      ? CREDIT_COSTS.product_seo_minor
      : CREDIT_COSTS.product_seo_fix;
  }
  if (actionType === "product_content_fix") {
    return payload?.goal === "expand"
      ? CREDIT_COSTS.product_content_expand
      : CREDIT_COSTS.product_content_fix;
  }
  return CREDIT_COSTS[actionType] ?? 1;
}

