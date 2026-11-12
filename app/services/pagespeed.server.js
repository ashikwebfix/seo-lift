const PAGESPEED_ENDPOINT = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";

const AUDIT_GUIDANCE = Object.freeze({
  "largest-contentful-paint-element": {
    metricTarget: "LCP",
    fixMode: "THEME_MANUAL",
    inAppTarget: "",
    fileHint: "sections/main-product.liquid or layout/theme.liquid",
    title: "Preload & prioritize LCP hero image",
    steps:
      "Add fetchpriority=\"high\" on your primary above-the-fold hero/product image and remove loading=\"lazy\" from the first visible image.",
    snippet: `<link rel="preload" as="image" href="{{ product.featured_image | image_url: width: 1200 }}" fetchpriority="high">\n{{ product.featured_image | image_url: width: 1200 | image_tag: fetchpriority: 'high', loading: 'eager', widths: '400, 800, 1200' }}`,
  },
  "render-blocking-resources": {
    metricTarget: "FCP / LCP",
    fixMode: "THEME_MANUAL",
    inAppTarget: "",
    fileHint: "layout/theme.liquid",
    title: "Defer non-critical CSS and render-blocking scripts",
    steps:
      "Move non-essential scripts to defer or async, and inline tiny critical above-the-fold styles in layout/theme.liquid.",
    snippet: `<!-- Non-blocking script & stylesheet loading in layout/theme.liquid -->\n<script src="{{ 'theme.js' | asset_url }}" defer></script>\n<link rel="stylesheet" href="{{ 'custom-extra.css' | asset_url }}" media="print" onload="this.media='all'">`,
  },
  "unused-javascript": {
    metricTarget: "INP / TBT",
    fixMode: "APP_BLOAT",
    inAppTarget: "",
    fileHint: "Online Store → Themes → Customize → App embeds",
    title: "Trim heavy or unused third-party app JavaScript",
    steps:
      "Disable unused Shopify App Embeds in Theme Customizer and uninstall leftover app script tags injected into theme.liquid.",
    snippet: `{%- comment -%} Load heavy widgets only on pages that need them {%- endcomment -%}\n{% if template.name == 'product' %}\n  {{ 'product-widget.js' | asset_url | script_tag }}\n{% endif %}`,
  },
  "bootup-time": {
    metricTarget: "INP / TBT",
    fixMode: "APP_BLOAT",
    inAppTarget: "",
    fileHint: "Online Store → Themes → Customize → App embeds",
    title: "Reduce JavaScript execution & main-thread blocking",
    steps:
      "Audit the heavy script URLs below. Disable redundant chat widgets, popups, or duplicate tracking pixels firing on initial page load.",
    snippet: `<!-- Delay non-essential analytics/widgets until user interaction -->\n<script>\n  window.addEventListener('pointerdown', function loadDeferred() {\n    // initialize non-critical widget here\n  }, { once: true, passive: true });\n</script>`,
  },
  "third-party-summary": {
    metricTarget: "INP / LCP",
    fixMode: "APP_BLOAT",
    inAppTarget: "",
    fileHint: "Shopify Admin → Settings → Customer events / Theme App Embeds",
    title: "Consolidate heavy third-party Shopify scripts",
    steps:
      "Review third-party script execution costs below. Consolidate pixels into Shopify Web Pixels and disable unused theme app embeds.",
    snippet: "",
  },
  "uses-optimized-images": {
    metricTarget: "LCP",
    fixMode: "IN_APP_AUTO",
    inAppTarget: "/app/image-optimizer?tab=compression",
    fileHint: "Image Compression + Shopify Liquid image_url filter",
    title: "Compress oversized images & use modern width/format",
    steps:
      "Compress oversized product images in Image Compression (0 AI tokens) and ensure Liquid templates render responsive Shopify CDN sizes via image_url + image_tag.",
    snippet: `{{ image | image_url: width: 1000 | image_tag: widths: '360, 540, 720, 1000', sizes: '(min-width: 990px) 50vw, 100vw', loading: 'lazy' }}`,
  },
  "modern-image-formats": {
    metricTarget: "LCP",
    fixMode: "IN_APP_AUTO",
    inAppTarget: "/app/image-optimizer?tab=compression",
    fileHint: "Image Compression (WebP / Smart) & Sections / Snippets",
    title: "Serve WebP/AVIF & convert bloated legacy PNGs",
    steps:
      "Run Image Compression with WebP or Smart PageSpeed format, and replace hardcoded img URLs with Shopify's image_url filter.",
    snippet: `{{ product.featured_image | image_url: width: 900 | image_tag: loading: 'eager', decoding: 'async' }}`,
  },
  "uses-responsive-images": {
    metricTarget: "LCP",
    fixMode: "IN_APP_AUTO",
    inAppTarget: "/app/image-optimizer?tab=compression",
    fileHint: "Image Compression + Sections / Snippets rendering product cards",
    title: "Cap oversized source pixels & deliver responsive srcset widths",
    steps:
      "Cap 3000px+ source uploads to 1600-2048px inside Image Compression and add responsive widths and sizes attributes in Liquid.",
    snippet: `{{ card_product.featured_media | image_url: width: 720 | image_tag: widths: '240, 360, 540, 720', sizes: '(max-width: 749px) 50vw, 25vw', loading: 'lazy' }}`,
  },
  "offscreen-images": {
    metricTarget: "LCP / Bandwidth",
    fixMode: "THEME_MANUAL",
    inAppTarget: "",
    fileHint: "Collection grid / footer snippets",
    title: "Lazy-load below-the-fold product cards and footer media",
    steps:
      "Add loading=\"lazy\" on collection grid images below row 1, related products, and footer badges.",
    snippet: `{{ block.settings.image | image_url: width: 800 | image_tag: loading: 'lazy', decoding: 'async' }}`,
  },
  "unsized-images": {
    metricTarget: "CLS",
    fixMode: "THEME_MANUAL",
    inAppTarget: "",
    fileHint: "Theme CSS / Product card & banner templates",
    title: "Reserve explicit width & height to stop layout shifts (CLS)",
    steps:
      "Ensure every <img> specifies explicit width and height HTML attributes (Shopify's image_tag adds them automatically) or CSS aspect-ratio.",
    snippet: `<img src="{{ img | image_url: width: 800 }}" width="{{ img.width }}" height="{{ img.height }}" alt="{{ img.alt | escape }}" style="height:auto;">`,
  },
  "layout-shift-elements": {
    metricTarget: "CLS",
    fixMode: "THEME_MANUAL",
    inAppTarget: "",
    fileHint: "Announcement bar / sticky app banners",
    title: "Stabilize dynamic announcement bars, reviews, and media heights",
    steps:
      "Set a fixed min-height on review star badges, announcement banners, and variant swatches so content below does not jump after hydration.",
    snippet: `.product-reviews-badge, .announcement-slot {\n  min-height: 28px;\n}`,
  },
  "font-display": {
    metricTarget: "FCP / CLS",
    fixMode: "THEME_MANUAL",
    inAppTarget: "",
    fileHint: "layout/theme.liquid / assets/*.css",
    title: "Prevent invisible text flash with font-display: swap",
    steps:
      "Add &display=swap to external font imports and font-display: swap inside @font-face declarations.",
    snippet: `@font-face {\n  font-family: 'CustomBrandFont';\n  font-display: swap;\n}`,
  },
  "meta-description": {
    metricTarget: "SEO",
    fixMode: "IN_APP_AUTO",
    inAppTarget: "/app/bulk-meta",
    fileHint: "Bulk Meta Editor / Product SEO",
    title: "Add compelling meta description for higher Google CTR",
    steps:
      "Fix the missing meta description directly using the Manual/AI editor below or across your entire catalog in Bulk Meta.",
    snippet: "",
  },
  "document-title": {
    metricTarget: "SEO",
    fixMode: "IN_APP_AUTO",
    inAppTarget: "/app/products",
    fileHint: "Product SEO Editor / Online Store Preferences",
    title: "Ensure page has a unique, keyword-rich <title> tag",
    steps:
      "Set a clear 50-60 character SEO title in Shopify Preferences (for homepage) or Product SEO Editor (for products).",
    snippet: "",
  },
  "image-alt": {
    metricTarget: "SEO / Accessibility",
    fixMode: "IN_APP_AUTO",
    inAppTarget: "/app/image-optimizer?status=needs-fix",
    fileHint: "Image Optimizer & Gemini Vision ALT",
    title: "Fix missing product and theme image ALT text",
    steps:
      "Open Image Optimizer to auto-generate descriptive WCAG/SEO ALT tags using Gemini Vision AI or manual bulk edit.",
    snippet: "",
  },
  "robots-txt": {
    metricTarget: "SEO Crawl",
    fixMode: "IN_APP_AUTO",
    inAppTarget: "/app/robots",
    fileHint: "Technical & History → Robots.txt",
    title: "Fix invalid or blocking robots.txt rules",
    steps:
      "Validate and clean your Shopify templates/robots.txt.liquid directives inside the Robots.txt manager.",
    snippet: "",
  },
  "is-crawlable": {
    metricTarget: "SEO Crawl",
    fixMode: "IN_APP_AUTO",
    inAppTarget: "/app/robots",
    fileHint: "Robots.txt / Theme meta robots",
    title: "Ensure public storefront pages are indexable (remove accidental noindex)",
    steps:
      "Check theme.liquid for unintended noindex meta tags and verify Password Protection is turned off for live stores.",
    snippet: "",
  },
});

