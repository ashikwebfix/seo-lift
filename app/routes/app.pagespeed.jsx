/* eslint-disable react/prop-types */
import { useEffect, useMemo, useState } from "react";
import { Link, useFetcher, useLoaderData, useSearchParams } from "react-router";
import seoStyles from "../styles/seo.css?url";
import { StatusPill, WorkspaceSubnav, dispatchCreditsUpdate } from "../components/seo-ui";
import { showToast } from "../components/toast-viewport";
import { getAppState, updateAppState } from "../services/app-state.server";
import { getOrCreateCreditAccount } from "../services/credit-manager.server";
import {
  extractProductHandleFromUrl,
  normalizePageSpeedTargetUrl,
  runLivePageSpeedTest,
} from "../services/pagespeed.server";
import { requireShopContext } from "../services/route-context.server";
import { mapShopifyProductToSeoRow } from "../mappers/product.mapper";
import { runAiAutoFixProducts, saveProductSeoAndRescan } from "../services/seo-workflows.server";
import { fetchProductByHandle, fetchProductById, fetchProducts } from "../services/shopify-admin.server";
import {
  checkStoreRouteAccess,
  getEffectivePageSpeedConfig,
  getEffectivePlatformAiSettings,
  getOrCreateStoreControl,
} from "../services/store-control.server";
import { CREDIT_COSTS, PLAN_ALLOWANCES } from "../utils/credits";
import { AI_FEATURES_ENABLED } from "../utils/feature-flags";

export const links = () => [{ rel: "stylesheet", href: seoStyles }];

function toCompactHistoryEntry(report) {
  if (!report) return null;
  return {
    testedAt: report.fetchTime || new Date().toISOString(),
    url: report.testedUrl,
    strategy: report.strategy,
    performance: report.scores?.performance ?? null,
    seo: report.scores?.seo ?? null,
    accessibility: report.scores?.accessibility ?? null,
    bestPractices: report.scores?.bestPractices ?? null,
    lcp: report.metrics?.lcp?.displayValue || "N/A",
    cls: report.metrics?.cls?.displayValue || "N/A",
    passwordProtected: Boolean(report.passwordProtected),
  };
}

async function resolveMatchedProduct({ shop, token, apiVersion, appState, targetUrl }) {
  const handle = extractProductHandleFromUrl(targetUrl);
  if (!handle || !token || !shop) return null;
  try {
    const product = await fetchProductByHandle({
      storeDomain: shop,
      token,
      apiVersion,
      handle,
    });
    if (!product) return null;
    const savedSeo = appState?.productSeo?.[String(product.id)] || {};
    return mapShopifyProductToSeoRow(product, savedSeo);
  } catch {
    return null;
  }
}

export const loader = async ({ request }) => {
  const { configError, shop, token, apiVersion } = await requireShopContext(request);
  if (configError || !shop) {
    return {
      configError,
      shop: shop || "",
      defaultUrl: "",
      pageSpeed: {
        lastTestedUrl: "",
        lastTestedAt: null,
        mobile: null,
        desktop: null,
        history: [],
        lastAiPlan: null,
        completedManualIds: [],
      },
      sampleProducts: [],
      matchedProduct: null,
      creditAccount: { availableCredits: 0, effectiveTotal: PLAN_ALLOWANCES.FREE, plan: "FREE" },
      hasSuperAccess: false,
      aiReady: false,
      aiUnavailableReason: configError || "Shop session required.",
      hasPageSpeedKey: false,
    };
  }

  const [appState, creditAccount, storeControl, platformAi, aiAccess, pageSpeedCfg, productList] =
    await Promise.all([
      getAppState(shop),
      getOrCreateCreditAccount(shop),
      getOrCreateStoreControl(shop),
      getEffectivePlatformAiSettings(),
      checkStoreRouteAccess(shop, "ai_features"),
      getEffectivePageSpeedConfig(),
      token
        ? fetchProducts({
            storeDomain: shop,
            token,
            apiVersion,
            limit: 10,
            includeDescription: false,
          }).catch(() => ({ products: [] }))
        : Promise.resolve({ products: [] }),
    ]);

  const defaultUrl = appState?.pageSpeed?.lastTestedUrl || `https://${shop}`;
  const sampleProducts = (productList?.products || []).map((p) => ({
    id: String(p.id),
    title: String(p.title || ""),
    handle: String(p.handle || ""),
    url: `https://${shop}/products/${p.handle}`,
  }));

  const matchedProduct = await resolveMatchedProduct({
    shop,
    token,
    apiVersion,
    appState,
    targetUrl: defaultUrl,
  });

  const hasSuperAccess = Boolean(storeControl?.superAccess);
  const aiReady =
    AI_FEATURES_ENABLED &&
    Boolean(platformAi.isEnabled) &&
    Boolean(platformAi.apiKey) &&
    Boolean(aiAccess?.allowed);

  let aiUnavailableReason = "";
  if (!AI_FEATURES_ENABLED) aiUnavailableReason = "AI features are turned off.";
  else if (!platformAi.isEnabled) aiUnavailableReason = "Platform Gemini AI is paused by SuperAdmin.";
  else if (!platformAi.apiKey) aiUnavailableReason = "Gemini API key is not configured in SuperAdmin.";
  else if (!aiAccess?.allowed) aiUnavailableReason = aiAccess?.reason || "AI access restricted for this store.";

  return {
    configError: "",
    shop,
    defaultUrl,
    pageSpeed: appState.pageSpeed,
    sampleProducts,
    matchedProduct,
    creditAccount: {
      availableCredits: creditAccount.availableCredits,
      effectiveTotal: creditAccount.effectiveTotal,
      plan: creditAccount.plan,
    },
    hasSuperAccess,
    aiReady,
    aiUnavailableReason,
    hasPageSpeedKey: Boolean(pageSpeedCfg?.apiKey),
  };
};

