import {
  Form,
  Link,
  redirect,
  useLoaderData,
  useNavigation,
  useActionData,
  useLocation,
  useSubmit,
} from "react-router";
import { useEffect } from "react";
import seoStyles from "../styles/seo.css?url";
import { TokenPricingAndCalculator } from "../components/token-pricing-calculator";
import { showToast } from "../components/toast-viewport";
import { requireShopContext } from "../services/route-context.server";
import {
  createCreditPackPurchase,
  createProSubscription,
  cancelAppSubscription,
  getActiveAppSubscriptions,
  getShopCurrencyCode,
  invalidateBillingCache,
} from "../services/billing.server";
import {
  CREDIT_COSTS,
  getCreditUsageHistory,
  getOrCreateCreditAccount,
  syncPlanSubscription,
} from "../services/credit-manager.server";
import {
  getEffectivePlatformAiSettings,
  getOrCreateStoreControl,
} from "../services/store-control.server";
import {
  DEFAULT_GEMINI_MODEL,
  formatGeminiModelName,
} from "../utils/gemini-models";
import {
  CREDIT_COSTS as CLIENT_CREDIT_COSTS,
  PLAN_ALLOWANCES,
  TOKEN_PACKAGES,
  getTokenPackageById,
} from "../utils/credits";

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
      hasSuperAccess: false,
      activeAiModelLabel: formatGeminiModelName(DEFAULT_GEMINI_MODEL),
      subscription: null,
      planName: null,
      creditAccount: null,
      creditCosts: CREDIT_COSTS,
      usageHistory: [],
    };
  }

  let activeSubscriptions = [];
  let billingLoadError = "";
  try {
    activeSubscriptions = await getActiveAppSubscriptions({
      admin,
      storeDomain: shop,
      token,
      apiVersion,
    });
  } catch (err) {
    billingLoadError = err?.message || "";
  }
  const subscription = activeSubscriptions[0] || null;
  const isSubscribed = Boolean(subscription);

  let creditAccount = null;
  let usageHistory = [];
  let storeControl = null;
  if (shop) {
    storeControl = await getOrCreateStoreControl(shop);
    const effectivePro = isSubscribed || Boolean(storeControl?.superAccess);
    creditAccount = await getOrCreateCreditAccount(shop, effectivePro ? "PRO" : "FREE");
    if (isSubscribed && creditAccount.plan !== "PRO") {
      await syncPlanSubscription(shop, true);
      creditAccount = await getOrCreateCreditAccount(shop, "PRO");
    }
    usageHistory = await getCreditUsageHistory(shop, 25);
  }

  const platformAi = await getEffectivePlatformAiSettings();

  return {
    configError: billingLoadError ? `Shopify billing status note: ${billingLoadError}` : "",
    isSubscribed,
    hasSuperAccess: Boolean(storeControl?.superAccess),
    activeAiModelLabel: formatGeminiModelName(platformAi.model || DEFAULT_GEMINI_MODEL),
    subscription,
    planName: subscription?.name || (isSubscribed || storeControl?.superAccess ? "Ecom SEO Pro" : "Ecom SEO Free"),
    creditAccount: creditAccount
      ? {
          plan: creditAccount.plan,
          totalCredits: creditAccount.totalCredits,
          bonusCredits: creditAccount.bonusCredits,
          availableCredits: creditAccount.availableCredits,
          effectiveTotal: creditAccount.effectiveTotal,
          usedCredits: creditAccount.usedCredits,
          percentUsed: creditAccount.percentUsed,
          cycleResetAt: creditAccount.cycleResetAt,
        }
      : null,
    creditCosts: CREDIT_COSTS,
    usageHistory,
  };
};

// ─── Action ────────────────────────────────────────────────────────────────────

