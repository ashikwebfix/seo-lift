import prisma from "../db.server.js";
import { getAppState, updateAppState } from "./app-state.server.js";
import { buildSeoAudit, buildTrendSummary, patchCachedSeoAudit } from "./seo-audit.server.js";
import { fetchAllProducts } from "./shopify-admin.server.js";

async function persistAuditResult({ shop, audit }) {
  const next = await updateAppState(shop, (current) => {
    const trend = buildTrendSummary(current.scoreHistory, audit.summary.score);
    const scoreHistory = [
      ...current.scoreHistory,
      { date: audit.generatedAt, score: audit.summary.score },
    ].slice(-20);

    return {
      ...current,
      lastScan: {
        ...audit,
        trend,
      },
      scoreHistory,
    };
  });

  // Persist 5-pillar snapshot for multi-dimensional historical analytics
  if (shop) {
    try {
      const pillars = audit.summary?.pillars || {};
      const counts = audit.summary?.counts || {};
      await prisma.seoAuditSnapshot.create({
        data: {
          shop: String(shop).trim().toLowerCase(),
          overallScore: Number(audit.summary?.score ?? 0),
          serpScore: Number(pillars.serpScore ?? 0),
          contentScore: Number(pillars.contentScore ?? 0),
          technicalScore: Number(pillars.technicalScore ?? 0),
          visualScore: Number(pillars.visualScore ?? 0),
          cannibalScore: Number(pillars.cannibalScore ?? 100),
          criticalCount: Number(counts.critical ?? 0),
          warningCount: Number(counts.warning ?? 0),
          infoCount: Number(counts.info ?? 0),
          summaryJson: JSON.stringify({
            pagesScanned: audit.pagesScanned,
            indexCoverage: audit.indexCoverage,
            health: audit.summary?.health,
            pillars,
          }),
        },
      });
    } catch (snapshotErr) {
      console.warn("Could not persist SeoAuditSnapshot:", snapshotErr?.message);
    }
  }

  return next.lastScan;
}

export async function runFullScan({ storeDomain, token, apiVersion, shop }) {
  const appState = await getAppState(shop);

  const { products, truncated } = await fetchAllProducts({
    storeDomain,
    token,
    apiVersion,
    maxProducts: 10000,
  });

  const audit = buildSeoAudit({
    storeDomain,
    products,
    appState,
  });

  if (truncated) {
    audit.truncated = true;
  }

  return persistAuditResult({ shop, audit });
}

/**
 * Updates cached audit state incrementally for a subset of edited products (or robots.txt),
 * falling back to a full catalog scan only if no cached scan exists yet.
 */
export async function applyIncrementalAuditPatch({
  shop,
  storeDomain,
  token,
  apiVersion,
  updatedProducts = [],
}) {
  const appState = await getAppState(shop);
  const patched = patchCachedSeoAudit({
    existingScan: appState.lastScan,
    storeDomain,
    updatedProducts,
    appState,
  });

  if (!patched) {
    if (!storeDomain || !token) return null;
    return runFullScan({ storeDomain, token, apiVersion, shop });
  }

  return persistAuditResult({ shop, audit: patched });
}
