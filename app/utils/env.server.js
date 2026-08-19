export function getSeoEnv() {
  return {
    storeDomain: normalizeShopDomain(process.env.SHOPIFY_STORE_DOMAIN || ""),
    adminToken: (process.env.SHOPIFY_ADMIN_ACCESS_TOKEN || "").trim(),
    apiVersion: (process.env.SHOPIFY_ADMIN_API_VERSION || "2025-10").trim(),
    demoSeedEnabled: (process.env.ENABLE_DEMO_SEED || "false").trim() === "true",
  };
}

export function normalizeShopDomain(value) {
  if (!value) return "";
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");
}

export function resolveStoreDomain({ envDomain, sessionShop, urlShop }) {
  const fromSession = normalizeShopDomain(sessionShop || "");
  const fromUrl = normalizeShopDomain(urlShop || "");
  const fromEnv = normalizeShopDomain(envDomain || "");

  if (fromSession) return fromSession;
  if (fromUrl) return fromUrl;
  if (fromEnv) return fromEnv;
  return "";
}

export function buildMissingConfigMessage({ storeDomain, adminToken }) {
  const missing = [];
  if (!storeDomain) missing.push("SHOPIFY_STORE_DOMAIN");
  if (!adminToken) missing.push("SHOPIFY_ADMIN_ACCESS_TOKEN");
  if (!missing.length) return "";
  return `Missing required Shopify env vars: ${missing.join(", ")}.`;
}
