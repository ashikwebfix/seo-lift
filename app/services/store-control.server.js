import prisma from "../db.server.js";
import { getOrCreateCreditAccount, syncPlanSubscription } from "./credit-manager.server.js";
import { DEFAULT_GEMINI_MODEL } from "../utils/gemini-models.js";
import { PLAN_ALLOWANCES } from "../utils/credits.js";

export const PLATFORM_FEATURES = Object.freeze([
  { key: "seo_audit", label: "SEO Audit & Copilot", path: "/app/seo-audit" },
  { key: "products", label: "Product SEO & Diff Doctor", path: "/app/products" },
  { key: "bulk_meta", label: "Bulk Meta Editor", path: "/app/bulk-meta" },
  { key: "image_optimizer", label: "Image Optimizer & Vision ALT", path: "/app/image-optimizer" },
  { key: "url_optimization", label: "URL Optimization & Redirects", path: "/app/url-optimization" },
  { key: "revisions", label: "Time Machine & Rollback", path: "/app/revisions" },
  { key: "robots", label: "Robots.txt Manager", path: "/app/robots" },
  { key: "sitemap", label: "Sitemap Manager", path: "/app/sitemap" },
  { key: "pagespeed", label: "PageSpeed & Core Web Vitals", path: "/app/pagespeed" },
  { key: "ai_features", label: "Global Gemini AI Actions", path: "/app/api/ai" },
]);

export const ALL_FEATURE_KEYS = PLATFORM_FEATURES.map((f) => f.key);

function parseFeaturesJson(raw) {
  if (!raw) return [...ALL_FEATURE_KEYS];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [...ALL_FEATURE_KEYS];
    return parsed.filter((key) => ALL_FEATURE_KEYS.includes(key));
  } catch {
    return [...ALL_FEATURE_KEYS];
  }
}

function maskToken(token) {
  const clean = String(token || "").trim();
  if (!clean) return "";
  if (clean.length <= 10) return "*".repeat(clean.length);
  return `${clean.slice(0, 6)}...${clean.slice(-4)}`;
}

function normalizeControl(record) {
  if (!record) return null;
  const level = ["FULL", "PARTIAL", "SUSPENDED"].includes(record.accessLevel)
    ? record.accessLevel
    : "FULL";
  return {
    shop: record.shop,
    accessLevel: level,
    superAccess: Boolean(record.superAccess),
    allowedFeatures: parseFeaturesJson(record.allowedFeaturesJson),
    notes: record.notes || "",
    updatedBy: record.updatedBy || "",
    updatedAt: record.updatedAt,
    createdAt: record.createdAt,
  };
}

export async function getOrCreateStoreControl(shop) {
  const cleanShop = String(shop || "").trim().toLowerCase();
  if (!cleanShop) return null;

  let record = await prisma.storeControl.findUnique({ where: { shop: cleanShop } });
  if (!record) {
    record = await prisma.storeControl.create({
      data: {
        shop: cleanShop,
        accessLevel: "FULL",
        superAccess: false,
        allowedFeaturesJson: JSON.stringify(ALL_FEATURE_KEYS),
      },
    });
  }
  return normalizeControl(record);
}

export function isFeatureAllowed(control, featureKey) {
  if (!control) return true;
  if (control.accessLevel === "SUSPENDED") return false;
  if (control.accessLevel === "FULL") return true;
  return Array.isArray(control.allowedFeatures) && control.allowedFeatures.includes(featureKey);
}

export async function checkStoreRouteAccess(shop, featureKey) {
  if (!shop) return { allowed: true, control: null };
  const control = await getOrCreateStoreControl(shop);
  const allowed = isFeatureAllowed(control, featureKey);
  return {
    allowed,
    control,
    reason:
      control?.accessLevel === "SUSPENDED"
        ? "This store's access to Ecom SEO has been suspended by the administrator."
        : `Access to this module (${featureKey}) is not enabled for your store's current partial access plan.`,
  };
}

