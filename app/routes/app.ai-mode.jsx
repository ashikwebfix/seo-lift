/* eslint-disable react/prop-types */
import { useEffect, useState } from "react";
import { Link, useLoaderData, useLocation } from "react-router";
import seoStyles from "../styles/seo.css?url";
import { AiChatPanel } from "../components/ai-chatbox";
import { TokenPricingAndCalculator } from "../components/token-pricing-calculator";
import { buildAiChatStoreContext, loadAiChatCatalogSummary } from "../services/ai-chat-executor.server";
import { getAppState } from "../services/app-state.server";
import { getOrCreateCreditAccount } from "../services/credit-manager.server";
import { requireShopContext } from "../services/route-context.server";
import {
  checkStoreRouteAccess,
  getEffectivePlatformAiSettings,
  getOrCreateStoreControl,
} from "../services/store-control.server";
import { PLAN_ALLOWANCES } from "../utils/credits";
import { AI_FEATURES_ENABLED } from "../utils/feature-flags";

export const links = () => [{ rel: "stylesheet", href: seoStyles }];

export const loader = async ({ request }) => {
  const { configError, shop, token, apiVersion } = await requireShopContext(request);
  if (configError || !shop) {
    return {
      shop: shop || "",
      configError: configError || "Shopify session required.",
      aiChatHistory: [],
      storeSnapshot: null,
      catalogProducts: [],
      aiReady: false,
      aiUnavailableReason: configError || "Shopify session required.",
      creditAccount: {
        availableCredits: 0,
        totalCredits: PLAN_ALLOWANCES.FREE,
        plan: "FREE",
        superAccess: false,
      },
    };
  }

  const [appState, creditAccount, storeControl, platformAi, aiAccess, catalogProducts] =
    await Promise.all([
      getAppState(shop),
      getOrCreateCreditAccount(shop),
      getOrCreateStoreControl(shop),
      getEffectivePlatformAiSettings(),
      checkStoreRouteAccess(shop, "ai_features"),
      loadAiChatCatalogSummary({ shop, storeDomain: shop, token, apiVersion, limit: 25 }),
    ]);

  const aiReady = Boolean(AI_FEATURES_ENABLED && platformAi?.isEnabled && aiAccess?.allowed);
  const aiUnavailableReason = !AI_FEATURES_ENABLED
    ? "AI features are turned off in app configuration."
    : !platformAi?.isEnabled
      ? "Platform Gemini AI is disabled in SuperAdmin."
      : !aiAccess?.allowed
        ? aiAccess?.reason || "AI Mode is disabled for this store."
        : "";

  return {
    shop,
    configError: "",
    aiChatHistory: Array.isArray(appState?.aiChatHistory) ? appState.aiChatHistory : [],
    storeSnapshot: buildAiChatStoreContext({ shop, appState }),
    catalogProducts,
    aiReady,
    aiUnavailableReason,
    creditAccount: {
      availableCredits: creditAccount.availableCredits,
      totalCredits: creditAccount.effectiveTotal,
      plan: creditAccount.plan,
      superAccess: Boolean(storeControl?.superAccess),
    },
  };
};

export default function AiModeRoute() {
  const data = useLoaderData();
  const location = useLocation();
  const [liveCreditAccount, setLiveCreditAccount] = useState(data.creditAccount);

  useEffect(() => {
    setLiveCreditAccount(data.creditAccount);
  }, [data.creditAccount]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const onCredits = (event) => {
      const detail = event?.detail || {};
      setLiveCreditAccount((prev) => ({
        ...(prev || {}),
        availableCredits:
          typeof detail.availableCredits === "number"
            ? detail.availableCredits
            : prev?.availableCredits ?? 0,
        totalCredits:
          typeof detail.totalCredits === "number"
            ? detail.totalCredits
            : prev?.totalCredits,
        plan: detail.plan || prev?.plan,
        superAccess:
          detail.superAccess !== undefined
            ? Boolean(detail.superAccess)
            : Boolean(prev?.superAccess),
      }));
    };
    window.addEventListener("ecomseo:credits-updated", onCredits);
    return () => window.removeEventListener("ecomseo:credits-updated", onCredits);
  }, []);

  return (
    <>
      <ui-title-bar title="Full AI Mode — EcomSEO Copilot" />
      <main className="seo-wrap ai-mode-page-wrap">
        <div className="ai-mode-page-topbar">
          <div className="ai-mode-page-crumb">
            <Link to="/app" className="seo-button ghost" style={{ padding: "6px 10px" }}>
              ← Back to Dashboard
            </Link>
            <span className="seo-muted" style={{ fontSize: "12px" }}>
              Store: <strong>{data.shop || "Not connected"}</strong>
            </span>
          </div>
          <div className="ai-mode-quick-links">
            <a
              href="#token-calculator"
              className="seo-button secondary"
              style={{ padding: "6px 12px", fontSize: "12px" }}
            >
              🧮 Token Calculator &amp; Pricing
            </a>
            <Link to="/app/seo-audit" className="seo-button secondary" style={{ padding: "6px 12px", fontSize: "12px" }}>
              SEO Audit
            </Link>
            <Link
              to="/app/image-optimizer?tab=compression"
              className="seo-button secondary"
              style={{ padding: "6px 12px", fontSize: "12px" }}
            >
              Image Compression
            </Link>
            <Link to="/app/pagespeed" className="seo-button secondary" style={{ padding: "6px 12px", fontSize: "12px" }}>
              PageSpeed
            </Link>
            <Link to={`/app/billing${location.search || ""}`} className="seo-button secondary" style={{ padding: "6px 12px", fontSize: "12px" }}>
              Billing &amp; Top-Ups
            </Link>
          </div>
        </div>

        {data.configError ? <div className="error-box">{data.configError}</div> : null}

        <div className="ai-mode-page-card">
          <AiChatPanel
            mode="page"
            open={true}
            initialHistory={data.aiChatHistory}
            initialSnapshot={data.storeSnapshot}
            initialCatalogProducts={data.catalogProducts}
            aiReady={data.aiReady}
            aiUnavailableReason={data.aiUnavailableReason}
            creditAccount={liveCreditAccount}
          />
        </div>

        <TokenPricingAndCalculator
          id="token-calculator"
          creditAccount={liveCreditAccount}
          hasSuperAccess={Boolean(liveCreditAccount?.superAccess)}
          locationSearch={location.search}
        />
      </main>
    </>
  );
}

