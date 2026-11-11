import prisma from "../db.server.js";

/**
 * Removes only OAuth/online sessions when the app is uninstalled, preserving
 * store control restrictions and credit accounting in case the merchant reinstalls.
 */
export async function clearShopSessions(shop) {
  const rawShop = String(shop || "").trim();
  const cleanShop = rawShop.toLowerCase();
  if (!cleanShop) return;
  const shopTargets = rawShop && rawShop !== cleanShop ? [cleanShop, rawShop] : [cleanShop];
  await prisma.session.deleteMany({ where: { shop: { in: shopTargets } } });
}

/**
 * Removes all persisted store state, sessions, credits, revisions, and audit snapshots for a shop.
 */
export async function purgeShopData(shop) {
  const rawShop = String(shop || "").trim();
  const cleanShop = rawShop.toLowerCase();
  if (!cleanShop) return;
  const shopTargets = rawShop && rawShop !== cleanShop ? [cleanShop, rawShop] : [cleanShop];

  await prisma.$transaction([
    prisma.session.deleteMany({ where: { shop: { in: shopTargets } } }),
    prisma.appState.deleteMany({ where: { shop: { in: shopTargets } } }),
    prisma.aiCreditAccount.deleteMany({ where: { shop: { in: shopTargets } } }),
    prisma.productRevision.deleteMany({ where: { shop: { in: shopTargets } } }),
    prisma.seoAuditSnapshot.deleteMany({ where: { shop: { in: shopTargets } } }),
    prisma.storeControl.deleteMany({ where: { shop: { in: shopTargets } } }),
  ]);
}

