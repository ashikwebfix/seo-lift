/* global globalThis */
import { useEffect, useState } from "react";
import { Link, Outlet, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import seoStyles from "../styles/seo.css?url";
import toastStyles from "../styles/toast.css?url";
import { AiChatDrawer } from "../components/ai-chatbox";
import { AppMenuShell } from "../components/seo-ui";
import { SeoToastViewport, showToast } from "../components/toast-viewport";
import { buildAiChatStoreContext } from "../services/ai-chat-executor.server";
import { getAppState } from "../services/app-state.server";
import { requireShopContext } from "../services/route-context.server";
import { getCachedActiveAppSubscriptions } from "../services/billing.server";
import { getOrCreateCreditAccount, syncPlanSubscription } from "../services/credit-manager.server";
import {
  getEffectivePlatformAiSettings,
  getOrCreateStoreControl,
  isFeatureAllowed,
  PLATFORM_FEATURES,
} from "../services/store-control.server";
import { PLAN_ALLOWANCES } from "../utils/credits";
import { AI_FEATURES_ENABLED } from "../utils/feature-flags";

export const links = () => [
  { rel: "stylesheet", href: seoStyles },
  { rel: "stylesheet", href: toastStyles },
];

export const loader = async ({ request }) => {
  const url = new URL(request.url);
  let creditAccount = null;
  let storeControl = null;
  let aiChatSeed = {
    aiChatHistory: [],
    storeSnapshot: null,
    aiReady: false,
    aiUnavailableReason: "",
  };

  try {
    const { admin, shop, token, apiVersion } = await requireShopContext(request);
    if (shop) {
      storeControl = await getOrCreateStoreControl(shop);

      let hasBillingSub = false;
      if (token) {
        try {
          const activeSubscriptions = await getCachedActiveAppSubscriptions({
            admin,
            storeDomain: shop,
            token,
            apiVersion,
          });
          hasBillingSub = Boolean(activeSubscriptions?.length);
        } catch {
          hasBillingSub = false;
        }
      }

      const effectivePro = hasBillingSub || Boolean(storeControl?.superAccess);
      creditAccount = await getOrCreateCreditAccount(shop, effectivePro ? "PRO" : "FREE");
      if (hasBillingSub && creditAccount.plan !== "PRO") {
        await syncPlanSubscription(shop, true);
        creditAccount = await getOrCreateCreditAccount(shop, "PRO");
      }

      const [appState, platformAi] = await Promise.all([
        getAppState(shop),
        getEffectivePlatformAiSettings(),
      ]);
      const aiAllowedForStore = isFeatureAllowed(storeControl, "ai_features");
      const aiReady = Boolean(AI_FEATURES_ENABLED && platformAi?.isEnabled && aiAllowedForStore);
      const aiUnavailableReason = !AI_FEATURES_ENABLED
        ? "AI features are disabled in app settings."
        : !platformAi?.isEnabled
          ? "Platform Gemini AI is disabled in SuperAdmin."
          : !aiAllowedForStore
            ? "AI Mode is restricted for this store."
            : "";

      aiChatSeed = {
        aiChatHistory: Array.isArray(appState?.aiChatHistory) ? appState.aiChatHistory : [],
        storeSnapshot: buildAiChatStoreContext({ shop, appState }),
        aiReady,
        aiUnavailableReason,
      };
    }
  } catch (error) {
    if (error instanceof Response) throw error;
  }

  const matchedFeature = PLATFORM_FEATURES.find(
    (f) => f.key !== "ai_features" && url.pathname.startsWith(f.path),
  );
  const routeBlocked =
    storeControl?.accessLevel === "SUSPENDED" ||
    Boolean(matchedFeature && !isFeatureAllowed(storeControl, matchedFeature.key));

  return {
    apiKey: globalThis.process?.env?.SHOPIFY_API_KEY || "",
    creditAccount: creditAccount
      ? {
          availableCredits: creditAccount.availableCredits,
          totalCredits: creditAccount.totalCredits,
          bonusCredits: creditAccount.bonusCredits,
          effectiveTotal: creditAccount.effectiveTotal,
          usedCredits: creditAccount.usedCredits,
          plan: creditAccount.plan,
        }
      : null,
    storeControl: storeControl
      ? {
          accessLevel: storeControl.accessLevel,
          superAccess: storeControl.superAccess,
          allowedFeatures: storeControl.allowedFeatures,
        }
      : null,
    routeBlocked,
    blockedFeatureLabel: matchedFeature?.label || "",
    aiChatSeed,
  };
};

export default function App() {
  const { apiKey, creditAccount, storeControl, routeBlocked, blockedFeatureLabel, aiChatSeed } =
    useLoaderData();
  const [aiDrawerOpen, setAiDrawerOpen] = useState(false);

  const isSuspended = storeControl?.accessLevel === "SUSPENDED";
  const allowedSet = new Set(storeControl?.allowedFeatures || []);
  const canSee = (key) => {
    if (isSuspended) return false;
    if (!storeControl || storeControl.accessLevel === "FULL") return true;
    return allowedSet.has(key);
  };

  useEffect(() => {
    if (!routeBlocked) return;
    showToast({
      tone: isSuspended ? "error" : "warning",
      title: isSuspended ? "Store Access Suspended" : "Feature Restricted",
      message: isSuspended
        ? "Access to Ecom SEO for this store has been suspended by the administrator."
        : `The "${blockedFeatureLabel}" module is disabled under Partial Access.`,
    });
  }, [routeBlocked, isSuspended, blockedFeatureLabel]);

  return (
    <AppProvider embedded apiKey={apiKey}>
      <s-app-nav>
        {!isSuspended ? <s-link href="/app">Home</s-link> : null}
        {canSee("ai_features") ? <s-link href="/app/ai-mode">Full AI Mode</s-link> : null}
        {canSee("seo_audit") ? <s-link href="/app/seo-audit">AI Audit</s-link> : null}
        {canSee("products") ? <s-link href="/app/products">Product SEO</s-link> : null}
        {canSee("bulk_meta") ? <s-link href="/app/bulk-meta">Bulk Meta</s-link> : null}
        {canSee("image_optimizer") ? <s-link href="/app/image-optimizer">Image ALT</s-link> : null}
        {canSee("url_optimization") ? <s-link href="/app/url-optimization">URLs &amp; 301s</s-link> : null}
        {canSee("pagespeed") ? <s-link href="/app/pagespeed">PageSpeed</s-link> : null}
        {canSee("robots") ? <s-link href="/app/robots">Robots.txt</s-link> : null}
        {canSee("sitemap") ? <s-link href="/app/sitemap">XML Sitemap</s-link> : null}
        {canSee("revisions") ? <s-link href="/app/revisions">History</s-link> : null}
        {!isSuspended ? <s-link href="/app/billing">Subscription</s-link> : null}
      </s-app-nav>

      {routeBlocked ? (
        <div style={{ maxWidth: 640, margin: "48px auto", padding: 24, background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0", fontFamily: "Inter, sans-serif" }}>
          <h2 style={{ marginTop: 0, color: "#991b1b" }}>
            {isSuspended ? "Store Access Suspended" : "Feature Restricted (Partial Access)"}
          </h2>
          <p style={{ color: "#475569", lineHeight: 1.6 }}>
            {isSuspended
              ? "Access to Ecom SEO for this store has been suspended by the app administrator. Please contact support to restore access."
              : `Your store currently has Partial Access enabled. The "${blockedFeatureLabel}" module is disabled by the administrator.`}
          </p>
          {!isSuspended ? (
            <Link
              to="/app"
              style={{
                display: "inline-block",
                marginTop: 8,
                padding: "9px 16px",
                background: "#0f766e",
                color: "#fff",
                borderRadius: 8,
                textDecoration: "none",
                fontWeight: 600,
                fontSize: 13,
              }}
            >
              Return to Dashboard
            </Link>
          ) : null}
        </div>
      ) : (
        <>
          <AppMenuShell
            creditAccount={creditAccount}
            storeControl={storeControl}
            canOpenAiMode={canSee("ai_features")}
            aiModeOpen={aiDrawerOpen}
            onOpenAiMode={() => setAiDrawerOpen(true)}
          />
          <Outlet />
          {canSee("ai_features") ? (
            <AiChatDrawer
              open={aiDrawerOpen}
              onClose={() => setAiDrawerOpen(false)}
              initialHistory={aiChatSeed?.aiChatHistory || []}
              initialSnapshot={aiChatSeed?.storeSnapshot || null}
              aiReady={Boolean(aiChatSeed?.aiReady)}
              aiUnavailableReason={aiChatSeed?.aiUnavailableReason || ""}
              creditAccount={{
                availableCredits: creditAccount?.availableCredits ?? 0,
                totalCredits: creditAccount?.effectiveTotal ?? PLAN_ALLOWANCES.FREE,
                plan: creditAccount?.plan || "FREE",
                superAccess: Boolean(storeControl?.superAccess),
              }}
            />
          ) : null}
        </>
      )}
      <SeoToastViewport />
    </AppProvider>
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
