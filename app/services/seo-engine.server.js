import { getAppState, updateAppState } from "./app-state.server";
import { buildSeoAudit, buildTrendSummary } from "./seo-audit.server";
import { fetchProducts } from "./shopify-admin.server";

export async function runFullScan({ storeDomain, token, apiVersion, shop }) {
  const appState = await getAppState(shop);

  const { products } = await fetchProducts({
    storeDomain,
    token,
    apiVersion,
    limit: 250,
  });

  const audit = buildSeoAudit({
    storeDomain,
    products,
    appState,
  });

  const next = await updateAppState(shop, (current) => {
    const trend = buildTrendSummary(current.scoreHistory, audit.summary.score);
    const scoreHistory = [...current.scoreHistory, { date: audit.generatedAt, score: audit.summary.score }].slice(-20);

    return {
      ...current,
      lastScan: {
        ...audit,
        trend,
      },
      scoreHistory,
    };
  });

  return next.lastScan;
}
