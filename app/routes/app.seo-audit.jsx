import { useEffect, useMemo, useState } from "react";
import { Link, useFetcher, useLoaderData } from "react-router";
import seoStyles from "../styles/seo.css?url";
import { StatusPill, dispatchCreditsUpdate } from "../components/seo-ui";
import { showToast } from "../components/toast-viewport";
import prisma from "../db.server";
import { getAppState, updateAppState } from "../services/app-state.server";
import { getOrCreateCreditAccount } from "../services/credit-manager.server.js";
import {
  buildGscAuthUrl,
  disconnectGscForShop,
  importGscCsvForShop,
  sanitizeGscForClient,
  syncGscMetricsForShop,
} from "../services/gsc.server";
import { requireShopContext } from "../services/route-context.server";
import { applyIncrementalAuditPatch, runFullScan } from "../services/seo-engine.server";
import { fetchProductsByIds } from "../services/shopify-admin.server";
import { runAiAutoFixProducts, updateAutopilotSettings } from "../services/seo-workflows.server";
import {
  checkStoreRouteAccess,
  getEffectiveGscOAuthConfig,
  getEffectivePlatformAiSettings,
  getOrCreateStoreControl,
} from "../services/store-control.server.js";
import { AI_FEATURES_ENABLED } from "../utils/feature-flags";
import { CREDIT_COSTS, PLAN_ALLOWANCES } from "../utils/credits.js";
import { validateFocusKeyword } from "../validators/seoValidators";

export const links = () => [{ rel: "stylesheet", href: seoStyles }];

export const loader = async ({ request }) => {
  const url = new URL(request.url);
  const gscStatus = url.searchParams.get("gsc") || "";
  const gscCallbackError = url.searchParams.get("gscError") || "";
  const { configError, shop, token, apiVersion } = await requireShopContext(request);
  if (configError || !shop) {
    return {
      configError,
      scan: null,
      copilotBrief: null,
      autopilot: { enabled: false, optimizeMeta: true, optimizeAlt: true, lastRuns: [] },
      gsc: { connected: false, urlMetrics: [], quickWins: [] },
      gscOAuthConfigured: false,
      gscStatus,
      gscCallbackError,
      creditAccount: { availableCredits: 0, effectiveTotal: PLAN_ALLOWANCES.FREE, plan: "FREE" },
      hasSuperAccess: false,
      aiReady: false,
      aiUnavailableReason: configError || "Shop session required.",
    };
  }

  const [appState, creditAccount, storeControl, platformAi, aiAccess, gscOAuth] = await Promise.all([
    getAppState(shop),
    getOrCreateCreditAccount(shop),
    getOrCreateStoreControl(shop),
    getEffectivePlatformAiSettings(),
    checkStoreRouteAccess(shop, "ai_features"),
    getEffectiveGscOAuthConfig(),
  ]);

  let scan = appState?.lastScan || null;
  const needsScanUpgrade =
    Boolean(scan) &&
    (!scan.summary?.pillars ||
      (Array.isArray(scan.issues) &&
        scan.issues.some(
          (issue) =>
            typeof issue.fixPath === "string" &&
            issue.fixPath.includes("focus=") &&
            !issue.meta?.productId,
        )));

  if (needsScanUpgrade && token) {
    try {
      scan = await runFullScan({
        shop,
        storeDomain: shop,
        token,
        apiVersion,
      });
    } catch {
      // Keep cached scan if Shopify API is temporarily unreachable
    }
  }

  let aiUnavailableReason = "";
  if (!AI_FEATURES_ENABLED || !platformAi?.isEnabled) {
    aiUnavailableReason = "Platform AI is currently disabled by administrator.";
  } else if (!platformAi?.apiKey) {
    aiUnavailableReason = "Ask your SuperAdmin to configure the Gemini API key in /superadmin/ai.";
  } else if (!aiAccess?.allowed) {
    aiUnavailableReason = aiAccess?.reason || "AI access is disabled for this store.";
  }

  return {
    configError: "",
    scan,
    copilotBrief: appState?.lastCopilotBrief || null,
    autopilot: appState?.autopilot || { enabled: false, optimizeMeta: true, optimizeAlt: true, lastRuns: [] },
    gsc: sanitizeGscForClient(appState?.gsc),
    gscOAuthConfigured: Boolean(gscOAuth?.clientId && gscOAuth?.clientSecret),
    gscStatus,
    gscCallbackError,
    creditAccount: {
      availableCredits: creditAccount.availableCredits,
      effectiveTotal: creditAccount.effectiveTotal,
      plan: creditAccount.plan,
    },
    hasSuperAccess: Boolean(storeControl?.superAccess),
    aiReady: !aiUnavailableReason,
    aiUnavailableReason,
  };
};

export const action = async ({ request }) => {
  const { shop, token, apiVersion, configError } = await requireShopContext(request);
  if (configError) {
    return { ok: false, error: configError };
  }

  const formData = await request.formData();
  const intent = String(formData.get("intent") || "scan");

  if (intent === "toggleAutopilot") {
    const enabled = formData.get("enabled") === "true";
    const optimizeMeta = formData.get("optimizeMeta") !== "false";
    const optimizeAlt = formData.get("optimizeAlt") !== "false";
    const autopilot = await updateAutopilotSettings({
      shop,
      enabled,
      optimizeMeta,
      optimizeAlt,
    });
    return { ok: true, intent, autopilot };
  }

  if (intent === "gscConnect") {
    try {
      const reqUrl = new URL(request.url);
      const host = String(formData.get("host") || reqUrl.searchParams.get("host") || "");
      const authUrl = await buildGscAuthUrl({
        shop,
        host,
        origin: reqUrl.origin,
      });
      return { ok: true, intent, authUrl };
    } catch (error) {
      return { ok: false, intent, error: error?.message || "Unable to start Google Search Console OAuth." };
    }
  }

  if (intent === "gscSync") {
    try {
      const siteUrlOverride = String(formData.get("siteUrl") || "").trim();
      const gsc = await syncGscMetricsForShop({
        shop,
        storeDomain: shop,
        token,
        apiVersion,
        siteUrlOverride,
      });
      return { ok: true, intent, gsc };
    } catch (error) {
      return { ok: false, intent, error: error?.message || "Failed to sync Google Search Console." };
    }
  }

  if (intent === "gscImportCsv") {
    try {
      const csvText = String(formData.get("csvText") || "").trim();
      const gsc = await importGscCsvForShop({
        shop,
        storeDomain: shop,
        token,
        apiVersion,
        csvText,
      });
      return { ok: true, intent, gsc };
    } catch (error) {
      return { ok: false, intent, error: error?.message || "Could not parse GSC CSV report." };
    }
  }

  if (intent === "gscDisconnect") {
    await disconnectGscForShop(shop);
    return {
      ok: true,
      intent,
      gsc: { connected: false, mode: "", urlMetrics: [], quickWins: [] },
    };
  }

  if (intent === "applyGscQuickWin") {
    const productId = String(formData.get("productId") || "").trim();
    const productTitle = String(formData.get("productTitle") || "").trim();
    const handle = String(formData.get("handle") || "").trim();
    const metaTitle = String(formData.get("metaTitle") || "").trim();
    const metaDescription = String(formData.get("metaDescription") || "").trim();
    const rawQuery = String(formData.get("query") || "").trim();

    const kwCheck = validateFocusKeyword(rawQuery);
    if (!productId || !kwCheck.valid) {
      return {
        ok: false,
        intent,
        error: kwCheck.message || "Quick-win keyword must be 3-40 characters to optimize a product.",
      };
    }

    const result = await runAiAutoFixProducts({
      shop,
      storeDomain: shop,
      token,
      apiVersion,
      products: [
        {
          id: productId,
          title: productTitle,
          handle,
          focusKeyword: kwCheck.normalized,
          metaTitle,
          metaDescription,
        },
      ],
    });
    return { ...result, intent: "aiAutoFix" };
  }

  if (intent === "aiAutoFix") {
    let products = [];
    try {
      const raw = String(formData.get("productsJson") || "[]");
      products = JSON.parse(raw);
    } catch {
      return { ok: false, intent, error: "Invalid product selection payload." };
    }

    const result = await runAiAutoFixProducts({
      shop,
      storeDomain: shop,
      token,
      apiVersion,
      products,
    });
    return { ...result, intent: "aiAutoFix" };
  }

  if (intent === "applyKeyword") {
    const productId = String(formData.get("productId") || "").trim();
    const productTitle = String(formData.get("productTitle") || "").trim();
    const rawKeyword = String(formData.get("newKeyword") || formData.get("focusKeyword") || "").trim();

    if (!productId || !rawKeyword) {
      return { ok: false, intent, error: "Product ID and keyword are required." };
    }

    const check = validateFocusKeyword(rawKeyword);
    if (!check.valid) {
      return { ok: false, intent, error: check.message || "Focus keyword must be 3-40 characters." };
    }

    const currentState = await getAppState(shop);
    const oldKeyword = currentState?.productSeo?.[productId]?.focusKeyword || "";

    await prisma.productRevision.create({
      data: {
        shop,
        productId,
        productTitle: productTitle || `Product ${productId}`,
        changeType: "FOCUS_KEYWORD",
        beforeJson: JSON.stringify({ focusKeyword: oldKeyword }),
        afterJson: JSON.stringify({ focusKeyword: check.normalized }),
        redirectCreated: false,
      },
    });

    await updateAppState(shop, (current) => ({
      ...current,
      productSeo: {
        ...(current.productSeo || {}),
        [productId]: {
          ...(current.productSeo?.[productId] || {}),
          focusKeyword: check.normalized,
        },
      },
    }));

    const liveProducts = await fetchProductsByIds({
      storeDomain: shop,
      token,
      apiVersion,
      productIds: [productId],
    }).catch(() => []);

    const scan = await applyIncrementalAuditPatch({
      shop,
      storeDomain: shop,
      token,
      apiVersion,
      updatedProducts: liveProducts,
    });

    return {
      ok: true,
      intent: "applyKeyword",
      productId,
      appliedKeyword: check.normalized,
      scan,
    };
  }

  const scan = await runFullScan({
    shop,
    storeDomain: shop,
    token,
    apiVersion,
  });

  return {
    ok: true,
    intent: "scan",
    scan,
  };
};