export const action = async ({ request }) => {
  const { shop, token, apiVersion, configError } = await requireShopContext(request);
  if (configError || !shop) {
    return { ok: false, error: configError || "Shop session required." };
  }

  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");

  if (intent === "runTest") {
    const rawTargetUrl = String(formData.get("targetUrl") || "").trim();
    const strategyMode = String(formData.get("strategy") || "mobile").toLowerCase();

    try {
      const normalizedUrl = normalizePageSpeedTargetUrl(shop, rawTargetUrl);
      const pageSpeedCfg = await getEffectivePageSpeedConfig();
      const apiKey = pageSpeedCfg?.apiKey || "";

      const [mobileReport, desktopReport] =
        strategyMode === "both"
          ? await Promise.all([
              runLivePageSpeedTest({ url: normalizedUrl, shop, strategy: "mobile", apiKey }),
              runLivePageSpeedTest({ url: normalizedUrl, shop, strategy: "desktop", apiKey }),
            ])
          : strategyMode === "desktop"
            ? [null, await runLivePageSpeedTest({ url: normalizedUrl, shop, strategy: "desktop", apiKey })]
            : [await runLivePageSpeedTest({ url: normalizedUrl, shop, strategy: "mobile", apiKey }), null];

      const testedAt = new Date().toISOString();
      const newHistoryItems = [
        toCompactHistoryEntry(mobileReport),
        toCompactHistoryEntry(desktopReport),
      ].filter(Boolean);

      const nextState = await updateAppState(shop, (current) => {
        const prevPs = current.pageSpeed || {};
        const urlChanged = prevPs.lastTestedUrl && prevPs.lastTestedUrl !== normalizedUrl;
        const mergedHistory = [...newHistoryItems, ...(Array.isArray(prevPs.history) ? prevPs.history : [])].slice(
          0,
          15,
        );

        return {
          ...current,
          pageSpeed: {
            ...prevPs,
            lastTestedUrl: normalizedUrl,
            lastTestedAt: testedAt,
            mobile: mobileReport || (urlChanged ? null : prevPs.mobile),
            desktop: desktopReport || (urlChanged ? null : prevPs.desktop),
            history: mergedHistory,
            lastAiPlan: urlChanged ? null : prevPs.lastAiPlan || null,
          },
        };
      });

      const matchedProduct = await resolveMatchedProduct({
        shop,
        token,
        apiVersion,
        appState: nextState,
        targetUrl: normalizedUrl,
      });

      return {
        ok: true,
        intent: "runTest",
        testedStrategy: strategyMode,
        pageSpeed: nextState.pageSpeed,
        matchedProduct,
      };
    } catch (error) {
      return {
        ok: false,
        intent: "runTest",
        error: error?.message || "Failed to run live Google PageSpeed Insights test.",
      };
    }
  }

  if (intent === "toggleManualCheck") {
    const checkId = String(formData.get("checkId") || "").trim();
    const completed = formData.get("completed") === "true";
    if (!checkId) return { ok: false, intent, error: "Invalid check ID." };

    const nextState = await updateAppState(shop, (current) => {
      const existing = new Set(current.pageSpeed?.completedManualIds || []);
      if (completed) existing.add(checkId);
      else existing.delete(checkId);
      return {
        ...current,
        pageSpeed: {
          ...(current.pageSpeed || {}),
          completedManualIds: Array.from(existing),
        },
      };
    });

    return {
      ok: true,
      intent: "toggleManualCheck",
      completedManualIds: nextState.pageSpeed.completedManualIds,
    };
  }

  if (intent === "aiFixMatchedProduct") {
    const productId = String(formData.get("productId") || "").trim();
    if (!productId) {
      return { ok: false, intent, error: "Select or test a product URL to auto-fix it." };
    }
    try {
      const liveProduct = await fetchProductById({ storeDomain: shop, token, apiVersion, productId });
      if (!liveProduct) {
        return { ok: false, intent, error: "Product could not be loaded from Shopify." };
      }
      const appState = await getAppState(shop);
      const row = mapShopifyProductToSeoRow(liveProduct, appState?.productSeo?.[productId] || {});
      const result = await runAiAutoFixProducts({
        shop,
        storeDomain: shop,
        token,
        apiVersion,
        products: [
          {
            id: row.id,
            title: row.title,
            handle: row.handle,
            focusKeyword: row.focusKeyword,
            metaTitle: row.metaTitle,
            metaDescription: row.metaDescription,
          },
        ],
      });
      if (!result.ok) return { ...result, intent };

      const refreshed = await fetchProductById({ storeDomain: shop, token, apiVersion, productId });
      const nextAppState = await getAppState(shop);
      const updatedRow = refreshed
        ? mapShopifyProductToSeoRow(refreshed, nextAppState?.productSeo?.[productId] || {})
        : row;

      return {
        ...result,
        intent,
        matchedProduct: updatedRow,
      };
    } catch (error) {
      return { ok: false, intent, error: error?.message || "Failed to AI-fix product." };
    }
  }

  if (intent === "manualSaveMatchedProduct") {
    const productId = String(formData.get("productId") || "").trim();
    if (!productId) {
      return { ok: false, intent, error: "Product ID is required." };
    }
    try {
      const payload = {
        title: String(formData.get("title") || ""),
        focusKeyword: String(formData.get("focusKeyword") || ""),
        handle: String(formData.get("handle") || ""),
        metaTitle: String(formData.get("metaTitle") || ""),
        metaDescription: String(formData.get("metaDescription") || ""),
      };

      const saved = await saveProductSeoAndRescan({
        shop,
        storeDomain: shop,
        token,
        apiVersion,
        productId,
        payload,
      });

      if (!saved.ok) {
        return {
          ok: false,
          intent,
          error:
            saved.errors?.metaTitle ||
            saved.errors?.metaDescription ||
            saved.errors?.title ||
            saved.errors?.focusKeyword ||
            saved.errors?.handle ||
            "Check highlighted SEO fields before saving.",
        };
      }

      const refreshed = await fetchProductById({ storeDomain: shop, token, apiVersion, productId });
      const appState = await getAppState(shop);
      const matchedProduct = refreshed
        ? mapShopifyProductToSeoRow(refreshed, appState?.productSeo?.[productId] || {})
        : null;

      return {
        ok: true,
        intent,
        redirectCreated: saved.redirectCreated,
        matchedProduct,
      };
    } catch (error) {
      return {
        ok: false,
        intent,
        error: error?.message || "Unable to save manual product SEO update.",
      };
    }
  }

  return { ok: false, error: "Unsupported PageSpeed action." };
};

