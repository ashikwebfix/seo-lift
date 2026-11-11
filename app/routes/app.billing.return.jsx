import { Link, useLoaderData, useLocation } from "react-router";
import seoStyles from "../styles/seo.css?url";
import { requireShopContext } from "../services/route-context.server";
import {
  getActiveAppSubscriptions,
  getOneTimePurchases,
  invalidateBillingCache,
} from "../services/billing.server";
import { grantCreditPackPurchase, syncPlanSubscription } from "../services/credit-manager.server";
import { resolvePackageFromShopifyPurchase } from "../utils/credits.js";

const PLAN_PRO = "Ecom SEO Pro";

export const links = () => [{ rel: "stylesheet", href: seoStyles }];

export const loader = async ({ request }) => {
  const { admin, shop, token, apiVersion, configError } =
    await requireShopContext(request);

  if (configError) {
    return {
      configError,
      isSubscribed: false,
      subscription: null,
      planName: null,
      packResult: null,
    };
  }

  const url = new URL(request.url);
  const packageId = url.searchParams.get("package") || "";
  const legacyPackAmount = Number(url.searchParams.get("pack") || 0);
  const chargeId = url.searchParams.get("charge_id") || "";

  let packResult = null;
  if ((packageId || legacyPackAmount > 0) && shop) {
    try {
      const purchases = await getOneTimePurchases({
        admin,
        storeDomain: shop,
        token,
        apiVersion,
      });
      const matched = purchases.find((p) => {
        const numericId = String(p.id || "").split("/").pop();
        const matchesCharge = chargeId ? numericId === chargeId || p.id === chargeId : true;
        return matchesCharge && p.status === "ACTIVE";
      });

      if (matched) {
        const pkg = resolvePackageFromShopifyPurchase(matched, packageId);
        const granted = await grantCreditPackPurchase(shop, matched.id, pkg.tokens);
        packResult = {
          ...granted,
          tokensAdded: pkg.tokens,
          packageLabel: pkg.label,
        };
      } else {
        packResult = { granted: false, pendingOrCancelled: true };
      }
    } catch (err) {
      packResult = { granted: false, error: err?.message || "Could not verify token package purchase." };
    }
  }

  let activeSubscriptions = [];
  try {
    activeSubscriptions = await getActiveAppSubscriptions({
      admin,
      storeDomain: shop,
      token,
      apiVersion,
    });
  } catch {
    activeSubscriptions = [];
  }
  const subscription = activeSubscriptions[0] || null;
  const planName = subscription?.name || null;
  if (subscription && shop) {
    await syncPlanSubscription(shop, true).catch(() => {});
  }
  if (shop) invalidateBillingCache(shop);

  return {
    configError: "",
    isSubscribed: Boolean(subscription),
    subscription,
    planName,
    packResult,
  };
};

export default function BillingReturnPage() {
  const { configError, isSubscribed, subscription, planName, packResult } = useLoaderData();
  const location = useLocation();
  const isPro = planName === PLAN_PRO;
  const hasTrial = isPro && (subscription?.trialDays ?? 0) > 0;

  return (
    <>
      <ui-title-bar title="Billing Confirmation" />
      <div className="seo-wrap seo-grid">
        {configError ? <div className="error-box">{configError}</div> : null}
        {packResult?.error ? <div className="error-box">{packResult.error}</div> : null}

        {packResult ? (
          <div className="section-card" style={{ maxWidth: 560 }}>
            {packResult.granted || packResult.alreadyGranted ? (
              <>
                <h3 style={{ marginTop: 0 }}>⚡ +{packResult.tokensAdded ?? 100} AI Tokens Added!</h3>
                <p className="metric-help" style={{ marginTop: 8 }}>
                  Your bonus token package is active and never expires. Current available balance:{" "}
                  <strong>{packResult.availableCredits} tokens</strong>.
                </p>
                <div className="toolbar" style={{ marginTop: 16 }}>
                  <Link to={`/app/billing${location.search}`} className="seo-button">
                    View Token Balance
                  </Link>
                  <Link to={`/app/products${location.search}`} className="seo-button secondary">
                    Use AI on Products
                  </Link>
                </div>
              </>
            ) : (
              <>
                <h3 style={{ marginTop: 0 }}>Token package purchase not completed</h3>
                <p className="metric-help" style={{ marginTop: 8 }}>
                  The one-time token package payment was cancelled or is still pending confirmation.
                </p>
                <div className="toolbar" style={{ marginTop: 16 }}>
                  <Link to={`/app/billing${location.search}`} className="seo-button">
                    Return to Billing
                  </Link>
                </div>
              </>
            )}
          </div>
        ) : null}

        {!packResult ? (
          <div className="section-card" style={{ maxWidth: 560 }}>
            {isSubscribed ? (
              <>
                <h3 style={{ marginTop: 0 }}>
                  {isPro ? "🚀 Pro plan activated!" : "Subscription active"}
                </h3>
                <p className="metric-help" style={{ marginTop: 8 }}>
                  {hasTrial
                    ? `Your 7-day free trial has started. You'll be charged $12/month after the trial ends. Status: ${subscription?.status || "ACTIVE"}.`
                    : `Your Pro subscription is running. Status: ${subscription?.status || "ACTIVE"}.`}
                </p>
                {hasTrial && (
                  <p
                    className="metric-help"
                    style={{ color: "#4f82bb", marginTop: 8 }}
                  >
                    🎉 Trial days remaining: {subscription.trialDays}
                  </p>
                )}
                <div className="toolbar" style={{ marginTop: 16 }}>
                  <Link to={`/app${location.search}`} className="seo-button">
                    Go to Dashboard
                  </Link>
                </div>
              </>
            ) : (
              <>
                <h3 style={{ marginTop: 0 }}>No active subscription</h3>
                <p className="metric-help" style={{ marginTop: 8 }}>
                  It looks like you cancelled the billing confirmation. You can
                  choose a plan below.
                </p>
                <div className="toolbar" style={{ marginTop: 16 }}>
                  <Link
                    to={`/app/billing${location.search}`}
                    className="seo-button"
                  >
                    Choose a Plan
                  </Link>
                </div>
              </>
            )}
          </div>
        ) : null}
      </div>
    </>
  );
}