function severityRank(severity) {
  if (severity === "Critical") return 0;
  if (severity === "Warning") return 1;
  return 2;
}

function severityTone(severity) {
  if (severity === "Critical") return "critical";
  if (severity === "Warning") return "warning";
  return "info";
}

function healthTone(health) {
  if (health === "strong") return "good";
  if (health === "steady") return "warning";
  return "critical";
}

function healthLabel(health) {
  if (health === "strong") return "Healthy";
  if (health === "steady") return "Needs Work";
  return "At Risk";
}

function scoreRingColor(score) {
  if (score >= 80) return "#15803d";
  if (score >= 55) return "#b45309";
  return "#b91c1c";
}

function toProductFixInput(issue) {
  const meta = issue?.meta;
  const focusMatch = String(issue?.fixPath || "").match(/[?&]focus=(\d+)/);
  const productId = meta?.productId ? String(meta.productId) : focusMatch?.[1] || "";
  if (!productId) return null;

  const handleMatch = String(issue?.targetUrl || "").match(/\/products\/([^/?#]+)/);
  return {
    id: productId,
    title: meta?.productTitle || "",
    handle: meta?.handle || handleMatch?.[1] || "",
    focusKeyword: meta?.focusKeyword || "",
    metaTitle: meta?.metaTitle || "",
    metaDescription: meta?.metaDescription || "",
    targetUrl: issue.targetUrl || "",
    fixPath: issue.fixPath || `/app/products?focus=${productId}`,
  };
}

function groupAuditIssues(issues = []) {
  const groups = new Map();

  for (const issue of issues) {
    const key = issue.title;
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        title: issue.title,
        severity: issue.severity,
        detail: issue.detail,
        fixPath: issue.fixPath,
        items: [],
        uniqueProducts: [],
        seenProductIds: new Set(),
      });
    }

    const group = groups.get(key);
    group.items.push(issue);
    if (severityRank(issue.severity) < severityRank(group.severity)) {
      group.severity = issue.severity;
    }

    const product = toProductFixInput(issue);
    if (product && !group.seenProductIds.has(product.id)) {
      group.seenProductIds.add(product.id);
      group.uniqueProducts.push(product);
    }
  }

  return Array.from(groups.values())
    .map(({ seenProductIds, ...group }) => ({
      ...group,
      isProductFixable: group.uniqueProducts.length > 0,
    }))
    .sort((a, b) => severityRank(a.severity) - severityRank(b.severity) || b.items.length - a.items.length);
}

function collectTopFixableProducts(issues = [], limit = 5) {
  const sorted = [...issues].sort((a, b) => severityRank(a.severity) - severityRank(b.severity));
  const selected = [];
  const seen = new Set();

  for (const issue of sorted) {
    const product = toProductFixInput(issue);
    if (!product || seen.has(product.id)) continue;
    seen.add(product.id);
    selected.push(product);
    if (selected.length >= limit) break;
  }

  return selected;
}

const PILLAR_ITEMS = [
  { key: "serpScore", label: "SERP Snippet" },
  { key: "contentScore", label: "Content" },
  { key: "technicalScore", label: "Technical" },
  { key: "visualScore", label: "Visual ALT" },
  { key: "cannibalScore", label: "Keywords" },
];

