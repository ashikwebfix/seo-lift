import {
  Form,
  Link,
  redirect,
  useLoaderData,
  useNavigation,
  useActionData,
  useLocation,
} from "react-router";
import { useEffect } from "react";
import seoStyles from "../styles/seo.css?url";
import { requireShopContext } from "../services/route-context.server";
import {
  createProSubscription,
  cancelAppSubscription,
  getActiveAppSubscriptions,
  getShopCurrencyCode,
} from "../services/billing.server";

const PLAN_PRO = "Ecom SEO Pro";

export const links = () => [{ rel: "stylesheet", href: seoStyles }];

// ─── Loader ────────────────────────────────────────────────────────────────────

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

  return {
    configError: "",
    isSubscribed: Boolean(subscription),
    subscription,
    planName: subscription?.name || null,
  };
};

// ─── Action ────────────────────────────────────────────────────────────────────

export const action = async ({ request }) => {
  const formData = await request.formData();
  const intent = formData.get("intent"); // "trial" | "pro"

  const url = new URL(request.url);

  if (intent !== "trial" && intent !== "pro" && intent !== "cancel") {
    return redirect(`/app/billing${url.search}`);
  }

  const { auth, admin, shop, token, apiVersion, configError } =
    await requireShopContext(request);
  if (configError) return { ok: false, error: configError };

  if (intent === "cancel") {
    const activeSubscriptions = await getActiveAppSubscriptions({
      admin,
      storeDomain: shop,
      token,
      apiVersion,
    });
    const subscription = activeSubscriptions[0];
    if (subscription) {
      await cancelAppSubscription({
        admin,
        storeDomain: shop,
        token,
        apiVersion,
        subscriptionId: subscription.id,
      });
    }
    return redirect(`/app/billing${url.search}`);
  }

  const returnUrl = `https://${shop}/admin/apps/${process.env.SHOPIFY_API_KEY}/app`;
  const test = false;

  const currencyCode = await getShopCurrencyCode({
    admin,
    storeDomain: shop,
    token,
    apiVersion,
  });

  if (intent === "trial") {
    const { confirmationUrl } = await createProSubscription({
      admin,
      storeDomain: shop,
      token,
      apiVersion,
      returnUrl,
      currencyCode,
      trialDays: 7,
      test,
    });
    return { externalRedirect: confirmationUrl };
  }

  const { confirmationUrl } = await createProSubscription({
    admin,
    storeDomain: shop,
    token,
    apiVersion,
    returnUrl,
    currencyCode,
    trialDays: 0,
    test,
  });
  return { externalRedirect: confirmationUrl };
};

// ─── UI ────────────────────────────────────────────────────────────────────────