function isPrivateOrLocalHostname(hostname) {
  const host = String(hostname || "").trim().toLowerCase().replace(/^\[|\]$/g, "");
  if (!host) return true;
  if (
    host === "localhost" ||
    host === "0.0.0.0" ||
    host === "::1" ||
    host.endsWith(".local") ||
    host.endsWith(".internal")
  ) {
    return true;
  }
  const ipv4Match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const [, a, b] = ipv4Match.map(Number);
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
  }
  return false;
}

export function normalizePageSpeedTargetUrl(shop, inputUrl = "") {
  const cleanShop = String(shop || "").trim().replace(/^https?:\/\//i, "").replace(/\/.*$/, "");
  const fallbackBase = cleanShop ? `https://${cleanShop}` : "";
  const raw = String(inputUrl || "").trim();

  if (!raw) {
    if (!fallbackBase) throw new Error("Store domain or target URL is required.");
    return new URL(fallbackBase).toString();
  }

  let candidate = raw;
  if (raw.startsWith("/")) {
    if (!fallbackBase) throw new Error("Store domain is required for relative storefront paths.");
    candidate = `${fallbackBase}${raw}`;
  } else if (!/^https?:\/\//i.test(raw)) {
    candidate = `https://${raw}`;
  }

  let parsed;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new Error("Enter a valid public URL or storefront path (e.g. /products/example).");
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("Only HTTP/HTTPS URLs can be tested with Google PageSpeed Insights.");
  }
  if (isPrivateOrLocalHostname(parsed.hostname) || !parsed.hostname.includes(".")) {
    throw new Error("Google PageSpeed Insights can only test public internet URLs.");
  }

  parsed.hash = "";
  return parsed.toString();
}