function scoreTone(score) {
  if (typeof score !== "number") return "warn";
  if (score >= 90) return "good";
  if (score >= 50) return "warn";
  return "bad";
}

function cwvTone(rating) {
  if (rating === "good") return "good";
  if (rating === "needs-improvement") return "warning";
  if (rating === "poor") return "critical";
  return "info";
}

function cwvLabel(rating) {
  if (rating === "good") return "Good";
  if (rating === "needs-improvement") return "Needs Work";
  if (rating === "poor") return "Poor";
  return "N/A";
}

export default function PageSpeedDashboardPage() {
  const loaderData = useLoaderData();
  const [searchParams, setSearchParams] = useSearchParams();
  const testFetcher = useFetcher();
  const manualFetcher = useFetcher();
  const aiPlanFetcher = useFetcher();
  const fixFetcher = useFetcher();

  const urlModeParam = searchParams.get("mode");
  const [targetUrl, setTargetUrl] = useState(loaderData.defaultUrl || "");
  const [strategy, setStrategy] = useState("mobile");
  const [activeDeviceTab, setActiveDeviceTab] = useState("mobile");
  const [workbenchTab, setWorkbenchTab] = useState(
    urlModeParam === "manual" ? "manual" : "ai",
  ); // "ai" | "manual"

  useEffect(() => {
    if (urlModeParam === "ai" || urlModeParam === "manual") {
      setWorkbenchTab(urlModeParam);
    }
  }, [urlModeParam]);

  const [pageSpeedState, setPageSpeedState] = useState(loaderData.pageSpeed);
  const [matchedProduct, setMatchedProduct] = useState(loaderData.matchedProduct);
  const [manualDraft, setManualDraft] = useState(() => ({
    title: loaderData.matchedProduct?.title || "",
    focusKeyword: loaderData.matchedProduct?.focusKeyword || "",
    handle: loaderData.matchedProduct?.handle || "",
    metaTitle: loaderData.matchedProduct?.metaTitle || "",
    metaDescription: loaderData.matchedProduct?.metaDescription || "",
  }));

  useEffect(() => {
    setPageSpeedState(loaderData.pageSpeed);
  }, [loaderData.pageSpeed]);

  useEffect(() => {
    if (loaderData.matchedProduct) {
      setMatchedProduct(loaderData.matchedProduct);
      setManualDraft({
        title: loaderData.matchedProduct.title || "",
        focusKeyword: loaderData.matchedProduct.focusKeyword || "",
        handle: loaderData.matchedProduct.handle || "",
        metaTitle: loaderData.matchedProduct.metaTitle || "",
        metaDescription: loaderData.matchedProduct.metaDescription || "",
      });
    }
  }, [loaderData.matchedProduct]);

  useEffect(() => {
    if (testFetcher.state !== "idle" || !testFetcher.data) return;
    if (testFetcher.data.ok && testFetcher.data.pageSpeed) {
      setPageSpeedState(testFetcher.data.pageSpeed);
      setMatchedProduct(testFetcher.data.matchedProduct || null);
      if (testFetcher.data.matchedProduct) {
        setManualDraft({
          title: testFetcher.data.matchedProduct.title || "",
          focusKeyword: testFetcher.data.matchedProduct.focusKeyword || "",
          handle: testFetcher.data.matchedProduct.handle || "",
          metaTitle: testFetcher.data.matchedProduct.metaTitle || "",
          metaDescription: testFetcher.data.matchedProduct.metaDescription || "",
        });
      }
      if (testFetcher.data.testedStrategy === "desktop" && testFetcher.data.pageSpeed.desktop) {
        setActiveDeviceTab("desktop");
      } else if (testFetcher.data.pageSpeed.mobile) {
        setActiveDeviceTab("mobile");
      }
      showToast({
        tone: "success",
        title: "Live PageSpeed Test Complete",
        message: "Updated real Lighthouse scores and Core Web Vitals.",
      });
    } else if (testFetcher.data.error) {
      showToast({
        tone: "error",
        title: "PageSpeed Test Error",
        message: testFetcher.data.error,
      });
    }
  }, [testFetcher.state, testFetcher.data]);

  useEffect(() => {
    if (manualFetcher.state === "idle" && manualFetcher.data?.ok && manualFetcher.data?.completedManualIds) {
      setPageSpeedState((prev) => ({
        ...prev,
        completedManualIds: manualFetcher.data.completedManualIds,
      }));
    }
  }, [manualFetcher.state, manualFetcher.data]);

  useEffect(() => {
    if (aiPlanFetcher.state !== "idle" || !aiPlanFetcher.data) return;
    if (aiPlanFetcher.data.ok && aiPlanFetcher.data.result) {
      setPageSpeedState((prev) => ({
        ...prev,
        lastAiPlan: {
          ...aiPlanFetcher.data.result,
          generatedAt: new Date().toISOString(),
        },
      }));
      if (aiPlanFetcher.data.creditsRemaining !== undefined) {
        dispatchCreditsUpdate({
          availableCredits: aiPlanFetcher.data.creditsRemaining,
          plan: aiPlanFetcher.data.plan,
          superAccess: Boolean(aiPlanFetcher.data.superAccess),
        });
      }
      showToast({
        tone: "success",
        title: "AI Speed & SEO Fix Plan Ready",
        message: aiPlanFetcher.data.superAccess
          ? "Generated with Super Access."
          : `Deducted ${aiPlanFetcher.data.creditsDeducted} token(s).`,
      });
    } else if (aiPlanFetcher.data.error) {
      showToast({
        tone: "error",
        title: "AI Fix Error",
        message: aiPlanFetcher.data.error,
      });
    }
  }, [aiPlanFetcher.state, aiPlanFetcher.data]);

  useEffect(() => {
    if (fixFetcher.state !== "idle" || !fixFetcher.data) return;
    if (fixFetcher.data.ok) {
      if (fixFetcher.data.matchedProduct) {
        setMatchedProduct(fixFetcher.data.matchedProduct);
        setManualDraft({
          title: fixFetcher.data.matchedProduct.title || "",
          focusKeyword: fixFetcher.data.matchedProduct.focusKeyword || "",
          handle: fixFetcher.data.matchedProduct.handle || "",
          metaTitle: fixFetcher.data.matchedProduct.metaTitle || "",
          metaDescription: fixFetcher.data.matchedProduct.metaDescription || "",
        });
      }
      if (fixFetcher.data.creditsRemaining !== undefined) {
        dispatchCreditsUpdate({
          availableCredits: fixFetcher.data.creditsRemaining,
          plan: fixFetcher.data.plan,
          superAccess: Boolean(fixFetcher.data.superAccess),
        });
      }
      showToast({
        tone: "success",
        title:
          fixFetcher.data.intent === "aiFixMatchedProduct"
            ? "Product SEO Auto-Fixed"
            : "Manual SEO Changes Saved",
        message:
          fixFetcher.data.redirectCreated
            ? "Saved to Shopify with an automatic 301 redirect."
            : "Updated live Shopify product SEO. Click Re-Test Live to verify score gain.",
      });
    } else if (fixFetcher.data.error) {
      showToast({
        tone: "error",
        title: "Fix Failed",
        message: fixFetcher.data.error,
      });
    }
  }, [fixFetcher.state, fixFetcher.data]);

  const activeReport = useMemo(() => {
    if (activeDeviceTab === "desktop") {
      return pageSpeedState?.desktop || pageSpeedState?.mobile || null;
    }
    return pageSpeedState?.mobile || pageSpeedState?.desktop || null;
  }, [activeDeviceTab, pageSpeedState]);

  const previousSameStrategy = useMemo(() => {
    if (!activeReport || !Array.isArray(pageSpeedState?.history)) return null;
    const matches = pageSpeedState.history.filter(
      (item) => item.strategy === activeReport.strategy && item.url === activeReport.testedUrl,
    );
    return matches.length > 1 ? matches[1] : null;
  }, [activeReport, pageSpeedState?.history]);

  const completedManualSet = useMemo(
    () => new Set(pageSpeedState?.completedManualIds || []),
    [pageSpeedState?.completedManualIds],
  );

  const isTesting = testFetcher.state !== "idle";
  const isGeneratingAiPlan = aiPlanFetcher.state !== "idle";
  const isFixingProduct = fixFetcher.state !== "idle";

  function handleRunLiveTest(event) {
    event?.preventDefault();
    const formData = new FormData();
    formData.set("intent", "runTest");
    formData.set("targetUrl", targetUrl);
    formData.set("strategy", strategy);
    testFetcher.submit(formData, { method: "post" });
  }

  function handleGenerateAiPlan() {
    if (!activeReport) return;
    aiPlanFetcher.submit(
      {
        actionType: "pagespeed_ai_fix",
        payload: {
          title: matchedProduct?.title || activeReport.testedUrl,
          matchedProductTitle: matchedProduct?.title || "",
          report: activeReport,
          mobileReport: pageSpeedState?.mobile || null,
          desktopReport: pageSpeedState?.desktop || null,
        },
      },
      {
        method: "post",
        action: "/app/api/ai",
        encType: "application/json",
      },
    );
  }

  function handleToggleManualCheck(checkId, nextDone) {
    const formData = new FormData();
    formData.set("intent", "toggleManualCheck");
    formData.set("checkId", checkId);
    formData.set("completed", nextDone ? "true" : "false");
    manualFetcher.submit(formData, { method: "post" });
  }

  function handleCopyCode(text, label = "Snippet") {
    if (!text || typeof navigator === "undefined" || !navigator.clipboard) return;
    navigator.clipboard.writeText(text);
    showToast({
      tone: "success",
      title: `${label} Copied`,
      message: "Paste this into Online Store → Themes → Edit code.",
    });
  }

  const aiPlan = pageSpeedState?.lastAiPlan || null;

  return (
    <>
      <ui-title-bar title="Technical & History — PageSpeed & CWV" />
      <div className="seo-wrap seo-grid">
        <WorkspaceSubnav group="technical" />

        {loaderData.configError ? <div className="error-box">{loaderData.configError}</div> : null}

        {/* ── Live Google PageSpeed Insights Runner ─────────────────────────── */}
        <section className="section-card seo-grid">
          <div className="section-header" style={{ alignItems: "center" }}>
            <div>
              <h2 style={{ margin: "0 0 2px", fontSize: "16px" }}>Live Google PageSpeed Insights Test</h2>
              <p className="seo-muted" style={{ fontSize: "13px" }}>
                Runs real Google Lighthouse + Core Web Vitals against your live storefront URL (Mobile &amp; Desktop), then offers <strong>AI Fixing</strong> or <strong>Manual Fixing</strong>.
              </p>
            </div>
            <StatusPill tone="info">Free Live PSI Scan</StatusPill>
          </div>

          <form onSubmit={handleRunLiveTest} className="seo-grid" style={{ gap: "12px" }}>
            <div className="seo-grid grid-3" style={{ gap: "12px" }}>
              <div>
                <label className="seo-label" htmlFor="ps-quick-pick">
                  Quick Pick Store URL
                </label>
                <select
                  id="ps-quick-pick"
                  className="seo-input"
                  value=""
                  onChange={(e) => {
                    if (e.target.value) setTargetUrl(e.target.value);
                  }}
                >
                  <option value="">Choose store page or product...</option>
                  {loaderData.shop ? (
                    <>
                      <option value={`https://${loaderData.shop}`}>🏠 Store Homepage</option>
                      <option value={`https://${loaderData.shop}/collections/all`}>📦 All Collections</option>
                    </>
                  ) : null}
                  {loaderData.sampleProducts.map((p) => (
                    <option key={p.id} value={p.url}>
                      🛍️ Product: {p.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="seo-label" htmlFor="ps-target-url">
                  Public Storefront URL or Path
                </label>
                <input
                  id="ps-target-url"
                  className="seo-input"
                  value={targetUrl}
                  onChange={(e) => setTargetUrl(e.target.value)}
                  placeholder={`https://${loaderData.shop || "yourstore.com"} or /products/...`}
                />
              </div>

              <div>
                <label className="seo-label" htmlFor="ps-strategy">
                  Test Strategy
                </label>
                <select
                  id="ps-strategy"
                  className="seo-input"
                  value={strategy}
                  onChange={(e) => setStrategy(e.target.value)}
                >
                  <option value="mobile">Mobile (Google Mobile-First)</option>
                  <option value="desktop">Desktop</option>
                  <option value="both">Both Mobile + Desktop</option>
                </select>
              </div>
            </div>

            <div className="toolbar" style={{ justifyContent: "space-between", marginBottom: 0 }}>
              <small className="seo-muted">
                {loaderData.hasPageSpeedKey
                  ? "Using configured Google PageSpeed API key (10–25s per live Lighthouse audit)."
                  : "Using Google PSI public quota (add a key in SuperAdmin → AI Config anytime for heavy testing)."}
              </small>
              <button
                type="submit"
                className="seo-button"
                disabled={isTesting || Boolean(loaderData.configError)}
              >
                {isTesting ? "Running Google Lighthouse (10–25s)..." : "🚀 Run Live PageSpeed Test"}
              </button>
            </div>
          </form>
        </section>

        {activeReport?.passwordProtected ? (
          <div className="status-banner banner-warn">
            <strong>Storefront Password Gate Detected:</strong> Google PageSpeed tested your Shopify password page (
            <code>{activeReport.finalUrl}</code>). Disable storefront password protection under Shopify Admin → Online Store → Preferences to score your real storefront theme.
          </div>
        ) : null}

        {/* ── Live Score Cards & Core Web Vitals Telemetry ───────────────────── */}
        {activeReport ? (
          <>
            <section className="section-card seo-grid">
              <div className="toolbar" style={{ justifyContent: "space-between", marginBottom: 0 }}>
                <div>
                  <h3 style={{ margin: 0 }}>Live Lighthouse Scores</h3>
                  <small className="seo-muted" suppressHydrationWarning>
                    URL: <code>{activeReport.testedUrl}</code> ·{" "}
                    {activeReport.fetchTime ? new Date(activeReport.fetchTime).toLocaleString() : ""} · Page Weight:{" "}
                    <strong>{activeReport.totalBytesLabel}</strong>
                  </small>
                </div>

                <div className="filter-pills">
                  <button
                    type="button"
                    className={`filter-pill ${activeDeviceTab === "mobile" ? "active" : ""}`}
                    onClick={() => setActiveDeviceTab("mobile")}
                    disabled={!pageSpeedState?.mobile}
                  >
                    Mobile {pageSpeedState?.mobile?.scores?.performance ?? "--"}
                  </button>
                  <button
                    type="button"
                    className={`filter-pill ${activeDeviceTab === "desktop" ? "active" : ""}`}
                    onClick={() => setActiveDeviceTab("desktop")}
                    disabled={!pageSpeedState?.desktop}
                  >
                    Desktop {pageSpeedState?.desktop?.scores?.performance ?? "--"}
                  </button>
                </div>
              </div>

              <div className="seo-grid grid-4">
                {[
                  { key: "performance", label: "Performance", val: activeReport.scores?.performance },
                  { key: "seo", label: "Technical SEO", val: activeReport.scores?.seo },
                  { key: "accessibility", label: "Accessibility", val: activeReport.scores?.accessibility },
                  { key: "bestPractices", label: "Best Practices", val: activeReport.scores?.bestPractices },
                ].map((cat) => {
                  const prevVal = previousSameStrategy?.[cat.key];
                  const delta =
                    typeof prevVal === "number" && typeof cat.val === "number" ? cat.val - prevVal : null;
                  return (
                    <div key={cat.key} className="ps-score-card">
                      <div className={`ps-score-ring ${scoreTone(cat.val)}`}>
                        {cat.val ?? "--"}
                      </div>
                      <strong style={{ fontSize: "13.5px" }}>{cat.label}</strong>
                      {delta !== null && delta !== 0 ? (
                        <StatusPill tone={delta > 0 ? "good" : "warning"}>
                          {delta > 0 ? `+${delta} vs prev` : `${delta} vs prev`}
                        </StatusPill>
                      ) : (
                        <small className="seo-muted">{activeReport.strategy.toUpperCase()}</small>
                      )}
                    </div>
                  );
                })}
              </div>

              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <strong style={{ fontSize: "13.5px" }}>Core Web Vitals &amp; Speed Telemetry</strong>
                  <StatusPill tone={activeReport.hasFieldData ? "good" : "info"}>
                    {activeReport.hasFieldData ? "Chrome UX Field + Lab" : "Lighthouse Lab Telemetry"}
                  </StatusPill>
                </div>
                <div className="seo-grid grid-3" style={{ gap: "10px" }}>
                  {Object.entries(activeReport.metrics || {}).map(([key, metric]) => (
                    <div key={key} className="ps-cwv-card">
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
                        <span className="metric-label" style={{ fontSize: "11px" }}>{metric.label}</span>
                        <StatusPill tone={cwvTone(metric.rating)}>{cwvLabel(metric.rating)}</StatusPill>
                      </div>
                      <div className="ps-cwv-val">{metric.displayValue}</div>
                      <small className="seo-muted">Google Good Target: {metric.target}</small>
                    </div>
                  ))}
                </div>
              </div>

              {activeReport.lcpElement ? (
                <div style={{ background: "var(--seo-bg-accent)", padding: "10px 14px", borderRadius: 8 }}>
                  <strong style={{ fontSize: "12px" }}>Detected LCP Hero Element:</strong>{" "}
                  <code style={{ fontSize: "12px", wordBreak: "break-all" }}>{activeReport.lcpElement}</code>
                </div>
              ) : null}
            </section>

            {/* ── Dual Remediation Workbench: AI Fixing vs Manual Fixing ──────── */}
            <section className="section-card seo-grid">
              <div className="toolbar" style={{ justifyContent: "space-between", marginBottom: 0 }}>
                <div>
                  <h3 style={{ margin: 0 }}>Speed &amp; SEO Fix Workbench</h3>
                  <p className="seo-muted" style={{ margin: "2px 0 0", fontSize: "13px" }}>
                    Switch between <strong>AI Fixing</strong> (Gemini diagnostics + 1-click product optimization) and <strong>Manual Fixing</strong> (inline Shopify meta editor + Liquid code checklists).
                  </p>
                </div>

                <div className="filter-pills">
                  <button
                    type="button"
                    className={`filter-pill ${workbenchTab === "ai" ? "active" : ""}`}
                    onClick={() => {
                      setWorkbenchTab("ai");
                      setSearchParams((prev) => {
                        const next = new URLSearchParams(prev);
                        next.set("mode", "ai");
                        return next;
                      }, { replace: true });
                    }}
                  >
                    ⚡ AI Fixing
                  </button>
                  <button
                    type="button"
                    className={`filter-pill ${workbenchTab === "manual" ? "active" : ""}`}
                    onClick={() => {
                      setWorkbenchTab("manual");
                      setSearchParams((prev) => {
                        const next = new URLSearchParams(prev);
                        next.set("mode", "manual");
                        return next;
                      }, { replace: true });
                    }}
                  >
                    🛠️ Manual Fixing ({activeReport.manualChecklist?.length || 0})
                  </button>
                </div>
              </div>

              {workbenchTab === "ai" ? (
                <div className="seo-grid" style={{ gap: "14px" }}>
                  <div
                    className="toolbar"
                    style={{
                      justifyContent: "space-between",
                      background: "var(--seo-bg-accent)",
                      padding: "14px 16px",
                      borderRadius: 10,
                      marginBottom: 0,
                    }}
                  >
                    <div>
                      <strong style={{ fontSize: "14px" }}>Gemini AI Core Web Vitals &amp; SEO Optimizer</strong>
                      <p className="seo-muted" style={{ margin: "3px 0 0", fontSize: "12.5px" }}>
                        Diagnoses your live Mobile &amp; Desktop Lighthouse bottlenecks and generates exact Shopify theme Liquid fixes + in-app SEO actions.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="seo-button"
                      disabled={!loaderData.aiReady || isGeneratingAiPlan}
                      onClick={handleGenerateAiPlan}
                      title={loaderData.aiReady ? "Analyze live PageSpeed bottlenecks with Gemini AI" : loaderData.aiUnavailableReason}
                    >
                      {isGeneratingAiPlan
                        ? "Analyzing Bottlenecks..."
                        : aiPlan
                          ? `Refresh AI Fix Plan (${loaderData.hasSuperAccess ? "Super" : `${CREDIT_COSTS.pagespeed_ai_fix} tok`})`
                          : `⚡ AI Fix Plan (${loaderData.hasSuperAccess ? "Super" : `${CREDIT_COSTS.pagespeed_ai_fix} tok`})`}
                    </button>
                  </div>

                  {matchedProduct ? (
                    <div className="issue-product-row">
                      <div className="issue-product-info">
                        <strong>Matched Store Product: {matchedProduct.title}</strong>
                        <small className="seo-muted">
                          Meta Title: {matchedProduct.metaTitle ? `${matchedProduct.metaTitle.length} chars` : "Missing"} · Meta Desc:{" "}
                          {matchedProduct.metaDescription ? `${matchedProduct.metaDescription.length} chars` : "Missing"}
                        </small>
                      </div>
                      <button
                        type="button"
                        className="seo-button"
                        disabled={!loaderData.aiReady || isFixingProduct}
                        onClick={() => {
                          const fd = new FormData();
                          fd.set("intent", "aiFixMatchedProduct");
                          fd.set("productId", matchedProduct.id);
                          fixFetcher.submit(fd, { method: "post" });
                        }}
                      >
                        {isFixingProduct
                          ? "Applying AI SEO..."
                          : `1-Click AI Fix Product SEO (${loaderData.hasSuperAccess ? "Super" : `${CREDIT_COSTS.product_seo_fix} tok`})`}
                      </button>
                    </div>
                  ) : null}

                  {aiPlan ? (
                    <div className="ai-diff-card">
                      <div className="ai-diff-head">
                        <div>
                          <h4 style={{ margin: 0 }}>🤖 AI Optimization Plan</h4>
                          <small className="seo-muted" suppressHydrationWarning>
                            URL: <code>{aiPlan.testedUrl}</code>
                            {aiPlan.generatedAt ? ` · ${new Date(aiPlan.generatedAt).toLocaleString()}` : ""}
                          </small>
                        </div>
                        <span className="ctr-badge">{aiPlan.projectedPerformanceGain}</span>
                      </div>

                      <p style={{ margin: 0, fontSize: "14px", lineHeight: 1.5 }}>{aiPlan.executiveSummary}</p>
                      <small style={{ color: "var(--seo-primary-strong)", fontWeight: 600 }}>
                        SEO Impact: {aiPlan.projectedSeoImpact}
                      </small>

                      <div className="seo-grid" style={{ gap: "10px" }}>
                        {(aiPlan.priorityFixes || []).map((fix, idx) => (
                          <div key={`ai-ps-fix-${idx}`} className="ps-fix-card">
                            <div className="toolbar" style={{ justifyContent: "space-between", marginBottom: 0 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                <StatusPill tone={fix.impact === "HIGH" ? "critical" : "warning"}>
                                  {fix.impact} · {fix.metricTarget}
                                </StatusPill>
                                <strong>{fix.title}</strong>
                              </div>
                              <StatusPill tone="good">{fix.estimatedGain}</StatusPill>
                            </div>

                            <p style={{ margin: 0, fontSize: "13px", color: "#334155" }}>{fix.actionSteps}</p>

                            {fix.liquidSnippet ? (
                              <div className="seo-grid" style={{ gap: 6 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                  <small className="seo-muted">Shopify Liquid / HTML Fix Snippet</small>
                                  <button
                                    type="button"
                                    className="seo-button secondary small-btn"
                                    onClick={() => handleCopyCode(fix.liquidSnippet, "Liquid Snippet")}
                                  >
                                    Copy Code
                                  </button>
                                </div>
                                <pre className="ps-code-block">{fix.liquidSnippet}</pre>
                              </div>
                            ) : null}

                            {fix.targetRoute ? (
                              <div>
                                <Link className="seo-button secondary small-btn" to={fix.targetRoute}>
                                  Open In-App Fix Tool →
                                </Link>
                              </div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="status-banner" data-no-toast="true">
                      Click <strong>⚡ AI Fix Plan</strong> above to let Gemini inspect the live PageSpeed diagnostics and generate targeted Shopify speed &amp; SEO fixes.
                    </div>
                  )}
                </div>
              ) : (
                <div className="seo-grid" style={{ gap: "16px" }}>
                  {/* In-App Manual SEO Fix Shortcuts */}
                  <div className="seo-grid grid-4" style={{ gap: "10px" }}>
                    <Link to="/app/image-optimizer?status=needs-fix" className="feature-card">
                      <h4>🖼️ Image ALT &amp; Media</h4>
                      <p>Fix missing ALT tags &amp; audit heavy product images.</p>
                      <span>Open</span>
                    </Link>
                    <Link to="/app/bulk-meta" className="feature-card">
                      <h4>🏷️ Bulk Meta Tags</h4>
                      <p>Fix missing page titles &amp; meta descriptions manually.</p>
                      <span>Open</span>
                    </Link>
                    <Link to="/app/robots" className="feature-card">
                      <h4>🤖 Robots.txt Crawl</h4>
                      <p>Inspect live crawl directives &amp; fix blocks.</p>
                      <span>Open</span>
                    </Link>
                    <Link to="/app/url-optimization" className="feature-card">
                      <h4>🔗 Clean URLs &amp; 301s</h4>
                      <p>Shorten long product slugs with 301 safety.</p>
                      <span>Open</span>
                    </Link>
                  </div>

                  {/* Direct In-App Manual Product SEO Editor when tested URL matches a product */}
                  {matchedProduct ? (
                    <div className="section-card" style={{ background: "#f8fafc" }}>
                      <h4 style={{ margin: "0 0 8px" }}>
                        Manual Product SEO Fix: {matchedProduct.title}
                      </h4>
                      <div className="seo-grid grid-2" style={{ gap: "10px" }}>
                        <div>
                          <label className="seo-label">Product Title</label>
                          <input
                            className="seo-input"
                            value={manualDraft.title}
                            onChange={(e) => setManualDraft((d) => ({ ...d, title: e.target.value }))}
                          />
                        </div>
                        <div>
                          <label className="seo-label">Focus Keyword</label>
                          <input
                            className="seo-input"
                            value={manualDraft.focusKeyword}
                            onChange={(e) => setManualDraft((d) => ({ ...d, focusKeyword: e.target.value }))}
                          />
                        </div>
                        <div>
                          <label className="seo-label">
                            Meta Title ({manualDraft.metaTitle.length}/60)
                          </label>
                          <input
                            className="seo-input"
                            value={manualDraft.metaTitle}
                            onChange={(e) => setManualDraft((d) => ({ ...d, metaTitle: e.target.value }))}
                          />
                        </div>
                        <div>
                          <label className="seo-label">URL Handle (301 safe)</label>
                          <input
                            className="seo-input"
                            value={manualDraft.handle}
                            onChange={(e) => setManualDraft((d) => ({ ...d, handle: e.target.value }))}
                          />
                        </div>
                      </div>
                      <div style={{ marginTop: 10 }}>
                        <label className="seo-label">
                          Meta Description ({manualDraft.metaDescription.length}/160)
                        </label>
                        <textarea
                          rows={2}
                          className="seo-textarea"
                          value={manualDraft.metaDescription}
                          onChange={(e) => setManualDraft((d) => ({ ...d, metaDescription: e.target.value }))}
                        />
                      </div>
                      <div className="toolbar" style={{ marginTop: 12, marginBottom: 0 }}>
                        <button
                          type="button"
                          className="seo-button"
                          disabled={isFixingProduct}
                          onClick={() => {
                            const fd = new FormData();
                            fd.set("intent", "manualSaveMatchedProduct");
                            fd.set("productId", matchedProduct.id);
                            fd.set("title", manualDraft.title);
                            fd.set("focusKeyword", manualDraft.focusKeyword);
                            fd.set("handle", manualDraft.handle);
                            fd.set("metaTitle", manualDraft.metaTitle);
                            fd.set("metaDescription", manualDraft.metaDescription);
                            fixFetcher.submit(fd, { method: "post" });
                          }}
                        >
                          {isFixingProduct ? "Saving to Shopify..." : "Save Manual Product SEO"}
                        </button>
                        <Link to={`/app/products?focus=${matchedProduct.id}`} className="seo-button secondary">
                          Open Full Content Editor →
                        </Link>
                      </div>
                    </div>
                  ) : null}

                  {/* Interactive Theme & Lighthouse Manual Remediation Checklist */}
                  <div className="seo-grid" style={{ gap: "10px" }}>
                    <strong style={{ fontSize: "14px" }}>
                      Step-by-Step Theme &amp; Lighthouse Manual Fixes
                    </strong>
                    {!(activeReport.manualChecklist || []).length ? (
                      <div className="status-banner banner-good">
                        Zero major manual Lighthouse failures found on this scan. Keep monitoring periodically!
                      </div>
                    ) : (
                      (activeReport.manualChecklist || []).map((item) => {
                        const isDone = completedManualSet.has(item.id);
                        return (
                          <div key={item.id} className={`ps-fix-card${isDone ? " done" : ""}`}>
                            <div className="toolbar" style={{ justifyContent: "space-between", marginBottom: 0 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                <StatusPill tone={isDone ? "good" : "warning"}>
                                  {item.metricTarget}
                                </StatusPill>
                                <strong style={{ textDecoration: isDone ? "line-through" : "none" }}>
                                  {item.title}
                                </strong>
                                <small className="seo-muted">({item.displayImpact})</small>
                              </div>

                              <button
                                type="button"
                                className={`seo-button ${isDone ? "secondary" : ""}`}
                                style={{ fontSize: "12px", padding: "5px 10px" }}
                                onClick={() => handleToggleManualCheck(item.id, !isDone)}
                              >
                                {isDone ? "✓ Marked Fixed (Undo)" : "Mark Fixed"}
                              </button>
                            </div>

                            <small className="seo-muted">
                              Where to fix: <strong>{item.fileHint}</strong>
                            </small>
                            <p style={{ margin: 0, fontSize: "13px", color: "#334155" }}>{item.steps}</p>

                            {item.offendingItems?.length ? (
                              <ul style={{ margin: 0, paddingLeft: 18, fontSize: "12px", color: "#475569" }}>
                                {item.offendingItems.map((res, rIdx) => (
                                  <li key={`${item.id}-res-${rIdx}`} style={{ wordBreak: "break-all" }}>
                                    <code>{res.url || res.label || "Resource"}</code>
                                    {res.wastedMs ? ` · ${res.wastedMs} ms` : ""}
                                    {res.wastedBytes ? ` · ${Math.round(res.wastedBytes / 1024)} KB` : ""}
                                  </li>
                                ))}
                              </ul>
                            ) : null}

                            {item.snippet ? (
                              <div className="seo-grid" style={{ gap: 6 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                  <small className="seo-muted">Manual Liquid / CSS Snippet</small>
                                  <button
                                    type="button"
                                    className="seo-button secondary small-btn"
                                    onClick={() => handleCopyCode(item.snippet, "Theme Fix")}
                                  >
                                    Copy Code
                                  </button>
                                </div>
                                <pre className="ps-code-block">{item.snippet}</pre>
                              </div>
                            ) : null}

                            {item.inAppTarget ? (
                              <div>
                                <Link className="seo-button secondary small-btn" to={item.inAppTarget}>
                                  Fix Inside Ecom SEO →
                                </Link>
                              </div>
                            ) : null}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </section>
          </>
        ) : (
          <section className="section-card">
            <h3 style={{ marginTop: 0 }}>Ready to measure your live storefront speed &amp; SEO</h3>
            <p className="seo-muted" style={{ marginBottom: 0 }}>
              Choose your Store Homepage or any Product URL above and click <strong>🚀 Run Live PageSpeed Test</strong>. Google Lighthouse will measure live Performance, Core Web Vitals (<code>LCP</code>, <code>INP/TBT</code>, <code>CLS</code>, <code>TTFB</code>), and Technical SEO, then unlock both <strong>AI Fixing</strong> and <strong>Manual Fixing</strong> tools.
            </p>
          </section>
        )}

        {/* ── Historical Before / After PageSpeed Snapshots ──────────────────── */}
        {pageSpeedState?.history?.length ? (
          <section id="history" className="section-card seo-grid">
            <h3 style={{ margin: 0 }}>Recent Live PageSpeed History</h3>
            <div style={{ overflowX: "auto" }}>
              <table className="credit-usage-table">
                <thead>
                  <tr>
                    <th>Tested At</th>
                    <th>URL</th>
                    <th>Device</th>
                    <th>Performance</th>
                    <th>SEO</th>
                    <th>LCP</th>
                    <th>CLS</th>
                  </tr>
                </thead>
                <tbody>
                  {pageSpeedState.history.map((row, idx) => (
                    <tr key={`${row.testedAt}-${row.strategy}-${idx}`}>
                      <td suppressHydrationWarning>{new Date(row.testedAt).toLocaleString()}</td>
                      <td style={{ maxWidth: 260, overflowWrap: "anywhere" }}>{row.url}</td>
                      <td>
                        <StatusPill tone="info">{String(row.strategy || "mobile").toUpperCase()}</StatusPill>
                      </td>
                      <td><strong>{row.performance ?? "--"}</strong></td>
                      <td>{row.seo ?? "--"}</td>
                      <td>{row.lcp}</td>
                      <td>{row.cls}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}
      </div>
    </>
  );
}
