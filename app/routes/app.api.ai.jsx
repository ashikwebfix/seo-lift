import {
  aiHandleSuggestion,
  aiRobotsImprovement,
} from "../services/ai-fixes.server";
import {
  auditProductSeoChange,
  generateAiChatCopilotReply,
  generateAiRobotsSuggestion,
  generateMetaFix,
  generatePageSpeedAiFixPlan,
  generateProductContentFix,
  generateProductSeoFix,
  generateStoreCopilotBrief,
  generateVisionImageAlt,
  resolveKeywordCannibalization,
} from "../services/ai-provider.server.js";
import {
  appendAiChatMessages,
  buildAiChatStoreContext,
  executeAiChatFixAction,
  loadAiChatCatalogSummary,
} from "../services/ai-chat-executor.server.js";
import { getAppState, updateAppState } from "../services/app-state.server.js";
import {
  checkCreditBalance,
  deductCredits,
  getCreditUsageHistory,
  getOrCreateCreditAccount,
} from "../services/credit-manager.server.js";
import { requireShopContext } from "../services/route-context.server";
import {
  checkStoreRouteAccess,
  getEffectivePlatformAiSettings,
} from "../services/store-control.server.js";
import { AI_FEATURES_ENABLED } from "../utils/feature-flags";
import { DEFAULT_GEMINI_MODEL } from "../utils/gemini-models.js";
import { resolveActionCreditCost } from "../utils/credits.js";

async function parseInput(request) {
  const type = request.headers.get("content-type") || "";
  if (type.includes("application/json")) {
    return request.json();
  }

  const formData = await request.formData();
  const rawPayload = formData.get("payload");
  return rawPayload ? JSON.parse(String(rawPayload)) : Object.fromEntries(formData.entries());
}

export const loader = async ({ request }) => {
  const { shop } = await requireShopContext(request);
  if (!shop) {
    return { ok: false, error: "Shop context required." };
  }

  const account = await getOrCreateCreditAccount(shop);
  const usageHistory = await getCreditUsageHistory(shop, 15);

  return {
    ok: true,
    account: {
      plan: account.plan,
      totalCredits: account.effectiveTotal,
      usedCredits: account.usedCredits,
      availableCredits: account.availableCredits,
      percentUsed: account.percentUsed,
      cycleResetAt: account.cycleResetAt,
    },
    usageHistory,
  };
};