export default function BillingPage() {
  const { configError, isSubscribed, subscription, planName } = useLoaderData();
  const navigation = useNavigation();
  const submitting = navigation.state === "submitting";
  const actionData = useActionData();
  const location = useLocation();
  const submittingIntent = navigation.formData?.get("intent");

  useEffect(() => {
    if (actionData && actionData.externalRedirect) {
      window.top.location.href = actionData.externalRedirect;
    }
  }, [actionData]);

  // ── Active subscription view ──────────────────────────────────────────────
  if (isSubscribed) {
    const isPro = planName === PLAN_PRO;
    const hasTrial = isPro && (subscription?.trialDays ?? 0) > 0;
    const status = subscription?.status || "ACTIVE";

    return (
      <>
      <ui-title-bar title="Billing & Plan" />
        <div className="seo-wrap seo-grid">
          {configError ? <div className="error-box">{configError}</div> : null}

          <div className="plan-active-card">
            <div className="plan-header">
              <span className="plan-icon">🚀</span>
              <h2 className="plan-active-name">Ecom SEO Pro</h2>
            </div>

            <hr className="plan-divider" />

            <div className="plan-status-row">
              <span
                className={`plan-status-pill ${hasTrial ? "trial" : "active"}`}
              >
                {hasTrial
                  ? `Trial — ${subscription.trialDays} days left`
                  : status}
              </span>
              <p className="metric-help" style={{ margin: 0 }}>
                $12 / month
              </p>
            </div>

            <p className="metric-help">
              {hasTrial
                ? "Your 7-day free trial is active. No charge until the trial ends. You can cancel anytime from the Shopify billing page."
                : "You have an active Pro subscription. All features are unlocked."}
            </p>

            <div className="toolbar" style={{ gap: 12 }}>
              <Link to={`/app${location.search}`} className="seo-button">
                Go to Dashboard
              </Link>
              <Form method="post">
                <input type="hidden" name="intent" value="cancel" />
                <button
                  type="submit"
                  className="seo-button"
                  style={{ backgroundColor: "#d9534f", borderColor: "#d43f3a" }}
                  disabled={submitting}
                >
                  {submitting && submittingIntent === "cancel"
                    ? "Canceling..."
                    : "Cancel Subscription"}
                </button>
              </Form>
            </div>
          </div>
        </div>
          </>
    );
  }

  // ── Plan picker ───────────────────────────────────────────────────────────
  return (
    <>
      <ui-title-bar title="Choose Your Plan" />
      <div className="seo-wrap">
        {configError ? <div className="error-box" style={{ marginBottom: "16px" }}>{configError}</div> : null}

        <div className="section-card" style={{ maxWidth: "800px", margin: "24px auto", padding: "0", overflow: "hidden", border: "2px solid var(--seo-primary)" }}>
          <div className="seo-grid grid-2" style={{ gap: 0 }}>
            {/* ── Left Side: Pricing & CTA ── */}
            <div style={{ padding: "32px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
              <div style={{ marginBottom: "24px" }}>
                <span className="pill pill-info" style={{ marginBottom: "12px", background: "var(--seo-primary)", color: "#fff" }}>7 Days Free Trial</span>
                <h3 style={{ margin: "0 0 8px 0", fontSize: "28px", color: "var(--seo-ink)" }}>Ecom SEO Pro</h3>
                <p style={{ margin: 0, fontSize: "32px", fontWeight: "700", color: "var(--seo-primary)" }}>
                  $12 <span style={{ fontSize: "16px", fontWeight: "normal", color: "var(--seo-muted)" }}>/ month</span>
                </p>
                <p className="metric-help" style={{ marginTop: "12px", fontSize: "14px" }}>
                  Unlock all advanced SEO features and boost your store's traffic. Cancel anytime.
                </p>
              </div>

              <div className="plan-cta">
                <Form method="post">
                  <input type="hidden" name="intent" value="trial" />
                  <button
                    className="seo-button"
                    type="submit"
                    disabled={submitting}
                    style={{ width: "100%", padding: "14px", fontSize: "16px" }}
                  >
                    {submitting && submittingIntent === "trial"
                      ? "Redirecting to Shopify…"
                      : "Start 7-Day Free Trial"}
                  </button>
                </Form>
                <p className="metric-help" style={{ fontSize: "12px", textAlign: "center", marginTop: "12px" }}>
                  Auto-renews at $12/mo after your 7-day trial.
                </p>
              </div>
            </div>

            {/* ── Right Side: Features ── */}
            <div style={{ padding: "32px", background: "var(--seo-bg-accent)", borderLeft: "1px solid var(--seo-border-soft)" }}>
              <h4 style={{ margin: "0 0 20px 0", fontSize: "16px", color: "var(--seo-ink)" }}>Everything you need:</h4>
              <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "14px" }}>
                <li style={{ display: "flex", gap: "10px", alignItems: "flex-start", color: "var(--seo-ink)", fontSize: "14px" }}>
                  <span style={{ color: "var(--seo-primary)", fontWeight: "bold" }}>✓</span> Unlimited product SEO editing
                </li>
                <li style={{ display: "flex", gap: "10px", alignItems: "flex-start", color: "var(--seo-ink)", fontSize: "14px" }}>
                  <span style={{ color: "var(--seo-primary)", fontWeight: "bold" }}>✓</span> Bulk meta title &amp; description editor
                </li>
                <li style={{ display: "flex", gap: "10px", alignItems: "flex-start", color: "var(--seo-ink)", fontSize: "14px" }}>
                  <span style={{ color: "var(--seo-primary)", fontWeight: "bold" }}>✓</span> Image ALT text optimizer
                </li>
                <li style={{ display: "flex", gap: "10px", alignItems: "flex-start", color: "var(--seo-ink)", fontSize: "14px" }}>
                  <span style={{ color: "var(--seo-primary)", fontWeight: "bold" }}>✓</span> URL handle optimization
                </li>
                <li style={{ display: "flex", gap: "10px", alignItems: "flex-start", color: "var(--seo-ink)", fontSize: "14px" }}>
                  <span style={{ color: "var(--seo-primary)", fontWeight: "bold" }}>✓</span> AI-powered SEO fix suggestions
                </li>
                <li style={{ display: "flex", gap: "10px", alignItems: "flex-start", color: "var(--seo-ink)", fontSize: "14px" }}>
                  <span style={{ color: "var(--seo-primary)", fontWeight: "bold" }}>✓</span> Priority support
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
        </>
  );
}