export default function SeoAuditRoute() {
  const loaderData = useLoaderData();
  const scanFetcher = useFetcher();
  const autoFixFetcher = useFetcher();
  const keywordFetcher = useFetcher();
  const aiFetcher = useFetcher();
  const autopilotFetcher = useFetcher();
  const gscFetcher = useFetcher();

  const [severityFilter, setSeverityFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState("grouped");
  const [openGroups, setOpenGroups] = useState({});
  const [groupVisibleLimit, setGroupVisibleLimit] = useState({});
  const [rawVisibleCount, setRawVisibleCount] = useState(40);
  const [fixingKey, setFixingKey] = useState("");
  const [cannibalResult, setCannibalResult] = useState(null);
  const [activeAiAction, setActiveAiAction] = useState("");
  const [appliedIds, setAppliedIds] = useState({});
  const [showAutopilotLogs, setShowAutopilotLogs] = useState(false);
  const [showGscCsv, setShowGscCsv] = useState(false);
  const [showAllQuickWins, setShowAllQuickWins] = useState(false);
  const [gscCsvText, setGscCsvText] = useState("");

  const autopilot = autopilotFetcher.data?.autopilot || loaderData.autopilot || {
    enabled: false,
    optimizeMeta: true,
    optimizeAlt: true,
    lastRuns: [],
  };
  const gsc = gscFetcher.data?.gsc || loaderData.gsc || { connected: false, urlMetrics: [], quickWins: [] };

  const scan =
    autoFixFetcher.data?.scan ||
    keywordFetcher.data?.scan ||
    scanFetcher.data?.scan ||
    loaderData.scan;

  const copilotBrief =
    (aiFetcher.data?.ok && aiFetcher.data?.actionType === "store_copilot" ? aiFetcher.data.result : null) ||
    loaderData.copilotBrief;

  useEffect(() => {
    if (autoFixFetcher.state === "idle") {
      setFixingKey("");
      if (autoFixFetcher.data?.ok && autoFixFetcher.data?.creditsRemaining !== undefined) {
        dispatchCreditsUpdate({
          availableCredits: autoFixFetcher.data.creditsRemaining,
          superAccess: Boolean(autoFixFetcher.data.superAccess),
        });
      }
    }
  }, [autoFixFetcher.state, autoFixFetcher.data]);

  useEffect(() => {
    if (aiFetcher.state === "idle") {
      setActiveAiAction("");
    }
    if (aiFetcher.data?.ok && aiFetcher.data?.creditsRemaining !== undefined) {
      dispatchCreditsUpdate({
        availableCredits: aiFetcher.data.creditsRemaining,
        plan: aiFetcher.data.plan,
        superAccess: Boolean(aiFetcher.data.superAccess),
      });
    }
    if (aiFetcher.data?.ok && aiFetcher.data?.actionType === "catalog_cannibalization") {
      setCannibalResult(aiFetcher.data.result);
      showToast({
        tone: "success",
        title: "Cannibalization Plan Ready",
        message: "Gemini generated distinct focus keyword suggestions below.",
      });
    } else if (aiFetcher.data?.ok && aiFetcher.data?.actionType === "store_copilot") {
      showToast({
        tone: "success",
        title: "AI Action Plan Ready",
        message: "Gemini Executive SEO Plan generated and saved.",
      });
    }
  }, [aiFetcher.state, aiFetcher.data]);

  useEffect(() => {
    if (scanFetcher.state === "idle" && scanFetcher.data?.ok && scanFetcher.data?.scan) {
      showToast({
        tone: "success",
        title: "Audit Scan Complete",
        message: `Store SEO score updated to ${scanFetcher.data.scan.summary?.score ?? 0}/100.`,
      });
    }
  }, [scanFetcher.state, scanFetcher.data]);

  useEffect(() => {
    if (autopilotFetcher.state === "idle" && autopilotFetcher.data?.ok && autopilotFetcher.data?.autopilot) {
      const enabledNow = Boolean(autopilotFetcher.data.autopilot.enabled);
      showToast({
        tone: "success",
        title: enabledNow ? "Autopilot Enabled" : "Autopilot Paused",
        message: enabledNow
          ? "Newly created/imported products will be auto-optimized by Gemini AI."
          : "Background auto-optimization for new products is paused.",
      });
    }
  }, [autopilotFetcher.state, autopilotFetcher.data]);

  useEffect(() => {
    if (gscFetcher.state !== "idle" || !gscFetcher.data) return;
    if (gscFetcher.data.ok && gscFetcher.data.intent === "gscConnect" && gscFetcher.data.authUrl) {
      if (typeof window !== "undefined") {
        (window.top || window).location.href = gscFetcher.data.authUrl;
      }
      return;
    }
    if (gscFetcher.data.ok && gscFetcher.data.intent === "gscSync") {
      showToast({
        tone: "success",
        title: "Search Console Synced",
        message: `Found ${gscFetcher.data.gsc?.summary?.quickWinsCount || 0} quick-win keywords (positions 8-20).`,
      });
    } else if (gscFetcher.data.ok && gscFetcher.data.intent === "gscImportCsv") {
      setShowGscCsv(false);
      setGscCsvText("");
      showToast({
        tone: "success",
        title: "GSC CSV Imported",
        message: `Analyzed ${gscFetcher.data.gsc?.summary?.quickWinsCount || 0} quick-win opportunities (positions 8-20).`,
      });
    } else if (gscFetcher.data.ok && gscFetcher.data.intent === "gscDisconnect") {
      showToast({ tone: "info", title: "Search Console Disconnected", message: "Removed Google Search Console connection." });
    } else if (gscFetcher.data.error) {
      showToast({ tone: "error", title: "Search Console Error", message: gscFetcher.data.error });
    }
  }, [gscFetcher.state, gscFetcher.data]);

  const rawIssues = scan?.issues || [];
  const filteredIssues = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return rawIssues
      .filter((issue) => (severityFilter === "ALL" ? true : issue.severity === severityFilter))
      .filter((issue) => {
        if (!q) return true;
        const haystack = [
          issue.title,
          issue.detail,
          issue.targetUrl,
          issue.meta?.productTitle,
          issue.meta?.handle,
          issue.meta?.focusKeyword,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(q);
      })
      .sort((a, b) => severityRank(a.severity) - severityRank(b.severity));
  }, [rawIssues, severityFilter, searchQuery]);

  const groupedIssues = useMemo(() => groupAuditIssues(filteredIssues), [filteredIssues]);
  const topFixableProducts = useMemo(() => collectTopFixableProducts(rawIssues, 5), [rawIssues]);

  useEffect(() => {
    if (!groupedIssues.length) return;
    setOpenGroups((prev) => {
      if (Object.keys(prev).length > 0) return prev;
      return { [groupedIssues[0].key]: true };
    });
  }, [groupedIssues]);

  const isScanning = scanFetcher.state !== "idle";
  const isAutoFixing = autoFixFetcher.state !== "idle";
  const isAiWorking = aiFetcher.state !== "idle";

  const score = scan?.summary?.score ?? 0;
  const health = scan?.summary?.health || "weak";
  const pillars = scan?.summary?.pillars || {};
  const counts = scan?.summary?.counts || { critical: 0, warning: 0, info: 0 };
  const cannibalGroups = scan?.summary?.cannibalizedGroups || [];

  function handleAutoFix(products, key) {
    if (!products?.length) return;
    setFixingKey(key);
    const formData = new FormData();
    formData.set("intent", "aiAutoFix");
    formData.set("productsJson", JSON.stringify(products.slice(0, 5)));
    autoFixFetcher.submit(formData, { method: "post" });
  }

  function handleRunCopilot() {
    setActiveAiAction("copilot");
    aiFetcher.submit(
      { payload: JSON.stringify({ actionType: "store_copilot" }) },
      { method: "post", action: "/app/api/ai" },
    );
  }

  function handleResolveCannibalization() {
    setActiveAiAction("cannibal");
    aiFetcher.submit(
      { payload: JSON.stringify({ actionType: "catalog_cannibalization" }) },
      { method: "post", action: "/app/api/ai" },
    );
  }

  function handleApplySuggestedKeyword(res) {
    setAppliedIds((prev) => ({ ...prev, [res.productId]: true }));
    const formData = new FormData();
    formData.set("intent", "applyKeyword");
    formData.set("productId", res.productId);
    formData.set("productTitle", res.title || "");
    formData.set("newKeyword", res.suggestedKeyword);
    keywordFetcher.submit(formData, { method: "post" });
  }

  function toggleGroup(key) {
    setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function submitAutopilotSettings(next) {
    const formData = new FormData();
    formData.set("intent", "toggleAutopilot");
    formData.set("enabled", String(Boolean(next.enabled)));
    formData.set("optimizeMeta", String(next.optimizeMeta !== false));
    formData.set("optimizeAlt", String(next.optimizeAlt !== false));
    autopilotFetcher.submit(formData, { method: "post" });
  }

  function handleGscConnect() {
    const formData = new FormData();
    formData.set("intent", "gscConnect");
    if (typeof window !== "undefined") {
      const host = new URLSearchParams(window.location.search).get("host") || "";
      if (host) formData.set("host", host);
    }
    gscFetcher.submit(formData, { method: "post" });
  }

  function handleGscSync(siteUrl = "") {
    const formData = new FormData();
    formData.set("intent", "gscSync");
    if (siteUrl) formData.set("siteUrl", siteUrl);
    gscFetcher.submit(formData, { method: "post" });
  }

  function handleGscImportCsv(event) {
    event.preventDefault();
    if (!gscCsvText.trim()) return;
    const formData = new FormData();
    formData.set("intent", "gscImportCsv");
    formData.set("csvText", gscCsvText);
    gscFetcher.submit(formData, { method: "post" });
  }

  function handleGscCsvFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    file.text().then((content) => setGscCsvText(content)).catch(() => {});
  }

  function handleOptimizeQuickWin(qw, rowKey) {
    setFixingKey(rowKey);
    const formData = new FormData();
    formData.set("intent", "applyGscQuickWin");
    formData.set("productId", qw.productId);
    formData.set("productTitle", qw.productTitle || "");
    formData.set("handle", qw.handle || "");
    formData.set("metaTitle", qw.metaTitle || "");
    formData.set("metaDescription", qw.metaDescription || "");
    formData.set("query", qw.query || "");
    autoFixFetcher.submit(formData, { method: "post" });
  }

  return (
    <div className="seo-wrap">
      <div className="audit-page-stack">
      {loaderData.gscStatus === "connected" ? (
        <section className="status-banner banner-good" data-toast-title="Google Search Console Connected">
          Connected Google Search Console and synced 28-day search clicks, impressions, CTR, and position 8–20 quick wins.
        </section>
      ) : null}

      {loaderData.gscCallbackError ? (
        <section className="status-banner banner-bad" data-toast-title="Google Search Console Error">
          <strong>GSC OAuth Error:</strong> {loaderData.gscCallbackError}
        </section>
      ) : null}
      {loaderData.configError ? (
        <section className="status-banner banner-bad">
          <strong>Shopify config missing:</strong> {loaderData.configError}
        </section>
      ) : null}

      {autoFixFetcher.data?.intent === "aiAutoFix" ? (
        <section className={`status-banner ${autoFixFetcher.data.ok ? "banner-good" : "banner-bad"}`}>
          {autoFixFetcher.data.ok ? (
            <>
              <strong>
                AI fixed {autoFixFetcher.data.fixedCount} product(s) and refreshed your SEO score!
              </strong>{" "}
              {autoFixFetcher.data.fixedProducts
                ?.map((p) => `${p.title}${p.redirectCreated ? " (301 redirect created)" : ""}`)
                .join(" · ")}
              {" · "}
              <span>
                {autoFixFetcher.data.superAccess || loaderData.hasSuperAccess
                  ? "Super Access (0 tokens deducted)."
                  : `Used ${autoFixFetcher.data.creditsDeducted} tokens (${autoFixFetcher.data.creditsRemaining} left).`}
              </span>
              {autoFixFetcher.data.stoppedReason ? (
                <span> {autoFixFetcher.data.stoppedReason}</span>
              ) : null}
            </>
          ) : (
            <>
              <strong>AI Auto-Fix Error:</strong> {autoFixFetcher.data.error}
            </>
          )}
        </section>
      ) : null}

      {keywordFetcher.data?.intent === "applyKeyword" && keywordFetcher.data?.ok ? (
        <section className="status-banner banner-good">
          Applied focus keyword <strong>"{keywordFetcher.data.appliedKeyword}"</strong> and refreshed audit score.
        </section>
      ) : null}

      {aiFetcher.data && !aiFetcher.data.ok ? (
        <section className="status-banner banner-bad">
          <strong>AI Copilot Error:</strong> {aiFetcher.data.error}
        </section>
      ) : null}

      {!loaderData.aiReady && loaderData.aiUnavailableReason ? (
        <section className="status-banner banner-warn">
          <strong>AI Auto-Fix paused:</strong> {loaderData.aiUnavailableReason}
        </section>
      ) : null}

      {/* ── Pro Executive Audit Hero ───────────────────────────────────────────── */}
      <section className="audit-hero">
        <div className="score-ring-wrap">
          <div
            className="score-ring"
            style={{
              "--score": scan ? score : 0,
              "--ring-color": scoreRingColor(score),
            }}
          >
            <div className="score-ring-inner">
              <span className="score-ring-value">{scan ? score : "--"}</span>
              <span className="score-ring-max">/ 100</span>
            </div>
          </div>
          {scan ? (
            <StatusPill tone={healthTone(health)}>{healthLabel(health)}</StatusPill>
          ) : (
            <StatusPill tone="info">Not Scanned</StatusPill>
          )}
        </div>

        <div className="audit-hero-body">
          <div className="audit-hero-top">
            <div className="audit-hero-heading">
              <h1 className="page-title" style={{ margin: 0 }}>
                AI SEO Audit Center
              </h1>
              <p className="seo-muted" style={{ margin: 0 }}>
                {scan ? (
                  <>
                    Scanned <strong>{scan.pagesScanned} pages</strong> ·{" "}
                    <strong>{scan.indexCoverage}%</strong> indexable ·{" "}
                    <strong>{counts.critical}</strong> Critical, <strong>{counts.warning}</strong> Warnings,{" "}
                    <strong>{counts.info}</strong> Info ·{" "}
                    <span>{scan.trend?.label || "Baseline scan"}</span>
                  </>
                ) : (
                  "Run your first store scan to uncover SEO bottlenecks and fix them with 1-Click Gemini AI."
                )}
              </p>
            </div>

            <div className="audit-hero-actions">
              <scanFetcher.Form method="post">
                <input type="hidden" name="intent" value="scan" />
                <button
                  className={`seo-button ${scan ? "secondary" : ""}`}
                  type="submit"
                  disabled={isScanning || Boolean(loaderData.configError)}
                >
                  {isScanning ? "Scanning Catalog..." : scan ? "Re-Scan Store" : "Scan Store Now"}
                </button>
              </scanFetcher.Form>

              {scan && topFixableProducts.length > 0 ? (
                <button
                  type="button"
                  className="seo-button"
                  disabled={!loaderData.aiReady || isAutoFixing}
                  onClick={() => handleAutoFix(topFixableProducts, "top5")}
                  title={
                    loaderData.aiReady
                      ? `Automatically optimize top ${topFixableProducts.length} broken products in Shopify`
                      : loaderData.aiUnavailableReason
                  }
                >
                  {isAutoFixing && fixingKey === "top5"
                    ? "AI Fixing Top Issues..."
                    : `AI Fix Top ${topFixableProducts.length} (${
                        loaderData.hasSuperAccess
                          ? "Super"
                          : `${topFixableProducts.length * CREDIT_COSTS.product_seo_fix} tok`
                      })`}
                </button>
              ) : null}

              {scan ? (
                <button
                  type="button"
                  className="seo-button secondary"
                  disabled={!loaderData.aiReady || isAiWorking}
                  onClick={handleRunCopilot}
                  title={`Generate a prioritized store-wide Gemini SEO action plan (${CREDIT_COSTS.store_copilot} tokens)`}
                >
                  {isAiWorking && activeAiAction === "copilot"
                    ? "Analyzing Store..."
                    : copilotBrief
                      ? `Refresh AI Plan (${loaderData.hasSuperAccess ? "Super" : `${CREDIT_COSTS.store_copilot} tok`})`
                      : `AI Action Plan (${loaderData.hasSuperAccess ? "Super" : `${CREDIT_COSTS.store_copilot} tok`})`}
                </button>
              ) : null}

              <Link to="/app/pagespeed" className="seo-button secondary">
                ⚡ Live PageSpeed Test
              </Link>
            </div>
          </div>

          {scan?.summary?.pillars ? (
            <div className="audit-pillar-row">
              {PILLAR_ITEMS.map((pillar) => {
                const value = pillars[pillar.key] ?? 0;
                return (
                  <div className="audit-pillar-chip" key={pillar.key}>
                    <div className="audit-pillar-chip-head">
                      <span>{pillar.label}</span>
                      <span>{value}</span>
                    </div>
                    <div className="audit-pillar-bar">
                      <div
                        className="audit-pillar-bar-fill"
                        style={{
                          width: `${Math.max(0, Math.min(100, value))}%`,
                          background: scoreRingColor(value),
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      </section>

      {/* ── Autopilot Webhook & Google Search Console Hub ─────────────────────── */}
      <section id="autopilot" className="section-card" style={{ display: "grid", gap: "14px" }}>
        <div className="section-header" style={{ alignItems: "center" }}>
          <div style={{ display: "grid", gap: "4px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
              <h2 style={{ margin: 0, fontSize: "16px" }}>Auto-Optimize New Products (Autopilot)</h2>
              <StatusPill tone={autopilot.enabled ? "good" : "info"}>
                {autopilot.enabled ? "Autopilot ON" : "Paused"}
              </StatusPill>
            </div>
            <p className="seo-muted" style={{ fontSize: "13px" }}>
              Automatically optimize meta title, meta description, focus keyword, and Vision image ALT text whenever a product is created or imported.
            </p>
          </div>

          <div className="button-row">
            <label style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12.5px", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={autopilot.optimizeMeta !== false}
                disabled={autopilotFetcher.state !== "idle"}
                onChange={(e) =>
                  submitAutopilotSettings({
                    enabled: autopilot.enabled,
                    optimizeMeta: e.target.checked,
                    optimizeAlt: autopilot.optimizeAlt,
                  })
                }
              />
              <span>Meta &amp; Keywords ({CREDIT_COSTS.product_seo_fix} tok)</span>
            </label>
            <label style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12.5px", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={autopilot.optimizeAlt !== false}
                disabled={autopilotFetcher.state !== "idle"}
                onChange={(e) =>
                  submitAutopilotSettings({
                    enabled: autopilot.enabled,
                    optimizeMeta: autopilot.optimizeMeta,
                    optimizeAlt: e.target.checked,
                  })
                }
              />
              <span>Image ALT Vision ({CREDIT_COSTS.vision_alt} tok/img)</span>
            </label>
            <button
              type="button"
              className={`seo-button ${autopilot.enabled ? "secondary" : ""}`}
              style={{ padding: "7px 14px", fontSize: "12.5px" }}
              disabled={autopilotFetcher.state !== "idle" || Boolean(loaderData.configError)}
              onClick={() =>
                submitAutopilotSettings({
                  enabled: !autopilot.enabled,
                  optimizeMeta: autopilot.optimizeMeta,
                  optimizeAlt: autopilot.optimizeAlt,
                })
              }
            >
              {autopilotFetcher.state !== "idle"
                ? "Saving..."
                : autopilot.enabled
                  ? "Pause Autopilot"
                  : "Enable Autopilot"}
            </button>
            {autopilot.lastRuns?.length ? (
              <button
                type="button"
                className="seo-button secondary"
                style={{ padding: "7px 12px", fontSize: "12px" }}
                onClick={() => setShowAutopilotLogs((prev) => !prev)}
              >
                {showAutopilotLogs ? "Hide Activity ▲" : `Activity (${autopilot.lastRuns.length}) ▼`}
              </button>
            ) : null}
          </div>
        </div>

        {showAutopilotLogs && autopilot.lastRuns?.length ? (
          <div style={{ overflowX: "auto", borderTop: "1px solid var(--seo-border-soft)", paddingTop: "12px" }}>
            <table className="credit-usage-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Product</th>
                  <th>Status</th>
                  <th>Updates</th>
                  <th>Credits</th>
                </tr>
              </thead>
              <tbody>
                {autopilot.lastRuns.slice(0, 10).map((run, idx) => (
                  <tr key={`${run.productId}-${idx}`}>
                    <td suppressHydrationWarning>{new Date(run.createdAt).toLocaleString()}</td>
                    <td>
                      <Link className="seo-inline-link" to={`/app/products?focus=${run.productId}`}>
                        {run.productTitle || `Product #${run.productId}`}
                      </Link>
                      {run.error ? (
                        <div className="seo-muted" style={{ fontSize: "11px", color: "var(--seo-bad)" }}>
                          {run.error}
                        </div>
                      ) : null}
                    </td>
                    <td>
                      <StatusPill
                        tone={
                          run.status === "COMPLETED"
                            ? "good"
                            : run.status === "FAILED" || run.status === "SKIPPED"
                              ? "warning"
                              : "info"
                        }
                      >
                        {run.status}
                      </StatusPill>
                    </td>
                    <td style={{ fontSize: "12px" }}>
                      {run.metaUpdated ? "Meta + Keyword" : "Meta skipped"} · {run.imagesUpdated || 0} ALT img(s)
                    </td>
                    <td>{run.creditsDeducted ? `-${run.creditsDeducted} tok` : "0 tok"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      {/* ── Google Search Console & Position 8-20 Quick Wins ──────────────────── */}
      <section id="gsc" className="section-card" style={{ display: "grid", gap: "14px" }}>
        <div className="section-header" style={{ alignItems: "center" }}>
          <div style={{ display: "grid", gap: "4px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
              <h2 style={{ margin: 0, fontSize: "16px" }}>Google Search Console &amp; Quick-Win Keywords</h2>
              <StatusPill tone={gsc.connected ? "good" : "info"}>
                {gsc.connected ? `Connected (${gsc.mode === "csv" ? "CSV" : "Live API"})` : "Not Connected"}
              </StatusPill>
            </div>
            <p className="seo-muted" style={{ fontSize: "13px" }}>
              {gsc.connected
                ? `Property: ${gsc.siteUrl} · Identifies page-2 keywords ranking in positions 8–20 for Gemini Copilot & 1-click AI boosts.`
                : "Connect Google Search Console (or upload a GSC CSV export) to track real clicks, impressions, CTR, and position 8–20 quick wins."}
            </p>
          </div>

          <div className="button-row">
            {gsc.connected && gsc.mode === "oauth" ? (
              <button
                type="button"
                className="seo-button secondary"
                style={{ padding: "7px 12px", fontSize: "12.5px" }}
                disabled={gscFetcher.state !== "idle"}
                onClick={() => handleGscSync("")}
              >
                {gscFetcher.state !== "idle" ? "Syncing..." : "Sync GSC Now"}
              </button>
            ) : null}

            <button
              type="button"
              className="seo-button secondary"
              style={{ padding: "7px 12px", fontSize: "12.5px" }}
              onClick={() => setShowGscCsv((prev) => !prev)}
            >
              {showGscCsv ? "Hide CSV Import" : "Import GSC CSV"}
            </button>

            {gsc.connected ? (
              <gscFetcher.Form method="post">
                <input type="hidden" name="intent" value="gscDisconnect" />
                <button
                  type="submit"
                  className="seo-button secondary"
                  style={{ padding: "7px 12px", fontSize: "12.5px" }}
                  disabled={gscFetcher.state !== "idle"}
                >
                  Disconnect
                </button>
              </gscFetcher.Form>
            ) : (
              <button
                type="button"
                className="seo-button"
                style={{ padding: "7px 14px", fontSize: "12.5px" }}
                disabled={gscFetcher.state !== "idle" || !loaderData.gscOAuthConfigured}
                onClick={handleGscConnect}
                title={
                  loaderData.gscOAuthConfigured
                    ? "Connect your verified Google Search Console property"
                    : "Admin can add Google OAuth Client ID/Secret in /superadmin/ai, or use Import GSC CSV"
                }
              >
                {gscFetcher.state !== "idle"
                  ? "Connecting..."
                  : loaderData.gscOAuthConfigured
                    ? "Connect Google Search Console"
                    : "GSC OAuth Not Configured (Use CSV)"}
              </button>
            )}
          </div>
        </div>

        {showGscCsv ? (
          <form
            onSubmit={handleGscImportCsv}
            style={{
              background: "#f8fafc",
              border: "1px solid var(--seo-border-soft)",
              borderRadius: "8px",
              padding: "14px",
              display: "grid",
              gap: "10px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
              <strong style={{ fontSize: "13px" }}>Upload or Paste Google Search Console CSV (Pages / Queries)</strong>
              <input type="file" accept=".csv,text/csv" onChange={handleGscCsvFile} style={{ fontSize: "12px" }} />
            </div>
            <textarea
              className="seo-textarea"
              rows={4}
              value={gscCsvText}
              onChange={(e) => setGscCsvText(e.target.value)}
              placeholder={"Page,Query,Clicks,Impressions,CTR,Position\nhttps://yourstore.myshopify.com/products/leather-wallet,slim leather wallet,24,680,3.53%,11.4"}
            />
            <div className="button-row">
              <button
                type="submit"
                className="seo-button"
                style={{ padding: "7px 14px", fontSize: "12.5px" }}
                disabled={gscFetcher.state !== "idle" || !gscCsvText.trim()}
              >
                {gscFetcher.state !== "idle" ? "Importing..." : "Analyze Search Console CSV"}
              </button>
            </div>
          </form>
        ) : null}

        {gsc.connected && gsc.summary ? (
          <>
            <div className="seo-grid grid-4" style={{ gap: "12px" }}>
              <div className="audit-pillar-chip">
                <div className="audit-pillar-chip-head"><span>Clicks (28d)</span></div>
                <strong style={{ fontSize: "20px" }}>{gsc.summary.totalClicks}</strong>
              </div>
              <div className="audit-pillar-chip">
                <div className="audit-pillar-chip-head"><span>Impressions (28d)</span></div>
                <strong style={{ fontSize: "20px" }}>{gsc.summary.totalImpressions}</strong>
              </div>
              <div className="audit-pillar-chip">
                <div className="audit-pillar-chip-head"><span>Avg CTR</span></div>
                <strong style={{ fontSize: "20px" }}>{gsc.summary.avgCtr}%</strong>
              </div>
              <div className="audit-pillar-chip">
                <div className="audit-pillar-chip-head"><span>Quick Wins (Pos 8–20)</span></div>
                <strong style={{ fontSize: "20px", color: "var(--seo-primary)" }}>{gsc.summary.quickWinsCount}</strong>
              </div>
            </div>

            {gsc.mode === "oauth" && gsc.availableSites?.length > 1 ? (
              <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                <small className="seo-muted">Switch property:</small>
                <select
                  className="seo-input"
                  style={{ width: "auto", minWidth: "240px", height: "34px", padding: "4px 10px" }}
                  value={gsc.siteUrl}
                  onChange={(e) => handleGscSync(e.target.value)}
                >
                  {gsc.availableSites.map((s) => (
                    <option key={s.siteUrl} value={s.siteUrl}>
                      {s.siteUrl}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {gsc.quickWins?.length ? (
              <div style={{ display: "grid", gap: "10px" }}>
                <div style={{ overflowX: "auto" }}>
                  <table className="credit-usage-table">
                    <thead>
                      <tr>
                        <th>Quick-Win Query (Pos 8–20)</th>
                        <th>Page / Product</th>
                        <th>Position</th>
                        <th>Impressions / Clicks</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(showAllQuickWins ? gsc.quickWins : gsc.quickWins.slice(0, 5)).map((qw, idx) => {
                        const rowKey = `gsc-qw:${qw.productId || idx}:${qw.query}`;
                        return (
                          <tr key={rowKey}>
                            <td>
                              <strong>{qw.query}</strong>
                            </td>
                            <td>
                              {qw.productId ? (
                                <Link className="seo-inline-link" to={`/app/products?focus=${qw.productId}`}>
                                  {qw.productTitle || qw.path}
                                </Link>
                              ) : (
                                <span className="seo-muted" style={{ fontSize: "12px" }}>{qw.path}</span>
                              )}
                            </td>
                            <td>
                              <StatusPill tone={qw.position <= 12 ? "warning" : "info"}>
                                Pos {qw.position}
                              </StatusPill>
                            </td>
                            <td style={{ fontSize: "12px" }}>
                              {qw.impressions} impr · {qw.clicks} clicks ({qw.ctr}% CTR)
                            </td>
                            <td>
                              {qw.productId ? (
                                <button
                                  type="button"
                                  className="seo-button"
                                  style={{ padding: "5px 10px", fontSize: "12px" }}
                                  disabled={!loaderData.aiReady || isAutoFixing}
                                  onClick={() => handleOptimizeQuickWin(qw, rowKey)}
                                >
                                  {isAutoFixing && fixingKey === rowKey
                                    ? "Optimizing..."
                                    : `AI Target Keyword (${
                                        loaderData.hasSuperAccess ? "Super" : `${CREDIT_COSTS.product_seo_fix} tok`
                                      })`}
                                </button>
                              ) : (
                                <span className="seo-muted" style={{ fontSize: "11.5px" }}>Non-product URL</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {gsc.quickWins.length > 5 ? (
                  <div>
                    <button
                      type="button"
                      className="seo-button secondary"
                      style={{ padding: "5px 12px", fontSize: "12px" }}
                      onClick={() => setShowAllQuickWins((prev) => !prev)}
                    >
                      {showAllQuickWins
                        ? "Show Top 5 ▲"
                        : `Show All ${gsc.quickWins.length} Quick Wins ▼`}
                    </button>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="status-banner" data-no-toast="true">
                No ranking queries found in positions 8–20 yet. Sync again once pages gather search impressions.
              </div>
            )}
          </>
        ) : null}
      </section>

      {/* ── Persisted Gemini Executive Copilot Brief ───────────────────────────── */}
      {copilotBrief ? (
        <section className="ai-diff-card">
          <div className="ai-diff-head">
            <div>
              <h4 style={{ margin: 0 }}>Gemini Executive SEO Plan</h4>
              <p className="seo-muted" style={{ margin: "2px 0 0", fontSize: "12px" }}>
                Priority Focus: <strong>{copilotBrief.priorityFocus}</strong>
                {copilotBrief.generatedAt ? (
                  <span suppressHydrationWarning>
                    {" "}· Saved {new Date(copilotBrief.generatedAt).toLocaleString()}
                  </span>
                ) : null}
              </p>
            </div>
            <span className="ctr-badge">{copilotBrief.scoreProjection}</span>
          </div>

          <p style={{ margin: 0, fontSize: "14px", lineHeight: 1.5 }}>{copilotBrief.executiveSummary}</p>

          {copilotBrief.topQuickWins?.length ? (
            <div className="seo-grid grid-2" style={{ gap: "10px" }}>
              {copilotBrief.topQuickWins.map((win, idx) => (
                <div
                  key={idx}
                  style={{
                    background: "#ffffff",
                    border: "1px solid var(--seo-border-soft)",
                    borderRadius: "8px",
                    padding: "12px",
                    display: "grid",
                    gap: "6px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
                    <strong style={{ fontSize: "13px" }}>{win.title}</strong>
                    <StatusPill tone="good">
                      {win.impact} Impact · {win.effort} Effort
                    </StatusPill>
                  </div>
                  <p style={{ margin: 0, fontSize: "13px", color: "var(--seo-muted)" }}>{win.action}</p>
                  {win.targetPath ? (
                    <div>
                      <Link className="seo-inline-link" to={win.targetPath}>
                        Open Workspace →
                      </Link>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}

          {copilotBrief.gscQuickWinAdvice?.length ? (
            <div style={{ display: "grid", gap: "8px" }}>
              <strong style={{ fontSize: "13px" }}>Search Console Position 8–20 Quick Wins (Gemini Advice):</strong>
              <div className="seo-grid grid-2" style={{ gap: "10px" }}>
                {copilotBrief.gscQuickWinAdvice.map((item, idx) => (
                  <div
                    key={`gsc-adv-${idx}`}
                    style={{
                      background: "#ffffff",
                      border: "1px solid var(--seo-border-soft)",
                      borderRadius: "8px",
                      padding: "11px 12px",
                      display: "grid",
                      gap: "4px",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
                      <strong style={{ fontSize: "12.5px" }}>{item.query || "Ranking Opportunity"}</strong>
                      {item.pagePath ? <code style={{ fontSize: "11px" }}>{item.pagePath}</code> : null}
                    </div>
                    <p style={{ margin: 0, fontSize: "12.5px", color: "var(--seo-muted)" }}>{item.recommendation}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {copilotBrief.riskAlert ? (
            <div className="diff-verdict">
              <p>
                <strong>Risk Watch:</strong> {copilotBrief.riskAlert}
              </p>
            </div>
          ) : null}
        </section>
      ) : null}

      {/* ── Keyword Cannibalization Resolver (Only when conflicts exist) ───────── */}
      {cannibalGroups.length > 0 ? (
        <section className="section-card">
          <div className="section-header" style={{ flexWrap: "wrap", gap: "12px" }}>
            <div>
              <h2>Keyword Cannibalization Alerts ({cannibalGroups.length})</h2>
              <p className="seo-muted">
                Multiple products target the exact same focus keyword. Let AI assign distinct buying-intent keywords.
              </p>
            </div>
            <button
              type="button"
              className="seo-button secondary"
              disabled={!loaderData.aiReady || isAiWorking}
              onClick={handleResolveCannibalization}
            >
              {isAiWorking && activeAiAction === "cannibal"
                ? "Resolving Conflicts..."
                : `AI Resolve All (${
                    loaderData.hasSuperAccess ? "Super" : `${CREDIT_COSTS.catalog_cannibalization} tok`
                  })`}
            </button>
          </div>

          <div style={{ display: "grid", gap: "10px" }}>
            {cannibalGroups.map((group) => (
              <div key={group.keyword} className="issue-product-row">
                <div className="issue-product-info">
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                    <StatusPill tone="warning">Duplicate: "{group.keyword}"</StatusPill>
                    <span className="seo-muted" style={{ fontSize: "12px" }}>
                      Shared by {group.count} products
                    </span>
                  </div>
                  <div className="issue-product-meta">
                    {group.products?.map((p) => (
                      <Link key={p.id} className="seo-inline-link" to={`/app/products?focus=${p.id}`}>
                        {p.title}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {cannibalResult?.resolutions?.length ? (
            <div className="ai-diff-card" style={{ marginTop: "8px" }}>
              <div className="ai-diff-head">
                <h4>Gemini Cannibalization Resolution Plan</h4>
                <StatusPill tone="good">{cannibalResult.resolutions.length} Suggestions</StatusPill>
              </div>
              <p style={{ margin: 0, fontSize: "13px" }}>{cannibalResult.summary}</p>
              <div style={{ overflowX: "auto" }}>
                <table className="credit-usage-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Old Keyword</th>
                      <th>New AI Keyword</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cannibalResult.resolutions.map((res, idx) => {
                      const isApplied = Boolean(appliedIds[res.productId]);
                      return (
                        <tr key={idx}>
                          <td>
                            <strong>{res.title || `Product ${res.productId}`}</strong>
                            {res.reason ? (
                              <div className="seo-muted" style={{ fontSize: "11px" }}>
                                {res.reason}
                              </div>
                            ) : null}
                          </td>
                          <td>
                            <StatusPill tone="warning">{res.currentKeyword}</StatusPill>
                          </td>
                          <td>
                            <StatusPill tone="good">{res.suggestedKeyword}</StatusPill>
                          </td>
                          <td>
                            <button
                              type="button"
                              className="seo-button"
                              style={{ padding: "5px 10px", fontSize: "12px" }}
                              disabled={isApplied || keywordFetcher.state !== "idle"}
                              onClick={() => handleApplySuggestedKeyword(res)}
                            >
                              {isApplied ? "Applied" : "Apply Keyword"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {/* ── Smart Grouped Issues & 1-Click AI Fixes ───────────────────────────── */}
      {scan ? (
        <section id="issues" className="section-card audit-section">
          <div className="audit-toolbar">
            <div>
              <h2 style={{ margin: "0 0 4px" }}>
                {viewMode === "grouped"
                  ? `Actionable Issue Groups (${groupedIssues.length})`
                  : `All Findings (${filteredIssues.length})`}
              </h2>
              <p className="seo-muted" style={{ margin: 0 }}>
                Grouped by root cause. Click AI Fix to optimize & apply directly to Shopify with auto 301 redirects.
              </p>
            </div>

            <div className="audit-toolbar-controls">
              <input
                type="search"
                className="seo-input"
                style={{ width: "210px" }}
                placeholder="Filter product or issue..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />

              <div className="view-toggle" role="group" aria-label="Filter by severity">
                {["ALL", "Critical", "Warning", "Info"].map((level) => (
                  <button
                    key={level}
                    type="button"
                    className={`view-toggle-btn ${severityFilter === level ? "active" : ""}`}
                    onClick={() => setSeverityFilter(level)}
                  >
                    {level}
                  </button>
                ))}
              </div>

              <div className="view-toggle" role="tablist" aria-label="Issue display mode">
                <button
                  type="button"
                  className={`view-toggle-btn ${viewMode === "grouped" ? "active" : ""}`}
                  onClick={() => setViewMode("grouped")}
                >
                  Smart Groups
                </button>
                <button
                  type="button"
                  className={`view-toggle-btn ${viewMode === "raw" ? "active" : ""}`}
                  onClick={() => setViewMode("raw")}
                >
                  All Items ({filteredIssues.length})
                </button>
              </div>
            </div>
          </div>

          {!filteredIssues.length ? (
            <div className="status-banner banner-good" data-no-toast="true">
              No SEO issues match the current filter. Great job!
            </div>
          ) : viewMode === "grouped" ? (
            <div className="issue-group-list">
              {groupedIssues.map((group) => {
                const isOpen = Boolean(openGroups[group.key]);
                const batchProducts = group.uniqueProducts.slice(0, 5);
                const groupFixKey = `group:${group.key}`;

                return (
                  <div className="issue-group-card" key={group.key}>
                    <div
                      className="issue-group-head"
                      onClick={() => toggleGroup(group.key)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          toggleGroup(group.key);
                        }
                      }}
                    >
                      <div className="issue-group-title-wrap">
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                          <StatusPill tone={severityTone(group.severity)}>{group.severity}</StatusPill>
                          <h3 className="issue-group-title">{group.title}</h3>
                          <StatusPill tone="info">
                            {group.items.length} {group.items.length === 1 ? "item" : "items"}
                          </StatusPill>
                        </div>
                        <span className="seo-muted" style={{ fontSize: "13px" }}>
                          {group.detail}
                        </span>
                      </div>

                      <div
                        className="button-row"
                        style={{ alignItems: "center" }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {group.isProductFixable ? (
                          <button
                            type="button"
                            className="seo-button"
                            style={{ padding: "7px 12px", fontSize: "12px" }}
                            disabled={!loaderData.aiReady || isAutoFixing}
                            onClick={() => handleAutoFix(batchProducts, groupFixKey)}
                          >
                            {isAutoFixing && fixingKey === groupFixKey
                              ? "Fixing..."
                              : batchProducts.length === 1
                                ? `AI Fix (${loaderData.hasSuperAccess ? "Super" : `${CREDIT_COSTS.product_seo_fix} tok`})`
                                : `AI Fix Top ${batchProducts.length} (${
                                    loaderData.hasSuperAccess
                                      ? "Super"
                                      : `${batchProducts.length * CREDIT_COSTS.product_seo_fix} tok`
                                  })`}
                          </button>
                        ) : (
                          <Link
                            className="seo-button secondary"
                            style={{ padding: "7px 12px", fontSize: "12px" }}
                            to={group.fixPath}
                          >
                            Open Fix Tool →
                          </Link>
                        )}
                        <button
                          type="button"
                          className="seo-button secondary"
                          style={{ padding: "7px 10px", fontSize: "12px" }}
                          onClick={() => toggleGroup(group.key)}
                        >
                          {isOpen ? "Hide ▲" : `Inspect (${group.items.length}) ▼`}
                        </button>
                      </div>
                    </div>

                    {isOpen ? (
                      <div className="issue-group-body">
                        {group.isProductFixable ? (
                          <>
                            {group.uniqueProducts
                              .slice(0, groupVisibleLimit[group.key] || 25)
                              .map((product) => {
                                const rowFixKey = `product:${product.id}`;
                                return (
                                  <div className="issue-product-row" key={product.id}>
                                    <div className="issue-product-info">
                                      <strong>
                                        {product.title ||
                                          (product.handle ? `/products/${product.handle}` : `Product #${product.id}`)}
                                      </strong>
                                      <div className="issue-product-meta">
                                        <span className="issue-meta-chip">
                                          /products/{product.handle || product.id}
                                        </span>
                                        <span className={`issue-meta-chip ${product.focusKeyword ? "" : "missing"}`}>
                                          Keyword: {product.focusKeyword ? `"${product.focusKeyword}"` : "Missing"}
                                        </span>
                                        <span className={`issue-meta-chip ${product.metaTitle ? "" : "missing"}`}>
                                          Meta Title: {product.metaTitle ? `${product.metaTitle.length} chars` : "Missing"}
                                        </span>
                                        <span className={`issue-meta-chip ${product.metaDescription ? "" : "missing"}`}>
                                          Meta Desc:{" "}
                                          {product.metaDescription ? `${product.metaDescription.length} chars` : "Missing"}
                                        </span>
                                      </div>
                                    </div>
                                    <div className="button-row" style={{ alignItems: "center" }}>
                                      <button
                                        type="button"
                                        className="seo-button"
                                        style={{ padding: "6px 11px", fontSize: "12px" }}
                                        disabled={!loaderData.aiReady || isAutoFixing}
                                        onClick={() => handleAutoFix([product], rowFixKey)}
                                      >
                                        {isAutoFixing && fixingKey === rowFixKey
                                          ? "AI Fixing..."
                                          : `1-Click AI Fix (${
                                              loaderData.hasSuperAccess ? "Super" : `${CREDIT_COSTS.product_seo_fix} tok`
                                            })`}
                                      </button>
                                      <Link
                                        className="seo-button secondary"
                                        style={{ padding: "6px 11px", fontSize: "12px" }}
                                        to={product.fixPath}
                                      >
                                        Edit
                                      </Link>
                                    </div>
                                  </div>
                                );
                              })}
                            {group.uniqueProducts.length > (groupVisibleLimit[group.key] || 25) ? (
                              <div className="toolbar" style={{ marginTop: 8, marginBottom: 0 }}>
                                <button
                                  type="button"
                                  className="seo-button secondary"
                                  style={{ padding: "6px 12px", fontSize: 12 }}
                                  onClick={() =>
                                    setGroupVisibleLimit((prev) => ({
                                      ...prev,
                                      [group.key]: (prev[group.key] || 25) + 50,
                                    }))
                                  }
                                >
                                  Show more ({group.uniqueProducts.length - (groupVisibleLimit[group.key] || 25)} remaining)
                                </button>
                              </div>
                            ) : null}
                          </>
                        ) : (
                          group.items.slice(0, groupVisibleLimit[group.key] || 25).map((item) => (
                            <div className="issue-product-row" key={item.id}>
                              <div className="issue-product-info">
                                <strong>{item.title}</strong>
                                <div className="issue-product-meta">
                                  <span>{item.targetUrl}</span>
                                </div>
                              </div>
                              <Link
                                className="seo-button secondary"
                                style={{ padding: "6px 11px", fontSize: "12px" }}
                                to={item.fixPath}
                              >
                                Open Fix Tool →
                              </Link>
                            </div>
                          ))
                        )}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="issue-list">
              {filteredIssues.slice(0, rawVisibleCount).map((issue) => {
                const product = toProductFixInput(issue);
                const rowFixKey = product ? `raw:${issue.id}` : "";
                return (
                  <article className="issue-card" key={issue.id}>
                    <div className="issue-head">
                      <div>
                        <StatusPill tone={severityTone(issue.severity)}>{issue.severity}</StatusPill>{" "}
                        <strong>{issue.title}</strong>
                      </div>
                      <div className="button-row" style={{ alignItems: "center" }}>
                        {product ? (
                          <button
                            type="button"
                            className="seo-button"
                            style={{ padding: "5px 10px", fontSize: "12px" }}
                            disabled={!loaderData.aiReady || isAutoFixing}
                            onClick={() => handleAutoFix([product], rowFixKey)}
                          >
                            {isAutoFixing && fixingKey === rowFixKey
                              ? "Fixing..."
                              : `1-Click AI Fix (${
                                  loaderData.hasSuperAccess ? "Super" : `${CREDIT_COSTS.product_seo_fix} tok`
                                })`}
                          </button>
                        ) : null}
                        <Link
                          className="seo-button secondary"
                          style={{ padding: "5px 10px", fontSize: "12px" }}
                          to={issue.fixPath}
                        >
                          Open Fix Tool →
                        </Link>
                      </div>
                    </div>
                    <p className="issue-url">
                      {issue.meta?.productTitle ? `${issue.meta.productTitle} — ` : ""}
                      {issue.targetUrl}
                    </p>
                    <p className="seo-muted">{issue.detail}</p>
                  </article>
                );
              })}
              {filteredIssues.length > rawVisibleCount ? (
                <div className="toolbar" style={{ marginTop: 8 }}>
                  <button
                    type="button"
                    className="seo-button secondary"
                    onClick={() => setRawVisibleCount((prev) => prev + 60)}
                  >
                    Show more issues ({filteredIssues.length - rawVisibleCount} remaining)
                  </button>
                </div>
              ) : null}
            </div>
          )}
        </section>
      ) : null}
      </div>
    </div>
  );
}
