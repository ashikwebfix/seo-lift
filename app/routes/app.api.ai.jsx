import {
  aiHandleSuggestion,
  aiRobotsImprovement,
} from "../services/ai-fixes.server";
import { generateMetaFix, generateProductSeoFix } from "../services/ai-provider.server.js";
import { getAppState } from "../services/app-state.server.js";
import { requireShopContext } from "../services/route-context.server";
import { AI_FEATURES_ENABLED } from "../utils/feature-flags";

async function parseInput(request) {
  const type = request.headers.get("content-type") || "";
  if (type.includes("application/json")) {
    return request.json();
  }

  const formData = await request.formData();
  const rawPayload = formData.get("payload");
  return rawPayload ? JSON.parse(String(rawPayload)) : Object.fromEntries(formData.entries());
}

export const action = async ({ request }) => {
  const { shop } = await requireShopContext(request);
  const appState = shop ? await getAppState(shop) : null;
  const aiSettings = appState?.aiSettings;

  try {
    const payload = await parseInput(request);
    const actionType = String(payload.actionType || "").trim();

    if (!actionType) {
      return { ok: false, error: "actionType is required." };
    }

    if (!AI_FEATURES_ENABLED && (actionType === "meta_fix" || actionType === "product_seo_fix")) {
      return { ok: false, error: "AI Fix is temporarily hidden." };
    }

    if (actionType === "meta_fix") {
      const result = await generateMetaFix({
        settings: aiSettings,
        title: payload.title,
        focusKeyword: payload.focusKeyword,
        currentMetaTitle: payload.currentMetaTitle,
        currentMetaDescription: payload.currentMetaDescription,
      });
      return { ok: true, actionType, result };
    }

    if (actionType === "product_seo_fix") {
      const result = await generateProductSeoFix({
        settings: aiSettings,
        title: payload.title,
        focusKeyword: payload.focusKeyword,
        handle: payload.handle,
        metaTitle: payload.metaTitle,
        metaDescription: payload.metaDescription,
      });
      return { ok: true, actionType, result };
    }

    if (actionType === "url_handle_suggestion") {
      const result = aiHandleSuggestion(payload);
      return { ok: true, actionType, result };
    }

    if (actionType === "robots_txt_improvement") {
      const result = aiRobotsImprovement({ currentRules: payload.currentRules });
      return { ok: true, actionType, result };
    }

    return {
      ok: false,
      error: "Unsupported actionType. Use meta_fix, product_seo_fix, url_handle_suggestion, or robots_txt_improvement.",
    };
  } catch (error) {
    return {
      ok: false,
      error: error?.message || "Unable to process AI fix request.",
    };
  }
};
