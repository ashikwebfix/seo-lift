import prisma from "../db.server.js";
import { DEFAULT_GEMINI_MODEL } from "../utils/gemini-models.js";
import {
  CREDIT_COSTS,
  PLAN_ALLOWANCES,
  TOKEN_PACKAGES,
  resolveActionCreditCost,
} from "../utils/credits.js";

export {
  CREDIT_COSTS,
  PLAN_ALLOWANCES,
  TOKEN_PACKAGES,
  resolveActionCreditCost,
};

function normalizeShop(shop) {
  return String(shop || "").trim().toLowerCase();
}

function getNextCycleDate() {
  const next = new Date();
  next.setDate(next.getDate() + 30);
  return next;
}

export async function getOrCreateCreditAccount(shop, preferredPlan = "FREE") {
  const cleanShop = normalizeShop(shop);
  if (!cleanShop) {
    throw new Error("Shop is required to manage AI credits.");
  }

  let account = await prisma.aiCreditAccount.findUnique({
    where: { shop: cleanShop },
  });

  const now = new Date();

  if (!account) {
    const isPro = String(preferredPlan || "FREE").toUpperCase() === "PRO";
    const quota = isPro ? PLAN_ALLOWANCES.PRO : PLAN_ALLOWANCES.FREE;

    account = await prisma.aiCreditAccount.create({
      data: {
        shop: cleanShop,
        plan: isPro ? "PRO" : "FREE",
        totalCredits: quota,
        usedCredits: 0,
        bonusCredits: 0,
        cycleResetAt: getNextCycleDate(),
      },
    });
  } else if (now >= new Date(account.cycleResetAt)) {
    // Auto-replenish on monthly cycle rollover while preserving custom higher quotas
    const planFloor = account.plan === "PRO" ? PLAN_ALLOWANCES.PRO : PLAN_ALLOWANCES.FREE;
    const quota = Math.max(account.totalCredits, planFloor);
    account = await prisma.aiCreditAccount.update({
      where: { shop: cleanShop },
      data: {
        totalCredits: quota,
        usedCredits: 0,
        cycleResetAt: getNextCycleDate(),
      },
    });
  }

  const effectiveTotal = account.totalCredits + account.bonusCredits;
  const availableCredits = Math.max(0, effectiveTotal - account.usedCredits);
  const percentUsed = effectiveTotal > 0 ? Math.min(100, Math.round((account.usedCredits / effectiveTotal) * 100)) : 0;

  return {
    ...account,
    effectiveTotal,
    availableCredits,
    percentUsed,
  };
}

export async function checkCreditBalance(shop, actionType, customCost) {
  const cost = typeof customCost === "number" ? customCost : CREDIT_COSTS[actionType] ?? 1;
  const account = await getOrCreateCreditAccount(shop);

  return {
    allowed: account.availableCredits >= cost,
    cost,
    availableCredits: account.availableCredits,
    plan: account.plan,
    account,
  };
}

