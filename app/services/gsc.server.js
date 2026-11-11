import crypto from "node:crypto";
import { getAppState, updateAppState } from "./app-state.server.js";
import { fetchAllProducts } from "./shopify-admin.server.js";
import { getEffectiveGscOAuthConfig } from "./store-control.server.js";

const GSC_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GSC_API_BASE = "https://www.googleapis.com/webmasters/v3";

function getGscStateSecret() {
  return (
    process.env.SHOPIFY_API_SECRET ||
    process.env.SUPERADMIN_SESSION_SECRET ||
    "ecom-seo-gsc-oauth-state-secret"
  );
}

export function sanitizeGscForClient(gsc = {}) {
  return {
    connected: Boolean(gsc?.connected),
    mode: String(gsc?.mode || ""),
    siteUrl: String(gsc?.siteUrl || ""),
    availableSites: Array.isArray(gsc?.availableSites) ? gsc.availableSites : [],
    lastSyncedAt: gsc?.lastSyncedAt || null,
    summary: gsc?.summary || null,
    urlMetrics: Array.isArray(gsc?.urlMetrics) ? gsc.urlMetrics : [],
    quickWins: Array.isArray(gsc?.quickWins) ? gsc.quickWins : [],
  };
}

export function createSignedGscState({ shop, host = "" }) {
  const payload = Buffer.from(
    JSON.stringify({
      shop: String(shop || "").trim().toLowerCase(),
      host: String(host || "").trim(),
      ts: Date.now(),
      nonce: crypto.randomBytes(8).toString("hex"),
    }),
    "utf8",
  ).toString("base64url");

  const sig = crypto.createHmac("sha256", getGscStateSecret()).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

export function verifySignedGscState(rawState, maxAgeMs = 15 * 60 * 1000) {
  const parts = String(rawState || "").split(".");
  if (parts.length !== 2) return null;

  const [payload, sig] = parts;
  if (!payload || !sig) return null;

  const expectedSig = crypto.createHmac("sha256", getGscStateSecret()).update(payload).digest("hex");
  const sigBuf = Buffer.from(sig, "utf8");
  const expectedBuf = Buffer.from(expectedSig, "utf8");
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!parsed?.shop || !parsed?.ts) return null;
    if (Date.now() - Number(parsed.ts) > maxAgeMs) return null;
    return {
      shop: String(parsed.shop).trim().toLowerCase(),
      host: String(parsed.host || "").trim(),
    };
  } catch {
    return null;
  }
}

export async function buildGscAuthUrl({ shop, host = "", origin }) {
  const oauth = await getEffectiveGscOAuthConfig();
  if (!oauth.clientId || !oauth.clientSecret) {
    throw new Error(
      "Google Search Console OAuth Client ID/Secret is not configured. Ask SuperAdmin to add it in /superadmin/ai, or import a GSC CSV export below.",
    );
  }

  const baseUrl = String(process.env.SHOPIFY_APP_URL || origin || "").replace(/\/$/, "");
  const redirectUri = `${baseUrl}/api/gsc/callback`;
  const state = createSignedGscState({ shop, host });

  const params = new URLSearchParams({
    client_id: oauth.clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GSC_SCOPE,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });

  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export async function exchangeGscCodeForTokens({ code, origin }) {
  const oauth = await getEffectiveGscOAuthConfig();
  if (!oauth.clientId || !oauth.clientSecret) {
    throw new Error("Google Search Console OAuth credentials are missing.");
  }

  const baseUrl = String(process.env.SHOPIFY_APP_URL || origin || "").replace(/\/$/, "");
  const redirectUri = `${baseUrl}/api/gsc/callback`;

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: String(code || ""),
      client_id: oauth.clientId,
      client_secret: oauth.clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.access_token) {
    throw new Error(data?.error_description || data?.error || "Failed to exchange Google OAuth code.");
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || "",
    expiresAt: Date.now() + Number(data.expires_in || 3600) * 1000,
  };
}

export async function refreshGscAccessToken({ refreshToken }) {
  const oauth = await getEffectiveGscOAuthConfig();
  if (!oauth.clientId || !oauth.clientSecret || !refreshToken) {
    throw new Error("Unable to refresh Google Search Console token. Reconnect Google Search Console.");
  }

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: oauth.clientId,
      client_secret: oauth.clientSecret,
      grant_type: "refresh_token",
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.access_token) {
    throw new Error(data?.error_description || data?.error || "Google Search Console token expired.");
  }

  return {
    accessToken: data.access_token,
    expiresAt: Date.now() + Number(data.expires_in || 3600) * 1000,
  };
}