export async function updateStoreControl({
  shop,
  accessLevel = "FULL",
  superAccess = false,
  allowedFeatures = ALL_FEATURE_KEYS,
  notes = "",
  updatedBy = "",
}) {
  const cleanShop = String(shop || "").trim().toLowerCase();
  if (!cleanShop) throw new Error("Shop domain is required.");

  const validLevel = ["FULL", "PARTIAL", "SUSPENDED"].includes(String(accessLevel).toUpperCase())
    ? String(accessLevel).toUpperCase()
    : "FULL";

  const sanitizedFeatures = Array.isArray(allowedFeatures)
    ? allowedFeatures.filter((k) => ALL_FEATURE_KEYS.includes(k))
    : ALL_FEATURE_KEYS;

  const updated = await prisma.storeControl.upsert({
    where: { shop: cleanShop },
    update: {
      accessLevel: validLevel,
      superAccess: Boolean(superAccess),
      allowedFeaturesJson: JSON.stringify(sanitizedFeatures),
      notes: notes ? String(notes).slice(0, 500) : null,
      updatedBy: updatedBy || null,
    },
    create: {
      shop: cleanShop,
      accessLevel: validLevel,
      superAccess: Boolean(superAccess),
      allowedFeaturesJson: JSON.stringify(sanitizedFeatures),
      notes: notes ? String(notes).slice(0, 500) : null,
      updatedBy: updatedBy || null,
    },
  });

  if (superAccess) {
    await syncPlanSubscription(cleanShop, true).catch(() => {});
  }

  return normalizeControl(updated);
}

export async function updateStoreTokens({
  shop,
  creditPlan,
  totalCredits,
  bonusCredits,
  resetUsedCredits = false,
  shopifyAccessToken = "",
  shopifyScopes = "",
}) {
  const cleanShop = String(shop || "").trim().toLowerCase();
  if (!cleanShop) throw new Error("Shop domain is required.");

  // 1. Update AI Credit Tokens / Plan
  await getOrCreateCreditAccount(cleanShop);
  const creditUpdateData = {};

  if (creditPlan === "FREE" || creditPlan === "PRO") {
    creditUpdateData.plan = creditPlan;
  }
  if (totalCredits !== undefined && totalCredits !== "" && !Number.isNaN(Number(totalCredits))) {
    creditUpdateData.totalCredits = Math.max(0, Math.floor(Number(totalCredits)));
  }
  if (bonusCredits !== undefined && bonusCredits !== "" && !Number.isNaN(Number(bonusCredits))) {
    creditUpdateData.bonusCredits = Math.max(0, Math.floor(Number(bonusCredits)));
  }
  if (resetUsedCredits) {
    creditUpdateData.usedCredits = 0;
  }

  if (Object.keys(creditUpdateData).length > 0) {
    await prisma.aiCreditAccount.update({
      where: { shop: cleanShop },
      data: creditUpdateData,
    });
  }

  // 2. Update Shopify Offline Access Token (Session table) if provided
  const cleanToken = String(shopifyAccessToken || "").trim();
  const cleanScopes = String(shopifyScopes || "").trim();

  if (cleanToken) {
    const existingOffline = await prisma.session.findFirst({
      where: { shop: cleanShop, isOnline: false },
    });
    const targetId = existingOffline?.id || `offline_${cleanShop}`;

    await prisma.session.upsert({
      where: { id: targetId },
      update: {
        shop: cleanShop,
        accessToken: cleanToken,
        isOnline: false,
        ...(cleanScopes ? { scope: cleanScopes } : {}),
      },
      create: {
        id: targetId,
        shop: cleanShop,
        state: "admin-provisioned",
        isOnline: false,
        accessToken: cleanToken,
        scope: cleanScopes || process.env.SCOPES || "write_products",
      },
    });
  } else if (cleanScopes) {
    const updated = await prisma.session.updateMany({
      where: { shop: cleanShop, isOnline: false },
      data: { scope: cleanScopes },
    });
    if (updated.count === 0) {
      throw new Error(
        `No offline Shopify session exists yet for "${cleanShop}". Paste an Admin Access Token (shpat_...) when saving scopes for an unconnected store.`,
      );
    }
  }

  return getOrCreateCreditAccount(cleanShop);
}