export const action = async ({ request }) => {
  const formData = await request.formData();
  const intent = formData.get("intent"); // "trial" | "pro" | "cancel" | "buyPack"

  const url = new URL(request.url);

  if (intent !== "trial" && intent !== "pro" && intent !== "cancel" && intent !== "buyPack") {
    return redirect(`/app/billing${url.search}`);
  }

  const { admin, shop, token, apiVersion, configError } =
    await requireShopContext(request);
  if (configError) return { ok: false, error: configError };

  try {
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
      const control = shop ? await getOrCreateStoreControl(shop) : null;
      if (shop && !control?.superAccess) {
        await syncPlanSubscription(shop, false);
      }
      invalidateBillingCache(shop);
      return redirect(`/app/billing${url.search}`);
    }

    const returnUrl = `https://${shop}/admin/apps/${process.env.SHOPIFY_API_KEY}/app`;
    const test = process.env.SHOPIFY_BILLING_TEST === "true";

    const currencyCode = await getShopCurrencyCode({
      admin,
      storeDomain: shop,
      token,
      apiVersion,
    });

    if (intent === "buyPack") {
      const pkg = getTokenPackageById(formData.get("packageId"));
      const packReturnUrl = `https://${shop}/admin/apps/${process.env.SHOPIFY_API_KEY}/app/billing/return?package=${encodeURIComponent(pkg.id)}`;
      const { confirmationUrl } = await createCreditPackPurchase({
        admin,
        storeDomain: shop,
        token,
        apiVersion,
        returnUrl: packReturnUrl,
        currencyCode,
        amount: pkg.price,
        packName: pkg.packName,
        test,
      });
      return { externalRedirect: confirmationUrl };
    }

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
  } catch (error) {
    return {
      ok: false,
      error: error?.message || "Unable to complete Shopify billing request.",
    };
  }
};

// ─── UI ────────────────────────────────────────────────────────────────────────

const CREDIT_COST_ITEMS = [
  { key: "ai_chat", label: "AI Chat Reply", defaultCost: CLIENT_CREDIT_COSTS.ai_chat },
  { key: "image_compression", label: "Image Compression", defaultCost: CLIENT_CREDIT_COSTS.image_compression },
  { key: "product_seo_fix", label: "Title, Meta & Keyword Fix", defaultCost: CLIENT_CREDIT_COSTS.product_seo_fix },
  { key: "meta_fix", label: "Meta Tag AI Fix", defaultCost: CLIENT_CREDIT_COSTS.meta_fix },
  { key: "product_content_fix", label: "Description Fix (HTML)", defaultCost: CLIENT_CREDIT_COSTS.product_content_fix },
  { key: "product_seo_full", label: "Full SEO + Description", defaultCost: CLIENT_CREDIT_COSTS.product_seo_full },
  { key: "robots_txt_improvement", label: "AI Robots.txt Rules", defaultCost: CLIENT_CREDIT_COSTS.robots_txt_improvement },
  { key: "audit_change", label: "Gemini Diff Audit", defaultCost: CLIENT_CREDIT_COSTS.audit_change },
  { key: "vision_alt", label: "Vision Image ALT", defaultCost: CLIENT_CREDIT_COSTS.vision_alt },
  { key: "pagespeed_ai_fix", label: "PageSpeed AI Fix Plan", defaultCost: CLIENT_CREDIT_COSTS.pagespeed_ai_fix },
  { key: "catalog_cannibalization", label: "Cannibalization Resolver", defaultCost: CLIENT_CREDIT_COSTS.catalog_cannibalization },
  { key: "store_copilot", label: "Executive Copilot Brief", defaultCost: CLIENT_CREDIT_COSTS.store_copilot },
];