export const action = async ({ request }) => {
  const { shop, token, apiVersion } = await requireShopContext(request);
  if (!shop) {
    return { ok: false, error: "Shop is required." };
  }

  const [appState, platformAi, access] = await Promise.all([
    getAppState(shop),
    getEffectivePlatformAiSettings(),
    checkStoreRouteAccess(shop, "ai_features"),
  ]);

  const aiSettings = {
    provider: platformAi.provider,
    model: platformAi.model,
    apiKey: platformAi.apiKey,
    temperature: platformAi.temperature,
  };

  try {
    const payload = await parseInput(request);
    const actionType = String(payload.actionType || "").trim();

    if (!actionType) {
      return { ok: false, error: "actionType is required." };
    }

    if (!AI_FEATURES_ENABLED || !platformAi.isEnabled) {
      return { ok: false, error: "Platform AI features are currently disabled by administrator." };
    }

    if (!access.allowed) {
      return { ok: false, error: access.reason };
    }

    // ─── Query-only actions (No credit cost) ─────────────────────────────────
    if (actionType === "get_credit_balance") {
      const account = await getOrCreateCreditAccount(shop);
      return {
        ok: true,
        account: {
          plan: account.plan,
          totalCredits: account.effectiveTotal,
          usedCredits: account.usedCredits,
          availableCredits: account.availableCredits,
          percentUsed: account.percentUsed,
          cycleResetAt: account.cycleResetAt,
        },
      };
    }

    if (actionType === "get_usage_history") {
      const history = await getCreditUsageHistory(shop, 25);
      return { ok: true, history };
    }

    // Non-AI heuristics (Free of charge)
    if (actionType === "url_handle_suggestion") {
      const result = aiHandleSuggestion(payload);
      return { ok: true, actionType, result };
    }

    if (actionType === "robots_txt_improvement" && !payload.useAi) {
      const result = aiRobotsImprovement({ currentRules: payload.currentRules });
      return { ok: true, actionType, result };
    }

    if (actionType === "get_ai_chat_state") {
      const [appState, account, catalogProducts] = await Promise.all([
        getAppState(shop),
        getOrCreateCreditAccount(shop),
        loadAiChatCatalogSummary({
          shop,
          storeDomain: shop,
          token,
          apiVersion,
          query: String(payload.query || ""),
          limit: 25,
        }),
      ]);
      return {
        ok: true,
        actionType,
        aiChatHistory: appState?.aiChatHistory || [],
        storeSnapshot: buildAiChatStoreContext({ shop, appState }),
        catalogProducts,
        creditsRemaining: account.availableCredits,
        totalCredits: account.effectiveTotal,
        plan: account.plan,
        superAccess: Boolean(access.control?.superAccess),
      };
    }

    if (actionType === "ai_chat_catalog") {
      const catalogProducts = await loadAiChatCatalogSummary({
        shop,
        storeDomain: shop,
        token,
        apiVersion,
        query: String(payload.query || ""),
        limit: 25,
      });
      return {
        ok: true,
        actionType,
        catalogProducts,
      };
    }

    if (actionType === "clear_ai_chat_history") {
      await updateAppState(shop, (current) => ({
        ...current,
        aiChatHistory: [],
      }));
      return {
        ok: true,
        actionType,
        aiChatHistory: [],
      };
    }

    if (actionType === "ai_chat_execute") {
      const hasSuperAccess = Boolean(access.control?.superAccess);
      const execAction = payload.action && typeof payload.action === "object" ? payload.action : {};
      const execution = await executeAiChatFixAction({
        shop,
        storeDomain: shop,
        token,
        apiVersion,
        action: execAction,
        aiSettings,
        aiAllowed: AI_FEATURES_ENABLED && platformAi.isEnabled && access.allowed,
        hasSuperAccess,
      });

      const confirmationMessage = execution?.ok
        ? {
            role: "assistant",
            content: `✅ ${execution.title || "Action complete"}: ${execution.summary || "Done."}`,
            actionResult: execution,
          }
        : {
            role: "assistant",
            content: `⚠️ ${execution?.error || "Could not execute that action."}`,
            actionResult: execution,
          };

      const aiChatHistory = await appendAiChatMessages(shop, [confirmationMessage], {
        markActionId: String(execAction?.id || ""),
        markMessageId: String(payload.messageId || ""),
        actionResult: execution,
      });

      const [freshState, freshAccount, freshCatalog] = await Promise.all([
        getAppState(shop),
        getOrCreateCreditAccount(shop),
        loadAiChatCatalogSummary({
          shop,
          storeDomain: shop,
          token,
          apiVersion,
          limit: 25,
        }),
      ]);

      return {
        ok: Boolean(execution?.ok),
        actionType,
        execution,
        aiChatHistory,
        storeSnapshot: buildAiChatStoreContext({ shop, appState: freshState }),
        catalogProducts: freshCatalog,
        outOfCredits: Boolean(execution?.outOfCredits),
        error: execution?.error || "",
        creditsDeducted: Number(execution?.creditInfo?.creditsDeducted || 0),
        creditsRemaining:
          typeof execution?.creditInfo?.creditsRemaining === "number"
            ? execution.creditInfo.creditsRemaining
            : freshAccount.availableCredits,
        totalCredits: freshAccount.effectiveTotal,
        plan: freshAccount.plan,
        superAccess: hasSuperAccess,
      };
    }

    if (actionType === "ai_chat" && !String(payload.message || "").trim()) {
      return {
        ok: false,
        actionType,
        error: "Please enter a message or pick a quick prompt.",
      };
    }

    // ─── AI-powered actions with Credit Validation ───────────────────────────
    const hasSuperAccess = Boolean(access.control?.superAccess);
    const actionCost = resolveActionCreditCost(actionType, payload);
    const creditCheck = await checkCreditBalance(
      shop,
      actionType,
      actionCost,
    );

    if (!hasSuperAccess && !creditCheck.allowed) {
      return {
        ok: false,
        outOfCredits: true,
        error: `Insufficient AI tokens. This action requires ${creditCheck.cost} token${creditCheck.cost > 1 ? "s" : ""}, but you have ${creditCheck.availableCredits} remaining. Upgrade to Pro or buy a token package.`,
        availableCredits: creditCheck.availableCredits,
        cost: creditCheck.cost,
        plan: creditCheck.plan,
      };
    }

    let result = null;

    if (actionType === "meta_fix") {
      result = await generateMetaFix({
        settings: aiSettings,
        title: payload.title,
        focusKeyword: payload.focusKeyword,
        currentMetaTitle: payload.currentMetaTitle,
        currentMetaDescription: payload.currentMetaDescription,
      });
    } else if (actionType === "product_seo_fix") {
      result = await generateProductSeoFix({
        settings: aiSettings,
        title: payload.title,
        focusKeyword: payload.focusKeyword,
        handle: payload.handle,
        metaTitle: payload.metaTitle,
        metaDescription: payload.metaDescription,
        descriptionHtml: payload.descriptionHtml || "",
        productType: payload.productType || "",
        tags: payload.tags || "",
        mode: payload.mode || "full",
        preserveHandle: Boolean(payload.preserveHandle),
      });
    } else if (actionType === "product_content_fix") {
      result = await generateProductContentFix({
        settings: aiSettings,
        title: payload.title,
        focusKeyword: payload.focusKeyword,
        descriptionHtml: payload.descriptionHtml || "",
        productType: payload.productType || "",
        tags: payload.tags || "",
        goal: payload.goal || "polish",
      });
    } else if (actionType === "audit_change") {
      result = await auditProductSeoChange({
        settings: aiSettings,
        productTitle: payload.title || payload.productTitle,
        currentValues: payload.currentValues || {},
        newValues: payload.newValues || {},
      });
    } else if (actionType === "vision_alt") {
      result = await generateVisionImageAlt({
        settings: aiSettings,
        imageUrl: payload.imageUrl,
        productTitle: payload.productTitle || payload.title,
      });
    } else if (actionType === "store_copilot") {
      if (!appState?.lastScan) {
        return {
          ok: false,
          error: "Run an SEO scan first so Gemini Copilot can analyze your store audit.",
        };
      }
      result = await generateStoreCopilotBrief({
        settings: aiSettings,
        storeDomain: shop,
        scan: appState.lastScan,
        gscData: appState.gsc || null,
      });
      if (!result?.fallbackUsed) {
        await updateAppState(shop, (current) => ({
          ...current,
          lastCopilotBrief: {
            ...result,
            generatedAt: new Date().toISOString(),
            scoreAtGeneration: appState.lastScan?.summary?.score ?? null,
          },
        }));
      }
    } else if (actionType === "catalog_cannibalization") {
      const groups = appState?.lastScan?.summary?.cannibalizedGroups || [];
      result = await resolveKeywordCannibalization({
        settings: aiSettings,
        groups,
      });
    } else if (actionType === "robots_txt_improvement" && payload.useAi) {
      result = await generateAiRobotsSuggestion({
        settings: aiSettings,
        currentRules: payload.currentRules,
        storeDomain: shop,
      });
    } else if (actionType === "pagespeed_ai_fix") {
      const mobileReport = payload.mobileReport || appState?.pageSpeed?.mobile || null;
      const desktopReport = payload.desktopReport || appState?.pageSpeed?.desktop || null;
      const targetReport = payload.report || mobileReport || desktopReport;
      if (!targetReport) {
        return {
          ok: false,
          error: "Run a live Google PageSpeed test first so Gemini can analyze your Core Web Vitals.",
        };
      }
      result = await generatePageSpeedAiFixPlan({
        settings: aiSettings,
        storeDomain: shop,
        report: targetReport,
        mobileReport,
        desktopReport,
        matchedProductTitle: payload.matchedProductTitle || "",
      });
      if (!result?.fallbackUsed) {
        await updateAppState(shop, (current) => ({
          ...current,
          pageSpeed: {
            ...(current.pageSpeed || {}),
            lastAiPlan: {
              ...result,
              generatedAt: new Date().toISOString(),
            },
          },
        }));
      }
    } else if (actionType === "ai_chat") {
      const userMessage = String(payload.message || "").trim();
      const [appState, catalogProducts] = await Promise.all([
        getAppState(shop),
        loadAiChatCatalogSummary({
          shop,
          storeDomain: shop,
          token,
          apiVersion,
          limit: 20,
        }),
      ]);
      const storeSnapshot = buildAiChatStoreContext({ shop, appState });
      const selectedProduct =
        payload.selectedProduct && typeof payload.selectedProduct === "object"
          ? payload.selectedProduct
          : null;
      const chatReply = await generateAiChatCopilotReply({
        settings: aiSettings,
        storeDomain: shop,
        userMessage,
        chatHistory: appState?.aiChatHistory || [],
        storeSnapshot,
        selectedProduct,
        catalogProducts,
      });

      const aiChatHistory = await appendAiChatMessages(shop, [
        { role: "user", content: userMessage },
        {
          role: "assistant",
          content: chatReply.reply,
          suggestedActions: chatReply.suggestedActions,
          quickReplies: chatReply.quickReplies,
          fallbackUsed: Boolean(chatReply.fallbackUsed),
        },
      ]);

      result = {
        ...chatReply,
        aiChatHistory,
        storeSnapshot,
      };
    } else {
      return {
        ok: false,
        error: `Unsupported actionType: ${actionType}.`,
      };
    }

    // Do not deduct credits if Gemini failed and graceful fallback was returned
    if (result?.fallbackUsed) {
      const currentAccount = await getOrCreateCreditAccount(shop);
      return {
        ok: true,
        actionType,
        result,
        creditsDeducted: 0,
        creditsRemaining: currentAccount.availableCredits,
        plan: currentAccount.plan,
      };
    }

    const deduction = await deductCredits({
      shop,
      actionType,
      customCost: actionCost,
      productId: payload.productId || payload.id,
      productTitle:
        payload.title ||
        payload.productTitle ||
        (actionType === "store_copilot"
          ? "Store-wide Copilot"
          : actionType === "ai_chat"
            ? "AI Mode Chat"
            : null),
      modelUsed: aiSettings.model || DEFAULT_GEMINI_MODEL,
      bypassLimit: hasSuperAccess,
    });

    return {
      ok: true,
      actionType,
      result,
      creditsDeducted: deduction.deducted,
      creditsRemaining: deduction.remainingCredits,
      plan: deduction.plan,
      superAccess: hasSuperAccess,
    };
  } catch (error) {
    return {
      ok: false,
      error: error?.message || "Unable to process AI request.",
    };
  }
};
