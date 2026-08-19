import prisma from "../db.server";
import { DEFAULT_AI_SETTINGS, normalizeAiSettings } from "./ai-provider.server.js";

const DEFAULT_ROBOTS = `User-agent: *\nDisallow: /cart\nDisallow: /search\nAllow: /`;

const DEFAULT_STATE = {
  productSeo: {},
  imageOptimizerHistory: [],
  lastScan: null,
  scoreHistory: [],
  robotsTxt: DEFAULT_ROBOTS,
  sitemapManualUrls: [],
  sitemapGeneratedAt: null,
  sitemapUrls: [],
  aiSettings: { ...DEFAULT_AI_SETTINGS },
};

function parseState(jsonText) {
  if (!jsonText) return { ...DEFAULT_STATE };
  try {
    const parsed = JSON.parse(jsonText);
    return {
      ...DEFAULT_STATE,
      ...parsed,
      productSeo: parsed.productSeo || {},
      imageOptimizerHistory: Array.isArray(parsed.imageOptimizerHistory)
        ? parsed.imageOptimizerHistory
        : [],
      scoreHistory: Array.isArray(parsed.scoreHistory) ? parsed.scoreHistory : [],
      sitemapManualUrls: Array.isArray(parsed.sitemapManualUrls)
        ? parsed.sitemapManualUrls
        : [],
      sitemapUrls: Array.isArray(parsed.sitemapUrls) ? parsed.sitemapUrls : [],
      aiSettings: normalizeAiSettings(parsed.aiSettings || {}),
    };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

export async function getAppState(shop) {
  const record = await prisma.appState.findUnique({ where: { shop } });
  if (!record) return { ...DEFAULT_STATE };
  return parseState(record.stateJson);
}

export async function setAppState(shop, nextState) {
  return prisma.appState.upsert({
    where: { shop },
    update: { stateJson: JSON.stringify(nextState) },
    create: { shop, stateJson: JSON.stringify(nextState) },
  });
}

export async function updateAppState(shop, mutator) {
  const current = await getAppState(shop);
  const next = mutator(current);
  await setAppState(shop, next);
  return next;
}