export function extractProductHandleFromUrl(targetUrl) {
  try {
    const parsed = new URL(String(targetUrl || "").trim());
    const match = parsed.pathname.match(/\/products\/([^/?#]+)/i);
    return match ? decodeURIComponent(match[1]).toLowerCase() : "";
  } catch {
    return "";
  }
}

function roundScore(categoryScore) {
  if (typeof categoryScore !== "number" || !Number.isFinite(categoryScore)) return null;
  return Math.max(0, Math.min(100, Math.round(categoryScore * 100)));
}

function rateMetric(value, goodMax, poorMin) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "unknown";
  if (value <= goodMax) return "good";
  if (value <= poorMin) return "needs-improvement";
  return "poor";
}

function formatMs(ms) {
  if (typeof ms !== "number" || !Number.isFinite(ms)) return "N/A";
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)} s`;
  return `${Math.round(ms)} ms`;
}

function formatBytes(bytes) {
  if (typeof bytes !== "number" || !Number.isFinite(bytes) || bytes <= 0) return "";
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

function mapAuditItems(audit) {
  const details = audit?.details;
  const rows = Array.isArray(details?.items) ? details.items : [];
  return rows.slice(0, 5).map((item) => {
    const url = String(
      item?.url ||
        item?.entity ||
        item?.node?.snippet ||
        item?.source?.url ||
        "",
    ).trim();
    const label = String(item?.node?.nodeLabel || item?.entity || "").trim();
    const wastedMs = typeof item?.wastedMs === "number" ? Math.round(item.wastedMs) : null;
    const blockingTime =
      typeof item?.blockingTime === "number" ? Math.round(item.blockingTime) : null;
    const wastedBytes =
      typeof item?.wastedBytes === "number"
        ? Math.round(item.wastedBytes)
        : typeof item?.totalBytes === "number"
          ? Math.round(item.totalBytes)
          : null;

    return {
      url: url.slice(0, 240),
      label: label.slice(0, 140),
      wastedMs: wastedMs ?? blockingTime,
      wastedBytes,
    };
  });
}

function normalizeDescription(text) {
  return String(text || "")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildManualPageSpeedChecklist(report) {
  const failingIds = new Set(
    [...(report?.opportunities || []), ...(report?.seoFindings || [])]
      .filter((item) => item && item.id)
      .map((item) => item.id),
  );

  const items = [];
  for (const audit of [...(report?.opportunities || []), ...(report?.seoFindings || [])]) {
    if (!audit?.id) continue;
    const guide = AUDIT_GUIDANCE[audit.id];
    items.push({
      id: `manual_${audit.id}`,
      auditId: audit.id,
      title: guide?.title || audit.title,
      metricTarget: guide?.metricTarget || audit.category || "SEO",
      fixMode: guide?.fixMode || "THEME_MANUAL",
      inAppTarget: guide?.inAppTarget || "",
      fileHint: guide?.fileHint || "Online Store → Themes → Edit code",
      displayImpact: audit.displayValue || (audit.savingsMs ? `${Math.round(audit.savingsMs)} ms savings` : "Needs fix"),
      steps: guide?.steps || audit.description,
      snippet: guide?.snippet || "",
      offendingItems: Array.isArray(audit.items) ? audit.items : [],
    });
  }

  // Always include foundational Shopify storefront manual checks not already listed
  if (!failingIds.has("meta-description") && (report?.scores?.seo ?? 100) < 100) {
    items.push({
      id: "manual_seo_review",
      auditId: "seo-review",
      title: "Verify Store & Product Meta Snippets",
      metricTarget: "SEO",
      fixMode: "IN_APP_AUTO",
      inAppTarget: "/app/bulk-meta",
      fileHint: "Bulk Meta Editor / Product SEO",
      displayImpact: `SEO Score ${report?.scores?.seo ?? 0}/100`,
      steps: "Inspect failing SEO audits and update missing titles, meta descriptions, or ALT text in-app.",
      snippet: "",
      offendingItems: [],
    });
  }

  return items;
}

export function parsePageSpeedApiResponse(rawJson, requestedUrl = "", requestedStrategy = "mobile") {
  const lhr = rawJson?.lighthouseResult;
  if (!lhr || typeof lhr !== "object") {
    throw new Error("Google PageSpeed Insights returned an incomplete Lighthouse payload.");
  }

  const audits = lhr.audits || {};
  const categories = lhr.categories || {};
  const fieldMetrics = rawJson?.loadingExperience?.metrics || {};
  const strategy = String(lhr.configSettings?.formFactor || requestedStrategy || "mobile").toLowerCase();
  const finalUrl = String(lhr.finalDisplayedUrl || lhr.finalUrl || rawJson?.id || requestedUrl);

  const titleAuditValue = String(
    audits["document-title"]?.details?.items?.[0]?.title || lhr.fullPageScreenshot?.title || "",
  );
  const passwordProtected =
    /\/password(\?|$|#)/i.test(finalUrl) ||
    /storefront password|enter using password/i.test(titleAuditValue) ||
    lhr.runtimeError?.code === "ERRORED_DOCUMENT_REQUEST";

  const lcpMs = audits["largest-contentful-paint"]?.numericValue ?? null;
  const fcpMs = audits["first-contentful-paint"]?.numericValue ?? null;
  const clsVal = audits["cumulative-layout-shift"]?.numericValue ?? null;
  const tbtMs = audits["total-blocking-time"]?.numericValue ?? null;
  const ttfbMs = audits["server-response-time"]?.numericValue ?? null;
  const siMs = audits["speed-index"]?.numericValue ?? null;
  const fieldInpMs = fieldMetrics?.INTERACTION_TO_NEXT_PAINT?.percentile ?? null;
  const effectiveInpMs = fieldInpMs ?? tbtMs;

  const lcpElementItem = audits["largest-contentful-paint-element"]?.details?.items?.[0]?.items?.[0]
    || audits["largest-contentful-paint-element"]?.details?.items?.[0]
    || null;
  const lcpElement = String(
    lcpElementItem?.node?.snippet || lcpElementItem?.node?.nodeLabel || "",
  ).trim().slice(0, 220);

  const totalBytes = audits["total-byte-weight"]?.numericValue ?? null;

  const candidateAuditIds = Object.keys(audits).filter((id) => {
    const audit = audits[id];
    if (!audit || typeof audit.score !== "number") return false;
    return audit.score < 0.9;
  });

  const seoAuditSet = new Set(
    (categories.seo?.auditRefs || []).map((ref) => ref.id).filter(Boolean),
  );

  const opportunities = [];
  const seoFindings = [];

  for (const id of candidateAuditIds) {
    const audit = audits[id];
    const isSeo = seoAuditSet.has(id);
    const guide = AUDIT_GUIDANCE[id];
    const savingsMs =
      typeof audit.details?.overallSavingsMs === "number"
        ? Math.round(audit.details.overallSavingsMs)
        : 0;
    const savingsBytes =
      typeof audit.details?.overallSavingsBytes === "number"
        ? Math.round(audit.details.overallSavingsBytes)
        : 0;

    if (!isSeo && !guide && savingsMs <= 0 && savingsBytes <= 0 && audit.score >= 0.5) {
      continue;
    }

    const entry = {
      id,
      title: String(audit.title || id),
      description: normalizeDescription(audit.description),
      score: Math.round(audit.score * 100),
      displayValue: String(audit.displayValue || (savingsMs ? `Est. ${savingsMs} ms savings` : "")),
      savingsMs,
      savingsBytes,
      savingsBytesLabel: formatBytes(savingsBytes),
      category: isSeo ? "SEO" : guide?.metricTarget || "PERFORMANCE",
      fixMode: guide?.fixMode || (isSeo ? "IN_APP_AUTO" : "THEME_MANUAL"),
      inAppTarget: guide?.inAppTarget || "",
      items: mapAuditItems(audit),
    };

    if (isSeo) {
      seoFindings.push(entry);
    } else {
      opportunities.push(entry);
    }
  }

  opportunities.sort((a, b) => {
    const weightA = a.savingsMs + a.savingsBytes / 1000 + (100 - a.score) * 10;
    const weightB = b.savingsMs + b.savingsBytes / 1000 + (100 - b.score) * 10;
    return weightB - weightA;
  });

  seoFindings.sort((a, b) => a.score - b.score);

  const parsed = {
    testedUrl: requestedUrl || finalUrl,
    finalUrl,
    strategy,
    fetchTime: lhr.fetchTime || new Date().toISOString(),
    runtimeError: lhr.runtimeError?.message || "",
    passwordProtected,
    hasFieldData: Boolean(fieldMetrics?.LARGEST_CONTENTFUL_PAINT_MS || fieldMetrics?.INTERACTION_TO_NEXT_PAINT),
    scores: {
      performance: roundScore(categories.performance?.score),
      seo: roundScore(categories.seo?.score),
      accessibility: roundScore(categories.accessibility?.score),
      bestPractices: roundScore(categories["best-practices"]?.score),
    },
    metrics: {
      lcp: {
        label: "LCP (Largest Contentful Paint)",
        value: typeof lcpMs === "number" ? Math.round(lcpMs) : null,
        displayValue: audits["largest-contentful-paint"]?.displayValue || formatMs(lcpMs),
        rating: rateMetric(lcpMs, 2500, 4000),
        target: "≤ 2.5 s",
      },
      inp: {
        label: fieldInpMs !== null ? "INP (Real CrUX Field)" : "TBT (INP Lab Proxy)",
        value: typeof effectiveInpMs === "number" ? Math.round(effectiveInpMs) : null,
        displayValue:
          fieldInpMs !== null
            ? formatMs(fieldInpMs)
            : audits["total-blocking-time"]?.displayValue || formatMs(tbtMs),
        rating:
          fieldInpMs !== null
            ? rateMetric(fieldInpMs, 200, 500)
            : rateMetric(tbtMs, 200, 600),
        target: "≤ 200 ms",
      },
      cls: {
        label: "CLS (Cumulative Layout Shift)",
        value: typeof clsVal === "number" ? Number(clsVal.toFixed(3)) : null,
        displayValue:
          audits["cumulative-layout-shift"]?.displayValue ||
          (typeof clsVal === "number" ? clsVal.toFixed(3) : "N/A"),
        rating: rateMetric(clsVal, 0.1, 0.25),
        target: "≤ 0.10",
      },
      fcp: {
        label: "FCP (First Contentful Paint)",
        value: typeof fcpMs === "number" ? Math.round(fcpMs) : null,
        displayValue: audits["first-contentful-paint"]?.displayValue || formatMs(fcpMs),
        rating: rateMetric(fcpMs, 1800, 3000),
        target: "≤ 1.8 s",
      },
      ttfb: {
        label: "TTFB (Server Response)",
        value: typeof ttfbMs === "number" ? Math.round(ttfbMs) : null,
        displayValue: audits["server-response-time"]?.displayValue || formatMs(ttfbMs),
        rating: rateMetric(ttfbMs, 800, 1800),
        target: "≤ 800 ms",
      },
      si: {
        label: "Speed Index",
        value: typeof siMs === "number" ? Math.round(siMs) : null,
        displayValue: audits["speed-index"]?.displayValue || formatMs(siMs),
        rating: rateMetric(siMs, 3400, 5800),
        target: "≤ 3.4 s",
      },
    },
    lcpElement,
    totalBytes,
    totalBytesLabel: formatBytes(totalBytes) || "N/A",
    opportunities: opportunities.slice(0, 12),
    seoFindings: seoFindings.slice(0, 10),
  };

  parsed.manualChecklist = buildManualPageSpeedChecklist(parsed);
  return parsed;
}

export async function runLivePageSpeedTest({
  url,
  shop,
  strategy = "mobile",
  apiKey = "",
  fetchImpl = globalThis.fetch,
}) {
  if (typeof fetchImpl !== "function") {
    throw new Error("Fetch API is unavailable in this runtime.");
  }

  const normalizedUrl = normalizePageSpeedTargetUrl(shop, url);
  const cleanStrategy = String(strategy || "mobile").toLowerCase() === "desktop" ? "desktop" : "mobile";

  const params = new URLSearchParams();
  params.set("url", normalizedUrl);
  params.set("strategy", cleanStrategy);
  params.append("category", "performance");
  params.append("category", "seo");
  params.append("category", "accessibility");
  params.append("category", "best-practices");
  const cleanKey = String(apiKey || "").trim();
  if (cleanKey) {
    params.set("key", cleanKey);
  }

  const endpoint = `${PAGESPEED_ENDPOINT}?${params.toString()}`;
  const response = await fetchImpl(endpoint, {
    method: "GET",
    headers: { Accept: "application/json" },
    signal: typeof AbortSignal !== "undefined" && AbortSignal.timeout ? AbortSignal.timeout(45000) : undefined,
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const rawMsg =
      payload?.error?.message ||
      `Google PageSpeed Insights returned HTTP ${response.status}.`;
    if (response.status === 429) {
      throw new Error(
        "Google PageSpeed API public rate limit reached. Add a Google PageSpeed API key in SuperAdmin → AI & API Config (or .env GOOGLE_PAGESPEED_API_KEY) for dedicated quota.",
      );
    }
    throw new Error(rawMsg);
  }

  return parsePageSpeedApiResponse(payload, normalizedUrl, cleanStrategy);
}