export async function listAllManagedStores() {
  const [sessions, appStates, creditAccounts, storeControls, revisionCounts, aiLogCounts, latestSnapshots] =
    await Promise.all([
      prisma.session.findMany({
        orderBy: { isOnline: "asc" },
        select: { shop: true, isOnline: true, scope: true, accessToken: true },
      }),
      // Fetch only shop keys instead of parsing multi-MB stateJson blobs across every store.
      prisma.appState.findMany({ select: { shop: true } }),
      prisma.aiCreditAccount.findMany(),
      prisma.storeControl.findMany(),
      prisma.productRevision.groupBy({ by: ["shop"], _count: { id: true } }),
      prisma.aiCreditUsageLog.groupBy({
        by: ["shop"],
        where: { actionType: { not: "credit_pack_purchase" } },
        _count: { id: true },
      }),
      prisma.seoAuditSnapshot.findMany({
        orderBy: { createdAt: "desc" },
        distinct: ["shop"],
        select: { shop: true, overallScore: true, summaryJson: true, createdAt: true },
      }),
    ]);

  const shopSet = new Set();
  for (const s of sessions) if (s.shop) shopSet.add(s.shop.toLowerCase());
  for (const a of appStates) if (a.shop) shopSet.add(a.shop.toLowerCase());
  for (const c of creditAccounts) if (c.shop) shopSet.add(c.shop.toLowerCase());
  for (const sc of storeControls) if (sc.shop) shopSet.add(sc.shop.toLowerCase());

  const sessionMap = new Map();
  for (const s of sessions) {
    const key = s.shop.toLowerCase();
    // Prefer offline session for admin token visibility
    if (!sessionMap.has(key) || !s.isOnline) {
      sessionMap.set(key, s);
    }
  }

  const snapshotMap = new Map();
  for (const snap of latestSnapshots) {
    const key = snap.shop.toLowerCase();
    if (!snapshotMap.has(key)) snapshotMap.set(key, snap);
  }
  const creditMap = new Map(creditAccounts.map((c) => [c.shop.toLowerCase(), c]));
  const controlMap = new Map(storeControls.map((sc) => [sc.shop.toLowerCase(), normalizeControl(sc)]));

  const revCountMap = new Map();
  for (const r of revisionCounts) {
    const key = r.shop.toLowerCase();
    revCountMap.set(key, (revCountMap.get(key) || 0) + r._count.id);
  }

  const aiCountMap = new Map();
  for (const l of aiLogCounts) {
    const key = l.shop.toLowerCase();
    aiCountMap.set(key, (aiCountMap.get(key) || 0) + l._count.id);
  }

  const rows = [];
  for (const shop of Array.from(shopSet).sort()) {
    const sess = sessionMap.get(shop) || null;
    const snap = snapshotMap.get(shop) || null;
    const credit = creditMap.get(shop) || null;
    const control = controlMap.get(shop) || {
      shop,
      accessLevel: "FULL",
      superAccess: false,
      allowedFeatures: [...ALL_FEATURE_KEYS],
      notes: "",
      updatedBy: "",
      updatedAt: null,
    };

    let lastScan = null;
    if (snap) {
      let parsedSummary = {};
      try {
        parsedSummary = snap.summaryJson ? JSON.parse(snap.summaryJson) : {};
      } catch {
        parsedSummary = {};
      }
      lastScan = {
        score: snap.overallScore ?? null,
        health: parsedSummary.health || "unknown",
        pagesScanned: parsedSummary.pagesScanned || 0,
        lastScanDate: snap.createdAt ? snap.createdAt.toISOString() : null,
      };
    }

    const totalCredits = credit?.totalCredits ?? PLAN_ALLOWANCES.FREE;
    const bonusCredits = credit?.bonusCredits ?? 0;
    const usedCredits = credit?.usedCredits ?? 0;
    const effectiveTotal = totalCredits + bonusCredits;

    rows.push({
      shop,
      sessionStatus: {
        connected: Boolean(sess?.accessToken),
        isOnlineOnly: Boolean(sess && sess.isOnline),
        scopes: sess?.scope || "",
        maskedToken: maskToken(sess?.accessToken || ""),
      },
      control,
      credits: {
        plan: credit?.plan || "FREE",
        totalCredits,
        bonusCredits,
        usedCredits,
        effectiveTotal,
        availableCredits: Math.max(0, effectiveTotal - usedCredits),
        cycleResetAt: credit?.cycleResetAt || null,
      },
      lastScan,
      stats: {
        totalRevisions: revCountMap.get(shop) || 0,
        totalAiCalls: aiCountMap.get(shop) || 0,
      },
    });
  }

  return rows;
}