export async function listGscSites({ accessToken }) {
  const res = await fetch(`${GSC_API_BASE}/sites`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error?.message || "Failed to list verified Search Console properties.");
  }

  return (Array.isArray(data.siteEntry) ? data.siteEntry : [])
    .filter((entry) => entry?.permissionLevel !== "siteUnverifiedUser")
    .map((entry) => ({
      siteUrl: String(entry.siteUrl || ""),
      permissionLevel: String(entry.permissionLevel || ""),
    }))
    .filter((entry) => Boolean(entry.siteUrl));
}

function isoDateDaysAgo(daysAgo) {
  const d = new Date(Date.now() - daysAgo * 86400_000);
  return d.toISOString().slice(0, 10);
}

export async function fetchGscSearchAnalytics({ accessToken, siteUrl, days = 28 }) {
  const startDate = isoDateDaysAgo(days + 2);
  const endDate = isoDateDaysAgo(2);

  const res = await fetch(`${GSC_API_BASE}/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      startDate,
      endDate,
      dimensions: ["page", "query"],
      rowLimit: 1000,
      dataState: "final",
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error?.message || "Failed to query Google Search Console analytics.");
  }

  return (Array.isArray(data.rows) ? data.rows : []).map((row) => ({
    page: String(row?.keys?.[0] || ""),
    query: String(row?.keys?.[1] || ""),
    clicks: Number(row?.clicks || 0),
    impressions: Number(row?.impressions || 0),
    ctr: Number(row?.ctr || 0),
    position: Number(row?.position || 0),
  }));
}

export function extractPathname(rawUrlOrPath) {
  const raw = String(rawUrlOrPath || "").trim();
  if (!raw) return "/";
  try {
    if (/^https?:\/\//i.test(raw)) {
      return new URL(raw).pathname || "/";
    }
  } catch {
    // Fallback below
  }
  const clean = raw.split("?")[0].split("#")[0];
  return clean.startsWith("/") ? clean : `/${clean}`;
}

export function extractProductHandleFromPath(pathname) {
  const match = String(pathname || "").match(/\/products\/([^/?#]+)/i);
  if (!match?.[1]) return "";
  try {
    return decodeURIComponent(match[1]).toLowerCase();
  } catch {
    return String(match[1]).toLowerCase();
  }
}

function parseCsvLine(line) {
  const cells = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  cells.push(current.trim());
  return cells;
}

function parseNumberCell(raw) {
  const clean = String(raw || "").replace(/[,\s]/g, "").trim();
  if (!clean) return 0;
  if (clean.endsWith("%")) {
    const num = Number(clean.slice(0, -1));
    return Number.isFinite(num) ? num / 100 : 0;
  }
  const num = Number(clean);
  return Number.isFinite(num) ? num : 0;
}

/**
 * Parses Google Search Console exported CSV (Pages, Queries, or combined Page+Query reports).
 */
export function parseGscCsvText(csvText, storeDomain = "") {
  const lines = String(csvText || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    throw new Error("CSV must include a header row and at least one data row.");
  }

  const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
  const findCol = (candidates) => headers.findIndex((h) => candidates.some((c) => h.includes(c)));

  const pageIdx = findCol(["top pages", "page", "url", "landing"]);
  const queryIdx = findCol(["top queries", "query", "keyword"]);
  const clicksIdx = findCol(["click"]);
  const impIdx = findCol(["impression"]);
  const ctrIdx = findCol(["ctr"]);
  const posIdx = findCol(["position", "rank"]);

  if (pageIdx === -1 && queryIdx === -1) {
    throw new Error("CSV must include a Page/URL or Top queries column.");
  }

  const fallbackPage = storeDomain ? `https://${storeDomain}/` : "/";
  const rows = [];

  for (let i = 1; i < lines.length; i += 1) {
    const cells = parseCsvLine(lines[i]);
    if (!cells.length) continue;

    const clicks = clicksIdx >= 0 ? parseNumberCell(cells[clicksIdx]) : 0;
    const impressions = impIdx >= 0 ? parseNumberCell(cells[impIdx]) : 0;
    let ctr = ctrIdx >= 0 ? parseNumberCell(cells[ctrIdx]) : 0;
    if (ctr > 1) ctr = ctr / 100;
    if (!ctr && impressions > 0) ctr = clicks / impressions;
    const position = posIdx >= 0 ? parseNumberCell(cells[posIdx]) : 0;

    rows.push({
      page: pageIdx >= 0 && cells[pageIdx] ? cells[pageIdx] : fallbackPage,
      query: queryIdx >= 0 && cells[queryIdx] ? cells[queryIdx] : "(page traffic)",
      clicks: Math.max(0, Math.round(clicks)),
      impressions: Math.max(0, Math.round(impressions)),
      ctr: Math.max(0, Math.min(1, ctr)),
      position: Math.max(0, Number(position.toFixed(1))),
    });
  }

  if (!rows.length) {
    throw new Error("No valid Search Console rows were found in the CSV.");
  }

  return rows;
}

/**
 * Aggregates GSC Search Analytics rows by product URL and identifies Quick-Win keywords
 * currently ranking in positions 8.0 to 20.0.
 */
export function analyzeGscPerformance({ rows = [], storeDomain = "", products = [], appState = {} }) {
  const productByHandle = new Map();
  for (const product of Array.isArray(products) ? products : []) {
    const handle = String(product?.handle || "").trim().toLowerCase();
    if (handle) productByHandle.set(handle, product);
  }

  const urlMap = new Map();
  const quickWins = [];
  let totalClicks = 0;
  let totalImpressions = 0;
  let weightedPosSum = 0;

  for (const row of Array.isArray(rows) ? rows : []) {
    const path = extractPathname(row.page);
    const handle = extractProductHandleFromPath(path);
    const matchedProduct = handle ? productByHandle.get(handle) || null : null;
    const clicks = Math.max(0, Number(row.clicks || 0));
    const impressions = Math.max(0, Number(row.impressions || 0));
    const position = Math.max(0, Number(row.position || 0));
    const ctr = impressions > 0 ? Number(row.ctr || clicks / impressions) : 0;
    const query = String(row.query || "").trim();

    totalClicks += clicks;
    totalImpressions += impressions;
    weightedPosSum += position * Math.max(1, impressions);

    const existing = urlMap.get(path) || {
      path,
      url: String(row.page || (storeDomain ? `https://${storeDomain}${path}` : path)),
      productId: matchedProduct ? String(matchedProduct.id) : null,
      productTitle: matchedProduct ? String(matchedProduct.title || "") : "",
      handle: matchedProduct ? String(matchedProduct.handle || "") : handle,
      metaTitle: matchedProduct ? String(matchedProduct.metafields_global_title_tag || "") : "",
      metaDescription: matchedProduct ? String(matchedProduct.metafields_global_description_tag || "") : "",
      currentKeyword: matchedProduct
        ? String(appState?.productSeo?.[String(matchedProduct.id)]?.focusKeyword || "")
        : "",
      clicks: 0,
      impressions: 0,
      weightedPos: 0,
      topQuery: "",
      topQueryImpressions: -1,
    };

    existing.clicks += clicks;
    existing.impressions += impressions;
    existing.weightedPos += position * Math.max(1, impressions);
    if (query && query !== "(page traffic)" && impressions > existing.topQueryImpressions) {
      existing.topQuery = query;
      existing.topQueryImpressions = impressions;
    }
    urlMap.set(path, existing);

    if (query && query !== "(page traffic)" && position >= 8 && position <= 20 && impressions >= 5) {
      const opportunityScore = Math.round(impressions * (21 - position) * (1 - Math.min(0.4, ctr)));
      quickWins.push({
        query,
        page: String(row.page || path),
        path,
        productId: matchedProduct ? String(matchedProduct.id) : null,
        productTitle: matchedProduct ? String(matchedProduct.title || "") : "",
        handle: matchedProduct ? String(matchedProduct.handle || "") : handle,
        metaTitle: matchedProduct ? String(matchedProduct.metafields_global_title_tag || "") : "",
        metaDescription: matchedProduct ? String(matchedProduct.metafields_global_description_tag || "") : "",
        currentKeyword: matchedProduct
          ? String(appState?.productSeo?.[String(matchedProduct.id)]?.focusKeyword || "")
          : "",
        clicks,
        impressions,
        ctr: Number((ctr * 100).toFixed(2)),
        position: Number(position.toFixed(1)),
        opportunityScore,
      });
    }
  }

  const urlMetrics = Array.from(urlMap.values())
    .map((entry) => {
      const denom = Math.max(1, entry.impressions);
      const ctrPct = entry.impressions > 0 ? (entry.clicks / entry.impressions) * 100 : 0;
      return {
        path: entry.path,
        url: entry.url,
        productId: entry.productId,
        productTitle: entry.productTitle,
        handle: entry.handle,
        metaTitle: entry.metaTitle,
        metaDescription: entry.metaDescription,
        currentKeyword: entry.currentKeyword,
        clicks: entry.clicks,
        impressions: entry.impressions,
        ctr: Number(ctrPct.toFixed(2)),
        position: Number((entry.weightedPos / denom).toFixed(1)),
        topQuery: entry.topQuery,
      };
    })
    .sort((a, b) => b.impressions - a.impressions || b.clicks - a.clicks)
    .slice(0, 40);

  const sortedQuickWins = quickWins
    .sort((a, b) => b.opportunityScore - a.opportunityScore || b.impressions - a.impressions)
    .slice(0, 30);

  const matchedProductsCount = urlMetrics.filter((u) => Boolean(u.productId)).length;
  const totalImprDenom = Math.max(1, totalImpressions);

  return {
    summary: {
      totalClicks,
      totalImpressions,
      avgCtr: totalImpressions > 0 ? Number(((totalClicks / totalImpressions) * 100).toFixed(2)) : 0,
      avgPosition: rows.length > 0 ? Number((weightedPosSum / totalImprDenom).toFixed(1)) : 0,
      quickWinsCount: sortedQuickWins.length,
      matchedProductsCount,
    },
    urlMetrics,
    quickWins: sortedQuickWins,
  };
}

export function pickPreferredSite(sites = [], storeDomain = "") {
  if (!sites.length) return "";
  const cleanDomain = String(storeDomain || "").trim().toLowerCase();
  const domainMatch = sites.find((s) => {
    const u = s.siteUrl.toLowerCase();
    return u === `sc-domain:${cleanDomain}` || u.includes(`//${cleanDomain}`);
  });
  return (domainMatch || sites[0]).siteUrl;
}

export async function syncGscMetricsForShop({
  shop,
  storeDomain,
  token,
  apiVersion,
  siteUrlOverride = "",
}) {
  const appState = await getAppState(shop);
  const gsc = appState.gsc || {};
  if (!gsc.accessToken && !gsc.refreshToken) {
    throw new Error("Google Search Console is not connected yet.");
  }

  let accessToken = gsc.accessToken;
  let expiresAt = Number(gsc.expiresAt || 0);
  if ((!accessToken || Date.now() >= expiresAt - 60_000) && gsc.refreshToken) {
    const refreshed = await refreshGscAccessToken({ refreshToken: gsc.refreshToken });
    accessToken = refreshed.accessToken;
    expiresAt = refreshed.expiresAt;
  }

  let availableSites = gsc.availableSites || [];
  try {
    availableSites = await listGscSites({ accessToken });
  } catch (err) {
    if (!availableSites.length) throw err;
  }

  const chosenSite = siteUrlOverride || gsc.siteUrl || pickPreferredSite(availableSites, storeDomain);
  if (!chosenSite) {
    throw new Error(
      "No verified Google Search Console property was found on this Google account.",
    );
  }

  const [rows, catalog] = await Promise.all([
    fetchGscSearchAnalytics({ accessToken, siteUrl: chosenSite, days: 28 }),
    token
      ? fetchAllProducts({ storeDomain, token, apiVersion, maxProducts: 10000 }).catch(() => ({
          products: [],
        }))
      : Promise.resolve({ products: [] }),
  ]);

  const analysis = analyzeGscPerformance({
    rows,
    storeDomain,
    products: catalog.products || [],
    appState,
  });

  const nextState = await updateAppState(shop, (current) => ({
    ...current,
    gsc: {
      ...current.gsc,
      connected: true,
      mode: "oauth",
      siteUrl: chosenSite,
      accessToken,
      refreshToken: gsc.refreshToken || current.gsc?.refreshToken || "",
      expiresAt,
      availableSites,
      lastSyncedAt: new Date().toISOString(),
      ...analysis,
    },
  }));

  return sanitizeGscForClient(nextState.gsc);
}

export async function importGscCsvForShop({ shop, storeDomain, token, apiVersion, csvText }) {
  const appState = await getAppState(shop);
  const rows = parseGscCsvText(csvText, storeDomain);

  const catalog = token
    ? await fetchAllProducts({ storeDomain, token, apiVersion, maxProducts: 10000 }).catch(() => ({
        products: [],
      }))
    : { products: [] };

  const analysis = analyzeGscPerformance({
    rows,
    storeDomain,
    products: catalog.products || [],
    appState,
  });

  const nextState = await updateAppState(shop, (current) => ({
    ...current,
    gsc: {
      ...current.gsc,
      connected: true,
      mode: "csv",
      siteUrl: current.gsc?.siteUrl || `https://${storeDomain}/`,
      lastSyncedAt: new Date().toISOString(),
      ...analysis,
    },
  }));

  return sanitizeGscForClient(nextState.gsc);
}

export async function disconnectGscForShop(shop) {
  await updateAppState(shop, (current) => ({
    ...current,
    gsc: {
      connected: false,
      mode: "",
      siteUrl: "",
      accessToken: "",
      refreshToken: "",
      expiresAt: 0,
      availableSites: [],
      lastSyncedAt: null,
      summary: null,
      urlMetrics: [],
      quickWins: [],
    },
  }));
}
