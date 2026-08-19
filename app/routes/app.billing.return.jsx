import { Link, useLoaderData, useLocation } from "react-router";
import seoStyles from "../styles/seo.css?url";
import { requireShopContext } from "../services/route-context.server";
import { getActiveAppSubscriptions } from "../services/billing.server";

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
    };
  }

  const activeSubscriptions = await getActiveAppSubscriptions({
    admin,
    storeDomain: shop,
    token,
    apiVersion,
  });
  const subscription = activeSubscriptions[0] || null;
  const planName = subscription?.name || null;

  return {
    configError: "",
    isSubscribed: Boolean(subscription),
    subscription,
    planName,
  };
};

export default function BillingReturnPage() {
  const { configError, isSubscribed, subscription, planName } = useLoaderData();
  const location = useLocation();
  const isPro = planName === PLAN_PRO;
  const hasTrial = isPro && (subscription?.trialDays ?? 0) > 0;

  return (
    <s-page full-width="true" heading="Billing Confirmation">
      <div className="seo-wrap seo-grid">
        {configError ? <div className="error-box">{configError}</div> : null}

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
      </div>
    </s-page>
  );
}