// ─── Global Platform AI Configuration (Shared Across All Stores) ─────────────

export async function getPlatformAiConfig() {
  let config = await prisma.platformAiConfig.findUnique({ where: { id: "default" } });
  if (!config) {
    config = await prisma.platformAiConfig.create({
      data: {
        id: "default",
        provider: "gemini",
        model: DEFAULT_GEMINI_MODEL,
        apiKey: "",
        temperature: 0.4,
        isEnabled: true,
      },
    });
  }
  return config;
}

export async function getEffectivePlatformAiSettings() {
  const dbConfig = await getPlatformAiConfig();
  const envKey = typeof process !== "undefined" && process.env?.GEMINI_API_KEY
    ? String(process.env.GEMINI_API_KEY).trim()
    : "";
  const dbKey = String(dbConfig.apiKey || "").trim();

  return {
    provider: dbConfig.provider || "gemini",
    model: dbConfig.model || DEFAULT_GEMINI_MODEL,
    apiKey: dbKey || envKey,
    temperature: typeof dbConfig.temperature === "number" ? dbConfig.temperature : 0.4,
    isEnabled: Boolean(dbConfig.isEnabled),
    hasDbKey: Boolean(dbKey),
    dbKeyMask: maskToken(dbKey),
    usingEnvFallback: !dbKey && Boolean(envKey),
    updatedBy: dbConfig.updatedBy || "",
    updatedAt: dbConfig.updatedAt,
  };
}

export async function updatePlatformAiConfig({
  provider = "gemini",
  model = DEFAULT_GEMINI_MODEL,
  apiKey = "",
  clearApiKey = false,
  temperature = 0.4,
  isEnabled = true,
  updatedBy = "",
}) {
  const current = await getPlatformAiConfig();
  const cleanKey = String(apiKey || "").trim();
  const nextKey = clearApiKey ? "" : cleanKey || current.apiKey;
  const cleanModel = String(model || DEFAULT_GEMINI_MODEL).trim() || DEFAULT_GEMINI_MODEL;
  const parsedTemp = Math.max(0, Math.min(1, Number(temperature ?? 0.4) || 0.4));

  return prisma.platformAiConfig.upsert({
    where: { id: "default" },
    update: {
      provider: provider === "gemini" ? "gemini" : "gemini",
      model: cleanModel,
      apiKey: nextKey,
      temperature: parsedTemp,
      isEnabled: Boolean(isEnabled),
      updatedBy: updatedBy || null,
    },
    create: {
      id: "default",
      provider: "gemini",
      model: cleanModel,
      apiKey: nextKey,
      temperature: parsedTemp,
      isEnabled: Boolean(isEnabled),
      updatedBy: updatedBy || null,
    },
  });
}

// ─── Global Google Search Console OAuth Config (Shared App Credentials) ───────