export default function BillingPage() {
  const {
    configError,
    isSubscribed,
    hasSuperAccess,
    activeAiModelLabel,
    subscription,
    planName,
    creditAccount,
    creditCosts = {},
    usageHistory,
  } = useLoaderData();
  const navigation = useNavigation();
  const submitting = navigation.state === "submitting";
  const actionData = useActionData();
  const location = useLocation();
  const submit = useSubmit();
  const submittingIntent = navigation.formData?.get("intent");
  const submittingPackageId = navigation.formData?.get("packageId");

  useEffect(() => {
    if (actionData && actionData.externalRedirect) {
      (window.top || window).location.href = actionData.externalRedirect;
    } else if (actionData?.error) {
      showToast({
        tone: "error",
        title: "Billing Notice",
        message: actionData.error,
      });
    }
  }, [actionData]);

  const isPro = isSubscribed && planName === PLAN_PRO;
  const hasTrial = isPro && (subscription?.trialDays ?? 0) > 0;
  const status = subscription?.status || (isSubscribed ? "ACTIVE" : "FREE");
  const available = creditAccount?.availableCredits ?? 0;
  const effectiveTotal = creditAccount?.effectiveTotal ?? PLAN_ALLOWANCES.FREE;
  const baseQuota = creditAccount?.totalCredits ?? PLAN_ALLOWANCES.FREE;
  const bonusCredits = creditAccount?.bonusCredits ?? 0;
  const usedCredits = creditAccount?.usedCredits ?? 0;
  const percentUsed = creditAccount?.percentUsed ?? 0;
  const remainingPercent = effectiveTotal > 0 ? Math.max(0, Math.min(100, Math.round((available / effectiveTotal) * 100))) : 0;

  return (
    <>
      <ui-title-bar title="Subscription" />
      <div className="seo-wrap seo-grid">
        <section className="workspace-header-card">
          <div className="workspace-header-top">
            <div style={{ display: "grid", gap: 4 }}>
              <h1 className="page-title" style={{ fontSize: 20 }}>
                Billing &amp; AI Token Hub
              </h1>
              <p className="seo-muted" style={{ fontSize: 13 }}>
                Monitor monthly AI token allowances, non-expiring top-up packages, per-action token costs, and usage logs.
              </p>
            </div>
            <div className="button-row">
              <Link to={`/app${location.search}`} className="seo-button secondary" style={{ padding: "6px 12px", fontSize: 12 }}>
                ← Home Checklist
              </Link>
              <Link to={`/app/seo-audit${location.search}`} className="seo-button" style={{ padding: "6px 12px", fontSize: 12 }}>
                AI Audit &amp; Auto-Fix
              </Link>
            </div>
          </div>
        </section>

        {configError ? <div className="error-box">{configError}</div> : null}
        {actionData?.error ? <div className="error-box">{actionData.error}</div> : null}

        {/* ─── AI Credit Economy Hub ─── */}
        <div className="section-card">
          <div className="toolbar" style={{ justifyContent: "space-between", marginBottom: 14 }}>
            <div>
              <h3 style={{ margin: 0, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span>⚡ AI Token Balance</span>
                <span className={`pill ${hasSuperAccess || creditAccount?.plan === "PRO" ? "pill-good" : "pill-info"}`}>
                  {hasSuperAccess
                    ? "SUPER ACCESS (UNLIMITED)"
                    : creditAccount?.plan === "PRO"
                      ? isSubscribed
                        ? "PRO PLAN"
                        : "PRO QUOTA"
                      : "FREE PLAN"}
                </span>
              </h3>
              <p className="metric-help" style={{ margin: "4px 0 0 0" }}>
                {hasSuperAccess
                  ? "Administrator Super Access is enabled for this store — AI tools run without consuming tokens."
                  : "AI actions deduct tokens based on prompt & model effort. Monthly allowances replenish automatically; purchased token packages never expire."}
              </p>
            </div>
            <div style={{ textAlign: "right" }}>
              <h2 style={{ margin: 0, color: hasSuperAccess ? "#4338ca" : "var(--seo-primary)" }}>
                {hasSuperAccess ? (
                  "Unlimited"
                ) : (
                  <>
                    {available}{" "}
                    <span style={{ fontSize: 14, color: "var(--seo-muted)" }}>/ {effectiveTotal}</span>
                  </>
                )}
              </h2>
              <small style={{ color: "var(--seo-muted)" }}>
                {hasSuperAccess ? "Super Access Active" : `${usedCredits} used (${percentUsed}%) this cycle`}
              </small>
            </div>
          </div>

          <div
            style={{
              background: "var(--seo-border-soft)",
              borderRadius: 6,
              height: 10,
              overflow: "hidden",
              marginBottom: 16,
            }}
            title={
              hasSuperAccess
                ? "Unlimited AI usage via Super Access"
                : `${available} of ${effectiveTotal} credits remaining (${remainingPercent}%)`
            }
          >
            <div
              style={{
                width: `${hasSuperAccess ? 100 : remainingPercent}%`,
                background: hasSuperAccess
                  ? "#4f46e5"
                  : available <= 3
                    ? "var(--seo-bad)"
                    : percentUsed > 85
                      ? "#d97706"
                      : "var(--seo-primary)",
                height: "100%",
                transition: "width 0.3s ease",
              }}
            />
          </div>

          <div className="seo-grid grid-4" style={{ marginBottom: 16 }}>
            <div className="metric-card" style={{ padding: 12 }}>
              <p className="metric-label" style={{ fontSize: 11 }}>Available Now</p>
              <h4 style={{ margin: "4px 0 0 0", color: hasSuperAccess ? "#4338ca" : "var(--seo-primary)" }}>
                {hasSuperAccess ? "Unlimited ★" : `${available} tok`}
              </h4>
            </div>
            <div className="metric-card" style={{ padding: 12 }}>
              <p className="metric-label" style={{ fontSize: 11 }}>Used This Cycle</p>
              <h4 style={{ margin: "4px 0 0 0" }}>{usedCredits} tok</h4>
            </div>
            <div className="metric-card" style={{ padding: 12 }}>
              <p className="metric-label" style={{ fontSize: 11 }}>Monthly + Bonus Quota</p>
              <h4 style={{ margin: "4px 0 0 0", fontSize: 14 }}>
                {baseQuota} {bonusCredits > 0 ? <span style={{ color: "var(--seo-good)" }}>+ {bonusCredits} bonus</span> : ""}
              </h4>
            </div>
            <div className="metric-card" style={{ padding: 12 }}>
              <p className="metric-label" style={{ fontSize: 11 }}>Replenishes · Model</p>
              <h4 style={{ margin: "4px 0 0 0", fontSize: 12.5 }}>
                {creditAccount?.cycleResetAt ? new Date(creditAccount.cycleResetAt).toLocaleDateString() : "Next month"} · {activeAiModelLabel || "Gemini"}
              </h4>
            </div>
          </div>

          <div style={{ background: "var(--seo-bg-accent)", padding: "12px 14px", borderRadius: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: "var(--seo-ink)" }}>
              Token Cost Per AI Action:
            </div>
            <div className="credit-cost-grid">
              {CREDIT_COST_ITEMS.map((item) => {
                const cost = creditCosts[item.key] ?? item.defaultCost;
                return (
                  <span key={item.key} className="credit-cost-chip">
                    <span>{item.label}</span>
                    <strong>{cost} tok</strong>
                  </span>
                );
              })}
            </div>
          </div>
        </div>

        {/* ─── Interactive Token Calculator & Pricing List ─── */}
        <TokenPricingAndCalculator
          id="token-calculator"
          creditAccount={creditAccount}
          hasSuperAccess={hasSuperAccess}
          onBillingPage={true}
          onSelectTopUp={
            !hasSuperAccess
              ? (pkg) => submit({ intent: "buyPack", packageId: pkg.id }, { method: "post" })
              : null
          }
          locationSearch={location.search}
        />

        {/* ─── One-Time AI Token Top-Up Packages ─── */}
        {!hasSuperAccess ? (
          <div id="packages" className="section-card">
            <div className="toolbar" style={{ justifyContent: "space-between", marginBottom: 14 }}>
              <div>
                <h4 style={{ margin: 0 }}>⚡ Need extra AI Tokens?</h4>
                <p className="metric-help" style={{ margin: "4px 0 0 0" }}>
                  Choose a one-time top-up package. Purchased tokens never expire and stack on top of your monthly allowance.
                </p>
              </div>
              <span className="pill pill-info">Non-expiring top-ups</span>
            </div>

            <div className="seo-grid grid-3" style={{ gap: 14 }}>
              {TOKEN_PACKAGES.map((pkg) => {
                const isBuyingThis = submitting && submittingIntent === "buyPack" && submittingPackageId === pkg.id;
                return (
                  <div
                    key={pkg.id}
                    className="metric-card"
                    style={{
                      padding: 18,
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      gap: 12,
                      border: pkg.featured ? "2px solid var(--seo-primary)" : "1px solid var(--seo-border-soft)",
                      background: pkg.featured ? "var(--seo-bg-accent)" : "#fff",
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 8 }}>
                        <span className={`pill ${pkg.featured ? "pill-good" : "pill-info"}`} style={{ fontSize: 11 }}>
                          {pkg.tag}
                        </span>
                        <span style={{ fontSize: 11, color: "var(--seo-muted)" }}>{pkg.pricePerToken}</span>
                      </div>
                      <div style={{ fontSize: 22, fontWeight: 700, color: "var(--seo-ink)" }}>
                        +{pkg.tokens} Tokens
                      </div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: "var(--seo-primary)", marginTop: 4 }}>
                        ${pkg.price}{" "}
                        <span style={{ fontSize: 12, fontWeight: 400, color: "var(--seo-muted)" }}>one-time</span>
                      </div>
                    </div>

                    <Form method="post">
                      <input type="hidden" name="intent" value="buyPack" />
                      <input type="hidden" name="packageId" value={pkg.id} />
                      <button
                        type="submit"
                        className={`seo-button${pkg.featured ? "" : " secondary"}`}
                        disabled={submitting}
                        style={{ width: "100%" }}
                      >
                        {isBuyingThis ? "Redirecting…" : `Buy ${pkg.tokens} Tokens ($${pkg.price})`}
                      </button>
                    </Form>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        {/* ─── Plan Management ─── */}
        {hasSuperAccess && !isSubscribed ? (
          <div className="section-card" style={{ borderColor: "#c7d2fe", background: "#f8faff" }}>
            <div className="toolbar" style={{ justifyContent: "space-between", margin: 0 }}>
              <div>
                <h3 style={{ margin: 0, color: "#3730a3" }}>★ Super Access Active</h3>
                <p className="metric-help" style={{ margin: "6px 0 0 0" }}>
                  Your store has Administrator Super Access enabled, giving unlimited access to all AI SEO fixes, Gemini Vision ALT optimization, Diff Audit, and Autopilot without token deductions.
                </p>
              </div>
              <Link to={`/app${location.search}`} className="seo-button">Dashboard</Link>
            </div>
          </div>
        ) : isSubscribed ? (
          <div className="plan-active-card" style={{ maxWidth: "100%" }}>
            <div className="plan-header">
              <span className="plan-icon">🚀</span>
              <h2 className="plan-active-name">Ecom SEO Pro Active</h2>
            </div>
            <hr className="plan-divider" />
            <div className="plan-status-row">
              <span className={`plan-status-pill ${hasTrial ? "trial" : "active"}`}>
                {hasTrial ? `Trial — ${subscription.trialDays} days left` : status}
              </span>
              <p className="metric-help" style={{ margin: 0 }}>$12 / month ({baseQuota} AI Tokens / mo)</p>
            </div>
            <p className="metric-help">
              You have an active Pro subscription with {baseQuota} monthly AI tokens and unlimited catalog scanning.
            </p>
            <div className="toolbar" style={{ gap: 12 }}>
              <Link to={`/app${location.search}`} className="seo-button">Dashboard</Link>
              <Form method="post">
                <input type="hidden" name="intent" value="cancel" />
                <button
                  type="submit"
                  className="seo-button"
                  style={{ backgroundColor: "#d9534f", borderColor: "#d43f3a" }}
                  disabled={submitting}
                >
                  {submitting && submittingIntent === "cancel" ? "Canceling..." : "Cancel Subscription"}
                </button>
              </Form>
            </div>
          </div>
        ) : creditAccount?.plan === "PRO" ? (
          <div className="plan-active-card" style={{ maxWidth: "100%" }}>
            <div className="plan-header">
              <span className="plan-icon">🚀</span>
              <h2 className="plan-active-name">Pro Token Quota Active</h2>
            </div>
            <hr className="plan-divider" />
            <div className="plan-status-row">
              <span className="plan-status-pill active">ADMIN MANAGED PRO</span>
              <p className="metric-help" style={{ margin: 0 }}>
                {baseQuota} Monthly AI Tokens{bonusCredits > 0 ? ` + ${bonusCredits} Bonus Tokens` : ""}
              </p>
            </div>
            <p className="metric-help">
              Your store is already provisioned on the PRO token tier by an administrator.
            </p>
            <div className="toolbar" style={{ gap: 12 }}>
              <Link to={`/app${location.search}`} className="seo-button">Dashboard</Link>
              <Link to={`/app/products${location.search}`} className="seo-button secondary">Optimize Products</Link>
            </div>
          </div>
        ) : (
          <div className="section-card" style={{ padding: 0, overflow: "hidden", border: "2px solid var(--seo-primary)" }}>
            <div className="seo-grid grid-2" style={{ gap: 0 }}>
              <div style={{ padding: "32px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
                <span className="pill pill-info" style={{ alignSelf: "flex-start", marginBottom: 12, background: "var(--seo-primary)", color: "#fff" }}>
                  7 Days Free Trial
                </span>
                <h3 style={{ margin: "0 0 8px 0", fontSize: "26px", color: "var(--seo-ink)" }}>Upgrade to Ecom SEO Pro</h3>
                <p style={{ margin: 0, fontSize: "30px", fontWeight: "700", color: "var(--seo-primary)" }}>
                  $12 <span style={{ fontSize: "15px", fontWeight: "normal", color: "var(--seo-muted)" }}>/ month</span>
                </p>
                <p className="metric-help" style={{ marginTop: "12px", fontSize: "14px" }}>
                  Get {PLAN_ALLOWANCES.PRO} AI tokens every month, automated 301 URL redirect safety, multimodal vision image alt optimizer, and unlimited store audits.
                </p>

                <div className="plan-cta" style={{ marginTop: 20 }}>
                  <Form method="post">
                    <input type="hidden" name="intent" value="trial" />
                    <button
                      className="seo-button"
                      type="submit"
                      disabled={submitting}
                      style={{ width: "100%", padding: "14px", fontSize: "16px" }}
                    >
                      {submitting && submittingIntent === "trial" ? "Redirecting to Shopify…" : `Start 7-Day Free Trial (${PLAN_ALLOWANCES.PRO} Tokens/mo)`}
                    </button>
                  </Form>
                  <p className="metric-help" style={{ fontSize: "12px", textAlign: "center", marginTop: "10px" }}>
                    Auto-renews at $12/mo after trial. Cancel anytime with one click.
                  </p>
                </div>
              </div>

              <div style={{ padding: "32px", background: "var(--seo-bg-accent)", borderLeft: "1px solid var(--seo-border-soft)" }}>
                <h4 style={{ margin: "0 0 16px 0", fontSize: "15px" }}>Pro Plan Features:</h4>
                <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "12px" }}>
                  <li style={{ display: "flex", gap: "8px", fontSize: "13px" }}>
                    <span style={{ color: "var(--seo-primary)", fontWeight: "bold" }}>✓</span> <strong>{PLAN_ALLOWANCES.PRO} Monthly AI Tokens</strong> (vs {PLAN_ALLOWANCES.FREE} Free)
                  </li>
                  <li style={{ display: "flex", gap: "8px", fontSize: "13px" }}>
                    <span style={{ color: "var(--seo-primary)", fontWeight: "bold" }}>✓</span> <strong>Gemini Diff Doctor</strong> (Before/After SEO Change Audit)
                  </li>
                  <li style={{ display: "flex", gap: "8px", fontSize: "13px" }}>
                    <span style={{ color: "var(--seo-primary)", fontWeight: "bold" }}>✓</span> <strong>Multimodal Vision AI</strong> for Product Image ALTs
                  </li>
                  <li style={{ display: "flex", gap: "8px", fontSize: "13px" }}>
                    <span style={{ color: "var(--seo-primary)", fontWeight: "bold" }}>✓</span> <strong>Automatic 301 URL Redirects</strong> on handle updates
                  </li>
                  <li style={{ display: "flex", gap: "8px", fontSize: "13px" }}>
                    <span style={{ color: "var(--seo-primary)", fontWeight: "bold" }}>✓</span> Unlimited Catalog Scans &amp; Export
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* ─── Recent AI Token Usage Logs ─── */}
        <div id="usage" className="section-card">
          <div className="toolbar" style={{ justifyContent: "space-between", marginBottom: 12 }}>
            <h4 style={{ margin: 0 }}>Recent AI Token Usage</h4>
            <small style={{ color: "var(--seo-muted)" }}>Transparent per-action deduction log</small>
          </div>

          {!usageHistory?.length ? (
            <p className="metric-help" style={{ margin: 0 }}>No AI tokens used yet. Try AI Fix or Change Audit on any product.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="credit-usage-table">
                <thead>
                  <tr>
                    <th>Date &amp; Time</th>
                    <th>Action</th>
                    <th>Product</th>
                    <th>Deduction</th>
                    <th>Model</th>
                  </tr>
                </thead>
                <tbody>
                  {usageHistory.map((log) => (
                    <tr key={log.id}>
                      <td>{new Date(log.createdAt).toLocaleString()}</td>
                      <td>
                        <span className="pill pill-info" style={{ fontSize: 11 }}>
                          {log.actionType.replace(/_/g, " ").toUpperCase()}
                        </span>
                      </td>
                      <td>{log.productTitle || log.productId || "-"}</td>
                      <td
                        style={{
                          fontWeight: 700,
                          color:
                            log.creditsDeducted < 0
                              ? "var(--seo-good)"
                              : log.creditsDeducted === 0
                                ? "#4338ca"
                                : "var(--seo-primary-strong)",
                        }}
                      >
                        {log.creditsDeducted < 0
                          ? `+${Math.abs(log.creditsDeducted)} tokens`
                          : log.creditsDeducted === 0
                            ? "0 tok (Super Access)"
                            : `-${log.creditsDeducted} token${log.creditsDeducted > 1 ? "s" : ""}`}
                      </td>
                      <td style={{ fontSize: 11, color: "var(--seo-muted)" }}>{log.modelUsed}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