export async function deductCredits({
  shop,
  actionType,
  customCost,
  productId = null,
  productTitle = null,
  modelUsed = DEFAULT_GEMINI_MODEL,
  tokensUsed = null,
  bypassLimit = false,
}) {
  const cleanShop = normalizeShop(shop);
  const cost = typeof customCost === "number" ? customCost : CREDIT_COSTS[actionType] ?? 1;

  const account = await getOrCreateCreditAccount(cleanShop);

  // Super Access bypasses credit quota consumption while still recording an audit log entry.
  if (bypassLimit) {
    const usageLog = await prisma.aiCreditUsageLog.create({
      data: {
        shop: cleanShop,
        actionType,
        creditsDeducted: 0,
        productId: productId ? String(productId) : null,
        productTitle: productTitle ? String(productTitle).slice(0, 200) : null,
        modelUsed,
        tokensUsed: typeof tokensUsed === "number" ? tokensUsed : null,
      },
    });

    return {
      success: true,
      deducted: 0,
      remainingCredits: account.availableCredits,
      usageLogId: usageLog.id,
      plan: account.plan,
      superAccess: true,
    };
  }

  // Re-verify balance inside an atomic transaction so concurrent clicks cannot overspend below 0.
  const { updatedAccount, usageLog } = await prisma.$transaction(async (tx) => {
    const current = await tx.aiCreditAccount.findUnique({ where: { shop: cleanShop } });
    const effective = (current?.totalCredits ?? 0) + (current?.bonusCredits ?? 0);
    const available = Math.max(0, effective - (current?.usedCredits ?? 0));
    if (!current || available < cost) {
      throw new Error(
        `Insufficient AI tokens. This action requires ${cost} token${cost > 1 ? "s" : ""}, but your balance is ${available}. Upgrade to Pro for ${PLAN_ALLOWANCES.PRO} monthly tokens or buy a token package.`,
      );
    }

    const updated = await tx.aiCreditAccount.update({
      where: { shop: cleanShop },
      data: {
        usedCredits: { increment: cost },
      },
    });
    const log = await tx.aiCreditUsageLog.create({
      data: {
        shop: cleanShop,
        actionType,
        creditsDeducted: cost,
        productId: productId ? String(productId) : null,
        productTitle: productTitle ? String(productTitle).slice(0, 200) : null,
        modelUsed,
        tokensUsed: typeof tokensUsed === "number" ? tokensUsed : null,
      },
    });
    return { updatedAccount: updated, usageLog: log };
  });

  const effectiveTotal = updatedAccount.totalCredits + updatedAccount.bonusCredits;
  const remainingCredits = Math.max(0, effectiveTotal - updatedAccount.usedCredits);

  return {
    success: true,
    deducted: cost,
    remainingCredits,
    usageLogId: usageLog.id,
    plan: updatedAccount.plan,
    superAccess: false,
  };
}

export async function syncPlanSubscription(shop, isPro) {
  const cleanShop = normalizeShop(shop);
  const current = await getOrCreateCreditAccount(cleanShop);
  const targetPlan = isPro ? "PRO" : "FREE";
  const quota = isPro ? PLAN_ALLOWANCES.PRO : PLAN_ALLOWANCES.FREE;

  if (current.plan === targetPlan) {
    return current;
  }

  return prisma.aiCreditAccount.update({
    where: { shop: cleanShop },
    data: {
      plan: targetPlan,
      totalCredits: isPro ? Math.max(current.totalCredits, quota) : quota,
    },
  });
}

export async function getCreditUsageHistory(shop, limit = 20) {
  const cleanShop = normalizeShop(shop);
  if (!cleanShop) return [];

  return prisma.aiCreditUsageLog.findMany({
    where: { shop: cleanShop },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function grantCreditPackPurchase(shop, chargeId, credits = 100) {
  const cleanShop = normalizeShop(shop);
  const cleanChargeId = String(chargeId || "").trim();
  const amount = Math.max(1, Number(credits || 0));
  if (!cleanShop || !cleanChargeId) {
    throw new Error("shop and chargeId are required to grant credit packs.");
  }

  await getOrCreateCreditAccount(cleanShop);

  const existing = await prisma.aiCreditUsageLog.findFirst({
    where: {
      shop: cleanShop,
      actionType: "credit_pack_purchase",
      productId: cleanChargeId,
    },
  });

  if (existing) {
    const account = await getOrCreateCreditAccount(cleanShop);
    return { granted: false, alreadyGranted: true, availableCredits: account.availableCredits };
  }

  const [updated] = await prisma.$transaction([
    prisma.aiCreditAccount.update({
      where: { shop: cleanShop },
      data: {
        bonusCredits: { increment: amount },
      },
    }),
    prisma.aiCreditUsageLog.create({
      data: {
        shop: cleanShop,
        actionType: "credit_pack_purchase",
        creditsDeducted: -amount,
        productId: cleanChargeId,
        productTitle: `+${amount} AI Token Top-Up Package`,
        modelUsed: "shopify_billing",
      },
    }),
  ]);

  const effectiveTotal = updated.totalCredits + updated.bonusCredits;
  return {
    granted: true,
    alreadyGranted: false,
    added: amount,
    availableCredits: Math.max(0, effectiveTotal - updated.usedCredits),
  };
}