export async function getEffectiveGscOAuthConfig() {
  const dbRecord = await prisma.platformAiConfig
    .findUnique({ where: { id: "gsc_oauth" } })
    .catch(() => null);

  const envClientId =
    (typeof process !== "undefined" &&
      (process.env?.GOOGLE_GSC_CLIENT_ID || process.env?.GOOGLE_CLIENT_ID || "").trim()) ||
    "";
  const envClientSecret =
    (typeof process !== "undefined" &&
      (process.env?.GOOGLE_GSC_CLIENT_SECRET || process.env?.GOOGLE_CLIENT_SECRET || "").trim()) ||
    "";

  const dbClientId = String(dbRecord?.model || "").trim();
  const dbClientSecret = String(dbRecord?.apiKey || "").trim();

  return {
    clientId: dbClientId || envClientId,
    clientSecret: dbClientSecret || envClientSecret,
    hasDbConfig: Boolean(dbClientId && dbClientSecret),
    usingEnvFallback: (!dbClientId || !dbClientSecret) && Boolean(envClientId && envClientSecret),
    maskedSecret: maskToken(dbClientSecret),
    isEnabled: dbRecord ? Boolean(dbRecord.isEnabled) : true,
    updatedBy: dbRecord?.updatedBy || "",
    updatedAt: dbRecord?.updatedAt || null,
  };
}

export async function updatePlatformGscOAuthConfig({
  clientId = "",
  clientSecret = "",
  clearConfig = false,
  updatedBy = "",
}) {
  const current = await prisma.platformAiConfig
    .findUnique({ where: { id: "gsc_oauth" } })
    .catch(() => null);

  const nextClientId = clearConfig ? "" : String(clientId || "").trim() || current?.model || "";
  const nextSecret = clearConfig ? "" : String(clientSecret || "").trim() || current?.apiKey || "";

  return prisma.platformAiConfig.upsert({
    where: { id: "gsc_oauth" },
    update: {
      provider: "google_gsc",
      model: nextClientId,
      apiKey: nextSecret,
      isEnabled: true,
      updatedBy: updatedBy || null,
    },
    create: {
      id: "gsc_oauth",
      provider: "google_gsc",
      model: nextClientId,
      apiKey: nextSecret,
      temperature: 0,
      isEnabled: true,
      updatedBy: updatedBy || null,
    },
  });
}

// ─── Global Google PageSpeed Insights API Key (Optional) ───────────────────────

export async function getEffectivePageSpeedConfig() {
  const dbRecord = await prisma.platformAiConfig
    .findUnique({ where: { id: "pagespeed_api" } })
    .catch(() => null);

  const envKey =
    (typeof process !== "undefined" && (process.env?.GOOGLE_PAGESPEED_API_KEY || "").trim()) || "";
  const dbKey = String(dbRecord?.apiKey || "").trim();

  return {
    apiKey: dbKey || envKey,
    hasDbKey: Boolean(dbKey),
    usingEnvFallback: !dbKey && Boolean(envKey),
    maskedKey: maskToken(dbKey),
    updatedBy: dbRecord?.updatedBy || "",
    updatedAt: dbRecord?.updatedAt || null,
  };
}

export async function updatePlatformPageSpeedConfig({
  apiKey = "",
  clearConfig = false,
  updatedBy = "",
}) {
  const current = await prisma.platformAiConfig
    .findUnique({ where: { id: "pagespeed_api" } })
    .catch(() => null);

  const nextKey = clearConfig ? "" : String(apiKey || "").trim() || current?.apiKey || "";

  return prisma.platformAiConfig.upsert({
    where: { id: "pagespeed_api" },
    update: {
      provider: "google_pagespeed",
      model: "psi-v5",
      apiKey: nextKey,
      isEnabled: true,
      updatedBy: updatedBy || null,
    },
    create: {
      id: "pagespeed_api",
      provider: "google_pagespeed",
      model: "psi-v5",
      apiKey: nextKey,
      temperature: 0,
      isEnabled: true,
      updatedBy: updatedBy || null,
    },
  });
}

