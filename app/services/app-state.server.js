import prisma from "../db.server.js";
import { DEFAULT_AI_SETTINGS, normalizeAiSettings } from "./ai-provider.server.js";

const DEFAULT_ROBOTS = `User-agent: *\nDisallow: /cart\nDisallow: /search\nAllow: /`;

const DEFAULT_AUTOPILOT = {
  enabled: false,
  optimizeMeta: true,
  optimizeAlt: true,
  maxImagesPerProduct: 3,
  lastRuns: [],
};

const DEFAULT_GSC = {
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
};

const DEFAULT_PAGESPEED = {
  lastTestedUrl: "",
  lastTestedAt: null,
  mobile: null,
  desktop: null,
  history: [],
  lastAiPlan: null,
  completedManualIds: [],
};

const DEFAULT_IMAGE_COMPRESSION_STATS = {
  totalImagesOptimized: 0,
  totalBytesBefore: 0,
  totalBytesAfter: 0,
  totalBytesSaved: 0,
  lastRunAt: null,
};

const DEFAULT_STATE = {
  productSeo: {},
  imageOptimizerHistory: [],
  imageCompressionHistory: [],
  imageCompressionStats: { ...DEFAULT_IMAGE_COMPRESSION_STATS },
  lastScan: null,
  scoreHistory: [],
  robotsTxt: DEFAULT_ROBOTS,
  sitemapManualUrls: [],
  sitemapGeneratedAt: null,
  sitemapUrls: [],
  aiSettings: { ...DEFAULT_AI_SETTINGS },
  autopilot: { ...DEFAULT_AUTOPILOT },
  aiChatHistory: [],
  gsc: { ...DEFAULT_GSC },
  pageSpeed: { ...DEFAULT_PAGESPEED },
};

function parseState(jsonText) {
  if (!jsonText) return { ...DEFAULT_STATE };
  try {
    const parsed = JSON.parse(jsonText);
    const parsedAutopilot = parsed.autopilot && typeof parsed.autopilot === "object" ? parsed.autopilot : {};
    const parsedGsc = parsed.gsc && typeof parsed.gsc === "object" ? parsed.gsc : {};
    const parsedPageSpeed = parsed.pageSpeed && typeof parsed.pageSpeed === "object" ? parsed.pageSpeed : {};
    const parsedCompStats =
      parsed.imageCompressionStats && typeof parsed.imageCompressionStats === "object"
        ? parsed.imageCompressionStats
        : {};
    return {
      ...DEFAULT_STATE,
      aiChatHistory: Array.isArray(parsed.aiChatHistory) ? parsed.aiChatHistory.slice(-30) : [],
      ...parsed,
      productSeo: parsed.productSeo || {},
      imageOptimizerHistory: Array.isArray(parsed.imageOptimizerHistory)
        ? parsed.imageOptimizerHistory
        : [],
      imageCompressionHistory: Array.isArray(parsed.imageCompressionHistory)
        ? parsed.imageCompressionHistory
        : [],
      imageCompressionStats: {
        ...DEFAULT_IMAGE_COMPRESSION_STATS,
        ...parsedCompStats,
        totalImagesOptimized: Number(parsedCompStats.totalImagesOptimized || 0),
        totalBytesBefore: Number(parsedCompStats.totalBytesBefore || 0),
        totalBytesAfter: Number(parsedCompStats.totalBytesAfter || 0),
        totalBytesSaved: Number(parsedCompStats.totalBytesSaved || 0),
        lastRunAt: parsedCompStats.lastRunAt || null,
      },
      scoreHistory: Array.isArray(parsed.scoreHistory) ? parsed.scoreHistory : [],
      sitemapManualUrls: Array.isArray(parsed.sitemapManualUrls)
        ? parsed.sitemapManualUrls
        : [],
      sitemapUrls: Array.isArray(parsed.sitemapUrls) ? parsed.sitemapUrls : [],
      aiSettings: normalizeAiSettings(parsed.aiSettings || {}),
      autopilot: {
        ...DEFAULT_AUTOPILOT,
        ...parsedAutopilot,
        enabled: Boolean(parsedAutopilot.enabled),
        optimizeMeta: parsedAutopilot.optimizeMeta !== false,
        optimizeAlt: parsedAutopilot.optimizeAlt !== false,
        maxImagesPerProduct: Math.max(1, Math.min(10, Number(parsedAutopilot.maxImagesPerProduct || 3) || 3)),
        lastRuns: Array.isArray(parsedAutopilot.lastRuns) ? parsedAutopilot.lastRuns : [],
      },
      gsc: {
        ...DEFAULT_GSC,
        ...parsedGsc,
        connected: Boolean(parsedGsc.connected),
        availableSites: Array.isArray(parsedGsc.availableSites) ? parsedGsc.availableSites : [],
        urlMetrics: Array.isArray(parsedGsc.urlMetrics) ? parsedGsc.urlMetrics : [],
        quickWins: Array.isArray(parsedGsc.quickWins) ? parsedGsc.quickWins : [],
      },
      pageSpeed: {
        ...DEFAULT_PAGESPEED,
        ...parsedPageSpeed,
        mobile: parsedPageSpeed.mobile || null,
        desktop: parsedPageSpeed.desktop || null,
        history: Array.isArray(parsedPageSpeed.history) ? parsedPageSpeed.history : [],
        lastAiPlan: parsedPageSpeed.lastAiPlan || null,
        completedManualIds: Array.isArray(parsedPageSpeed.completedManualIds)
          ? parsedPageSpeed.completedManualIds
          : [],
      },
    };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

const appStateQueues = new Map();

function normalizeShopKey(shop) {
  return String(shop || "").trim().toLowerCase();
}

/**
 * Serializes AppState mutations per store so concurrent webhook/user updates
 * cannot overwrite each other's JSON blob.
 */
function enqueueAppStateMutation(shop, task) {
  const key = normalizeShopKey(shop) || "__default__";
  const prev = appStateQueues.get(key) || Promise.resolve();
  const next = prev.then(task, task);
  const cleanup = next.then(
    () => undefined,
    () => undefined,
  );
  appStateQueues.set(key, cleanup);
  return next.finally(() => {
    if (appStateQueues.get(key) === cleanup) {
      appStateQueues.delete(key);
    }
  });
}

export async function getAppState(shop) {
  const cleanShop = normalizeShopKey(shop);
  if (!cleanShop) return { ...DEFAULT_STATE };
  const record = await prisma.appState.findUnique({ where: { shop: cleanShop } });
  if (!record) return { ...DEFAULT_STATE };
  return parseState(record.stateJson);
}

export async function setAppState(shop, nextState) {
  const cleanShop = normalizeShopKey(shop);
  if (!cleanShop) return null;
  const serialized = JSON.stringify(nextState);
  return prisma.appState.upsert({
    where: { shop: cleanShop },
    update: { stateJson: serialized },
    create: { shop: cleanShop, stateJson: serialized },
  });
}

export async function updateAppState(shop, mutator) {
  const cleanShop = normalizeShopKey(shop);
  if (!cleanShop) return { ...DEFAULT_STATE };

  return enqueueAppStateMutation(cleanShop, async () => {
    return prisma.$transaction(async (tx) => {
      const record = await tx.appState.findUnique({ where: { shop: cleanShop } });
      const current = record ? parseState(record.stateJson) : { ...DEFAULT_STATE };
      const next = mutator(current);
      const serialized = JSON.stringify(next);
      await tx.appState.upsert({
        where: { shop: cleanShop },
        update: { stateJson: serialized },
        create: { shop: cleanShop, stateJson: serialized },
      });
      return next;
    });
  });
}
