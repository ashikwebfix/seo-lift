var _a;
import { jsx, jsxs, Fragment } from "react/jsx-runtime";
import { PassThrough } from "stream";
import { renderToPipeableStream } from "react-dom/server";
import { ServerRouter, UNSAFE_withComponentProps, Outlet, UNSAFE_withErrorBoundaryProps, isRouteErrorResponse, Meta, Links, ScrollRestoration, Scripts, redirect, useLoaderData, useActionData, Form, useLocation, Link, data, useNavigation, useFetcher, useMatches, useRouteError, useSearchParams } from "react-router";
import { createReadableStreamFromReadable } from "@react-router/node";
import { isbot } from "isbot";
import "@shopify/shopify-app-react-router/adapters/node";
import { shopifyApp, AppDistribution, ApiVersion, LoginErrorType, boundary } from "@shopify/shopify-app-react-router/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import { PrismaClient } from "@prisma/client";
import crypto from "node:crypto";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { useState, useRef, useCallback, useEffect, useMemo } from "react";
function createPrismaClient() {
  const client = new PrismaClient();
  client.$queryRawUnsafe("PRAGMA journal_mode = WAL;").catch(() => {
  });
  client.$executeRawUnsafe("PRAGMA busy_timeout = 5000;").catch(() => {
  });
  return client;
}
if (process.env.NODE_ENV !== "production") {
  if (!global.prismaGlobal || !global.prismaGlobal.superAdminUser) {
    global.prismaGlobal = createPrismaClient();
  }
}
const prisma = global.prismaGlobal ?? createPrismaClient();
const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: ApiVersion.October25,
  scopes: (_a = process.env.SCOPES) == null ? void 0 : _a.split(","),
  appUrl: process.env.SHOPIFY_APP_URL || "",
  authPathPrefix: "/auth",
  sessionStorage: new PrismaSessionStorage(prisma),
  distribution: AppDistribution.AppStore,
  future: {
    expiringOfflineAccessTokens: true
  },
  ...process.env.SHOP_CUSTOM_DOMAIN ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] } : {}
});
ApiVersion.October25;
const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
const authenticate = shopify.authenticate;
shopify.unauthenticated;
const login = shopify.login;
shopify.registerWebhooks;
shopify.sessionStorage;
const streamTimeout = 5e3;
async function handleRequest(request, responseStatusCode, responseHeaders, reactRouterContext) {
  addDocumentResponseHeaders(request, responseHeaders);
  const userAgent = request.headers.get("user-agent");
  const callbackName = isbot(userAgent ?? "") ? "onAllReady" : "onShellReady";
  return new Promise((resolve, reject) => {
    const { pipe, abort } = renderToPipeableStream(
      /* @__PURE__ */ jsx(ServerRouter, { context: reactRouterContext, url: request.url }),
      {
        [callbackName]: () => {
          const body = new PassThrough();
          const stream = createReadableStreamFromReadable(body);
          responseHeaders.set("Content-Type", "text/html");
          resolve(
            new Response(stream, {
              headers: responseHeaders,
              status: responseStatusCode
            })
          );
          pipe(body);
        },
        onShellError(error) {
          reject(error);
        },
        onError(error) {
          responseStatusCode = 500;
          console.error(error);
        }
      }
    );
    setTimeout(abort, streamTimeout + 1e3);
  });
}
const entryServer = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: handleRequest,
  streamTimeout
}, Symbol.toStringTag, { value: "Module" }));
function Layout({
  children
}) {
  return /* @__PURE__ */ jsxs("html", {
    lang: "en",
    suppressHydrationWarning: true,
    children: [/* @__PURE__ */ jsxs("head", {
      suppressHydrationWarning: true,
      children: [/* @__PURE__ */ jsx("meta", {
        charSet: "utf-8"
      }), /* @__PURE__ */ jsx("meta", {
        name: "viewport",
        content: "width=device-width,initial-scale=1"
      }), /* @__PURE__ */ jsx("link", {
        rel: "preconnect",
        href: "https://cdn.shopify.com/"
      }), /* @__PURE__ */ jsx("link", {
        rel: "preconnect",
        href: "https://fonts.googleapis.com"
      }), /* @__PURE__ */ jsx("link", {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: ""
      }), /* @__PURE__ */ jsx("link", {
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap",
        rel: "stylesheet"
      }), /* @__PURE__ */ jsx(Meta, {}), /* @__PURE__ */ jsx(Links, {})]
    }), /* @__PURE__ */ jsxs("body", {
      suppressHydrationWarning: true,
      children: [children, /* @__PURE__ */ jsx(ScrollRestoration, {}), /* @__PURE__ */ jsx(Scripts, {})]
    })]
  });
}
const root = UNSAFE_withComponentProps(function App() {
  return /* @__PURE__ */ jsx(Outlet, {});
});
const ErrorBoundary$1 = UNSAFE_withErrorBoundaryProps(function ErrorBoundary({
  error
}) {
  let heading2 = "Unexpected Error";
  let message = "An unexpected error occurred while rendering this page.";
  if (isRouteErrorResponse(error)) {
    heading2 = `${error.status} ${error.statusText || "Error"}`;
    message = typeof error.data === "string" ? error.data : message;
  } else if (error instanceof Error) {
    message = error.message;
  }
  return /* @__PURE__ */ jsxs("main", {
    style: {
      maxWidth: 640,
      margin: "48px auto",
      padding: 24,
      fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif"
    },
    children: [/* @__PURE__ */ jsx("h1", {
      style: {
        marginTop: 0,
        fontSize: 22
      },
      children: heading2
    }), /* @__PURE__ */ jsx("p", {
      style: {
        color: "#475569",
        lineHeight: 1.5
      },
      children: message
    })]
  });
});
const route0 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  ErrorBoundary: ErrorBoundary$1,
  Layout,
  default: root
}, Symbol.toStringTag, { value: "Module" }));
const action$n = async ({
  request
}) => {
  const {
    shop,
    topic
  } = await authenticate.webhook(request);
  console.log(`Received compliance webhook ${topic} for ${shop}`);
  return new Response();
};
const route1 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$n
}, Symbol.toStringTag, { value: "Module" }));
const action$m = async ({
  request
}) => {
  const {
    payload,
    session,
    topic,
    shop
  } = await authenticate.webhook(request);
  console.log(`Received ${topic} webhook for ${shop}`);
  const current = payload.current;
  if (session) {
    await prisma.session.update({
      where: {
        id: session.id
      },
      data: {
        scope: current.toString()
      }
    });
  }
  return new Response();
};
const route2 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$m
}, Symbol.toStringTag, { value: "Module" }));
const action$l = async ({
  request
}) => {
  const {
    shop,
    topic
  } = await authenticate.webhook(request);
  console.log(`Received compliance webhook ${topic} for ${shop}`);
  return new Response();
};
const route3 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$l
}, Symbol.toStringTag, { value: "Module" }));
async function clearShopSessions(shop) {
  const rawShop = String(shop || "").trim();
  const cleanShop = rawShop.toLowerCase();
  if (!cleanShop) return;
  const shopTargets = rawShop && rawShop !== cleanShop ? [cleanShop, rawShop] : [cleanShop];
  await prisma.session.deleteMany({ where: { shop: { in: shopTargets } } });
}
async function purgeShopData(shop) {
  const rawShop = String(shop || "").trim();
  const cleanShop = rawShop.toLowerCase();
  if (!cleanShop) return;
  const shopTargets = rawShop && rawShop !== cleanShop ? [cleanShop, rawShop] : [cleanShop];
  await prisma.$transaction([
    prisma.session.deleteMany({ where: { shop: { in: shopTargets } } }),
    prisma.appState.deleteMany({ where: { shop: { in: shopTargets } } }),
    prisma.aiCreditAccount.deleteMany({ where: { shop: { in: shopTargets } } }),
    prisma.productRevision.deleteMany({ where: { shop: { in: shopTargets } } }),
    prisma.seoAuditSnapshot.deleteMany({ where: { shop: { in: shopTargets } } }),
    prisma.storeControl.deleteMany({ where: { shop: { in: shopTargets } } })
  ]);
}
const action$k = async ({
  request
}) => {
  const {
    shop,
    topic
  } = await authenticate.webhook(request);
  console.log(`Received ${topic} webhook for ${shop}`);
  if (shop) {
    await clearShopSessions(shop);
  }
  return new Response();
};
const route4 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$k
}, Symbol.toStringTag, { value: "Module" }));
function validateLength(value, min, max) {
  const text2 = String(value || "").trim();
  return text2.length >= min && text2.length <= max;
}
function normalizeImageAlt(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}
function validateProductTitle(value) {
  const clean = String(value || "").trim();
  const valid = validateLength(clean, 25, 70);
  return {
    valid,
    message: valid ? "" : "Product title must be 25-70 characters."
  };
}
function validateFocusKeyword(value) {
  const clean = String(value || "").trim();
  const valid = validateLength(clean, 3, 40);
  return {
    valid,
    message: valid ? "" : "Focus keyword must be 3-40 characters."
  };
}
function validateMetaTitle(value) {
  const clean = String(value || "").trim();
  const hardValid = clean.length <= 65;
  const ideal = clean.length >= 45 && clean.length <= 60;
  return {
    valid: hardValid,
    ideal,
    message: hardValid ? "" : "Meta title must be 65 characters or less."
  };
}
function validateMetaDescription(value) {
  const clean = String(value || "").trim();
  const hardValid = clean.length <= 160;
  const ideal = clean.length >= 120 && clean.length <= 155;
  return {
    valid: hardValid,
    ideal,
    message: hardValid ? "" : "Meta description must be 160 characters or less."
  };
}
function isGenericImageAlt(value) {
  return /^(image|photo|picture|product image|product photo|img)(?:\s+\d+)?$/i.test(value);
}
function validateImageAlt(value) {
  const clean = normalizeImageAlt(value);
  const length = clean.length;
  const missing = length === 0;
  const tooLong = length > 125;
  const tooShort = length > 0 && length < 20;
  const generic = !missing && isGenericImageAlt(clean);
  const valid = !missing && !tooLong;
  const ideal = valid && !tooShort && !generic && length <= 110;
  let message = "";
  if (missing) {
    message = "Image ALT text is required.";
  } else if (tooLong) {
    message = "Image ALT text must be 125 characters or less.";
  } else if (generic) {
    message = "Image ALT text is too generic.";
  } else if (tooShort) {
    message = "Image ALT text should be at least 20 characters for better context.";
  }
  return {
    valid,
    ideal,
    missing,
    tooLong,
    tooShort,
    generic,
    length,
    normalized: clean,
    message
  };
}
function suggestImageAltText({ productTitle, position = 1, currentAlt = "" }) {
  const current = normalizeImageAlt(currentAlt);
  const currentValidation = validateImageAlt(current);
  if (current && currentValidation.valid && !currentValidation.generic && !currentValidation.tooShort) {
    return current;
  }
  const safeTitle = normalizeImageAlt(productTitle) || "Product";
  const suffix = Number(position) > 1 ? ` - view ${Number(position)}` : " - product image";
  const seed = `${safeTitle}${suffix}`;
  const trimmed = seed.length > 125 ? seed.slice(0, 125).trimEnd() : seed;
  if (trimmed.length >= 20) {
    return trimmed;
  }
  const fallback = `${safeTitle} product photo for online store listing`;
  return fallback.length > 125 ? fallback.slice(0, 125).trimEnd() : fallback;
}
function normalizeHandle(value) {
  let clean = String(value || "").trim().toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  if (clean.length > 45) {
    clean = clean.slice(0, 45).replace(/-+$/, "");
  }
  return clean;
}
function validateUrlHandle(value) {
  const handleStr = String(value || "");
  const clean = normalizeHandle(handleStr);
  const validPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  const valid = handleStr === clean && handleStr.length >= 1 && handleStr.length <= 45 && validPattern.test(handleStr);
  return {
    valid,
    normalized: clean,
    message: valid ? "" : "URL handle must be lowercase, hyphenated, and 1-45 characters."
  };
}
function stripHtmlTags(html = "") {
  return String(html || "").replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, " ").replace(/<\/(p|div|li|h[1-6]|tr|blockquote|section|article)>/gi, " ").replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&quot;/gi, '"').replace(/&#39;/gi, "'").replace(/\s+/g, " ").trim();
}
function sanitizeProductDescriptionHtml(html = "") {
  return String(html || "").replace(/<(script|style|iframe|object|embed|form)\b[^>]*>[\s\S]*?<\/\1>/gi, "").replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "").replace(/\s(href|src)\s*=\s*(['"])\s*(?:javascript:|data:text\/html)[\s\S]*?\2/gi, ' $1="#"').trim();
}
function textMatchesKeyword(haystack, focusKeyword) {
  const kw = String(focusKeyword || "").trim().toLowerCase();
  if (kw.length < 3) return false;
  const normalizedHaystack = String(haystack || "").toLowerCase();
  if (normalizedHaystack.includes(kw)) return true;
  const slugHaystack = normalizedHaystack.replace(/[^a-z0-9]+/g, " ");
  const slugKw = kw.replace(/[^a-z0-9]+/g, " ").trim();
  return Boolean(slugKw) && slugHaystack.includes(slugKw);
}
function validateProductDescription(html = "", focusKeyword = "") {
  const cleanHtml = sanitizeProductDescriptionHtml(html);
  const plainText = stripHtmlTags(cleanHtml);
  const charCount = plainText.length;
  const wordCount = plainText ? plainText.split(/\s+/).filter(Boolean).length : 0;
  const hasStructure = /<(h2|h3|ul|ol|li|p)\b/i.test(cleanHtml);
  const cleanKw = String(focusKeyword || "").trim();
  const hasKeyword = cleanKw.length >= 3 ? textMatchesKeyword(plainText, cleanKw) : false;
  const valid = charCount <= 15e3;
  const ideal = valid && wordCount >= 80 && hasStructure && (cleanKw.length < 3 || hasKeyword);
  let message = "";
  if (!valid) {
    message = "Product description plain text must be 15,000 characters or less.";
  } else if (wordCount === 0) {
    message = "Add product description copy (80+ words recommended for Google ranking).";
  } else if (wordCount < 80) {
    message = `Thin description (${wordCount} words). Aim for 80+ words with key buyer benefits.`;
  } else if (!hasStructure) {
    message = "Add HTML structure (headings or bullet points) to improve scan readability.";
  } else if (cleanKw.length >= 3 && !hasKeyword) {
    message = `Mention focus keyword "${cleanKw}" naturally inside the product description.`;
  }
  return {
    valid,
    ideal,
    wordCount,
    charCount,
    hasStructure,
    hasKeyword,
    message
  };
}
function evaluateOnPageSeoSignals({
  title = "",
  focusKeyword = "",
  metaTitle = "",
  metaDescription = "",
  handle = "",
  descriptionHtml = ""
} = {}) {
  const cleanKw = String(focusKeyword || "").trim();
  const hasKeyword = validateFocusKeyword(cleanKw).valid;
  const desc = validateProductDescription(descriptionHtml, cleanKw);
  const keywordInTitle = hasKeyword && textMatchesKeyword(title, cleanKw);
  const keywordInMetaTitle = hasKeyword && textMatchesKeyword(metaTitle, cleanKw);
  const keywordInMetaDescription = hasKeyword && textMatchesKeyword(metaDescription, cleanKw);
  const keywordInHandle = hasKeyword && textMatchesKeyword(handle, cleanKw);
  const keywordInDescription = hasKeyword && desc.hasKeyword;
  const checks = [
    { key: "titleLength", label: "Product title (25-70 chars)", passed: validateProductTitle(title).valid },
    { key: "focusKeyword", label: "Focus keyword set (3-40 chars)", passed: hasKeyword },
    { key: "metaTitle", label: "Meta title ideal (45-60 chars)", passed: validateMetaTitle(metaTitle).valid && validateMetaTitle(metaTitle).ideal },
    { key: "metaDescription", label: "Meta description ideal (120-155 chars)", passed: validateMetaDescription(metaDescription).valid && validateMetaDescription(metaDescription).ideal },
    { key: "handle", label: "Clean SEO URL handle", passed: validateUrlHandle(handle).valid },
    { key: "keywordInTitle", label: "Focus keyword in title", passed: keywordInTitle },
    { key: "keywordInMetaTitle", label: "Focus keyword in meta title", passed: keywordInMetaTitle },
    { key: "keywordInMetaDescription", label: "Focus keyword in meta description", passed: keywordInMetaDescription },
    { key: "richDescription", label: "Rich product copy (80+ words + structure)", passed: desc.wordCount >= 80 && desc.hasStructure },
    { key: "keywordInDescription", label: "Focus keyword in description", passed: keywordInDescription }
  ];
  const passedCount = checks.filter((c) => c.passed).length;
  const totalCount = checks.length;
  return {
    checks,
    passedCount,
    totalCount,
    scorePercent: Math.round(passedCount / totalCount * 100),
    keywordInTitle,
    keywordInMetaTitle,
    keywordInMetaDescription,
    keywordInHandle,
    keywordInDescription,
    description: desc
  };
}
function validateProductSeoInput(payload) {
  const cleanTitle = String(payload.title || "").trim();
  const cleanFocusKeyword = String(payload.focusKeyword || "").trim();
  const hasDescriptionPayload = typeof payload.descriptionHtml === "string";
  const cleanDescriptionHtml = hasDescriptionPayload ? sanitizeProductDescriptionHtml(payload.descriptionHtml) : void 0;
  const title = {
    valid: cleanTitle.length > 0,
    message: cleanTitle ? "" : "Product title is required."
  };
  const focusKeyword = cleanFocusKeyword ? validateFocusKeyword(cleanFocusKeyword) : { message: "" };
  const metaTitle = validateMetaTitle(payload.metaTitle);
  const metaDescription = validateMetaDescription(payload.metaDescription);
  const normalizedHandleCandidate = normalizeHandle(payload.handle);
  const handle = validateUrlHandle(normalizedHandleCandidate);
  const description = hasDescriptionPayload ? validateProductDescription(cleanDescriptionHtml, cleanFocusKeyword) : null;
  const errors = {
    title: title.message,
    focusKeyword: focusKeyword.message,
    metaTitle: metaTitle.message,
    metaDescription: metaDescription.message,
    handle: handle.message,
    ...hasDescriptionPayload && description && !description.valid ? { descriptionHtml: description.message } : {}
  };
  const hasErrors = Object.values(errors).some(Boolean);
  return {
    valid: !hasErrors,
    errors,
    normalized: {
      title: cleanTitle,
      focusKeyword: cleanFocusKeyword,
      metaTitle: String(payload.metaTitle || "").trim(),
      metaDescription: String(payload.metaDescription || "").trim(),
      handle: handle.normalized,
      ...hasDescriptionPayload ? { descriptionHtml: cleanDescriptionHtml } : {}
    },
    quality: {
      metaTitleIdeal: metaTitle.ideal,
      metaDescriptionIdeal: metaDescription.ideal,
      ...description ? {
        descriptionIdeal: description.ideal,
        descriptionWordCount: description.wordCount
      } : {}
    }
  };
}
function validateRobotsRules(rulesText) {
  const rules = String(rulesText || "");
  const disallowCart = /disallow:\s*\/cart/i.test(rules);
  const disallowSearch = /disallow:\s*\/search/i.test(rules);
  return {
    valid: disallowCart && disallowSearch,
    disallowCart,
    disallowSearch,
    message: disallowCart && disallowSearch ? "" : "robots.txt must include Disallow for /cart and /search."
  };
}
function mapShopifyProductToSeoRow(product, productState = {}) {
  const title = String(product.title || "");
  const metaTitle = String(product.metafields_global_title_tag || "");
  const metaDescription = String(
    product.metafields_global_description_tag || ""
  );
  const handle = String(product.handle || "");
  const focusKeyword = String(productState.focusKeyword || "");
  const descriptionHtml = String(product.body_html || "");
  const productType = String(product.product_type || "");
  const tags = String(product.tags || "");
  return {
    id: String(product.id),
    title,
    focusKeyword,
    metaTitle,
    metaDescription,
    handle,
    descriptionHtml,
    productType,
    tags,
    updatedAt: product.updated_at || null,
    validation: {
      title: validateProductTitle(title),
      focusKeyword: validateFocusKeyword(focusKeyword),
      metaTitle: validateMetaTitle(metaTitle),
      metaDescription: validateMetaDescription(metaDescription),
      handle: validateUrlHandle(handle),
      description: validateProductDescription(descriptionHtml, focusKeyword)
    }
  };
}
const AI_FEATURES_ENABLED = true;
const DEFAULT_GEMINI_MODEL = "gemini-3.8-flash";
const GEMINI_MODEL_CATALOG = Object.freeze([
  {
    id: "gemini-3.8-flash",
    label: "Gemini 3.8 Flash (Latest • Recommended)",
    group: "Gemini 3.5 – 3.8 Series"
  },
  {
    id: "gemini-3.7-flash",
    label: "Gemini 3.7 Flash",
    group: "Gemini 3.5 – 3.8 Series"
  },
  {
    id: "gemini-3.6-flash",
    label: "Gemini 3.6 Flash",
    group: "Gemini 3.5 – 3.8 Series"
  },
  {
    id: "gemini-3.5-flash",
    label: "Gemini 3.5 Flash",
    group: "Gemini 3.5 – 3.8 Series"
  },
  {
    id: "gemini-3.5-flash-lite",
    label: "Gemini 3.5 Flash-Lite (Fastest / Low Cost)",
    group: "Gemini 3.5 – 3.8 Series"
  },
  {
    id: "gemini-3.1-pro",
    label: "Gemini 3.1 Pro (Deep Reasoning)",
    group: "Gemini 3.1 Series"
  },
  {
    id: "gemini-3.1-pro-preview",
    label: "Gemini 3.1 Pro Preview",
    group: "Gemini 3.1 Series"
  },
  {
    id: "gemini-3.1-flash-lite",
    label: "Gemini 3.1 Flash-Lite",
    group: "Gemini 3.1 Series"
  },
  {
    id: "gemini-2.5-flash",
    label: "Gemini 2.5 Flash (Legacy)",
    group: "Legacy Gemini 2.x"
  },
  {
    id: "gemini-2.5-pro",
    label: "Gemini 2.5 Pro (Legacy)",
    group: "Legacy Gemini 2.x"
  },
  {
    id: "gemini-2.0-flash",
    label: "Gemini 2.0 Flash (Legacy)",
    group: "Legacy Gemini 2.x"
  }
]);
const PRESET_GEMINI_MODEL_IDS = GEMINI_MODEL_CATALOG.map((model) => model.id);
function formatGeminiModelName(modelId) {
  const match = GEMINI_MODEL_CATALOG.find((m) => m.id === modelId);
  return match ? match.label.replace(/\s*\(.*\)/, "") : String(modelId || DEFAULT_GEMINI_MODEL);
}
const DEFAULT_AI_SETTINGS = Object.freeze({
  provider: "gemini",
  model: DEFAULT_GEMINI_MODEL,
  apiKey: ""
});
function isVertexExpressKey(value) {
  const clean = cleanText(value);
  return /^AQ\.[0-9A-Za-z._-]{20,}$/.test(clean);
}
function looksLikeGeminiApiKey(value) {
  const clean = cleanText(value);
  return /^AIza[0-9A-Za-z_-]{20,}$/.test(clean) || isVertexExpressKey(clean);
}
function getServerGeminiKey() {
  var _a2;
  return typeof process !== "undefined" && ((_a2 = process.env) == null ? void 0 : _a2.GEMINI_API_KEY) ? cleanText(process.env.GEMINI_API_KEY) : "";
}
function resolveEffectiveAiConfig(settings = {}) {
  const normalized = normalizeAiSettings(settings);
  const serverKey = getServerGeminiKey();
  return {
    ...normalized,
    apiKey: normalized.apiKey || serverKey,
    usingServerKey: !normalized.apiKey && Boolean(serverKey)
  };
}
function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}
function trimToMax(value, max) {
  const clean = cleanText(value);
  if (clean.length <= max) return clean;
  return clean.slice(0, max).trim();
}
function normalizeAiResponse(raw) {
  if (!raw || typeof raw !== "object") {
    return {};
  }
  return Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [key, typeof value === "string" ? cleanText(value) : value])
  );
}
function parseJsonObject(text2) {
  const clean = String(text2 || "").trim();
  if (!clean) {
    throw new Error("AI provider returned an empty response.");
  }
  try {
    return JSON.parse(clean);
  } catch {
    const start = clean.indexOf("{");
    const end = clean.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(clean.slice(start, end + 1));
    }
    throw new Error("AI provider did not return valid JSON.");
  }
}
function buildMetaFallback({ title, focusKeyword }) {
  const safeTitle = trimToMax(title || "Product", 40);
  const safeKeyword = trimToMax(focusKeyword || title || "online product", 40);
  const metaTitle = trimToMax(`${safeTitle} | ${safeKeyword} | Buy Online`, 60);
  const metaDescription = trimToMax(
    `${safeTitle} with ${safeKeyword}. Fast delivery, trusted quality, clear pricing, and a simple buying experience for confident shopping today.`,
    155
  );
  return {
    metaTitle,
    metaDescription
  };
}
function buildProductTitleFallback({ title, focusKeyword }) {
  const cleanTitle = cleanText(title || "Product");
  const keyword = cleanText(focusKeyword || "");
  const candidates = [
    cleanTitle,
    keyword ? `${cleanTitle} - ${keyword}` : "",
    keyword ? `${cleanTitle} for ${keyword}` : "",
    `${cleanTitle} | Buy Online Today`
  ].filter(Boolean);
  return candidates.map((candidate) => trimToMax(candidate, 70)).find((candidate) => validateProductTitle(candidate).valid) || trimToMax(`${cleanTitle} | Shop Online`, 70);
}
function buildFocusKeywordFallback({ title, focusKeyword }) {
  const cleanKeyword = cleanText(focusKeyword || "");
  if (validateFocusKeyword(cleanKeyword).valid) {
    return cleanKeyword;
  }
  const fromTitle = cleanText(title || "").split(/\s+/).slice(0, 4).join(" ");
  if (validateFocusKeyword(fromTitle).valid) {
    return fromTitle;
  }
  return "online product";
}
function buildHandleFallback({ title, focusKeyword, handle }) {
  const candidates = [
    normalizeHandle(handle || ""),
    normalizeHandle(`${focusKeyword || ""} ${title || ""}`),
    normalizeHandle(title || ""),
    "online-product"
  ];
  return candidates.find((candidate) => validateUrlHandle(candidate).valid) || "online-product";
}
function buildProductFallback({ title, focusKeyword, handle }) {
  const nextTitle = buildProductTitleFallback({ title, focusKeyword });
  const nextKeyword = buildFocusKeywordFallback({ title: nextTitle, focusKeyword });
  const meta = buildMetaFallback({ title: nextTitle, focusKeyword: nextKeyword });
  return {
    title: nextTitle,
    focusKeyword: nextKeyword,
    handle: buildHandleFallback({ title: nextTitle, focusKeyword: nextKeyword, handle }),
    metaTitle: meta.metaTitle,
    metaDescription: meta.metaDescription
  };
}
function normalizeAiSettings(settings = {}) {
  const provider = String(settings.provider || DEFAULT_AI_SETTINGS.provider).trim().toLowerCase();
  const normalizedProvider = provider === "gemini" ? "gemini" : DEFAULT_AI_SETTINGS.provider;
  const model = cleanText(settings.model || DEFAULT_AI_SETTINGS.model) || DEFAULT_AI_SETTINGS.model;
  const apiKey = cleanText(settings.apiKey || "");
  return {
    provider: normalizedProvider,
    model,
    apiKey
  };
}
function getAiErrorMessage(error) {
  const message = (error == null ? void 0 : error.message) || "Unable to reach the AI provider.";
  return message;
}
async function postGenerateContent(url, body, apiKey) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey
    },
    body: JSON.stringify(body)
  });
  const rawText = await response.text();
  let parsedBody = null;
  try {
    parsedBody = rawText ? JSON.parse(rawText) : null;
  } catch {
    parsedBody = null;
  }
  return { response, parsedBody };
}
async function callGoogleGenerateContent({ model, apiKey, body }) {
  var _a2, _b, _c, _d, _e;
  const encodedModel = encodeURIComponent(model);
  const encodedKey = encodeURIComponent(apiKey);
  const aiStudioUrl = `https://generativelanguage.googleapis.com/v1beta/models/${encodedModel}:generateContent?key=${encodedKey}`;
  const vertexV1Url = `https://aiplatform.googleapis.com/v1/publishers/google/models/${encodedModel}:generateContent?key=${encodedKey}`;
  const vertexV1Beta1Url = `https://aiplatform.googleapis.com/v1beta1/publishers/google/models/${encodedModel}:generateContent?key=${encodedKey}`;
  const endpoints = isVertexExpressKey(apiKey) ? [vertexV1Url, vertexV1Beta1Url, aiStudioUrl] : [aiStudioUrl, vertexV1Url, vertexV1Beta1Url];
  let lastError = null;
  for (const endpoint of endpoints) {
    const { response, parsedBody } = await postGenerateContent(endpoint, body, apiKey);
    if (response.ok) {
      const text2 = (_d = (_c = (_b = (_a2 = parsedBody == null ? void 0 : parsedBody.candidates) == null ? void 0 : _a2[0]) == null ? void 0 : _b.content) == null ? void 0 : _c.parts) == null ? void 0 : _d.map((part) => part.text || "").join("").trim();
      return parseJsonObject(text2);
    }
    const message = ((_e = parsedBody == null ? void 0 : parsedBody.error) == null ? void 0 : _e.message) || `AI provider request failed with status ${response.status}.`;
    lastError = new Error(message);
    if (![400, 401, 403, 404].includes(response.status)) {
      throw lastError;
    }
  }
  throw lastError || new Error("Unable to reach Gemini API.");
}
async function requestGeminiJson({ model, apiKey, prompt, temperature = 0.4 }) {
  return callGoogleGenerateContent({
    model,
    apiKey,
    body: {
      systemInstruction: {
        parts: [
          {
            text: "You write ecommerce SEO copy. Respond with JSON only. Never use markdown fences."
          }
        ]
      },
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }]
        }
      ],
      generationConfig: {
        temperature: typeof temperature === "number" ? temperature : 0.4,
        responseMimeType: "application/json"
      }
    }
  });
}
async function testGeminiConnection({ apiKey, model = DEFAULT_AI_SETTINGS.model }) {
  const effective = resolveEffectiveAiConfig({ apiKey, model });
  if (!effective.apiKey) {
    throw new Error("No Gemini API key is saved or set in .env.");
  }
  const start = Date.now();
  const data2 = await requestGeminiJson({
    model: effective.model,
    apiKey: effective.apiKey,
    prompt: 'Return JSON: {"status":"ok","message":"Gemini connected"}',
    temperature: 0
  });
  return {
    ok: true,
    model: effective.model,
    latencyMs: Date.now() - start,
    response: data2
  };
}
async function requestSeoFixFromProvider({ settings, prompt }) {
  const effectiveSettings = resolveEffectiveAiConfig(settings);
  if (!effectiveSettings.apiKey) {
    throw new Error("Platform Gemini AI credentials are not configured yet. Set them up in /superadmin.");
  }
  if (effectiveSettings.provider !== "gemini") {
    throw new Error(`Unsupported AI provider: ${effectiveSettings.provider}`);
  }
  try {
    return await requestGeminiJson({
      model: effectiveSettings.model,
      apiKey: effectiveSettings.apiKey,
      prompt,
      temperature: settings == null ? void 0 : settings.temperature
    });
  } catch (error) {
    throw new Error(getAiErrorMessage(error));
  }
}
function normalizeMetaSuggestion(input2, fallbackSource) {
  const fallback = buildMetaFallback(fallbackSource);
  const normalized = normalizeAiResponse(input2);
  const metaTitle = validateMetaTitle(normalized.metaTitle).valid && validateMetaTitle(normalized.metaTitle).ideal ? normalized.metaTitle : fallback.metaTitle;
  const metaDescription = validateMetaDescription(normalized.metaDescription).valid && validateMetaDescription(normalized.metaDescription).ideal ? normalized.metaDescription : fallback.metaDescription;
  return {
    metaTitle,
    metaDescription,
    rationale: normalized.rationale || "Generated with AI and normalized to ideal SEO length ranges."
  };
}
function normalizeProductSeoSuggestion(input2, fallbackSource, options = {}) {
  const fallback = buildProductFallback(fallbackSource);
  const rawDesc = typeof (input2 == null ? void 0 : input2.descriptionHtml) === "string" ? sanitizeProductDescriptionHtml(input2.descriptionHtml) : "";
  const normalized = normalizeAiResponse(input2);
  const keepHandle = Boolean(options.preserveHandle) && validateUrlHandle((fallbackSource == null ? void 0 : fallbackSource.handle) || "").valid;
  const resolvedHandle = keepHandle ? validateUrlHandle(fallbackSource.handle).normalized : validateUrlHandle(normalized.handle).valid ? validateUrlHandle(normalized.handle).normalized : fallback.handle;
  const result = {
    title: validateProductTitle(normalized.title).valid ? normalized.title : fallback.title,
    focusKeyword: validateFocusKeyword(normalized.focusKeyword).valid ? normalized.focusKeyword : fallback.focusKeyword,
    handle: resolvedHandle,
    metaTitle: validateMetaTitle(normalized.metaTitle).valid && validateMetaTitle(normalized.metaTitle).ideal ? normalized.metaTitle : fallback.metaTitle,
    metaDescription: validateMetaDescription(normalized.metaDescription).valid && validateMetaDescription(normalized.metaDescription).ideal ? normalized.metaDescription : fallback.metaDescription,
    rationale: normalized.rationale || "Generated with AI and normalized to ideal SEO ranges."
  };
  if (rawDesc && stripHtmlTags(rawDesc).length >= 20) {
    result.descriptionHtml = rawDesc;
  }
  return result;
}
async function generateProductSeoFix({
  settings,
  title,
  focusKeyword,
  handle,
  metaTitle,
  metaDescription,
  descriptionHtml = "",
  productType = "",
  tags = "",
  mode = "full",
  preserveHandle = false
}) {
  const cleanMode = mode === "minor" ? "minor" : "full";
  const shouldKeepHandle = Boolean(preserveHandle) && validateUrlHandle(handle || "").valid;
  const currentBodyExcerpt = stripHtmlTags(descriptionHtml).slice(0, 700);
  const modeGuidance = cleanMode === "minor" ? `MODE: MINOR SEO POLISH (SURGICAL EDIT)
- Make minimal, high-leverage tweaks rather than rewriting from scratch.
- If title is already valid (25-70 chars) and natural, keep its core wording and make only minor clarity/keyword refinement.
- Focus primarily on fixing metaTitle (45-60), metaDescription (120-155), focusKeyword precision, and lightly polishing descriptionHtml grammar, readability, and natural keyword inclusion without removing existing specs.` : `MODE: FULL AI SEO + CONTENT OPTIMIZATION
- Optimize every SEO field for organic ranking and buyer conversion.
- Write rich, trustworthy Shopify product HTML in descriptionHtml (100-180 words): an engaging <p> intro mentioning the focus keyword once naturally, an <h3>Key Features &amp; Benefits</h3><ul><li>...</li></ul> block, and a concise closing <p>. Only reference details supported by the product info (do not fabricate unverified certifications or dimensions).`;
  const prompt = `
Create improved ecommerce SEO fields and product description HTML for a Shopify product.

${modeGuidance}

Return JSON with keys:
- title
- focusKeyword
- handle
- metaTitle
- metaDescription
- descriptionHtml
- rationale

Hard rules:
- title must be 25-70 characters
- focusKeyword must be 3-40 characters
- ${shouldKeepHandle ? `MUST keep handle exact: "${handle}"` : "handle must be lowercase, hyphenated, 3-45 characters"}
- metaTitle must be 45-60 characters
- metaDescription must be 120-155 characters
- descriptionHtml must be clean semantic Shopify HTML (<p>, <h3>, <ul>, <li>, <strong>) with zero scripts or styles
- keep language clear, specific, and purchase-oriented; avoid keyword stuffing

Current values:
${JSON.stringify(
    {
      title,
      focusKeyword,
      handle,
      metaTitle,
      metaDescription,
      productType,
      tags,
      currentDescriptionExcerpt: currentBodyExcerpt,
      currentDescriptionHtml: descriptionHtml ? String(descriptionHtml).slice(0, 1500) : ""
    },
    null,
    2
  )}
`.trim();
  const response = await requestSeoFixFromProvider({ settings, prompt });
  return normalizeProductSeoSuggestion(
    response,
    {
      title,
      focusKeyword,
      handle
    },
    { preserveHandle: shouldKeepHandle }
  );
}
async function generateProductContentFix({
  settings,
  title,
  focusKeyword = "",
  descriptionHtml = "",
  productType = "",
  tags = "",
  goal = "polish"
}) {
  const cleanGoal = ["polish", "structure", "expand"].includes(goal) ? goal : "polish";
  const currentExcerpt = stripHtmlTags(descriptionHtml).slice(0, 1200);
  const goalInstructions = {
    polish: "Perform a light minor SEO polish: fix grammar, awkward phrasing, spacing, and readability while keeping original specs and structure intact. Include the focus keyword naturally once if helpful.",
    structure: "Reformat the product copy into high-converting, scannable Shopify HTML: short opening <p>, clear <h3>Highlights</h3> with 3-5 <ul><li> bullets, and concise closing <p>. Preserve all factual specs.",
    expand: "Write a comprehensive, conversion-ready SEO product description (120-190 words) using semantic HTML (<p>, <h3>, <ul>, <li>, <strong>) tailored strictly to the product context, naturally placing the focus keyword early without fluff or made-up specs."
  }[cleanGoal];
  const prompt = `
You are an expert ecommerce SEO copywriter optimizing a Shopify product description.

Task (${cleanGoal}): ${goalInstructions}

Rules:
- Return clean semantic HTML only inside "descriptionHtml" using <p>, <h2>, <h3>, <ul>, <li>, <strong>, <em> (no <script>, <style>, inline CSS, or markdown fences).
- Never invent fake materials, dimensions, warranties, or medical claims not supported by the product input.
- Return JSON only:
{
  "descriptionHtml": "<p>...</p>",
  "summary": "1 concise sentence describing what improved"
}

Product context:
${JSON.stringify(
    {
      title,
      focusKeyword,
      productType,
      tags,
      existingWordCount: validateProductDescription(descriptionHtml, focusKeyword).wordCount,
      existingText: currentExcerpt,
      existingHtml: String(descriptionHtml || "").slice(0, 2e3)
    },
    null,
    2
  )}
`.trim();
  const response = await requestSeoFixFromProvider({ settings, prompt });
  const cleanedHtml = sanitizeProductDescriptionHtml((response == null ? void 0 : response.descriptionHtml) || descriptionHtml || "");
  if (!stripHtmlTags(cleanedHtml)) {
    throw new Error("AI did not return usable product description content.");
  }
  const check = validateProductDescription(cleanedHtml, focusKeyword);
  return {
    descriptionHtml: cleanedHtml,
    wordCount: check.wordCount,
    hasStructure: check.hasStructure,
    hasKeyword: check.hasKeyword,
    summary: cleanText((response == null ? void 0 : response.summary) || `Updated product description (${check.wordCount} words).`)
  };
}
async function generateMetaFix({ settings, title, focusKeyword, currentMetaTitle, currentMetaDescription }) {
  const prompt = `
Create improved SEO metadata for a Shopify product.

Return JSON with keys:
- metaTitle
- metaDescription
- rationale

Hard rules:
- metaTitle must be 45-60 characters
- metaDescription must be 120-155 characters
- keep the copy readable and conversion-focused
- use the focus keyword naturally when provided

Current values:
${JSON.stringify({ title, focusKeyword, currentMetaTitle, currentMetaDescription }, null, 2)}
`.trim();
  const response = await requestSeoFixFromProvider({ settings, prompt });
  return normalizeMetaSuggestion(response, {
    title,
    focusKeyword
  });
}
async function auditProductSeoChange({
  settings,
  productTitle,
  currentValues = {},
  newValues = {}
}) {
  const handleChanged = Boolean(
    currentValues.handle && newValues.handle && currentValues.handle !== newValues.handle
  );
  const compactState = (state) => ({
    title: state.title || "",
    focusKeyword: state.focusKeyword || "",
    handle: state.handle || "",
    metaTitle: state.metaTitle || "",
    metaDescription: state.metaDescription || "",
    descriptionWordCount: validateProductDescription(state.descriptionHtml || "", state.focusKeyword || "").wordCount,
    descriptionExcerpt: stripHtmlTags(state.descriptionHtml || "").slice(0, 400)
  });
  const prompt = `
You are a senior ecommerce SEO analyst. Evaluate the following proposed SEO changes for a Shopify product: "${productTitle || "Product"}".

Original SEO State:
${JSON.stringify(compactState(currentValues), null, 2)}

Proposed New SEO State:
${JSON.stringify(compactState(newValues), null, 2)}

Handle changed: ${handleChanged ? "YES (301 redirect needed)" : "NO"}

Evaluate the impact and return JSON only:
{
  "intentShift": "A concise sentence explaining how search intent or keyword alignment shifted",
  "projectedCtrDelta": "+X% to +Y% (e.g. '+10% to +15%') or 'Neutral'",
  "riskRating": "LOW" | "MODERATE" | "HIGH",
  "redirectRecommended": ${handleChanged},
  "keyImprovements": ["Improvement point 1", "Improvement point 2"],
  "warnings": ["Warning if any, e.g. handle change or keyword deletion"],
  "verdict": "Clear recommendation whether to accept this change or what to refine"
}
`.trim();
  try {
    const response = await requestSeoFixFromProvider({ settings, prompt });
    return {
      intentShift: cleanText(response.intentShift || "Optimized keyword targeting and metadata length for higher SERP visibility."),
      projectedCtrDelta: cleanText(response.projectedCtrDelta || "+8% to +14%"),
      riskRating: ["LOW", "MODERATE", "HIGH"].includes(String(response.riskRating || "").toUpperCase()) ? String(response.riskRating).toUpperCase() : handleChanged ? "MODERATE" : "LOW",
      redirectRecommended: Boolean(response.redirectRecommended || handleChanged),
      keyImprovements: Array.isArray(response.keyImprovements) && response.keyImprovements.length ? response.keyImprovements.map(cleanText) : ["Better alignment with high-converting search intent", "Metadata formatted to prevent Google truncation"],
      warnings: Array.isArray(response.warnings) ? response.warnings.map(cleanText).filter(Boolean) : handleChanged ? ["Handle change detected: Ensure 301 redirect is active to prevent 404 errors."] : [],
      verdict: cleanText(response.verdict || "Recommended change. Improves keyword relevance without exceeding SERP limits.")
    };
  } catch (error) {
    return {
      intentShift: "Enhanced search intent alignment with target keywords.",
      projectedCtrDelta: "+5% to +10%",
      riskRating: handleChanged ? "MODERATE" : "LOW",
      redirectRecommended: handleChanged,
      keyImprovements: [
        "Normalized title and metadata to ideal search engine lengths",
        handleChanged ? "Cleaned URL slug structure" : "Maintained canonical handle stability"
      ],
      warnings: handleChanged ? ["URL handle changed. A 301 redirect is recommended to preserve SEO authority."] : [],
      verdict: "Acceptable update. Review metadata preview before saving.",
      fallbackUsed: true,
      error: error == null ? void 0 : error.message
    };
  }
}
async function generateVisionImageAlt({ settings, imageUrl, productTitle }) {
  const fallbackAlt = `${trimToMax(productTitle || "Product", 40)} - detailed product view`;
  const effective = resolveEffectiveAiConfig(settings);
  if (!effective.apiKey || !imageUrl) {
    return {
      altText: fallbackAlt,
      source: "heuristic",
      fallbackUsed: true
    };
  }
  try {
    const imgResponse = await fetch(imageUrl);
    if (!imgResponse.ok) throw new Error("Could not fetch image from URL");
    const buffer = await imgResponse.arrayBuffer();
    const base64Data = Buffer.from(buffer).toString("base64");
    const mimeType = imgResponse.headers.get("content-type") || "image/jpeg";
    const prompt = `Write an optimized, descriptive Google Image SEO ALT tag for this product photo of "${productTitle}".
Rules:
- 40 to 120 characters
- Accurately describe visual details (color, cut, texture, style, perspective)
- No keyword stuffing, natural human phrasing
- Return JSON: {"altText": "...", "visualDetails": "..."}`;
    const parsed = await callGoogleGenerateContent({
      model: effective.model,
      apiKey: effective.apiKey,
      body: {
        contents: [
          {
            role: "user",
            parts: [
              {
                inlineData: {
                  mimeType,
                  data: base64Data
                }
              },
              { text: prompt }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.3,
          responseMimeType: "application/json"
        }
      }
    });
    const altText = cleanText(parsed.altText || fallbackAlt);
    return {
      altText: trimToMax(altText, 125),
      visualDetails: parsed.visualDetails || "",
      source: "gemini_vision",
      fallbackUsed: false
    };
  } catch (error) {
    return {
      altText: fallbackAlt,
      source: "fallback",
      fallbackUsed: true,
      error: error == null ? void 0 : error.message
    };
  }
}
async function generateStoreCopilotBrief({ settings, storeDomain, scan, gscData = null }) {
  var _a2, _b, _c, _d, _e, _f, _g;
  const summary = (scan == null ? void 0 : scan.summary) || {};
  const pillars = summary.pillars || {};
  const topIssues = ((scan == null ? void 0 : scan.issues) || []).slice(0, 15).map((issue) => ({
    severity: issue.severity,
    title: issue.title,
    targetUrl: issue.targetUrl,
    fixPath: issue.fixPath
  }));
  const gscConnected = Boolean(gscData == null ? void 0 : gscData.connected);
  const gscQuickWins = gscConnected ? (gscData.quickWins || []).slice(0, 10).map((qw) => ({
    query: qw.query,
    path: qw.path,
    productTitle: qw.productTitle || "",
    position: qw.position,
    impressions: qw.impressions,
    clicks: qw.clicks,
    ctrPercent: qw.ctr
  })) : [];
  const gscSummaryBlock = gscConnected ? `
Google Search Console Live Performance:
- Total Clicks: ${((_a2 = gscData.summary) == null ? void 0 : _a2.totalClicks) ?? 0} | Impressions: ${((_b = gscData.summary) == null ? void 0 : _b.totalImpressions) ?? 0} | Avg CTR: ${((_c = gscData.summary) == null ? void 0 : _c.avgCtr) ?? 0}% | Avg Position: ${((_d = gscData.summary) == null ? void 0 : _d.avgPosition) ?? 0}
- Quick-Win Keywords Currently Ranking Positions 8-20:
${JSON.stringify(gscQuickWins, null, 2)}
` : "\nGoogle Search Console: Not connected yet.\n";
  const prompt = `
You are an executive ecommerce SEO strategist analyzing the Shopify store "${storeDomain || "Store"}".

Current Audit Summary:
- Overall Score: ${summary.score ?? 0}/100 (${summary.health || "unknown"})
- Pages Scanned: ${(scan == null ? void 0 : scan.pagesScanned) ?? 0}
- Index Coverage: ${(scan == null ? void 0 : scan.indexCoverage) ?? 0}%
- Critical / Warning / Info: ${((_e = summary.counts) == null ? void 0 : _e.critical) ?? 0} / ${((_f = summary.counts) == null ? void 0 : _f.warning) ?? 0} / ${((_g = summary.counts) == null ? void 0 : _g.info) ?? 0}
- 5-Pillar Scores: ${JSON.stringify(pillars)}
${gscSummaryBlock}
Sample Top Findings:
${JSON.stringify(topIssues, null, 2)}

Return JSON only:
{
  "executiveSummary": "2-3 sentences summarizing store health, biggest bottleneck, and commercial opportunity (mention Search Console rankings/quick-wins if connected)",
  "scoreProjection": "Estimated score gain (e.g. '+12 to +18 pts after fixing top critical issues')",
  "topQuickWins": [
    {
      "title": "Actionable quick win title",
      "impact": "HIGH",
      "effort": "LOW",
      "action": "Specific step the merchant should take",
      "targetPath": "/app/products"
    }
  ],
  "gscQuickWinAdvice": [
    {
      "query": "exact quick-win query from positions 8-20 (empty array if GSC not connected)",
      "pagePath": "/products/...",
      "recommendation": "Specific meta title/CTR angle to push this query from page 2 to top 5"
    }
  ],
  "priorityFocus": "The single highest-ROI focus area right now",
  "riskAlert": "Any major SEO risk spotted (or 'No immediate structural risks')"
}
`.trim();
  const response = await requestSeoFixFromProvider({ settings, prompt });
  return {
    executiveSummary: cleanText(response.executiveSummary || "Store audit analyzed. Prioritize resolving critical metadata issues first."),
    scoreProjection: cleanText(response.scoreProjection || "+8 to +15 points"),
    topQuickWins: Array.isArray(response.topQuickWins) ? response.topQuickWins.slice(0, 4).map((item) => ({
      title: cleanText((item == null ? void 0 : item.title) || "Optimize high-priority products"),
      impact: cleanText((item == null ? void 0 : item.impact) || "HIGH"),
      effort: cleanText((item == null ? void 0 : item.effort) || "LOW"),
      action: cleanText((item == null ? void 0 : item.action) || "Update missing meta titles and focus keywords."),
      targetPath: cleanText((item == null ? void 0 : item.targetPath) || "/app/products")
    })) : [],
    gscQuickWinAdvice: Array.isArray(response.gscQuickWinAdvice) ? response.gscQuickWinAdvice.slice(0, 5).map((item) => ({
      query: cleanText((item == null ? void 0 : item.query) || ""),
      pagePath: cleanText((item == null ? void 0 : item.pagePath) || ""),
      recommendation: cleanText((item == null ? void 0 : item.recommendation) || "")
    })).filter((item) => Boolean(item.query || item.recommendation)) : [],
    priorityFocus: cleanText(response.priorityFocus || "Product metadata & focus keyword coverage"),
    riskAlert: cleanText(response.riskAlert || "Monitor duplicate focus keywords to avoid cannibalization.")
  };
}
async function resolveKeywordCannibalization({ settings, groups = [] }) {
  if (!groups.length) {
    return {
      resolutions: [],
      summary: "No keyword cannibalization conflicts detected in the current catalog."
    };
  }
  const prompt = `
You are an ecommerce SEO architect fixing internal keyword cannibalization on a Shopify store.
Each group below contains products sharing the exact same focus keyword. Assign each product a unique, distinct, purchase-oriented focus keyword (3-40 chars) tailored to its specific title/attributes so they do not compete against each other in Google Search.

Conflicting Groups:
${JSON.stringify(groups.slice(0, 8), null, 2)}

Return JSON only:
{
  "summary": "1-2 sentences explaining the keyword differentiation strategy",
  "resolutions": [
    {
      "productId": "exact productId string from input",
      "productTitle": "product title",
      "currentKeyword": "shared keyword",
      "suggestedKeyword": "distinct 3-40 char focus keyword",
      "reasoning": "brief why this differentiates search intent"
    }
  ]
}
`.trim();
  const response = await requestSeoFixFromProvider({ settings, prompt });
  return {
    summary: cleanText(response.summary || "Differentiated focus keywords across competing products to eliminate internal SERP competition."),
    resolutions: Array.isArray(response.resolutions) ? response.resolutions.map((item) => ({
      productId: String(item.productId || ""),
      productTitle: cleanText(item.productTitle || ""),
      currentKeyword: cleanText(item.currentKeyword || ""),
      suggestedKeyword: trimToMax(item.suggestedKeyword || "", 40),
      reasoning: cleanText(item.reasoning || "Unique intent variation to target a distinct buyer query.")
    })) : []
  };
}
async function generateAiRobotsSuggestion({ settings, currentRules, storeDomain }) {
  const prompt = `
Optimize a Shopify store's robots.txt directives for "${storeDomain || "Shopify store"}".
Current rules:
${currentRules || "(empty)"}

Hard rules:
- Must include User-agent: *
- Must include Disallow: /cart and Disallow: /search
- Must preserve Allow: / and Sitemap guidance if helpful, without blocking /products or /collections
- Return JSON only:
{
  "robotsTxt": "clean newline-separated robots.txt content",
  "rationale": "short explanation of improvements"
}
`.trim();
  const response = await requestSeoFixFromProvider({ settings, prompt });
  return {
    robotsTxt: String(response.robotsTxt || currentRules || "").trim(),
    rationale: cleanText(response.rationale || "Updated robots.txt crawl directives with required Shopify disallow paths.")
  };
}
function summarizeReportForPrompt(report) {
  var _a2, _b, _c, _d, _e, _f, _g, _h, _i, _j;
  if (!report) return null;
  return {
    testedUrl: report.testedUrl,
    strategy: report.strategy,
    passwordProtected: Boolean(report.passwordProtected),
    scores: report.scores,
    lcpElement: report.lcpElement || "",
    totalBytesLabel: report.totalBytesLabel || "",
    metrics: {
      lcp: (_b = (_a2 = report.metrics) == null ? void 0 : _a2.lcp) == null ? void 0 : _b.displayValue,
      inpOrTbt: (_d = (_c = report.metrics) == null ? void 0 : _c.inp) == null ? void 0 : _d.displayValue,
      cls: (_f = (_e = report.metrics) == null ? void 0 : _e.cls) == null ? void 0 : _f.displayValue,
      fcp: (_h = (_g = report.metrics) == null ? void 0 : _g.fcp) == null ? void 0 : _h.displayValue,
      ttfb: (_j = (_i = report.metrics) == null ? void 0 : _i.ttfb) == null ? void 0 : _j.displayValue
    },
    topBottlenecks: (report.opportunities || []).slice(0, 7).map((op) => ({
      id: op.id,
      title: op.title,
      impact: op.displayValue,
      category: op.category,
      offendingResources: (op.items || []).slice(0, 3).map((it) => ({
        url: it.url || it.label,
        wastedMs: it.wastedMs,
        wastedBytes: it.wastedBytes
      }))
    })),
    seoFailures: (report.seoFindings || []).slice(0, 6).map((item) => ({
      id: item.id,
      title: item.title,
      displayValue: item.displayValue
    }))
  };
}
async function generatePageSpeedAiFixPlan({
  settings,
  storeDomain,
  report,
  mobileReport = null,
  desktopReport = null,
  matchedProductTitle = ""
}) {
  const primary = report || mobileReport || desktopReport;
  if (!primary) {
    throw new Error("Run a live Google PageSpeed test before generating an AI fix plan.");
  }
  const promptPayload = {
    storeDomain: storeDomain || "Shopify store",
    matchedProductTitle: matchedProductTitle || null,
    mobile: summarizeReportForPrompt(mobileReport || (primary.strategy === "mobile" ? primary : null)),
    desktop: summarizeReportForPrompt(desktopReport || (primary.strategy === "desktop" ? primary : null))
  };
  const prompt = `
You are a senior Shopify Core Web Vitals & technical SEO architect.
Analyze the live Google PageSpeed Insights telemetry below and generate a concrete, Shopify-specific remediation plan covering both speed (LCP, INP/TBT, CLS, TTFB) and SEO crawl/snippet health.

Live Telemetry:
${JSON.stringify(promptPayload, null, 2)}

Rules:
- Be specific to the real offending scripts/images/audits above — do not invent fake URLs or scores.
- Where a fix belongs to Shopify Liquid/theme code (e.g., layout/theme.liquid, sections/main-product.liquid, CSS aspect-ratio/font-display, deferring scripts), provide a short copy-pasteable Liquid/HTML snippet in "liquidSnippet" (or "" if not code-based).
- Valid "fixType" values: "IN_APP_SEO" (meta/ALT/robots solvable inside Ecom SEO app), "THEME_LIQUID", "APP_SCRIPTS", "IMAGES".
- Valid "targetRoute" values (only when solvable inside Ecom SEO): "/app/products", "/app/image-optimizer", "/app/bulk-meta", "/app/robots", "/app/sitemap", or "".

Return JSON only:
{
  "executiveSummary": "2-3 sentences diagnosing the #1 Core Web Vitals bottleneck and SEO opportunity.",
  "projectedPerformanceGain": "Realistic range e.g. '+12 to +22 Mobile Performance pts'",
  "projectedSeoImpact": "Concise SEO ranking/crawl outcome e.g. 'Improves LCP speed signal and resolves missing meta/ALT elements'",
  "priorityFixes": [
    {
      "title": "Actionable fix title",
      "impact": "HIGH",
      "metricTarget": "LCP",
      "fixType": "THEME_LIQUID",
      "targetRoute": "",
      "estimatedGain": "Est. 400-800ms LCP reduction",
      "actionSteps": "Clear step-by-step instruction for a Shopify merchant or developer.",
      "liquidSnippet": ""
    }
  ]
}
`.trim();
  const response = await requestSeoFixFromProvider({ settings, prompt });
  const ALLOWED_FIX_TYPES = /* @__PURE__ */ new Set(["IN_APP_SEO", "THEME_LIQUID", "APP_SCRIPTS", "IMAGES"]);
  const ALLOWED_ROUTES = /* @__PURE__ */ new Set([
    "/app/products",
    "/app/image-optimizer",
    "/app/bulk-meta",
    "/app/robots",
    "/app/sitemap"
  ]);
  return {
    testedUrl: primary.testedUrl,
    executiveSummary: cleanText(
      response.executiveSummary || "Live PageSpeed telemetry analyzed. Prioritize reducing render-blocking assets, optimizing LCP hero images, and tightening mobile JavaScript execution."
    ),
    projectedPerformanceGain: cleanText(response.projectedPerformanceGain || "+10 to +20 Performance pts"),
    projectedSeoImpact: cleanText(response.projectedSeoImpact || "Stronger Core Web Vitals & clean crawl/snippet signals"),
    priorityFixes: Array.isArray(response.priorityFixes) ? response.priorityFixes.slice(0, 6).map((item) => {
      const fixType = String((item == null ? void 0 : item.fixType) || "THEME_LIQUID").toUpperCase();
      const targetRoute = String((item == null ? void 0 : item.targetRoute) || "").trim();
      return {
        title: cleanText((item == null ? void 0 : item.title) || "Optimize Core Web Vitals bottleneck"),
        impact: String((item == null ? void 0 : item.impact) || "HIGH").toUpperCase() === "MEDIUM" ? "MEDIUM" : "HIGH",
        metricTarget: cleanText((item == null ? void 0 : item.metricTarget) || "LCP"),
        fixType: ALLOWED_FIX_TYPES.has(fixType) ? fixType : "THEME_LIQUID",
        targetRoute: ALLOWED_ROUTES.has(targetRoute) ? targetRoute : "",
        estimatedGain: cleanText((item == null ? void 0 : item.estimatedGain) || "Faster load time"),
        actionSteps: cleanText((item == null ? void 0 : item.actionSteps) || "Review flagged theme assets and scripts."),
        liquidSnippet: String((item == null ? void 0 : item.liquidSnippet) || "").trim().slice(0, 1500)
      };
    }) : []
  };
}
const DEFAULT_ROBOTS = `User-agent: *
Disallow: /cart
Disallow: /search
Allow: /`;
const DEFAULT_AUTOPILOT = {
  enabled: false,
  optimizeMeta: true,
  optimizeAlt: true,
  maxImagesPerProduct: 3,
  lastRuns: []
};
const DEFAULT_GSC = {
  connected: false,
  mode: "",
  siteUrl: "",
  accessToken: "",
  refreshToken: "",
  expiresAt: 0,
  availableSites: [],
  lastSyncedAt: null,
  summary: null,
  urlMetrics: [],
  quickWins: []
};
const DEFAULT_PAGESPEED = {
  lastTestedUrl: "",
  lastTestedAt: null,
  mobile: null,
  desktop: null,
  history: [],
  lastAiPlan: null,
  completedManualIds: []
};
const DEFAULT_STATE = {
  productSeo: {},
  imageOptimizerHistory: [],
  lastScan: null,
  scoreHistory: [],
  robotsTxt: DEFAULT_ROBOTS,
  sitemapManualUrls: [],
  sitemapGeneratedAt: null,
  sitemapUrls: [],
  aiSettings: { ...DEFAULT_AI_SETTINGS },
  autopilot: { ...DEFAULT_AUTOPILOT },
  gsc: { ...DEFAULT_GSC },
  pageSpeed: { ...DEFAULT_PAGESPEED }
};
function parseState(jsonText) {
  if (!jsonText) return { ...DEFAULT_STATE };
  try {
    const parsed = JSON.parse(jsonText);
    const parsedAutopilot = parsed.autopilot && typeof parsed.autopilot === "object" ? parsed.autopilot : {};
    const parsedGsc = parsed.gsc && typeof parsed.gsc === "object" ? parsed.gsc : {};
    const parsedPageSpeed = parsed.pageSpeed && typeof parsed.pageSpeed === "object" ? parsed.pageSpeed : {};
    return {
      ...DEFAULT_STATE,
      ...parsed,
      productSeo: parsed.productSeo || {},
      imageOptimizerHistory: Array.isArray(parsed.imageOptimizerHistory) ? parsed.imageOptimizerHistory : [],
      scoreHistory: Array.isArray(parsed.scoreHistory) ? parsed.scoreHistory : [],
      sitemapManualUrls: Array.isArray(parsed.sitemapManualUrls) ? parsed.sitemapManualUrls : [],
      sitemapUrls: Array.isArray(parsed.sitemapUrls) ? parsed.sitemapUrls : [],
      aiSettings: normalizeAiSettings(parsed.aiSettings || {}),
      autopilot: {
        ...DEFAULT_AUTOPILOT,
        ...parsedAutopilot,
        enabled: Boolean(parsedAutopilot.enabled),
        optimizeMeta: parsedAutopilot.optimizeMeta !== false,
        optimizeAlt: parsedAutopilot.optimizeAlt !== false,
        maxImagesPerProduct: Math.max(1, Math.min(10, Number(parsedAutopilot.maxImagesPerProduct || 3) || 3)),
        lastRuns: Array.isArray(parsedAutopilot.lastRuns) ? parsedAutopilot.lastRuns : []
      },
      gsc: {
        ...DEFAULT_GSC,
        ...parsedGsc,
        connected: Boolean(parsedGsc.connected),
        availableSites: Array.isArray(parsedGsc.availableSites) ? parsedGsc.availableSites : [],
        urlMetrics: Array.isArray(parsedGsc.urlMetrics) ? parsedGsc.urlMetrics : [],
        quickWins: Array.isArray(parsedGsc.quickWins) ? parsedGsc.quickWins : []
      },
      pageSpeed: {
        ...DEFAULT_PAGESPEED,
        ...parsedPageSpeed,
        mobile: parsedPageSpeed.mobile || null,
        desktop: parsedPageSpeed.desktop || null,
        history: Array.isArray(parsedPageSpeed.history) ? parsedPageSpeed.history : [],
        lastAiPlan: parsedPageSpeed.lastAiPlan || null,
        completedManualIds: Array.isArray(parsedPageSpeed.completedManualIds) ? parsedPageSpeed.completedManualIds : []
      }
    };
  } catch {
    return { ...DEFAULT_STATE };
  }
}
const appStateQueues = /* @__PURE__ */ new Map();
function normalizeShopKey(shop) {
  return String(shop || "").trim().toLowerCase();
}
function enqueueAppStateMutation(shop, task) {
  const key = normalizeShopKey(shop) || "__default__";
  const prev = appStateQueues.get(key) || Promise.resolve();
  const next = prev.then(task, task);
  const cleanup = next.then(
    () => void 0,
    () => void 0
  );
  appStateQueues.set(key, cleanup);
  return next.finally(() => {
    if (appStateQueues.get(key) === cleanup) {
      appStateQueues.delete(key);
    }
  });
}
async function getAppState(shop) {
  const cleanShop = normalizeShopKey(shop);
  if (!cleanShop) return { ...DEFAULT_STATE };
  const record = await prisma.appState.findUnique({ where: { shop: cleanShop } });
  if (!record) return { ...DEFAULT_STATE };
  return parseState(record.stateJson);
}
async function updateAppState(shop, mutator) {
  const cleanShop = normalizeShopKey(shop);
  if (!cleanShop) return { ...DEFAULT_STATE };
  return enqueueAppStateMutation(cleanShop, async () => {
    return prisma.$transaction(async (tx) => {
      const record = await tx.appState.findUnique({ where: { shop: cleanShop } });
      const current = record ? parseState(record.stateJson) : { ...DEFAULT_STATE };
      const next = mutator(current);
      const serialized = JSON.stringify(next);
      await tx.appState.upsert({
        where: { shop: cleanShop },
        update: { stateJson: serialized },
        create: { shop: cleanShop, stateJson: serialized }
      });
      return next;
    });
  });
}
const PLAN_ALLOWANCES = Object.freeze({
  FREE: 15,
  PRO: 50
});
const CREDIT_COSTS = Object.freeze({
  meta_fix: 1,
  product_content_fix: 2,
  product_content_expand: 3,
  robots_txt_improvement: 2,
  product_seo_minor: 2,
  product_seo_fix: 3,
  audit_change: 2,
  vision_alt: 4,
  pagespeed_ai_fix: 4,
  catalog_cannibalization: 6,
  store_copilot: 10
});
const TOKEN_PACKAGES = Object.freeze([
  {
    id: "pack_100",
    tokens: 100,
    price: 5,
    label: "100 Tokens",
    tag: "Starter Top-Up",
    pricePerToken: "$0.05 / token",
    packName: "100 AI Tokens Package",
    featured: false
  },
  {
    id: "pack_250",
    tokens: 250,
    price: 10,
    label: "250 Tokens",
    tag: "Popular · Save 20%",
    pricePerToken: "$0.04 / token",
    packName: "250 AI Tokens Package",
    featured: true
  },
  {
    id: "pack_500",
    tokens: 500,
    price: 18,
    label: "500 Tokens",
    tag: "Best Value · Save 28%",
    pricePerToken: "$0.036 / token",
    packName: "500 AI Tokens Package",
    featured: false
  }
]);
function getTokenPackageById(packageId) {
  const cleanId = String(packageId || "").trim();
  return TOKEN_PACKAGES.find((pkg) => pkg.id === cleanId) || TOKEN_PACKAGES[0];
}
function resolvePackageFromShopifyPurchase(purchase, fallbackPackageId = "") {
  var _a2;
  if (!purchase) return null;
  const purchaseName = String(purchase.name || "").trim();
  const amount = Number((_a2 = purchase == null ? void 0 : purchase.price) == null ? void 0 : _a2.amount);
  const byName = TOKEN_PACKAGES.find((pkg) => pkg.packName === purchaseName);
  if (byName) return byName;
  if (Number.isFinite(amount) && amount > 0) {
    const byPrice = TOKEN_PACKAGES.find((pkg) => Math.abs(pkg.price - amount) < 0.01);
    if (byPrice) return byPrice;
  }
  return getTokenPackageById(fallbackPackageId);
}
function resolveActionCreditCost(actionType, payload = {}) {
  if (actionType === "product_seo_fix") {
    return (payload == null ? void 0 : payload.mode) === "minor" ? CREDIT_COSTS.product_seo_minor : CREDIT_COSTS.product_seo_fix;
  }
  if (actionType === "product_content_fix") {
    return (payload == null ? void 0 : payload.goal) === "expand" ? CREDIT_COSTS.product_content_expand : CREDIT_COSTS.product_content_fix;
  }
  return CREDIT_COSTS[actionType] ?? 1;
}
function normalizeShop(shop) {
  return String(shop || "").trim().toLowerCase();
}
function getNextCycleDate() {
  const next = /* @__PURE__ */ new Date();
  next.setDate(next.getDate() + 30);
  return next;
}
async function getOrCreateCreditAccount(shop, preferredPlan = "FREE") {
  const cleanShop = normalizeShop(shop);
  if (!cleanShop) {
    throw new Error("Shop is required to manage AI credits.");
  }
  let account = await prisma.aiCreditAccount.findUnique({
    where: { shop: cleanShop }
  });
  const now = /* @__PURE__ */ new Date();
  if (!account) {
    const isPro = String(preferredPlan || "FREE").toUpperCase() === "PRO";
    const quota = isPro ? PLAN_ALLOWANCES.PRO : PLAN_ALLOWANCES.FREE;
    account = await prisma.aiCreditAccount.create({
      data: {
        shop: cleanShop,
        plan: isPro ? "PRO" : "FREE",
        totalCredits: quota,
        usedCredits: 0,
        bonusCredits: 0,
        cycleResetAt: getNextCycleDate()
      }
    });
  } else if (now >= new Date(account.cycleResetAt)) {
    const planFloor = account.plan === "PRO" ? PLAN_ALLOWANCES.PRO : PLAN_ALLOWANCES.FREE;
    const quota = Math.max(account.totalCredits, planFloor);
    account = await prisma.aiCreditAccount.update({
      where: { shop: cleanShop },
      data: {
        totalCredits: quota,
        usedCredits: 0,
        cycleResetAt: getNextCycleDate()
      }
    });
  }
  const effectiveTotal = account.totalCredits + account.bonusCredits;
  const availableCredits = Math.max(0, effectiveTotal - account.usedCredits);
  const percentUsed = effectiveTotal > 0 ? Math.min(100, Math.round(account.usedCredits / effectiveTotal * 100)) : 0;
  return {
    ...account,
    effectiveTotal,
    availableCredits,
    percentUsed
  };
}
async function checkCreditBalance(shop, actionType, customCost) {
  const cost = typeof customCost === "number" ? customCost : CREDIT_COSTS[actionType] ?? 1;
  const account = await getOrCreateCreditAccount(shop);
  return {
    allowed: account.availableCredits >= cost,
    cost,
    availableCredits: account.availableCredits,
    plan: account.plan,
    account
  };
}
async function deductCredits({
  shop,
  actionType,
  customCost,
  productId = null,
  productTitle = null,
  modelUsed = DEFAULT_GEMINI_MODEL,
  tokensUsed = null,
  bypassLimit = false
}) {
  const cleanShop = normalizeShop(shop);
  const cost = typeof customCost === "number" ? customCost : CREDIT_COSTS[actionType] ?? 1;
  const account = await getOrCreateCreditAccount(cleanShop);
  if (bypassLimit) {
    const usageLog2 = await prisma.aiCreditUsageLog.create({
      data: {
        shop: cleanShop,
        actionType,
        creditsDeducted: 0,
        productId: productId ? String(productId) : null,
        productTitle: productTitle ? String(productTitle).slice(0, 200) : null,
        modelUsed,
        tokensUsed: typeof tokensUsed === "number" ? tokensUsed : null
      }
    });
    return {
      success: true,
      deducted: 0,
      remainingCredits: account.availableCredits,
      usageLogId: usageLog2.id,
      plan: account.plan,
      superAccess: true
    };
  }
  const { updatedAccount, usageLog } = await prisma.$transaction(async (tx) => {
    const current = await tx.aiCreditAccount.findUnique({ where: { shop: cleanShop } });
    const effective = ((current == null ? void 0 : current.totalCredits) ?? 0) + ((current == null ? void 0 : current.bonusCredits) ?? 0);
    const available = Math.max(0, effective - ((current == null ? void 0 : current.usedCredits) ?? 0));
    if (!current || available < cost) {
      throw new Error(
        `Insufficient AI tokens. This action requires ${cost} token${cost > 1 ? "s" : ""}, but your balance is ${available}. Upgrade to Pro for ${PLAN_ALLOWANCES.PRO} monthly tokens or buy a token package.`
      );
    }
    const updated = await tx.aiCreditAccount.update({
      where: { shop: cleanShop },
      data: {
        usedCredits: { increment: cost }
      }
    });
    const log = await tx.aiCreditUsageLog.create({
      data: {
        shop: cleanShop,
        actionType,
        creditsDeducted: cost,
        productId: productId ? String(productId) : null,
        productTitle: productTitle ? String(productTitle).slice(0, 200) : null,
        modelUsed,
        tokensUsed: typeof tokensUsed === "number" ? tokensUsed : null
      }
    });
    return { updatedAccount: updated, usageLog: log };
  });
  const effectiveTotal = updatedAccount.totalCredits + updatedAccount.bonusCredits;
  const remainingCredits = Math.max(0, effectiveTotal - updatedAccount.usedCredits);
  return {
    success: true,
    deducted: cost,
    remainingCredits,
    usageLogId: usageLog.id,
    plan: updatedAccount.plan,
    superAccess: false
  };
}
async function syncPlanSubscription(shop, isPro) {
  const cleanShop = normalizeShop(shop);
  const current = await getOrCreateCreditAccount(cleanShop);
  const targetPlan = isPro ? "PRO" : "FREE";
  const quota = isPro ? PLAN_ALLOWANCES.PRO : PLAN_ALLOWANCES.FREE;
  if (current.plan === targetPlan) {
    return current;
  }
  return prisma.aiCreditAccount.update({
    where: { shop: cleanShop },
    data: {
      plan: targetPlan,
      totalCredits: isPro ? Math.max(current.totalCredits, quota) : quota
    }
  });
}
async function getCreditUsageHistory(shop, limit = 20) {
  const cleanShop = normalizeShop(shop);
  if (!cleanShop) return [];
  return prisma.aiCreditUsageLog.findMany({
    where: { shop: cleanShop },
    orderBy: { createdAt: "desc" },
    take: limit
  });
}
async function grantCreditPackPurchase(shop, chargeId, credits = 100) {
  const cleanShop = normalizeShop(shop);
  const cleanChargeId = String(chargeId || "").trim();
  const amount = Math.max(1, Number(credits || 0));
  if (!cleanShop || !cleanChargeId) {
    throw new Error("shop and chargeId are required to grant credit packs.");
  }
  await getOrCreateCreditAccount(cleanShop);
  const existing = await prisma.aiCreditUsageLog.findFirst({
    where: {
      shop: cleanShop,
      actionType: "credit_pack_purchase",
      productId: cleanChargeId
    }
  });
  if (existing) {
    const account = await getOrCreateCreditAccount(cleanShop);
    return { granted: false, alreadyGranted: true, availableCredits: account.availableCredits };
  }
  const [updated] = await prisma.$transaction([
    prisma.aiCreditAccount.update({
      where: { shop: cleanShop },
      data: {
        bonusCredits: { increment: amount }
      }
    }),
    prisma.aiCreditUsageLog.create({
      data: {
        shop: cleanShop,
        actionType: "credit_pack_purchase",
        creditsDeducted: -amount,
        productId: cleanChargeId,
        productTitle: `+${amount} AI Token Top-Up Package`,
        modelUsed: "shopify_billing"
      }
    })
  ]);
  const effectiveTotal = updated.totalCredits + updated.bonusCredits;
  return {
    granted: true,
    alreadyGranted: false,
    added: amount,
    availableCredits: Math.max(0, effectiveTotal - updated.usedCredits)
  };
}
function addIssue(issues, severity, title, targetUrl, detail, fixPath, meta = null) {
  issues.push({
    id: `${severity}-${issues.length + 1}`,
    severity,
    title,
    targetUrl,
    detail,
    fixPath,
    ...meta ? { meta } : {}
  });
}
function scoreFromIssues(issues, qualityChecks = {}) {
  const critical = issues.filter((issue) => issue.severity === "Critical").length;
  const warning = issues.filter((issue) => issue.severity === "Warning").length;
  const info = issues.filter((issue) => issue.severity === "Info").length;
  const qualityBonus = Object.values(qualityChecks).filter(Boolean).length;
  const score = Math.max(0, Math.min(100, 100 - critical * 12 - warning * 4 - info + qualityBonus));
  const health = score >= 80 ? "strong" : score >= 55 ? "steady" : "weak";
  return {
    score,
    health,
    counts: { critical, warning, info }
  };
}
function evaluateProductAuditIssues({ storeDomain, product, productState = {}, issues = [] }) {
  const productUrl = `https://${storeDomain}/products/${product.handle}`;
  const productMeta = {
    productId: String(product.id),
    productTitle: String(product.title || ""),
    handle: String(product.handle || ""),
    focusKeyword: String(productState.focusKeyword || ""),
    metaTitle: String(product.metafields_global_title_tag || ""),
    metaDescription: String(product.metafields_global_description_tag || "")
  };
  const titleValid = validateProductTitle(product.title);
  if (!titleValid.valid) {
    addIssue(
      issues,
      "Warning",
      "Product title length issue",
      productUrl,
      "Product title should be between 25 and 70 characters.",
      `/app/products?focus=${product.id}`,
      productMeta
    );
  }
  const focusKeywordValid = validateFocusKeyword(productState.focusKeyword || "");
  if (!focusKeywordValid.valid) {
    addIssue(
      issues,
      "Info",
      "Focus keyword missing or invalid",
      productUrl,
      "Set a focus keyword between 3 and 40 characters.",
      `/app/products?focus=${product.id}`,
      productMeta
    );
  }
  const metaTitleValid = validateMetaTitle(product.metafields_global_title_tag || "");
  if (!metaTitleValid.valid) {
    addIssue(
      issues,
      "Critical",
      "Meta title exceeds hard limit",
      productUrl,
      "Meta title must be 65 characters or less.",
      `/app/products?focus=${product.id}`,
      productMeta
    );
  } else if (!metaTitleValid.ideal) {
    addIssue(
      issues,
      "Warning",
      "Meta title outside ideal length",
      productUrl,
      "Ideal meta title length is 45-60 characters.",
      `/app/products?focus=${product.id}`,
      productMeta
    );
  }
  const metaDescriptionValid = validateMetaDescription(product.metafields_global_description_tag || "");
  if (!metaDescriptionValid.valid) {
    addIssue(
      issues,
      "Critical",
      "Meta description exceeds hard limit",
      productUrl,
      "Meta description must be 160 characters or less.",
      `/app/products?focus=${product.id}`,
      productMeta
    );
  } else if (!metaDescriptionValid.ideal) {
    addIssue(
      issues,
      "Warning",
      "Meta description outside ideal length",
      productUrl,
      "Ideal meta description length is 120-155 characters.",
      `/app/products?focus=${product.id}`,
      productMeta
    );
  }
  const handleValid = validateUrlHandle(product.handle || "");
  if (!handleValid.valid) {
    addIssue(
      issues,
      "Critical",
      "URL handle normalization issue",
      productUrl,
      "URL handle must be lowercase, hyphenated, and 3-45 characters.",
      `/app/url-optimization?focus=${product.id}`,
      productMeta
    );
  }
  return Boolean(titleValid.valid && metaTitleValid.valid && metaDescriptionValid.valid && handleValid.valid);
}
function buildSeoAudit({ storeDomain, products, appState }) {
  var _a2, _b, _c;
  const issues = [];
  let indexable = 0;
  for (const product of products) {
    const productState = ((_a2 = appState.productSeo) == null ? void 0 : _a2[String(product.id)]) || {};
    if (evaluateProductAuditIssues({ storeDomain, product, productState, issues })) {
      indexable += 1;
    }
  }
  const robotsCheck = validateRobotsRules(appState.robotsTxt);
  if (!robotsCheck.valid) {
    addIssue(
      issues,
      "Critical",
      "robots.txt missing required disallow rules",
      `https://${storeDomain}/robots.txt`,
      robotsCheck.message,
      "/app/robots"
    );
  }
  const totalProducts = Math.max(1, products.length);
  const serpScore = Math.round(
    products.filter((p) => {
      const mt = validateMetaTitle(p.metafields_global_title_tag || "");
      const md = validateMetaDescription(p.metafields_global_description_tag || "");
      return mt.valid && md.valid;
    }).length / totalProducts * 100
  );
  const contentScore = Math.round(
    products.filter((p) => {
      var _a3, _b2;
      const tv = validateProductTitle(p.title);
      const kv = validateFocusKeyword(((_b2 = (_a3 = appState.productSeo) == null ? void 0 : _a3[String(p.id)]) == null ? void 0 : _b2.focusKeyword) || "");
      return tv.valid && kv.valid;
    }).length / totalProducts * 100
  );
  const technicalScore = Math.min(
    100,
    Math.round(
      products.filter((p) => validateUrlHandle(p.handle).valid).length / totalProducts * 80 + (robotsCheck.valid ? 20 : 0)
    )
  );
  const visualScore = Math.max(0, 100 - issues.filter((i) => i.title.includes("ALT")).length * 5);
  const keywordMap = /* @__PURE__ */ new Map();
  for (const p of products) {
    const kw = (((_c = (_b = appState.productSeo) == null ? void 0 : _b[String(p.id)]) == null ? void 0 : _c.focusKeyword) || "").trim().toLowerCase();
    if (kw && kw.length >= 3) {
      if (!keywordMap.has(kw)) keywordMap.set(kw, []);
      keywordMap.get(kw).push({
        id: String(p.id),
        title: String(p.title || ""),
        handle: String(p.handle || ""),
        metaTitle: String(p.metafields_global_title_tag || "")
      });
    }
  }
  const cannibalizedGroups = Array.from(keywordMap.entries()).filter(([_, list2]) => list2.length > 1).map(([keyword, groupProducts]) => ({
    keyword,
    count: groupProducts.length,
    products: groupProducts.slice(0, 10)
  }));
  const cannibalScore = Math.max(0, 100 - cannibalizedGroups.length * 15);
  for (const group of cannibalizedGroups) {
    addIssue(
      issues,
      "Warning",
      `Keyword cannibalization: "${group.keyword}" used on ${group.count} products`,
      `https://${storeDomain}/products`,
      `Multiple products share the focus keyword "${group.keyword}", causing internal search competition in Google rankings. Differentiate focus keywords to rank higher.`,
      "/app/products"
    );
  }
  const qualityChecks = {
    robotsValid: robotsCheck.valid,
    sitemapGenerated: Boolean(appState.sitemapGeneratedAt),
    hasManualUrls: appState.sitemapManualUrls.length >= 0
  };
  const scoring = scoreFromIssues(issues, qualityChecks);
  const pagesScanned = products.length + 2;
  return {
    generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    pagesScanned,
    indexCoverage: pagesScanned ? Math.round(indexable / Math.max(1, products.length) * 100) : 0,
    issues,
    summary: {
      ...scoring,
      lastScanDate: (/* @__PURE__ */ new Date()).toISOString(),
      pillars: {
        serpScore,
        contentScore,
        technicalScore,
        visualScore,
        cannibalScore,
        cannibalizedKeywordsCount: cannibalizedGroups.length
      },
      cannibalizedGroups: cannibalizedGroups.slice(0, 10)
    }
  };
}
function patchCachedSeoAudit({
  existingScan,
  storeDomain,
  updatedProducts = [],
  appState
}) {
  var _a2, _b;
  if (!existingScan || !Array.isArray(existingScan.issues)) {
    return null;
  }
  const updatedIds = new Set(
    (Array.isArray(updatedProducts) ? updatedProducts : []).map((p) => String((p == null ? void 0 : p.id) || "")).filter(Boolean)
  );
  const retainedIssues = existingScan.issues.filter((issue) => {
    var _a3;
    if ((issue == null ? void 0 : issue.fixPath) === "/app/robots") return false;
    const pid = ((_a3 = issue == null ? void 0 : issue.meta) == null ? void 0 : _a3.productId) ? String(issue.meta.productId) : "";
    if (pid && updatedIds.has(pid)) return false;
    return true;
  });
  const nextIssues = retainedIssues.map((issue, idx) => ({
    ...issue,
    id: `${issue.severity}-${idx + 1}`
  }));
  for (const product of Array.isArray(updatedProducts) ? updatedProducts : []) {
    if (!(product == null ? void 0 : product.id)) continue;
    const pid = String(product.id);
    const productState = ((_a2 = appState == null ? void 0 : appState.productSeo) == null ? void 0 : _a2[pid]) || {};
    evaluateProductAuditIssues({
      storeDomain,
      product,
      productState,
      issues: nextIssues
    });
  }
  const robotsCheck = validateRobotsRules((appState == null ? void 0 : appState.robotsTxt) || "");
  if (!robotsCheck.valid) {
    addIssue(
      nextIssues,
      "Critical",
      "robots.txt missing required disallow rules",
      `https://${storeDomain}/robots.txt`,
      robotsCheck.message,
      "/app/robots"
    );
  }
  const qualityChecks = {
    robotsValid: robotsCheck.valid,
    sitemapGenerated: Boolean(appState == null ? void 0 : appState.sitemapGeneratedAt),
    hasManualUrls: Array.isArray(appState == null ? void 0 : appState.sitemapManualUrls)
  };
  const scoring = scoreFromIssues(nextIssues, qualityChecks);
  const existingPillars = ((_b = existingScan.summary) == null ? void 0 : _b.pillars) || {};
  const pagesScanned = existingScan.pagesScanned || (Array.isArray(updatedProducts) ? updatedProducts.length + 2 : 2);
  const totalProducts = Math.max(1, pagesScanned - 2);
  const brokenProductIds = new Set(
    nextIssues.filter((issue) => {
      var _a3;
      return issue.severity === "Critical" && ((_a3 = issue.meta) == null ? void 0 : _a3.productId);
    }).map((issue) => String(issue.meta.productId))
  );
  const estimatedIndexable = Math.max(0, totalProducts - brokenProductIds.size);
  return {
    ...existingScan,
    generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    pagesScanned,
    indexCoverage: Math.round(estimatedIndexable / totalProducts * 100),
    issues: nextIssues,
    summary: {
      ...existingScan.summary || {},
      ...scoring,
      lastScanDate: (/* @__PURE__ */ new Date()).toISOString(),
      pillars: {
        ...existingPillars,
        visualScore: Math.max(0, 100 - nextIssues.filter((i) => i.title.includes("ALT")).length * 5)
      }
    }
  };
}
function buildTrendSummary(scoreHistory, currentScore) {
  var _a2;
  const history = Array.isArray(scoreHistory) ? scoreHistory : [];
  const previous = (_a2 = history.at(-1)) == null ? void 0 : _a2.score;
  if (typeof previous !== "number") {
    return { direction: "flat", delta: 0, label: "First scan baseline" };
  }
  const delta = currentScore - previous;
  if (delta > 0) {
    return { direction: "up", delta, label: `Up ${delta} points from last scan` };
  }
  if (delta < 0) {
    return { direction: "down", delta, label: `Down ${Math.abs(delta)} points from last scan` };
  }
  return { direction: "flat", delta: 0, label: "No score change from last scan" };
}
function getSeoEnv() {
  return {
    storeDomain: normalizeShopDomain(process.env.SHOPIFY_STORE_DOMAIN || ""),
    adminToken: (process.env.SHOPIFY_ADMIN_ACCESS_TOKEN || "").trim(),
    apiVersion: (process.env.SHOPIFY_ADMIN_API_VERSION || "2025-10").trim(),
    demoSeedEnabled: (process.env.ENABLE_DEMO_SEED || "false").trim() === "true"
  };
}
function normalizeShopDomain(value) {
  if (!value) return "";
  return String(value).trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
}
function resolveStoreDomain({ envDomain, sessionShop, urlShop }) {
  const fromSession = normalizeShopDomain(sessionShop || "");
  const fromUrl = normalizeShopDomain(urlShop || "");
  const fromEnv = normalizeShopDomain(envDomain || "");
  if (fromSession) return fromSession;
  if (fromUrl) return fromUrl;
  if (fromEnv) return fromEnv;
  return "";
}
function buildMissingConfigMessage({ storeDomain, adminToken }) {
  const missing = [];
  if (!storeDomain) missing.push("SHOPIFY_STORE_DOMAIN");
  if (!adminToken) missing.push("SHOPIFY_ADMIN_ACCESS_TOKEN");
  if (!missing.length) return "";
  return `Missing required Shopify env vars: ${missing.join(", ")}.`;
}
function parseLinkHeader(linkHeader) {
  if (!linkHeader) {
    return { nextPageInfo: "", previousPageInfo: "" };
  }
  const links2 = linkHeader.split(",").map((part) => part.trim());
  const result = { nextPageInfo: "", previousPageInfo: "" };
  for (const link of links2) {
    const [urlPart, relPart] = link.split(";").map((value) => value.trim());
    if (!urlPart || !relPart) continue;
    const relMatch = relPart.match(/rel="(next|previous)"/);
    const hrefMatch = urlPart.match(/<(.+)>/);
    if (!relMatch || !hrefMatch) continue;
    const url = new URL(hrefMatch[1]);
    const pageInfo = url.searchParams.get("page_info") || "";
    if (relMatch[1] === "next") result.nextPageInfo = pageInfo;
    if (relMatch[1] === "previous") result.previousPageInfo = pageInfo;
  }
  return result;
}
function getToken({ envToken, sessionToken }) {
  const cleanSession = String(sessionToken || "").trim();
  const cleanEnv = String(envToken || "").trim();
  if (cleanSession) return cleanSession;
  if (cleanEnv && !cleanEnv.includes("xxx")) return cleanEnv;
  return "";
}
function getShopContext({ sessionShop, sessionToken, urlShop }) {
  const env = getSeoEnv();
  const storeDomain = resolveStoreDomain({
    envDomain: env.storeDomain,
    sessionShop,
    urlShop
  });
  const token = getToken({ envToken: env.adminToken, sessionToken });
  return {
    storeDomain,
    token,
    apiVersion: env.apiVersion,
    configError: buildMissingConfigMessage({
      storeDomain,
      adminToken: token
    })
  };
}
const REST_MIN_INTERVAL_MS = 550;
const GRAPHQL_MIN_INTERVAL_MS = 100;
const DEFAULT_MAX_RETRIES = 5;
const storeBuckets = /* @__PURE__ */ new Map();
function sleep(ms) {
  if (!ms || ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}
function safeParseJson(text2, contentType) {
  if (!text2 || !String(contentType || "").includes("application/json")) {
    return null;
  }
  try {
    return JSON.parse(text2);
  } catch {
    return null;
  }
}
function getBucketState(storeDomain, bucketType) {
  const shopKey = String(storeDomain || "").trim().toLowerCase() || "__default__";
  const key = `${bucketType}:${shopKey}`;
  let state = storeBuckets.get(key);
  if (!state) {
    state = {
      chain: Promise.resolve(),
      nextAllowedAt: 0
    };
    storeBuckets.set(key, state);
  }
  return state;
}
function enqueueStoreCall(storeDomain, bucketType, task) {
  const state = getBucketState(storeDomain, bucketType);
  const result = state.chain.then(() => task(state));
  state.chain = result.then(
    () => void 0,
    () => void 0
  );
  return result;
}
function parseRetryAfterMs(headerValue, attempt) {
  if (headerValue !== null && headerValue !== void 0 && String(headerValue).trim() !== "") {
    const raw = String(headerValue).trim();
    const seconds = Number(raw);
    if (Number.isFinite(seconds) && seconds >= 0) {
      const ms = Math.ceil(seconds * 1e3);
      return ms >= 500 ? ms + 150 : Math.max(1, ms);
    }
    const parsedDate = Date.parse(raw);
    if (Number.isFinite(parsedDate)) {
      return Math.max(100, parsedDate - Date.now() + 150);
    }
  }
  return Math.min(1e4, 1200 * Math.pow(2, attempt));
}
function parseRestCallLimitDelayMs(callLimitHeader, minIntervalMs) {
  const match = String(callLimitHeader || "").trim().match(/^(\d+)\s*\/\s*(\d+)$/);
  if (!match) return minIntervalMs;
  const used = Number(match[1]);
  const max = Number(match[2]);
  if (!Number.isFinite(used) || !Number.isFinite(max) || max <= 0) return minIntervalMs;
  const remaining = max - used;
  if (remaining <= 2) return Math.max(minIntervalMs, 2e3);
  if (remaining <= 6) return Math.max(minIntervalMs, 1100);
  return minIntervalMs;
}
function parseGraphqlThrottleDelayMs(json, minIntervalMs) {
  var _a2, _b;
  const throttle = (_b = (_a2 = json == null ? void 0 : json.extensions) == null ? void 0 : _a2.cost) == null ? void 0 : _b.throttleStatus;
  if (!throttle) return minIntervalMs;
  const available = Number(throttle.currentlyAvailable);
  const restoreRate = Number(throttle.restoreRate || 50);
  if (!Number.isFinite(available) || !Number.isFinite(restoreRate) || restoreRate <= 0) {
    return minIntervalMs;
  }
  if (available < 150) {
    const recoveryMs = Math.ceil((150 - available) / restoreRate * 1e3) + 100;
    return Math.max(minIntervalMs, Math.min(5e3, recoveryMs));
  }
  return minIntervalMs;
}
function isRateLimitedText(value) {
  return /exceeded 2 calls per second|throttled|too many requests/i.test(String(value || ""));
}
async function executeShopifyRequestWithRetry({
  storeDomain,
  bucketType,
  url,
  init,
  maxRetries,
  minIntervalMs,
  shouldRetryResponse,
  computeNextDelayMs,
  computeRetryDelayMs
}) {
  return enqueueStoreCall(storeDomain, bucketType, async (state) => {
    let lastResult = null;
    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      const waitMs = state.nextAllowedAt - Date.now();
      if (waitMs > 0) {
        await sleep(waitMs);
      }
      const response = await fetch(url, init);
      const text2 = await response.text();
      const contentType = response.headers.get("content-type") || "";
      const json = safeParseJson(text2, contentType);
      lastResult = { response, text: text2, json };
      if (attempt < maxRetries && shouldRetryResponse({ response, json, text: text2 })) {
        const retryDelayMs = computeRetryDelayMs({ response, json, attempt, minIntervalMs });
        state.nextAllowedAt = Math.max(state.nextAllowedAt, Date.now() + retryDelayMs);
        await sleep(retryDelayMs);
        continue;
      }
      const nextDelayMs = computeNextDelayMs({ response, json, attempt, minIntervalMs });
      state.nextAllowedAt = Date.now() + nextDelayMs;
      return lastResult;
    }
    return lastResult;
  });
}
async function shopifyRestRequest({
  storeDomain,
  token,
  apiVersion,
  path,
  method = "GET",
  body,
  maxRetries = DEFAULT_MAX_RETRIES,
  minIntervalMs = REST_MIN_INTERVAL_MS
}) {
  const url = `https://${storeDomain}/admin/api/${apiVersion}${path}`;
  const { response, text: text2, json } = await executeShopifyRequestWithRetry({
    storeDomain,
    bucketType: "rest",
    url,
    init: {
      method,
      headers: {
        "X-Shopify-Access-Token": token,
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: body ? JSON.stringify(body) : void 0
    },
    maxRetries,
    minIntervalMs,
    shouldRetryResponse: ({ response: res, json: payload, text: rawText }) => res.status === 429 || isRateLimitedText((payload == null ? void 0 : payload.errors) ? JSON.stringify(payload.errors) : rawText),
    computeRetryDelayMs: ({ response: res, attempt, minIntervalMs: floorMs }) => Math.max(floorMs, parseRetryAfterMs(res.headers.get("retry-after"), attempt)),
    computeNextDelayMs: ({ response: res, attempt, minIntervalMs: floorMs }) => {
      if (res.status === 429) {
        return Math.max(floorMs, parseRetryAfterMs(res.headers.get("retry-after"), attempt));
      }
      return parseRestCallLimitDelayMs(res.headers.get("x-shopify-shop-api-call-limit"), floorMs);
    }
  });
  if (!response.ok) {
    const error = new Error(
      (json == null ? void 0 : json.errors) ? `Shopify API error: ${JSON.stringify(json.errors)}` : `Shopify API request failed with status ${response.status}.`
    );
    error.status = response.status;
    error.details = json || text2;
    throw error;
  }
  return {
    data: json || {},
    pagination: parseLinkHeader(response.headers.get("link"))
  };
}
async function shopifyGraphqlRequest({
  storeDomain,
  token,
  apiVersion,
  query,
  variables = {},
  maxRetries = DEFAULT_MAX_RETRIES,
  minIntervalMs = GRAPHQL_MIN_INTERVAL_MS
}) {
  const url = `https://${storeDomain}/admin/api/${apiVersion}/graphql.json`;
  const { response, text: text2, json } = await executeShopifyRequestWithRetry({
    storeDomain,
    bucketType: "graphql",
    url,
    init: {
      method: "POST",
      headers: {
        "X-Shopify-Access-Token": token,
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify({ query, variables })
    },
    maxRetries,
    minIntervalMs,
    shouldRetryResponse: ({ response: res, json: payload }) => {
      if (res.status === 429) return true;
      if (!Array.isArray(payload == null ? void 0 : payload.errors)) return false;
      return payload.errors.some(
        (entry2) => {
          var _a2;
          return ((_a2 = entry2 == null ? void 0 : entry2.extensions) == null ? void 0 : _a2.code) === "THROTTLED" || isRateLimitedText(entry2 == null ? void 0 : entry2.message);
        }
      );
    },
    computeRetryDelayMs: ({ response: res, json: payload, attempt, minIntervalMs: floorMs }) => {
      var _a2, _b;
      const retryHeader = res.headers.get("retry-after");
      if (retryHeader !== null && retryHeader !== void 0 && String(retryHeader).trim() !== "") {
        return Math.max(floorMs, parseRetryAfterMs(retryHeader, attempt));
      }
      if ((_b = (_a2 = payload == null ? void 0 : payload.extensions) == null ? void 0 : _a2.cost) == null ? void 0 : _b.throttleStatus) {
        return Math.max(floorMs, parseGraphqlThrottleDelayMs(payload, 1e3));
      }
      return Math.max(floorMs, parseRetryAfterMs(null, attempt));
    },
    computeNextDelayMs: ({ response: res, json: payload, attempt, minIntervalMs: floorMs }) => {
      if (res.status === 429) {
        return Math.max(floorMs, parseRetryAfterMs(res.headers.get("retry-after"), attempt));
      }
      return parseGraphqlThrottleDelayMs(payload, floorMs);
    }
  });
  if (!response.ok) {
    const error = new Error(
      (json == null ? void 0 : json.errors) ? `Shopify GraphQL error: ${JSON.stringify(json.errors)}` : `Shopify GraphQL request failed with status ${response.status}.`
    );
    error.status = response.status;
    error.details = json || text2;
    throw error;
  }
  if (Array.isArray(json == null ? void 0 : json.errors) && json.errors.length) {
    const error = new Error(`Shopify GraphQL error: ${json.errors.map((entry2) => entry2.message).join(", ")}`);
    error.details = json.errors;
    throw error;
  }
  return (json == null ? void 0 : json.data) || {};
}
function toProductGid(productId) {
  return `gid://shopify/Product/${String(productId)}`;
}
function fromProductGid(gid) {
  return String(gid || "").split("/").pop() || "";
}
function mapGraphqlProductNode(node) {
  var _a2, _b;
  if (!(node == null ? void 0 : node.id)) return null;
  const tags = Array.isArray(node.tags) ? node.tags.join(", ") : String(node.tags || "");
  return {
    id: fromProductGid(node.id),
    title: String(node.title || ""),
    handle: String(node.handle || ""),
    body_html: String(node.descriptionHtml || ""),
    product_type: String(node.productType || ""),
    tags,
    status: String(node.status || "").toLowerCase(),
    updated_at: node.updatedAt || null,
    metafields_global_title_tag: String(((_a2 = node.seo) == null ? void 0 : _a2.title) || ""),
    metafields_global_description_tag: String(((_b = node.seo) == null ? void 0 : _b.description) || "")
  };
}
async function fetchProducts({
  storeDomain,
  token,
  apiVersion,
  limit = 20,
  pageInfo = "",
  query = "",
  includeDescription = true
}) {
  var _a2, _b;
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  if (pageInfo) {
    params.set("page_info", pageInfo);
  } else {
    const fields = [
      "id",
      "title",
      "handle",
      ...includeDescription ? ["body_html"] : [],
      "product_type",
      "tags",
      "status",
      "updated_at",
      "metafields_global_title_tag",
      "metafields_global_description_tag"
    ];
    params.set("fields", fields.join(","));
  }
  if (query && !pageInfo) {
    params.set("title", query);
  }
  const { data: data2, pagination } = await shopifyRestRequest({
    storeDomain,
    token,
    apiVersion,
    path: `/products.json?${params.toString()}`
  });
  const products = Array.isArray(data2.products) ? data2.products : [];
  if (!products.length) {
    return {
      products,
      pagination
    };
  }
  const ids = products.map((product) => toProductGid(product.id));
  const seoById = /* @__PURE__ */ new Map();
  const BATCH_SIZE = 100;
  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    const batchIds = ids.slice(i, i + BATCH_SIZE);
    const seoData = await shopifyGraphqlRequest({
      storeDomain,
      token,
      apiVersion,
      query: `
        query ProductSeoNodes($ids: [ID!]!) {
          nodes(ids: $ids) {
            ... on Product {
              id
              seo {
                title
                description
              }
            }
          }
        }
      `,
      variables: { ids: batchIds }
    });
    for (const node of (seoData == null ? void 0 : seoData.nodes) || []) {
      const id = fromProductGid(node == null ? void 0 : node.id);
      if (!id) continue;
      seoById.set(id, {
        title: (_a2 = node == null ? void 0 : node.seo) == null ? void 0 : _a2.title,
        description: (_b = node == null ? void 0 : node.seo) == null ? void 0 : _b.description
      });
    }
  }
  const mergedProducts = products.map((product) => {
    const seo = seoById.get(String(product.id));
    return {
      ...product,
      metafields_global_title_tag: (seo == null ? void 0 : seo.title) ?? product.metafields_global_title_tag ?? "",
      metafields_global_description_tag: (seo == null ? void 0 : seo.description) ?? product.metafields_global_description_tag ?? ""
    };
  });
  return {
    products: mergedProducts,
    pagination
  };
}
async function fetchAllProducts({
  storeDomain,
  token,
  apiVersion,
  maxProducts = 1e4
}) {
  var _a2, _b;
  const allProducts = [];
  let cursor = null;
  let hasNextPage = false;
  do {
    const remaining = maxProducts - allProducts.length;
    const batchSize = Math.max(1, Math.min(250, remaining));
    const data2 = await shopifyGraphqlRequest({
      storeDomain,
      token,
      apiVersion,
      query: `
        query CatalogProductsPage($first: Int!, $after: String) {
          products(first: $first, after: $after) {
            pageInfo {
              hasNextPage
              endCursor
            }
            nodes {
              id
              title
              handle
              status
              updatedAt
              productType
              tags
              seo {
                title
                description
              }
            }
          }
        }
      `,
      variables: { first: batchSize, after: cursor }
    });
    const connection = data2 == null ? void 0 : data2.products;
    const nodes = Array.isArray(connection == null ? void 0 : connection.nodes) ? connection.nodes : [];
    for (const node of nodes) {
      const mapped = mapGraphqlProductNode(node);
      if (mapped) allProducts.push(mapped);
    }
    hasNextPage = Boolean((_a2 = connection == null ? void 0 : connection.pageInfo) == null ? void 0 : _a2.hasNextPage);
    cursor = ((_b = connection == null ? void 0 : connection.pageInfo) == null ? void 0 : _b.endCursor) || null;
  } while (hasNextPage && cursor && allProducts.length < maxProducts);
  return {
    products: allProducts.slice(0, maxProducts),
    truncated: hasNextPage
  };
}
async function fetchProductsByIds({
  storeDomain,
  token,
  apiVersion,
  productIds = []
}) {
  const gids = Array.from(
    new Set(
      (Array.isArray(productIds) ? productIds : []).map((id) => fromProductGid(id)).filter(Boolean).map((id) => toProductGid(id))
    )
  );
  if (!gids.length) return [];
  const rows = [];
  const BATCH_SIZE = 100;
  for (let i = 0; i < gids.length; i += BATCH_SIZE) {
    const data2 = await shopifyGraphqlRequest({
      storeDomain,
      token,
      apiVersion,
      query: `
        query ProductsByIds($ids: [ID!]!) {
          nodes(ids: $ids) {
            ... on Product {
              id
              title
              handle
              descriptionHtml
              status
              updatedAt
              productType
              tags
              seo {
                title
                description
              }
            }
          }
        }
      `,
      variables: { ids: gids.slice(i, i + BATCH_SIZE) }
    });
    for (const node of (data2 == null ? void 0 : data2.nodes) || []) {
      const mapped = mapGraphqlProductNode(node);
      if (mapped) rows.push(mapped);
    }
  }
  return rows;
}
const SINGLE_PRODUCT_GRAPHQL_FIELDS = `
  id
  title
  handle
  descriptionHtml
  productType
  tags
  status
  seo {
    title
    description
  }
  images(first: 20) {
    nodes {
      id
      url
      altText
    }
  }
`;
function mapSingleGraphqlProduct(product) {
  var _a2, _b, _c;
  if (!product) return null;
  const imageNodes = Array.isArray((_a2 = product.images) == null ? void 0 : _a2.nodes) ? product.images.nodes : [];
  return {
    id: fromProductGid(product.id),
    title: String(product.title || ""),
    handle: String(product.handle || ""),
    body_html: String(product.descriptionHtml || ""),
    product_type: String(product.productType || ""),
    tags: Array.isArray(product.tags) ? product.tags.join(", ") : String(product.tags || ""),
    metafields_global_title_tag: String(((_b = product.seo) == null ? void 0 : _b.title) || ""),
    metafields_global_description_tag: String(((_c = product.seo) == null ? void 0 : _c.description) || ""),
    images: imageNodes.map((image, index2) => ({
      id: fromProductGid(image.id),
      src: String(image.url || ""),
      alt: String(image.altText || ""),
      position: index2 + 1
    }))
  };
}
async function fetchProductById({
  storeDomain,
  token,
  apiVersion,
  productId
}) {
  const cleanId = fromProductGid(productId);
  if (!cleanId) return null;
  const data2 = await shopifyGraphqlRequest({
    storeDomain,
    token,
    apiVersion,
    query: `
      query SingleProductFull($id: ID!) {
        product(id: $id) {
          ${SINGLE_PRODUCT_GRAPHQL_FIELDS}
        }
      }
    `,
    variables: { id: toProductGid(cleanId) }
  });
  return mapSingleGraphqlProduct(data2 == null ? void 0 : data2.product);
}
async function fetchProductByHandle({
  storeDomain,
  token,
  apiVersion,
  handle
}) {
  const cleanHandle = String(handle || "").trim().toLowerCase();
  if (!cleanHandle) return null;
  const data2 = await shopifyGraphqlRequest({
    storeDomain,
    token,
    apiVersion,
    query: `
      query SingleProductByHandle($handle: String!) {
        productByHandle(handle: $handle) {
          ${SINGLE_PRODUCT_GRAPHQL_FIELDS}
        }
      }
    `,
    variables: { handle: cleanHandle }
  });
  return mapSingleGraphqlProduct(data2 == null ? void 0 : data2.productByHandle);
}
async function fetchProductImages({
  storeDomain,
  token,
  apiVersion,
  limit = 50,
  pageInfo = "",
  query = ""
}) {
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  if (pageInfo) {
    params.set("page_info", pageInfo);
  } else {
    params.set("fields", ["id", "title", "handle", "images"].join(","));
  }
  if (query && !pageInfo) {
    params.set("title", query);
  }
  const { data: data2, pagination } = await shopifyRestRequest({
    storeDomain,
    token,
    apiVersion,
    path: `/products.json?${params.toString()}`
  });
  const products = Array.isArray(data2.products) ? data2.products : [];
  const rows = products.flatMap((product) => {
    const productImages = Array.isArray(product.images) ? product.images : [];
    return productImages.map((image, index2) => ({
      id: String(image.id || ""),
      productId: String(product.id || ""),
      productTitle: String(product.title || ""),
      productHandle: String(product.handle || ""),
      position: Number(image.position || index2 + 1),
      altText: String(image.alt || ""),
      imageUrl: String(image.src || ""),
      width: Number(image.width || 0),
      height: Number(image.height || 0)
    }));
  });
  return {
    rows,
    pagination
  };
}
function prefersProductUpdateInput(apiVersion) {
  const match = String(apiVersion || "2025-10").match(/^(\d{4})-(\d{2})$/);
  if (!match) return true;
  const numeric = Number(`${match[1]}${match[2]}`);
  return numeric >= 202410;
}
async function runProductUpdateMutation({ storeDomain, token, apiVersion, input: input2, useNewSchema }) {
  const query = useNewSchema ? `
      mutation UpdateProductSeo($product: ProductUpdateInput!) {
        productUpdate(product: $product) {
          product {
            id
            title
            handle
            descriptionHtml
            seo {
              title
              description
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    ` : `
      mutation UpdateProductSeoLegacy($input: ProductInput!) {
        productUpdate(input: $input) {
          product {
            id
            title
            handle
            descriptionHtml
            seo {
              title
              description
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `;
  return shopifyGraphqlRequest({
    storeDomain,
    token,
    apiVersion,
    query,
    variables: useNewSchema ? { product: input2 } : { input: input2 }
  });
}
async function updateProductSeo({
  storeDomain,
  token,
  apiVersion,
  productId,
  payload
}) {
  var _a2, _b;
  const input2 = {
    id: toProductGid(productId),
    title: payload.title,
    handle: payload.handle,
    seo: {
      title: payload.metaTitle,
      description: payload.metaDescription
    }
  };
  if (typeof payload.descriptionHtml === "string") {
    input2.descriptionHtml = payload.descriptionHtml;
  }
  const useNewFirst = prefersProductUpdateInput(apiVersion);
  let data2;
  try {
    data2 = await runProductUpdateMutation({
      storeDomain,
      token,
      apiVersion,
      input: input2,
      useNewSchema: useNewFirst
    });
  } catch (error) {
    const msg = String((error == null ? void 0 : error.message) || "");
    const shouldTryAlternate = msg.includes("ProductUpdateInput") || msg.includes("ProductInput") || msg.includes("Unknown argument") || msg.includes("Field 'product' doesn't exist");
    if (!shouldTryAlternate) throw error;
    data2 = await runProductUpdateMutation({
      storeDomain,
      token,
      apiVersion,
      input: input2,
      useNewSchema: !useNewFirst
    });
  }
  const userErrors = ((_a2 = data2 == null ? void 0 : data2.productUpdate) == null ? void 0 : _a2.userErrors) || [];
  if (userErrors.length) {
    throw new Error(userErrors.map((entry2) => entry2.message).join(", "));
  }
  return ((_b = data2 == null ? void 0 : data2.productUpdate) == null ? void 0 : _b.product) || null;
}
async function updateProductImageAlt({
  storeDomain,
  token,
  apiVersion,
  productId,
  imageId,
  altText
}) {
  const { data: data2 } = await shopifyRestRequest({
    storeDomain,
    token,
    apiVersion,
    path: `/products/${String(productId)}/images/${String(imageId)}.json`,
    method: "PUT",
    body: {
      image: {
        id: Number(imageId),
        alt: String(altText || "").trim()
      }
    }
  });
  return (data2 == null ? void 0 : data2.image) || null;
}
async function createUrlRedirect({
  storeDomain,
  token,
  apiVersion,
  path,
  target
}) {
  var _a2, _b;
  const cleanPath = String(path || "").trim();
  const cleanTarget = String(target || "").trim();
  if (!cleanPath || !cleanTarget || cleanPath === cleanTarget) {
    return null;
  }
  try {
    const data2 = await shopifyGraphqlRequest({
      storeDomain,
      token,
      apiVersion,
      query: `
        mutation CreateUrlRedirect($urlRedirect: UrlRedirectInput!) {
          urlRedirectCreate(urlRedirect: $urlRedirect) {
            urlRedirect {
              id
              path
              target
            }
            userErrors {
              field
              message
            }
          }
        }
      `,
      variables: {
        urlRedirect: {
          path: cleanPath.startsWith("/") ? cleanPath : `/${cleanPath}`,
          target: cleanTarget.startsWith("/") ? cleanTarget : `/${cleanTarget}`
        }
      }
    });
    const userErrors = ((_a2 = data2 == null ? void 0 : data2.urlRedirectCreate) == null ? void 0 : _a2.userErrors) || [];
    if (userErrors.length) {
      const isHarmless = userErrors.some(
        (e) => {
          var _a3, _b2;
          return ((_a3 = e.message) == null ? void 0 : _a3.toLowerCase().includes("taken")) || ((_b2 = e.message) == null ? void 0 : _b2.toLowerCase().includes("already exists"));
        }
      );
      if (!isHarmless) {
        console.warn(`URL redirect warning for ${cleanPath} -> ${cleanTarget}:`, userErrors);
      }
    }
    return ((_b = data2 == null ? void 0 : data2.urlRedirectCreate) == null ? void 0 : _b.urlRedirect) || null;
  } catch (error) {
    console.warn(`Failed to create 301 redirect for ${cleanPath}:`, error == null ? void 0 : error.message);
    return null;
  }
}
async function persistAuditResult({ shop, audit }) {
  var _a2, _b, _c, _d;
  const next = await updateAppState(shop, (current) => {
    const trend = buildTrendSummary(current.scoreHistory, audit.summary.score);
    const scoreHistory = [
      ...current.scoreHistory,
      { date: audit.generatedAt, score: audit.summary.score }
    ].slice(-20);
    return {
      ...current,
      lastScan: {
        ...audit,
        trend
      },
      scoreHistory
    };
  });
  if (shop) {
    try {
      const pillars = ((_a2 = audit.summary) == null ? void 0 : _a2.pillars) || {};
      const counts = ((_b = audit.summary) == null ? void 0 : _b.counts) || {};
      await prisma.seoAuditSnapshot.create({
        data: {
          shop: String(shop).trim().toLowerCase(),
          overallScore: Number(((_c = audit.summary) == null ? void 0 : _c.score) ?? 0),
          serpScore: Number(pillars.serpScore ?? 0),
          contentScore: Number(pillars.contentScore ?? 0),
          technicalScore: Number(pillars.technicalScore ?? 0),
          visualScore: Number(pillars.visualScore ?? 0),
          cannibalScore: Number(pillars.cannibalScore ?? 100),
          criticalCount: Number(counts.critical ?? 0),
          warningCount: Number(counts.warning ?? 0),
          infoCount: Number(counts.info ?? 0),
          summaryJson: JSON.stringify({
            pagesScanned: audit.pagesScanned,
            indexCoverage: audit.indexCoverage,
            health: (_d = audit.summary) == null ? void 0 : _d.health,
            pillars
          })
        }
      });
    } catch (snapshotErr) {
      console.warn("Could not persist SeoAuditSnapshot:", snapshotErr == null ? void 0 : snapshotErr.message);
    }
  }
  return next.lastScan;
}
async function runFullScan({ storeDomain, token, apiVersion, shop }) {
  const appState = await getAppState(shop);
  const { products, truncated } = await fetchAllProducts({
    storeDomain,
    token,
    apiVersion,
    maxProducts: 1e4
  });
  const audit = buildSeoAudit({
    storeDomain,
    products,
    appState
  });
  if (truncated) {
    audit.truncated = true;
  }
  return persistAuditResult({ shop, audit });
}
async function applyIncrementalAuditPatch({
  shop,
  storeDomain,
  token,
  apiVersion,
  updatedProducts = []
}) {
  const appState = await getAppState(shop);
  const patched = patchCachedSeoAudit({
    existingScan: appState.lastScan,
    storeDomain,
    updatedProducts,
    appState
  });
  if (!patched) {
    if (!storeDomain || !token) return null;
    return runFullScan({ storeDomain, token, apiVersion, shop });
  }
  return persistAuditResult({ shop, audit: patched });
}
function generateSitemapUrls({ storeDomain, products, manualUrls = [] }) {
  const base = `https://${storeDomain}`;
  const productUrls = products.map((product) => `${base}/products/${product.handle}`);
  const staticUrls = [base, `${base}/collections/all`, `${base}/pages/contact`];
  const unique = /* @__PURE__ */ new Set([
    ...staticUrls,
    ...productUrls,
    ...manualUrls.map((url) => String(url || "").trim()).filter(Boolean)
  ]);
  return Array.from(unique);
}
const PLATFORM_FEATURES = Object.freeze([
  { key: "seo_audit", label: "SEO Audit & Copilot", path: "/app/seo-audit" },
  { key: "products", label: "Product SEO & Diff Doctor", path: "/app/products" },
  { key: "bulk_meta", label: "Bulk Meta Editor", path: "/app/bulk-meta" },
  { key: "image_optimizer", label: "Image Optimizer & Vision ALT", path: "/app/image-optimizer" },
  { key: "url_optimization", label: "URL Optimization & Redirects", path: "/app/url-optimization" },
  { key: "revisions", label: "Time Machine & Rollback", path: "/app/revisions" },
  { key: "robots", label: "Robots.txt Manager", path: "/app/robots" },
  { key: "sitemap", label: "Sitemap Manager", path: "/app/sitemap" },
  { key: "pagespeed", label: "PageSpeed & Core Web Vitals", path: "/app/pagespeed" },
  { key: "ai_features", label: "Global Gemini AI Actions", path: "/app/api/ai" }
]);
const ALL_FEATURE_KEYS = PLATFORM_FEATURES.map((f) => f.key);
function parseFeaturesJson(raw) {
  if (!raw) return [...ALL_FEATURE_KEYS];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [...ALL_FEATURE_KEYS];
    return parsed.filter((key) => ALL_FEATURE_KEYS.includes(key));
  } catch {
    return [...ALL_FEATURE_KEYS];
  }
}
function maskToken(token) {
  const clean = String(token || "").trim();
  if (!clean) return "";
  if (clean.length <= 10) return "*".repeat(clean.length);
  return `${clean.slice(0, 6)}...${clean.slice(-4)}`;
}
function normalizeControl(record) {
  if (!record) return null;
  const level = ["FULL", "PARTIAL", "SUSPENDED"].includes(record.accessLevel) ? record.accessLevel : "FULL";
  return {
    shop: record.shop,
    accessLevel: level,
    superAccess: Boolean(record.superAccess),
    allowedFeatures: parseFeaturesJson(record.allowedFeaturesJson),
    notes: record.notes || "",
    updatedBy: record.updatedBy || "",
    updatedAt: record.updatedAt,
    createdAt: record.createdAt
  };
}
async function getOrCreateStoreControl(shop) {
  const cleanShop = String(shop || "").trim().toLowerCase();
  if (!cleanShop) return null;
  let record = await prisma.storeControl.findUnique({ where: { shop: cleanShop } });
  if (!record) {
    record = await prisma.storeControl.create({
      data: {
        shop: cleanShop,
        accessLevel: "FULL",
        superAccess: false,
        allowedFeaturesJson: JSON.stringify(ALL_FEATURE_KEYS)
      }
    });
  }
  return normalizeControl(record);
}
function isFeatureAllowed(control, featureKey) {
  if (!control) return true;
  if (control.accessLevel === "SUSPENDED") return false;
  if (control.accessLevel === "FULL") return true;
  return Array.isArray(control.allowedFeatures) && control.allowedFeatures.includes(featureKey);
}
async function checkStoreRouteAccess(shop, featureKey) {
  if (!shop) return { allowed: true, control: null };
  const control = await getOrCreateStoreControl(shop);
  const allowed = isFeatureAllowed(control, featureKey);
  return {
    allowed,
    control,
    reason: (control == null ? void 0 : control.accessLevel) === "SUSPENDED" ? "This store's access to Ecom SEO has been suspended by the administrator." : `Access to this module (${featureKey}) is not enabled for your store's current partial access plan.`
  };
}
async function updateStoreControl({
  shop,
  accessLevel = "FULL",
  superAccess = false,
  allowedFeatures = ALL_FEATURE_KEYS,
  notes = "",
  updatedBy = ""
}) {
  const cleanShop = String(shop || "").trim().toLowerCase();
  if (!cleanShop) throw new Error("Shop domain is required.");
  const validLevel = ["FULL", "PARTIAL", "SUSPENDED"].includes(String(accessLevel).toUpperCase()) ? String(accessLevel).toUpperCase() : "FULL";
  const sanitizedFeatures = Array.isArray(allowedFeatures) ? allowedFeatures.filter((k) => ALL_FEATURE_KEYS.includes(k)) : ALL_FEATURE_KEYS;
  const updated = await prisma.storeControl.upsert({
    where: { shop: cleanShop },
    update: {
      accessLevel: validLevel,
      superAccess: Boolean(superAccess),
      allowedFeaturesJson: JSON.stringify(sanitizedFeatures),
      notes: notes ? String(notes).slice(0, 500) : null,
      updatedBy: updatedBy || null
    },
    create: {
      shop: cleanShop,
      accessLevel: validLevel,
      superAccess: Boolean(superAccess),
      allowedFeaturesJson: JSON.stringify(sanitizedFeatures),
      notes: notes ? String(notes).slice(0, 500) : null,
      updatedBy: updatedBy || null
    }
  });
  if (superAccess) {
    await syncPlanSubscription(cleanShop, true).catch(() => {
    });
  }
  return normalizeControl(updated);
}
async function updateStoreTokens({
  shop,
  creditPlan,
  totalCredits,
  bonusCredits,
  resetUsedCredits = false,
  shopifyAccessToken = "",
  shopifyScopes = ""
}) {
  const cleanShop = String(shop || "").trim().toLowerCase();
  if (!cleanShop) throw new Error("Shop domain is required.");
  await getOrCreateCreditAccount(cleanShop);
  const creditUpdateData = {};
  if (creditPlan === "FREE" || creditPlan === "PRO") {
    creditUpdateData.plan = creditPlan;
  }
  if (totalCredits !== void 0 && totalCredits !== "" && !Number.isNaN(Number(totalCredits))) {
    creditUpdateData.totalCredits = Math.max(0, Math.floor(Number(totalCredits)));
  }
  if (bonusCredits !== void 0 && bonusCredits !== "" && !Number.isNaN(Number(bonusCredits))) {
    creditUpdateData.bonusCredits = Math.max(0, Math.floor(Number(bonusCredits)));
  }
  if (resetUsedCredits) {
    creditUpdateData.usedCredits = 0;
  }
  if (Object.keys(creditUpdateData).length > 0) {
    await prisma.aiCreditAccount.update({
      where: { shop: cleanShop },
      data: creditUpdateData
    });
  }
  const cleanToken = String(shopifyAccessToken || "").trim();
  const cleanScopes = String(shopifyScopes || "").trim();
  if (cleanToken) {
    const existingOffline = await prisma.session.findFirst({
      where: { shop: cleanShop, isOnline: false }
    });
    const targetId = (existingOffline == null ? void 0 : existingOffline.id) || `offline_${cleanShop}`;
    await prisma.session.upsert({
      where: { id: targetId },
      update: {
        shop: cleanShop,
        accessToken: cleanToken,
        isOnline: false,
        ...cleanScopes ? { scope: cleanScopes } : {}
      },
      create: {
        id: targetId,
        shop: cleanShop,
        state: "admin-provisioned",
        isOnline: false,
        accessToken: cleanToken,
        scope: cleanScopes || process.env.SCOPES || "write_products"
      }
    });
  } else if (cleanScopes) {
    const updated = await prisma.session.updateMany({
      where: { shop: cleanShop, isOnline: false },
      data: { scope: cleanScopes }
    });
    if (updated.count === 0) {
      throw new Error(
        `No offline Shopify session exists yet for "${cleanShop}". Paste an Admin Access Token (shpat_...) when saving scopes for an unconnected store.`
      );
    }
  }
  return getOrCreateCreditAccount(cleanShop);
}
async function listAllManagedStores() {
  const [sessions, appStates, creditAccounts, storeControls, revisionCounts, aiLogCounts, latestSnapshots] = await Promise.all([
    prisma.session.findMany({
      orderBy: { isOnline: "asc" },
      select: { shop: true, isOnline: true, scope: true, accessToken: true }
    }),
    // Fetch only shop keys instead of parsing multi-MB stateJson blobs across every store.
    prisma.appState.findMany({ select: { shop: true } }),
    prisma.aiCreditAccount.findMany(),
    prisma.storeControl.findMany(),
    prisma.productRevision.groupBy({ by: ["shop"], _count: { id: true } }),
    prisma.aiCreditUsageLog.groupBy({
      by: ["shop"],
      where: { actionType: { not: "credit_pack_purchase" } },
      _count: { id: true }
    }),
    prisma.seoAuditSnapshot.findMany({
      orderBy: { createdAt: "desc" },
      distinct: ["shop"],
      select: { shop: true, overallScore: true, summaryJson: true, createdAt: true }
    })
  ]);
  const shopSet = /* @__PURE__ */ new Set();
  for (const s of sessions) if (s.shop) shopSet.add(s.shop.toLowerCase());
  for (const a of appStates) if (a.shop) shopSet.add(a.shop.toLowerCase());
  for (const c of creditAccounts) if (c.shop) shopSet.add(c.shop.toLowerCase());
  for (const sc of storeControls) if (sc.shop) shopSet.add(sc.shop.toLowerCase());
  const sessionMap = /* @__PURE__ */ new Map();
  for (const s of sessions) {
    const key = s.shop.toLowerCase();
    if (!sessionMap.has(key) || !s.isOnline) {
      sessionMap.set(key, s);
    }
  }
  const snapshotMap = /* @__PURE__ */ new Map();
  for (const snap of latestSnapshots) {
    const key = snap.shop.toLowerCase();
    if (!snapshotMap.has(key)) snapshotMap.set(key, snap);
  }
  const creditMap = new Map(creditAccounts.map((c) => [c.shop.toLowerCase(), c]));
  const controlMap = new Map(storeControls.map((sc) => [sc.shop.toLowerCase(), normalizeControl(sc)]));
  const revCountMap = /* @__PURE__ */ new Map();
  for (const r of revisionCounts) {
    const key = r.shop.toLowerCase();
    revCountMap.set(key, (revCountMap.get(key) || 0) + r._count.id);
  }
  const aiCountMap = /* @__PURE__ */ new Map();
  for (const l of aiLogCounts) {
    const key = l.shop.toLowerCase();
    aiCountMap.set(key, (aiCountMap.get(key) || 0) + l._count.id);
  }
  const rows = [];
  for (const shop of Array.from(shopSet).sort()) {
    const sess = sessionMap.get(shop) || null;
    const snap = snapshotMap.get(shop) || null;
    const credit = creditMap.get(shop) || null;
    const control = controlMap.get(shop) || {
      shop,
      accessLevel: "FULL",
      superAccess: false,
      allowedFeatures: [...ALL_FEATURE_KEYS],
      notes: "",
      updatedBy: "",
      updatedAt: null
    };
    let lastScan = null;
    if (snap) {
      let parsedSummary = {};
      try {
        parsedSummary = snap.summaryJson ? JSON.parse(snap.summaryJson) : {};
      } catch {
        parsedSummary = {};
      }
      lastScan = {
        score: snap.overallScore ?? null,
        health: parsedSummary.health || "unknown",
        pagesScanned: parsedSummary.pagesScanned || 0,
        lastScanDate: snap.createdAt ? snap.createdAt.toISOString() : null
      };
    }
    const totalCredits = (credit == null ? void 0 : credit.totalCredits) ?? PLAN_ALLOWANCES.FREE;
    const bonusCredits = (credit == null ? void 0 : credit.bonusCredits) ?? 0;
    const usedCredits = (credit == null ? void 0 : credit.usedCredits) ?? 0;
    const effectiveTotal = totalCredits + bonusCredits;
    rows.push({
      shop,
      sessionStatus: {
        connected: Boolean(sess == null ? void 0 : sess.accessToken),
        isOnlineOnly: Boolean(sess && sess.isOnline),
        scopes: (sess == null ? void 0 : sess.scope) || "",
        maskedToken: maskToken((sess == null ? void 0 : sess.accessToken) || "")
      },
      control,
      credits: {
        plan: (credit == null ? void 0 : credit.plan) || "FREE",
        totalCredits,
        bonusCredits,
        usedCredits,
        effectiveTotal,
        availableCredits: Math.max(0, effectiveTotal - usedCredits),
        cycleResetAt: (credit == null ? void 0 : credit.cycleResetAt) || null
      },
      lastScan,
      stats: {
        totalRevisions: revCountMap.get(shop) || 0,
        totalAiCalls: aiCountMap.get(shop) || 0
      }
    });
  }
  return rows;
}
async function getPlatformAiConfig() {
  let config = await prisma.platformAiConfig.findUnique({ where: { id: "default" } });
  if (!config) {
    config = await prisma.platformAiConfig.create({
      data: {
        id: "default",
        provider: "gemini",
        model: DEFAULT_GEMINI_MODEL,
        apiKey: "",
        temperature: 0.4,
        isEnabled: true
      }
    });
  }
  return config;
}
async function getEffectivePlatformAiSettings() {
  var _a2;
  const dbConfig = await getPlatformAiConfig();
  const envKey = typeof process !== "undefined" && ((_a2 = process.env) == null ? void 0 : _a2.GEMINI_API_KEY) ? String(process.env.GEMINI_API_KEY).trim() : "";
  const dbKey = String(dbConfig.apiKey || "").trim();
  return {
    provider: dbConfig.provider || "gemini",
    model: dbConfig.model || DEFAULT_GEMINI_MODEL,
    apiKey: dbKey || envKey,
    temperature: typeof dbConfig.temperature === "number" ? dbConfig.temperature : 0.4,
    isEnabled: Boolean(dbConfig.isEnabled),
    hasDbKey: Boolean(dbKey),
    dbKeyMask: maskToken(dbKey),
    usingEnvFallback: !dbKey && Boolean(envKey),
    updatedBy: dbConfig.updatedBy || "",
    updatedAt: dbConfig.updatedAt
  };
}
async function updatePlatformAiConfig({
  provider = "gemini",
  model = DEFAULT_GEMINI_MODEL,
  apiKey = "",
  clearApiKey = false,
  temperature = 0.4,
  isEnabled = true,
  updatedBy = ""
}) {
  const current = await getPlatformAiConfig();
  const cleanKey = String(apiKey || "").trim();
  const nextKey = clearApiKey ? "" : cleanKey || current.apiKey;
  const cleanModel = String(model || DEFAULT_GEMINI_MODEL).trim() || DEFAULT_GEMINI_MODEL;
  const parsedTemp = Math.max(0, Math.min(1, Number(temperature ?? 0.4) || 0.4));
  return prisma.platformAiConfig.upsert({
    where: { id: "default" },
    update: {
      provider: provider === "gemini" ? "gemini" : "gemini",
      model: cleanModel,
      apiKey: nextKey,
      temperature: parsedTemp,
      isEnabled: Boolean(isEnabled),
      updatedBy: updatedBy || null
    },
    create: {
      id: "default",
      provider: "gemini",
      model: cleanModel,
      apiKey: nextKey,
      temperature: parsedTemp,
      isEnabled: Boolean(isEnabled),
      updatedBy: updatedBy || null
    }
  });
}
async function getEffectiveGscOAuthConfig() {
  var _a2, _b, _c, _d;
  const dbRecord = await prisma.platformAiConfig.findUnique({ where: { id: "gsc_oauth" } }).catch(() => null);
  const envClientId = typeof process !== "undefined" && (((_a2 = process.env) == null ? void 0 : _a2.GOOGLE_GSC_CLIENT_ID) || ((_b = process.env) == null ? void 0 : _b.GOOGLE_CLIENT_ID) || "").trim() || "";
  const envClientSecret = typeof process !== "undefined" && (((_c = process.env) == null ? void 0 : _c.GOOGLE_GSC_CLIENT_SECRET) || ((_d = process.env) == null ? void 0 : _d.GOOGLE_CLIENT_SECRET) || "").trim() || "";
  const dbClientId = String((dbRecord == null ? void 0 : dbRecord.model) || "").trim();
  const dbClientSecret = String((dbRecord == null ? void 0 : dbRecord.apiKey) || "").trim();
  return {
    clientId: dbClientId || envClientId,
    clientSecret: dbClientSecret || envClientSecret,
    hasDbConfig: Boolean(dbClientId && dbClientSecret),
    usingEnvFallback: (!dbClientId || !dbClientSecret) && Boolean(envClientId && envClientSecret),
    maskedSecret: maskToken(dbClientSecret),
    isEnabled: dbRecord ? Boolean(dbRecord.isEnabled) : true,
    updatedBy: (dbRecord == null ? void 0 : dbRecord.updatedBy) || "",
    updatedAt: (dbRecord == null ? void 0 : dbRecord.updatedAt) || null
  };
}
async function updatePlatformGscOAuthConfig({
  clientId = "",
  clientSecret = "",
  clearConfig = false,
  updatedBy = ""
}) {
  const current = await prisma.platformAiConfig.findUnique({ where: { id: "gsc_oauth" } }).catch(() => null);
  const nextClientId = clearConfig ? "" : String(clientId || "").trim() || (current == null ? void 0 : current.model) || "";
  const nextSecret = clearConfig ? "" : String(clientSecret || "").trim() || (current == null ? void 0 : current.apiKey) || "";
  return prisma.platformAiConfig.upsert({
    where: { id: "gsc_oauth" },
    update: {
      provider: "google_gsc",
      model: nextClientId,
      apiKey: nextSecret,
      isEnabled: true,
      updatedBy: updatedBy || null
    },
    create: {
      id: "gsc_oauth",
      provider: "google_gsc",
      model: nextClientId,
      apiKey: nextSecret,
      temperature: 0,
      isEnabled: true,
      updatedBy: updatedBy || null
    }
  });
}
async function getEffectivePageSpeedConfig() {
  var _a2;
  const dbRecord = await prisma.platformAiConfig.findUnique({ where: { id: "pagespeed_api" } }).catch(() => null);
  const envKey = typeof process !== "undefined" && (((_a2 = process.env) == null ? void 0 : _a2.GOOGLE_PAGESPEED_API_KEY) || "").trim() || "";
  const dbKey = String((dbRecord == null ? void 0 : dbRecord.apiKey) || "").trim();
  return {
    apiKey: dbKey || envKey,
    hasDbKey: Boolean(dbKey),
    usingEnvFallback: !dbKey && Boolean(envKey),
    maskedKey: maskToken(dbKey),
    updatedBy: (dbRecord == null ? void 0 : dbRecord.updatedBy) || "",
    updatedAt: (dbRecord == null ? void 0 : dbRecord.updatedAt) || null
  };
}
async function updatePlatformPageSpeedConfig({
  apiKey = "",
  clearConfig = false,
  updatedBy = ""
}) {
  const current = await prisma.platformAiConfig.findUnique({ where: { id: "pagespeed_api" } }).catch(() => null);
  const nextKey = clearConfig ? "" : String(apiKey || "").trim() || (current == null ? void 0 : current.apiKey) || "";
  return prisma.platformAiConfig.upsert({
    where: { id: "pagespeed_api" },
    update: {
      provider: "google_pagespeed",
      model: "psi-v5",
      apiKey: nextKey,
      isEnabled: true,
      updatedBy: updatedBy || null
    },
    create: {
      id: "pagespeed_api",
      provider: "google_pagespeed",
      model: "psi-v5",
      apiKey: nextKey,
      temperature: 0,
      isEnabled: true,
      updatedBy: updatedBy || null
    }
  });
}
const IMAGE_HISTORY_LIMIT = 20;
function normalizeImageStatusFilter(value) {
  const clean = String(value || "all").trim().toLowerCase();
  if (clean === "needs-fix" || clean === "healthy") return clean;
  return "all";
}
function toImageHistorySummary(summary = {}) {
  return {
    total: Number(summary.total || 0),
    missing: Number(summary.missing || 0),
    tooLong: Number(summary.tooLong || 0),
    generic: Number(summary.generic || 0),
    tooShort: Number(summary.tooShort || 0),
    ideal: Number(summary.ideal || 0),
    needsFix: Number(summary.needsFix || 0)
  };
}
async function appendImageOptimizerHistory({
  shop,
  action: action2,
  status,
  summary,
  attempted = 0,
  updated = 0,
  note = ""
}) {
  const entry2 = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    action: action2 === "fix" ? "fix" : "check",
    status: status === "failed" ? "failed" : "success",
    summary: toImageHistorySummary(summary),
    attempted: Number(attempted || 0),
    updated: Number(updated || 0),
    note: String(note || "")
  };
  const next = await updateAppState(shop, (current) => ({
    ...current,
    imageOptimizerHistory: [entry2, ...current.imageOptimizerHistory || []].slice(0, IMAGE_HISTORY_LIMIT)
  }));
  const history = Array.isArray(next.imageOptimizerHistory) ? next.imageOptimizerHistory : [];
  return {
    entry: entry2,
    history,
    lastRun: history[0] || null
  };
}
async function ensureScanData({ shop, storeDomain, token, apiVersion }) {
  const appState = await getAppState(shop);
  if (appState.lastScan) {
    return appState.lastScan;
  }
  if (!storeDomain || !token) {
    return null;
  }
  return runFullScan({
    shop,
    storeDomain,
    token,
    apiVersion
  });
}
async function loadProductsPage({
  shop,
  storeDomain,
  token,
  apiVersion,
  limit = 20,
  pageInfo = "",
  query = "",
  includeDescription = true
}) {
  const appState = await getAppState(shop);
  const { products, pagination } = await fetchProducts({
    storeDomain,
    token,
    apiVersion,
    limit,
    pageInfo,
    query,
    includeDescription
  });
  const rows = products.map((product) => {
    var _a2;
    const state = ((_a2 = appState.productSeo) == null ? void 0 : _a2[String(product.id)]) || {};
    return mapShopifyProductToSeoRow(product, state);
  });
  return {
    rows,
    pagination,
    appState
  };
}
async function loadImageOptimizerPage({
  shop,
  storeDomain,
  token,
  apiVersion,
  limit = 25,
  pageInfo = "",
  query = "",
  statusFilter = "all"
}) {
  const { rows, pagination } = await fetchProductImages({
    storeDomain,
    token,
    apiVersion,
    limit,
    pageInfo,
    query
  });
  const normalizedRows = rows.map((row) => {
    const validation = validateImageAlt(row.altText);
    return {
      ...row,
      altText: validation.normalized,
      suggestedAlt: suggestImageAltText({
        productTitle: row.productTitle,
        position: row.position,
        currentAlt: row.altText
      }),
      validation
    };
  });
  const filter = normalizeImageStatusFilter(statusFilter);
  const filteredRows = normalizedRows.filter((row) => {
    if (filter === "all") return true;
    const needsFix = !row.validation.valid || row.validation.generic || row.validation.tooShort;
    return filter === "needs-fix" ? needsFix : !needsFix;
  });
  const pageCheck = validateImageAltRows(filteredRows);
  const appState = shop ? await getAppState(shop) : { imageOptimizerHistory: [] };
  const history = Array.isArray(appState.imageOptimizerHistory) ? appState.imageOptimizerHistory : [];
  return {
    rows: filteredRows,
    pagination,
    summary: pageCheck.summary,
    statusFilter: filter,
    history: history.slice(0, IMAGE_HISTORY_LIMIT),
    lastRun: history[0] || null
  };
}
async function recordProductRevision({
  shop,
  productId,
  productTitle,
  changeType,
  beforeValues = {},
  afterValues = {},
  aiVerdict = null,
  redirectCreated = false
}) {
  if (!shop || !productId) return;
  try {
    await prisma.productRevision.create({
      data: {
        shop,
        productId: String(productId),
        productTitle: productTitle ? String(productTitle).slice(0, 200) : null,
        changeType,
        beforeJson: JSON.stringify(beforeValues),
        afterJson: JSON.stringify(afterValues),
        aiVerdictJson: aiVerdict ? JSON.stringify(aiVerdict) : null,
        redirectCreated: Boolean(redirectCreated)
      }
    });
  } catch (revError) {
    console.warn("Could not save product revision history:", revError == null ? void 0 : revError.message);
  }
}
async function applyValidatedProductSeoUpdate({
  shop,
  storeDomain,
  token,
  apiVersion,
  productId,
  payload,
  normalized,
  changeType
}) {
  var _a2;
  const prevDesc = (_a2 = payload == null ? void 0 : payload.previousValues) == null ? void 0 : _a2.descriptionHtml;
  const hasDescPayload = typeof normalized.descriptionHtml === "string";
  const descriptionChanged = hasDescPayload && (typeof prevDesc !== "string" || normalized.descriptionHtml !== prevDesc);
  const shopifyPayload = {
    title: normalized.title,
    handle: normalized.handle,
    metaTitle: normalized.metaTitle,
    metaDescription: normalized.metaDescription,
    ...descriptionChanged ? { descriptionHtml: normalized.descriptionHtml } : {}
  };
  await updateProductSeo({
    storeDomain,
    token,
    apiVersion,
    productId,
    payload: shopifyPayload
  });
  let redirectCreated = false;
  const originalHandle = String(payload.originalHandle || "").trim();
  if (originalHandle && originalHandle !== normalized.handle) {
    const redirect2 = await createUrlRedirect({
      storeDomain,
      token,
      apiVersion,
      path: `/products/${originalHandle}`,
      target: `/products/${normalized.handle}`
    });
    redirectCreated = Boolean(redirect2);
  }
  const baseBefore = payload.previousValues || { handle: originalHandle };
  const revisionBefore = descriptionChanged ? baseBefore : { ...baseBefore, descriptionHtml: void 0 };
  const revisionAfter = descriptionChanged ? normalized : { ...normalized, descriptionHtml: void 0 };
  await recordProductRevision({
    shop,
    productId,
    productTitle: normalized.title,
    changeType: changeType || payload.changeType || (redirectCreated ? "HANDLE_EDIT" : descriptionChanged ? "CONTENT_EDIT" : "METADATA_EDIT"),
    beforeValues: revisionBefore,
    afterValues: revisionAfter,
    aiVerdict: payload.aiVerdict || null,
    redirectCreated
  });
  await updateAppState(shop, (current) => {
    var _a3;
    return {
      ...current,
      productSeo: {
        ...current.productSeo,
        [String(productId)]: {
          ...((_a3 = current.productSeo) == null ? void 0 : _a3[String(productId)]) || {},
          focusKeyword: normalized.focusKeyword
        }
      }
    };
  });
  return { redirectCreated, descriptionUpdated: descriptionChanged };
}
async function saveProductSeoAndRescan({
  shop,
  storeDomain,
  token,
  apiVersion,
  productId,
  payload
}) {
  const validation = validateProductSeoInput(payload);
  if (!validation.valid) {
    return {
      ok: false,
      errors: validation.errors,
      quality: validation.quality
    };
  }
  const { redirectCreated, descriptionUpdated } = await applyValidatedProductSeoUpdate({
    shop,
    storeDomain,
    token,
    apiVersion,
    productId,
    payload,
    normalized: validation.normalized
  });
  await applyIncrementalAuditPatch({
    shop,
    storeDomain,
    token,
    apiVersion,
    updatedProducts: [
      {
        id: String(productId),
        title: validation.normalized.title,
        handle: validation.normalized.handle,
        metafields_global_title_tag: validation.normalized.metaTitle,
        metafields_global_description_tag: validation.normalized.metaDescription
      }
    ]
  });
  return {
    ok: true,
    productId: String(productId),
    normalized: validation.normalized,
    quality: validation.quality,
    redirectCreated,
    descriptionUpdated
  };
}
function buildAutoFixSeoPayload(product, suggestion) {
  const titleValid = validateProductTitle(product.title).valid;
  const handleCheck = validateUrlHandle(product.handle || "");
  const keywordValid = validateFocusKeyword(product.focusKeyword || "").valid;
  const candidate = {
    title: titleValid ? String(product.title).trim() : suggestion.title,
    focusKeyword: keywordValid ? String(product.focusKeyword).trim() : suggestion.focusKeyword,
    handle: handleCheck.valid ? handleCheck.normalized : suggestion.handle,
    metaTitle: suggestion.metaTitle,
    metaDescription: suggestion.metaDescription
  };
  const checked = validateProductSeoInput(candidate);
  return checked.valid ? checked : validateProductSeoInput(suggestion);
}
async function runAiAutoFixProducts({
  shop,
  storeDomain,
  token,
  apiVersion,
  products = []
}) {
  var _a2, _b, _c, _d;
  const uniqueProducts = [];
  const seenIds = /* @__PURE__ */ new Set();
  for (const item of Array.isArray(products) ? products : []) {
    const id = String((item == null ? void 0 : item.id) || (item == null ? void 0 : item.productId) || "").trim();
    if (!id || seenIds.has(id)) continue;
    seenIds.add(id);
    uniqueProducts.push({
      id,
      title: String((item == null ? void 0 : item.title) || (item == null ? void 0 : item.productTitle) || ""),
      handle: String((item == null ? void 0 : item.handle) || ""),
      focusKeyword: String((item == null ? void 0 : item.focusKeyword) || ""),
      metaTitle: String((item == null ? void 0 : item.metaTitle) || ""),
      metaDescription: String((item == null ? void 0 : item.metaDescription) || "")
    });
    if (uniqueProducts.length >= 5) break;
  }
  if (!uniqueProducts.length) {
    return { ok: false, error: "No valid product items selected for AI auto-fix." };
  }
  const [platformAi, access, appState] = await Promise.all([
    getEffectivePlatformAiSettings(),
    checkStoreRouteAccess(shop, "ai_features"),
    getAppState(shop)
  ]);
  if (!platformAi.isEnabled) {
    return { ok: false, error: "Platform AI features are currently disabled by administrator." };
  }
  if (!platformAi.apiKey) {
    return {
      ok: false,
      error: "Platform Gemini AI credentials are not configured yet. Ask your SuperAdmin to configure them in /superadmin/ai."
    };
  }
  if (!access.allowed) {
    return { ok: false, error: access.reason };
  }
  const hasSuperAccess = Boolean((_a2 = access.control) == null ? void 0 : _a2.superAccess);
  const aiSettings = {
    provider: platformAi.provider,
    model: platformAi.model,
    apiKey: platformAi.apiKey,
    temperature: platformAi.temperature
  };
  const initialBalance = await checkCreditBalance(shop, "product_seo_fix");
  if (!hasSuperAccess && !initialBalance.allowed) {
    return {
      ok: false,
      error: `Insufficient AI tokens. Auto-fix requires ${initialBalance.cost} tokens per product, but you have ${initialBalance.availableCredits} remaining.`
    };
  }
  const missingIds = uniqueProducts.filter((item) => !item.title || !item.handle).map((item) => item.id);
  if (missingIds.length > 0) {
    try {
      const lookedUp = await fetchProductsByIds({
        storeDomain,
        token,
        apiVersion,
        productIds: missingIds
      });
      const byId = new Map((lookedUp || []).map((row) => [String(row.id), row]));
      for (const item of uniqueProducts) {
        const live = byId.get(item.id);
        if (!live) continue;
        if (!item.title) item.title = String(live.title || "");
        if (!item.handle) item.handle = String(live.handle || "");
        if (!item.metaTitle) item.metaTitle = String(live.metafields_global_title_tag || "");
        if (!item.metaDescription) item.metaDescription = String(live.metafields_global_description_tag || "");
        if (!item.descriptionHtml) item.descriptionHtml = String(live.body_html || "");
      }
    } catch {
    }
  }
  const fixedProducts = [];
  const errors = [];
  let creditsDeducted = 0;
  let creditsRemaining = initialBalance.availableCredits;
  let stoppedReason = "";
  for (let index2 = 0; index2 < uniqueProducts.length; index2 += 1) {
    const product = uniqueProducts[index2];
    const focusKeyword = product.focusKeyword || String(((_c = (_b = appState == null ? void 0 : appState.productSeo) == null ? void 0 : _b[product.id]) == null ? void 0 : _c.focusKeyword) || "");
    if (index2 > 0 && !hasSuperAccess) {
      const stepBalance = await checkCreditBalance(shop, "product_seo_fix");
      creditsRemaining = stepBalance.availableCredits;
      if (!stepBalance.allowed) {
        stoppedReason = `Stopped after ${fixedProducts.length} product(s): remaining AI credits (${stepBalance.availableCredits}) are below the ${stepBalance.cost}-credit cost per fix.`;
        break;
      }
    }
    try {
      const suggestion = await generateProductSeoFix({
        settings: aiSettings,
        title: product.title,
        focusKeyword,
        handle: product.handle,
        metaTitle: product.metaTitle,
        metaDescription: product.metaDescription,
        descriptionHtml: product.descriptionHtml || "",
        productType: product.productType || "",
        tags: product.tags || "",
        preserveHandle: validateUrlHandle(product.handle || "").valid
      });
      if (suggestion == null ? void 0 : suggestion.fallbackUsed) {
        errors.push({ productId: product.id, error: "AI returned fallback output; skipped without charging credits." });
        continue;
      }
      const validation = buildAutoFixSeoPayload({ ...product, focusKeyword }, suggestion);
      if (!validation.valid) {
        const firstErr = Object.values(validation.errors || {})[0] || "Generated fields failed validation.";
        errors.push({ productId: product.id, error: firstErr });
        continue;
      }
      const { redirectCreated } = await applyValidatedProductSeoUpdate({
        shop,
        storeDomain,
        token,
        apiVersion,
        productId: product.id,
        payload: {
          originalHandle: product.handle,
          previousValues: {
            title: product.title,
            handle: product.handle,
            focusKeyword,
            metaTitle: product.metaTitle,
            metaDescription: product.metaDescription
          },
          aiVerdict: {
            verdictSummary: suggestion.rationale || "1-Click AI SEO Auto-Fix from SEO Audit.",
            model: aiSettings.model || DEFAULT_GEMINI_MODEL
          }
        },
        normalized: validation.normalized,
        changeType: "AI_AUTO_FIX"
      });
      const deduction = await deductCredits({
        shop,
        actionType: "product_seo_fix",
        productId: product.id,
        productTitle: validation.normalized.title,
        modelUsed: aiSettings.model || DEFAULT_GEMINI_MODEL,
        bypassLimit: hasSuperAccess
      });
      creditsDeducted += deduction.deducted;
      creditsRemaining = deduction.remainingCredits;
      fixedProducts.push({
        productId: product.id,
        title: validation.normalized.title,
        handle: validation.normalized.handle,
        focusKeyword: validation.normalized.focusKeyword,
        metaTitle: validation.normalized.metaTitle,
        metaDescription: validation.normalized.metaDescription,
        rationale: suggestion.rationale,
        redirectCreated
      });
    } catch (error) {
      errors.push({ productId: product.id, error: (error == null ? void 0 : error.message) || "Failed to auto-fix product." });
    }
  }
  let scan = null;
  if (fixedProducts.length > 0) {
    scan = await applyIncrementalAuditPatch({
      shop,
      storeDomain,
      token,
      apiVersion,
      updatedProducts: fixedProducts.map((p) => ({
        id: String(p.productId),
        title: p.title,
        handle: p.handle,
        metafields_global_title_tag: p.metaTitle,
        metafields_global_description_tag: p.metaDescription
      }))
    });
  }
  if (!fixedProducts.length) {
    return {
      ok: false,
      error: ((_d = errors[0]) == null ? void 0 : _d.error) || "Unable to apply AI SEO fixes.",
      errors
    };
  }
  return {
    ok: true,
    fixedCount: fixedProducts.length,
    fixedProducts,
    errors,
    creditsDeducted,
    creditsRemaining,
    superAccess: hasSuperAccess,
    stoppedReason,
    scan
  };
}
function validateBulkMetaRows(rows = []) {
  const statusById = {};
  let hasHardError = false;
  for (const row of rows) {
    const id = String(row.id || "");
    const titleCheck = validateMetaTitle(row.metaTitle || "");
    const descriptionCheck = validateMetaDescription(row.metaDescription || "");
    if (!titleCheck.valid || !descriptionCheck.valid) {
      hasHardError = true;
    }
    statusById[id] = {
      metaTitle: titleCheck,
      metaDescription: descriptionCheck
    };
  }
  return {
    hasHardError,
    statusById
  };
}
function validateImageAltRows(rows = []) {
  const statusById = {};
  const summary = {
    total: rows.length,
    missing: 0,
    tooLong: 0,
    generic: 0,
    tooShort: 0,
    ideal: 0,
    needsFix: 0
  };
  for (const row of rows) {
    const id = String(row.id || "");
    const validation = validateImageAlt(row.altText || "");
    const suggested = suggestImageAltText({
      productTitle: row.productTitle,
      position: row.position,
      currentAlt: row.suggestedAlt || row.altText || ""
    });
    const suggestedCheck = validateImageAlt(suggested);
    const needsFix = !validation.valid || validation.generic || validation.tooShort;
    if (validation.missing) summary.missing += 1;
    if (validation.tooLong) summary.tooLong += 1;
    if (validation.generic) summary.generic += 1;
    if (validation.tooShort) summary.tooShort += 1;
    if (validation.ideal) summary.ideal += 1;
    if (needsFix) summary.needsFix += 1;
    statusById[id] = {
      ...validation,
      needsFix,
      suggestedAlt: suggested,
      suggestedValid: suggestedCheck.valid
    };
  }
  return {
    statusById,
    summary,
    hasIssues: summary.needsFix > 0
  };
}
async function runImageAltCheck({
  shop,
  rows
}) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const check = validateImageAltRows(safeRows);
  const historyState = await appendImageOptimizerHistory({
    shop,
    action: "check",
    status: "success",
    summary: check.summary,
    attempted: safeRows.length,
    updated: 0,
    note: check.summary.needsFix ? `${check.summary.needsFix} image ALT item(s) require fixes.` : "All checked image ALT values look healthy."
  });
  return {
    ok: true,
    statusById: check.statusById,
    summary: check.summary,
    hasIssues: check.hasIssues,
    history: historyState.history,
    lastRun: historyState.lastRun
  };
}
async function saveBulkMetaAndRescan({
  shop,
  storeDomain,
  token,
  apiVersion,
  rows
}) {
  const check = validateBulkMetaRows(rows);
  if (check.hasHardError) {
    return {
      ok: false,
      message: "Fix rows that exceed hard length limits before saving.",
      statusById: check.statusById
    };
  }
  for (const row of rows) {
    const normalizedHandle = validateUrlHandle(row.handle || row.title).normalized;
    const nextMetaTitle = String(row.metaTitle || "").trim();
    const nextMetaDescription = String(row.metaDescription || "").trim();
    await updateProductSeo({
      storeDomain,
      token,
      apiVersion,
      productId: row.id,
      payload: {
        title: row.title,
        handle: normalizedHandle,
        metaTitle: nextMetaTitle,
        metaDescription: nextMetaDescription
      }
    });
    const prev = row.previousValues || {};
    const changed = prev.metaTitle !== nextMetaTitle || prev.metaDescription !== nextMetaDescription;
    if (changed) {
      await recordProductRevision({
        shop,
        productId: row.id,
        productTitle: row.title,
        changeType: "BULK_META_EDIT",
        beforeValues: {
          title: prev.title ?? row.title,
          handle: prev.handle ?? normalizedHandle,
          metaTitle: prev.metaTitle ?? "",
          metaDescription: prev.metaDescription ?? ""
        },
        afterValues: {
          title: row.title,
          handle: normalizedHandle,
          metaTitle: nextMetaTitle,
          metaDescription: nextMetaDescription
        }
      });
    }
  }
  await applyIncrementalAuditPatch({
    shop,
    storeDomain,
    token,
    apiVersion,
    updatedProducts: rows.map((row) => ({
      id: String(row.id),
      title: row.title,
      handle: validateUrlHandle(row.handle || row.title).normalized,
      metafields_global_title_tag: String(row.metaTitle || "").trim(),
      metafields_global_description_tag: String(row.metaDescription || "").trim()
    }))
  });
  return {
    ok: true,
    saved: rows.length,
    statusById: check.statusById
  };
}
async function applyUrlOptimizationsAndRescan({
  shop,
  storeDomain,
  token,
  apiVersion,
  rows
}) {
  const normalizedRows = rows.map((row) => {
    const normalizedHandle = validateUrlHandle(row.suggestedHandle || row.handle || row.title).normalized;
    return {
      ...row,
      normalizedHandle
    };
  });
  for (const row of normalizedRows) {
    await updateProductSeo({
      storeDomain,
      token,
      apiVersion,
      productId: row.id,
      payload: {
        title: row.title,
        handle: row.normalizedHandle,
        metaTitle: row.metaTitle,
        metaDescription: row.metaDescription
      }
    });
    let redirectCreated = false;
    if (row.handle && row.handle !== row.normalizedHandle) {
      const redirect2 = await createUrlRedirect({
        storeDomain,
        token,
        apiVersion,
        path: `/products/${row.handle}`,
        target: `/products/${row.normalizedHandle}`
      });
      redirectCreated = Boolean(redirect2);
      await recordProductRevision({
        shop,
        productId: row.id,
        productTitle: row.title,
        changeType: "URL_OPTIMIZATION",
        beforeValues: {
          title: row.title,
          handle: row.handle,
          metaTitle: row.metaTitle,
          metaDescription: row.metaDescription
        },
        afterValues: {
          title: row.title,
          handle: row.normalizedHandle,
          metaTitle: row.metaTitle,
          metaDescription: row.metaDescription
        },
        redirectCreated
      });
    }
  }
  await applyIncrementalAuditPatch({
    shop,
    storeDomain,
    token,
    apiVersion,
    updatedProducts: normalizedRows.map((row) => ({
      id: String(row.id),
      title: row.title,
      handle: row.normalizedHandle,
      metafields_global_title_tag: row.metaTitle || "",
      metafields_global_description_tag: row.metaDescription || ""
    }))
  });
  return {
    ok: true,
    updated: normalizedRows.length
  };
}
async function rollbackProductRevision({
  shop,
  storeDomain,
  token,
  apiVersion,
  revisionId
}) {
  const revision = await prisma.productRevision.findFirst({
    where: { id: String(revisionId || ""), shop }
  });
  if (!revision) {
    throw new Error("Revision record not found.");
  }
  const before = JSON.parse(revision.beforeJson || "{}");
  const after = JSON.parse(revision.afterJson || "{}");
  const nextPayload = {
    title: String(before.title || after.title || revision.productTitle || "").trim(),
    handle: validateUrlHandle(before.handle || after.handle || before.title || "").normalized,
    metaTitle: String(before.metaTitle ?? after.metaTitle ?? "").trim(),
    metaDescription: String(before.metaDescription ?? after.metaDescription ?? "").trim(),
    focusKeyword: String(before.focusKeyword ?? after.focusKeyword ?? "").trim(),
    ...typeof before.descriptionHtml === "string" ? { descriptionHtml: before.descriptionHtml } : {}
  };
  if (!nextPayload.title) {
    throw new Error("Cannot rollback: previous product title is unavailable in this revision.");
  }
  return saveProductSeoAndRescan({
    shop,
    storeDomain,
    token,
    apiVersion,
    productId: revision.productId,
    payload: {
      ...nextPayload,
      originalHandle: after.handle || "",
      previousValues: after,
      changeType: "ROLLBACK"
    }
  });
}
async function applyImageAltFixesAndRescan({
  shop,
  storeDomain,
  token,
  apiVersion,
  rows
}) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const preCheck = validateImageAltRows(safeRows);
  if (!safeRows.length) {
    const historyState2 = await appendImageOptimizerHistory({
      shop,
      action: "fix",
      status: "failed",
      summary: preCheck.summary,
      attempted: 0,
      updated: 0,
      note: "No image rows were selected for update."
    });
    return {
      ok: false,
      error: "Select at least one image to fix.",
      summary: preCheck.summary,
      history: historyState2.history,
      lastRun: historyState2.lastRun
    };
  }
  const normalizedRows = safeRows.map((row) => {
    const check = validateImageAlt(row.altText || "");
    return {
      id: String(row.id || ""),
      productId: String(row.productId || ""),
      altText: check.normalized,
      valid: check.valid
    };
  });
  const invalidRows = normalizedRows.filter((row) => !row.valid || !row.id || !row.productId);
  if (invalidRows.length) {
    const historyState2 = await appendImageOptimizerHistory({
      shop,
      action: "fix",
      status: "failed",
      summary: preCheck.summary,
      attempted: normalizedRows.length,
      updated: 0,
      note: "One or more selected image ALT values were invalid."
    });
    return {
      ok: false,
      error: "One or more selected ALT values are invalid. Ensure each ALT is 1-125 characters.",
      summary: preCheck.summary,
      history: historyState2.history,
      lastRun: historyState2.lastRun
    };
  }
  let updatedCount = 0;
  try {
    for (const row of normalizedRows) {
      await updateProductImageAlt({
        storeDomain,
        token,
        apiVersion,
        productId: row.productId,
        imageId: row.id,
        altText: row.altText
      });
      updatedCount += 1;
    }
    await applyIncrementalAuditPatch({
      shop,
      storeDomain,
      token,
      apiVersion,
      updatedProducts: []
    });
  } catch (error) {
    const historyState2 = await appendImageOptimizerHistory({
      shop,
      action: "fix",
      status: "failed",
      summary: preCheck.summary,
      attempted: normalizedRows.length,
      updated: updatedCount,
      note: (error == null ? void 0 : error.message) || "Failed to update one or more image ALT values."
    });
    return {
      ok: false,
      error: (error == null ? void 0 : error.message) || "Failed to update image ALT values.",
      summary: preCheck.summary,
      history: historyState2.history,
      lastRun: historyState2.lastRun
    };
  }
  const appliedRows = normalizedRows.map((row) => ({
    id: row.id,
    altText: row.altText
  }));
  const appliedCheck = validateImageAltRows(appliedRows);
  const historyState = await appendImageOptimizerHistory({
    shop,
    action: "fix",
    status: "success",
    summary: appliedCheck.summary,
    attempted: normalizedRows.length,
    updated: normalizedRows.length,
    note: `Updated ALT text for ${normalizedRows.length} image(s).`
  });
  return {
    ok: true,
    updated: normalizedRows.length,
    summary: appliedCheck.summary,
    history: historyState.history,
    lastRun: historyState.lastRun
  };
}
async function regenerateSitemap({
  shop,
  storeDomain,
  token,
  apiVersion,
  extraManualUrl = ""
}) {
  const appState = await getAppState(shop);
  const manualUrls = [...appState.sitemapManualUrls];
  const cleanManual = String(extraManualUrl || "").trim();
  if (cleanManual) {
    manualUrls.push(cleanManual);
  }
  const { products } = await fetchAllProducts({
    storeDomain,
    token,
    apiVersion,
    maxProducts: 1e4
  });
  const urls = generateSitemapUrls({
    storeDomain,
    products,
    manualUrls
  });
  const generatedAt = (/* @__PURE__ */ new Date()).toISOString();
  const next = await updateAppState(shop, (current) => ({
    ...current,
    sitemapManualUrls: Array.from(new Set(manualUrls)),
    sitemapUrls: urls,
    sitemapGeneratedAt: generatedAt
  }));
  return {
    generatedAt,
    urls: next.sitemapUrls,
    manualUrls: next.sitemapManualUrls
  };
}
async function updateAutopilotSettings({
  shop,
  enabled,
  optimizeMeta = true,
  optimizeAlt = true,
  maxImagesPerProduct = 3
}) {
  const cleanShop = String(shop || "").trim().toLowerCase();
  const next = await updateAppState(cleanShop, (current) => {
    var _a2;
    return {
      ...current,
      autopilot: {
        ...current.autopilot || {},
        enabled: Boolean(enabled),
        optimizeMeta: Boolean(optimizeMeta),
        optimizeAlt: Boolean(optimizeAlt),
        maxImagesPerProduct: Math.max(1, Math.min(10, Number(maxImagesPerProduct || 3) || 3)),
        lastRuns: Array.isArray((_a2 = current.autopilot) == null ? void 0 : _a2.lastRuns) ? current.autopilot.lastRuns : []
      }
    };
  });
  return next.autopilot;
}
async function appendAutopilotRunLog(shop, entry2) {
  await updateAppState(shop, (current) => {
    var _a2;
    const prevRuns = Array.isArray((_a2 = current.autopilot) == null ? void 0 : _a2.lastRuns) ? current.autopilot.lastRuns : [];
    const filtered = prevRuns.filter(
      (item) => !(String(item.productId) === String(entry2.productId) && item.status === "RUNNING")
    );
    return {
      ...current,
      autopilot: {
        ...current.autopilot || {},
        lastRuns: [entry2, ...filtered].slice(0, 25)
      }
    };
  });
}
async function runAutopilotForCreatedProduct({ shop, productPayload }) {
  var _a2, _b, _c;
  const cleanShop = String(shop || "").trim().toLowerCase();
  const productId = String((productPayload == null ? void 0 : productPayload.id) || "").trim();
  if (!cleanShop || !productId) {
    return { skipped: true, reason: "missing_context" };
  }
  const appState = await getAppState(cleanShop);
  const autopilot = (appState == null ? void 0 : appState.autopilot) || {};
  if (!autopilot.enabled) {
    return { skipped: true, reason: "autopilot_disabled" };
  }
  const recentDuplicate = (autopilot.lastRuns || []).find((run) => {
    if (String(run.productId) !== productId) return false;
    const ageMs = Date.now() - new Date(run.createdAt || 0).getTime();
    return ageMs < 10 * 60 * 1e3 && (run.status === "COMPLETED" || run.status === "RUNNING");
  });
  if (recentDuplicate) {
    return { skipped: true, reason: "duplicate_webhook" };
  }
  const productTitleFallback = String((productPayload == null ? void 0 : productPayload.title) || `Product #${productId}`);
  const [offlineSession, platformAi, access] = await Promise.all([
    prisma.session.findFirst({ where: { shop: cleanShop, isOnline: false }, orderBy: { id: "desc" } }),
    getEffectivePlatformAiSettings(),
    checkStoreRouteAccess(cleanShop, "ai_features")
  ]);
  const ctx = getShopContext({
    sessionShop: cleanShop,
    sessionToken: (offlineSession == null ? void 0 : offlineSession.accessToken) || ""
  });
  if (ctx.configError || !ctx.token) {
    await appendAutopilotRunLog(cleanShop, {
      productId,
      productTitle: productTitleFallback,
      status: "SKIPPED",
      metaUpdated: false,
      imagesUpdated: 0,
      creditsDeducted: 0,
      error: ctx.configError || "No offline Shopify access token available.",
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    });
    return { skipped: true, reason: "missing_shopify_token" };
  }
  if (!(platformAi == null ? void 0 : platformAi.isEnabled) || !(platformAi == null ? void 0 : platformAi.apiKey) || !access.allowed) {
    await appendAutopilotRunLog(cleanShop, {
      productId,
      productTitle: productTitleFallback,
      status: "SKIPPED",
      metaUpdated: false,
      imagesUpdated: 0,
      creditsDeducted: 0,
      error: !access.allowed ? access.reason : "Platform Gemini AI is unavailable.",
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    });
    return { skipped: true, reason: "ai_unavailable" };
  }
  await appendAutopilotRunLog(cleanShop, {
    productId,
    productTitle: productTitleFallback,
    status: "RUNNING",
    metaUpdated: false,
    imagesUpdated: 0,
    creditsDeducted: 0,
    error: "",
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  });
  const hasSuperAccess = Boolean((_a2 = access.control) == null ? void 0 : _a2.superAccess);
  const aiSettings = {
    provider: platformAi.provider,
    model: platformAi.model,
    apiKey: platformAi.apiKey,
    temperature: platformAi.temperature
  };
  let metaUpdated = false;
  let imagesUpdated = 0;
  let creditsDeducted = 0;
  let runError = "";
  let liveTitle = productTitleFallback;
  try {
    const liveProduct = await fetchProductById({
      storeDomain: ctx.storeDomain,
      token: ctx.token,
      apiVersion: ctx.apiVersion,
      productId
    }).catch(() => null) || {
      id: productId,
      title: productTitleFallback,
      handle: String((productPayload == null ? void 0 : productPayload.handle) || ""),
      metafields_global_title_tag: "",
      metafields_global_description_tag: "",
      images: Array.isArray(productPayload == null ? void 0 : productPayload.images) ? productPayload.images : []
    };
    liveTitle = liveProduct.title || productTitleFallback;
    const currentFocusKw = String(((_c = (_b = appState == null ? void 0 : appState.productSeo) == null ? void 0 : _b[productId]) == null ? void 0 : _c.focusKeyword) || "");
    let optimizedProduct = null;
    if (autopilot.optimizeMeta) {
      const needsMeta = !validateProductTitle(liveProduct.title).valid || !validateUrlHandle(liveProduct.handle).valid || !validateFocusKeyword(currentFocusKw).valid || !validateMetaTitle(liveProduct.metafields_global_title_tag).valid || !validateMetaTitle(liveProduct.metafields_global_title_tag).ideal || !validateMetaDescription(liveProduct.metafields_global_description_tag).valid || !validateMetaDescription(liveProduct.metafields_global_description_tag).ideal;
      if (needsMeta) {
        const metaBalance = await checkCreditBalance(cleanShop, "product_seo_fix");
        if (hasSuperAccess || metaBalance.allowed) {
          const suggestion = await generateProductSeoFix({
            settings: aiSettings,
            title: liveProduct.title,
            focusKeyword: currentFocusKw,
            handle: liveProduct.handle,
            metaTitle: liveProduct.metafields_global_title_tag,
            metaDescription: liveProduct.metafields_global_description_tag,
            descriptionHtml: liveProduct.body_html || "",
            productType: liveProduct.product_type || "",
            tags: liveProduct.tags || "",
            preserveHandle: validateUrlHandle(liveProduct.handle || "").valid
          });
          if (!(suggestion == null ? void 0 : suggestion.fallbackUsed)) {
            const validation = buildAutoFixSeoPayload(
              { ...liveProduct, focusKeyword: currentFocusKw },
              suggestion
            );
            if (validation.valid) {
              await applyValidatedProductSeoUpdate({
                shop: cleanShop,
                storeDomain: ctx.storeDomain,
                token: ctx.token,
                apiVersion: ctx.apiVersion,
                productId,
                payload: {
                  originalHandle: liveProduct.handle,
                  previousValues: {
                    title: liveProduct.title,
                    handle: liveProduct.handle,
                    focusKeyword: currentFocusKw,
                    metaTitle: liveProduct.metafields_global_title_tag,
                    metaDescription: liveProduct.metafields_global_description_tag
                  },
                  aiVerdict: {
                    verdictSummary: suggestion.rationale || "Autopilot auto-optimized on product create.",
                    model: aiSettings.model || DEFAULT_GEMINI_MODEL
                  }
                },
                normalized: validation.normalized,
                changeType: "AUTOPILOT_CREATE"
              });
              const deduction = await deductCredits({
                shop: cleanShop,
                actionType: "product_seo_fix",
                productId,
                productTitle: validation.normalized.title,
                modelUsed: aiSettings.model || DEFAULT_GEMINI_MODEL,
                bypassLimit: hasSuperAccess
              });
              creditsDeducted += deduction.deducted;
              metaUpdated = true;
              optimizedProduct = {
                id: String(productId),
                title: validation.normalized.title,
                handle: validation.normalized.handle,
                metafields_global_title_tag: validation.normalized.metaTitle,
                metafields_global_description_tag: validation.normalized.metaDescription
              };
            }
          }
        } else {
          runError = "Insufficient AI tokens for product metadata.";
        }
      }
    }
    if (autopilot.optimizeAlt && Array.isArray(liveProduct.images) && liveProduct.images.length) {
      const targetImages = liveProduct.images.filter((img) => {
        const check = validateImageAlt(img.alt || "");
        return !check.valid || check.generic || check.tooShort;
      }).slice(0, autopilot.maxImagesPerProduct || 3);
      for (const img of targetImages) {
        const imgId = String(img.id || "").trim();
        const imgUrl = String(img.src || "").trim();
        if (!imgId || !imgUrl) continue;
        const imgBalance = await checkCreditBalance(cleanShop, "vision_alt");
        if (!hasSuperAccess && !imgBalance.allowed) {
          if (!runError) runError = "Insufficient AI tokens for remaining image ALT tags.";
          break;
        }
        const vision = await generateVisionImageAlt({
          settings: aiSettings,
          imageUrl: imgUrl,
          productTitle: liveTitle
        });
        if ((vision == null ? void 0 : vision.fallbackUsed) || !(vision == null ? void 0 : vision.altText)) continue;
        const altCheck = validateImageAlt(vision.altText);
        if (!altCheck.valid) continue;
        await updateProductImageAlt({
          storeDomain: ctx.storeDomain,
          token: ctx.token,
          apiVersion: ctx.apiVersion,
          productId,
          imageId: imgId,
          altText: altCheck.normalized
        });
        const deduction = await deductCredits({
          shop: cleanShop,
          actionType: "vision_alt",
          productId,
          productTitle: `${liveTitle} (Image ${img.position || 1})`,
          modelUsed: aiSettings.model || DEFAULT_GEMINI_MODEL,
          bypassLimit: hasSuperAccess
        });
        creditsDeducted += deduction.deducted;
        imagesUpdated += 1;
      }
    }
    if (metaUpdated || imagesUpdated > 0) {
      await applyIncrementalAuditPatch({
        shop: cleanShop,
        storeDomain: ctx.storeDomain,
        token: ctx.token,
        apiVersion: ctx.apiVersion,
        updatedProducts: optimizedProduct ? [optimizedProduct] : [
          {
            id: String(productId),
            title: liveProduct.title,
            handle: liveProduct.handle,
            metafields_global_title_tag: liveProduct.metafields_global_title_tag,
            metafields_global_description_tag: liveProduct.metafields_global_description_tag
          }
        ]
      }).catch(() => {
      });
    }
    await appendAutopilotRunLog(cleanShop, {
      productId,
      productTitle: liveTitle,
      status: metaUpdated || imagesUpdated > 0 ? "COMPLETED" : "NO_CHANGES",
      metaUpdated,
      imagesUpdated,
      creditsDeducted,
      error: runError,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    });
    return { ok: true, productId, metaUpdated, imagesUpdated, creditsDeducted };
  } catch (error) {
    await appendAutopilotRunLog(cleanShop, {
      productId,
      productTitle: liveTitle,
      status: "FAILED",
      metaUpdated,
      imagesUpdated,
      creditsDeducted,
      error: (error == null ? void 0 : error.message) || "Autopilot failed.",
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    });
    return { ok: false, error: error == null ? void 0 : error.message };
  }
}
const action$j = async ({
  request
}) => {
  const {
    shop,
    topic,
    payload
  } = await authenticate.webhook(request);
  console.log(`Received ${topic} webhook for ${shop} (product ${(payload == null ? void 0 : payload.id) || "unknown"})`);
  if (shop && (payload == null ? void 0 : payload.id)) {
    void runAutopilotForCreatedProduct({
      shop,
      productPayload: payload
    }).catch((err) => {
      console.warn(`Autopilot failed for ${shop} product ${payload == null ? void 0 : payload.id}:`, err == null ? void 0 : err.message);
    });
  }
  return new Response(null, {
    status: 200
  });
};
const route5 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$j
}, Symbol.toStringTag, { value: "Module" }));
const action$i = async ({
  request
}) => {
  const {
    shop,
    topic
  } = await authenticate.webhook(request);
  console.log(`Received compliance webhook ${topic} for ${shop}`);
  if (shop) {
    await purgeShopData(shop);
  }
  return new Response();
};
const route6 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$i
}, Symbol.toStringTag, { value: "Module" }));
const GSC_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GSC_API_BASE = "https://www.googleapis.com/webmasters/v3";
function getGscStateSecret() {
  return process.env.SHOPIFY_API_SECRET || process.env.SUPERADMIN_SESSION_SECRET || "ecom-seo-gsc-oauth-state-secret";
}
function sanitizeGscForClient(gsc = {}) {
  return {
    connected: Boolean(gsc == null ? void 0 : gsc.connected),
    mode: String((gsc == null ? void 0 : gsc.mode) || ""),
    siteUrl: String((gsc == null ? void 0 : gsc.siteUrl) || ""),
    availableSites: Array.isArray(gsc == null ? void 0 : gsc.availableSites) ? gsc.availableSites : [],
    lastSyncedAt: (gsc == null ? void 0 : gsc.lastSyncedAt) || null,
    summary: (gsc == null ? void 0 : gsc.summary) || null,
    urlMetrics: Array.isArray(gsc == null ? void 0 : gsc.urlMetrics) ? gsc.urlMetrics : [],
    quickWins: Array.isArray(gsc == null ? void 0 : gsc.quickWins) ? gsc.quickWins : []
  };
}
function createSignedGscState({ shop, host = "" }) {
  const payload = Buffer.from(
    JSON.stringify({
      shop: String(shop || "").trim().toLowerCase(),
      host: String(host || "").trim(),
      ts: Date.now(),
      nonce: crypto.randomBytes(8).toString("hex")
    }),
    "utf8"
  ).toString("base64url");
  const sig = crypto.createHmac("sha256", getGscStateSecret()).update(payload).digest("hex");
  return `${payload}.${sig}`;
}
function verifySignedGscState(rawState, maxAgeMs = 15 * 60 * 1e3) {
  const parts = String(rawState || "").split(".");
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  if (!payload || !sig) return null;
  const expectedSig = crypto.createHmac("sha256", getGscStateSecret()).update(payload).digest("hex");
  const sigBuf = Buffer.from(sig, "utf8");
  const expectedBuf = Buffer.from(expectedSig, "utf8");
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!(parsed == null ? void 0 : parsed.shop) || !(parsed == null ? void 0 : parsed.ts)) return null;
    if (Date.now() - Number(parsed.ts) > maxAgeMs) return null;
    return {
      shop: String(parsed.shop).trim().toLowerCase(),
      host: String(parsed.host || "").trim()
    };
  } catch {
    return null;
  }
}
async function buildGscAuthUrl({ shop, host = "", origin }) {
  const oauth = await getEffectiveGscOAuthConfig();
  if (!oauth.clientId || !oauth.clientSecret) {
    throw new Error(
      "Google Search Console OAuth Client ID/Secret is not configured. Ask SuperAdmin to add it in /superadmin/ai, or import a GSC CSV export below."
    );
  }
  const baseUrl = String(process.env.SHOPIFY_APP_URL || origin || "").replace(/\/$/, "");
  const redirectUri = `${baseUrl}/api/gsc/callback`;
  const state = createSignedGscState({ shop, host });
  const params = new URLSearchParams({
    client_id: oauth.clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GSC_SCOPE,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}
async function exchangeGscCodeForTokens({ code, origin }) {
  const oauth = await getEffectiveGscOAuthConfig();
  if (!oauth.clientId || !oauth.clientSecret) {
    throw new Error("Google Search Console OAuth credentials are missing.");
  }
  const baseUrl = String(process.env.SHOPIFY_APP_URL || origin || "").replace(/\/$/, "");
  const redirectUri = `${baseUrl}/api/gsc/callback`;
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: String(code || ""),
      client_id: oauth.clientId,
      client_secret: oauth.clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code"
    })
  });
  const data2 = await res.json().catch(() => ({}));
  if (!res.ok || !(data2 == null ? void 0 : data2.access_token)) {
    throw new Error((data2 == null ? void 0 : data2.error_description) || (data2 == null ? void 0 : data2.error) || "Failed to exchange Google OAuth code.");
  }
  return {
    accessToken: data2.access_token,
    refreshToken: data2.refresh_token || "",
    expiresAt: Date.now() + Number(data2.expires_in || 3600) * 1e3
  };
}
async function refreshGscAccessToken({ refreshToken }) {
  const oauth = await getEffectiveGscOAuthConfig();
  if (!oauth.clientId || !oauth.clientSecret || !refreshToken) {
    throw new Error("Unable to refresh Google Search Console token. Reconnect Google Search Console.");
  }
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: oauth.clientId,
      client_secret: oauth.clientSecret,
      grant_type: "refresh_token"
    })
  });
  const data2 = await res.json().catch(() => ({}));
  if (!res.ok || !(data2 == null ? void 0 : data2.access_token)) {
    throw new Error((data2 == null ? void 0 : data2.error_description) || (data2 == null ? void 0 : data2.error) || "Google Search Console token expired.");
  }
  return {
    accessToken: data2.access_token,
    expiresAt: Date.now() + Number(data2.expires_in || 3600) * 1e3
  };
}
async function listGscSites({ accessToken }) {
  var _a2;
  const res = await fetch(`${GSC_API_BASE}/sites`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const data2 = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(((_a2 = data2 == null ? void 0 : data2.error) == null ? void 0 : _a2.message) || "Failed to list verified Search Console properties.");
  }
  return (Array.isArray(data2.siteEntry) ? data2.siteEntry : []).filter((entry2) => (entry2 == null ? void 0 : entry2.permissionLevel) !== "siteUnverifiedUser").map((entry2) => ({
    siteUrl: String(entry2.siteUrl || ""),
    permissionLevel: String(entry2.permissionLevel || "")
  })).filter((entry2) => Boolean(entry2.siteUrl));
}
function isoDateDaysAgo(daysAgo) {
  const d = new Date(Date.now() - daysAgo * 864e5);
  return d.toISOString().slice(0, 10);
}
async function fetchGscSearchAnalytics({ accessToken, siteUrl, days = 28 }) {
  var _a2;
  const startDate = isoDateDaysAgo(days + 2);
  const endDate = isoDateDaysAgo(2);
  const res = await fetch(`${GSC_API_BASE}/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      startDate,
      endDate,
      dimensions: ["page", "query"],
      rowLimit: 1e3,
      dataState: "final"
    })
  });
  const data2 = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(((_a2 = data2 == null ? void 0 : data2.error) == null ? void 0 : _a2.message) || "Failed to query Google Search Console analytics.");
  }
  return (Array.isArray(data2.rows) ? data2.rows : []).map((row) => {
    var _a3, _b;
    return {
      page: String(((_a3 = row == null ? void 0 : row.keys) == null ? void 0 : _a3[0]) || ""),
      query: String(((_b = row == null ? void 0 : row.keys) == null ? void 0 : _b[1]) || ""),
      clicks: Number((row == null ? void 0 : row.clicks) || 0),
      impressions: Number((row == null ? void 0 : row.impressions) || 0),
      ctr: Number((row == null ? void 0 : row.ctr) || 0),
      position: Number((row == null ? void 0 : row.position) || 0)
    };
  });
}
function extractPathname(rawUrlOrPath) {
  const raw = String(rawUrlOrPath || "").trim();
  if (!raw) return "/";
  try {
    if (/^https?:\/\//i.test(raw)) {
      return new URL(raw).pathname || "/";
    }
  } catch {
  }
  const clean = raw.split("?")[0].split("#")[0];
  return clean.startsWith("/") ? clean : `/${clean}`;
}
function extractProductHandleFromPath(pathname) {
  const match = String(pathname || "").match(/\/products\/([^/?#]+)/i);
  if (!(match == null ? void 0 : match[1])) return "";
  try {
    return decodeURIComponent(match[1]).toLowerCase();
  } catch {
    return String(match[1]).toLowerCase();
  }
}
function parseCsvLine(line) {
  const cells = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  cells.push(current.trim());
  return cells;
}
function parseNumberCell(raw) {
  const clean = String(raw || "").replace(/[,\s]/g, "").trim();
  if (!clean) return 0;
  if (clean.endsWith("%")) {
    const num2 = Number(clean.slice(0, -1));
    return Number.isFinite(num2) ? num2 / 100 : 0;
  }
  const num = Number(clean);
  return Number.isFinite(num) ? num : 0;
}
function parseGscCsvText(csvText, storeDomain = "") {
  const lines = String(csvText || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) {
    throw new Error("CSV must include a header row and at least one data row.");
  }
  const headers2 = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
  const findCol = (candidates) => headers2.findIndex((h) => candidates.some((c) => h.includes(c)));
  const pageIdx = findCol(["top pages", "page", "url", "landing"]);
  const queryIdx = findCol(["top queries", "query", "keyword"]);
  const clicksIdx = findCol(["click"]);
  const impIdx = findCol(["impression"]);
  const ctrIdx = findCol(["ctr"]);
  const posIdx = findCol(["position", "rank"]);
  if (pageIdx === -1 && queryIdx === -1) {
    throw new Error("CSV must include a Page/URL or Top queries column.");
  }
  const fallbackPage = storeDomain ? `https://${storeDomain}/` : "/";
  const rows = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cells = parseCsvLine(lines[i]);
    if (!cells.length) continue;
    const clicks = clicksIdx >= 0 ? parseNumberCell(cells[clicksIdx]) : 0;
    const impressions = impIdx >= 0 ? parseNumberCell(cells[impIdx]) : 0;
    let ctr = ctrIdx >= 0 ? parseNumberCell(cells[ctrIdx]) : 0;
    if (ctr > 1) ctr = ctr / 100;
    if (!ctr && impressions > 0) ctr = clicks / impressions;
    const position = posIdx >= 0 ? parseNumberCell(cells[posIdx]) : 0;
    rows.push({
      page: pageIdx >= 0 && cells[pageIdx] ? cells[pageIdx] : fallbackPage,
      query: queryIdx >= 0 && cells[queryIdx] ? cells[queryIdx] : "(page traffic)",
      clicks: Math.max(0, Math.round(clicks)),
      impressions: Math.max(0, Math.round(impressions)),
      ctr: Math.max(0, Math.min(1, ctr)),
      position: Math.max(0, Number(position.toFixed(1)))
    });
  }
  if (!rows.length) {
    throw new Error("No valid Search Console rows were found in the CSV.");
  }
  return rows;
}
function analyzeGscPerformance({ rows = [], storeDomain = "", products = [], appState = {} }) {
  var _a2, _b, _c, _d;
  const productByHandle = /* @__PURE__ */ new Map();
  for (const product of Array.isArray(products) ? products : []) {
    const handle = String((product == null ? void 0 : product.handle) || "").trim().toLowerCase();
    if (handle) productByHandle.set(handle, product);
  }
  const urlMap = /* @__PURE__ */ new Map();
  const quickWins = [];
  let totalClicks = 0;
  let totalImpressions = 0;
  let weightedPosSum = 0;
  for (const row of Array.isArray(rows) ? rows : []) {
    const path = extractPathname(row.page);
    const handle = extractProductHandleFromPath(path);
    const matchedProduct = handle ? productByHandle.get(handle) || null : null;
    const clicks = Math.max(0, Number(row.clicks || 0));
    const impressions = Math.max(0, Number(row.impressions || 0));
    const position = Math.max(0, Number(row.position || 0));
    const ctr = impressions > 0 ? Number(row.ctr || clicks / impressions) : 0;
    const query = String(row.query || "").trim();
    totalClicks += clicks;
    totalImpressions += impressions;
    weightedPosSum += position * Math.max(1, impressions);
    const existing = urlMap.get(path) || {
      path,
      url: String(row.page || (storeDomain ? `https://${storeDomain}${path}` : path)),
      productId: matchedProduct ? String(matchedProduct.id) : null,
      productTitle: matchedProduct ? String(matchedProduct.title || "") : "",
      handle: matchedProduct ? String(matchedProduct.handle || "") : handle,
      metaTitle: matchedProduct ? String(matchedProduct.metafields_global_title_tag || "") : "",
      metaDescription: matchedProduct ? String(matchedProduct.metafields_global_description_tag || "") : "",
      currentKeyword: matchedProduct ? String(((_b = (_a2 = appState == null ? void 0 : appState.productSeo) == null ? void 0 : _a2[String(matchedProduct.id)]) == null ? void 0 : _b.focusKeyword) || "") : "",
      clicks: 0,
      impressions: 0,
      weightedPos: 0,
      topQuery: "",
      topQueryImpressions: -1
    };
    existing.clicks += clicks;
    existing.impressions += impressions;
    existing.weightedPos += position * Math.max(1, impressions);
    if (query && query !== "(page traffic)" && impressions > existing.topQueryImpressions) {
      existing.topQuery = query;
      existing.topQueryImpressions = impressions;
    }
    urlMap.set(path, existing);
    if (query && query !== "(page traffic)" && position >= 8 && position <= 20 && impressions >= 5) {
      const opportunityScore = Math.round(impressions * (21 - position) * (1 - Math.min(0.4, ctr)));
      quickWins.push({
        query,
        page: String(row.page || path),
        path,
        productId: matchedProduct ? String(matchedProduct.id) : null,
        productTitle: matchedProduct ? String(matchedProduct.title || "") : "",
        handle: matchedProduct ? String(matchedProduct.handle || "") : handle,
        metaTitle: matchedProduct ? String(matchedProduct.metafields_global_title_tag || "") : "",
        metaDescription: matchedProduct ? String(matchedProduct.metafields_global_description_tag || "") : "",
        currentKeyword: matchedProduct ? String(((_d = (_c = appState == null ? void 0 : appState.productSeo) == null ? void 0 : _c[String(matchedProduct.id)]) == null ? void 0 : _d.focusKeyword) || "") : "",
        clicks,
        impressions,
        ctr: Number((ctr * 100).toFixed(2)),
        position: Number(position.toFixed(1)),
        opportunityScore
      });
    }
  }
  const urlMetrics = Array.from(urlMap.values()).map((entry2) => {
    const denom = Math.max(1, entry2.impressions);
    const ctrPct = entry2.impressions > 0 ? entry2.clicks / entry2.impressions * 100 : 0;
    return {
      path: entry2.path,
      url: entry2.url,
      productId: entry2.productId,
      productTitle: entry2.productTitle,
      handle: entry2.handle,
      metaTitle: entry2.metaTitle,
      metaDescription: entry2.metaDescription,
      currentKeyword: entry2.currentKeyword,
      clicks: entry2.clicks,
      impressions: entry2.impressions,
      ctr: Number(ctrPct.toFixed(2)),
      position: Number((entry2.weightedPos / denom).toFixed(1)),
      topQuery: entry2.topQuery
    };
  }).sort((a, b) => b.impressions - a.impressions || b.clicks - a.clicks).slice(0, 40);
  const sortedQuickWins = quickWins.sort((a, b) => b.opportunityScore - a.opportunityScore || b.impressions - a.impressions).slice(0, 30);
  const matchedProductsCount = urlMetrics.filter((u) => Boolean(u.productId)).length;
  const totalImprDenom = Math.max(1, totalImpressions);
  return {
    summary: {
      totalClicks,
      totalImpressions,
      avgCtr: totalImpressions > 0 ? Number((totalClicks / totalImpressions * 100).toFixed(2)) : 0,
      avgPosition: rows.length > 0 ? Number((weightedPosSum / totalImprDenom).toFixed(1)) : 0,
      quickWinsCount: sortedQuickWins.length,
      matchedProductsCount
    },
    urlMetrics,
    quickWins: sortedQuickWins
  };
}
function pickPreferredSite(sites = [], storeDomain = "") {
  if (!sites.length) return "";
  const cleanDomain = String(storeDomain || "").trim().toLowerCase();
  const domainMatch = sites.find((s) => {
    const u = s.siteUrl.toLowerCase();
    return u === `sc-domain:${cleanDomain}` || u.includes(`//${cleanDomain}`);
  });
  return (domainMatch || sites[0]).siteUrl;
}
async function syncGscMetricsForShop({
  shop,
  storeDomain,
  token,
  apiVersion,
  siteUrlOverride = ""
}) {
  const appState = await getAppState(shop);
  const gsc = appState.gsc || {};
  if (!gsc.accessToken && !gsc.refreshToken) {
    throw new Error("Google Search Console is not connected yet.");
  }
  let accessToken = gsc.accessToken;
  let expiresAt = Number(gsc.expiresAt || 0);
  if ((!accessToken || Date.now() >= expiresAt - 6e4) && gsc.refreshToken) {
    const refreshed = await refreshGscAccessToken({ refreshToken: gsc.refreshToken });
    accessToken = refreshed.accessToken;
    expiresAt = refreshed.expiresAt;
  }
  let availableSites = gsc.availableSites || [];
  try {
    availableSites = await listGscSites({ accessToken });
  } catch (err) {
    if (!availableSites.length) throw err;
  }
  const chosenSite = siteUrlOverride || gsc.siteUrl || pickPreferredSite(availableSites, storeDomain);
  if (!chosenSite) {
    throw new Error(
      "No verified Google Search Console property was found on this Google account."
    );
  }
  const [rows, catalog] = await Promise.all([
    fetchGscSearchAnalytics({ accessToken, siteUrl: chosenSite, days: 28 }),
    token ? fetchAllProducts({ storeDomain, token, apiVersion, maxProducts: 1e4 }).catch(() => ({
      products: []
    })) : Promise.resolve({ products: [] })
  ]);
  const analysis = analyzeGscPerformance({
    rows,
    storeDomain,
    products: catalog.products || [],
    appState
  });
  const nextState = await updateAppState(shop, (current) => {
    var _a2;
    return {
      ...current,
      gsc: {
        ...current.gsc,
        connected: true,
        mode: "oauth",
        siteUrl: chosenSite,
        accessToken,
        refreshToken: gsc.refreshToken || ((_a2 = current.gsc) == null ? void 0 : _a2.refreshToken) || "",
        expiresAt,
        availableSites,
        lastSyncedAt: (/* @__PURE__ */ new Date()).toISOString(),
        ...analysis
      }
    };
  });
  return sanitizeGscForClient(nextState.gsc);
}
async function importGscCsvForShop({ shop, storeDomain, token, apiVersion, csvText }) {
  const appState = await getAppState(shop);
  const rows = parseGscCsvText(csvText, storeDomain);
  const catalog = token ? await fetchAllProducts({ storeDomain, token, apiVersion, maxProducts: 1e4 }).catch(() => ({
    products: []
  })) : { products: [] };
  const analysis = analyzeGscPerformance({
    rows,
    storeDomain,
    products: catalog.products || [],
    appState
  });
  const nextState = await updateAppState(shop, (current) => {
    var _a2;
    return {
      ...current,
      gsc: {
        ...current.gsc,
        connected: true,
        mode: "csv",
        siteUrl: ((_a2 = current.gsc) == null ? void 0 : _a2.siteUrl) || `https://${storeDomain}/`,
        lastSyncedAt: (/* @__PURE__ */ new Date()).toISOString(),
        ...analysis
      }
    };
  });
  return sanitizeGscForClient(nextState.gsc);
}
async function disconnectGscForShop(shop) {
  await updateAppState(shop, (current) => ({
    ...current,
    gsc: {
      connected: false,
      mode: "",
      siteUrl: "",
      accessToken: "",
      refreshToken: "",
      expiresAt: 0,
      availableSites: [],
      lastSyncedAt: null,
      summary: null,
      urlMetrics: [],
      quickWins: []
    }
  }));
}
function buildReturnUrl(shop, host, statusParam) {
  const params = new URLSearchParams(statusParam);
  if (shop) params.set("shop", shop);
  if (host) params.set("host", host);
  return `/app/seo-audit?${params.toString()}`;
}
const loader$n = async ({
  request
}) => {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const rawState = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");
  const verified = verifySignedGscState(rawState);
  if (!(verified == null ? void 0 : verified.shop)) {
    return redirect("/app/seo-audit?gscError=Invalid+or+expired+Google+OAuth+state.");
  }
  const {
    shop,
    host
  } = verified;
  if (oauthError) {
    return redirect(buildReturnUrl(shop, host, `gscError=${encodeURIComponent(oauthError)}`));
  }
  if (!code) {
    return redirect(buildReturnUrl(shop, host, "gscError=Missing+Google+authorization+code."));
  }
  try {
    const tokens = await exchangeGscCodeForTokens({
      code,
      origin: url.origin
    });
    await updateAppState(shop, (current) => {
      var _a2;
      return {
        ...current,
        gsc: {
          ...current.gsc,
          connected: true,
          mode: "oauth",
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken || ((_a2 = current.gsc) == null ? void 0 : _a2.refreshToken) || "",
          expiresAt: tokens.expiresAt
        }
      };
    });
    const offlineSession = await prisma.session.findFirst({
      where: {
        shop,
        isOnline: false
      },
      orderBy: {
        id: "desc"
      }
    });
    const ctx = getShopContext({
      sessionShop: shop,
      sessionToken: (offlineSession == null ? void 0 : offlineSession.accessToken) || ""
    });
    await syncGscMetricsForShop({
      shop,
      storeDomain: ctx.storeDomain || shop,
      token: ctx.token,
      apiVersion: ctx.apiVersion
    });
    return redirect(buildReturnUrl(shop, host, "gsc=connected"));
  } catch (error) {
    const msg = (error == null ? void 0 : error.message) || "Google Search Console connection failed.";
    return redirect(buildReturnUrl(shop, host, `gscError=${encodeURIComponent(msg)}`));
  }
};
const route7 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  loader: loader$n
}, Symbol.toStringTag, { value: "Module" }));
function loginErrorMessage(loginErrors) {
  if ((loginErrors == null ? void 0 : loginErrors.shop) === LoginErrorType.MissingShop) {
    return { shop: "Please enter your shop domain to log in" };
  } else if ((loginErrors == null ? void 0 : loginErrors.shop) === LoginErrorType.InvalidShop) {
    return { shop: "Please enter a valid shop domain to log in" };
  }
  return {};
}
const loader$m = async ({
  request
}) => {
  const errors = loginErrorMessage(await login(request));
  return {
    errors
  };
};
const action$h = async ({
  request
}) => {
  const errors = loginErrorMessage(await login(request));
  return {
    errors
  };
};
const route$1 = UNSAFE_withComponentProps(function Auth() {
  const loaderData = useLoaderData();
  const actionData = useActionData();
  const [shop, setShop] = useState("");
  const {
    errors
  } = actionData || loaderData;
  return /* @__PURE__ */ jsx(AppProvider, {
    embedded: false,
    children: /* @__PURE__ */ jsx(Fragment, {
      children: /* @__PURE__ */ jsx(Form, {
        method: "post",
        children: /* @__PURE__ */ jsxs("s-section", {
          heading: "Log in",
          children: [/* @__PURE__ */ jsx("s-text-field", {
            name: "shop",
            label: "Shop domain",
            details: "example.myshopify.com",
            value: shop,
            onChange: (e) => setShop(e.currentTarget.value),
            autocomplete: "on",
            error: errors.shop
          }), /* @__PURE__ */ jsx("s-button", {
            type: "submit",
            children: "Log in"
          })]
        })
      })
    })
  });
});
const route8 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$h,
  default: route$1,
  loader: loader$m
}, Symbol.toStringTag, { value: "Module" }));
const superadminStyles = "/assets/superadmin-B600NvlH.css";
const toastStyles = "/assets/toast-BrRlBN_F.css";
const TOAST_EVENT = "ecomseo:toast";
const MAX_VISIBLE_TOASTS = 4;
const RECENT_DEDUP_MS = 1600;
let toastSequence = 0;
const recentToastMap = /* @__PURE__ */ new Map();
const DEFAULT_TITLES = Object.freeze({
  error: "Error",
  warning: "Notice",
  success: "Success",
  info: "Notice"
});
const TONE_ICONS = Object.freeze({
  error: "!",
  warning: "▲",
  success: "✓",
  info: "i"
});
function compactText(raw, maxLength = 240) {
  const clean = String(raw || "").replace(/\s+/g, " ").trim();
  if (!clean) return "";
  if (clean.length <= maxLength) return clean;
  return `${clean.slice(0, maxLength - 3).trimEnd()}...`;
}
function showToast({ title, message, tone = "info", duration } = {}) {
  if (typeof window === "undefined") return;
  const cleanMessage = compactText(message);
  if (!cleanMessage) return;
  const normalizedTone = ["error", "warning", "success", "info"].includes(tone) ? tone : "info";
  const dedupKey = `${normalizedTone}::${cleanMessage}`;
  const now = Date.now();
  const prevAt = recentToastMap.get(dedupKey);
  if (prevAt && now - prevAt < RECENT_DEDUP_MS) {
    return;
  }
  recentToastMap.set(dedupKey, now);
  if (recentToastMap.size > 40) {
    for (const [key, ts] of recentToastMap.entries()) {
      if (now - ts > RECENT_DEDUP_MS * 3) recentToastMap.delete(key);
    }
  }
  window.dispatchEvent(
    new CustomEvent(TOAST_EVENT, {
      detail: {
        title: compactText(title, 60) || DEFAULT_TITLES[normalizedTone],
        message: cleanMessage,
        tone: normalizedTone,
        duration: typeof duration === "number" ? duration : normalizedTone === "error" || normalizedTone === "warning" ? 7e3 : 5e3
      }
    })
  );
}
function classifyBannerElement(el) {
  if (!el || typeof el.matches !== "function") return null;
  if (el.closest(".seo-toast-viewport")) return null;
  if (el.matches("[data-no-toast='true']") || el.closest("[data-no-toast='true']")) return null;
  const customTone = el.getAttribute("data-toast");
  let tone = null;
  if (customTone && ["error", "warning", "success", "info"].includes(customTone)) {
    tone = customTone;
  } else if (el.classList.contains("error-box") || el.classList.contains("banner-bad") || el.classList.contains("sa-alert") && el.classList.contains("error")) {
    tone = "error";
  } else if (el.classList.contains("banner-warn")) {
    tone = "warning";
  } else if (el.classList.contains("banner-good") || el.classList.contains("sa-alert") && el.classList.contains("success")) {
    tone = "success";
  } else if (el.classList.contains("status-banner") || el.classList.contains("sa-alert")) {
    tone = "info";
  }
  if (!tone) return null;
  const text2 = compactText(el.textContent);
  if (!text2) return null;
  return {
    tone,
    title: el.getAttribute("data-toast-title") || DEFAULT_TITLES[tone],
    message: text2
  };
}
function SeoToastViewport() {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef(/* @__PURE__ */ new Map());
  const seenNodesRef = useRef(/* @__PURE__ */ new WeakMap());
  const dismissToast = useCallback((id) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);
  const scheduleDismiss = useCallback(
    (id, duration) => {
      const existing = timersRef.current.get(id);
      if (existing) clearTimeout(existing);
      const timer = setTimeout(() => {
        timersRef.current.delete(id);
        setToasts((prev) => prev.filter((item) => item.id !== id));
      }, duration);
      timersRef.current.set(id, timer);
    },
    []
  );
  const pauseDismiss = useCallback((id) => {
    const existing = timersRef.current.get(id);
    if (existing) {
      clearTimeout(existing);
      timersRef.current.delete(id);
    }
  }, []);
  useEffect(() => {
    if (typeof window === "undefined") return void 0;
    function handleToastEvent(event) {
      const detail = (event == null ? void 0 : event.detail) || {};
      const id = `toast-${++toastSequence}`;
      const duration = detail.duration || 5e3;
      setToasts((prev) => {
        const next = [
          ...prev,
          {
            id,
            title: detail.title || DEFAULT_TITLES.info,
            message: detail.message || "",
            tone: detail.tone || "info",
            duration
          }
        ];
        if (next.length > MAX_VISIBLE_TOASTS) {
          const evicted = next.slice(0, next.length - MAX_VISIBLE_TOASTS);
          for (const old of evicted) {
            const t = timersRef.current.get(old.id);
            if (t) {
              clearTimeout(t);
              timersRef.current.delete(old.id);
            }
          }
          return next.slice(-MAX_VISIBLE_TOASTS);
        }
        return next;
      });
      scheduleDismiss(id, duration);
    }
    window.addEventListener(TOAST_EVENT, handleToastEvent);
    const activeTimers = timersRef.current;
    const BANNER_SELECTOR = ".error-box, .status-banner, .sa-alert, [data-toast]";
    function inspectElement(node) {
      const info = classifyBannerElement(node);
      if (!info) return;
      const lastSeenText = seenNodesRef.current.get(node);
      if (lastSeenText === info.message) return;
      seenNodesRef.current.set(node, info.message);
      showToast(info);
    }
    function scanTree(root2) {
      var _a2, _b;
      if (!root2 || root2.nodeType !== 1) return;
      if ((_a2 = root2.matches) == null ? void 0 : _a2.call(root2, BANNER_SELECTOR)) inspectElement(root2);
      const nested = (_b = root2.querySelectorAll) == null ? void 0 : _b.call(root2, BANNER_SELECTOR);
      if (nested == null ? void 0 : nested.length) {
        nested.forEach((el) => inspectElement(el));
      }
    }
    scanTree(document.body);
    const observer = new MutationObserver((mutations) => {
      var _a2, _b, _c, _d, _e, _f;
      for (const mutation of mutations) {
        if (mutation.type === "childList") {
          mutation.addedNodes.forEach((added) => scanTree(added));
          if (((_a2 = mutation.target) == null ? void 0 : _a2.nodeType) === 1) {
            const ownerBanner = (_c = (_b = mutation.target).closest) == null ? void 0 : _c.call(_b, BANNER_SELECTOR);
            if (ownerBanner) inspectElement(ownerBanner);
          }
        } else if (mutation.type === "characterData" && ((_d = mutation.target) == null ? void 0 : _d.parentElement)) {
          const ownerBanner = (_f = (_e = mutation.target.parentElement).closest) == null ? void 0 : _f.call(_e, BANNER_SELECTOR);
          if (ownerBanner) inspectElement(ownerBanner);
        }
      }
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });
    return () => {
      window.removeEventListener(TOAST_EVENT, handleToastEvent);
      observer.disconnect();
      for (const timer of activeTimers.values()) clearTimeout(timer);
      activeTimers.clear();
    };
  }, [scheduleDismiss]);
  if (!toasts.length) return null;
  return /* @__PURE__ */ jsx("div", { className: "seo-toast-viewport", "aria-live": "polite", "aria-label": "Notifications", children: toasts.map((toast) => /* @__PURE__ */ jsxs(
    "div",
    {
      className: `seo-toast seo-toast-${toast.tone}`,
      role: toast.tone === "error" ? "alert" : "status",
      onMouseEnter: () => pauseDismiss(toast.id),
      onMouseLeave: () => scheduleDismiss(toast.id, Math.min(3500, toast.duration)),
      children: [
        /* @__PURE__ */ jsx("span", { className: "seo-toast-icon", "aria-hidden": "true", children: TONE_ICONS[toast.tone] || "i" }),
        /* @__PURE__ */ jsxs("div", { className: "seo-toast-body", children: [
          /* @__PURE__ */ jsx("strong", { className: "seo-toast-title", children: toast.title }),
          /* @__PURE__ */ jsx("p", { className: "seo-toast-message", children: toast.message })
        ] }),
        /* @__PURE__ */ jsx(
          "button",
          {
            type: "button",
            className: "seo-toast-close",
            onClick: () => dismissToast(toast.id),
            "aria-label": "Dismiss notification",
            children: "×"
          }
        )
      ]
    },
    toast.id
  )) });
}
const COOKIE_NAME = "ecomseo_superadmin";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1e3;
const FIXED_SUPERADMIN = Object.freeze({
  username: (process.env.SUPERADMIN_USERNAME || "ecomfixr").trim().toLowerCase(),
  name: "EcomFixr SuperAdmin",
  password: process.env.SUPERADMIN_PASSWORD || "ecomfixr@2026",
  role: "OWNER"
});
function normalizeIdentifier(value) {
  return String(value || "").trim().toLowerCase();
}
function isValidIdentifier(identifier) {
  return /^[a-z0-9._@+-]{3,100}$/.test(identifier);
}
function hashPassword(password) {
  const clean = String(password || "");
  if (clean.length < 8) {
    throw new Error("Password must be at least 8 characters long.");
  }
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(clean, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}
function verifyPassword(password, storedHash) {
  const clean = String(password || "");
  const parts = String(storedHash || "").split(":");
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  if (!salt || !keyHex) return false;
  try {
    const keyBuffer = Buffer.from(keyHex, "hex");
    const derived = crypto.scryptSync(clean, salt, 64);
    if (keyBuffer.length !== derived.length) return false;
    return crypto.timingSafeEqual(keyBuffer, derived);
  } catch {
    return false;
  }
}
function hashSessionToken(rawToken) {
  return crypto.createHash("sha256").update(String(rawToken || "")).digest("hex");
}
function parseCookies(cookieHeader) {
  const result = {};
  if (!cookieHeader) return result;
  for (const part of String(cookieHeader).split(";")) {
    const idx = part.indexOf("=");
    if (idx <= 0) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    try {
      result[key] = decodeURIComponent(val);
    } catch {
      result[key] = val;
    }
  }
  return result;
}
function buildCookieHeader(value, maxAgeSeconds, request, cookiePath = "/") {
  var _a2, _b, _c;
  const isHttps = ((_a2 = request == null ? void 0 : request.url) == null ? void 0 : _a2.startsWith("https://")) || ((_c = (_b = request == null ? void 0 : request.headers) == null ? void 0 : _b.get) == null ? void 0 : _c.call(_b, "x-forwarded-proto")) === "https";
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(value)}`,
    `Path=${cookiePath}`,
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAgeSeconds}`
  ];
  if (isHttps) {
    parts.push("Secure");
  }
  return parts.join("; ");
}
function sanitizeUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    isActive: user.isActive,
    isFixed: user.email === FIXED_SUPERADMIN.username,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt
  };
}
async function ensureFixedSuperAdmin() {
  const existing = await prisma.superAdminUser.findUnique({
    where: { email: FIXED_SUPERADMIN.username }
  });
  if (!existing) {
    const created = await prisma.superAdminUser.create({
      data: {
        email: FIXED_SUPERADMIN.username,
        name: FIXED_SUPERADMIN.name,
        passwordHash: hashPassword(FIXED_SUPERADMIN.password),
        role: FIXED_SUPERADMIN.role,
        isActive: true
      }
    });
    return sanitizeUser(created);
  }
  const needsSync = !existing.isActive || existing.role !== FIXED_SUPERADMIN.role || !verifyPassword(FIXED_SUPERADMIN.password, existing.passwordHash);
  if (needsSync) {
    const updated = await prisma.superAdminUser.update({
      where: { id: existing.id },
      data: {
        name: existing.name || FIXED_SUPERADMIN.name,
        role: FIXED_SUPERADMIN.role,
        isActive: true,
        passwordHash: hashPassword(FIXED_SUPERADMIN.password)
      }
    });
    return sanitizeUser(updated);
  }
  return sanitizeUser(existing);
}
async function authenticateSuperAdmin({ username, email, password }) {
  await ensureFixedSuperAdmin();
  const cleanIdentifier = normalizeIdentifier(username || email);
  if (!cleanIdentifier || !password) {
    throw new Error("Username and password are required.");
  }
  const user = await prisma.superAdminUser.findUnique({
    where: { email: cleanIdentifier }
  });
  if (!user || !verifyPassword(password, user.passwordHash)) {
    throw new Error("Invalid username or password.");
  }
  if (!user.isActive) {
    throw new Error("This SuperAdmin account has been disabled.");
  }
  return sanitizeUser(user);
}
async function createSuperAdminSession(userId, request) {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashSessionToken(rawToken);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await prisma.$transaction([
    prisma.superAdminSession.deleteMany({
      where: { expiresAt: { lte: /* @__PURE__ */ new Date() } }
    }),
    prisma.superAdminSession.create({
      data: {
        tokenHash,
        userId,
        expiresAt
      }
    }),
    prisma.superAdminUser.update({
      where: { id: userId },
      data: { lastLoginAt: /* @__PURE__ */ new Date() }
    })
  ]);
  return buildCookieHeader(rawToken, Math.floor(SESSION_TTL_MS / 1e3), request);
}
async function getAuthenticatedSuperAdmin(request) {
  var _a2;
  const cookies = parseCookies(request.headers.get("cookie"));
  const rawToken = cookies[COOKIE_NAME];
  if (!rawToken) return null;
  const tokenHash = hashSessionToken(rawToken);
  const session = await prisma.superAdminSession.findUnique({
    where: { tokenHash },
    include: { user: true }
  });
  if (!session || /* @__PURE__ */ new Date() >= new Date(session.expiresAt) || !((_a2 = session.user) == null ? void 0 : _a2.isActive)) {
    if (session) {
      await prisma.superAdminSession.delete({ where: { id: session.id } }).catch(() => {
      });
    }
    return null;
  }
  return sanitizeUser(session.user);
}
async function requireSuperAdmin(request) {
  const user = await getAuthenticatedSuperAdmin(request);
  if (!user) {
    throw redirect("/superadmin/login");
  }
  return user;
}
function getSuperAdminCookieMigrationHeaders(request) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/superadmin") || url.pathname.endsWith(".data")) {
    return [];
  }
  const cookies = parseCookies(request.headers.get("cookie"));
  const rawToken = cookies[COOKIE_NAME];
  if (!rawToken) return [];
  return [
    buildCookieHeader("", 0, request, "/superadmin"),
    buildCookieHeader(rawToken, Math.floor(SESSION_TTL_MS / 1e3), request, "/")
  ];
}
async function destroySuperAdminSession(request) {
  const cookies = parseCookies(request.headers.get("cookie"));
  const rawToken = cookies[COOKIE_NAME];
  if (rawToken) {
    const tokenHash = hashSessionToken(rawToken);
    await prisma.superAdminSession.deleteMany({ where: { tokenHash } }).catch(() => {
    });
  }
  return [
    buildCookieHeader("", 0, request, "/"),
    buildCookieHeader("", 0, request, "/superadmin")
  ];
}
async function listSuperAdminUsers() {
  await ensureFixedSuperAdmin();
  const users = await prisma.superAdminUser.findMany({
    orderBy: [{ role: "desc" }, { createdAt: "asc" }]
  });
  return users.map(sanitizeUser);
}
async function createSuperAdminUser({ name, username, email, password, role = "ADMIN" }) {
  const cleanName = String(name || "").trim();
  const cleanIdentifier = normalizeIdentifier(username || email);
  const normalizedRole = String(role || "ADMIN").toUpperCase() === "OWNER" ? "OWNER" : "ADMIN";
  if (!cleanName || cleanName.length < 2) {
    throw new Error("Name must be at least 2 characters.");
  }
  if (!isValidIdentifier(cleanIdentifier)) {
    throw new Error("Username or email must be 3-100 valid characters without spaces.");
  }
  const existing = await prisma.superAdminUser.findUnique({
    where: { email: cleanIdentifier }
  });
  if (existing) {
    throw new Error("An admin user with this username or email already exists.");
  }
  const passwordHash = hashPassword(password);
  const created = await prisma.superAdminUser.create({
    data: {
      name: cleanName,
      email: cleanIdentifier,
      passwordHash,
      role: normalizedRole,
      isActive: true
    }
  });
  return sanitizeUser(created);
}
async function toggleSuperAdminStatus({ targetUserId, actingUserId, isActive }) {
  if (targetUserId === actingUserId && !isActive) {
    throw new Error("You cannot disable your own currently signed-in account.");
  }
  const target = await prisma.superAdminUser.findUnique({ where: { id: targetUserId } });
  if (!target) {
    throw new Error("Admin user not found.");
  }
  if (target.email === FIXED_SUPERADMIN.username && !isActive) {
    throw new Error("The fixed primary SuperAdmin account cannot be disabled.");
  }
  const updated = await prisma.superAdminUser.update({
    where: { id: targetUserId },
    data: { isActive: Boolean(isActive) }
  });
  if (!isActive) {
    await prisma.superAdminSession.deleteMany({ where: { userId: targetUserId } });
  }
  return sanitizeUser(updated);
}
async function deleteSuperAdminUser({ targetUserId, actingUserId }) {
  if (targetUserId === actingUserId) {
    throw new Error("You cannot delete your own currently signed-in account.");
  }
  const target = await prisma.superAdminUser.findUnique({ where: { id: targetUserId } });
  if (!target) {
    throw new Error("Admin user not found.");
  }
  if (target.email === FIXED_SUPERADMIN.username) {
    throw new Error("The fixed primary SuperAdmin account cannot be deleted.");
  }
  if (target.role === "OWNER") {
    const ownerCount = await prisma.superAdminUser.count({
      where: { role: "OWNER", isActive: true }
    });
    if (ownerCount <= 1) {
      throw new Error("Cannot delete the last active OWNER account.");
    }
  }
  await prisma.superAdminUser.delete({ where: { id: targetUserId } });
  return { deleted: true };
}
const links$e = () => [{
  rel: "stylesheet",
  href: superadminStyles
}, {
  rel: "stylesheet",
  href: toastStyles
}];
const headers$2 = ({
  loaderHeaders
}) => loaderHeaders;
function buildCookieResponseHeaders(cookies) {
  const headers2 = new Headers();
  for (const cookie of cookies) {
    headers2.append("Set-Cookie", cookie);
  }
  return headers2;
}
const loader$l = async ({
  request
}) => {
  const url = new URL(request.url);
  if (url.pathname === "/superadmin/login") {
    return {
      isLoginRoute: true,
      user: null
    };
  }
  const user = await requireSuperAdmin(request);
  const migrationCookies = getSuperAdminCookieMigrationHeaders(request);
  if (migrationCookies.length > 0) {
    return data({
      isLoginRoute: false,
      user
    }, {
      headers: buildCookieResponseHeaders(migrationCookies)
    });
  }
  return {
    isLoginRoute: false,
    user
  };
};
const action$g = async ({
  request
}) => {
  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");
  if (intent === "logout") {
    const clearCookies = await destroySuperAdminSession(request);
    return redirect("/superadmin/login", {
      headers: buildCookieResponseHeaders(clearCookies)
    });
  }
  return null;
};
const superadmin = UNSAFE_withComponentProps(function SuperAdminLayout() {
  const {
    isLoginRoute,
    user
  } = useLoaderData();
  const location = useLocation();
  if (isLoginRoute) {
    return /* @__PURE__ */ jsxs(Fragment, {
      children: [/* @__PURE__ */ jsx(Outlet, {}), /* @__PURE__ */ jsx(SeoToastViewport, {})]
    });
  }
  const pathname = location.pathname;
  return /* @__PURE__ */ jsxs("div", {
    className: "sa-shell",
    children: [/* @__PURE__ */ jsx("header", {
      className: "sa-topbar",
      children: /* @__PURE__ */ jsxs("div", {
        className: "sa-topbar-inner",
        children: [/* @__PURE__ */ jsxs("div", {
          style: {
            display: "flex",
            alignItems: "center",
            gap: 20,
            flexWrap: "wrap"
          },
          children: [/* @__PURE__ */ jsxs(Link, {
            to: "/superadmin",
            className: "sa-brand",
            children: [/* @__PURE__ */ jsx("span", {
              children: "Ecom SEO"
            }), /* @__PURE__ */ jsx("span", {
              className: "sa-brand-badge",
              children: "SuperAdmin"
            })]
          }), /* @__PURE__ */ jsxs("nav", {
            className: "sa-nav",
            children: [/* @__PURE__ */ jsx(Link, {
              to: "/superadmin",
              className: `sa-nav-link ${pathname === "/superadmin" ? "active" : ""}`,
              children: "Stores & Access"
            }), /* @__PURE__ */ jsx(Link, {
              to: "/superadmin/ai",
              className: `sa-nav-link ${pathname === "/superadmin/ai" ? "active" : ""}`,
              children: "Global AI Credentials"
            }), /* @__PURE__ */ jsx(Link, {
              to: "/superadmin/users",
              className: `sa-nav-link ${pathname === "/superadmin/users" ? "active" : ""}`,
              children: "Admin Users"
            })]
          })]
        }), /* @__PURE__ */ jsxs("div", {
          className: "sa-user-bar",
          children: [/* @__PURE__ */ jsxs("span", {
            children: [/* @__PURE__ */ jsx("strong", {
              children: user == null ? void 0 : user.name
            }), " ", /* @__PURE__ */ jsxs("small", {
              style: {
                color: "#94a3b8"
              },
              children: ["(", user == null ? void 0 : user.role, ")"]
            })]
          }), /* @__PURE__ */ jsxs(Form, {
            method: "post",
            children: [/* @__PURE__ */ jsx("input", {
              type: "hidden",
              name: "intent",
              value: "logout"
            }), /* @__PURE__ */ jsx("button", {
              type: "submit",
              className: "sa-btn ghost-dark",
              children: "Sign Out"
            })]
          })]
        })]
      })
    }), /* @__PURE__ */ jsx("main", {
      className: "sa-main",
      children: /* @__PURE__ */ jsx(Outlet, {})
    }), /* @__PURE__ */ jsx(SeoToastViewport, {})]
  });
});
const route9 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$g,
  default: superadmin,
  headers: headers$2,
  links: links$e,
  loader: loader$l
}, Symbol.toStringTag, { value: "Module" }));
const loader$k = async ({
  request
}) => {
  await requireSuperAdmin(request);
  const stores = await listAllManagedStores();
  return {
    stores,
    features: PLATFORM_FEATURES
  };
};
const action$f = async ({
  request
}) => {
  const adminUser = await requireSuperAdmin(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");
  const shop = String(formData.get("shop") || "").trim().toLowerCase();
  try {
    if (intent === "provisionStore") {
      if (!shop || !shop.includes(".")) {
        return {
          ok: false,
          error: "Enter a valid store domain (e.g. my-store.myshopify.com)."
        };
      }
      const accessLevel = String(formData.get("accessLevel") || "FULL");
      const superAccess = formData.get("superAccess") === "on";
      const shopifyAccessToken = String(formData.get("shopifyAccessToken") || "").trim();
      await getOrCreateStoreControl(shop);
      await updateStoreControl({
        shop,
        accessLevel,
        superAccess,
        allowedFeatures: ALL_FEATURE_KEYS,
        updatedBy: adminUser.email
      });
      await getOrCreateCreditAccount(shop, superAccess ? "PRO" : "FREE");
      if (shopifyAccessToken) {
        await updateStoreTokens({
          shop,
          shopifyAccessToken
        });
      }
      return {
        ok: true,
        message: `Store "${shop}" provisioned and configured.`
      };
    }
    if (!shop) {
      return {
        ok: false,
        error: "Shop domain is required."
      };
    }
    if (intent === "updateAccess") {
      const accessLevel = String(formData.get("accessLevel") || "FULL");
      const superAccess = formData.get("superAccess") === "on";
      const allowedFeatures = formData.getAll("allowedFeatures").map(String);
      const notes = String(formData.get("notes") || "");
      await updateStoreControl({
        shop,
        accessLevel,
        superAccess,
        allowedFeatures,
        notes,
        updatedBy: adminUser.email
      });
      return {
        ok: true,
        shop,
        message: `Access updated for ${shop} (${accessLevel}${superAccess ? " + Super Access" : ""}).`
      };
    }
    if (intent === "updateTokens") {
      const creditPlan = String(formData.get("creditPlan") || "FREE");
      const totalCredits = formData.get("totalCredits");
      const bonusCredits = formData.get("bonusCredits");
      const resetUsedCredits = formData.get("resetUsedCredits") === "on";
      const shopifyAccessToken = String(formData.get("shopifyAccessToken") || "");
      const shopifyScopes = String(formData.get("shopifyScopes") || "");
      const updatedAccount = await updateStoreTokens({
        shop,
        creditPlan,
        totalCredits,
        bonusCredits,
        resetUsedCredits,
        shopifyAccessToken,
        shopifyScopes
      });
      return {
        ok: true,
        intent: "updateTokens",
        shop,
        updatedCredits: {
          plan: updatedAccount.plan,
          totalCredits: updatedAccount.totalCredits,
          bonusCredits: updatedAccount.bonusCredits,
          usedCredits: updatedAccount.usedCredits,
          availableCredits: updatedAccount.availableCredits,
          effectiveTotal: updatedAccount.effectiveTotal
        },
        message: `Updated ${shop}: ${updatedAccount.plan} plan · ${updatedAccount.availableCredits}/${updatedAccount.effectiveTotal} credits available.`
      };
    }
    return {
      ok: false,
      error: "Unsupported action intent."
    };
  } catch (error) {
    return {
      ok: false,
      error: (error == null ? void 0 : error.message) || "Failed to update store configuration."
    };
  }
};
const superadmin__index = UNSAFE_withComponentProps(function SuperAdminStoresPage() {
  var _a2;
  const {
    stores,
    features
  } = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [expandedShop, setExpandedShop] = useState(((_a2 = stores[0]) == null ? void 0 : _a2.shop) || "");
  const [showAddStore, setShowAddStore] = useState(false);
  const summary = useMemo(() => {
    return {
      total: stores.length,
      full: stores.filter((s) => s.control.accessLevel === "FULL").length,
      partial: stores.filter((s) => s.control.accessLevel === "PARTIAL").length,
      superAccess: stores.filter((s) => s.control.superAccess).length,
      totalAiCalls: stores.reduce((sum, s) => {
        var _a3;
        return sum + (((_a3 = s.stats) == null ? void 0 : _a3.totalAiCalls) || 0);
      }, 0)
    };
  }, [stores]);
  const filteredStores = useMemo(() => {
    const q = search.trim().toLowerCase();
    return stores.filter((store) => {
      if (q && !store.shop.toLowerCase().includes(q)) return false;
      if (filter === "SUPER") return store.control.superAccess;
      if (filter !== "ALL") return store.control.accessLevel === filter;
      return true;
    });
  }, [stores, search, filter]);
  return /* @__PURE__ */ jsxs("div", {
    className: "sa-grid",
    children: [(actionData == null ? void 0 : actionData.error) ? /* @__PURE__ */ jsx("div", {
      className: "sa-alert error",
      children: actionData.error
    }) : null, (actionData == null ? void 0 : actionData.ok) && (actionData == null ? void 0 : actionData.message) ? /* @__PURE__ */ jsx("div", {
      className: "sa-alert success",
      children: actionData.message
    }) : null, /* @__PURE__ */ jsxs("div", {
      className: "sa-grid-5",
      children: [/* @__PURE__ */ jsxs("div", {
        className: "sa-kpi",
        children: [/* @__PURE__ */ jsx("p", {
          className: "sa-kpi-label",
          children: "Total Stores"
        }), /* @__PURE__ */ jsx("p", {
          className: "sa-kpi-value",
          children: summary.total
        })]
      }), /* @__PURE__ */ jsxs("div", {
        className: "sa-kpi",
        children: [/* @__PURE__ */ jsx("p", {
          className: "sa-kpi-label",
          children: "Full Access"
        }), /* @__PURE__ */ jsx("p", {
          className: "sa-kpi-value",
          style: {
            color: "var(--sa-good)"
          },
          children: summary.full
        })]
      }), /* @__PURE__ */ jsxs("div", {
        className: "sa-kpi",
        children: [/* @__PURE__ */ jsx("p", {
          className: "sa-kpi-label",
          children: "Partial Access"
        }), /* @__PURE__ */ jsx("p", {
          className: "sa-kpi-value",
          style: {
            color: "var(--sa-warn)"
          },
          children: summary.partial
        })]
      }), /* @__PURE__ */ jsxs("div", {
        className: "sa-kpi",
        children: [/* @__PURE__ */ jsx("p", {
          className: "sa-kpi-label",
          children: "Super Access"
        }), /* @__PURE__ */ jsx("p", {
          className: "sa-kpi-value",
          style: {
            color: "var(--sa-super)"
          },
          children: summary.superAccess
        })]
      }), /* @__PURE__ */ jsxs("div", {
        className: "sa-kpi",
        children: [/* @__PURE__ */ jsx("p", {
          className: "sa-kpi-label",
          children: "Total AI Requests"
        }), /* @__PURE__ */ jsx("p", {
          className: "sa-kpi-value",
          style: {
            color: "var(--sa-primary)"
          },
          children: summary.totalAiCalls
        })]
      })]
    }), /* @__PURE__ */ jsxs("div", {
      className: "sa-card sa-grid",
      children: [/* @__PURE__ */ jsxs("div", {
        style: {
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap"
        },
        children: [/* @__PURE__ */ jsxs("div", {
          style: {
            display: "flex",
            gap: 10,
            alignItems: "center",
            flexWrap: "wrap",
            flex: 1
          },
          children: [/* @__PURE__ */ jsx("input", {
            type: "search",
            className: "sa-input",
            placeholder: "Search store domain (e.g. mystore.myshopify.com)...",
            value: search,
            onChange: (e) => setSearch(e.target.value),
            style: {
              maxWidth: 320
            }
          }), /* @__PURE__ */ jsx("div", {
            style: {
              display: "flex",
              gap: 6,
              flexWrap: "wrap"
            },
            children: ["ALL", "FULL", "PARTIAL", "SUSPENDED", "SUPER"].map((key) => /* @__PURE__ */ jsx("button", {
              type: "button",
              className: `sa-btn ${filter === key ? "" : "secondary"}`,
              style: {
                padding: "6px 12px",
                fontSize: 12
              },
              onClick: () => setFilter(key),
              children: key
            }, key))
          })]
        }), /* @__PURE__ */ jsx("button", {
          type: "button",
          className: "sa-btn secondary",
          onClick: () => setShowAddStore((v) => !v),
          children: showAddStore ? "Close" : "+ Provision Store"
        })]
      }), showAddStore ? /* @__PURE__ */ jsxs(Form, {
        method: "post",
        action: "/superadmin?index",
        style: {
          padding: 16,
          background: "#f8fafc",
          borderRadius: 10,
          border: "1px solid var(--sa-border-soft)",
          display: "grid",
          gap: 12
        },
        children: [/* @__PURE__ */ jsx("input", {
          type: "hidden",
          name: "intent",
          value: "provisionStore"
        }), /* @__PURE__ */ jsx("h4", {
          style: {
            margin: 0
          },
          children: "Pre-Provision / Add Store"
        }), /* @__PURE__ */ jsxs("div", {
          className: "sa-grid-3",
          children: [/* @__PURE__ */ jsxs("div", {
            className: "sa-field",
            children: [/* @__PURE__ */ jsx("label", {
              children: "Store Domain"
            }), /* @__PURE__ */ jsx("input", {
              name: "shop",
              required: true,
              placeholder: "store-name.myshopify.com",
              className: "sa-input"
            })]
          }), /* @__PURE__ */ jsxs("div", {
            className: "sa-field",
            children: [/* @__PURE__ */ jsx("label", {
              children: "Initial Access Level"
            }), /* @__PURE__ */ jsxs("select", {
              name: "accessLevel",
              className: "sa-select",
              defaultValue: "FULL",
              children: [/* @__PURE__ */ jsx("option", {
                value: "FULL",
                children: "Full Access"
              }), /* @__PURE__ */ jsx("option", {
                value: "PARTIAL",
                children: "Partial Access"
              }), /* @__PURE__ */ jsx("option", {
                value: "SUSPENDED",
                children: "Suspended"
              })]
            })]
          }), /* @__PURE__ */ jsxs("div", {
            className: "sa-field",
            children: [/* @__PURE__ */ jsx("label", {
              children: "Optional Admin Token (shpat_...)"
            }), /* @__PURE__ */ jsx("input", {
              name: "shopifyAccessToken",
              type: "password",
              placeholder: "shpat_...",
              className: "sa-input"
            })]
          })]
        }), /* @__PURE__ */ jsxs("div", {
          style: {
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 10
          },
          children: [/* @__PURE__ */ jsxs("label", {
            style: {
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 13
            },
            children: [/* @__PURE__ */ jsx("input", {
              type: "checkbox",
              name: "superAccess"
            }), /* @__PURE__ */ jsx("span", {
              children: "Grant Super Access (Pro override + Unlimited AI)"
            })]
          }), /* @__PURE__ */ jsx("button", {
            type: "submit",
            className: "sa-btn",
            disabled: isSubmitting,
            children: "Save Store"
          })]
        })]
      }) : null]
    }), /* @__PURE__ */ jsx("div", {
      className: "sa-card",
      style: {
        padding: 0,
        overflow: "hidden"
      },
      children: !filteredStores.length ? /* @__PURE__ */ jsx("div", {
        style: {
          padding: 32,
          textAlign: "center",
          color: "var(--sa-muted)"
        },
        children: "No matching stores found. Stores appear automatically once installed or provisioned."
      }) : /* @__PURE__ */ jsx("div", {
        className: "sa-table-wrap",
        children: /* @__PURE__ */ jsxs("table", {
          className: "sa-table",
          children: [/* @__PURE__ */ jsx("thead", {
            children: /* @__PURE__ */ jsxs("tr", {
              children: [/* @__PURE__ */ jsx("th", {
                children: "Store Domain"
              }), /* @__PURE__ */ jsx("th", {
                children: "Shopify Token"
              }), /* @__PURE__ */ jsx("th", {
                children: "Access Level"
              }), /* @__PURE__ */ jsx("th", {
                children: "Super Access"
              }), /* @__PURE__ */ jsx("th", {
                children: "AI Credits & Plan"
              }), /* @__PURE__ */ jsx("th", {
                children: "SEO Score"
              }), /* @__PURE__ */ jsx("th", {
                children: "Manage"
              })]
            })
          }), /* @__PURE__ */ jsx("tbody", {
            children: filteredStores.map((store) => {
              const isExpanded = expandedShop === store.shop;
              const levelTone = store.control.accessLevel === "FULL" ? "good" : store.control.accessLevel === "PARTIAL" ? "warn" : "bad";
              return /* @__PURE__ */ jsx(StoreRowBlock, {
                store,
                features,
                levelTone,
                isExpanded,
                onToggle: () => setExpandedShop(isExpanded ? "" : store.shop)
              }, store.shop);
            })
          })]
        })
      })
    })]
  });
});
function StoreRowBlock({
  store,
  features,
  levelTone,
  isExpanded,
  onToggle
}) {
  var _a2, _b, _c, _d, _e, _f, _g, _h;
  const accessFetcher = useFetcher();
  const tokensFetcher = useFetcher();
  const [accessLevel, setAccessLevel] = useState(store.control.accessLevel);
  const [superAccess, setSuperAccess] = useState(Boolean(store.control.superAccess));
  const [notes, setNotes] = useState(store.control.notes || "");
  const [selectedFeatures, setSelectedFeatures] = useState(() => new Set(store.control.allowedFeatures || features.map((f) => f.key)));
  const [creditPlan, setCreditPlan] = useState(store.credits.plan || "FREE");
  const [totalCredits, setTotalCredits] = useState(String(store.credits.totalCredits ?? PLAN_ALLOWANCES.FREE));
  const [bonusCredits, setBonusCredits] = useState(String(store.credits.bonusCredits ?? 0));
  const [resetUsedCredits, setResetUsedCredits] = useState(false);
  const [shopifyAccessToken, setShopifyAccessToken] = useState("");
  const [shopifyScopes, setShopifyScopes] = useState(store.sessionStatus.scopes || "");
  useEffect(() => {
    setAccessLevel(store.control.accessLevel);
    setSuperAccess(Boolean(store.control.superAccess));
    setNotes(store.control.notes || "");
    setSelectedFeatures(new Set(store.control.allowedFeatures || features.map((f) => f.key)));
  }, [store.control, features]);
  useEffect(() => {
    setCreditPlan(store.credits.plan || "FREE");
    setTotalCredits(String(store.credits.totalCredits ?? PLAN_ALLOWANCES.FREE));
    setBonusCredits(String(store.credits.bonusCredits ?? 0));
    setShopifyScopes(store.sessionStatus.scopes || "");
  }, [store.credits, store.sessionStatus.scopes]);
  useEffect(() => {
    var _a3, _b2;
    if (tokensFetcher.state === "idle" && ((_a3 = tokensFetcher.data) == null ? void 0 : _a3.ok) && ((_b2 = tokensFetcher.data) == null ? void 0 : _b2.intent) === "updateTokens") {
      setResetUsedCredits(false);
      setShopifyAccessToken("");
    }
  }, [tokensFetcher.state, tokensFetcher.data]);
  function handlePlanChange(nextPlan) {
    setCreditPlan(nextPlan);
    if (nextPlan === "PRO" && (totalCredits === String(PLAN_ALLOWANCES.FREE) || totalCredits === "")) {
      setTotalCredits(String(PLAN_ALLOWANCES.PRO));
    } else if (nextPlan === "FREE" && totalCredits === String(PLAN_ALLOWANCES.PRO)) {
      setTotalCredits(String(PLAN_ALLOWANCES.FREE));
    }
  }
  function toggleFeature(key) {
    setSelectedFeatures((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }
  const isSavingAccess = accessFetcher.state !== "idle";
  const isSavingTokens = tokensFetcher.state !== "idle";
  return /* @__PURE__ */ jsxs(Fragment, {
    children: [/* @__PURE__ */ jsxs("tr", {
      children: [/* @__PURE__ */ jsxs("td", {
        children: [/* @__PURE__ */ jsx("strong", {
          children: store.shop
        }), /* @__PURE__ */ jsxs("div", {
          style: {
            fontSize: 11.5,
            color: "var(--sa-muted)",
            marginTop: 2
          },
          children: [store.stats.totalRevisions, " revisions • ", store.stats.totalAiCalls, " AI calls"]
        })]
      }), /* @__PURE__ */ jsx("td", {
        children: store.sessionStatus.connected ? /* @__PURE__ */ jsxs("div", {
          children: [/* @__PURE__ */ jsx("span", {
            className: "sa-pill good",
            children: "Connected"
          }), /* @__PURE__ */ jsx("div", {
            style: {
              fontSize: 11,
              color: "var(--sa-muted)",
              marginTop: 3
            },
            children: /* @__PURE__ */ jsx("code", {
              children: store.sessionStatus.maskedToken
            })
          })]
        }) : /* @__PURE__ */ jsx("span", {
          className: "sa-pill bad",
          children: "No Token"
        })
      }), /* @__PURE__ */ jsxs("td", {
        children: [/* @__PURE__ */ jsx("span", {
          className: `sa-pill ${levelTone}`,
          children: store.control.accessLevel
        }), store.control.accessLevel === "PARTIAL" ? /* @__PURE__ */ jsxs("div", {
          style: {
            fontSize: 11,
            color: "var(--sa-muted)",
            marginTop: 3
          },
          children: [store.control.allowedFeatures.length, "/", features.length, " modules"]
        }) : null]
      }), /* @__PURE__ */ jsx("td", {
        children: store.control.superAccess ? /* @__PURE__ */ jsx("span", {
          className: "sa-pill super",
          children: "★ Super Access"
        }) : /* @__PURE__ */ jsx("span", {
          style: {
            color: "var(--sa-muted)",
            fontSize: 12
          },
          children: "Standard"
        })
      }), /* @__PURE__ */ jsxs("td", {
        children: [/* @__PURE__ */ jsx("strong", {
          children: store.credits.availableCredits
        }), " ", /* @__PURE__ */ jsxs("span", {
          style: {
            color: "var(--sa-muted)",
            fontSize: 12
          },
          children: ["/ ", store.credits.effectiveTotal]
        }), store.credits.bonusCredits > 0 ? /* @__PURE__ */ jsxs("div", {
          style: {
            fontSize: 11,
            color: "var(--sa-good)"
          },
          children: ["+", store.credits.bonusCredits, " bonus"]
        }) : null, /* @__PURE__ */ jsx("div", {
          style: {
            marginTop: 3
          },
          children: /* @__PURE__ */ jsx("span", {
            className: `sa-pill ${store.credits.plan === "PRO" ? "good" : "info"}`,
            children: store.credits.plan
          })
        })]
      }), /* @__PURE__ */ jsx("td", {
        children: ((_a2 = store.lastScan) == null ? void 0 : _a2.score) !== null && ((_b = store.lastScan) == null ? void 0 : _b.score) !== void 0 ? /* @__PURE__ */ jsxs("div", {
          children: [/* @__PURE__ */ jsxs("strong", {
            children: [store.lastScan.score, "/100"]
          }), /* @__PURE__ */ jsxs("div", {
            style: {
              fontSize: 11,
              color: "var(--sa-muted)"
            },
            children: [store.lastScan.pagesScanned, " pages"]
          })]
        }) : /* @__PURE__ */ jsx("span", {
          style: {
            color: "var(--sa-muted)",
            fontSize: 12
          },
          children: "No scan"
        })
      }), /* @__PURE__ */ jsx("td", {
        children: /* @__PURE__ */ jsx("button", {
          type: "button",
          className: "sa-btn secondary",
          style: {
            padding: "6px 12px",
            fontSize: 12
          },
          onClick: onToggle,
          children: isExpanded ? "Close" : "Manage"
        })
      })]
    }), isExpanded ? /* @__PURE__ */ jsx("tr", {
      children: /* @__PURE__ */ jsx("td", {
        colSpan: 7,
        style: {
          padding: 0
        },
        children: /* @__PURE__ */ jsx("div", {
          className: "sa-store-drawer",
          children: /* @__PURE__ */ jsxs("div", {
            className: "sa-grid-2",
            children: [/* @__PURE__ */ jsxs(accessFetcher.Form, {
              method: "post",
              action: "/superadmin?index",
              className: "sa-card sa-grid",
              style: {
                boxShadow: "none"
              },
              children: [/* @__PURE__ */ jsx("input", {
                type: "hidden",
                name: "intent",
                value: "updateAccess"
              }), /* @__PURE__ */ jsx("input", {
                type: "hidden",
                name: "shop",
                value: store.shop
              }), /* @__PURE__ */ jsxs("div", {
                style: {
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center"
                },
                children: [/* @__PURE__ */ jsx("h4", {
                  style: {
                    margin: 0
                  },
                  children: "Access & Permissions"
                }), store.control.updatedBy ? /* @__PURE__ */ jsxs("small", {
                  style: {
                    color: "var(--sa-muted)"
                  },
                  children: ["Updated by ", store.control.updatedBy]
                }) : null]
              }), ((_c = accessFetcher.data) == null ? void 0 : _c.error) ? /* @__PURE__ */ jsx("div", {
                className: "sa-alert error",
                children: accessFetcher.data.error
              }) : null, ((_d = accessFetcher.data) == null ? void 0 : _d.ok) && ((_e = accessFetcher.data) == null ? void 0 : _e.message) ? /* @__PURE__ */ jsx("div", {
                className: "sa-alert success",
                children: accessFetcher.data.message
              }) : null, /* @__PURE__ */ jsxs("div", {
                className: "sa-field",
                children: [/* @__PURE__ */ jsx("label", {
                  children: "Access Level"
                }), /* @__PURE__ */ jsxs("select", {
                  name: "accessLevel",
                  className: "sa-select",
                  value: accessLevel,
                  onChange: (e) => setAccessLevel(e.target.value),
                  children: [/* @__PURE__ */ jsx("option", {
                    value: "FULL",
                    children: "Full Access (All Modules Enabled)"
                  }), /* @__PURE__ */ jsx("option", {
                    value: "PARTIAL",
                    children: "Partial Access (Selected Modules Only)"
                  }), /* @__PURE__ */ jsx("option", {
                    value: "SUSPENDED",
                    children: "Suspended (Lock App Access)"
                  })]
                })]
              }), /* @__PURE__ */ jsxs("label", {
                className: "sa-checkbox-card",
                style: {
                  borderColor: "#ddd6fe",
                  background: "#faf5ff"
                },
                children: [/* @__PURE__ */ jsx("input", {
                  type: "checkbox",
                  name: "superAccess",
                  checked: superAccess,
                  onChange: (e) => setSuperAccess(e.target.checked)
                }), /* @__PURE__ */ jsxs("span", {
                  children: [/* @__PURE__ */ jsx("strong", {
                    style: {
                      color: "var(--sa-super)"
                    },
                    children: "Allow Super Access"
                  }), " — Bypass billing paywall, unlock Pro features & unlimited AI"]
                })]
              }), accessLevel === "PARTIAL" ? /* @__PURE__ */ jsxs("div", {
                className: "sa-field",
                children: [/* @__PURE__ */ jsx("label", {
                  children: "Allowed Modules (Partial Access)"
                }), /* @__PURE__ */ jsx("div", {
                  className: "sa-feature-grid",
                  children: features.map((feat) => /* @__PURE__ */ jsxs("label", {
                    className: "sa-checkbox-card",
                    children: [/* @__PURE__ */ jsx("input", {
                      type: "checkbox",
                      name: "allowedFeatures",
                      value: feat.key,
                      checked: selectedFeatures.has(feat.key),
                      onChange: () => toggleFeature(feat.key)
                    }), /* @__PURE__ */ jsx("span", {
                      children: feat.label
                    })]
                  }, feat.key))
                })]
              }) : Array.from(selectedFeatures).map((k) => /* @__PURE__ */ jsx("input", {
                type: "hidden",
                name: "allowedFeatures",
                value: k
              }, k)), /* @__PURE__ */ jsxs("div", {
                className: "sa-field",
                children: [/* @__PURE__ */ jsx("label", {
                  children: "Admin Notes (Internal Only)"
                }), /* @__PURE__ */ jsx("textarea", {
                  name: "notes",
                  rows: 2,
                  className: "sa-textarea",
                  value: notes,
                  onChange: (e) => setNotes(e.target.value),
                  placeholder: "Notes about this merchant's plan or permissions..."
                })]
              }), /* @__PURE__ */ jsx("button", {
                type: "submit",
                className: "sa-btn",
                disabled: isSavingAccess,
                children: isSavingAccess ? "Saving Access..." : "Save Access Settings"
              })]
            }), /* @__PURE__ */ jsxs(tokensFetcher.Form, {
              method: "post",
              action: "/superadmin?index",
              className: "sa-card sa-grid",
              style: {
                boxShadow: "none"
              },
              children: [/* @__PURE__ */ jsx("input", {
                type: "hidden",
                name: "intent",
                value: "updateTokens"
              }), /* @__PURE__ */ jsx("input", {
                type: "hidden",
                name: "shop",
                value: store.shop
              }), /* @__PURE__ */ jsxs("div", {
                style: {
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 8,
                  flexWrap: "wrap"
                },
                children: [/* @__PURE__ */ jsx("h4", {
                  style: {
                    margin: 0
                  },
                  children: "Update Tokens & Quotas"
                }), /* @__PURE__ */ jsxs("small", {
                  style: {
                    color: "var(--sa-muted)"
                  },
                  children: ["Available: ", /* @__PURE__ */ jsx("strong", {
                    children: store.credits.availableCredits
                  }), " / ", store.credits.effectiveTotal]
                })]
              }), ((_f = tokensFetcher.data) == null ? void 0 : _f.error) ? /* @__PURE__ */ jsx("div", {
                className: "sa-alert error",
                children: tokensFetcher.data.error
              }) : null, ((_g = tokensFetcher.data) == null ? void 0 : _g.ok) && ((_h = tokensFetcher.data) == null ? void 0 : _h.message) ? /* @__PURE__ */ jsx("div", {
                className: "sa-alert success",
                children: tokensFetcher.data.message
              }) : null, /* @__PURE__ */ jsxs("div", {
                className: "sa-grid-3",
                children: [/* @__PURE__ */ jsxs("div", {
                  className: "sa-field",
                  children: [/* @__PURE__ */ jsx("label", {
                    children: "Credit Plan"
                  }), /* @__PURE__ */ jsxs("select", {
                    name: "creditPlan",
                    className: "sa-select",
                    value: creditPlan,
                    onChange: (e) => handlePlanChange(e.target.value),
                    children: [/* @__PURE__ */ jsx("option", {
                      value: "FREE",
                      children: "FREE"
                    }), /* @__PURE__ */ jsx("option", {
                      value: "PRO",
                      children: "PRO"
                    })]
                  })]
                }), /* @__PURE__ */ jsxs("div", {
                  className: "sa-field",
                  children: [/* @__PURE__ */ jsx("label", {
                    children: "Monthly Quota"
                  }), /* @__PURE__ */ jsx("input", {
                    name: "totalCredits",
                    type: "number",
                    min: 0,
                    className: "sa-input",
                    value: totalCredits,
                    onChange: (e) => setTotalCredits(e.target.value)
                  })]
                }), /* @__PURE__ */ jsxs("div", {
                  className: "sa-field",
                  children: [/* @__PURE__ */ jsx("label", {
                    children: "Bonus Credits"
                  }), /* @__PURE__ */ jsx("input", {
                    name: "bonusCredits",
                    type: "number",
                    min: 0,
                    className: "sa-input",
                    value: bonusCredits,
                    onChange: (e) => setBonusCredits(e.target.value)
                  })]
                })]
              }), /* @__PURE__ */ jsxs("label", {
                className: "sa-checkbox-card",
                children: [/* @__PURE__ */ jsx("input", {
                  type: "checkbox",
                  name: "resetUsedCredits",
                  checked: resetUsedCredits,
                  onChange: (e) => setResetUsedCredits(e.target.checked)
                }), /* @__PURE__ */ jsxs("span", {
                  children: ["Reset cycle used credits to 0 (currently used: ", /* @__PURE__ */ jsx("strong", {
                    children: store.credits.usedCredits
                  }), ")"]
                })]
              }), /* @__PURE__ */ jsx("hr", {
                style: {
                  border: 0,
                  borderTop: "1px solid var(--sa-border-soft)",
                  margin: "2px 0"
                }
              }), /* @__PURE__ */ jsxs("div", {
                className: "sa-field",
                children: [/* @__PURE__ */ jsxs("label", {
                  children: ["Rotate / Update Shopify Offline Access Token", " ", store.sessionStatus.maskedToken ? `(${store.sessionStatus.maskedToken})` : ""]
                }), /* @__PURE__ */ jsx("input", {
                  name: "shopifyAccessToken",
                  type: "password",
                  autoComplete: "new-password",
                  value: shopifyAccessToken,
                  onChange: (e) => setShopifyAccessToken(e.target.value),
                  placeholder: "Leave blank to keep existing token, or paste shpat_...",
                  className: "sa-input"
                })]
              }), /* @__PURE__ */ jsxs("div", {
                className: "sa-field",
                children: [/* @__PURE__ */ jsx("label", {
                  children: "Shopify Scopes (Optional Override)"
                }), /* @__PURE__ */ jsx("input", {
                  name: "shopifyScopes",
                  type: "text",
                  value: shopifyScopes,
                  onChange: (e) => setShopifyScopes(e.target.value),
                  placeholder: "write_products,write_metaobjects...",
                  className: "sa-input"
                })]
              }), /* @__PURE__ */ jsx("button", {
                type: "submit",
                className: "sa-btn",
                disabled: isSavingTokens,
                children: isSavingTokens ? "Updating Tokens & Credits..." : "Update Tokens & Credits"
              })]
            })]
          })
        })
      })
    }) : null]
  });
}
const route10 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$f,
  default: superadmin__index,
  loader: loader$k
}, Symbol.toStringTag, { value: "Module" }));
const links$d = () => [{
  rel: "stylesheet",
  href: superadminStyles
}];
const loader$j = async ({
  request
}) => {
  await ensureFixedSuperAdmin();
  const currentUser = await getAuthenticatedSuperAdmin(request);
  if (currentUser) {
    throw redirect("/superadmin");
  }
  return {};
};
const action$e = async ({
  request
}) => {
  const formData = await request.formData();
  const username = String(formData.get("username") || "");
  const password = String(formData.get("password") || "");
  try {
    const user = await authenticateSuperAdmin({
      username,
      password
    });
    const cookie = await createSuperAdminSession(user.id, request);
    return redirect("/superadmin", {
      headers: {
        "Set-Cookie": cookie
      }
    });
  } catch (error) {
    return {
      ok: false,
      error: (error == null ? void 0 : error.message) || "Authentication failed."
    };
  }
};
const superadmin_login = UNSAFE_withComponentProps(function SuperAdminLoginPage() {
  const actionData = useActionData();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  return /* @__PURE__ */ jsx("div", {
    className: "sa-auth-page",
    children: /* @__PURE__ */ jsxs("div", {
      className: "sa-auth-card",
      children: [/* @__PURE__ */ jsxs("div", {
        children: [/* @__PURE__ */ jsx("span", {
          className: "sa-pill super",
          style: {
            marginBottom: 10
          },
          children: "Restricted Control Plane"
        }), /* @__PURE__ */ jsx("h1", {
          style: {
            margin: "6px 0 4px",
            fontSize: 24,
            fontFamily: "Space Grotesk, sans-serif"
          },
          children: "SuperAdmin Sign In"
        }), /* @__PURE__ */ jsx("p", {
          style: {
            margin: 0,
            fontSize: 13.5,
            color: "#475569"
          },
          children: "Sign in to manage Shopify stores, feature access, tokens, and shared Gemini AI credentials."
        })]
      }), (actionData == null ? void 0 : actionData.error) ? /* @__PURE__ */ jsx("div", {
        className: "sa-alert error",
        children: actionData.error
      }) : null, /* @__PURE__ */ jsxs(Form, {
        method: "post",
        className: "sa-grid",
        children: [/* @__PURE__ */ jsxs("div", {
          className: "sa-field",
          children: [/* @__PURE__ */ jsx("label", {
            htmlFor: "sa-username",
            children: "Username or Email"
          }), /* @__PURE__ */ jsx("input", {
            id: "sa-username",
            name: "username",
            type: "text",
            required: true,
            autoComplete: "username",
            className: "sa-input"
          })]
        }), /* @__PURE__ */ jsxs("div", {
          className: "sa-field",
          children: [/* @__PURE__ */ jsx("label", {
            htmlFor: "sa-password",
            children: "Password"
          }), /* @__PURE__ */ jsx("input", {
            id: "sa-password",
            name: "password",
            type: "password",
            required: true,
            autoComplete: "current-password",
            placeholder: "Enter password",
            className: "sa-input"
          })]
        }), /* @__PURE__ */ jsx("button", {
          type: "submit",
          className: "sa-btn",
          style: {
            width: "100%",
            padding: "12px",
            fontSize: 14
          },
          disabled: isSubmitting,
          children: isSubmitting ? "Signing In..." : "Sign In to SuperAdmin"
        })]
      })]
    })
  });
});
const route11 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$e,
  default: superadmin_login,
  links: links$d,
  loader: loader$j
}, Symbol.toStringTag, { value: "Module" }));
const loader$i = async ({
  request
}) => {
  const currentUser = await requireSuperAdmin(request);
  const users = await listSuperAdminUsers();
  return {
    currentUser,
    users
  };
};
const action$d = async ({
  request
}) => {
  const actingUser = await requireSuperAdmin(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");
  try {
    if (intent === "createUser") {
      const name = String(formData.get("name") || "");
      const username = String(formData.get("username") || formData.get("email") || "");
      const password = String(formData.get("password") || "");
      const role = String(formData.get("role") || "ADMIN");
      const created = await createSuperAdminUser({
        name,
        username,
        password,
        role
      });
      return {
        ok: true,
        message: `Created new ${created.role} user: ${created.email}`
      };
    }
    if (intent === "toggleStatus") {
      const targetUserId = String(formData.get("targetUserId") || "");
      const nextActive = formData.get("nextActive") === "true";
      const updated = await toggleSuperAdminStatus({
        targetUserId,
        actingUserId: actingUser.id,
        isActive: nextActive
      });
      return {
        ok: true,
        message: `${updated.email} is now ${updated.isActive ? "Active" : "Disabled"}.`
      };
    }
    if (intent === "deleteUser") {
      const targetUserId = String(formData.get("targetUserId") || "");
      await deleteSuperAdminUser({
        targetUserId,
        actingUserId: actingUser.id
      });
      return {
        ok: true,
        message: "Admin user removed."
      };
    }
    return {
      ok: false,
      error: "Unsupported action."
    };
  } catch (error) {
    return {
      ok: false,
      error: (error == null ? void 0 : error.message) || "Failed to update admin users."
    };
  }
};
const superadmin_users = UNSAFE_withComponentProps(function SuperAdminUsersPage() {
  const {
    currentUser,
    users
  } = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  return /* @__PURE__ */ jsxs("div", {
    className: "sa-grid",
    children: [(actionData == null ? void 0 : actionData.error) ? /* @__PURE__ */ jsx("div", {
      className: "sa-alert error",
      children: actionData.error
    }) : null, (actionData == null ? void 0 : actionData.ok) && (actionData == null ? void 0 : actionData.message) ? /* @__PURE__ */ jsx("div", {
      className: "sa-alert success",
      children: actionData.message
    }) : null, /* @__PURE__ */ jsxs("div", {
      className: "sa-card sa-grid",
      children: [/* @__PURE__ */ jsxs("div", {
        children: [/* @__PURE__ */ jsx("h3", {
          style: {
            margin: 0
          },
          children: "Create New Admin User"
        }), /* @__PURE__ */ jsx("p", {
          style: {
            margin: "4px 0 0",
            fontSize: 13,
            color: "var(--sa-muted)"
          },
          children: "Create additional SuperAdmin accounts using a username or email address. The fixed primary owner account cannot be removed or disabled."
        })]
      }), /* @__PURE__ */ jsxs(Form, {
        method: "post",
        className: "sa-grid",
        children: [/* @__PURE__ */ jsx("input", {
          type: "hidden",
          name: "intent",
          value: "createUser"
        }), /* @__PURE__ */ jsxs("div", {
          className: "sa-grid-2",
          children: [/* @__PURE__ */ jsxs("div", {
            className: "sa-field",
            children: [/* @__PURE__ */ jsx("label", {
              children: "Full Name"
            }), /* @__PURE__ */ jsx("input", {
              name: "name",
              type: "text",
              required: true,
              placeholder: "Jane Doe",
              className: "sa-input"
            })]
          }), /* @__PURE__ */ jsxs("div", {
            className: "sa-field",
            children: [/* @__PURE__ */ jsx("label", {
              children: "Username or Email"
            }), /* @__PURE__ */ jsx("input", {
              name: "username",
              type: "text",
              required: true,
              placeholder: "teamadmin or jane@yourdomain.com",
              className: "sa-input"
            })]
          }), /* @__PURE__ */ jsxs("div", {
            className: "sa-field",
            children: [/* @__PURE__ */ jsx("label", {
              children: "Password (min 8 chars)"
            }), /* @__PURE__ */ jsx("input", {
              name: "password",
              type: "password",
              required: true,
              minLength: 8,
              autoComplete: "new-password",
              placeholder: "Strong password",
              className: "sa-input"
            })]
          }), /* @__PURE__ */ jsxs("div", {
            className: "sa-field",
            children: [/* @__PURE__ */ jsx("label", {
              children: "Role"
            }), /* @__PURE__ */ jsxs("select", {
              name: "role",
              className: "sa-select",
              defaultValue: "ADMIN",
              children: [/* @__PURE__ */ jsx("option", {
                value: "ADMIN",
                children: "ADMIN"
              }), /* @__PURE__ */ jsx("option", {
                value: "OWNER",
                children: "OWNER"
              })]
            })]
          })]
        }), /* @__PURE__ */ jsx("div", {
          style: {
            display: "flex",
            justifyContent: "flex-end"
          },
          children: /* @__PURE__ */ jsx("button", {
            type: "submit",
            className: "sa-btn",
            disabled: isSubmitting,
            children: isSubmitting ? "Creating User..." : "+ Create Admin User"
          })
        })]
      })]
    }), /* @__PURE__ */ jsxs("div", {
      className: "sa-card",
      style: {
        padding: 0,
        overflow: "hidden"
      },
      children: [/* @__PURE__ */ jsx("div", {
        style: {
          padding: "16px 20px",
          borderBottom: "1px solid var(--sa-border-soft)"
        },
        children: /* @__PURE__ */ jsxs("h3", {
          style: {
            margin: 0
          },
          children: ["SuperAdmin Users (", users.length, ")"]
        })
      }), /* @__PURE__ */ jsx("div", {
        className: "sa-table-wrap",
        children: /* @__PURE__ */ jsxs("table", {
          className: "sa-table",
          children: [/* @__PURE__ */ jsx("thead", {
            children: /* @__PURE__ */ jsxs("tr", {
              children: [/* @__PURE__ */ jsx("th", {
                children: "Name"
              }), /* @__PURE__ */ jsx("th", {
                children: "Username / Email"
              }), /* @__PURE__ */ jsx("th", {
                children: "Role"
              }), /* @__PURE__ */ jsx("th", {
                children: "Status"
              }), /* @__PURE__ */ jsx("th", {
                children: "Last Login"
              }), /* @__PURE__ */ jsx("th", {
                children: "Actions"
              })]
            })
          }), /* @__PURE__ */ jsx("tbody", {
            children: users.map((u) => {
              const isSelf = u.id === currentUser.id;
              return /* @__PURE__ */ jsxs("tr", {
                children: [/* @__PURE__ */ jsxs("td", {
                  children: [/* @__PURE__ */ jsx("strong", {
                    children: u.name
                  }), " ", isSelf ? /* @__PURE__ */ jsx("span", {
                    className: "sa-pill info",
                    children: "You"
                  }) : null, " ", u.isFixed ? /* @__PURE__ */ jsx("span", {
                    className: "sa-pill super",
                    children: "Fixed"
                  }) : null]
                }), /* @__PURE__ */ jsx("td", {
                  children: /* @__PURE__ */ jsx("code", {
                    children: u.email
                  })
                }), /* @__PURE__ */ jsx("td", {
                  children: /* @__PURE__ */ jsx("span", {
                    className: `sa-pill ${u.role === "OWNER" ? "super" : "info"}`,
                    children: u.role
                  })
                }), /* @__PURE__ */ jsx("td", {
                  children: /* @__PURE__ */ jsx("span", {
                    className: `sa-pill ${u.isActive ? "good" : "bad"}`,
                    children: u.isActive ? "Active" : "Disabled"
                  })
                }), /* @__PURE__ */ jsx("td", {
                  children: u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : "Never"
                }), /* @__PURE__ */ jsx("td", {
                  children: isSelf || u.isFixed ? /* @__PURE__ */ jsx("small", {
                    style: {
                      color: "var(--sa-muted)"
                    },
                    children: u.isFixed ? "Protected fixed owner" : "Current session"
                  }) : /* @__PURE__ */ jsxs("div", {
                    style: {
                      display: "flex",
                      gap: 8
                    },
                    children: [/* @__PURE__ */ jsxs(Form, {
                      method: "post",
                      children: [/* @__PURE__ */ jsx("input", {
                        type: "hidden",
                        name: "intent",
                        value: "toggleStatus"
                      }), /* @__PURE__ */ jsx("input", {
                        type: "hidden",
                        name: "targetUserId",
                        value: u.id
                      }), /* @__PURE__ */ jsx("input", {
                        type: "hidden",
                        name: "nextActive",
                        value: String(!u.isActive)
                      }), /* @__PURE__ */ jsx("button", {
                        type: "submit",
                        className: "sa-btn secondary",
                        style: {
                          padding: "5px 10px",
                          fontSize: 12
                        },
                        children: u.isActive ? "Disable" : "Enable"
                      })]
                    }), /* @__PURE__ */ jsxs(Form, {
                      method: "post",
                      children: [/* @__PURE__ */ jsx("input", {
                        type: "hidden",
                        name: "intent",
                        value: "deleteUser"
                      }), /* @__PURE__ */ jsx("input", {
                        type: "hidden",
                        name: "targetUserId",
                        value: u.id
                      }), /* @__PURE__ */ jsx("button", {
                        type: "submit",
                        className: "sa-btn danger",
                        style: {
                          padding: "5px 10px",
                          fontSize: 12
                        },
                        children: "Delete"
                      })]
                    })]
                  })
                })]
              }, u.id);
            })
          })]
        })
      })]
    })]
  });
});
const route12 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$d,
  default: superadmin_users,
  loader: loader$i
}, Symbol.toStringTag, { value: "Module" }));
const loader$h = async ({
  request
}) => {
  var _a2, _b;
  await requireSuperAdmin(request);
  const [aiConfig, gscOAuth, pageSpeedConfig, recentLogs, totalAgg] = await Promise.all([getEffectivePlatformAiSettings(), getEffectiveGscOAuthConfig(), getEffectivePageSpeedConfig(), prisma.aiCreditUsageLog.findMany({
    orderBy: {
      createdAt: "desc"
    },
    take: 25
  }), prisma.aiCreditUsageLog.aggregate({
    where: {
      actionType: {
        not: "credit_pack_purchase"
      },
      creditsDeducted: {
        gte: 0
      }
    },
    _count: {
      id: true
    },
    _sum: {
      creditsDeducted: true
    }
  })]);
  return {
    aiConfig: {
      provider: aiConfig.provider,
      model: aiConfig.model,
      temperature: aiConfig.temperature,
      isEnabled: aiConfig.isEnabled,
      hasDbKey: aiConfig.hasDbKey,
      dbKeyMask: aiConfig.dbKeyMask,
      usingEnvFallback: aiConfig.usingEnvFallback,
      hasEffectiveKey: Boolean(aiConfig.apiKey),
      updatedBy: aiConfig.updatedBy,
      updatedAt: aiConfig.updatedAt
    },
    gscOAuth: {
      clientId: gscOAuth.clientId,
      hasSecret: Boolean(gscOAuth.clientSecret),
      maskedSecret: gscOAuth.maskedSecret,
      hasDbConfig: gscOAuth.hasDbConfig,
      usingEnvFallback: gscOAuth.usingEnvFallback
    },
    pageSpeedConfig: {
      hasKey: Boolean(pageSpeedConfig.apiKey),
      hasDbKey: pageSpeedConfig.hasDbKey,
      maskedKey: pageSpeedConfig.maskedKey,
      usingEnvFallback: pageSpeedConfig.usingEnvFallback
    },
    recentLogs,
    totalCalls: ((_a2 = totalAgg._count) == null ? void 0 : _a2.id) || 0,
    totalCreditsUsed: Math.max(0, ((_b = totalAgg._sum) == null ? void 0 : _b.creditsDeducted) || 0)
  };
};
const action$c = async ({
  request
}) => {
  const adminUser = await requireSuperAdmin(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") || "save");
  try {
    if (intent === "saveGscOAuth") {
      const clientId = String(formData.get("gscClientId") || "").trim();
      const clientSecret = String(formData.get("gscClientSecret") || "").trim();
      const clearConfig = formData.get("clearGscConfig") === "on";
      await updatePlatformGscOAuthConfig({
        clientId,
        clientSecret,
        clearConfig,
        updatedBy: adminUser.email
      });
      return {
        ok: true,
        message: clearConfig ? "Cleared Google Search Console OAuth database credentials." : "Google Search Console OAuth Client credentials saved for merchant connections."
      };
    }
    if (intent === "savePageSpeedKey") {
      const psKey = String(formData.get("pageSpeedApiKey") || "").trim();
      const clearConfig = formData.get("clearPageSpeedKey") === "on";
      await updatePlatformPageSpeedConfig({
        apiKey: psKey,
        clearConfig,
        updatedBy: adminUser.email
      });
      return {
        ok: true,
        message: clearConfig ? "Cleared Google PageSpeed Insights API key from database." : "Saved Google PageSpeed Insights API key for live merchant speed tests."
      };
    }
    const customModel = String(formData.get("customModel") || "").trim();
    const modelSelect = String(formData.get("model") || "").trim();
    const resolvedSelect = modelSelect === "custom" ? "" : modelSelect;
    const submittedModel = customModel || resolvedSelect;
    const apiKey = String(formData.get("apiKey") || "").trim();
    if (intent === "test") {
      const effective = await getEffectivePlatformAiSettings();
      const keyToTest = apiKey || effective.apiKey;
      const modelToTest = submittedModel || effective.model;
      const testResult = await testGeminiConnection({
        apiKey: keyToTest,
        model: modelToTest
      });
      return {
        ok: true,
        testResult,
        message: `Connected to ${testResult.model} in ${testResult.latencyMs}ms.`
      };
    }
    const provider = String(formData.get("provider") || "gemini");
    const model = submittedModel || DEFAULT_GEMINI_MODEL;
    const clearApiKey = formData.get("clearApiKey") === "on";
    const temperature = Number(formData.get("temperature") ?? 0.4);
    const isEnabled = formData.get("isEnabled") === "on";
    if (apiKey && provider === "gemini" && !looksLikeGeminiApiKey(apiKey)) {
      return {
        ok: false,
        error: "Invalid Gemini API key format. Expected a Google AI Studio key ('AIza...') or Vertex Express key ('AQ....')."
      };
    }
    await updatePlatformAiConfig({
      provider,
      model,
      apiKey,
      clearApiKey,
      temperature,
      isEnabled,
      updatedBy: adminUser.email
    });
    return {
      ok: true,
      message: "Global AI credentials updated. All stores on the platform now share this configuration."
    };
  } catch (error) {
    return {
      ok: false,
      error: (error == null ? void 0 : error.message) || "Unable to update AI credentials."
    };
  }
};
const superadmin_ai = UNSAFE_withComponentProps(function SuperAdminAiPage() {
  var _a2;
  const {
    aiConfig,
    gscOAuth,
    pageSpeedConfig,
    recentLogs,
    totalCalls,
    totalCreditsUsed
  } = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const submittingIntent = (_a2 = navigation.formData) == null ? void 0 : _a2.get("intent");
  const isPreset = PRESET_GEMINI_MODEL_IDS.includes(aiConfig.model);
  const [selectedModel, setSelectedModel] = useState(isPreset ? aiConfig.model : "custom");
  const modelGroups = Array.from(new Set(GEMINI_MODEL_CATALOG.map((m) => m.group)));
  return /* @__PURE__ */ jsxs("div", {
    className: "sa-grid",
    children: [(actionData == null ? void 0 : actionData.error) ? /* @__PURE__ */ jsx("div", {
      className: "sa-alert error",
      children: actionData.error
    }) : null, (actionData == null ? void 0 : actionData.ok) && (actionData == null ? void 0 : actionData.message) ? /* @__PURE__ */ jsx("div", {
      className: "sa-alert success",
      children: actionData.message
    }) : null, /* @__PURE__ */ jsxs("div", {
      className: "sa-grid-3",
      children: [/* @__PURE__ */ jsxs("div", {
        className: "sa-kpi",
        children: [/* @__PURE__ */ jsx("p", {
          className: "sa-kpi-label",
          children: "Global AI Engine"
        }), /* @__PURE__ */ jsx("p", {
          className: "sa-kpi-value",
          style: {
            fontSize: 20,
            marginTop: 8
          },
          children: !aiConfig.isEnabled ? /* @__PURE__ */ jsx("span", {
            className: "sa-pill bad",
            children: "Paused Globally"
          }) : aiConfig.hasEffectiveKey ? /* @__PURE__ */ jsx("span", {
            className: "sa-pill good",
            children: "Active & Shared"
          }) : /* @__PURE__ */ jsx("span", {
            className: "sa-pill warn",
            children: "Key Missing"
          })
        }), /* @__PURE__ */ jsxs("small", {
          style: {
            color: "var(--sa-muted)"
          },
          children: ["Model: ", /* @__PURE__ */ jsx("code", {
            children: aiConfig.model
          })]
        })]
      }), /* @__PURE__ */ jsxs("div", {
        className: "sa-kpi",
        children: [/* @__PURE__ */ jsx("p", {
          className: "sa-kpi-label",
          children: "Credential Source"
        }), /* @__PURE__ */ jsx("p", {
          className: "sa-kpi-value",
          style: {
            fontSize: 18,
            marginTop: 8
          },
          children: aiConfig.hasDbKey ? `SuperAdmin DB (${aiConfig.dbKeyMask})` : aiConfig.usingEnvFallback ? "Environment (.env GEMINI_API_KEY)" : "Not configured"
        }), /* @__PURE__ */ jsx("small", {
          style: {
            color: "var(--sa-muted)"
          },
          children: "Merchants have zero access to these credentials."
        })]
      }), /* @__PURE__ */ jsxs("div", {
        className: "sa-kpi",
        children: [/* @__PURE__ */ jsx("p", {
          className: "sa-kpi-label",
          children: "Platform-Wide AI Usage"
        }), /* @__PURE__ */ jsxs("p", {
          className: "sa-kpi-value",
          children: [totalCalls, " calls"]
        }), /* @__PURE__ */ jsxs("small", {
          style: {
            color: "var(--sa-muted)"
          },
          children: [totalCreditsUsed, " net credits processed across all stores"]
        })]
      })]
    }), /* @__PURE__ */ jsxs("div", {
      className: "sa-card sa-grid",
      children: [/* @__PURE__ */ jsxs("div", {
        children: [/* @__PURE__ */ jsx("h3", {
          style: {
            margin: 0
          },
          children: "Shared Gemini AI Credentials"
        }), /* @__PURE__ */ jsxs("p", {
          style: {
            margin: "4px 0 0",
            fontSize: 13,
            color: "var(--sa-muted)"
          },
          children: ["Every Shopify store using Ecom SEO routes its AI requests through this single global configuration. Supports both Google AI Studio (", /* @__PURE__ */ jsx("code", {
            children: "AIza..."
          }), ") and Vertex AI Express Mode (", /* @__PURE__ */ jsx("code", {
            children: "AQ...."
          }), ") keys."]
        })]
      }), /* @__PURE__ */ jsxs(Form, {
        method: "post",
        className: "sa-grid",
        children: [/* @__PURE__ */ jsxs("label", {
          className: "sa-checkbox-card",
          style: {
            background: "#f8fafc"
          },
          children: [/* @__PURE__ */ jsx("input", {
            type: "checkbox",
            name: "isEnabled",
            defaultChecked: aiConfig.isEnabled
          }), /* @__PURE__ */ jsxs("span", {
            children: [/* @__PURE__ */ jsx("strong", {
              children: "Enable Platform AI Globally"
            }), " — Unchecking pauses all AI actions across every store immediately"]
          })]
        }), /* @__PURE__ */ jsxs("div", {
          className: "sa-grid-3",
          children: [/* @__PURE__ */ jsxs("div", {
            className: "sa-field",
            children: [/* @__PURE__ */ jsx("label", {
              children: "AI Provider"
            }), /* @__PURE__ */ jsx("select", {
              name: "provider",
              className: "sa-select",
              defaultValue: aiConfig.provider,
              children: /* @__PURE__ */ jsx("option", {
                value: "gemini",
                children: "Google Gemini API"
              })
            })]
          }), /* @__PURE__ */ jsxs("div", {
            className: "sa-field",
            children: [/* @__PURE__ */ jsx("label", {
              children: "Gemini Model"
            }), /* @__PURE__ */ jsxs("select", {
              name: "model",
              className: "sa-select",
              value: selectedModel,
              onChange: (e) => setSelectedModel(e.target.value),
              children: [modelGroups.map((group) => /* @__PURE__ */ jsx("optgroup", {
                label: group,
                children: GEMINI_MODEL_CATALOG.filter((m) => m.group === group).map((modelOption) => /* @__PURE__ */ jsxs("option", {
                  value: modelOption.id,
                  children: [modelOption.id, " — ", modelOption.label]
                }, modelOption.id))
              }, group)), /* @__PURE__ */ jsx("option", {
                value: "custom",
                children: "Custom Model ID..."
              })]
            })]
          }), /* @__PURE__ */ jsxs("div", {
            className: "sa-field",
            children: [/* @__PURE__ */ jsx("label", {
              children: "Temperature (0.0 – 1.0)"
            }), /* @__PURE__ */ jsx("input", {
              name: "temperature",
              type: "number",
              step: "0.1",
              min: "0",
              max: "1",
              defaultValue: aiConfig.temperature,
              className: "sa-input"
            })]
          })]
        }), selectedModel === "custom" ? /* @__PURE__ */ jsxs("div", {
          className: "sa-field",
          children: [/* @__PURE__ */ jsx("label", {
            children: "Custom Gemini Model ID"
          }), /* @__PURE__ */ jsx("input", {
            name: "customModel",
            type: "text",
            defaultValue: isPreset ? "" : aiConfig.model,
            placeholder: "e.g. gemini-3.8-live or gemini-3-flash-preview",
            className: "sa-input"
          })]
        }) : null, /* @__PURE__ */ jsxs("div", {
          className: "sa-field",
          children: [/* @__PURE__ */ jsx("label", {
            children: "Global Gemini API Key"
          }), /* @__PURE__ */ jsx("input", {
            name: "apiKey",
            type: "password",
            autoComplete: "new-password",
            placeholder: aiConfig.hasDbKey ? `Stored as ${aiConfig.dbKeyMask}. Leave blank to keep current key.` : "Enter AIza... or AQ.... Gemini API key",
            className: "sa-input"
          })]
        }), /* @__PURE__ */ jsxs("label", {
          className: "sa-checkbox-card",
          children: [/* @__PURE__ */ jsx("input", {
            type: "checkbox",
            name: "clearApiKey"
          }), /* @__PURE__ */ jsx("span", {
            children: "Clear stored database API key (falls back to `.env` `GEMINI_API_KEY` if configured)"
          })]
        }), /* @__PURE__ */ jsxs("div", {
          style: {
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 10
          },
          children: [/* @__PURE__ */ jsx("small", {
            style: {
              color: "var(--sa-muted)"
            },
            children: aiConfig.updatedBy ? `Last updated by ${aiConfig.updatedBy} on ${new Date(aiConfig.updatedAt).toLocaleString()}` : "Not modified via SuperAdmin yet."
          }), /* @__PURE__ */ jsxs("div", {
            style: {
              display: "flex",
              gap: 10,
              flexWrap: "wrap"
            },
            children: [/* @__PURE__ */ jsx("button", {
              type: "submit",
              name: "intent",
              value: "test",
              className: "sa-btn secondary",
              disabled: isSubmitting,
              children: isSubmitting && submittingIntent === "test" ? "Testing..." : "🧪 Test Connection"
            }), /* @__PURE__ */ jsx("button", {
              type: "submit",
              name: "intent",
              value: "save",
              className: "sa-btn",
              disabled: isSubmitting,
              children: isSubmitting && submittingIntent === "save" ? "Saving..." : "Save Global AI Credentials"
            })]
          })]
        })]
      })]
    }), /* @__PURE__ */ jsxs("div", {
      className: "sa-card sa-grid",
      children: [/* @__PURE__ */ jsxs("div", {
        children: [/* @__PURE__ */ jsx("h3", {
          style: {
            margin: "0 0 4px 0"
          },
          children: "Google Search Console OAuth App Credentials (Optional)"
        }), /* @__PURE__ */ jsxs("p", {
          style: {
            margin: 0,
            color: "var(--sa-muted)",
            fontSize: 13
          },
          children: ["Enables 1-click Google Search Console connection for merchants. Redirect URI:", " ", /* @__PURE__ */ jsx("code", {
            children: "/api/gsc/callback"
          }), ". Merchants can also upload Search Console CSV exports without OAuth."]
        })]
      }), /* @__PURE__ */ jsxs(Form, {
        method: "post",
        className: "sa-grid",
        style: {
          gap: 14
        },
        children: [/* @__PURE__ */ jsxs("div", {
          className: "sa-form-row",
          children: [/* @__PURE__ */ jsxs("div", {
            children: [/* @__PURE__ */ jsx("label", {
              className: "sa-label",
              htmlFor: "gscClientId",
              children: "Google OAuth Client ID"
            }), /* @__PURE__ */ jsx("input", {
              id: "gscClientId",
              name: "gscClientId",
              defaultValue: gscOAuth.clientId || "",
              placeholder: "1234567890-xxx.apps.googleusercontent.com",
              className: "sa-input"
            })]
          }), /* @__PURE__ */ jsxs("div", {
            children: [/* @__PURE__ */ jsx("label", {
              className: "sa-label",
              htmlFor: "gscClientSecret",
              children: "Google OAuth Client Secret"
            }), /* @__PURE__ */ jsx("input", {
              id: "gscClientSecret",
              name: "gscClientSecret",
              type: "password",
              placeholder: gscOAuth.hasSecret ? `Stored (${gscOAuth.maskedSecret || "configured"}). Leave blank to keep.` : "GOCSPX-...",
              className: "sa-input"
            })]
          })]
        }), /* @__PURE__ */ jsxs("label", {
          className: "sa-checkbox-card",
          children: [/* @__PURE__ */ jsx("input", {
            type: "checkbox",
            name: "clearGscConfig"
          }), /* @__PURE__ */ jsx("span", {
            children: "Clear stored database GSC OAuth config (fall back to `.env` if set)"
          })]
        }), /* @__PURE__ */ jsxs("div", {
          style: {
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 10
          },
          children: [/* @__PURE__ */ jsxs("small", {
            style: {
              color: "var(--sa-muted)"
            },
            children: ["Status:", " ", gscOAuth.clientId && gscOAuth.hasSecret ? gscOAuth.usingEnvFallback ? "Using .env GOOGLE_GSC_CLIENT_ID/SECRET" : "Active via SuperAdmin DB" : "Not configured (CSV import still active)"]
          }), /* @__PURE__ */ jsx("button", {
            type: "submit",
            name: "intent",
            value: "saveGscOAuth",
            className: "sa-btn secondary",
            disabled: isSubmitting,
            children: isSubmitting && submittingIntent === "saveGscOAuth" ? "Saving..." : "Save GSC OAuth Settings"
          })]
        })]
      })]
    }), /* @__PURE__ */ jsxs("div", {
      className: "sa-card sa-grid",
      children: [/* @__PURE__ */ jsxs("div", {
        children: [/* @__PURE__ */ jsx("h3", {
          style: {
            margin: "0 0 4px 0"
          },
          children: "Google PageSpeed Insights API Key (Optional)"
        }), /* @__PURE__ */ jsxs("p", {
          style: {
            margin: 0,
            color: "var(--sa-muted)",
            fontSize: 13
          },
          children: ["PageSpeed Insights works without a key at public quota, or set a Google Cloud PageSpeed Insights API key here (or ", /* @__PURE__ */ jsx("code", {
            children: "GOOGLE_PAGESPEED_API_KEY"
          }), " in ", /* @__PURE__ */ jsx("code", {
            children: ".env"
          }), ") for higher shared rate limits."]
        })]
      }), /* @__PURE__ */ jsxs(Form, {
        method: "post",
        className: "sa-grid",
        style: {
          gap: 14
        },
        children: [/* @__PURE__ */ jsxs("div", {
          children: [/* @__PURE__ */ jsx("label", {
            className: "sa-label",
            htmlFor: "pageSpeedApiKey",
            children: "Google PageSpeed Insights API Key"
          }), /* @__PURE__ */ jsx("input", {
            id: "pageSpeedApiKey",
            name: "pageSpeedApiKey",
            type: "password",
            placeholder: (pageSpeedConfig == null ? void 0 : pageSpeedConfig.hasDbKey) ? `Stored (${pageSpeedConfig.maskedKey}). Leave blank to keep.` : "AIza...",
            className: "sa-input"
          })]
        }), /* @__PURE__ */ jsxs("label", {
          className: "sa-checkbox-card",
          children: [/* @__PURE__ */ jsx("input", {
            type: "checkbox",
            name: "clearPageSpeedKey"
          }), /* @__PURE__ */ jsx("span", {
            children: "Clear stored database PageSpeed key (fall back to `.env` or public PSI quota)"
          })]
        }), /* @__PURE__ */ jsxs("div", {
          style: {
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 10
          },
          children: [/* @__PURE__ */ jsxs("small", {
            style: {
              color: "var(--sa-muted)"
            },
            children: ["Status:", " ", (pageSpeedConfig == null ? void 0 : pageSpeedConfig.hasDbKey) ? `Active via SuperAdmin DB (${pageSpeedConfig.maskedKey})` : (pageSpeedConfig == null ? void 0 : pageSpeedConfig.usingEnvFallback) ? "Using .env GOOGLE_PAGESPEED_API_KEY" : "Using Google public PageSpeed quota (key optional)"]
          }), /* @__PURE__ */ jsx("button", {
            type: "submit",
            name: "intent",
            value: "savePageSpeedKey",
            className: "sa-btn secondary",
            disabled: isSubmitting,
            children: isSubmitting && submittingIntent === "savePageSpeedKey" ? "Saving..." : "Save PageSpeed API Key"
          })]
        })]
      })]
    }), /* @__PURE__ */ jsxs("div", {
      className: "sa-card sa-grid",
      children: [/* @__PURE__ */ jsx("h3", {
        style: {
          margin: 0
        },
        children: "Recent Global AI Usage (All Stores)"
      }), !recentLogs.length ? /* @__PURE__ */ jsx("p", {
        style: {
          margin: 0,
          color: "var(--sa-muted)",
          fontSize: 13.5
        },
        children: "No AI usage logged yet."
      }) : /* @__PURE__ */ jsx("div", {
        className: "sa-table-wrap",
        children: /* @__PURE__ */ jsxs("table", {
          className: "sa-table",
          children: [/* @__PURE__ */ jsx("thead", {
            children: /* @__PURE__ */ jsxs("tr", {
              children: [/* @__PURE__ */ jsx("th", {
                children: "Time"
              }), /* @__PURE__ */ jsx("th", {
                children: "Store"
              }), /* @__PURE__ */ jsx("th", {
                children: "Action"
              }), /* @__PURE__ */ jsx("th", {
                children: "Product / Context"
              }), /* @__PURE__ */ jsx("th", {
                children: "Credits"
              }), /* @__PURE__ */ jsx("th", {
                children: "Model"
              })]
            })
          }), /* @__PURE__ */ jsx("tbody", {
            children: recentLogs.map((log) => /* @__PURE__ */ jsxs("tr", {
              children: [/* @__PURE__ */ jsx("td", {
                children: new Date(log.createdAt).toLocaleString()
              }), /* @__PURE__ */ jsx("td", {
                children: /* @__PURE__ */ jsx("strong", {
                  children: log.shop
                })
              }), /* @__PURE__ */ jsx("td", {
                children: /* @__PURE__ */ jsx("span", {
                  className: "sa-pill info",
                  children: log.actionType
                })
              }), /* @__PURE__ */ jsx("td", {
                children: log.productTitle || log.productId || "-"
              }), /* @__PURE__ */ jsx("td", {
                children: /* @__PURE__ */ jsx("strong", {
                  style: {
                    color: log.creditsDeducted < 0 ? "var(--sa-good)" : log.creditsDeducted === 0 ? "var(--sa-muted)" : "var(--sa-ink)"
                  },
                  children: log.creditsDeducted < 0 ? `+${Math.abs(log.creditsDeducted)}` : log.creditsDeducted === 0 ? "0 (Super)" : `-${log.creditsDeducted}`
                })
              }), /* @__PURE__ */ jsx("td", {
                children: /* @__PURE__ */ jsx("code", {
                  children: log.modelUsed
                })
              })]
            }, log.id))
          })]
        })
      })]
    })]
  });
});
const route13 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$c,
  default: superadmin_ai,
  loader: loader$h
}, Symbol.toStringTag, { value: "Module" }));
const index = "_index_12o3y_1";
const heading = "_heading_12o3y_11";
const text = "_text_12o3y_12";
const content = "_content_12o3y_22";
const form = "_form_12o3y_27";
const label = "_label_12o3y_35";
const input = "_input_12o3y_43";
const button = "_button_12o3y_47";
const list = "_list_12o3y_51";
const styles = {
  index,
  heading,
  text,
  content,
  form,
  label,
  input,
  button,
  list
};
const loader$g = async ({
  request
}) => {
  const url = new URL(request.url);
  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }
  return {
    showForm: Boolean(login)
  };
};
const route = UNSAFE_withComponentProps(function App2() {
  const {
    showForm
  } = useLoaderData();
  return /* @__PURE__ */ jsx("div", {
    className: styles.index,
    children: /* @__PURE__ */ jsxs("div", {
      className: styles.content,
      children: [/* @__PURE__ */ jsx("h1", {
        className: styles.heading,
        children: "A short heading about [your app]"
      }), /* @__PURE__ */ jsx("p", {
        className: styles.text,
        children: "A tagline about [your app] that describes your value proposition."
      }), showForm && /* @__PURE__ */ jsxs(Form, {
        className: styles.form,
        method: "post",
        action: "/auth/login",
        children: [/* @__PURE__ */ jsxs("label", {
          className: styles.label,
          children: [/* @__PURE__ */ jsx("span", {
            children: "Shop domain"
          }), /* @__PURE__ */ jsx("input", {
            className: styles.input,
            type: "text",
            name: "shop"
          }), /* @__PURE__ */ jsx("span", {
            children: "e.g: my-shop-domain.myshopify.com"
          })]
        }), /* @__PURE__ */ jsx("button", {
          className: styles.button,
          type: "submit",
          children: "Log in"
        })]
      }), /* @__PURE__ */ jsxs("ul", {
        className: styles.list,
        children: [/* @__PURE__ */ jsxs("li", {
          children: [/* @__PURE__ */ jsx("strong", {
            children: "Product feature"
          }), ". Some detail about your feature and its benefit to your customer."]
        }), /* @__PURE__ */ jsxs("li", {
          children: [/* @__PURE__ */ jsx("strong", {
            children: "Product feature"
          }), ". Some detail about your feature and its benefit to your customer."]
        }), /* @__PURE__ */ jsxs("li", {
          children: [/* @__PURE__ */ jsx("strong", {
            children: "Product feature"
          }), ". Some detail about your feature and its benefit to your customer."]
        })]
      })]
    })
  });
});
const route14 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: route,
  loader: loader$g
}, Symbol.toStringTag, { value: "Module" }));
const loader$f = async ({
  request
}) => {
  await authenticate.admin(request);
  return null;
};
const headers$1 = (headersArgs) => {
  return boundary.headers(headersArgs);
};
const route15 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  headers: headers$1,
  loader: loader$f
}, Symbol.toStringTag, { value: "Module" }));
const seoStyles = "/assets/seo-CP-p3b-E.css";
function dispatchCreditsUpdate(detail) {
  if (typeof window === "undefined" || !detail) return;
  window.dispatchEvent(new CustomEvent("ecomseo:credits", { detail }));
}
const WORKSPACE_GROUPS = Object.freeze({
  products: {
    title: "Products & Media",
    subtitle: "Edit product listings, bulk meta tags, URL handles with 301 safety, and image ALT tags.",
    tabs: [
      { key: "products", label: "Product SEO", to: "/app/products" },
      { key: "bulk_meta", label: "Bulk Meta", to: "/app/bulk-meta" },
      { key: "url_optimization", label: "URLs & 301s", to: "/app/url-optimization" },
      { key: "image_optimizer", label: "Image ALT & Vision", to: "/app/image-optimizer" }
    ]
  },
  technical: {
    title: "Technical, PageSpeed & History",
    subtitle: "Manage Google crawl directives, XML sitemaps, live PageSpeed Core Web Vitals, and 1-click rollback history.",
    tabs: [
      { key: "pagespeed", label: "PageSpeed & CWV", to: "/app/pagespeed" },
      { key: "robots", label: "Robots.txt", to: "/app/robots" },
      { key: "sitemap", label: "XML Sitemap", to: "/app/sitemap" },
      { key: "revisions", label: "History & Rollback", to: "/app/revisions" }
    ]
  }
});
const APP_MENU_GROUPS = Object.freeze([
  {
    id: "home",
    label: "Home",
    to: "/app",
    submenus: [
      { label: "SEO Checklist", to: "/app" },
      { label: "Analytics & Trends", to: "/app#analytics" }
    ]
  },
  {
    id: "audit",
    label: "AI Audit",
    featureKey: "seo_audit",
    to: "/app/seo-audit",
    submenus: [
      { label: "Store Health Scan", to: "/app/seo-audit", featureKey: "seo_audit" },
      { label: "Autopilot", to: "/app/seo-audit#autopilot", featureKey: "seo_audit" },
      { label: "Search Console (GSC)", to: "/app/seo-audit#gsc", featureKey: "seo_audit" },
      { label: "Issues & Keywords", to: "/app/seo-audit#issues", featureKey: "seo_audit" }
    ]
  },
  {
    id: "products",
    label: "Products & Media",
    to: "/app/products",
    submenus: [
      { label: "Product SEO", to: "/app/products", featureKey: "products" },
      { label: "Bulk Meta", to: "/app/bulk-meta", featureKey: "bulk_meta" },
      { label: "URLs & 301s", to: "/app/url-optimization", featureKey: "url_optimization" },
      { label: "Image ALT & Vision", to: "/app/image-optimizer", featureKey: "image_optimizer" }
    ]
  },
  {
    id: "pagespeed",
    label: "PageSpeed",
    featureKey: "pagespeed",
    to: "/app/pagespeed",
    submenus: [
      { label: "Live Speed Test", to: "/app/pagespeed", featureKey: "pagespeed" },
      { label: "AI Speed Fixing", to: "/app/pagespeed?mode=ai", featureKey: "pagespeed" },
      { label: "Manual Fixing", to: "/app/pagespeed?mode=manual", featureKey: "pagespeed" },
      { label: "Test History", to: "/app/pagespeed#history", featureKey: "pagespeed" }
    ]
  },
  {
    id: "technical",
    label: "Technical SEO",
    to: "/app/robots",
    submenus: [
      { label: "Robots.txt", to: "/app/robots", featureKey: "robots" },
      { label: "XML Sitemap", to: "/app/sitemap", featureKey: "sitemap" },
      { label: "History & Rollback", to: "/app/revisions", featureKey: "revisions" }
    ]
  },
  {
    id: "billing",
    label: "Subscription",
    to: "/app/billing",
    submenus: [
      { label: "Plans & Balance", to: "/app/billing" },
      { label: "Token Packages", to: "/app/billing#packages" },
      { label: "Usage Logs", to: "/app/billing#usage" }
    ]
  }
]);
function isSubmenuTargetActive(targetTo, pathname, search, hash) {
  const [targetPathAndQuery, targetHash = ""] = String(targetTo || "").split("#");
  const [targetPath, targetQuery = ""] = targetPathAndQuery.split("?");
  if (pathname !== targetPath) return false;
  if (targetHash) {
    return hash === `#${targetHash}`;
  }
  if (targetQuery) {
    const expected = new URLSearchParams(targetQuery);
    const current = new URLSearchParams(search || "");
    for (const [k, v] of expected.entries()) {
      if (current.get(k) !== v) return false;
    }
    return true;
  }
  if (hash) return false;
  if (targetPath === "/app/pagespeed") {
    const mode = new URLSearchParams(search || "").get("mode");
    return !mode;
  }
  return true;
}
function AppMenuShell({ creditAccount = null, storeControl = null }) {
  var _a2;
  const { pathname, search, hash } = useLocation();
  const [clientHash, setClientHash] = useState("");
  const isSuspended = (storeControl == null ? void 0 : storeControl.accessLevel) === "SUSPENDED";
  const allowedSet = new Set((storeControl == null ? void 0 : storeControl.allowedFeatures) || []);
  useEffect(() => {
    setClientHash(hash || "");
    if (!hash || typeof document === "undefined") return;
    const id = hash.slice(1);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [pathname, hash]);
  if (isSuspended) return null;
  const canSee = (featureKey) => {
    if (!featureKey) return true;
    if (!storeControl || storeControl.accessLevel === "FULL") return true;
    return allowedSet.has(featureKey);
  };
  const visibleGroups = APP_MENU_GROUPS.map((group) => {
    var _a3;
    const visibleSubmenus = group.submenus.filter((sub) => canSee(sub.featureKey));
    const allowed = canSee(group.featureKey) && visibleSubmenus.length > 0;
    return {
      ...group,
      primaryTo: ((_a3 = visibleSubmenus[0]) == null ? void 0 : _a3.to) || group.to,
      submenus: visibleSubmenus,
      allowed
    };
  }).filter((g) => g.allowed);
  const activeGroup = visibleGroups.find(
    (group) => group.submenus.some((sub) => pathname === sub.to.split("#")[0].split("?")[0])
  ) || visibleGroups[0];
  const hasSuperAccess = Boolean(storeControl == null ? void 0 : storeControl.superAccess);
  return /* @__PURE__ */ jsx("div", { className: "app-nav-wrap", children: /* @__PURE__ */ jsxs("header", { className: "app-nav-shell", children: [
    /* @__PURE__ */ jsxs("div", { className: "app-nav-primary", children: [
      /* @__PURE__ */ jsx("nav", { className: "app-nav-groups", "aria-label": "Primary application navigation", children: visibleGroups.map((group) => {
        const isGroupActive = (activeGroup == null ? void 0 : activeGroup.id) === group.id;
        return /* @__PURE__ */ jsxs("div", { className: "app-nav-group", children: [
          /* @__PURE__ */ jsxs(
            Link,
            {
              to: group.primaryTo,
              className: `app-nav-item ${isGroupActive ? "active" : ""}`,
              children: [
                /* @__PURE__ */ jsx("span", { children: group.label }),
                group.submenus.length > 1 ? /* @__PURE__ */ jsx("span", { className: "app-nav-caret", "aria-hidden": "true", children: "▾" }) : null
              ]
            }
          ),
          group.submenus.length > 1 ? /* @__PURE__ */ jsx("div", { className: "app-nav-dropdown", role: "menu", "aria-label": `${group.label} submenus`, children: group.submenus.map((sub) => {
            const subActive = isSubmenuTargetActive(sub.to, pathname, search, clientHash);
            return /* @__PURE__ */ jsx(
              Link,
              {
                to: sub.to,
                className: `app-nav-dropdown-link ${subActive ? "active" : ""}`,
                children: sub.label
              },
              sub.to
            );
          }) }) : null
        ] }, group.id);
      }) }),
      creditAccount || hasSuperAccess ? /* @__PURE__ */ jsx(
        CreditPill,
        {
          available: (creditAccount == null ? void 0 : creditAccount.availableCredits) ?? 0,
          total: (creditAccount == null ? void 0 : creditAccount.effectiveTotal) ?? PLAN_ALLOWANCES.FREE,
          plan: (creditAccount == null ? void 0 : creditAccount.plan) || "FREE",
          superAccess: hasSuperAccess
        }
      ) : null
    ] }),
    ((_a2 = activeGroup == null ? void 0 : activeGroup.submenus) == null ? void 0 : _a2.length) ? /* @__PURE__ */ jsxs("nav", { className: "app-submenu-strip", "aria-label": `${activeGroup.label} submenus`, children: [
      /* @__PURE__ */ jsxs("span", { className: "app-submenu-label", children: [
        activeGroup.label,
        ":"
      ] }),
      activeGroup.submenus.map((sub) => {
        const subActive = isSubmenuTargetActive(sub.to, pathname, search, clientHash);
        return /* @__PURE__ */ jsx(
          Link,
          {
            to: sub.to,
            className: `app-submenu-tab ${subActive ? "active" : ""}`,
            children: sub.label
          },
          sub.to
        );
      })
    ] }) : null
  ] }) });
}
function WorkspaceSubnav({ group }) {
  var _a2;
  const { pathname } = useLocation();
  const matches = useMatches();
  const config = WORKSPACE_GROUPS[group];
  if (!config) return null;
  const appData = (_a2 = matches.find((m) => m.data && m.data.storeControl !== void 0)) == null ? void 0 : _a2.data;
  const storeControl = appData == null ? void 0 : appData.storeControl;
  const allowedSet = new Set((storeControl == null ? void 0 : storeControl.allowedFeatures) || []);
  const visibleTabs = config.tabs.filter((tab) => {
    if (!storeControl || storeControl.accessLevel === "FULL") return true;
    return allowedSet.has(tab.key);
  });
  const activeTab = visibleTabs.find((tab) => pathname === tab.to);
  return /* @__PURE__ */ jsx("section", { className: "workspace-header-card", children: /* @__PURE__ */ jsx("div", { className: "workspace-header-top", children: /* @__PURE__ */ jsxs("div", { style: { display: "grid", gap: "4px" }, children: [
    /* @__PURE__ */ jsx("h1", { className: "page-title", style: { fontSize: "20px" }, children: activeTab ? `${config.title} — ${activeTab.label}` : config.title }),
    /* @__PURE__ */ jsx("p", { className: "seo-muted", style: { fontSize: "13px" }, children: config.subtitle })
  ] }) }) });
}
function StatusPill({ tone, children }) {
  return /* @__PURE__ */ jsx("span", { className: `pill pill-${tone}`, children });
}
function CreditPill({ available = 0, total = PLAN_ALLOWANCES.FREE, plan = "FREE", superAccess = false }) {
  const [live, setLive] = useState({ available, total, plan, superAccess });
  useEffect(() => {
    setLive({ available, total, plan, superAccess });
  }, [available, total, plan, superAccess]);
  useEffect(() => {
    if (typeof window === "undefined") return void 0;
    const handleUpdate = (event) => {
      const detail = (event == null ? void 0 : event.detail) || {};
      setLive((current) => ({
        available: typeof detail.availableCredits === "number" ? detail.availableCredits : current.available,
        total: typeof detail.totalCredits === "number" ? detail.totalCredits : current.total,
        plan: detail.plan || current.plan,
        superAccess: typeof detail.superAccess === "boolean" ? detail.superAccess : current.superAccess
      }));
    };
    window.addEventListener("ecomseo:credits", handleUpdate);
    return () => window.removeEventListener("ecomseo:credits", handleUpdate);
  }, []);
  if (live.superAccess) {
    return /* @__PURE__ */ jsxs(Link, { to: "/app/billing", className: "credit-pill super", title: "Super Access: Unlimited AI Usage", children: [
      /* @__PURE__ */ jsx("span", { className: "credit-icon", children: "★" }),
      /* @__PURE__ */ jsx("span", { className: "credit-text", children: "Super Access · Unlimited" })
    ] });
  }
  const isLow = live.available <= 3;
  return /* @__PURE__ */ jsxs(Link, { to: "/app/billing", className: `credit-pill ${isLow ? "low" : "normal"}`, title: "View Billing & AI Tokens", children: [
    /* @__PURE__ */ jsx("span", { className: "credit-icon", children: "⚡" }),
    /* @__PURE__ */ jsxs("span", { className: "credit-text", children: [
      live.available,
      " / ",
      live.total,
      " Tokens"
    ] }),
    live.plan === "PRO" ? /* @__PURE__ */ jsx("span", { className: "credit-badge-pro", children: "PRO" }) : null
  ] });
}
function AiDiffInspector({ auditResult }) {
  var _a2, _b;
  if (!auditResult) return null;
  return /* @__PURE__ */ jsxs("div", { className: "ai-diff-card", children: [
    /* @__PURE__ */ jsxs("div", { className: "ai-diff-head", children: [
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("h4", { children: "🤖 Gemini SEO Impact Analysis" }),
        /* @__PURE__ */ jsxs("span", { className: `pill pill-${auditResult.riskRating === "LOW" ? "good" : auditResult.riskRating === "MODERATE" ? "warning" : "critical"}`, children: [
          "Risk: ",
          auditResult.riskRating
        ] })
      ] }),
      /* @__PURE__ */ jsxs("span", { className: "ctr-badge", children: [
        "Projected CTR: ",
        auditResult.projectedCtrDelta
      ] })
    ] }),
    /* @__PURE__ */ jsxs("p", { style: { margin: "4px 0", fontSize: 13 }, children: [
      /* @__PURE__ */ jsx("strong", { children: "Intent Shift:" }),
      " ",
      auditResult.intentShift
    ] }),
    ((_a2 = auditResult.keyImprovements) == null ? void 0 : _a2.length) ? /* @__PURE__ */ jsxs("div", { className: "diff-improvements", children: [
      /* @__PURE__ */ jsx("strong", { children: "Key Improvements:" }),
      /* @__PURE__ */ jsx("ul", { children: auditResult.keyImprovements.map((imp, idx) => /* @__PURE__ */ jsxs("li", { children: [
        "✅ ",
        imp
      ] }, idx)) })
    ] }) : null,
    ((_b = auditResult.warnings) == null ? void 0 : _b.length) ? /* @__PURE__ */ jsxs("div", { className: "diff-warnings", children: [
      /* @__PURE__ */ jsx("strong", { children: "Alerts:" }),
      /* @__PURE__ */ jsx("ul", { children: auditResult.warnings.map((warn, idx) => /* @__PURE__ */ jsxs("li", { children: [
        "⚠️ ",
        warn
      ] }, idx)) })
    ] }) : null,
    /* @__PURE__ */ jsx("div", { className: "diff-verdict", children: /* @__PURE__ */ jsxs("p", { children: [
      /* @__PURE__ */ jsx("strong", { children: "Verdict:" }),
      " ",
      auditResult.verdict
    ] }) })
  ] });
}
async function requireShopContext(request) {
  var _a2, _b;
  const auth = await authenticate.admin(request);
  const url = new URL(request.url);
  const sessionShop = ((_a2 = auth == null ? void 0 : auth.session) == null ? void 0 : _a2.shop) || "";
  const sessionToken = ((_b = auth == null ? void 0 : auth.session) == null ? void 0 : _b.accessToken) || "";
  const urlShop = url.searchParams.get("shop") || "";
  const context = getShopContext({ sessionShop, sessionToken, urlShop });
  return {
    auth,
    admin: auth.admin,
    shop: context.storeDomain,
    token: context.token,
    apiVersion: context.apiVersion,
    configError: context.configError
  };
}
const PLAN_PRO$2 = "Ecom SEO Pro";
const ALLOWED_BILLING_CURRENCIES = /* @__PURE__ */ new Set([
  "AUD",
  "CAD",
  "CHF",
  "CZK",
  "DKK",
  "EUR",
  "GBP",
  "INR",
  "JPY",
  "NOK",
  "PLN",
  "RON",
  "SEK",
  "SGD",
  "USD"
]);
function sanitizeCurrencyCode(currencyCode) {
  const code = String(currencyCode || "USD").trim().toUpperCase();
  return ALLOWED_BILLING_CURRENCIES.has(code) ? code : "USD";
}
const BILLING_CACHE_TTL_MS = 6e4;
const billingStatusCache = /* @__PURE__ */ new Map();
function invalidateBillingCache(shop) {
  const key = String(shop || "").trim().toLowerCase();
  if (key) {
    billingStatusCache.delete(key);
  }
}
async function getCachedActiveAppSubscriptions({
  admin,
  storeDomain,
  token,
  apiVersion
}) {
  const key = String(storeDomain || "").trim().toLowerCase();
  if (key) {
    const cached = billingStatusCache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.subscriptions;
    }
  }
  const subscriptions = await getActiveAppSubscriptions({
    admin,
    storeDomain,
    token,
    apiVersion
  });
  if (key) {
    billingStatusCache.set(key, {
      subscriptions,
      expiresAt: Date.now() + BILLING_CACHE_TTL_MS
    });
  }
  return subscriptions;
}
async function getActiveAppSubscriptions({
  admin,
  storeDomain,
  token,
  apiVersion
}) {
  var _a2, _b, _c;
  const query = `
    query GetActiveSubscriptions {
      currentAppInstallation {
        activeSubscriptions {
          id
          name
          status
          trialDays
          currentPeriodEnd
        }
      }
    }
  `;
  if (admin) {
    const json = await adminGraphqlRequest(admin, query, {});
    return ((_b = (_a2 = json == null ? void 0 : json.data) == null ? void 0 : _a2.currentAppInstallation) == null ? void 0 : _b.activeSubscriptions) || [];
  }
  const data2 = await shopifyGraphqlRequest({
    storeDomain,
    token,
    apiVersion,
    query,
    variables: {}
  });
  return ((_c = data2 == null ? void 0 : data2.currentAppInstallation) == null ? void 0 : _c.activeSubscriptions) || [];
}
async function getShopCurrencyCode({
  admin,
  storeDomain,
  token,
  apiVersion
}) {
  var _a2, _b, _c;
  const query = `
    query GetShopCurrency {
      shop {
        currencyCode
      }
    }
  `;
  if (admin) {
    const json = await adminGraphqlRequest(admin, query, {});
    return sanitizeCurrencyCode((_b = (_a2 = json == null ? void 0 : json.data) == null ? void 0 : _a2.shop) == null ? void 0 : _b.currencyCode);
  }
  const data2 = await shopifyGraphqlRequest({
    storeDomain,
    token,
    apiVersion,
    query,
    variables: {}
  });
  return sanitizeCurrencyCode((_c = data2 == null ? void 0 : data2.shop) == null ? void 0 : _c.currencyCode);
}
async function adminGraphqlRequest(admin, mutation, variables) {
  var _a2, _b;
  const maxRetries = 3;
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      const response = await admin.graphql(mutation, { variables });
      if (response.status === 429 && attempt < maxRetries) {
        const retrySec = Number(((_b = (_a2 = response.headers) == null ? void 0 : _a2.get) == null ? void 0 : _b.call(_a2, "retry-after")) || 0);
        const waitMs = Number.isFinite(retrySec) && retrySec > 0 ? retrySec * 1e3 : 1e3 * (attempt + 1);
        await new Promise((resolve) => setTimeout(resolve, waitMs));
        continue;
      }
      const json = await response.json();
      if (Array.isArray(json == null ? void 0 : json.errors) && json.errors.length) {
        const throttled = json.errors.some(
          (e) => {
            var _a3;
            return ((_a3 = e == null ? void 0 : e.extensions) == null ? void 0 : _a3.code) === "THROTTLED" || /throttled/i.test(String((e == null ? void 0 : e.message) || ""));
          }
        );
        if (throttled && attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, 1e3 * (attempt + 1)));
          continue;
        }
        const msgs = json.errors.map((e) => e.message).join(", ");
        throw new Error(`Shopify GraphQL error: ${msgs}`);
      }
      if (json == null ? void 0 : json.errors) {
        throw new Error(`Shopify GraphQL error: ${String(json.errors)}`);
      }
      return json;
    } catch (error) {
      if (error.graphQLErrors) {
        const throttled = error.graphQLErrors.some(
          (e) => {
            var _a3;
            return ((_a3 = e == null ? void 0 : e.extensions) == null ? void 0 : _a3.code) === "THROTTLED" || /throttled/i.test(String((e == null ? void 0 : e.message) || ""));
          }
        );
        if (throttled && attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, 1e3 * (attempt + 1)));
          continue;
        }
        const messages = error.graphQLErrors.map((e) => e.message).join(", ");
        throw new Error(`Shopify billing error: ${messages}`);
      }
      if (error.userErrors) {
        const messages = error.userErrors.map((e) => e.message).join(", ");
        throw new Error(`Shopify billing error: ${messages}`);
      }
      throw error;
    }
  }
}
async function createProSubscription({
  admin,
  storeDomain,
  token,
  apiVersion,
  returnUrl,
  currencyCode,
  trialDays = 7,
  test = false
}) {
  var _a2, _b;
  const mutation = `
    mutation AppSubscriptionCreate(
      $name: String!
      $lineItems: [AppSubscriptionLineItemInput!]!
      $returnUrl: URL!
      $trialDays: Int
      $test: Boolean
    ) {
      appSubscriptionCreate(
        name: $name
        returnUrl: $returnUrl
        lineItems: $lineItems
        trialDays: $trialDays
        test: $test
      ) {
        userErrors {
          field
          message
        }
        appSubscription {
          id
        }
        confirmationUrl
      }
    }
  `;
  const lineItems = [
    {
      plan: {
        appRecurringPricingDetails: {
          price: {
            amount: 12,
            currencyCode: sanitizeCurrencyCode(currencyCode)
          },
          interval: "EVERY_30_DAYS"
        }
      }
    }
  ];
  let payload;
  const variables = { name: PLAN_PRO$2, lineItems, returnUrl, trialDays, test };
  if (admin) {
    const json = await adminGraphqlRequest(admin, mutation, variables);
    payload = (_a2 = json == null ? void 0 : json.data) == null ? void 0 : _a2.appSubscriptionCreate;
  } else {
    const data2 = await shopifyGraphqlRequest({
      storeDomain,
      token,
      apiVersion,
      query: mutation,
      variables
    });
    payload = data2 == null ? void 0 : data2.appSubscriptionCreate;
  }
  const userErrors = (payload == null ? void 0 : payload.userErrors) || [];
  if (userErrors.length) {
    throw new Error(
      `Shopify billing error: ${userErrors.map((e) => e.message).join(", ")}`
    );
  }
  const confirmationUrl = payload == null ? void 0 : payload.confirmationUrl;
  if (!confirmationUrl) {
    throw new Error(
      "Shopify billing error: Missing confirmationUrl for pro plan"
    );
  }
  return {
    confirmationUrl,
    appSubscriptionId: ((_b = payload == null ? void 0 : payload.appSubscription) == null ? void 0 : _b.id) || null
  };
}
async function cancelAppSubscription({
  admin,
  storeDomain,
  token,
  apiVersion,
  subscriptionId
}) {
  var _a2;
  const mutation = `
    mutation AppSubscriptionCancel($id: ID!) {
      appSubscriptionCancel(id: $id) {
        userErrors {
          field
          message
        }
        appSubscription {
          id
          status
        }
      }
    }
  `;
  let payload;
  const variables = { id: subscriptionId };
  if (admin) {
    const json = await adminGraphqlRequest(admin, mutation, variables);
    payload = (_a2 = json == null ? void 0 : json.data) == null ? void 0 : _a2.appSubscriptionCancel;
  } else {
    const data2 = await shopifyGraphqlRequest({
      storeDomain,
      token,
      apiVersion,
      query: mutation,
      variables
    });
    payload = data2 == null ? void 0 : data2.appSubscriptionCancel;
  }
  const userErrors = (payload == null ? void 0 : payload.userErrors) || [];
  if (userErrors.length) {
    throw new Error(
      `Shopify billing error: ${userErrors.map((e) => e.message).join(", ")}`
    );
  }
  return payload == null ? void 0 : payload.appSubscription;
}
async function runBillingGraphql({ admin, storeDomain, token, apiVersion, query, variables = {} }) {
  if (admin) {
    const json = await adminGraphqlRequest(admin, query, variables);
    return (json == null ? void 0 : json.data) || {};
  }
  return shopifyGraphqlRequest({
    storeDomain,
    token,
    apiVersion,
    query,
    variables
  });
}
async function createCreditPackPurchase({
  admin,
  storeDomain,
  token,
  apiVersion,
  returnUrl,
  currencyCode,
  amount = 5,
  packName = "100 AI Tokens Package",
  test = false
}) {
  var _a2;
  const mutation = `
    mutation AppPurchaseOneTimeCreate(
      $name: String!
      $price: MoneyInput!
      $returnUrl: URL!
      $test: Boolean
    ) {
      appPurchaseOneTimeCreate(
        name: $name
        price: $price
        returnUrl: $returnUrl
        test: $test
      ) {
        userErrors {
          field
          message
        }
        appPurchaseOneTime {
          id
          status
        }
        confirmationUrl
      }
    }
  `;
  const variables = {
    name: packName,
    price: {
      amount,
      currencyCode: sanitizeCurrencyCode(currencyCode)
    },
    returnUrl,
    test
  };
  const data2 = await runBillingGraphql({
    admin,
    storeDomain,
    token,
    apiVersion,
    query: mutation,
    variables
  });
  const payload = data2 == null ? void 0 : data2.appPurchaseOneTimeCreate;
  const userErrors = (payload == null ? void 0 : payload.userErrors) || [];
  if (userErrors.length) {
    throw new Error(
      `Shopify billing error: ${userErrors.map((e) => e.message).join(", ")}`
    );
  }
  const confirmationUrl = payload == null ? void 0 : payload.confirmationUrl;
  if (!confirmationUrl) {
    throw new Error("Shopify billing error: Missing confirmationUrl for credit pack purchase.");
  }
  return {
    confirmationUrl,
    purchaseId: ((_a2 = payload == null ? void 0 : payload.appPurchaseOneTime) == null ? void 0 : _a2.id) || null
  };
}
async function getOneTimePurchases({
  admin,
  storeDomain,
  token,
  apiVersion
}) {
  var _a2, _b;
  const query = `
    query GetOneTimePurchases {
      currentAppInstallation {
        oneTimePurchases(first: 20, sortKey: CREATED_AT, reverse: true) {
          nodes {
            id
            name
            status
            price {
              amount
              currencyCode
            }
            createdAt
          }
        }
      }
    }
  `;
  const data2 = await runBillingGraphql({
    admin,
    storeDomain,
    token,
    apiVersion,
    query
  });
  return ((_b = (_a2 = data2 == null ? void 0 : data2.currentAppInstallation) == null ? void 0 : _a2.oneTimePurchases) == null ? void 0 : _b.nodes) || [];
}
const links$c = () => [{
  rel: "stylesheet",
  href: seoStyles
}, {
  rel: "stylesheet",
  href: toastStyles
}];
const loader$e = async ({
  request
}) => {
  var _a2, _b;
  const url = new URL(request.url);
  let creditAccount = null;
  let storeControl = null;
  try {
    const {
      admin,
      shop,
      token,
      apiVersion
    } = await requireShopContext(request);
    if (shop) {
      storeControl = await getOrCreateStoreControl(shop);
      let hasBillingSub = false;
      if (token) {
        try {
          const activeSubscriptions = await getCachedActiveAppSubscriptions({
            admin,
            storeDomain: shop,
            token,
            apiVersion
          });
          hasBillingSub = Boolean(activeSubscriptions == null ? void 0 : activeSubscriptions.length);
        } catch {
          hasBillingSub = false;
        }
      }
      const effectivePro = hasBillingSub || Boolean(storeControl == null ? void 0 : storeControl.superAccess);
      creditAccount = await getOrCreateCreditAccount(shop, effectivePro ? "PRO" : "FREE");
      if (hasBillingSub && creditAccount.plan !== "PRO") {
        await syncPlanSubscription(shop, true);
        creditAccount = await getOrCreateCreditAccount(shop, "PRO");
      }
    }
  } catch (error) {
    if (error instanceof Response) throw error;
  }
  const matchedFeature = PLATFORM_FEATURES.find((f) => f.key !== "ai_features" && url.pathname.startsWith(f.path));
  const routeBlocked = (storeControl == null ? void 0 : storeControl.accessLevel) === "SUSPENDED" || Boolean(matchedFeature && !isFeatureAllowed(storeControl, matchedFeature.key));
  return {
    apiKey: ((_b = (_a2 = globalThis.process) == null ? void 0 : _a2.env) == null ? void 0 : _b.SHOPIFY_API_KEY) || "",
    creditAccount: creditAccount ? {
      availableCredits: creditAccount.availableCredits,
      totalCredits: creditAccount.totalCredits,
      bonusCredits: creditAccount.bonusCredits,
      effectiveTotal: creditAccount.effectiveTotal,
      usedCredits: creditAccount.usedCredits,
      plan: creditAccount.plan
    } : null,
    storeControl: storeControl ? {
      accessLevel: storeControl.accessLevel,
      superAccess: storeControl.superAccess,
      allowedFeatures: storeControl.allowedFeatures
    } : null,
    routeBlocked,
    blockedFeatureLabel: (matchedFeature == null ? void 0 : matchedFeature.label) || ""
  };
};
const app = UNSAFE_withComponentProps(function App3() {
  const {
    apiKey,
    creditAccount,
    storeControl,
    routeBlocked,
    blockedFeatureLabel
  } = useLoaderData();
  const isSuspended = (storeControl == null ? void 0 : storeControl.accessLevel) === "SUSPENDED";
  const allowedSet = new Set((storeControl == null ? void 0 : storeControl.allowedFeatures) || []);
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
      message: isSuspended ? "Access to Ecom SEO for this store has been suspended by the administrator." : `The "${blockedFeatureLabel}" module is disabled under Partial Access.`
    });
  }, [routeBlocked, isSuspended, blockedFeatureLabel]);
  return /* @__PURE__ */ jsxs(AppProvider, {
    embedded: true,
    apiKey,
    children: [/* @__PURE__ */ jsxs("s-app-nav", {
      children: [!isSuspended ? /* @__PURE__ */ jsx("s-link", {
        href: "/app",
        children: "Home"
      }) : null, canSee("seo_audit") ? /* @__PURE__ */ jsx("s-link", {
        href: "/app/seo-audit",
        children: "AI Audit"
      }) : null, canSee("products") ? /* @__PURE__ */ jsx("s-link", {
        href: "/app/products",
        children: "Product SEO"
      }) : null, canSee("bulk_meta") ? /* @__PURE__ */ jsx("s-link", {
        href: "/app/bulk-meta",
        children: "Bulk Meta"
      }) : null, canSee("image_optimizer") ? /* @__PURE__ */ jsx("s-link", {
        href: "/app/image-optimizer",
        children: "Image ALT"
      }) : null, canSee("url_optimization") ? /* @__PURE__ */ jsx("s-link", {
        href: "/app/url-optimization",
        children: "URLs & 301s"
      }) : null, canSee("pagespeed") ? /* @__PURE__ */ jsx("s-link", {
        href: "/app/pagespeed",
        children: "PageSpeed"
      }) : null, canSee("robots") ? /* @__PURE__ */ jsx("s-link", {
        href: "/app/robots",
        children: "Robots.txt"
      }) : null, canSee("sitemap") ? /* @__PURE__ */ jsx("s-link", {
        href: "/app/sitemap",
        children: "XML Sitemap"
      }) : null, canSee("revisions") ? /* @__PURE__ */ jsx("s-link", {
        href: "/app/revisions",
        children: "History"
      }) : null, !isSuspended ? /* @__PURE__ */ jsx("s-link", {
        href: "/app/billing",
        children: "Subscription"
      }) : null]
    }), routeBlocked ? /* @__PURE__ */ jsxs("div", {
      style: {
        maxWidth: 640,
        margin: "48px auto",
        padding: 24,
        background: "#fff",
        borderRadius: 12,
        border: "1px solid #e2e8f0",
        fontFamily: "Inter, sans-serif"
      },
      children: [/* @__PURE__ */ jsx("h2", {
        style: {
          marginTop: 0,
          color: "#991b1b"
        },
        children: isSuspended ? "Store Access Suspended" : "Feature Restricted (Partial Access)"
      }), /* @__PURE__ */ jsx("p", {
        style: {
          color: "#475569",
          lineHeight: 1.6
        },
        children: isSuspended ? "Access to Ecom SEO for this store has been suspended by the app administrator. Please contact support to restore access." : `Your store currently has Partial Access enabled. The "${blockedFeatureLabel}" module is disabled by the administrator.`
      }), !isSuspended ? /* @__PURE__ */ jsx(Link, {
        to: "/app",
        style: {
          display: "inline-block",
          marginTop: 8,
          padding: "9px 16px",
          background: "#0f766e",
          color: "#fff",
          borderRadius: 8,
          textDecoration: "none",
          fontWeight: 600,
          fontSize: 13
        },
        children: "Return to Dashboard"
      }) : null]
    }) : /* @__PURE__ */ jsxs(Fragment, {
      children: [/* @__PURE__ */ jsx(AppMenuShell, {
        creditAccount,
        storeControl
      }), /* @__PURE__ */ jsx(Outlet, {})]
    }), /* @__PURE__ */ jsx(SeoToastViewport, {})]
  });
});
const ErrorBoundary2 = UNSAFE_withErrorBoundaryProps(function ErrorBoundary3() {
  return boundary.error(useRouteError());
});
const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
const route16 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  ErrorBoundary: ErrorBoundary2,
  default: app,
  headers,
  links: links$c,
  loader: loader$e
}, Symbol.toStringTag, { value: "Module" }));
const links$b = () => [{
  rel: "stylesheet",
  href: seoStyles
}];
const loader$d = async ({
  request
}) => {
  const {
    shop,
    token,
    apiVersion,
    configError
  } = await requireShopContext(request);
  if (configError) {
    return {
      configError,
      rows: []
    };
  }
  try {
    const result = await loadProductsPage({
      shop,
      storeDomain: shop,
      token,
      apiVersion,
      limit: 50,
      includeDescription: false
    });
    return {
      configError: "",
      rows: result.rows.map((row) => ({
        ...row,
        suggestedHandle: normalizeHandle(row.focusKeyword ? `${row.focusKeyword} ${row.title}` : row.title)
      }))
    };
  } catch (error) {
    return {
      configError: (error == null ? void 0 : error.message) || "Unable to load Shopify products.",
      rows: []
    };
  }
};
const action$b = async ({
  request
}) => {
  const {
    shop,
    token,
    apiVersion,
    configError
  } = await requireShopContext(request);
  if (configError) {
    return {
      ok: false,
      error: configError
    };
  }
  const formData = await request.formData();
  const rows = JSON.parse(String(formData.get("rows") || "[]"));
  try {
    return await applyUrlOptimizationsAndRescan({
      shop,
      storeDomain: shop,
      token,
      apiVersion,
      rows
    });
  } catch (error) {
    return {
      ok: false,
      error: (error == null ? void 0 : error.message) || "Failed to apply URL optimizations."
    };
  }
};
const app_urlOptimization = UNSAFE_withComponentProps(function UrlOptimizationRoute() {
  var _a2, _b;
  const data2 = useLoaderData();
  const fetcher = useFetcher();
  const [selected, setSelected] = useState({});
  const [manualHandles, setManualHandles] = useState({});
  const rows = useMemo(() => data2.rows || [], [data2.rows]);
  function toggle(id, checked) {
    setSelected((current) => ({
      ...current,
      [id]: checked
    }));
  }
  function handleManualChange(id, value) {
    setManualHandles((current) => ({
      ...current,
      [id]: value
    }));
  }
  function getHandleToApply(row) {
    return manualHandles[row.id] !== void 0 ? manualHandles[row.id] : row.suggestedHandle;
  }
  function applySingle(row) {
    fetcher.submit({
      rows: JSON.stringify([{
        id: row.id,
        title: row.title,
        handle: row.handle,
        suggestedHandle: getHandleToApply(row),
        metaTitle: row.metaTitle,
        metaDescription: row.metaDescription
      }])
    }, {
      method: "post"
    });
  }
  function applySelected() {
    const chosen = rows.filter((row) => selected[row.id]);
    fetcher.submit({
      rows: JSON.stringify(chosen.map((row) => ({
        id: row.id,
        title: row.title,
        handle: row.handle,
        suggestedHandle: getHandleToApply(row),
        metaTitle: row.metaTitle,
        metaDescription: row.metaDescription
      })))
    }, {
      method: "post"
    });
  }
  return /* @__PURE__ */ jsxs(Fragment, {
    children: [/* @__PURE__ */ jsx("ui-title-bar", {
      title: "Products & Media — URLs & 301s"
    }), /* @__PURE__ */ jsxs("div", {
      className: "seo-wrap seo-grid",
      children: [/* @__PURE__ */ jsx(WorkspaceSubnav, {
        group: "products"
      }), data2.configError ? /* @__PURE__ */ jsx("div", {
        className: "error-box",
        children: data2.configError
      }) : null, /* @__PURE__ */ jsx("div", {
        className: "toolbar",
        children: /* @__PURE__ */ jsx("button", {
          className: "seo-button",
          type: "button",
          onClick: applySelected,
          children: "Bulk apply selected URLs"
        })
      }), ((_a2 = fetcher.data) == null ? void 0 : _a2.error) ? /* @__PURE__ */ jsx("div", {
        className: "error-box",
        children: fetcher.data.error
      }) : null, ((_b = fetcher.data) == null ? void 0 : _b.ok) ? /* @__PURE__ */ jsxs("div", {
        className: "status-banner banner-good",
        "data-toast-title": "URLs Updated",
        children: ["Updated ", fetcher.data.updated, " URLs successfully."]
      }) : null, !rows.length ? /* @__PURE__ */ jsx("div", {
        className: "empty-box",
        children: "No products found."
      }) : /* @__PURE__ */ jsx("div", {
        className: "table-card table-wrap",
        children: /* @__PURE__ */ jsxs("table", {
          children: [/* @__PURE__ */ jsx("thead", {
            children: /* @__PURE__ */ jsxs("tr", {
              children: [/* @__PURE__ */ jsx("th", {
                style: {
                  width: "60px"
                },
                children: "Select"
              }), /* @__PURE__ */ jsx("th", {
                style: {
                  width: "25%"
                },
                children: "Product"
              }), /* @__PURE__ */ jsx("th", {
                style: {
                  width: "20%"
                },
                children: "Current handle"
              }), /* @__PURE__ */ jsx("th", {
                style: {
                  width: "35%"
                },
                children: "New handle (Auto / Manual)"
              }), /* @__PURE__ */ jsx("th", {
                style: {
                  width: "120px"
                },
                children: "Action"
              })]
            })
          }), /* @__PURE__ */ jsx("tbody", {
            children: rows.map((row) => {
              const currentNewHandle = getHandleToApply(row);
              const isDirty = row.handle !== currentNewHandle;
              return /* @__PURE__ */ jsxs("tr", {
                style: {
                  background: isDirty ? "rgba(255, 244, 229, 0.6)" : "transparent"
                },
                children: [/* @__PURE__ */ jsx("td", {
                  children: /* @__PURE__ */ jsx("input", {
                    type: "checkbox",
                    checked: Boolean(selected[row.id]),
                    onChange: (event) => toggle(row.id, event.target.checked)
                  })
                }), /* @__PURE__ */ jsx("td", {
                  children: row.title
                }), /* @__PURE__ */ jsx("td", {
                  children: /* @__PURE__ */ jsx("span", {
                    style: {
                      color: "var(--seo-muted)",
                      fontSize: "13px"
                    },
                    children: row.handle
                  })
                }), /* @__PURE__ */ jsx("td", {
                  children: /* @__PURE__ */ jsx("input", {
                    type: "text",
                    className: "seo-input",
                    style: {
                      padding: "6px 8px",
                      fontSize: "13px",
                      width: "100%",
                      borderColor: isDirty ? "var(--seo-primary)" : "var(--seo-border)"
                    },
                    value: currentNewHandle,
                    onChange: (e) => handleManualChange(row.id, e.target.value)
                  })
                }), /* @__PURE__ */ jsx("td", {
                  children: /* @__PURE__ */ jsx("button", {
                    className: "seo-button secondary",
                    style: {
                      padding: "6px 12px",
                      fontSize: "12px",
                      width: "100%"
                    },
                    onClick: () => applySingle(row),
                    disabled: !isDirty,
                    children: isDirty ? "Apply" : "Optimized"
                  })
                })]
              }, row.id);
            })
          })]
        })
      })]
    })]
  });
});
const route17 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$b,
  default: app_urlOptimization,
  links: links$b,
  loader: loader$d
}, Symbol.toStringTag, { value: "Module" }));
const links$a = () => [{
  rel: "stylesheet",
  href: seoStyles
}];
function defaultSummary() {
  return {
    total: 0,
    missing: 0,
    tooLong: 0,
    generic: 0,
    tooShort: 0,
    ideal: 0,
    needsFix: 0
  };
}
function normalizeStatusFilter(value) {
  const clean = String(value || "all").trim().toLowerCase();
  if (clean === "needs-fix" || clean === "healthy") return clean;
  return "all";
}
function normalizePageData(raw) {
  return {
    configError: (raw == null ? void 0 : raw.configError) || "",
    query: (raw == null ? void 0 : raw.query) || "",
    statusFilter: normalizeStatusFilter((raw == null ? void 0 : raw.statusFilter) || "all"),
    rows: (raw == null ? void 0 : raw.rows) || [],
    pagination: (raw == null ? void 0 : raw.pagination) || {
      nextPageInfo: "",
      previousPageInfo: ""
    },
    summary: (raw == null ? void 0 : raw.summary) || defaultSummary(),
    history: (raw == null ? void 0 : raw.history) || [],
    lastRun: (raw == null ? void 0 : raw.lastRun) || null
  };
}
const loader$c = async ({
  request
}) => {
  const {
    shop,
    token,
    apiVersion,
    configError
  } = await requireShopContext(request);
  const url = new URL(request.url);
  const query = (url.searchParams.get("q") || "").trim();
  const pageInfo = url.searchParams.get("page_info") || "";
  const statusFilter = normalizeStatusFilter(url.searchParams.get("status") || "all");
  if (configError) {
    return normalizePageData({
      configError,
      query,
      statusFilter,
      rows: [],
      pagination: {
        nextPageInfo: "",
        previousPageInfo: ""
      },
      summary: defaultSummary(),
      history: [],
      lastRun: null
    });
  }
  try {
    const result = await loadImageOptimizerPage({
      shop,
      storeDomain: shop,
      token,
      apiVersion,
      limit: 25,
      pageInfo,
      query,
      statusFilter
    });
    return normalizePageData({
      configError: "",
      query,
      statusFilter: result.statusFilter,
      rows: result.rows,
      pagination: result.pagination,
      summary: result.summary,
      history: result.history,
      lastRun: result.lastRun
    });
  } catch (error) {
    return normalizePageData({
      configError: (error == null ? void 0 : error.message) || "Unable to load Shopify product images.",
      query,
      statusFilter,
      rows: [],
      pagination: {
        nextPageInfo: "",
        previousPageInfo: ""
      },
      summary: defaultSummary(),
      history: [],
      lastRun: null
    });
  }
};
function shouldRevalidate$1({
  formMethod,
  defaultShouldRevalidate
}) {
  if (String(formMethod || "").toUpperCase() === "POST") {
    return false;
  }
  return defaultShouldRevalidate;
}
const action$a = async ({
  request
}) => {
  const {
    shop,
    token,
    apiVersion,
    configError
  } = await requireShopContext(request);
  if (configError) {
    return {
      ok: false,
      error: configError
    };
  }
  try {
    const formData = await request.formData();
    const intent = String(formData.get("intent") || "checkAlt");
    const rows = JSON.parse(String(formData.get("rows") || "[]"));
    if (intent === "checkAlt") {
      const result = await runImageAltCheck({
        shop,
        rows
      });
      return {
        ...result,
        intent
      };
    }
    if (intent === "fixAlt") {
      const result = await applyImageAltFixesAndRescan({
        shop,
        storeDomain: shop,
        token,
        apiVersion,
        rows
      });
      return {
        ...result,
        intent
      };
    }
    return {
      ok: false,
      error: "Unknown action."
    };
  } catch (error) {
    return {
      ok: false,
      error: (error == null ? void 0 : error.message) || "Failed to process image optimizer action."
    };
  }
};
function statusTone(status) {
  if ((status == null ? void 0 : status.missing) || (status == null ? void 0 : status.tooLong)) return "critical";
  if ((status == null ? void 0 : status.generic) || (status == null ? void 0 : status.tooShort) || !(status == null ? void 0 : status.ideal)) return "warning";
  return "ok";
}
function statusLabel(status) {
  if (!status) return "Unchecked";
  if (status.missing) return "Missing ALT";
  if (status.tooLong) return "Too long";
  if (status.generic) return "Generic ALT";
  if (status.tooShort) return "Too short";
  if (!status.ideal) return "Can improve";
  return "Healthy";
}
function formatDate(value) {
  if (!value) return "N/A";
  return new Date(value).toLocaleString();
}
function toPatternAlt(row, pattern) {
  const cleanPattern = String(pattern || "").trim();
  if (!cleanPattern) {
    return suggestImageAltText({
      productTitle: row.productTitle,
      position: row.position,
      currentAlt: row.suggestedAlt || row.altText
    });
  }
  const draft = cleanPattern.replaceAll("{title}", String(row.productTitle || "Product")).replaceAll("{position}", String(row.position || 1)).replaceAll("{handle}", String(row.productHandle || ""));
  const normalized = draft.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return suggestImageAltText({
      productTitle: row.productTitle,
      position: row.position,
      currentAlt: row.suggestedAlt || row.altText
    });
  }
  return normalized.length > 125 ? normalized.slice(0, 125).trimEnd() : normalized;
}
const app_imageOptimizer = UNSAFE_withComponentProps(function ImageOptimizerRoute() {
  var _a2, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m;
  const loaderData = useLoaderData();
  const actionFetcher = useFetcher();
  const listFetcher = useFetcher();
  const aiFetcher = useFetcher();
  const selectAllRef = useRef(null);
  const [pageData, setPageData] = useState(() => normalizePageData(loaderData));
  const [rows, setRows] = useState(() => loaderData.rows || []);
  const [searchQuery, setSearchQuery] = useState(loaderData.query || "");
  const [statusFilter, setStatusFilter] = useState(loaderData.statusFilter || "all");
  const [selected, setSelected] = useState({});
  const [localError, setLocalError] = useState("");
  const [bulkPattern, setBulkPattern] = useState("{title} - product image view {position}");
  const [activeIntent, setActiveIntent] = useState("");
  const [pendingFixRows, setPendingFixRows] = useState([]);
  const [aiImageId, setAiImageId] = useState("");
  const [lastVisionImageId, setLastVisionImageId] = useState("");
  const syncPageData = useCallback((raw) => {
    const next = normalizePageData(raw);
    setPageData(next);
    setRows(next.rows);
    setSearchQuery(next.query);
    setStatusFilter(next.statusFilter);
    setSelected({});
    setLocalError("");
  }, []);
  useEffect(() => {
    syncPageData(loaderData);
  }, [loaderData, syncPageData]);
  useEffect(() => {
    if (listFetcher.data) {
      syncPageData(listFetcher.data);
    }
  }, [listFetcher.data, syncPageData]);
  useEffect(() => {
    if (actionFetcher.state === "idle") {
      setActiveIntent("");
    }
  }, [actionFetcher.state]);
  useEffect(() => {
    var _a3, _b2;
    if (((_a3 = actionFetcher.data) == null ? void 0 : _a3.intent) === "fixAlt") {
      if (((_b2 = actionFetcher.data) == null ? void 0 : _b2.ok) && pendingFixRows.length) {
        const fixedById = new Map(pendingFixRows.map((row) => [String(row.id), String(row.altText || "").trim()]));
        setRows((current) => current.map((row) => {
          const nextAlt = fixedById.get(String(row.id));
          if (!nextAlt) return row;
          return {
            ...row,
            altText: nextAlt,
            suggestedAlt: nextAlt,
            validation: validateImageAlt(nextAlt)
          };
        }));
        setSelected({});
      }
      setPendingFixRows([]);
    }
  }, [actionFetcher.data, pendingFixRows]);
  const checkedStatusById = useMemo(() => {
    var _a3, _b2;
    return ((_a3 = actionFetcher.data) == null ? void 0 : _a3.intent) === "checkAlt" && ((_b2 = actionFetcher.data) == null ? void 0 : _b2.ok) ? actionFetcher.data.statusById || {} : {};
  }, [actionFetcher.data]);
  const summary = useMemo(() => {
    var _a3;
    if ((_a3 = actionFetcher.data) == null ? void 0 : _a3.summary) return actionFetcher.data.summary;
    return pageData.summary || defaultSummary();
  }, [actionFetcher.data, pageData.summary]);
  const history = useMemo(() => {
    var _a3;
    if (Array.isArray((_a3 = actionFetcher.data) == null ? void 0 : _a3.history)) return actionFetcher.data.history;
    return pageData.history || [];
  }, [actionFetcher.data, pageData.history]);
  const lastRun = useMemo(() => {
    var _a3;
    if ((_a3 = actionFetcher.data) == null ? void 0 : _a3.lastRun) return actionFetcher.data.lastRun;
    return pageData.lastRun;
  }, [actionFetcher.data, pageData.lastRun]);
  const selectedCount = rows.filter((row) => selected[row.id]).length;
  const allVisibleSelected = rows.length > 0 && selectedCount === rows.length;
  const someVisibleSelected = selectedCount > 0 && !allVisibleSelected;
  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someVisibleSelected;
    }
  }, [someVisibleSelected]);
  const resultSegments = useMemo(() => {
    const total = Math.max(1, Number(summary.total || 0));
    return [{
      key: "healthy",
      label: "Healthy",
      value: Number(summary.ideal || 0),
      color: "#13795b"
    }, {
      key: "needsFix",
      label: "Needs Fix",
      value: Number(summary.needsFix || 0),
      color: "#c77d00"
    }, {
      key: "missing",
      label: "Missing",
      value: Number(summary.missing || 0),
      color: "#a33636"
    }, {
      key: "generic",
      label: "Generic",
      value: Number(summary.generic || 0),
      color: "#7c5a00"
    }, {
      key: "tooLong",
      label: "Too Long",
      value: Number(summary.tooLong || 0),
      color: "#87413f"
    }, {
      key: "tooShort",
      label: "Too Short",
      value: Number(summary.tooShort || 0),
      color: "#8b6a16"
    }].map((segment) => ({
      ...segment,
      percent: Math.round(segment.value / total * 100)
    }));
  }, [summary]);
  function patchRow(id, patch) {
    setRows((current) => current.map((row) => row.id === id ? {
      ...row,
      ...patch
    } : row));
  }
  useEffect(() => {
    var _a3, _b2, _c2, _d2, _e2, _f2;
    if (((_a3 = aiFetcher.data) == null ? void 0 : _a3.ok) && ((_b2 = aiFetcher.data) == null ? void 0 : _b2.creditsRemaining) !== void 0) {
      dispatchCreditsUpdate({
        availableCredits: aiFetcher.data.creditsRemaining,
        plan: aiFetcher.data.plan,
        superAccess: Boolean(aiFetcher.data.superAccess)
      });
    }
    if (((_c2 = aiFetcher.data) == null ? void 0 : _c2.ok) && ((_d2 = aiFetcher.data) == null ? void 0 : _d2.actionType) === "vision_alt" && aiImageId) {
      const generatedAlt = (_e2 = aiFetcher.data.result) == null ? void 0 : _e2.altText;
      if (generatedAlt) {
        patchRow(aiImageId, {
          suggestedAlt: generatedAlt
        });
      }
      setLastVisionImageId(aiImageId);
      setAiImageId("");
      showToast({
        tone: "info",
        title: "Vision ALT Generated",
        message: "AI suggested ALT text populated for review."
      });
    }
    if ((_f2 = aiFetcher.data) == null ? void 0 : _f2.error) {
      setAiImageId("");
    }
  }, [aiFetcher.data, aiImageId]);
  function generateVisionAlt(row) {
    setAiImageId(row.id);
    aiFetcher.submit({
      payload: JSON.stringify({
        actionType: "vision_alt",
        imageUrl: row.imageUrl,
        productTitle: row.productTitle,
        productId: row.productId
      })
    }, {
      method: "post",
      action: "/app/api/ai"
    });
  }
  const updateAddressBar = useCallback((query, pageInfo = "", filter = "all") => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (query) {
      url.searchParams.set("q", query);
    } else {
      url.searchParams.delete("q");
    }
    if (pageInfo) {
      url.searchParams.set("page_info", pageInfo);
    } else {
      url.searchParams.delete("page_info");
    }
    if (filter && filter !== "all") {
      url.searchParams.set("status", filter);
    } else {
      url.searchParams.delete("status");
    }
    window.history.pushState({}, "", `${url.pathname}${url.search}`);
  }, []);
  const loadList = useCallback((query, pageInfo = "", filter = "all") => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (pageInfo) params.set("page_info", pageInfo);
    if (filter && filter !== "all") params.set("status", filter);
    const href = params.toString() ? `/app/image-optimizer?${params.toString()}` : "/app/image-optimizer";
    listFetcher.load(href);
    updateAddressBar(query, pageInfo, filter);
  }, [listFetcher, updateAddressBar]);
  function submitCheck() {
    setLocalError("");
    setActiveIntent("checkAlt");
    actionFetcher.submit({
      intent: "checkAlt",
      rows: JSON.stringify(rows.map((row) => ({
        id: row.id,
        productId: row.productId,
        productTitle: row.productTitle,
        position: row.position,
        altText: row.altText,
        suggestedAlt: row.suggestedAlt
      })))
    }, {
      method: "post"
    });
  }
  function applyPatternToAllSuggestions() {
    setRows((current) => current.map((row) => ({
      ...row,
      suggestedAlt: toPatternAlt(row, bulkPattern)
    })));
  }
  function setSelectAll(checked) {
    setSelected((current) => {
      const next = {
        ...current
      };
      if (checked) {
        for (const row of rows) {
          next[row.id] = true;
        }
      } else {
        for (const row of rows) {
          delete next[row.id];
        }
      }
      return next;
    });
  }
  function selectIssuesOnly() {
    const next = {};
    for (const row of rows) {
      const status = checkedStatusById[row.id] || validateImageAlt(row.altText);
      const needsFix = !status.valid || status.generic || status.tooShort;
      if (needsFix) {
        next[row.id] = true;
      }
    }
    setSelected(next);
  }
  function submitFix(payloadRows) {
    setLocalError("");
    setPendingFixRows(payloadRows);
    setActiveIntent("fixAlt");
    actionFetcher.submit({
      intent: "fixAlt",
      rows: JSON.stringify(payloadRows)
    }, {
      method: "post"
    });
  }
  function applySelectedFixes() {
    const chosen = rows.filter((row) => selected[row.id]);
    if (!chosen.length) {
      setLocalError("Select at least one image row before applying fixes.");
      return;
    }
    const payloadRows = chosen.map((row) => ({
      id: row.id,
      productId: row.productId,
      altText: String(row.suggestedAlt || toPatternAlt(row, bulkPattern)).trim()
    }));
    submitFix(payloadRows);
  }
  function applyAllVisibleFixes() {
    if (!rows.length) {
      setLocalError("No rows available to update on this page.");
      return;
    }
    const payloadRows = rows.map((row) => ({
      id: row.id,
      productId: row.productId,
      altText: String(row.suggestedAlt || toPatternAlt(row, bulkPattern)).trim()
    }));
    submitFix(payloadRows);
  }
  function handleSearchSubmit(event) {
    event.preventDefault();
    loadList(searchQuery.trim(), "", statusFilter);
  }
  function handleStatusChange(event) {
    const nextFilter = normalizeStatusFilter(event.target.value);
    setStatusFilter(nextFilter);
    loadList(searchQuery.trim(), "", nextFilter);
  }
  const actionBusy = actionFetcher.state !== "idle";
  const liveStatus = actionBusy ? activeIntent === "fixAlt" ? "Updating ALT..." : "Checking ALT..." : ((_a2 = actionFetcher.data) == null ? void 0 : _a2.error) ? "Last run failed" : ((_b = actionFetcher.data) == null ? void 0 : _b.ok) ? "Last run successful" : "Idle";
  const liveStatusTone = ((_c = actionFetcher.data) == null ? void 0 : _c.error) ? "critical" : actionBusy ? "warning" : "ok";
  return /* @__PURE__ */ jsxs(Fragment, {
    children: [/* @__PURE__ */ jsx("ui-title-bar", {
      title: "Products & Media — Image Optimizer"
    }), /* @__PURE__ */ jsxs("div", {
      className: "seo-wrap seo-grid",
      children: [/* @__PURE__ */ jsx(WorkspaceSubnav, {
        group: "products"
      }), pageData.configError ? /* @__PURE__ */ jsx("div", {
        className: "error-box",
        children: pageData.configError
      }) : null, localError ? /* @__PURE__ */ jsx("div", {
        className: "error-box",
        children: localError
      }) : null, ((_d = actionFetcher.data) == null ? void 0 : _d.error) ? /* @__PURE__ */ jsx("div", {
        className: "error-box",
        children: actionFetcher.data.error
      }) : null, ((_e = aiFetcher.data) == null ? void 0 : _e.error) ? /* @__PURE__ */ jsxs("div", {
        className: "error-box",
        children: [aiFetcher.data.error, " ", ((_f = aiFetcher.data) == null ? void 0 : _f.outOfCredits) ? /* @__PURE__ */ jsx(Link, {
          to: "/app/billing",
          children: "Upgrade or manage credits"
        }) : null]
      }) : null, /* @__PURE__ */ jsxs("form", {
        method: "get",
        className: "toolbar",
        onSubmit: handleSearchSubmit,
        children: [/* @__PURE__ */ jsx("input", {
          className: "seo-input",
          name: "q",
          placeholder: "Search product title",
          value: searchQuery,
          onChange: (event) => setSearchQuery(event.target.value),
          style: {
            maxWidth: 320
          }
        }), /* @__PURE__ */ jsxs("select", {
          className: "seo-input",
          value: statusFilter,
          onChange: handleStatusChange,
          style: {
            maxWidth: 220
          },
          children: [/* @__PURE__ */ jsx("option", {
            value: "all",
            children: "All statuses"
          }), /* @__PURE__ */ jsx("option", {
            value: "needs-fix",
            children: "Needs fixes only"
          }), /* @__PURE__ */ jsx("option", {
            value: "healthy",
            children: "Healthy only"
          })]
        }), /* @__PURE__ */ jsx("button", {
          className: "seo-button",
          type: "submit",
          disabled: listFetcher.state !== "idle",
          children: listFetcher.state !== "idle" ? "Loading..." : "Search"
        })]
      }), /* @__PURE__ */ jsxs("div", {
        className: "seo-grid grid-3",
        children: [/* @__PURE__ */ jsxs("div", {
          className: "metric-card",
          children: [/* @__PURE__ */ jsx("p", {
            className: "metric-label",
            children: "Live Status"
          }), /* @__PURE__ */ jsx("h3", {
            children: liveStatus
          }), /* @__PURE__ */ jsx("small", {
            className: `issue-chip ${liveStatusTone}`,
            children: actionBusy ? "Running" : "Ready"
          }), /* @__PURE__ */ jsxs("p", {
            className: "metric-help",
            children: ["Last run: ", formatDate(lastRun == null ? void 0 : lastRun.createdAt)]
          })]
        }), /* @__PURE__ */ jsxs("div", {
          className: "metric-card",
          children: [/* @__PURE__ */ jsx("p", {
            className: "metric-label",
            children: "Current Results"
          }), /* @__PURE__ */ jsxs("h3", {
            children: [summary.needsFix || 0, " Need Fixes"]
          }), /* @__PURE__ */ jsxs("p", {
            className: "metric-help",
            children: [summary.ideal || 0, " healthy out of ", summary.total || 0, " checked rows"]
          })]
        }), /* @__PURE__ */ jsxs("div", {
          className: "metric-card",
          children: [/* @__PURE__ */ jsx("p", {
            className: "metric-label",
            children: "Selection"
          }), /* @__PURE__ */ jsxs("h3", {
            children: [selectedCount, " Selected"]
          }), /* @__PURE__ */ jsx("p", {
            className: "metric-help",
            children: "Use Select all or Select issues for bulk updates."
          })]
        })]
      }), /* @__PURE__ */ jsxs("div", {
        className: "section-card",
        children: [/* @__PURE__ */ jsxs("div", {
          className: "toolbar",
          style: {
            justifyContent: "space-between"
          },
          children: [/* @__PURE__ */ jsx("h3", {
            style: {
              margin: 0
            },
            children: "Result Chart"
          }), /* @__PURE__ */ jsxs("small", {
            children: [summary.total || 0, " row(s) in current view"]
          })]
        }), /* @__PURE__ */ jsx("div", {
          className: "image-results-track",
          children: resultSegments.map((segment) => /* @__PURE__ */ jsx("div", {
            className: "image-results-segment",
            style: {
              width: `${segment.percent}%`,
              background: segment.color
            },
            title: `${segment.label}: ${segment.value}`
          }, segment.key))
        }), /* @__PURE__ */ jsx("div", {
          className: "image-results-grid",
          children: resultSegments.map((segment) => /* @__PURE__ */ jsxs("small", {
            children: [/* @__PURE__ */ jsxs("strong", {
              children: [segment.label, ":"]
            }), " ", segment.value, " (", segment.percent, "%)"]
          }, `legend-${segment.key}`))
        })]
      }), /* @__PURE__ */ jsxs("div", {
        className: "section-card",
        children: [/* @__PURE__ */ jsxs("div", {
          className: "toolbar",
          style: {
            justifyContent: "space-between"
          },
          children: [/* @__PURE__ */ jsx("h3", {
            style: {
              margin: 0
            },
            children: "Update All ALT At Once"
          }), /* @__PURE__ */ jsxs("small", {
            children: ["Tokens: ", "{title}", ", ", "{position}", ", ", "{handle}"]
          })]
        }), /* @__PURE__ */ jsxs("label", {
          className: "editor-field",
          children: [/* @__PURE__ */ jsx("span", {
            children: "Bulk ALT pattern"
          }), /* @__PURE__ */ jsx("input", {
            className: "seo-input",
            value: bulkPattern,
            onChange: (event) => setBulkPattern(event.target.value),
            placeholder: "{title} - product image view {position}"
          })]
        }), /* @__PURE__ */ jsxs("div", {
          className: "toolbar",
          children: [/* @__PURE__ */ jsx("button", {
            className: "seo-button secondary",
            type: "button",
            onClick: applyPatternToAllSuggestions,
            children: "Apply pattern to all suggestions"
          }), /* @__PURE__ */ jsx("button", {
            className: "seo-button secondary",
            type: "button",
            onClick: () => setSelectAll(true),
            children: "Select all on page"
          }), /* @__PURE__ */ jsx("button", {
            className: "seo-button secondary",
            type: "button",
            onClick: () => setSelectAll(false),
            children: "Clear selection"
          }), /* @__PURE__ */ jsx("button", {
            className: "seo-button secondary",
            type: "button",
            onClick: selectIssuesOnly,
            children: "Select issues"
          }), /* @__PURE__ */ jsx("button", {
            className: "seo-button secondary",
            type: "button",
            onClick: submitCheck,
            children: "Check image ALT"
          }), /* @__PURE__ */ jsx("button", {
            className: "seo-button",
            type: "button",
            onClick: applySelectedFixes,
            children: "Fix selected ALT"
          }), /* @__PURE__ */ jsx("button", {
            className: "seo-button",
            type: "button",
            onClick: applyAllVisibleFixes,
            children: "Update all visible ALT"
          })]
        })]
      }), ((_g = actionFetcher.data) == null ? void 0 : _g.ok) && ((_h = actionFetcher.data) == null ? void 0 : _h.intent) === "checkAlt" ? /* @__PURE__ */ jsxs("div", {
        className: "status-banner",
        "data-toast": "info",
        "data-toast-title": "Image ALT Audit",
        children: [/* @__PURE__ */ jsx("strong", {
          children: "Check complete:"
        }), " ", ((_i = actionFetcher.data.summary) == null ? void 0 : _i.needsFix) || 0, " need fixes, ", ((_j = actionFetcher.data.summary) == null ? void 0 : _j.ideal) || 0, " are healthy,", " ", ((_k = actionFetcher.data.summary) == null ? void 0 : _k.missing) || 0, " missing ALT."]
      }) : null, ((_l = actionFetcher.data) == null ? void 0 : _l.ok) && ((_m = actionFetcher.data) == null ? void 0 : _m.intent) === "fixAlt" ? /* @__PURE__ */ jsxs("div", {
        className: "status-banner banner-good",
        "data-toast-title": "Image ALT Updated",
        children: ["Updated ALT text for ", actionFetcher.data.updated || 0, " image", actionFetcher.data.updated === 1 ? "" : "s", "."]
      }) : null, !rows.length ? /* @__PURE__ */ jsx("div", {
        className: "empty-box",
        children: "No product images were found in the current filter."
      }) : /* @__PURE__ */ jsx("div", {
        className: "table-card table-wrap image-optimizer-table",
        children: /* @__PURE__ */ jsxs("table", {
          children: [/* @__PURE__ */ jsx("thead", {
            children: /* @__PURE__ */ jsxs("tr", {
              children: [/* @__PURE__ */ jsx("th", {
                children: /* @__PURE__ */ jsx("input", {
                  ref: selectAllRef,
                  type: "checkbox",
                  checked: allVisibleSelected,
                  onChange: (event) => setSelectAll(event.target.checked),
                  "aria-label": "Select all images on this page"
                })
              }), /* @__PURE__ */ jsx("th", {
                children: "Image"
              }), /* @__PURE__ */ jsx("th", {
                children: "Product"
              }), /* @__PURE__ */ jsx("th", {
                children: "Current ALT"
              }), /* @__PURE__ */ jsx("th", {
                children: "Suggested ALT"
              }), /* @__PURE__ */ jsx("th", {
                children: "Status"
              })]
            })
          }), /* @__PURE__ */ jsx("tbody", {
            children: rows.map((row) => {
              var _a3;
              const status = checkedStatusById[row.id] || validateImageAlt(row.altText);
              const tone = statusTone(status);
              return /* @__PURE__ */ jsxs("tr", {
                children: [/* @__PURE__ */ jsx("td", {
                  children: /* @__PURE__ */ jsx("input", {
                    type: "checkbox",
                    checked: Boolean(selected[row.id]),
                    onChange: (event) => setSelected((current) => ({
                      ...current,
                      [row.id]: event.target.checked
                    }))
                  })
                }), /* @__PURE__ */ jsx("td", {
                  children: row.imageUrl ? /* @__PURE__ */ jsx("img", {
                    src: row.imageUrl,
                    alt: "",
                    loading: "lazy",
                    width: 72,
                    height: 72,
                    style: {
                      objectFit: "cover",
                      border: "1px solid rgba(16, 38, 59, 0.12)"
                    }
                  }) : /* @__PURE__ */ jsx("small", {
                    children: "No preview"
                  })
                }), /* @__PURE__ */ jsxs("td", {
                  children: [/* @__PURE__ */ jsx("strong", {
                    children: row.productTitle
                  }), /* @__PURE__ */ jsxs("small", {
                    children: ["Image #", row.position]
                  })]
                }), /* @__PURE__ */ jsxs("td", {
                  children: [/* @__PURE__ */ jsx("textarea", {
                    rows: 2,
                    className: "seo-textarea",
                    value: row.altText,
                    onChange: (event) => {
                      const nextAlt = event.target.value;
                      patchRow(row.id, {
                        altText: nextAlt,
                        suggestedAlt: suggestImageAltText({
                          productTitle: row.productTitle,
                          position: row.position,
                          currentAlt: nextAlt
                        })
                      });
                    }
                  }), /* @__PURE__ */ jsxs("small", {
                    children: [String(row.altText || "").trim().length, " chars"]
                  })]
                }), /* @__PURE__ */ jsxs("td", {
                  children: [/* @__PURE__ */ jsx("textarea", {
                    rows: 2,
                    className: "seo-textarea",
                    value: row.suggestedAlt,
                    onChange: (event) => patchRow(row.id, {
                      suggestedAlt: event.target.value
                    })
                  }), /* @__PURE__ */ jsxs("div", {
                    style: {
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginTop: 4,
                      flexWrap: "wrap",
                      gap: 4
                    },
                    children: [/* @__PURE__ */ jsx("small", {
                      children: "Used by Fix selected"
                    }), /* @__PURE__ */ jsx("button", {
                      type: "button",
                      className: "seo-button secondary",
                      style: {
                        fontSize: 11,
                        padding: "3px 8px"
                      },
                      onClick: () => generateVisionAlt(row),
                      disabled: aiFetcher.state !== "idle" && aiImageId === row.id,
                      title: `Analyze this actual image with Gemini Vision (${CREDIT_COSTS.vision_alt} tokens)`,
                      children: aiFetcher.state !== "idle" && aiImageId === row.id ? "Analyzing..." : `👁️ Gemini Vision (${CREDIT_COSTS.vision_alt} tok)`
                    })]
                  }), ((_a3 = aiFetcher.data) == null ? void 0 : _a3.ok) && lastVisionImageId === row.id ? /* @__PURE__ */ jsx("small", {
                    style: {
                      color: "var(--seo-primary)",
                      display: "block",
                      marginTop: 2
                    },
                    children: aiFetcher.data.superAccess ? "★ Super Access (0 tokens deducted)." : aiFetcher.data.creditsDeducted ? `⚡ Deducted ${aiFetcher.data.creditsDeducted} tokens. ${aiFetcher.data.creditsRemaining} remaining.` : "Fallback ALT applied (0 tokens charged)."
                  }) : null]
                }), /* @__PURE__ */ jsxs("td", {
                  children: [/* @__PURE__ */ jsx("span", {
                    className: `issue-chip ${tone}`,
                    children: statusLabel(status)
                  }), status.message ? /* @__PURE__ */ jsx("small", {
                    children: status.message
                  }) : null]
                })]
              }, `${row.productId}-${row.id}`);
            })
          })]
        })
      }), /* @__PURE__ */ jsxs("div", {
        className: "toolbar",
        children: [/* @__PURE__ */ jsx("small", {
          children: "Showing up to 25 images per page"
        }), pageData.pagination.previousPageInfo ? /* @__PURE__ */ jsx("button", {
          className: "seo-button",
          type: "button",
          onClick: () => loadList(pageData.query || "", pageData.pagination.previousPageInfo, pageData.statusFilter || "all"),
          disabled: listFetcher.state !== "idle",
          children: "Previous page"
        }) : null, pageData.pagination.nextPageInfo ? /* @__PURE__ */ jsx("button", {
          className: "seo-button",
          type: "button",
          onClick: () => loadList(pageData.query || "", pageData.pagination.nextPageInfo, pageData.statusFilter || "all"),
          disabled: listFetcher.state !== "idle",
          children: "Next page"
        }) : null]
      }), /* @__PURE__ */ jsxs("div", {
        className: "section-card",
        children: [/* @__PURE__ */ jsxs("div", {
          className: "toolbar",
          style: {
            justifyContent: "space-between"
          },
          children: [/* @__PURE__ */ jsx("h3", {
            style: {
              margin: 0
            },
            children: "Previous Results"
          }), /* @__PURE__ */ jsx("small", {
            children: "Stored history from recent check/fix runs"
          })]
        }), !history.length ? /* @__PURE__ */ jsx("div", {
          className: "empty-box",
          children: "No previous Image Optimizer runs yet."
        }) : /* @__PURE__ */ jsx("div", {
          className: "table-wrap image-history-table",
          children: /* @__PURE__ */ jsxs("table", {
            children: [/* @__PURE__ */ jsx("thead", {
              children: /* @__PURE__ */ jsxs("tr", {
                children: [/* @__PURE__ */ jsx("th", {
                  children: "Time"
                }), /* @__PURE__ */ jsx("th", {
                  children: "Action"
                }), /* @__PURE__ */ jsx("th", {
                  children: "Status"
                }), /* @__PURE__ */ jsx("th", {
                  children: "Needs Fix"
                }), /* @__PURE__ */ jsx("th", {
                  children: "Updated"
                }), /* @__PURE__ */ jsx("th", {
                  children: "Checked"
                }), /* @__PURE__ */ jsx("th", {
                  children: "Note"
                })]
              })
            }), /* @__PURE__ */ jsx("tbody", {
              children: history.slice(0, 10).map((entry2) => {
                var _a3, _b2;
                return /* @__PURE__ */ jsxs("tr", {
                  children: [/* @__PURE__ */ jsx("td", {
                    children: formatDate(entry2.createdAt)
                  }), /* @__PURE__ */ jsx("td", {
                    children: entry2.action === "fix" ? "Fix ALT" : "Check ALT"
                  }), /* @__PURE__ */ jsx("td", {
                    children: /* @__PURE__ */ jsx("span", {
                      className: `issue-chip ${entry2.status === "failed" ? "critical" : "ok"}`,
                      children: entry2.status === "failed" ? "Failed" : "Success"
                    })
                  }), /* @__PURE__ */ jsx("td", {
                    children: ((_a3 = entry2.summary) == null ? void 0 : _a3.needsFix) || 0
                  }), /* @__PURE__ */ jsx("td", {
                    children: entry2.updated || 0
                  }), /* @__PURE__ */ jsx("td", {
                    children: ((_b2 = entry2.summary) == null ? void 0 : _b2.total) || entry2.attempted || 0
                  }), /* @__PURE__ */ jsx("td", {
                    children: entry2.note || "-"
                  })]
                }, entry2.id);
              })
            })]
          })
        })]
      })]
    })]
  });
});
const route18 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$a,
  default: app_imageOptimizer,
  links: links$a,
  loader: loader$c,
  shouldRevalidate: shouldRevalidate$1
}, Symbol.toStringTag, { value: "Module" }));
const links$9 = () => [{
  rel: "stylesheet",
  href: seoStyles
}];
const loader$b = async ({
  request
}) => {
  const {
    shop,
    token,
    apiVersion,
    configError
  } = await requireShopContext(request);
  if (configError) {
    return {
      configError,
      rows: []
    };
  }
  try {
    const result = await loadProductsPage({
      shop,
      storeDomain: shop,
      token,
      apiVersion,
      limit: 50,
      includeDescription: false
    });
    return {
      configError: "",
      rows: result.rows
    };
  } catch (error) {
    return {
      configError: (error == null ? void 0 : error.message) || "Unable to load Shopify products.",
      rows: []
    };
  }
};
const action$9 = async ({
  request
}) => {
  const {
    shop,
    token,
    apiVersion,
    configError
  } = await requireShopContext(request);
  if (configError) {
    return {
      ok: false,
      error: configError
    };
  }
  const formData = await request.formData();
  const intent = String(formData.get("intent") || "checkMeta");
  const rows = JSON.parse(String(formData.get("rows") || "[]"));
  if (intent === "checkMeta") {
    return {
      ok: true,
      ...validateBulkMetaRows(rows)
    };
  }
  if (intent === "saveMeta") {
    try {
      return await saveBulkMetaAndRescan({
        shop,
        storeDomain: shop,
        token,
        apiVersion,
        rows
      });
    } catch (error) {
      return {
        ok: false,
        error: (error == null ? void 0 : error.message) || "Failed to save bulk metadata."
      };
    }
  }
  return {
    ok: false,
    error: "Unknown action."
  };
};
function getRowStatus(statusById, id, field) {
  var _a2;
  const status = (_a2 = statusById == null ? void 0 : statusById[id]) == null ? void 0 : _a2[field];
  if (!status) return "Unchecked";
  if (!status.valid) return status.message;
  if (!status.ideal) return "Outside ideal range";
  return "Ideal";
}
const app_bulkMeta = UNSAFE_withComponentProps(function BulkMetaRoute() {
  var _a2, _b, _c, _d, _e, _f;
  const data2 = useLoaderData();
  const fetcher = useFetcher();
  const aiFetcher = useFetcher();
  const [rows, setRows] = useState(data2.rows || []);
  const [aiRowId, setAiRowId] = useState("");
  const [lastAiAppliedRowId, setLastAiAppliedRowId] = useState("");
  const originalById = useMemo(() => {
    return (data2.rows || []).reduce((acc, row) => {
      acc[row.id] = row;
      return acc;
    }, {});
  }, [data2.rows]);
  const statusById = useMemo(() => {
    var _a3;
    return ((_a3 = fetcher.data) == null ? void 0 : _a3.statusById) || {};
  }, [fetcher.data]);
  function patchRow(id, patch) {
    setRows((current) => current.map((row) => row.id === id ? {
      ...row,
      ...patch
    } : row));
  }
  function submitIntent(intent) {
    fetcher.submit({
      intent,
      rows: JSON.stringify(rows.map((row) => ({
        id: row.id,
        title: row.title,
        handle: row.handle,
        metaTitle: row.metaTitle,
        metaDescription: row.metaDescription,
        previousValues: originalById[row.id] || null
      })))
    }, {
      method: "post"
    });
  }
  useEffect(() => {
    var _a3, _b2, _c2, _d2, _e2, _f2, _g, _h;
    if (((_a3 = aiFetcher.data) == null ? void 0 : _a3.ok) && ((_b2 = aiFetcher.data) == null ? void 0 : _b2.creditsRemaining) !== void 0) {
      dispatchCreditsUpdate({
        availableCredits: aiFetcher.data.creditsRemaining,
        plan: aiFetcher.data.plan,
        superAccess: Boolean(aiFetcher.data.superAccess)
      });
    }
    if (((_c2 = aiFetcher.data) == null ? void 0 : _c2.ok) && ((_d2 = aiFetcher.data) == null ? void 0 : _d2.actionType) === "meta_fix" && aiRowId) {
      patchRow(aiRowId, {
        metaTitle: ((_e2 = aiFetcher.data.result) == null ? void 0 : _e2.metaTitle) || "",
        metaDescription: ((_f2 = aiFetcher.data.result) == null ? void 0 : _f2.metaDescription) || ""
      });
      setLastAiAppliedRowId(aiRowId);
      setAiRowId("");
      showToast({
        tone: "info",
        title: "AI Meta Applied",
        message: ((_g = aiFetcher.data.result) == null ? void 0 : _g.rationale) || "Suggested meta title & description applied. Click Save meta to publish."
      });
    }
    if ((_h = aiFetcher.data) == null ? void 0 : _h.error) {
      setAiRowId("");
    }
  }, [aiFetcher.data, aiRowId]);
  function runAiFix(row) {
    setAiRowId(row.id);
    aiFetcher.submit({
      payload: JSON.stringify({
        actionType: "meta_fix",
        productId: row.id,
        title: row.title,
        focusKeyword: row.focusKeyword,
        currentMetaTitle: row.metaTitle,
        currentMetaDescription: row.metaDescription
      })
    }, {
      method: "post",
      action: "/app/api/ai"
    });
  }
  return /* @__PURE__ */ jsxs(Fragment, {
    children: [/* @__PURE__ */ jsx("ui-title-bar", {
      title: "Products & Media — Bulk Meta"
    }), /* @__PURE__ */ jsxs("div", {
      className: "seo-wrap seo-grid",
      children: [/* @__PURE__ */ jsx(WorkspaceSubnav, {
        group: "products"
      }), data2.configError ? /* @__PURE__ */ jsx("div", {
        className: "error-box",
        children: data2.configError
      }) : null, /* @__PURE__ */ jsxs("div", {
        className: "toolbar",
        children: [/* @__PURE__ */ jsx("button", {
          className: "seo-button secondary",
          type: "button",
          onClick: () => submitIntent("checkMeta"),
          children: "Check meta"
        }), /* @__PURE__ */ jsx("button", {
          className: "seo-button",
          type: "button",
          onClick: () => submitIntent("saveMeta"),
          disabled: fetcher.state !== "idle",
          children: fetcher.state !== "idle" ? "Saving..." : "Save meta"
        })]
      }), ((_a2 = fetcher.data) == null ? void 0 : _a2.error) ? /* @__PURE__ */ jsx("div", {
        className: "error-box",
        children: fetcher.data.error
      }) : null, ((_b = fetcher.data) == null ? void 0 : _b.message) ? /* @__PURE__ */ jsx("div", {
        className: "error-box",
        children: fetcher.data.message
      }) : null, ((_c = fetcher.data) == null ? void 0 : _c.ok) && ((_d = fetcher.data) == null ? void 0 : _d.saved) ? /* @__PURE__ */ jsxs("div", {
        className: "status-banner banner-good",
        "data-toast-title": "Bulk Metadata Saved",
        children: ["✓ Saved metadata for ", fetcher.data.saved, " products and updated revision history."]
      }) : null, ((_e = aiFetcher.data) == null ? void 0 : _e.error) ? /* @__PURE__ */ jsxs("div", {
        className: "error-box",
        children: [aiFetcher.data.error, " ", ((_f = aiFetcher.data) == null ? void 0 : _f.outOfCredits) ? /* @__PURE__ */ jsx(Link, {
          to: "/app/billing",
          children: "Upgrade or manage credits"
        }) : null]
      }) : null, !rows.length ? /* @__PURE__ */ jsx("div", {
        className: "empty-box",
        children: "No rows available for bulk editing."
      }) : /* @__PURE__ */ jsx("div", {
        className: "table-card table-wrap bulk-meta-table",
        children: /* @__PURE__ */ jsxs("table", {
          children: [/* @__PURE__ */ jsx("thead", {
            children: /* @__PURE__ */ jsxs("tr", {
              children: [/* @__PURE__ */ jsx("th", {
                children: "Product"
              }), /* @__PURE__ */ jsx("th", {
                children: "Meta title"
              }), /* @__PURE__ */ jsx("th", {
                children: "Meta description"
              }), /* @__PURE__ */ jsx("th", {
                children: "Actions"
              })]
            })
          }), /* @__PURE__ */ jsx("tbody", {
            children: rows.map((row) => {
              var _a3, _b2, _c2, _d2, _e2;
              return /* @__PURE__ */ jsxs("tr", {
                children: [/* @__PURE__ */ jsx("td", {
                  children: row.title
                }), /* @__PURE__ */ jsxs("td", {
                  children: [/* @__PURE__ */ jsx("input", {
                    className: "seo-input",
                    value: row.metaTitle,
                    onChange: (event) => patchRow(row.id, {
                      metaTitle: event.target.value
                    })
                  }), /* @__PURE__ */ jsxs("small", {
                    children: [row.metaTitle.length, " chars - ", getRowStatus(statusById, row.id, "metaTitle")]
                  })]
                }), /* @__PURE__ */ jsxs("td", {
                  children: [/* @__PURE__ */ jsx("textarea", {
                    rows: 3,
                    className: "seo-textarea",
                    value: row.metaDescription,
                    onChange: (event) => patchRow(row.id, {
                      metaDescription: event.target.value
                    })
                  }), /* @__PURE__ */ jsxs("small", {
                    children: [row.metaDescription.length, " chars - ", getRowStatus(statusById, row.id, "metaDescription")]
                  })]
                }), /* @__PURE__ */ jsxs("td", {
                  children: [/* @__PURE__ */ jsx("button", {
                    className: "seo-button secondary",
                    type: "button",
                    onClick: () => runAiFix(row),
                    disabled: aiFetcher.state !== "idle" && aiRowId === row.id,
                    title: "Generate click-worthy meta title & description (1 token)",
                    children: aiFetcher.state !== "idle" && aiRowId === row.id ? "Generating..." : "⚡ AI Fix (1 tok)"
                  }), ((_a3 = aiFetcher.data) == null ? void 0 : _a3.ok) && lastAiAppliedRowId === row.id ? /* @__PURE__ */ jsxs("small", {
                    style: {
                      display: "block",
                      marginTop: 4,
                      color: "var(--seo-primary)"
                    },
                    children: [((_b2 = aiFetcher.data.result) == null ? void 0 : _b2.rationale) || "AI suggestion applied.", ((_c2 = aiFetcher.data) == null ? void 0 : _c2.superAccess) || ((_d2 = aiFetcher.data) == null ? void 0 : _d2.creditsDeducted) === 0 ? " (Super Access · 0 tok)" : ((_e2 = aiFetcher.data) == null ? void 0 : _e2.creditsRemaining) !== void 0 ? ` (Balance: ${aiFetcher.data.creditsRemaining} tok left)` : ""]
                  }) : null]
                })]
              }, row.id);
            })
          })]
        })
      })]
    })]
  });
});
const route19 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$9,
  default: app_bulkMeta,
  links: links$9,
  loader: loader$b
}, Symbol.toStringTag, { value: "Module" }));
const PAGESPEED_ENDPOINT = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";
const AUDIT_GUIDANCE = Object.freeze({
  "largest-contentful-paint-element": {
    metricTarget: "LCP",
    fixMode: "THEME_MANUAL",
    inAppTarget: "",
    fileHint: "sections/main-product.liquid or layout/theme.liquid",
    title: "Preload & prioritize LCP hero image",
    steps: 'Add fetchpriority="high" on your primary above-the-fold hero/product image and remove loading="lazy" from the first visible image.',
    snippet: `<link rel="preload" as="image" href="{{ product.featured_image | image_url: width: 1200 }}" fetchpriority="high">
{{ product.featured_image | image_url: width: 1200 | image_tag: fetchpriority: 'high', loading: 'eager', widths: '400, 800, 1200' }}`
  },
  "render-blocking-resources": {
    metricTarget: "FCP / LCP",
    fixMode: "THEME_MANUAL",
    inAppTarget: "",
    fileHint: "layout/theme.liquid",
    title: "Defer non-critical CSS and render-blocking scripts",
    steps: "Move non-essential scripts to defer or async, and inline tiny critical above-the-fold styles in layout/theme.liquid.",
    snippet: `<!-- Non-blocking script & stylesheet loading in layout/theme.liquid -->
<script src="{{ 'theme.js' | asset_url }}" defer><\/script>
<link rel="stylesheet" href="{{ 'custom-extra.css' | asset_url }}" media="print" onload="this.media='all'">`
  },
  "unused-javascript": {
    metricTarget: "INP / TBT",
    fixMode: "APP_BLOAT",
    inAppTarget: "",
    fileHint: "Online Store → Themes → Customize → App embeds",
    title: "Trim heavy or unused third-party app JavaScript",
    steps: "Disable unused Shopify App Embeds in Theme Customizer and uninstall leftover app script tags injected into theme.liquid.",
    snippet: `{%- comment -%} Load heavy widgets only on pages that need them {%- endcomment -%}
{% if template.name == 'product' %}
  {{ 'product-widget.js' | asset_url | script_tag }}
{% endif %}`
  },
  "bootup-time": {
    metricTarget: "INP / TBT",
    fixMode: "APP_BLOAT",
    inAppTarget: "",
    fileHint: "Online Store → Themes → Customize → App embeds",
    title: "Reduce JavaScript execution & main-thread blocking",
    steps: "Audit the heavy script URLs below. Disable redundant chat widgets, popups, or duplicate tracking pixels firing on initial page load.",
    snippet: `<!-- Delay non-essential analytics/widgets until user interaction -->
<script>
  window.addEventListener('pointerdown', function loadDeferred() {
    // initialize non-critical widget here
  }, { once: true, passive: true });
<\/script>`
  },
  "third-party-summary": {
    metricTarget: "INP / LCP",
    fixMode: "APP_BLOAT",
    inAppTarget: "",
    fileHint: "Shopify Admin → Settings → Customer events / Theme App Embeds",
    title: "Consolidate heavy third-party Shopify scripts",
    steps: "Review third-party script execution costs below. Consolidate pixels into Shopify Web Pixels and disable unused theme app embeds.",
    snippet: ""
  },
  "uses-optimized-images": {
    metricTarget: "LCP",
    fixMode: "IN_APP_AUTO",
    inAppTarget: "/app/image-optimizer",
    fileHint: "Image Optimizer + Shopify Liquid image_url filter",
    title: "Compress oversized images & use modern width/format",
    steps: "Ensure Liquid templates render responsive Shopify CDN sizes via image_url + image_tag and audit product media ALT & assets in Image Optimizer.",
    snippet: `{{ image | image_url: width: 1000 | image_tag: widths: '360, 540, 720, 1000', sizes: '(min-width: 990px) 50vw, 100vw', loading: 'lazy' }}`
  },
  "modern-image-formats": {
    metricTarget: "LCP",
    fixMode: "THEME_MANUAL",
    inAppTarget: "/app/image-optimizer",
    fileHint: "Sections / Snippets using img tags",
    title: "Serve WebP/AVIF via Shopify CDN image_url filters",
    steps: "Replace hardcoded static image URLs or deprecated img_url with Shopify's modern image_url filter, which negotiates WebP/AVIF automatically.",
    snippet: `{{ product.featured_image | image_url: width: 900 | image_tag: loading: 'eager', decoding: 'async' }}`
  },
  "uses-responsive-images": {
    metricTarget: "LCP",
    fixMode: "THEME_MANUAL",
    inAppTarget: "/app/image-optimizer",
    fileHint: "Sections / Snippets rendering product cards",
    title: "Deliver properly sized srcset images for mobile viewports",
    steps: "Add responsive widths and sizes attributes so mobile browsers do not download desktop 2000px+ thumbnails.",
    snippet: `{{ card_product.featured_media | image_url: width: 720 | image_tag: widths: '240, 360, 540, 720', sizes: '(max-width: 749px) 50vw, 25vw', loading: 'lazy' }}`
  },
  "offscreen-images": {
    metricTarget: "LCP / Bandwidth",
    fixMode: "THEME_MANUAL",
    inAppTarget: "",
    fileHint: "Collection grid / footer snippets",
    title: "Lazy-load below-the-fold product cards and footer media",
    steps: 'Add loading="lazy" on collection grid images below row 1, related products, and footer badges.',
    snippet: `{{ block.settings.image | image_url: width: 800 | image_tag: loading: 'lazy', decoding: 'async' }}`
  },
  "unsized-images": {
    metricTarget: "CLS",
    fixMode: "THEME_MANUAL",
    inAppTarget: "",
    fileHint: "Theme CSS / Product card & banner templates",
    title: "Reserve explicit width & height to stop layout shifts (CLS)",
    steps: "Ensure every <img> specifies explicit width and height HTML attributes (Shopify's image_tag adds them automatically) or CSS aspect-ratio.",
    snippet: `<img src="{{ img | image_url: width: 800 }}" width="{{ img.width }}" height="{{ img.height }}" alt="{{ img.alt | escape }}" style="height:auto;">`
  },
  "layout-shift-elements": {
    metricTarget: "CLS",
    fixMode: "THEME_MANUAL",
    inAppTarget: "",
    fileHint: "Announcement bar / sticky app banners",
    title: "Stabilize dynamic announcement bars, reviews, and media heights",
    steps: "Set a fixed min-height on review star badges, announcement banners, and variant swatches so content below does not jump after hydration.",
    snippet: `.product-reviews-badge, .announcement-slot {
  min-height: 28px;
}`
  },
  "font-display": {
    metricTarget: "FCP / CLS",
    fixMode: "THEME_MANUAL",
    inAppTarget: "",
    fileHint: "layout/theme.liquid / assets/*.css",
    title: "Prevent invisible text flash with font-display: swap",
    steps: "Add &display=swap to external font imports and font-display: swap inside @font-face declarations.",
    snippet: `@font-face {
  font-family: 'CustomBrandFont';
  font-display: swap;
}`
  },
  "meta-description": {
    metricTarget: "SEO",
    fixMode: "IN_APP_AUTO",
    inAppTarget: "/app/bulk-meta",
    fileHint: "Bulk Meta Editor / Product SEO",
    title: "Add compelling meta description for higher Google CTR",
    steps: "Fix the missing meta description directly using the Manual/AI editor below or across your entire catalog in Bulk Meta.",
    snippet: ""
  },
  "document-title": {
    metricTarget: "SEO",
    fixMode: "IN_APP_AUTO",
    inAppTarget: "/app/products",
    fileHint: "Product SEO Editor / Online Store Preferences",
    title: "Ensure page has a unique, keyword-rich <title> tag",
    steps: "Set a clear 50-60 character SEO title in Shopify Preferences (for homepage) or Product SEO Editor (for products).",
    snippet: ""
  },
  "image-alt": {
    metricTarget: "SEO / Accessibility",
    fixMode: "IN_APP_AUTO",
    inAppTarget: "/app/image-optimizer?status=needs-fix",
    fileHint: "Image Optimizer & Gemini Vision ALT",
    title: "Fix missing product and theme image ALT text",
    steps: "Open Image Optimizer to auto-generate descriptive WCAG/SEO ALT tags using Gemini Vision AI or manual bulk edit.",
    snippet: ""
  },
  "robots-txt": {
    metricTarget: "SEO Crawl",
    fixMode: "IN_APP_AUTO",
    inAppTarget: "/app/robots",
    fileHint: "Technical & History → Robots.txt",
    title: "Fix invalid or blocking robots.txt rules",
    steps: "Validate and clean your Shopify templates/robots.txt.liquid directives inside the Robots.txt manager.",
    snippet: ""
  },
  "is-crawlable": {
    metricTarget: "SEO Crawl",
    fixMode: "IN_APP_AUTO",
    inAppTarget: "/app/robots",
    fileHint: "Robots.txt / Theme meta robots",
    title: "Ensure public storefront pages are indexable (remove accidental noindex)",
    steps: "Check theme.liquid for unintended noindex meta tags and verify Password Protection is turned off for live stores.",
    snippet: ""
  }
});
function isPrivateOrLocalHostname(hostname) {
  const host = String(hostname || "").trim().toLowerCase().replace(/^\[|\]$/g, "");
  if (!host) return true;
  if (host === "localhost" || host === "0.0.0.0" || host === "::1" || host.endsWith(".local") || host.endsWith(".internal")) {
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
function normalizePageSpeedTargetUrl(shop, inputUrl = "") {
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
function extractProductHandleFromUrl(targetUrl) {
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
  if (ms >= 1e3) return `${(ms / 1e3).toFixed(2)} s`;
  return `${Math.round(ms)} ms`;
}
function formatBytes(bytes) {
  if (typeof bytes !== "number" || !Number.isFinite(bytes) || bytes <= 0) return "";
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}
function mapAuditItems(audit) {
  const details = audit == null ? void 0 : audit.details;
  const rows = Array.isArray(details == null ? void 0 : details.items) ? details.items : [];
  return rows.slice(0, 5).map((item) => {
    var _a2, _b, _c;
    const url = String(
      (item == null ? void 0 : item.url) || (item == null ? void 0 : item.entity) || ((_a2 = item == null ? void 0 : item.node) == null ? void 0 : _a2.snippet) || ((_b = item == null ? void 0 : item.source) == null ? void 0 : _b.url) || ""
    ).trim();
    const label2 = String(((_c = item == null ? void 0 : item.node) == null ? void 0 : _c.nodeLabel) || (item == null ? void 0 : item.entity) || "").trim();
    const wastedMs = typeof (item == null ? void 0 : item.wastedMs) === "number" ? Math.round(item.wastedMs) : null;
    const blockingTime = typeof (item == null ? void 0 : item.blockingTime) === "number" ? Math.round(item.blockingTime) : null;
    const wastedBytes = typeof (item == null ? void 0 : item.wastedBytes) === "number" ? Math.round(item.wastedBytes) : typeof (item == null ? void 0 : item.totalBytes) === "number" ? Math.round(item.totalBytes) : null;
    return {
      url: url.slice(0, 240),
      label: label2.slice(0, 140),
      wastedMs: wastedMs ?? blockingTime,
      wastedBytes
    };
  });
}
function normalizeDescription(text2) {
  return String(text2 || "").replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, "$1").replace(/\s+/g, " ").trim();
}
function buildManualPageSpeedChecklist(report) {
  var _a2, _b;
  const failingIds = new Set(
    [...(report == null ? void 0 : report.opportunities) || [], ...(report == null ? void 0 : report.seoFindings) || []].filter((item) => item && item.id).map((item) => item.id)
  );
  const items = [];
  for (const audit of [...(report == null ? void 0 : report.opportunities) || [], ...(report == null ? void 0 : report.seoFindings) || []]) {
    if (!(audit == null ? void 0 : audit.id)) continue;
    const guide = AUDIT_GUIDANCE[audit.id];
    items.push({
      id: `manual_${audit.id}`,
      auditId: audit.id,
      title: (guide == null ? void 0 : guide.title) || audit.title,
      metricTarget: (guide == null ? void 0 : guide.metricTarget) || audit.category || "SEO",
      fixMode: (guide == null ? void 0 : guide.fixMode) || "THEME_MANUAL",
      inAppTarget: (guide == null ? void 0 : guide.inAppTarget) || "",
      fileHint: (guide == null ? void 0 : guide.fileHint) || "Online Store → Themes → Edit code",
      displayImpact: audit.displayValue || (audit.savingsMs ? `${Math.round(audit.savingsMs)} ms savings` : "Needs fix"),
      steps: (guide == null ? void 0 : guide.steps) || audit.description,
      snippet: (guide == null ? void 0 : guide.snippet) || "",
      offendingItems: Array.isArray(audit.items) ? audit.items : []
    });
  }
  if (!failingIds.has("meta-description") && (((_a2 = report == null ? void 0 : report.scores) == null ? void 0 : _a2.seo) ?? 100) < 100) {
    items.push({
      id: "manual_seo_review",
      auditId: "seo-review",
      title: "Verify Store & Product Meta Snippets",
      metricTarget: "SEO",
      fixMode: "IN_APP_AUTO",
      inAppTarget: "/app/bulk-meta",
      fileHint: "Bulk Meta Editor / Product SEO",
      displayImpact: `SEO Score ${((_b = report == null ? void 0 : report.scores) == null ? void 0 : _b.seo) ?? 0}/100`,
      steps: "Inspect failing SEO audits and update missing titles, meta descriptions, or ALT text in-app.",
      snippet: "",
      offendingItems: []
    });
  }
  return items;
}
function parsePageSpeedApiResponse(rawJson, requestedUrl = "", requestedStrategy = "mobile") {
  var _a2, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _A, _B, _C, _D, _E, _F, _G, _H, _I, _J, _K, _L, _M, _N;
  const lhr = rawJson == null ? void 0 : rawJson.lighthouseResult;
  if (!lhr || typeof lhr !== "object") {
    throw new Error("Google PageSpeed Insights returned an incomplete Lighthouse payload.");
  }
  const audits = lhr.audits || {};
  const categories = lhr.categories || {};
  const fieldMetrics = ((_a2 = rawJson == null ? void 0 : rawJson.loadingExperience) == null ? void 0 : _a2.metrics) || {};
  const strategy = String(((_b = lhr.configSettings) == null ? void 0 : _b.formFactor) || requestedStrategy || "mobile").toLowerCase();
  const finalUrl = String(lhr.finalDisplayedUrl || lhr.finalUrl || (rawJson == null ? void 0 : rawJson.id) || requestedUrl);
  const titleAuditValue = String(
    ((_f = (_e = (_d = (_c = audits["document-title"]) == null ? void 0 : _c.details) == null ? void 0 : _d.items) == null ? void 0 : _e[0]) == null ? void 0 : _f.title) || ((_g = lhr.fullPageScreenshot) == null ? void 0 : _g.title) || ""
  );
  const passwordProtected = /\/password(\?|$|#)/i.test(finalUrl) || /storefront password|enter using password/i.test(titleAuditValue) || ((_h = lhr.runtimeError) == null ? void 0 : _h.code) === "ERRORED_DOCUMENT_REQUEST";
  const lcpMs = ((_i = audits["largest-contentful-paint"]) == null ? void 0 : _i.numericValue) ?? null;
  const fcpMs = ((_j = audits["first-contentful-paint"]) == null ? void 0 : _j.numericValue) ?? null;
  const clsVal = ((_k = audits["cumulative-layout-shift"]) == null ? void 0 : _k.numericValue) ?? null;
  const tbtMs = ((_l = audits["total-blocking-time"]) == null ? void 0 : _l.numericValue) ?? null;
  const ttfbMs = ((_m = audits["server-response-time"]) == null ? void 0 : _m.numericValue) ?? null;
  const siMs = ((_n = audits["speed-index"]) == null ? void 0 : _n.numericValue) ?? null;
  const fieldInpMs = ((_o = fieldMetrics == null ? void 0 : fieldMetrics.INTERACTION_TO_NEXT_PAINT) == null ? void 0 : _o.percentile) ?? null;
  const effectiveInpMs = fieldInpMs ?? tbtMs;
  const lcpElementItem = ((_t = (_s = (_r = (_q = (_p = audits["largest-contentful-paint-element"]) == null ? void 0 : _p.details) == null ? void 0 : _q.items) == null ? void 0 : _r[0]) == null ? void 0 : _s.items) == null ? void 0 : _t[0]) || ((_w = (_v = (_u = audits["largest-contentful-paint-element"]) == null ? void 0 : _u.details) == null ? void 0 : _v.items) == null ? void 0 : _w[0]) || null;
  const lcpElement = String(
    ((_x = lcpElementItem == null ? void 0 : lcpElementItem.node) == null ? void 0 : _x.snippet) || ((_y = lcpElementItem == null ? void 0 : lcpElementItem.node) == null ? void 0 : _y.nodeLabel) || ""
  ).trim().slice(0, 220);
  const totalBytes = ((_z = audits["total-byte-weight"]) == null ? void 0 : _z.numericValue) ?? null;
  const candidateAuditIds = Object.keys(audits).filter((id) => {
    const audit = audits[id];
    if (!audit || typeof audit.score !== "number") return false;
    return audit.score < 0.9;
  });
  const seoAuditSet = new Set(
    (((_A = categories.seo) == null ? void 0 : _A.auditRefs) || []).map((ref) => ref.id).filter(Boolean)
  );
  const opportunities = [];
  const seoFindings = [];
  for (const id of candidateAuditIds) {
    const audit = audits[id];
    const isSeo = seoAuditSet.has(id);
    const guide = AUDIT_GUIDANCE[id];
    const savingsMs = typeof ((_B = audit.details) == null ? void 0 : _B.overallSavingsMs) === "number" ? Math.round(audit.details.overallSavingsMs) : 0;
    const savingsBytes = typeof ((_C = audit.details) == null ? void 0 : _C.overallSavingsBytes) === "number" ? Math.round(audit.details.overallSavingsBytes) : 0;
    if (!isSeo && !guide && savingsMs <= 0 && savingsBytes <= 0 && audit.score >= 0.5) {
      continue;
    }
    const entry2 = {
      id,
      title: String(audit.title || id),
      description: normalizeDescription(audit.description),
      score: Math.round(audit.score * 100),
      displayValue: String(audit.displayValue || (savingsMs ? `Est. ${savingsMs} ms savings` : "")),
      savingsMs,
      savingsBytes,
      savingsBytesLabel: formatBytes(savingsBytes),
      category: isSeo ? "SEO" : (guide == null ? void 0 : guide.metricTarget) || "PERFORMANCE",
      fixMode: (guide == null ? void 0 : guide.fixMode) || (isSeo ? "IN_APP_AUTO" : "THEME_MANUAL"),
      inAppTarget: (guide == null ? void 0 : guide.inAppTarget) || "",
      items: mapAuditItems(audit)
    };
    if (isSeo) {
      seoFindings.push(entry2);
    } else {
      opportunities.push(entry2);
    }
  }
  opportunities.sort((a, b) => {
    const weightA = a.savingsMs + a.savingsBytes / 1e3 + (100 - a.score) * 10;
    const weightB = b.savingsMs + b.savingsBytes / 1e3 + (100 - b.score) * 10;
    return weightB - weightA;
  });
  seoFindings.sort((a, b) => a.score - b.score);
  const parsed = {
    testedUrl: requestedUrl || finalUrl,
    finalUrl,
    strategy,
    fetchTime: lhr.fetchTime || (/* @__PURE__ */ new Date()).toISOString(),
    runtimeError: ((_D = lhr.runtimeError) == null ? void 0 : _D.message) || "",
    passwordProtected,
    hasFieldData: Boolean((fieldMetrics == null ? void 0 : fieldMetrics.LARGEST_CONTENTFUL_PAINT_MS) || (fieldMetrics == null ? void 0 : fieldMetrics.INTERACTION_TO_NEXT_PAINT)),
    scores: {
      performance: roundScore((_E = categories.performance) == null ? void 0 : _E.score),
      seo: roundScore((_F = categories.seo) == null ? void 0 : _F.score),
      accessibility: roundScore((_G = categories.accessibility) == null ? void 0 : _G.score),
      bestPractices: roundScore((_H = categories["best-practices"]) == null ? void 0 : _H.score)
    },
    metrics: {
      lcp: {
        label: "LCP (Largest Contentful Paint)",
        value: typeof lcpMs === "number" ? Math.round(lcpMs) : null,
        displayValue: ((_I = audits["largest-contentful-paint"]) == null ? void 0 : _I.displayValue) || formatMs(lcpMs),
        rating: rateMetric(lcpMs, 2500, 4e3),
        target: "≤ 2.5 s"
      },
      inp: {
        label: fieldInpMs !== null ? "INP (Real CrUX Field)" : "TBT (INP Lab Proxy)",
        value: typeof effectiveInpMs === "number" ? Math.round(effectiveInpMs) : null,
        displayValue: fieldInpMs !== null ? formatMs(fieldInpMs) : ((_J = audits["total-blocking-time"]) == null ? void 0 : _J.displayValue) || formatMs(tbtMs),
        rating: fieldInpMs !== null ? rateMetric(fieldInpMs, 200, 500) : rateMetric(tbtMs, 200, 600),
        target: "≤ 200 ms"
      },
      cls: {
        label: "CLS (Cumulative Layout Shift)",
        value: typeof clsVal === "number" ? Number(clsVal.toFixed(3)) : null,
        displayValue: ((_K = audits["cumulative-layout-shift"]) == null ? void 0 : _K.displayValue) || (typeof clsVal === "number" ? clsVal.toFixed(3) : "N/A"),
        rating: rateMetric(clsVal, 0.1, 0.25),
        target: "≤ 0.10"
      },
      fcp: {
        label: "FCP (First Contentful Paint)",
        value: typeof fcpMs === "number" ? Math.round(fcpMs) : null,
        displayValue: ((_L = audits["first-contentful-paint"]) == null ? void 0 : _L.displayValue) || formatMs(fcpMs),
        rating: rateMetric(fcpMs, 1800, 3e3),
        target: "≤ 1.8 s"
      },
      ttfb: {
        label: "TTFB (Server Response)",
        value: typeof ttfbMs === "number" ? Math.round(ttfbMs) : null,
        displayValue: ((_M = audits["server-response-time"]) == null ? void 0 : _M.displayValue) || formatMs(ttfbMs),
        rating: rateMetric(ttfbMs, 800, 1800),
        target: "≤ 800 ms"
      },
      si: {
        label: "Speed Index",
        value: typeof siMs === "number" ? Math.round(siMs) : null,
        displayValue: ((_N = audits["speed-index"]) == null ? void 0 : _N.displayValue) || formatMs(siMs),
        rating: rateMetric(siMs, 3400, 5800),
        target: "≤ 3.4 s"
      }
    },
    lcpElement,
    totalBytes,
    totalBytesLabel: formatBytes(totalBytes) || "N/A",
    opportunities: opportunities.slice(0, 12),
    seoFindings: seoFindings.slice(0, 10)
  };
  parsed.manualChecklist = buildManualPageSpeedChecklist(parsed);
  return parsed;
}
async function runLivePageSpeedTest({
  url,
  shop,
  strategy = "mobile",
  apiKey = "",
  fetchImpl = globalThis.fetch
}) {
  var _a2;
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
    signal: typeof AbortSignal !== "undefined" && AbortSignal.timeout ? AbortSignal.timeout(45e3) : void 0
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const rawMsg = ((_a2 = payload == null ? void 0 : payload.error) == null ? void 0 : _a2.message) || `Google PageSpeed Insights returned HTTP ${response.status}.`;
    if (response.status === 429) {
      throw new Error(
        "Google PageSpeed API public rate limit reached. Add a Google PageSpeed API key in SuperAdmin → AI & API Config (or .env GOOGLE_PAGESPEED_API_KEY) for dedicated quota."
      );
    }
    throw new Error(rawMsg);
  }
  return parsePageSpeedApiResponse(payload, normalizedUrl, cleanStrategy);
}
const links$8 = () => [{
  rel: "stylesheet",
  href: seoStyles
}];
function toCompactHistoryEntry(report) {
  var _a2, _b, _c, _d, _e, _f, _g, _h;
  if (!report) return null;
  return {
    testedAt: report.fetchTime || (/* @__PURE__ */ new Date()).toISOString(),
    url: report.testedUrl,
    strategy: report.strategy,
    performance: ((_a2 = report.scores) == null ? void 0 : _a2.performance) ?? null,
    seo: ((_b = report.scores) == null ? void 0 : _b.seo) ?? null,
    accessibility: ((_c = report.scores) == null ? void 0 : _c.accessibility) ?? null,
    bestPractices: ((_d = report.scores) == null ? void 0 : _d.bestPractices) ?? null,
    lcp: ((_f = (_e = report.metrics) == null ? void 0 : _e.lcp) == null ? void 0 : _f.displayValue) || "N/A",
    cls: ((_h = (_g = report.metrics) == null ? void 0 : _g.cls) == null ? void 0 : _h.displayValue) || "N/A",
    passwordProtected: Boolean(report.passwordProtected)
  };
}
async function resolveMatchedProduct({
  shop,
  token,
  apiVersion,
  appState,
  targetUrl
}) {
  var _a2;
  const handle = extractProductHandleFromUrl(targetUrl);
  if (!handle || !token || !shop) return null;
  try {
    const product = await fetchProductByHandle({
      storeDomain: shop,
      token,
      apiVersion,
      handle
    });
    if (!product) return null;
    const savedSeo = ((_a2 = appState == null ? void 0 : appState.productSeo) == null ? void 0 : _a2[String(product.id)]) || {};
    return mapShopifyProductToSeoRow(product, savedSeo);
  } catch {
    return null;
  }
}
const loader$a = async ({
  request
}) => {
  var _a2;
  const {
    configError,
    shop,
    token,
    apiVersion
  } = await requireShopContext(request);
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
        completedManualIds: []
      },
      sampleProducts: [],
      matchedProduct: null,
      creditAccount: {
        availableCredits: 0,
        effectiveTotal: PLAN_ALLOWANCES.FREE,
        plan: "FREE"
      },
      hasSuperAccess: false,
      aiReady: false,
      aiUnavailableReason: configError || "Shop session required.",
      hasPageSpeedKey: false
    };
  }
  const [appState, creditAccount, storeControl, platformAi, aiAccess, pageSpeedCfg, productList] = await Promise.all([getAppState(shop), getOrCreateCreditAccount(shop), getOrCreateStoreControl(shop), getEffectivePlatformAiSettings(), checkStoreRouteAccess(shop, "ai_features"), getEffectivePageSpeedConfig(), token ? fetchProducts({
    storeDomain: shop,
    token,
    apiVersion,
    limit: 10,
    includeDescription: false
  }).catch(() => ({
    products: []
  })) : Promise.resolve({
    products: []
  })]);
  const defaultUrl = ((_a2 = appState == null ? void 0 : appState.pageSpeed) == null ? void 0 : _a2.lastTestedUrl) || `https://${shop}`;
  const sampleProducts = ((productList == null ? void 0 : productList.products) || []).map((p) => ({
    id: String(p.id),
    title: String(p.title || ""),
    handle: String(p.handle || ""),
    url: `https://${shop}/products/${p.handle}`
  }));
  const matchedProduct = await resolveMatchedProduct({
    shop,
    token,
    apiVersion,
    appState,
    targetUrl: defaultUrl
  });
  const hasSuperAccess = Boolean(storeControl == null ? void 0 : storeControl.superAccess);
  const aiReady = Boolean(platformAi.isEnabled) && Boolean(platformAi.apiKey) && Boolean(aiAccess == null ? void 0 : aiAccess.allowed);
  let aiUnavailableReason = "";
  if (!platformAi.isEnabled) aiUnavailableReason = "Platform Gemini AI is paused by SuperAdmin.";
  else if (!platformAi.apiKey) aiUnavailableReason = "Gemini API key is not configured in SuperAdmin.";
  else if (!(aiAccess == null ? void 0 : aiAccess.allowed)) aiUnavailableReason = (aiAccess == null ? void 0 : aiAccess.reason) || "AI access restricted for this store.";
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
      plan: creditAccount.plan
    },
    hasSuperAccess,
    aiReady,
    aiUnavailableReason,
    hasPageSpeedKey: Boolean(pageSpeedCfg == null ? void 0 : pageSpeedCfg.apiKey)
  };
};
const action$8 = async ({
  request
}) => {
  var _a2, _b, _c, _d, _e, _f, _g, _h;
  const {
    shop,
    token,
    apiVersion,
    configError
  } = await requireShopContext(request);
  if (configError || !shop) {
    return {
      ok: false,
      error: configError || "Shop session required."
    };
  }
  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");
  if (intent === "runTest") {
    const rawTargetUrl = String(formData.get("targetUrl") || "").trim();
    const strategyMode = String(formData.get("strategy") || "mobile").toLowerCase();
    try {
      const normalizedUrl = normalizePageSpeedTargetUrl(shop, rawTargetUrl);
      const pageSpeedCfg = await getEffectivePageSpeedConfig();
      const apiKey = (pageSpeedCfg == null ? void 0 : pageSpeedCfg.apiKey) || "";
      const [mobileReport, desktopReport] = strategyMode === "both" ? await Promise.all([runLivePageSpeedTest({
        url: normalizedUrl,
        shop,
        strategy: "mobile",
        apiKey
      }), runLivePageSpeedTest({
        url: normalizedUrl,
        shop,
        strategy: "desktop",
        apiKey
      })]) : strategyMode === "desktop" ? [null, await runLivePageSpeedTest({
        url: normalizedUrl,
        shop,
        strategy: "desktop",
        apiKey
      })] : [await runLivePageSpeedTest({
        url: normalizedUrl,
        shop,
        strategy: "mobile",
        apiKey
      }), null];
      const testedAt = (/* @__PURE__ */ new Date()).toISOString();
      const newHistoryItems = [toCompactHistoryEntry(mobileReport), toCompactHistoryEntry(desktopReport)].filter(Boolean);
      const nextState = await updateAppState(shop, (current) => {
        const prevPs = current.pageSpeed || {};
        const urlChanged = prevPs.lastTestedUrl && prevPs.lastTestedUrl !== normalizedUrl;
        const mergedHistory = [...newHistoryItems, ...Array.isArray(prevPs.history) ? prevPs.history : []].slice(0, 15);
        return {
          ...current,
          pageSpeed: {
            ...prevPs,
            lastTestedUrl: normalizedUrl,
            lastTestedAt: testedAt,
            mobile: mobileReport || (urlChanged ? null : prevPs.mobile),
            desktop: desktopReport || (urlChanged ? null : prevPs.desktop),
            history: mergedHistory,
            lastAiPlan: urlChanged ? null : prevPs.lastAiPlan || null
          }
        };
      });
      const matchedProduct = await resolveMatchedProduct({
        shop,
        token,
        apiVersion,
        appState: nextState,
        targetUrl: normalizedUrl
      });
      return {
        ok: true,
        intent: "runTest",
        testedStrategy: strategyMode,
        pageSpeed: nextState.pageSpeed,
        matchedProduct
      };
    } catch (error) {
      return {
        ok: false,
        intent: "runTest",
        error: (error == null ? void 0 : error.message) || "Failed to run live Google PageSpeed Insights test."
      };
    }
  }
  if (intent === "toggleManualCheck") {
    const checkId = String(formData.get("checkId") || "").trim();
    const completed = formData.get("completed") === "true";
    if (!checkId) return {
      ok: false,
      intent,
      error: "Invalid check ID."
    };
    const nextState = await updateAppState(shop, (current) => {
      var _a3;
      const existing = new Set(((_a3 = current.pageSpeed) == null ? void 0 : _a3.completedManualIds) || []);
      if (completed) existing.add(checkId);
      else existing.delete(checkId);
      return {
        ...current,
        pageSpeed: {
          ...current.pageSpeed || {},
          completedManualIds: Array.from(existing)
        }
      };
    });
    return {
      ok: true,
      intent: "toggleManualCheck",
      completedManualIds: nextState.pageSpeed.completedManualIds
    };
  }
  if (intent === "aiFixMatchedProduct") {
    const productId = String(formData.get("productId") || "").trim();
    if (!productId) {
      return {
        ok: false,
        intent,
        error: "Select or test a product URL to auto-fix it."
      };
    }
    try {
      const liveProduct = await fetchProductById({
        storeDomain: shop,
        token,
        apiVersion,
        productId
      });
      if (!liveProduct) {
        return {
          ok: false,
          intent,
          error: "Product could not be loaded from Shopify."
        };
      }
      const appState = await getAppState(shop);
      const row = mapShopifyProductToSeoRow(liveProduct, ((_a2 = appState == null ? void 0 : appState.productSeo) == null ? void 0 : _a2[productId]) || {});
      const result = await runAiAutoFixProducts({
        shop,
        storeDomain: shop,
        token,
        apiVersion,
        products: [{
          id: row.id,
          title: row.title,
          handle: row.handle,
          focusKeyword: row.focusKeyword,
          metaTitle: row.metaTitle,
          metaDescription: row.metaDescription
        }]
      });
      if (!result.ok) return {
        ...result,
        intent
      };
      const refreshed = await fetchProductById({
        storeDomain: shop,
        token,
        apiVersion,
        productId
      });
      const nextAppState = await getAppState(shop);
      const updatedRow = refreshed ? mapShopifyProductToSeoRow(refreshed, ((_b = nextAppState == null ? void 0 : nextAppState.productSeo) == null ? void 0 : _b[productId]) || {}) : row;
      return {
        ...result,
        intent,
        matchedProduct: updatedRow
      };
    } catch (error) {
      return {
        ok: false,
        intent,
        error: (error == null ? void 0 : error.message) || "Failed to AI-fix product."
      };
    }
  }
  if (intent === "manualSaveMatchedProduct") {
    const productId = String(formData.get("productId") || "").trim();
    if (!productId) {
      return {
        ok: false,
        intent,
        error: "Product ID is required."
      };
    }
    try {
      const payload = {
        title: String(formData.get("title") || ""),
        focusKeyword: String(formData.get("focusKeyword") || ""),
        handle: String(formData.get("handle") || ""),
        metaTitle: String(formData.get("metaTitle") || ""),
        metaDescription: String(formData.get("metaDescription") || "")
      };
      const saved = await saveProductSeoAndRescan({
        shop,
        storeDomain: shop,
        token,
        apiVersion,
        productId,
        payload
      });
      if (!saved.ok) {
        return {
          ok: false,
          intent,
          error: ((_c = saved.errors) == null ? void 0 : _c.metaTitle) || ((_d = saved.errors) == null ? void 0 : _d.metaDescription) || ((_e = saved.errors) == null ? void 0 : _e.title) || ((_f = saved.errors) == null ? void 0 : _f.focusKeyword) || ((_g = saved.errors) == null ? void 0 : _g.handle) || "Check highlighted SEO fields before saving."
        };
      }
      const refreshed = await fetchProductById({
        storeDomain: shop,
        token,
        apiVersion,
        productId
      });
      const appState = await getAppState(shop);
      const matchedProduct = refreshed ? mapShopifyProductToSeoRow(refreshed, ((_h = appState == null ? void 0 : appState.productSeo) == null ? void 0 : _h[productId]) || {}) : null;
      return {
        ok: true,
        intent,
        redirectCreated: saved.redirectCreated,
        matchedProduct
      };
    } catch (error) {
      return {
        ok: false,
        intent,
        error: (error == null ? void 0 : error.message) || "Unable to save manual product SEO update."
      };
    }
  }
  return {
    ok: false,
    error: "Unsupported PageSpeed action."
  };
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
const app_pagespeed = UNSAFE_withComponentProps(function PageSpeedDashboardPage() {
  var _a2, _b, _c, _d, _e, _f, _g, _h, _i, _j;
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
  const [workbenchTab, setWorkbenchTab] = useState(urlModeParam === "manual" ? "manual" : "ai");
  useEffect(() => {
    if (urlModeParam === "ai" || urlModeParam === "manual") {
      setWorkbenchTab(urlModeParam);
    }
  }, [urlModeParam]);
  const [pageSpeedState, setPageSpeedState] = useState(loaderData.pageSpeed);
  const [matchedProduct, setMatchedProduct] = useState(loaderData.matchedProduct);
  const [manualDraft, setManualDraft] = useState(() => {
    var _a3, _b2, _c2, _d2, _e2;
    return {
      title: ((_a3 = loaderData.matchedProduct) == null ? void 0 : _a3.title) || "",
      focusKeyword: ((_b2 = loaderData.matchedProduct) == null ? void 0 : _b2.focusKeyword) || "",
      handle: ((_c2 = loaderData.matchedProduct) == null ? void 0 : _c2.handle) || "",
      metaTitle: ((_d2 = loaderData.matchedProduct) == null ? void 0 : _d2.metaTitle) || "",
      metaDescription: ((_e2 = loaderData.matchedProduct) == null ? void 0 : _e2.metaDescription) || ""
    };
  });
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
        metaDescription: loaderData.matchedProduct.metaDescription || ""
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
          metaDescription: testFetcher.data.matchedProduct.metaDescription || ""
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
        message: "Updated real Lighthouse scores and Core Web Vitals."
      });
    } else if (testFetcher.data.error) {
      showToast({
        tone: "error",
        title: "PageSpeed Test Error",
        message: testFetcher.data.error
      });
    }
  }, [testFetcher.state, testFetcher.data]);
  useEffect(() => {
    var _a3, _b2;
    if (manualFetcher.state === "idle" && ((_a3 = manualFetcher.data) == null ? void 0 : _a3.ok) && ((_b2 = manualFetcher.data) == null ? void 0 : _b2.completedManualIds)) {
      setPageSpeedState((prev) => ({
        ...prev,
        completedManualIds: manualFetcher.data.completedManualIds
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
          generatedAt: (/* @__PURE__ */ new Date()).toISOString()
        }
      }));
      if (aiPlanFetcher.data.creditsRemaining !== void 0) {
        dispatchCreditsUpdate({
          availableCredits: aiPlanFetcher.data.creditsRemaining,
          plan: aiPlanFetcher.data.plan,
          superAccess: Boolean(aiPlanFetcher.data.superAccess)
        });
      }
      showToast({
        tone: "success",
        title: "AI Speed & SEO Fix Plan Ready",
        message: aiPlanFetcher.data.superAccess ? "Generated with Super Access." : `Deducted ${aiPlanFetcher.data.creditsDeducted} token(s).`
      });
    } else if (aiPlanFetcher.data.error) {
      showToast({
        tone: "error",
        title: "AI Fix Error",
        message: aiPlanFetcher.data.error
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
          metaDescription: fixFetcher.data.matchedProduct.metaDescription || ""
        });
      }
      if (fixFetcher.data.creditsRemaining !== void 0) {
        dispatchCreditsUpdate({
          availableCredits: fixFetcher.data.creditsRemaining,
          plan: fixFetcher.data.plan,
          superAccess: Boolean(fixFetcher.data.superAccess)
        });
      }
      showToast({
        tone: "success",
        title: fixFetcher.data.intent === "aiFixMatchedProduct" ? "Product SEO Auto-Fixed" : "Manual SEO Changes Saved",
        message: fixFetcher.data.redirectCreated ? "Saved to Shopify with an automatic 301 redirect." : "Updated live Shopify product SEO. Click Re-Test Live to verify score gain."
      });
    } else if (fixFetcher.data.error) {
      showToast({
        tone: "error",
        title: "Fix Failed",
        message: fixFetcher.data.error
      });
    }
  }, [fixFetcher.state, fixFetcher.data]);
  const activeReport = useMemo(() => {
    if (activeDeviceTab === "desktop") {
      return (pageSpeedState == null ? void 0 : pageSpeedState.desktop) || (pageSpeedState == null ? void 0 : pageSpeedState.mobile) || null;
    }
    return (pageSpeedState == null ? void 0 : pageSpeedState.mobile) || (pageSpeedState == null ? void 0 : pageSpeedState.desktop) || null;
  }, [activeDeviceTab, pageSpeedState]);
  const previousSameStrategy = useMemo(() => {
    if (!activeReport || !Array.isArray(pageSpeedState == null ? void 0 : pageSpeedState.history)) return null;
    const matches = pageSpeedState.history.filter((item) => item.strategy === activeReport.strategy && item.url === activeReport.testedUrl);
    return matches.length > 1 ? matches[1] : null;
  }, [activeReport, pageSpeedState == null ? void 0 : pageSpeedState.history]);
  const completedManualSet = useMemo(() => new Set((pageSpeedState == null ? void 0 : pageSpeedState.completedManualIds) || []), [pageSpeedState == null ? void 0 : pageSpeedState.completedManualIds]);
  const isTesting = testFetcher.state !== "idle";
  const isGeneratingAiPlan = aiPlanFetcher.state !== "idle";
  const isFixingProduct = fixFetcher.state !== "idle";
  function handleRunLiveTest(event) {
    event == null ? void 0 : event.preventDefault();
    const formData = new FormData();
    formData.set("intent", "runTest");
    formData.set("targetUrl", targetUrl);
    formData.set("strategy", strategy);
    testFetcher.submit(formData, {
      method: "post"
    });
  }
  function handleGenerateAiPlan() {
    if (!activeReport) return;
    aiPlanFetcher.submit({
      actionType: "pagespeed_ai_fix",
      payload: {
        title: (matchedProduct == null ? void 0 : matchedProduct.title) || activeReport.testedUrl,
        matchedProductTitle: (matchedProduct == null ? void 0 : matchedProduct.title) || "",
        report: activeReport,
        mobileReport: (pageSpeedState == null ? void 0 : pageSpeedState.mobile) || null,
        desktopReport: (pageSpeedState == null ? void 0 : pageSpeedState.desktop) || null
      }
    }, {
      method: "post",
      action: "/app/api/ai",
      encType: "application/json"
    });
  }
  function handleToggleManualCheck(checkId, nextDone) {
    const formData = new FormData();
    formData.set("intent", "toggleManualCheck");
    formData.set("checkId", checkId);
    formData.set("completed", nextDone ? "true" : "false");
    manualFetcher.submit(formData, {
      method: "post"
    });
  }
  function handleCopyCode(text2, label2 = "Snippet") {
    if (!text2 || typeof navigator === "undefined" || !navigator.clipboard) return;
    navigator.clipboard.writeText(text2);
    showToast({
      tone: "success",
      title: `${label2} Copied`,
      message: "Paste this into Online Store → Themes → Edit code."
    });
  }
  const aiPlan = (pageSpeedState == null ? void 0 : pageSpeedState.lastAiPlan) || null;
  return /* @__PURE__ */ jsxs(Fragment, {
    children: [/* @__PURE__ */ jsx("ui-title-bar", {
      title: "Technical & History — PageSpeed & CWV"
    }), /* @__PURE__ */ jsxs("div", {
      className: "seo-wrap seo-grid",
      children: [/* @__PURE__ */ jsx(WorkspaceSubnav, {
        group: "technical"
      }), loaderData.configError ? /* @__PURE__ */ jsx("div", {
        className: "error-box",
        children: loaderData.configError
      }) : null, /* @__PURE__ */ jsxs("section", {
        className: "section-card seo-grid",
        children: [/* @__PURE__ */ jsxs("div", {
          className: "section-header",
          style: {
            alignItems: "center"
          },
          children: [/* @__PURE__ */ jsxs("div", {
            children: [/* @__PURE__ */ jsx("h2", {
              style: {
                margin: "0 0 2px",
                fontSize: "16px"
              },
              children: "Live Google PageSpeed Insights Test"
            }), /* @__PURE__ */ jsxs("p", {
              className: "seo-muted",
              style: {
                fontSize: "13px"
              },
              children: ["Runs real Google Lighthouse + Core Web Vitals against your live storefront URL (Mobile & Desktop), then offers ", /* @__PURE__ */ jsx("strong", {
                children: "AI Fixing"
              }), " or ", /* @__PURE__ */ jsx("strong", {
                children: "Manual Fixing"
              }), "."]
            })]
          }), /* @__PURE__ */ jsx(StatusPill, {
            tone: "info",
            children: "Free Live PSI Scan"
          })]
        }), /* @__PURE__ */ jsxs("form", {
          onSubmit: handleRunLiveTest,
          className: "seo-grid",
          style: {
            gap: "12px"
          },
          children: [/* @__PURE__ */ jsxs("div", {
            className: "seo-grid grid-3",
            style: {
              gap: "12px"
            },
            children: [/* @__PURE__ */ jsxs("div", {
              children: [/* @__PURE__ */ jsx("label", {
                className: "seo-label",
                htmlFor: "ps-quick-pick",
                children: "Quick Pick Store URL"
              }), /* @__PURE__ */ jsxs("select", {
                id: "ps-quick-pick",
                className: "seo-input",
                value: "",
                onChange: (e) => {
                  if (e.target.value) setTargetUrl(e.target.value);
                },
                children: [/* @__PURE__ */ jsx("option", {
                  value: "",
                  children: "Choose store page or product..."
                }), loaderData.shop ? /* @__PURE__ */ jsxs(Fragment, {
                  children: [/* @__PURE__ */ jsx("option", {
                    value: `https://${loaderData.shop}`,
                    children: "🏠 Store Homepage"
                  }), /* @__PURE__ */ jsx("option", {
                    value: `https://${loaderData.shop}/collections/all`,
                    children: "📦 All Collections"
                  })]
                }) : null, loaderData.sampleProducts.map((p) => /* @__PURE__ */ jsxs("option", {
                  value: p.url,
                  children: ["🛍️ Product: ", p.title]
                }, p.id))]
              })]
            }), /* @__PURE__ */ jsxs("div", {
              children: [/* @__PURE__ */ jsx("label", {
                className: "seo-label",
                htmlFor: "ps-target-url",
                children: "Public Storefront URL or Path"
              }), /* @__PURE__ */ jsx("input", {
                id: "ps-target-url",
                className: "seo-input",
                value: targetUrl,
                onChange: (e) => setTargetUrl(e.target.value),
                placeholder: `https://${loaderData.shop || "yourstore.com"} or /products/...`
              })]
            }), /* @__PURE__ */ jsxs("div", {
              children: [/* @__PURE__ */ jsx("label", {
                className: "seo-label",
                htmlFor: "ps-strategy",
                children: "Test Strategy"
              }), /* @__PURE__ */ jsxs("select", {
                id: "ps-strategy",
                className: "seo-input",
                value: strategy,
                onChange: (e) => setStrategy(e.target.value),
                children: [/* @__PURE__ */ jsx("option", {
                  value: "mobile",
                  children: "Mobile (Google Mobile-First)"
                }), /* @__PURE__ */ jsx("option", {
                  value: "desktop",
                  children: "Desktop"
                }), /* @__PURE__ */ jsx("option", {
                  value: "both",
                  children: "Both Mobile + Desktop"
                })]
              })]
            })]
          }), /* @__PURE__ */ jsxs("div", {
            className: "toolbar",
            style: {
              justifyContent: "space-between",
              marginBottom: 0
            },
            children: [/* @__PURE__ */ jsx("small", {
              className: "seo-muted",
              children: loaderData.hasPageSpeedKey ? "Using configured Google PageSpeed API key (10–25s per live Lighthouse audit)." : "Using Google PSI public quota (add a key in SuperAdmin → AI Config anytime for heavy testing)."
            }), /* @__PURE__ */ jsx("button", {
              type: "submit",
              className: "seo-button",
              disabled: isTesting || Boolean(loaderData.configError),
              children: isTesting ? "Running Google Lighthouse (10–25s)..." : "🚀 Run Live PageSpeed Test"
            })]
          })]
        })]
      }), (activeReport == null ? void 0 : activeReport.passwordProtected) ? /* @__PURE__ */ jsxs("div", {
        className: "status-banner banner-warn",
        children: [/* @__PURE__ */ jsx("strong", {
          children: "Storefront Password Gate Detected:"
        }), " Google PageSpeed tested your Shopify password page (", /* @__PURE__ */ jsx("code", {
          children: activeReport.finalUrl
        }), "). Disable storefront password protection under Shopify Admin → Online Store → Preferences to score your real storefront theme."]
      }) : null, activeReport ? /* @__PURE__ */ jsxs(Fragment, {
        children: [/* @__PURE__ */ jsxs("section", {
          className: "section-card seo-grid",
          children: [/* @__PURE__ */ jsxs("div", {
            className: "toolbar",
            style: {
              justifyContent: "space-between",
              marginBottom: 0
            },
            children: [/* @__PURE__ */ jsxs("div", {
              children: [/* @__PURE__ */ jsx("h3", {
                style: {
                  margin: 0
                },
                children: "Live Lighthouse Scores"
              }), /* @__PURE__ */ jsxs("small", {
                className: "seo-muted",
                suppressHydrationWarning: true,
                children: ["URL: ", /* @__PURE__ */ jsx("code", {
                  children: activeReport.testedUrl
                }), " ·", " ", activeReport.fetchTime ? new Date(activeReport.fetchTime).toLocaleString() : "", " · Page Weight:", " ", /* @__PURE__ */ jsx("strong", {
                  children: activeReport.totalBytesLabel
                })]
              })]
            }), /* @__PURE__ */ jsxs("div", {
              className: "filter-pills",
              children: [/* @__PURE__ */ jsxs("button", {
                type: "button",
                className: `filter-pill ${activeDeviceTab === "mobile" ? "active" : ""}`,
                onClick: () => setActiveDeviceTab("mobile"),
                disabled: !(pageSpeedState == null ? void 0 : pageSpeedState.mobile),
                children: ["Mobile ", ((_b = (_a2 = pageSpeedState == null ? void 0 : pageSpeedState.mobile) == null ? void 0 : _a2.scores) == null ? void 0 : _b.performance) ?? "--"]
              }), /* @__PURE__ */ jsxs("button", {
                type: "button",
                className: `filter-pill ${activeDeviceTab === "desktop" ? "active" : ""}`,
                onClick: () => setActiveDeviceTab("desktop"),
                disabled: !(pageSpeedState == null ? void 0 : pageSpeedState.desktop),
                children: ["Desktop ", ((_d = (_c = pageSpeedState == null ? void 0 : pageSpeedState.desktop) == null ? void 0 : _c.scores) == null ? void 0 : _d.performance) ?? "--"]
              })]
            })]
          }), /* @__PURE__ */ jsx("div", {
            className: "seo-grid grid-4",
            children: [{
              key: "performance",
              label: "Performance",
              val: (_e = activeReport.scores) == null ? void 0 : _e.performance
            }, {
              key: "seo",
              label: "Technical SEO",
              val: (_f = activeReport.scores) == null ? void 0 : _f.seo
            }, {
              key: "accessibility",
              label: "Accessibility",
              val: (_g = activeReport.scores) == null ? void 0 : _g.accessibility
            }, {
              key: "bestPractices",
              label: "Best Practices",
              val: (_h = activeReport.scores) == null ? void 0 : _h.bestPractices
            }].map((cat) => {
              const prevVal = previousSameStrategy == null ? void 0 : previousSameStrategy[cat.key];
              const delta = typeof prevVal === "number" && typeof cat.val === "number" ? cat.val - prevVal : null;
              return /* @__PURE__ */ jsxs("div", {
                className: "ps-score-card",
                children: [/* @__PURE__ */ jsx("div", {
                  className: `ps-score-ring ${scoreTone(cat.val)}`,
                  children: cat.val ?? "--"
                }), /* @__PURE__ */ jsx("strong", {
                  style: {
                    fontSize: "13.5px"
                  },
                  children: cat.label
                }), delta !== null && delta !== 0 ? /* @__PURE__ */ jsx(StatusPill, {
                  tone: delta > 0 ? "good" : "warning",
                  children: delta > 0 ? `+${delta} vs prev` : `${delta} vs prev`
                }) : /* @__PURE__ */ jsx("small", {
                  className: "seo-muted",
                  children: activeReport.strategy.toUpperCase()
                })]
              }, cat.key);
            })
          }), /* @__PURE__ */ jsxs("div", {
            children: [/* @__PURE__ */ jsxs("div", {
              style: {
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 8
              },
              children: [/* @__PURE__ */ jsx("strong", {
                style: {
                  fontSize: "13.5px"
                },
                children: "Core Web Vitals & Speed Telemetry"
              }), /* @__PURE__ */ jsx(StatusPill, {
                tone: activeReport.hasFieldData ? "good" : "info",
                children: activeReport.hasFieldData ? "Chrome UX Field + Lab" : "Lighthouse Lab Telemetry"
              })]
            }), /* @__PURE__ */ jsx("div", {
              className: "seo-grid grid-3",
              style: {
                gap: "10px"
              },
              children: Object.entries(activeReport.metrics || {}).map(([key, metric]) => /* @__PURE__ */ jsxs("div", {
                className: "ps-cwv-card",
                children: [/* @__PURE__ */ jsxs("div", {
                  style: {
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 6
                  },
                  children: [/* @__PURE__ */ jsx("span", {
                    className: "metric-label",
                    style: {
                      fontSize: "11px"
                    },
                    children: metric.label
                  }), /* @__PURE__ */ jsx(StatusPill, {
                    tone: cwvTone(metric.rating),
                    children: cwvLabel(metric.rating)
                  })]
                }), /* @__PURE__ */ jsx("div", {
                  className: "ps-cwv-val",
                  children: metric.displayValue
                }), /* @__PURE__ */ jsxs("small", {
                  className: "seo-muted",
                  children: ["Google Good Target: ", metric.target]
                })]
              }, key))
            })]
          }), activeReport.lcpElement ? /* @__PURE__ */ jsxs("div", {
            style: {
              background: "var(--seo-bg-accent)",
              padding: "10px 14px",
              borderRadius: 8
            },
            children: [/* @__PURE__ */ jsx("strong", {
              style: {
                fontSize: "12px"
              },
              children: "Detected LCP Hero Element:"
            }), " ", /* @__PURE__ */ jsx("code", {
              style: {
                fontSize: "12px",
                wordBreak: "break-all"
              },
              children: activeReport.lcpElement
            })]
          }) : null]
        }), /* @__PURE__ */ jsxs("section", {
          className: "section-card seo-grid",
          children: [/* @__PURE__ */ jsxs("div", {
            className: "toolbar",
            style: {
              justifyContent: "space-between",
              marginBottom: 0
            },
            children: [/* @__PURE__ */ jsxs("div", {
              children: [/* @__PURE__ */ jsx("h3", {
                style: {
                  margin: 0
                },
                children: "Speed & SEO Fix Workbench"
              }), /* @__PURE__ */ jsxs("p", {
                className: "seo-muted",
                style: {
                  margin: "2px 0 0",
                  fontSize: "13px"
                },
                children: ["Switch between ", /* @__PURE__ */ jsx("strong", {
                  children: "AI Fixing"
                }), " (Gemini diagnostics + 1-click product optimization) and ", /* @__PURE__ */ jsx("strong", {
                  children: "Manual Fixing"
                }), " (inline Shopify meta editor + Liquid code checklists)."]
              })]
            }), /* @__PURE__ */ jsxs("div", {
              className: "filter-pills",
              children: [/* @__PURE__ */ jsx("button", {
                type: "button",
                className: `filter-pill ${workbenchTab === "ai" ? "active" : ""}`,
                onClick: () => {
                  setWorkbenchTab("ai");
                  setSearchParams((prev) => {
                    const next = new URLSearchParams(prev);
                    next.set("mode", "ai");
                    return next;
                  }, {
                    replace: true
                  });
                },
                children: "⚡ AI Fixing"
              }), /* @__PURE__ */ jsxs("button", {
                type: "button",
                className: `filter-pill ${workbenchTab === "manual" ? "active" : ""}`,
                onClick: () => {
                  setWorkbenchTab("manual");
                  setSearchParams((prev) => {
                    const next = new URLSearchParams(prev);
                    next.set("mode", "manual");
                    return next;
                  }, {
                    replace: true
                  });
                },
                children: ["🛠️ Manual Fixing (", ((_i = activeReport.manualChecklist) == null ? void 0 : _i.length) || 0, ")"]
              })]
            })]
          }), workbenchTab === "ai" ? /* @__PURE__ */ jsxs("div", {
            className: "seo-grid",
            style: {
              gap: "14px"
            },
            children: [/* @__PURE__ */ jsxs("div", {
              className: "toolbar",
              style: {
                justifyContent: "space-between",
                background: "var(--seo-bg-accent)",
                padding: "14px 16px",
                borderRadius: 10,
                marginBottom: 0
              },
              children: [/* @__PURE__ */ jsxs("div", {
                children: [/* @__PURE__ */ jsx("strong", {
                  style: {
                    fontSize: "14px"
                  },
                  children: "Gemini AI Core Web Vitals & SEO Optimizer"
                }), /* @__PURE__ */ jsx("p", {
                  className: "seo-muted",
                  style: {
                    margin: "3px 0 0",
                    fontSize: "12.5px"
                  },
                  children: "Diagnoses your live Mobile & Desktop Lighthouse bottlenecks and generates exact Shopify theme Liquid fixes + in-app SEO actions."
                })]
              }), /* @__PURE__ */ jsx("button", {
                type: "button",
                className: "seo-button",
                disabled: !loaderData.aiReady || isGeneratingAiPlan,
                onClick: handleGenerateAiPlan,
                title: loaderData.aiReady ? "Analyze live PageSpeed bottlenecks with Gemini AI" : loaderData.aiUnavailableReason,
                children: isGeneratingAiPlan ? "Analyzing Bottlenecks..." : aiPlan ? `Refresh AI Fix Plan (${loaderData.hasSuperAccess ? "Super" : `${CREDIT_COSTS.pagespeed_ai_fix} tok`})` : `⚡ AI Fix Plan (${loaderData.hasSuperAccess ? "Super" : `${CREDIT_COSTS.pagespeed_ai_fix} tok`})`
              })]
            }), matchedProduct ? /* @__PURE__ */ jsxs("div", {
              className: "issue-product-row",
              children: [/* @__PURE__ */ jsxs("div", {
                className: "issue-product-info",
                children: [/* @__PURE__ */ jsxs("strong", {
                  children: ["Matched Store Product: ", matchedProduct.title]
                }), /* @__PURE__ */ jsxs("small", {
                  className: "seo-muted",
                  children: ["Meta Title: ", matchedProduct.metaTitle ? `${matchedProduct.metaTitle.length} chars` : "Missing", " · Meta Desc:", " ", matchedProduct.metaDescription ? `${matchedProduct.metaDescription.length} chars` : "Missing"]
                })]
              }), /* @__PURE__ */ jsx("button", {
                type: "button",
                className: "seo-button",
                disabled: !loaderData.aiReady || isFixingProduct,
                onClick: () => {
                  const fd = new FormData();
                  fd.set("intent", "aiFixMatchedProduct");
                  fd.set("productId", matchedProduct.id);
                  fixFetcher.submit(fd, {
                    method: "post"
                  });
                },
                children: isFixingProduct ? "Applying AI SEO..." : `1-Click AI Fix Product SEO (${loaderData.hasSuperAccess ? "Super" : `${CREDIT_COSTS.product_seo_fix} tok`})`
              })]
            }) : null, aiPlan ? /* @__PURE__ */ jsxs("div", {
              className: "ai-diff-card",
              children: [/* @__PURE__ */ jsxs("div", {
                className: "ai-diff-head",
                children: [/* @__PURE__ */ jsxs("div", {
                  children: [/* @__PURE__ */ jsx("h4", {
                    style: {
                      margin: 0
                    },
                    children: "🤖 AI Optimization Plan"
                  }), /* @__PURE__ */ jsxs("small", {
                    className: "seo-muted",
                    suppressHydrationWarning: true,
                    children: ["URL: ", /* @__PURE__ */ jsx("code", {
                      children: aiPlan.testedUrl
                    }), aiPlan.generatedAt ? ` · ${new Date(aiPlan.generatedAt).toLocaleString()}` : ""]
                  })]
                }), /* @__PURE__ */ jsx("span", {
                  className: "ctr-badge",
                  children: aiPlan.projectedPerformanceGain
                })]
              }), /* @__PURE__ */ jsx("p", {
                style: {
                  margin: 0,
                  fontSize: "14px",
                  lineHeight: 1.5
                },
                children: aiPlan.executiveSummary
              }), /* @__PURE__ */ jsxs("small", {
                style: {
                  color: "var(--seo-primary-strong)",
                  fontWeight: 600
                },
                children: ["SEO Impact: ", aiPlan.projectedSeoImpact]
              }), /* @__PURE__ */ jsx("div", {
                className: "seo-grid",
                style: {
                  gap: "10px"
                },
                children: (aiPlan.priorityFixes || []).map((fix, idx) => /* @__PURE__ */ jsxs("div", {
                  className: "ps-fix-card",
                  children: [/* @__PURE__ */ jsxs("div", {
                    className: "toolbar",
                    style: {
                      justifyContent: "space-between",
                      marginBottom: 0
                    },
                    children: [/* @__PURE__ */ jsxs("div", {
                      style: {
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        flexWrap: "wrap"
                      },
                      children: [/* @__PURE__ */ jsxs(StatusPill, {
                        tone: fix.impact === "HIGH" ? "critical" : "warning",
                        children: [fix.impact, " · ", fix.metricTarget]
                      }), /* @__PURE__ */ jsx("strong", {
                        children: fix.title
                      })]
                    }), /* @__PURE__ */ jsx(StatusPill, {
                      tone: "good",
                      children: fix.estimatedGain
                    })]
                  }), /* @__PURE__ */ jsx("p", {
                    style: {
                      margin: 0,
                      fontSize: "13px",
                      color: "#334155"
                    },
                    children: fix.actionSteps
                  }), fix.liquidSnippet ? /* @__PURE__ */ jsxs("div", {
                    className: "seo-grid",
                    style: {
                      gap: 6
                    },
                    children: [/* @__PURE__ */ jsxs("div", {
                      style: {
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center"
                      },
                      children: [/* @__PURE__ */ jsx("small", {
                        className: "seo-muted",
                        children: "Shopify Liquid / HTML Fix Snippet"
                      }), /* @__PURE__ */ jsx("button", {
                        type: "button",
                        className: "seo-button secondary small-btn",
                        onClick: () => handleCopyCode(fix.liquidSnippet, "Liquid Snippet"),
                        children: "Copy Code"
                      })]
                    }), /* @__PURE__ */ jsx("pre", {
                      className: "ps-code-block",
                      children: fix.liquidSnippet
                    })]
                  }) : null, fix.targetRoute ? /* @__PURE__ */ jsx("div", {
                    children: /* @__PURE__ */ jsx(Link, {
                      className: "seo-button secondary small-btn",
                      to: fix.targetRoute,
                      children: "Open In-App Fix Tool →"
                    })
                  }) : null]
                }, `ai-ps-fix-${idx}`))
              })]
            }) : /* @__PURE__ */ jsxs("div", {
              className: "status-banner",
              "data-no-toast": "true",
              children: ["Click ", /* @__PURE__ */ jsx("strong", {
                children: "⚡ AI Fix Plan"
              }), " above to let Gemini inspect the live PageSpeed diagnostics and generate targeted Shopify speed & SEO fixes."]
            })]
          }) : /* @__PURE__ */ jsxs("div", {
            className: "seo-grid",
            style: {
              gap: "16px"
            },
            children: [/* @__PURE__ */ jsxs("div", {
              className: "seo-grid grid-4",
              style: {
                gap: "10px"
              },
              children: [/* @__PURE__ */ jsxs(Link, {
                to: "/app/image-optimizer?status=needs-fix",
                className: "feature-card",
                children: [/* @__PURE__ */ jsx("h4", {
                  children: "🖼️ Image ALT & Media"
                }), /* @__PURE__ */ jsx("p", {
                  children: "Fix missing ALT tags & audit heavy product images."
                }), /* @__PURE__ */ jsx("span", {
                  children: "Open"
                })]
              }), /* @__PURE__ */ jsxs(Link, {
                to: "/app/bulk-meta",
                className: "feature-card",
                children: [/* @__PURE__ */ jsx("h4", {
                  children: "🏷️ Bulk Meta Tags"
                }), /* @__PURE__ */ jsx("p", {
                  children: "Fix missing page titles & meta descriptions manually."
                }), /* @__PURE__ */ jsx("span", {
                  children: "Open"
                })]
              }), /* @__PURE__ */ jsxs(Link, {
                to: "/app/robots",
                className: "feature-card",
                children: [/* @__PURE__ */ jsx("h4", {
                  children: "🤖 Robots.txt Crawl"
                }), /* @__PURE__ */ jsx("p", {
                  children: "Inspect live crawl directives & fix blocks."
                }), /* @__PURE__ */ jsx("span", {
                  children: "Open"
                })]
              }), /* @__PURE__ */ jsxs(Link, {
                to: "/app/url-optimization",
                className: "feature-card",
                children: [/* @__PURE__ */ jsx("h4", {
                  children: "🔗 Clean URLs & 301s"
                }), /* @__PURE__ */ jsx("p", {
                  children: "Shorten long product slugs with 301 safety."
                }), /* @__PURE__ */ jsx("span", {
                  children: "Open"
                })]
              })]
            }), matchedProduct ? /* @__PURE__ */ jsxs("div", {
              className: "section-card",
              style: {
                background: "#f8fafc"
              },
              children: [/* @__PURE__ */ jsxs("h4", {
                style: {
                  margin: "0 0 8px"
                },
                children: ["Manual Product SEO Fix: ", matchedProduct.title]
              }), /* @__PURE__ */ jsxs("div", {
                className: "seo-grid grid-2",
                style: {
                  gap: "10px"
                },
                children: [/* @__PURE__ */ jsxs("div", {
                  children: [/* @__PURE__ */ jsx("label", {
                    className: "seo-label",
                    children: "Product Title"
                  }), /* @__PURE__ */ jsx("input", {
                    className: "seo-input",
                    value: manualDraft.title,
                    onChange: (e) => setManualDraft((d) => ({
                      ...d,
                      title: e.target.value
                    }))
                  })]
                }), /* @__PURE__ */ jsxs("div", {
                  children: [/* @__PURE__ */ jsx("label", {
                    className: "seo-label",
                    children: "Focus Keyword"
                  }), /* @__PURE__ */ jsx("input", {
                    className: "seo-input",
                    value: manualDraft.focusKeyword,
                    onChange: (e) => setManualDraft((d) => ({
                      ...d,
                      focusKeyword: e.target.value
                    }))
                  })]
                }), /* @__PURE__ */ jsxs("div", {
                  children: [/* @__PURE__ */ jsxs("label", {
                    className: "seo-label",
                    children: ["Meta Title (", manualDraft.metaTitle.length, "/60)"]
                  }), /* @__PURE__ */ jsx("input", {
                    className: "seo-input",
                    value: manualDraft.metaTitle,
                    onChange: (e) => setManualDraft((d) => ({
                      ...d,
                      metaTitle: e.target.value
                    }))
                  })]
                }), /* @__PURE__ */ jsxs("div", {
                  children: [/* @__PURE__ */ jsx("label", {
                    className: "seo-label",
                    children: "URL Handle (301 safe)"
                  }), /* @__PURE__ */ jsx("input", {
                    className: "seo-input",
                    value: manualDraft.handle,
                    onChange: (e) => setManualDraft((d) => ({
                      ...d,
                      handle: e.target.value
                    }))
                  })]
                })]
              }), /* @__PURE__ */ jsxs("div", {
                style: {
                  marginTop: 10
                },
                children: [/* @__PURE__ */ jsxs("label", {
                  className: "seo-label",
                  children: ["Meta Description (", manualDraft.metaDescription.length, "/160)"]
                }), /* @__PURE__ */ jsx("textarea", {
                  rows: 2,
                  className: "seo-textarea",
                  value: manualDraft.metaDescription,
                  onChange: (e) => setManualDraft((d) => ({
                    ...d,
                    metaDescription: e.target.value
                  }))
                })]
              }), /* @__PURE__ */ jsxs("div", {
                className: "toolbar",
                style: {
                  marginTop: 12,
                  marginBottom: 0
                },
                children: [/* @__PURE__ */ jsx("button", {
                  type: "button",
                  className: "seo-button",
                  disabled: isFixingProduct,
                  onClick: () => {
                    const fd = new FormData();
                    fd.set("intent", "manualSaveMatchedProduct");
                    fd.set("productId", matchedProduct.id);
                    fd.set("title", manualDraft.title);
                    fd.set("focusKeyword", manualDraft.focusKeyword);
                    fd.set("handle", manualDraft.handle);
                    fd.set("metaTitle", manualDraft.metaTitle);
                    fd.set("metaDescription", manualDraft.metaDescription);
                    fixFetcher.submit(fd, {
                      method: "post"
                    });
                  },
                  children: isFixingProduct ? "Saving to Shopify..." : "Save Manual Product SEO"
                }), /* @__PURE__ */ jsx(Link, {
                  to: `/app/products?focus=${matchedProduct.id}`,
                  className: "seo-button secondary",
                  children: "Open Full Content Editor →"
                })]
              })]
            }) : null, /* @__PURE__ */ jsxs("div", {
              className: "seo-grid",
              style: {
                gap: "10px"
              },
              children: [/* @__PURE__ */ jsx("strong", {
                style: {
                  fontSize: "14px"
                },
                children: "Step-by-Step Theme & Lighthouse Manual Fixes"
              }), !(activeReport.manualChecklist || []).length ? /* @__PURE__ */ jsx("div", {
                className: "status-banner banner-good",
                children: "Zero major manual Lighthouse failures found on this scan. Keep monitoring periodically!"
              }) : (activeReport.manualChecklist || []).map((item) => {
                var _a3;
                const isDone = completedManualSet.has(item.id);
                return /* @__PURE__ */ jsxs("div", {
                  className: `ps-fix-card${isDone ? " done" : ""}`,
                  children: [/* @__PURE__ */ jsxs("div", {
                    className: "toolbar",
                    style: {
                      justifyContent: "space-between",
                      marginBottom: 0
                    },
                    children: [/* @__PURE__ */ jsxs("div", {
                      style: {
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        flexWrap: "wrap"
                      },
                      children: [/* @__PURE__ */ jsx(StatusPill, {
                        tone: isDone ? "good" : "warning",
                        children: item.metricTarget
                      }), /* @__PURE__ */ jsx("strong", {
                        style: {
                          textDecoration: isDone ? "line-through" : "none"
                        },
                        children: item.title
                      }), /* @__PURE__ */ jsxs("small", {
                        className: "seo-muted",
                        children: ["(", item.displayImpact, ")"]
                      })]
                    }), /* @__PURE__ */ jsx("button", {
                      type: "button",
                      className: `seo-button ${isDone ? "secondary" : ""}`,
                      style: {
                        fontSize: "12px",
                        padding: "5px 10px"
                      },
                      onClick: () => handleToggleManualCheck(item.id, !isDone),
                      children: isDone ? "✓ Marked Fixed (Undo)" : "Mark Fixed"
                    })]
                  }), /* @__PURE__ */ jsxs("small", {
                    className: "seo-muted",
                    children: ["Where to fix: ", /* @__PURE__ */ jsx("strong", {
                      children: item.fileHint
                    })]
                  }), /* @__PURE__ */ jsx("p", {
                    style: {
                      margin: 0,
                      fontSize: "13px",
                      color: "#334155"
                    },
                    children: item.steps
                  }), ((_a3 = item.offendingItems) == null ? void 0 : _a3.length) ? /* @__PURE__ */ jsx("ul", {
                    style: {
                      margin: 0,
                      paddingLeft: 18,
                      fontSize: "12px",
                      color: "#475569"
                    },
                    children: item.offendingItems.map((res, rIdx) => /* @__PURE__ */ jsxs("li", {
                      style: {
                        wordBreak: "break-all"
                      },
                      children: [/* @__PURE__ */ jsx("code", {
                        children: res.url || res.label || "Resource"
                      }), res.wastedMs ? ` · ${res.wastedMs} ms` : "", res.wastedBytes ? ` · ${Math.round(res.wastedBytes / 1024)} KB` : ""]
                    }, `${item.id}-res-${rIdx}`))
                  }) : null, item.snippet ? /* @__PURE__ */ jsxs("div", {
                    className: "seo-grid",
                    style: {
                      gap: 6
                    },
                    children: [/* @__PURE__ */ jsxs("div", {
                      style: {
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center"
                      },
                      children: [/* @__PURE__ */ jsx("small", {
                        className: "seo-muted",
                        children: "Manual Liquid / CSS Snippet"
                      }), /* @__PURE__ */ jsx("button", {
                        type: "button",
                        className: "seo-button secondary small-btn",
                        onClick: () => handleCopyCode(item.snippet, "Theme Fix"),
                        children: "Copy Code"
                      })]
                    }), /* @__PURE__ */ jsx("pre", {
                      className: "ps-code-block",
                      children: item.snippet
                    })]
                  }) : null, item.inAppTarget ? /* @__PURE__ */ jsx("div", {
                    children: /* @__PURE__ */ jsx(Link, {
                      className: "seo-button secondary small-btn",
                      to: item.inAppTarget,
                      children: "Fix Inside Ecom SEO →"
                    })
                  }) : null]
                }, item.id);
              })]
            })]
          })]
        })]
      }) : /* @__PURE__ */ jsxs("section", {
        className: "section-card",
        children: [/* @__PURE__ */ jsx("h3", {
          style: {
            marginTop: 0
          },
          children: "Ready to measure your live storefront speed & SEO"
        }), /* @__PURE__ */ jsxs("p", {
          className: "seo-muted",
          style: {
            marginBottom: 0
          },
          children: ["Choose your Store Homepage or any Product URL above and click ", /* @__PURE__ */ jsx("strong", {
            children: "🚀 Run Live PageSpeed Test"
          }), ". Google Lighthouse will measure live Performance, Core Web Vitals (", /* @__PURE__ */ jsx("code", {
            children: "LCP"
          }), ", ", /* @__PURE__ */ jsx("code", {
            children: "INP/TBT"
          }), ", ", /* @__PURE__ */ jsx("code", {
            children: "CLS"
          }), ", ", /* @__PURE__ */ jsx("code", {
            children: "TTFB"
          }), "), and Technical SEO, then unlock both ", /* @__PURE__ */ jsx("strong", {
            children: "AI Fixing"
          }), " and ", /* @__PURE__ */ jsx("strong", {
            children: "Manual Fixing"
          }), " tools."]
        })]
      }), ((_j = pageSpeedState == null ? void 0 : pageSpeedState.history) == null ? void 0 : _j.length) ? /* @__PURE__ */ jsxs("section", {
        id: "history",
        className: "section-card seo-grid",
        children: [/* @__PURE__ */ jsx("h3", {
          style: {
            margin: 0
          },
          children: "Recent Live PageSpeed History"
        }), /* @__PURE__ */ jsx("div", {
          style: {
            overflowX: "auto"
          },
          children: /* @__PURE__ */ jsxs("table", {
            className: "credit-usage-table",
            children: [/* @__PURE__ */ jsx("thead", {
              children: /* @__PURE__ */ jsxs("tr", {
                children: [/* @__PURE__ */ jsx("th", {
                  children: "Tested At"
                }), /* @__PURE__ */ jsx("th", {
                  children: "URL"
                }), /* @__PURE__ */ jsx("th", {
                  children: "Device"
                }), /* @__PURE__ */ jsx("th", {
                  children: "Performance"
                }), /* @__PURE__ */ jsx("th", {
                  children: "SEO"
                }), /* @__PURE__ */ jsx("th", {
                  children: "LCP"
                }), /* @__PURE__ */ jsx("th", {
                  children: "CLS"
                })]
              })
            }), /* @__PURE__ */ jsx("tbody", {
              children: pageSpeedState.history.map((row, idx) => /* @__PURE__ */ jsxs("tr", {
                children: [/* @__PURE__ */ jsx("td", {
                  suppressHydrationWarning: true,
                  children: new Date(row.testedAt).toLocaleString()
                }), /* @__PURE__ */ jsx("td", {
                  style: {
                    maxWidth: 260,
                    overflowWrap: "anywhere"
                  },
                  children: row.url
                }), /* @__PURE__ */ jsx("td", {
                  children: /* @__PURE__ */ jsx(StatusPill, {
                    tone: "info",
                    children: String(row.strategy || "mobile").toUpperCase()
                  })
                }), /* @__PURE__ */ jsx("td", {
                  children: /* @__PURE__ */ jsx("strong", {
                    children: row.performance ?? "--"
                  })
                }), /* @__PURE__ */ jsx("td", {
                  children: row.seo ?? "--"
                }), /* @__PURE__ */ jsx("td", {
                  children: row.lcp
                }), /* @__PURE__ */ jsx("td", {
                  children: row.cls
                })]
              }, `${row.testedAt}-${row.strategy}-${idx}`))
            })]
          })
        })]
      }) : null]
    })]
  });
});
const route20 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$8,
  default: app_pagespeed,
  links: links$8,
  loader: loader$a
}, Symbol.toStringTag, { value: "Module" }));
const links$7 = () => [{
  rel: "stylesheet",
  href: seoStyles
}];
function safeJsonParse(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
const REVISIONS_PAGE_SIZE = 25;
const loader$9 = async ({
  request
}) => {
  const {
    shop,
    configError
  } = await requireShopContext(request);
  if (configError || !shop) {
    return {
      configError,
      revisions: [],
      page: 1,
      totalPages: 1,
      totalCount: 0
    };
  }
  const url = new URL(request.url);
  const requestedPage = Math.max(1, Math.floor(Number(url.searchParams.get("page") || 1) || 1));
  const totalCount = await prisma.productRevision.count({
    where: {
      shop
    }
  });
  const totalPages = Math.max(1, Math.ceil(totalCount / REVISIONS_PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);
  const rows = await prisma.productRevision.findMany({
    where: {
      shop
    },
    orderBy: {
      createdAt: "desc"
    },
    skip: (page - 1) * REVISIONS_PAGE_SIZE,
    take: REVISIONS_PAGE_SIZE
  });
  const revisions = rows.map((row) => ({
    id: row.id,
    productId: row.productId,
    productTitle: row.productTitle,
    changeType: row.changeType,
    before: safeJsonParse(row.beforeJson) || {},
    after: safeJsonParse(row.afterJson) || {},
    aiVerdict: safeJsonParse(row.aiVerdictJson),
    redirectCreated: row.redirectCreated,
    createdAt: row.createdAt
  }));
  return {
    configError: "",
    revisions,
    page,
    totalPages,
    totalCount
  };
};
const action$7 = async ({
  request
}) => {
  const {
    shop,
    token,
    apiVersion,
    configError
  } = await requireShopContext(request);
  if (configError) {
    return {
      ok: false,
      error: configError
    };
  }
  const formData = await request.formData();
  const revisionId = String(formData.get("revisionId") || "").trim();
  if (!revisionId) {
    return {
      ok: false,
      error: "revisionId is required."
    };
  }
  try {
    const result = await rollbackProductRevision({
      shop,
      storeDomain: shop,
      token,
      apiVersion,
      revisionId
    });
    return {
      ok: true,
      rolledBackId: revisionId,
      redirectCreated: Boolean(result == null ? void 0 : result.redirectCreated)
    };
  } catch (error) {
    return {
      ok: false,
      error: (error == null ? void 0 : error.message) || "Failed to rollback revision."
    };
  }
};
const DIFF_FIELDS = [{
  key: "title",
  label: "Product Title"
}, {
  key: "focusKeyword",
  label: "Focus Keyword"
}, {
  key: "handle",
  label: "URL Handle"
}, {
  key: "metaTitle",
  label: "Meta Title"
}, {
  key: "metaDescription",
  label: "Meta Description"
}, {
  key: "descriptionHtml",
  label: "Product Description (HTML)"
}];
const app_revisions = UNSAFE_withComponentProps(function RevisionsRoute() {
  var _a2, _b, _c;
  const {
    configError,
    revisions,
    page = 1,
    totalPages = 1,
    totalCount = 0
  } = useLoaderData();
  const fetcher = useFetcher();
  const [expandedId, setExpandedId] = useState(((_a2 = revisions[0]) == null ? void 0 : _a2.id) || "");
  const [rollingBackId, setRollingBackId] = useState("");
  function handleRollback(revisionId) {
    setRollingBackId(revisionId);
    fetcher.submit({
      revisionId
    }, {
      method: "post"
    });
  }
  return /* @__PURE__ */ jsxs(Fragment, {
    children: [/* @__PURE__ */ jsx("ui-title-bar", {
      title: "Technical & History — Revisions"
    }), /* @__PURE__ */ jsxs("div", {
      className: "seo-wrap seo-grid",
      children: [/* @__PURE__ */ jsx(WorkspaceSubnav, {
        group: "technical"
      }), configError ? /* @__PURE__ */ jsx("div", {
        className: "error-box",
        children: configError
      }) : null, ((_b = fetcher.data) == null ? void 0 : _b.error) ? /* @__PURE__ */ jsx("div", {
        className: "error-box",
        children: fetcher.data.error
      }) : null, ((_c = fetcher.data) == null ? void 0 : _c.ok) ? /* @__PURE__ */ jsxs("div", {
        className: "status-banner banner-good",
        "data-toast-title": "Revision Restored",
        children: ["✓ Revision restored in Shopify", fetcher.data.redirectCreated ? " and 301 redirect created" : "", "."]
      }) : null, /* @__PURE__ */ jsx("div", {
        className: "toolbar",
        style: {
          justifyContent: "space-between"
        },
        children: /* @__PURE__ */ jsx("p", {
          style: {
            margin: 0,
            color: "var(--seo-muted)"
          },
          children: "Inspect exact before/after field diffs, Gemini impact verdicts, and restore previous versions with 1 click."
        })
      }), !revisions.length ? /* @__PURE__ */ jsx("div", {
        className: "empty-box",
        children: "No revisions recorded yet. Changes made in Product SEO, Bulk Meta, or URL Optimization will appear here."
      }) : /* @__PURE__ */ jsx("div", {
        className: "seo-grid",
        children: revisions.map((rev) => {
          var _a3, _b2, _c2, _d;
          const isOpen = expandedId === rev.id;
          const isRolling = fetcher.state !== "idle" && rollingBackId === rev.id;
          const changedFields = DIFF_FIELDS.filter((f) => {
            var _a4, _b3;
            return String(((_a4 = rev.before) == null ? void 0 : _a4[f.key]) ?? "") !== String(((_b3 = rev.after) == null ? void 0 : _b3[f.key]) ?? "");
          });
          return /* @__PURE__ */ jsxs("div", {
            className: "section-card",
            children: [/* @__PURE__ */ jsxs("div", {
              className: "toolbar",
              style: {
                justifyContent: "space-between",
                margin: 0
              },
              children: [/* @__PURE__ */ jsxs("div", {
                children: [/* @__PURE__ */ jsx("strong", {
                  style: {
                    fontSize: 15
                  },
                  children: rev.productTitle || `Product #${rev.productId}`
                }), /* @__PURE__ */ jsxs("div", {
                  style: {
                    display: "flex",
                    gap: 8,
                    marginTop: 4,
                    flexWrap: "wrap",
                    alignItems: "center"
                  },
                  children: [/* @__PURE__ */ jsx("span", {
                    className: "pill pill-info",
                    style: {
                      fontSize: 11
                    },
                    children: rev.changeType
                  }), rev.redirectCreated ? /* @__PURE__ */ jsx("span", {
                    className: "pill pill-good",
                    style: {
                      fontSize: 11
                    },
                    children: "🛡️ 301 Redirect Active"
                  }) : null, ((_a3 = rev.aiVerdict) == null ? void 0 : _a3.riskRating) ? /* @__PURE__ */ jsxs("span", {
                    className: "pill pill-warning",
                    style: {
                      fontSize: 11
                    },
                    children: ["AI Risk: ", rev.aiVerdict.riskRating, " (", rev.aiVerdict.projectedCtrDelta, ")"]
                  }) : null, /* @__PURE__ */ jsx("small", {
                    style: {
                      color: "var(--seo-muted)"
                    },
                    children: new Date(rev.createdAt).toLocaleString()
                  })]
                })]
              }), /* @__PURE__ */ jsxs("div", {
                style: {
                  display: "flex",
                  gap: 8,
                  alignItems: "center"
                },
                children: [/* @__PURE__ */ jsx("button", {
                  type: "button",
                  className: "seo-button secondary",
                  style: {
                    padding: "5px 10px",
                    fontSize: 12
                  },
                  onClick: () => setExpandedId(isOpen ? "" : rev.id),
                  children: isOpen ? "Hide Diff" : `Inspect Diff (${changedFields.length || "details"})`
                }), rev.changeType !== "ROLLBACK" && (((_b2 = rev.before) == null ? void 0 : _b2.title) || ((_c2 = rev.before) == null ? void 0 : _c2.metaTitle) || ((_d = rev.before) == null ? void 0 : _d.handle)) ? /* @__PURE__ */ jsx("button", {
                  type: "button",
                  className: "seo-button",
                  style: {
                    padding: "5px 10px",
                    fontSize: 12
                  },
                  onClick: () => handleRollback(rev.id),
                  disabled: fetcher.state !== "idle",
                  children: isRolling ? "Restoring..." : "↺ 1-Click Rollback"
                }) : null]
              })]
            }), isOpen ? /* @__PURE__ */ jsxs("div", {
              style: {
                marginTop: 14,
                borderTop: "1px solid var(--seo-border-soft)",
                paddingTop: 12
              },
              children: [/* @__PURE__ */ jsxs("table", {
                className: "credit-usage-table",
                children: [/* @__PURE__ */ jsx("thead", {
                  children: /* @__PURE__ */ jsxs("tr", {
                    children: [/* @__PURE__ */ jsx("th", {
                      style: {
                        width: 150
                      },
                      children: "Field"
                    }), /* @__PURE__ */ jsx("th", {
                      children: "Before (Old)"
                    }), /* @__PURE__ */ jsx("th", {
                      children: "After (New)"
                    })]
                  })
                }), /* @__PURE__ */ jsx("tbody", {
                  children: (changedFields.length ? changedFields : DIFF_FIELDS).map((f) => {
                    var _a4, _b3;
                    return /* @__PURE__ */ jsxs("tr", {
                      children: [/* @__PURE__ */ jsx("td", {
                        children: /* @__PURE__ */ jsx("strong", {
                          children: f.label
                        })
                      }), /* @__PURE__ */ jsx("td", {
                        style: {
                          background: "#fff5f5",
                          color: "#8a2b2b",
                          wordBreak: "break-word"
                        },
                        children: ((_a4 = rev.before) == null ? void 0 : _a4[f.key]) || /* @__PURE__ */ jsx("em", {
                          style: {
                            opacity: 0.6
                          },
                          children: "(empty)"
                        })
                      }), /* @__PURE__ */ jsx("td", {
                        style: {
                          background: "#f2fbf6",
                          color: "#126b4f",
                          wordBreak: "break-word"
                        },
                        children: ((_b3 = rev.after) == null ? void 0 : _b3[f.key]) || /* @__PURE__ */ jsx("em", {
                          style: {
                            opacity: 0.6
                          },
                          children: "(empty)"
                        })
                      })]
                    }, f.key);
                  })
                })]
              }), rev.aiVerdict ? /* @__PURE__ */ jsx("div", {
                className: "diff-verdict",
                style: {
                  marginTop: 10
                },
                children: /* @__PURE__ */ jsxs("p", {
                  style: {
                    margin: 0
                  },
                  children: [/* @__PURE__ */ jsx("strong", {
                    children: "🤖 Gemini Verdict:"
                  }), " ", rev.aiVerdict.verdict || rev.aiVerdict.intentShift]
                })
              }) : null]
            }) : null]
          }, rev.id);
        })
      }), totalPages > 1 ? /* @__PURE__ */ jsxs("div", {
        className: "toolbar",
        style: {
          justifyContent: "space-between"
        },
        children: [/* @__PURE__ */ jsxs("small", {
          children: ["Page ", page, " of ", totalPages, " (", totalCount, " total revisions)"]
        }), /* @__PURE__ */ jsxs("div", {
          style: {
            display: "flex",
            gap: 8
          },
          children: [page > 1 ? /* @__PURE__ */ jsx(Link, {
            className: "seo-button secondary",
            to: `/app/revisions?page=${page - 1}`,
            children: "Previous page"
          }) : null, page < totalPages ? /* @__PURE__ */ jsx(Link, {
            className: "seo-button",
            to: `/app/revisions?page=${page + 1}`,
            children: "Next page"
          }) : null]
        })]
      }) : null]
    })]
  });
});
const route21 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$7,
  default: app_revisions,
  links: links$7,
  loader: loader$9
}, Symbol.toStringTag, { value: "Module" }));
const links$6 = () => [{
  rel: "stylesheet",
  href: seoStyles
}];
const loader$8 = async ({
  request
}) => {
  var _a2;
  const url = new URL(request.url);
  const gscStatus = url.searchParams.get("gsc") || "";
  const gscCallbackError = url.searchParams.get("gscError") || "";
  const {
    configError,
    shop,
    token,
    apiVersion
  } = await requireShopContext(request);
  if (configError || !shop) {
    return {
      configError,
      scan: null,
      copilotBrief: null,
      autopilot: {
        enabled: false,
        optimizeMeta: true,
        optimizeAlt: true,
        lastRuns: []
      },
      gsc: {
        connected: false,
        urlMetrics: [],
        quickWins: []
      },
      gscOAuthConfigured: false,
      gscStatus,
      gscCallbackError,
      creditAccount: {
        availableCredits: 0,
        effectiveTotal: PLAN_ALLOWANCES.FREE,
        plan: "FREE"
      },
      hasSuperAccess: false,
      aiReady: false,
      aiUnavailableReason: configError || "Shop session required."
    };
  }
  const [appState, creditAccount, storeControl, platformAi, aiAccess, gscOAuth] = await Promise.all([getAppState(shop), getOrCreateCreditAccount(shop), getOrCreateStoreControl(shop), getEffectivePlatformAiSettings(), checkStoreRouteAccess(shop, "ai_features"), getEffectiveGscOAuthConfig()]);
  let scan = (appState == null ? void 0 : appState.lastScan) || null;
  const needsScanUpgrade = Boolean(scan) && (!((_a2 = scan.summary) == null ? void 0 : _a2.pillars) || Array.isArray(scan.issues) && scan.issues.some((issue) => {
    var _a3;
    return typeof issue.fixPath === "string" && issue.fixPath.includes("focus=") && !((_a3 = issue.meta) == null ? void 0 : _a3.productId);
  }));
  if (needsScanUpgrade && token) {
    try {
      scan = await runFullScan({
        shop,
        storeDomain: shop,
        token,
        apiVersion
      });
    } catch {
    }
  }
  let aiUnavailableReason = "";
  if (!(platformAi == null ? void 0 : platformAi.isEnabled)) {
    aiUnavailableReason = "Platform AI is currently disabled by administrator.";
  } else if (!(platformAi == null ? void 0 : platformAi.apiKey)) {
    aiUnavailableReason = "Ask your SuperAdmin to configure the Gemini API key in /superadmin/ai.";
  } else if (!(aiAccess == null ? void 0 : aiAccess.allowed)) {
    aiUnavailableReason = (aiAccess == null ? void 0 : aiAccess.reason) || "AI access is disabled for this store.";
  }
  return {
    configError: "",
    scan,
    copilotBrief: (appState == null ? void 0 : appState.lastCopilotBrief) || null,
    autopilot: (appState == null ? void 0 : appState.autopilot) || {
      enabled: false,
      optimizeMeta: true,
      optimizeAlt: true,
      lastRuns: []
    },
    gsc: sanitizeGscForClient(appState == null ? void 0 : appState.gsc),
    gscOAuthConfigured: Boolean((gscOAuth == null ? void 0 : gscOAuth.clientId) && (gscOAuth == null ? void 0 : gscOAuth.clientSecret)),
    gscStatus,
    gscCallbackError,
    creditAccount: {
      availableCredits: creditAccount.availableCredits,
      effectiveTotal: creditAccount.effectiveTotal,
      plan: creditAccount.plan
    },
    hasSuperAccess: Boolean(storeControl == null ? void 0 : storeControl.superAccess),
    aiReady: !aiUnavailableReason,
    aiUnavailableReason
  };
};
const action$6 = async ({
  request
}) => {
  var _a2, _b;
  const {
    shop,
    token,
    apiVersion,
    configError
  } = await requireShopContext(request);
  if (configError) {
    return {
      ok: false,
      error: configError
    };
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
      optimizeAlt
    });
    return {
      ok: true,
      intent,
      autopilot
    };
  }
  if (intent === "gscConnect") {
    try {
      const reqUrl = new URL(request.url);
      const host = String(formData.get("host") || reqUrl.searchParams.get("host") || "");
      const authUrl = await buildGscAuthUrl({
        shop,
        host,
        origin: reqUrl.origin
      });
      return {
        ok: true,
        intent,
        authUrl
      };
    } catch (error) {
      return {
        ok: false,
        intent,
        error: (error == null ? void 0 : error.message) || "Unable to start Google Search Console OAuth."
      };
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
        siteUrlOverride
      });
      return {
        ok: true,
        intent,
        gsc
      };
    } catch (error) {
      return {
        ok: false,
        intent,
        error: (error == null ? void 0 : error.message) || "Failed to sync Google Search Console."
      };
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
        csvText
      });
      return {
        ok: true,
        intent,
        gsc
      };
    } catch (error) {
      return {
        ok: false,
        intent,
        error: (error == null ? void 0 : error.message) || "Could not parse GSC CSV report."
      };
    }
  }
  if (intent === "gscDisconnect") {
    await disconnectGscForShop(shop);
    return {
      ok: true,
      intent,
      gsc: {
        connected: false,
        mode: "",
        urlMetrics: [],
        quickWins: []
      }
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
        error: kwCheck.message || "Quick-win keyword must be 3-40 characters to optimize a product."
      };
    }
    const result = await runAiAutoFixProducts({
      shop,
      storeDomain: shop,
      token,
      apiVersion,
      products: [{
        id: productId,
        title: productTitle,
        handle,
        focusKeyword: kwCheck.normalized,
        metaTitle,
        metaDescription
      }]
    });
    return {
      ...result,
      intent: "aiAutoFix"
    };
  }
  if (intent === "aiAutoFix") {
    let products = [];
    try {
      const raw = String(formData.get("productsJson") || "[]");
      products = JSON.parse(raw);
    } catch {
      return {
        ok: false,
        intent,
        error: "Invalid product selection payload."
      };
    }
    const result = await runAiAutoFixProducts({
      shop,
      storeDomain: shop,
      token,
      apiVersion,
      products
    });
    return {
      ...result,
      intent: "aiAutoFix"
    };
  }
  if (intent === "applyKeyword") {
    const productId = String(formData.get("productId") || "").trim();
    const productTitle = String(formData.get("productTitle") || "").trim();
    const rawKeyword = String(formData.get("newKeyword") || formData.get("focusKeyword") || "").trim();
    if (!productId || !rawKeyword) {
      return {
        ok: false,
        intent,
        error: "Product ID and keyword are required."
      };
    }
    const check = validateFocusKeyword(rawKeyword);
    if (!check.valid) {
      return {
        ok: false,
        intent,
        error: check.message || "Focus keyword must be 3-40 characters."
      };
    }
    const currentState = await getAppState(shop);
    const oldKeyword = ((_b = (_a2 = currentState == null ? void 0 : currentState.productSeo) == null ? void 0 : _a2[productId]) == null ? void 0 : _b.focusKeyword) || "";
    await prisma.productRevision.create({
      data: {
        shop,
        productId,
        productTitle: productTitle || `Product ${productId}`,
        changeType: "FOCUS_KEYWORD",
        beforeJson: JSON.stringify({
          focusKeyword: oldKeyword
        }),
        afterJson: JSON.stringify({
          focusKeyword: check.normalized
        }),
        redirectCreated: false
      }
    });
    await updateAppState(shop, (current) => {
      var _a3;
      return {
        ...current,
        productSeo: {
          ...current.productSeo || {},
          [productId]: {
            ...((_a3 = current.productSeo) == null ? void 0 : _a3[productId]) || {},
            focusKeyword: check.normalized
          }
        }
      };
    });
    const liveProducts = await fetchProductsByIds({
      storeDomain: shop,
      token,
      apiVersion,
      productIds: [productId]
    }).catch(() => []);
    const scan2 = await applyIncrementalAuditPatch({
      shop,
      storeDomain: shop,
      token,
      apiVersion,
      updatedProducts: liveProducts
    });
    return {
      ok: true,
      intent: "applyKeyword",
      productId,
      appliedKeyword: check.normalized,
      scan: scan2
    };
  }
  const scan = await runFullScan({
    shop,
    storeDomain: shop,
    token,
    apiVersion
  });
  return {
    ok: true,
    intent: "scan",
    scan
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
function scoreRingColor$1(score) {
  if (score >= 80) return "#15803d";
  if (score >= 55) return "#b45309";
  return "#b91c1c";
}
function toProductFixInput(issue) {
  const meta = issue == null ? void 0 : issue.meta;
  const focusMatch = String((issue == null ? void 0 : issue.fixPath) || "").match(/[?&]focus=(\d+)/);
  const productId = (meta == null ? void 0 : meta.productId) ? String(meta.productId) : (focusMatch == null ? void 0 : focusMatch[1]) || "";
  if (!productId) return null;
  const handleMatch = String((issue == null ? void 0 : issue.targetUrl) || "").match(/\/products\/([^/?#]+)/);
  return {
    id: productId,
    title: (meta == null ? void 0 : meta.productTitle) || "",
    handle: (meta == null ? void 0 : meta.handle) || (handleMatch == null ? void 0 : handleMatch[1]) || "",
    focusKeyword: (meta == null ? void 0 : meta.focusKeyword) || "",
    metaTitle: (meta == null ? void 0 : meta.metaTitle) || "",
    metaDescription: (meta == null ? void 0 : meta.metaDescription) || "",
    targetUrl: issue.targetUrl || "",
    fixPath: issue.fixPath || `/app/products?focus=${productId}`
  };
}
function groupAuditIssues(issues = []) {
  const groups = /* @__PURE__ */ new Map();
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
        seenProductIds: /* @__PURE__ */ new Set()
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
  return Array.from(groups.values()).map(({
    seenProductIds,
    ...group
  }) => ({
    ...group,
    isProductFixable: group.uniqueProducts.length > 0
  })).sort((a, b) => severityRank(a.severity) - severityRank(b.severity) || b.items.length - a.items.length);
}
function collectTopFixableProducts(issues = [], limit = 5) {
  const sorted = [...issues].sort((a, b) => severityRank(a.severity) - severityRank(b.severity));
  const selected = [];
  const seen = /* @__PURE__ */ new Set();
  for (const issue of sorted) {
    const product = toProductFixInput(issue);
    if (!product || seen.has(product.id)) continue;
    seen.add(product.id);
    selected.push(product);
    if (selected.length >= limit) break;
  }
  return selected;
}
const PILLAR_ITEMS = [{
  key: "serpScore",
  label: "SERP Snippet"
}, {
  key: "contentScore",
  label: "Content"
}, {
  key: "technicalScore",
  label: "Technical"
}, {
  key: "visualScore",
  label: "Visual ALT"
}, {
  key: "cannibalScore",
  label: "Keywords"
}];
const app_seoAudit = UNSAFE_withComponentProps(function SeoAuditRoute() {
  var _a2, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y;
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
  const autopilot = ((_a2 = autopilotFetcher.data) == null ? void 0 : _a2.autopilot) || loaderData.autopilot || {
    enabled: false,
    optimizeMeta: true,
    optimizeAlt: true,
    lastRuns: []
  };
  const gsc = ((_b = gscFetcher.data) == null ? void 0 : _b.gsc) || loaderData.gsc || {
    connected: false,
    quickWins: []
  };
  const scan = ((_c = autoFixFetcher.data) == null ? void 0 : _c.scan) || ((_d = keywordFetcher.data) == null ? void 0 : _d.scan) || ((_e = scanFetcher.data) == null ? void 0 : _e.scan) || loaderData.scan;
  const copilotBrief = (((_f = aiFetcher.data) == null ? void 0 : _f.ok) && ((_g = aiFetcher.data) == null ? void 0 : _g.actionType) === "store_copilot" ? aiFetcher.data.result : null) || loaderData.copilotBrief;
  useEffect(() => {
    var _a3, _b2;
    if (autoFixFetcher.state === "idle") {
      setFixingKey("");
      if (((_a3 = autoFixFetcher.data) == null ? void 0 : _a3.ok) && ((_b2 = autoFixFetcher.data) == null ? void 0 : _b2.creditsRemaining) !== void 0) {
        dispatchCreditsUpdate({
          availableCredits: autoFixFetcher.data.creditsRemaining,
          superAccess: Boolean(autoFixFetcher.data.superAccess)
        });
      }
    }
  }, [autoFixFetcher.state, autoFixFetcher.data]);
  useEffect(() => {
    var _a3, _b2, _c2, _d2, _e2, _f2;
    if (aiFetcher.state === "idle") {
      setActiveAiAction("");
    }
    if (((_a3 = aiFetcher.data) == null ? void 0 : _a3.ok) && ((_b2 = aiFetcher.data) == null ? void 0 : _b2.creditsRemaining) !== void 0) {
      dispatchCreditsUpdate({
        availableCredits: aiFetcher.data.creditsRemaining,
        plan: aiFetcher.data.plan,
        superAccess: Boolean(aiFetcher.data.superAccess)
      });
    }
    if (((_c2 = aiFetcher.data) == null ? void 0 : _c2.ok) && ((_d2 = aiFetcher.data) == null ? void 0 : _d2.actionType) === "catalog_cannibalization") {
      setCannibalResult(aiFetcher.data.result);
      showToast({
        tone: "success",
        title: "Cannibalization Plan Ready",
        message: "Gemini generated distinct focus keyword suggestions below."
      });
    } else if (((_e2 = aiFetcher.data) == null ? void 0 : _e2.ok) && ((_f2 = aiFetcher.data) == null ? void 0 : _f2.actionType) === "store_copilot") {
      showToast({
        tone: "success",
        title: "AI Action Plan Ready",
        message: "Gemini Executive SEO Plan generated and saved."
      });
    }
  }, [aiFetcher.state, aiFetcher.data]);
  useEffect(() => {
    var _a3, _b2, _c2;
    if (scanFetcher.state === "idle" && ((_a3 = scanFetcher.data) == null ? void 0 : _a3.ok) && ((_b2 = scanFetcher.data) == null ? void 0 : _b2.scan)) {
      showToast({
        tone: "success",
        title: "Audit Scan Complete",
        message: `Store SEO score updated to ${((_c2 = scanFetcher.data.scan.summary) == null ? void 0 : _c2.score) ?? 0}/100.`
      });
    }
  }, [scanFetcher.state, scanFetcher.data]);
  useEffect(() => {
    var _a3, _b2;
    if (autopilotFetcher.state === "idle" && ((_a3 = autopilotFetcher.data) == null ? void 0 : _a3.ok) && ((_b2 = autopilotFetcher.data) == null ? void 0 : _b2.autopilot)) {
      const enabledNow = Boolean(autopilotFetcher.data.autopilot.enabled);
      showToast({
        tone: "success",
        title: enabledNow ? "Autopilot Enabled" : "Autopilot Paused",
        message: enabledNow ? "Newly created/imported products will be auto-optimized by Gemini AI." : "Background auto-optimization for new products is paused."
      });
    }
  }, [autopilotFetcher.state, autopilotFetcher.data]);
  useEffect(() => {
    var _a3, _b2, _c2, _d2;
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
        message: `Found ${((_b2 = (_a3 = gscFetcher.data.gsc) == null ? void 0 : _a3.summary) == null ? void 0 : _b2.quickWinsCount) || 0} quick-win keywords (positions 8-20).`
      });
    } else if (gscFetcher.data.ok && gscFetcher.data.intent === "gscImportCsv") {
      setShowGscCsv(false);
      setGscCsvText("");
      showToast({
        tone: "success",
        title: "GSC CSV Imported",
        message: `Analyzed ${((_d2 = (_c2 = gscFetcher.data.gsc) == null ? void 0 : _c2.summary) == null ? void 0 : _d2.quickWinsCount) || 0} quick-win opportunities (positions 8-20).`
      });
    } else if (gscFetcher.data.ok && gscFetcher.data.intent === "gscDisconnect") {
      showToast({
        tone: "info",
        title: "Search Console Disconnected",
        message: "Removed Google Search Console connection."
      });
    } else if (gscFetcher.data.error) {
      showToast({
        tone: "error",
        title: "Search Console Error",
        message: gscFetcher.data.error
      });
    }
  }, [gscFetcher.state, gscFetcher.data]);
  const rawIssues = (scan == null ? void 0 : scan.issues) || [];
  const filteredIssues = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return rawIssues.filter((issue) => severityFilter === "ALL" ? true : issue.severity === severityFilter).filter((issue) => {
      var _a3, _b2, _c2;
      if (!q) return true;
      const haystack = [issue.title, issue.detail, issue.targetUrl, (_a3 = issue.meta) == null ? void 0 : _a3.productTitle, (_b2 = issue.meta) == null ? void 0 : _b2.handle, (_c2 = issue.meta) == null ? void 0 : _c2.focusKeyword].filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(q);
    }).sort((a, b) => severityRank(a.severity) - severityRank(b.severity));
  }, [rawIssues, severityFilter, searchQuery]);
  const groupedIssues = useMemo(() => groupAuditIssues(filteredIssues), [filteredIssues]);
  const topFixableProducts = useMemo(() => collectTopFixableProducts(rawIssues, 5), [rawIssues]);
  useEffect(() => {
    if (!groupedIssues.length) return;
    setOpenGroups((prev) => {
      if (Object.keys(prev).length > 0) return prev;
      return {
        [groupedIssues[0].key]: true
      };
    });
  }, [groupedIssues]);
  const isScanning = scanFetcher.state !== "idle";
  const isAutoFixing = autoFixFetcher.state !== "idle";
  const isAiWorking = aiFetcher.state !== "idle";
  const score = ((_h = scan == null ? void 0 : scan.summary) == null ? void 0 : _h.score) ?? 0;
  const health = ((_i = scan == null ? void 0 : scan.summary) == null ? void 0 : _i.health) || "weak";
  const pillars = ((_j = scan == null ? void 0 : scan.summary) == null ? void 0 : _j.pillars) || {};
  const counts = ((_k = scan == null ? void 0 : scan.summary) == null ? void 0 : _k.counts) || {
    critical: 0,
    warning: 0,
    info: 0
  };
  const cannibalGroups = ((_l = scan == null ? void 0 : scan.summary) == null ? void 0 : _l.cannibalizedGroups) || [];
  function handleAutoFix(products, key) {
    if (!(products == null ? void 0 : products.length)) return;
    setFixingKey(key);
    const formData = new FormData();
    formData.set("intent", "aiAutoFix");
    formData.set("productsJson", JSON.stringify(products.slice(0, 5)));
    autoFixFetcher.submit(formData, {
      method: "post"
    });
  }
  function handleRunCopilot() {
    setActiveAiAction("copilot");
    aiFetcher.submit({
      payload: JSON.stringify({
        actionType: "store_copilot"
      })
    }, {
      method: "post",
      action: "/app/api/ai"
    });
  }
  function handleResolveCannibalization() {
    setActiveAiAction("cannibal");
    aiFetcher.submit({
      payload: JSON.stringify({
        actionType: "catalog_cannibalization"
      })
    }, {
      method: "post",
      action: "/app/api/ai"
    });
  }
  function handleApplySuggestedKeyword(res) {
    setAppliedIds((prev) => ({
      ...prev,
      [res.productId]: true
    }));
    const formData = new FormData();
    formData.set("intent", "applyKeyword");
    formData.set("productId", res.productId);
    formData.set("productTitle", res.title || "");
    formData.set("newKeyword", res.suggestedKeyword);
    keywordFetcher.submit(formData, {
      method: "post"
    });
  }
  function toggleGroup(key) {
    setOpenGroups((prev) => ({
      ...prev,
      [key]: !prev[key]
    }));
  }
  function submitAutopilotSettings(next) {
    const formData = new FormData();
    formData.set("intent", "toggleAutopilot");
    formData.set("enabled", String(Boolean(next.enabled)));
    formData.set("optimizeMeta", String(next.optimizeMeta !== false));
    formData.set("optimizeAlt", String(next.optimizeAlt !== false));
    autopilotFetcher.submit(formData, {
      method: "post"
    });
  }
  function handleGscConnect() {
    const formData = new FormData();
    formData.set("intent", "gscConnect");
    if (typeof window !== "undefined") {
      const host = new URLSearchParams(window.location.search).get("host") || "";
      if (host) formData.set("host", host);
    }
    gscFetcher.submit(formData, {
      method: "post"
    });
  }
  function handleGscSync(siteUrl = "") {
    const formData = new FormData();
    formData.set("intent", "gscSync");
    if (siteUrl) formData.set("siteUrl", siteUrl);
    gscFetcher.submit(formData, {
      method: "post"
    });
  }
  function handleGscImportCsv(event) {
    event.preventDefault();
    if (!gscCsvText.trim()) return;
    const formData = new FormData();
    formData.set("intent", "gscImportCsv");
    formData.set("csvText", gscCsvText);
    gscFetcher.submit(formData, {
      method: "post"
    });
  }
  function handleGscCsvFile(event) {
    var _a3;
    const file = (_a3 = event.target.files) == null ? void 0 : _a3[0];
    if (!file) return;
    file.text().then((content2) => setGscCsvText(content2)).catch(() => {
    });
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
    autoFixFetcher.submit(formData, {
      method: "post"
    });
  }
  return /* @__PURE__ */ jsx("div", {
    className: "seo-wrap",
    children: /* @__PURE__ */ jsxs("div", {
      className: "audit-page-stack",
      children: [loaderData.gscStatus === "connected" ? /* @__PURE__ */ jsx("section", {
        className: "status-banner banner-good",
        "data-toast-title": "Google Search Console Connected",
        children: "Connected Google Search Console and synced 28-day search clicks, impressions, CTR, and position 8–20 quick wins."
      }) : null, loaderData.gscCallbackError ? /* @__PURE__ */ jsxs("section", {
        className: "status-banner banner-bad",
        "data-toast-title": "Google Search Console Error",
        children: [/* @__PURE__ */ jsx("strong", {
          children: "GSC OAuth Error:"
        }), " ", loaderData.gscCallbackError]
      }) : null, loaderData.configError ? /* @__PURE__ */ jsxs("section", {
        className: "status-banner banner-bad",
        children: [/* @__PURE__ */ jsx("strong", {
          children: "Shopify config missing:"
        }), " ", loaderData.configError]
      }) : null, ((_m = autoFixFetcher.data) == null ? void 0 : _m.intent) === "aiAutoFix" ? /* @__PURE__ */ jsx("section", {
        className: `status-banner ${autoFixFetcher.data.ok ? "banner-good" : "banner-bad"}`,
        children: autoFixFetcher.data.ok ? /* @__PURE__ */ jsxs(Fragment, {
          children: [/* @__PURE__ */ jsxs("strong", {
            children: ["AI fixed ", autoFixFetcher.data.fixedCount, " product(s) and refreshed your SEO score!"]
          }), " ", (_n = autoFixFetcher.data.fixedProducts) == null ? void 0 : _n.map((p) => `${p.title}${p.redirectCreated ? " (301 redirect created)" : ""}`).join(" · "), " · ", /* @__PURE__ */ jsx("span", {
            children: autoFixFetcher.data.superAccess || loaderData.hasSuperAccess ? "Super Access (0 tokens deducted)." : `Used ${autoFixFetcher.data.creditsDeducted} tokens (${autoFixFetcher.data.creditsRemaining} left).`
          }), autoFixFetcher.data.stoppedReason ? /* @__PURE__ */ jsxs("span", {
            children: [" ", autoFixFetcher.data.stoppedReason]
          }) : null]
        }) : /* @__PURE__ */ jsxs(Fragment, {
          children: [/* @__PURE__ */ jsx("strong", {
            children: "AI Auto-Fix Error:"
          }), " ", autoFixFetcher.data.error]
        })
      }) : null, ((_o = keywordFetcher.data) == null ? void 0 : _o.intent) === "applyKeyword" && ((_p = keywordFetcher.data) == null ? void 0 : _p.ok) ? /* @__PURE__ */ jsxs("section", {
        className: "status-banner banner-good",
        children: ["Applied focus keyword ", /* @__PURE__ */ jsxs("strong", {
          children: ['"', keywordFetcher.data.appliedKeyword, '"']
        }), " and refreshed audit score."]
      }) : null, aiFetcher.data && !aiFetcher.data.ok ? /* @__PURE__ */ jsxs("section", {
        className: "status-banner banner-bad",
        children: [/* @__PURE__ */ jsx("strong", {
          children: "AI Copilot Error:"
        }), " ", aiFetcher.data.error]
      }) : null, !loaderData.aiReady && loaderData.aiUnavailableReason ? /* @__PURE__ */ jsxs("section", {
        className: "status-banner banner-warn",
        children: [/* @__PURE__ */ jsx("strong", {
          children: "AI Auto-Fix paused:"
        }), " ", loaderData.aiUnavailableReason]
      }) : null, /* @__PURE__ */ jsxs("section", {
        className: "audit-hero",
        children: [/* @__PURE__ */ jsxs("div", {
          className: "score-ring-wrap",
          children: [/* @__PURE__ */ jsx("div", {
            className: "score-ring",
            style: {
              "--score": scan ? score : 0,
              "--ring-color": scoreRingColor$1(score)
            },
            children: /* @__PURE__ */ jsxs("div", {
              className: "score-ring-inner",
              children: [/* @__PURE__ */ jsx("span", {
                className: "score-ring-value",
                children: scan ? score : "--"
              }), /* @__PURE__ */ jsx("span", {
                className: "score-ring-max",
                children: "/ 100"
              })]
            })
          }), scan ? /* @__PURE__ */ jsx(StatusPill, {
            tone: healthTone(health),
            children: healthLabel(health)
          }) : /* @__PURE__ */ jsx(StatusPill, {
            tone: "info",
            children: "Not Scanned"
          })]
        }), /* @__PURE__ */ jsxs("div", {
          className: "audit-hero-body",
          children: [/* @__PURE__ */ jsxs("div", {
            className: "audit-hero-top",
            children: [/* @__PURE__ */ jsxs("div", {
              className: "audit-hero-heading",
              children: [/* @__PURE__ */ jsx("h1", {
                className: "page-title",
                style: {
                  margin: 0
                },
                children: "AI SEO Audit Center"
              }), /* @__PURE__ */ jsx("p", {
                className: "seo-muted",
                style: {
                  margin: 0
                },
                children: scan ? /* @__PURE__ */ jsxs(Fragment, {
                  children: ["Scanned ", /* @__PURE__ */ jsxs("strong", {
                    children: [scan.pagesScanned, " pages"]
                  }), " ·", " ", /* @__PURE__ */ jsxs("strong", {
                    children: [scan.indexCoverage, "%"]
                  }), " indexable ·", " ", /* @__PURE__ */ jsx("strong", {
                    children: counts.critical
                  }), " Critical, ", /* @__PURE__ */ jsx("strong", {
                    children: counts.warning
                  }), " Warnings,", " ", /* @__PURE__ */ jsx("strong", {
                    children: counts.info
                  }), " Info ·", " ", /* @__PURE__ */ jsx("span", {
                    children: ((_q = scan.trend) == null ? void 0 : _q.label) || "Baseline scan"
                  })]
                }) : "Run your first store scan to uncover SEO bottlenecks and fix them with 1-Click Gemini AI."
              })]
            }), /* @__PURE__ */ jsxs("div", {
              className: "audit-hero-actions",
              children: [/* @__PURE__ */ jsxs(scanFetcher.Form, {
                method: "post",
                children: [/* @__PURE__ */ jsx("input", {
                  type: "hidden",
                  name: "intent",
                  value: "scan"
                }), /* @__PURE__ */ jsx("button", {
                  className: `seo-button ${scan ? "secondary" : ""}`,
                  type: "submit",
                  disabled: isScanning || Boolean(loaderData.configError),
                  children: isScanning ? "Scanning Catalog..." : scan ? "Re-Scan Store" : "Scan Store Now"
                })]
              }), scan && topFixableProducts.length > 0 ? /* @__PURE__ */ jsx("button", {
                type: "button",
                className: "seo-button",
                disabled: !loaderData.aiReady || isAutoFixing,
                onClick: () => handleAutoFix(topFixableProducts, "top5"),
                title: loaderData.aiReady ? `Automatically optimize top ${topFixableProducts.length} broken products in Shopify` : loaderData.aiUnavailableReason,
                children: isAutoFixing && fixingKey === "top5" ? "AI Fixing Top Issues..." : `AI Fix Top ${topFixableProducts.length} (${loaderData.hasSuperAccess ? "Super" : `${topFixableProducts.length * CREDIT_COSTS.product_seo_fix} tok`})`
              }) : null, scan ? /* @__PURE__ */ jsx("button", {
                type: "button",
                className: "seo-button secondary",
                disabled: !loaderData.aiReady || isAiWorking,
                onClick: handleRunCopilot,
                title: `Generate a prioritized store-wide Gemini SEO action plan (${CREDIT_COSTS.store_copilot} tokens)`,
                children: isAiWorking && activeAiAction === "copilot" ? "Analyzing Store..." : copilotBrief ? `Refresh AI Plan (${loaderData.hasSuperAccess ? "Super" : `${CREDIT_COSTS.store_copilot} tok`})` : `AI Action Plan (${loaderData.hasSuperAccess ? "Super" : `${CREDIT_COSTS.store_copilot} tok`})`
              }) : null, /* @__PURE__ */ jsx(Link, {
                to: "/app/pagespeed",
                className: "seo-button secondary",
                children: "⚡ Live PageSpeed Test"
              })]
            })]
          }), ((_r = scan == null ? void 0 : scan.summary) == null ? void 0 : _r.pillars) ? /* @__PURE__ */ jsx("div", {
            className: "audit-pillar-row",
            children: PILLAR_ITEMS.map((pillar) => {
              const value = pillars[pillar.key] ?? 0;
              return /* @__PURE__ */ jsxs("div", {
                className: "audit-pillar-chip",
                children: [/* @__PURE__ */ jsxs("div", {
                  className: "audit-pillar-chip-head",
                  children: [/* @__PURE__ */ jsx("span", {
                    children: pillar.label
                  }), /* @__PURE__ */ jsx("span", {
                    children: value
                  })]
                }), /* @__PURE__ */ jsx("div", {
                  className: "audit-pillar-bar",
                  children: /* @__PURE__ */ jsx("div", {
                    className: "audit-pillar-bar-fill",
                    style: {
                      width: `${Math.max(0, Math.min(100, value))}%`,
                      background: scoreRingColor$1(value)
                    }
                  })
                })]
              }, pillar.key);
            })
          }) : null]
        })]
      }), /* @__PURE__ */ jsxs("section", {
        id: "autopilot",
        className: "section-card",
        style: {
          display: "grid",
          gap: "14px"
        },
        children: [/* @__PURE__ */ jsxs("div", {
          className: "section-header",
          style: {
            alignItems: "center"
          },
          children: [/* @__PURE__ */ jsxs("div", {
            style: {
              display: "grid",
              gap: "4px"
            },
            children: [/* @__PURE__ */ jsxs("div", {
              style: {
                display: "flex",
                alignItems: "center",
                gap: "10px",
                flexWrap: "wrap"
              },
              children: [/* @__PURE__ */ jsx("h2", {
                style: {
                  margin: 0,
                  fontSize: "16px"
                },
                children: "Auto-Optimize New Products (Autopilot)"
              }), /* @__PURE__ */ jsx(StatusPill, {
                tone: autopilot.enabled ? "good" : "info",
                children: autopilot.enabled ? "Autopilot ON" : "Paused"
              })]
            }), /* @__PURE__ */ jsx("p", {
              className: "seo-muted",
              style: {
                fontSize: "13px"
              },
              children: "Automatically optimize meta title, meta description, focus keyword, and Vision image ALT text whenever a product is created or imported."
            })]
          }), /* @__PURE__ */ jsxs("div", {
            className: "button-row",
            children: [/* @__PURE__ */ jsxs("label", {
              style: {
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "12.5px",
                cursor: "pointer"
              },
              children: [/* @__PURE__ */ jsx("input", {
                type: "checkbox",
                checked: autopilot.optimizeMeta !== false,
                disabled: autopilotFetcher.state !== "idle",
                onChange: (e) => submitAutopilotSettings({
                  enabled: autopilot.enabled,
                  optimizeMeta: e.target.checked,
                  optimizeAlt: autopilot.optimizeAlt
                })
              }), /* @__PURE__ */ jsxs("span", {
                children: ["Meta & Keywords (", CREDIT_COSTS.product_seo_fix, " tok)"]
              })]
            }), /* @__PURE__ */ jsxs("label", {
              style: {
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "12.5px",
                cursor: "pointer"
              },
              children: [/* @__PURE__ */ jsx("input", {
                type: "checkbox",
                checked: autopilot.optimizeAlt !== false,
                disabled: autopilotFetcher.state !== "idle",
                onChange: (e) => submitAutopilotSettings({
                  enabled: autopilot.enabled,
                  optimizeMeta: autopilot.optimizeMeta,
                  optimizeAlt: e.target.checked
                })
              }), /* @__PURE__ */ jsxs("span", {
                children: ["Image ALT Vision (", CREDIT_COSTS.vision_alt, " tok/img)"]
              })]
            }), /* @__PURE__ */ jsx("button", {
              type: "button",
              className: `seo-button ${autopilot.enabled ? "secondary" : ""}`,
              style: {
                padding: "7px 14px",
                fontSize: "12.5px"
              },
              disabled: autopilotFetcher.state !== "idle" || Boolean(loaderData.configError),
              onClick: () => submitAutopilotSettings({
                enabled: !autopilot.enabled,
                optimizeMeta: autopilot.optimizeMeta,
                optimizeAlt: autopilot.optimizeAlt
              }),
              children: autopilotFetcher.state !== "idle" ? "Saving..." : autopilot.enabled ? "Pause Autopilot" : "Enable Autopilot"
            }), ((_s = autopilot.lastRuns) == null ? void 0 : _s.length) ? /* @__PURE__ */ jsx("button", {
              type: "button",
              className: "seo-button secondary",
              style: {
                padding: "7px 12px",
                fontSize: "12px"
              },
              onClick: () => setShowAutopilotLogs((prev) => !prev),
              children: showAutopilotLogs ? "Hide Activity ▲" : `Activity (${autopilot.lastRuns.length}) ▼`
            }) : null]
          })]
        }), showAutopilotLogs && ((_t = autopilot.lastRuns) == null ? void 0 : _t.length) ? /* @__PURE__ */ jsx("div", {
          style: {
            overflowX: "auto",
            borderTop: "1px solid var(--seo-border-soft)",
            paddingTop: "12px"
          },
          children: /* @__PURE__ */ jsxs("table", {
            className: "credit-usage-table",
            children: [/* @__PURE__ */ jsx("thead", {
              children: /* @__PURE__ */ jsxs("tr", {
                children: [/* @__PURE__ */ jsx("th", {
                  children: "Time"
                }), /* @__PURE__ */ jsx("th", {
                  children: "Product"
                }), /* @__PURE__ */ jsx("th", {
                  children: "Status"
                }), /* @__PURE__ */ jsx("th", {
                  children: "Updates"
                }), /* @__PURE__ */ jsx("th", {
                  children: "Credits"
                })]
              })
            }), /* @__PURE__ */ jsx("tbody", {
              children: autopilot.lastRuns.slice(0, 10).map((run, idx) => /* @__PURE__ */ jsxs("tr", {
                children: [/* @__PURE__ */ jsx("td", {
                  suppressHydrationWarning: true,
                  children: new Date(run.createdAt).toLocaleString()
                }), /* @__PURE__ */ jsxs("td", {
                  children: [/* @__PURE__ */ jsx(Link, {
                    className: "seo-inline-link",
                    to: `/app/products?focus=${run.productId}`,
                    children: run.productTitle || `Product #${run.productId}`
                  }), run.error ? /* @__PURE__ */ jsx("div", {
                    className: "seo-muted",
                    style: {
                      fontSize: "11px",
                      color: "var(--seo-bad)"
                    },
                    children: run.error
                  }) : null]
                }), /* @__PURE__ */ jsx("td", {
                  children: /* @__PURE__ */ jsx(StatusPill, {
                    tone: run.status === "COMPLETED" ? "good" : run.status === "FAILED" || run.status === "SKIPPED" ? "warning" : "info",
                    children: run.status
                  })
                }), /* @__PURE__ */ jsxs("td", {
                  style: {
                    fontSize: "12px"
                  },
                  children: [run.metaUpdated ? "Meta + Keyword" : "Meta skipped", " · ", run.imagesUpdated || 0, " ALT img(s)"]
                }), /* @__PURE__ */ jsx("td", {
                  children: run.creditsDeducted ? `-${run.creditsDeducted} tok` : "0 tok"
                })]
              }, `${run.productId}-${idx}`))
            })]
          })
        }) : null]
      }), /* @__PURE__ */ jsxs("section", {
        id: "gsc",
        className: "section-card",
        style: {
          display: "grid",
          gap: "14px"
        },
        children: [/* @__PURE__ */ jsxs("div", {
          className: "section-header",
          style: {
            alignItems: "center"
          },
          children: [/* @__PURE__ */ jsxs("div", {
            style: {
              display: "grid",
              gap: "4px"
            },
            children: [/* @__PURE__ */ jsxs("div", {
              style: {
                display: "flex",
                alignItems: "center",
                gap: "10px",
                flexWrap: "wrap"
              },
              children: [/* @__PURE__ */ jsx("h2", {
                style: {
                  margin: 0,
                  fontSize: "16px"
                },
                children: "Google Search Console & Quick-Win Keywords"
              }), /* @__PURE__ */ jsx(StatusPill, {
                tone: gsc.connected ? "good" : "info",
                children: gsc.connected ? `Connected (${gsc.mode === "csv" ? "CSV" : "Live API"})` : "Not Connected"
              })]
            }), /* @__PURE__ */ jsx("p", {
              className: "seo-muted",
              style: {
                fontSize: "13px"
              },
              children: gsc.connected ? `Property: ${gsc.siteUrl} · Identifies page-2 keywords ranking in positions 8–20 for Gemini Copilot & 1-click AI boosts.` : "Connect Google Search Console (or upload a GSC CSV export) to track real clicks, impressions, CTR, and position 8–20 quick wins."
            })]
          }), /* @__PURE__ */ jsxs("div", {
            className: "button-row",
            children: [gsc.connected && gsc.mode === "oauth" ? /* @__PURE__ */ jsx("button", {
              type: "button",
              className: "seo-button secondary",
              style: {
                padding: "7px 12px",
                fontSize: "12.5px"
              },
              disabled: gscFetcher.state !== "idle",
              onClick: () => handleGscSync(""),
              children: gscFetcher.state !== "idle" ? "Syncing..." : "Sync GSC Now"
            }) : null, /* @__PURE__ */ jsx("button", {
              type: "button",
              className: "seo-button secondary",
              style: {
                padding: "7px 12px",
                fontSize: "12.5px"
              },
              onClick: () => setShowGscCsv((prev) => !prev),
              children: showGscCsv ? "Hide CSV Import" : "Import GSC CSV"
            }), gsc.connected ? /* @__PURE__ */ jsxs(gscFetcher.Form, {
              method: "post",
              children: [/* @__PURE__ */ jsx("input", {
                type: "hidden",
                name: "intent",
                value: "gscDisconnect"
              }), /* @__PURE__ */ jsx("button", {
                type: "submit",
                className: "seo-button secondary",
                style: {
                  padding: "7px 12px",
                  fontSize: "12.5px"
                },
                disabled: gscFetcher.state !== "idle",
                children: "Disconnect"
              })]
            }) : /* @__PURE__ */ jsx("button", {
              type: "button",
              className: "seo-button",
              style: {
                padding: "7px 14px",
                fontSize: "12.5px"
              },
              disabled: gscFetcher.state !== "idle" || !loaderData.gscOAuthConfigured,
              onClick: handleGscConnect,
              title: loaderData.gscOAuthConfigured ? "Connect your verified Google Search Console property" : "Admin can add Google OAuth Client ID/Secret in /superadmin/ai, or use Import GSC CSV",
              children: gscFetcher.state !== "idle" ? "Connecting..." : loaderData.gscOAuthConfigured ? "Connect Google Search Console" : "GSC OAuth Not Configured (Use CSV)"
            })]
          })]
        }), showGscCsv ? /* @__PURE__ */ jsxs("form", {
          onSubmit: handleGscImportCsv,
          style: {
            background: "#f8fafc",
            border: "1px solid var(--seo-border-soft)",
            borderRadius: "8px",
            padding: "14px",
            display: "grid",
            gap: "10px"
          },
          children: [/* @__PURE__ */ jsxs("div", {
            style: {
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "10px",
              flexWrap: "wrap"
            },
            children: [/* @__PURE__ */ jsx("strong", {
              style: {
                fontSize: "13px"
              },
              children: "Upload or Paste Google Search Console CSV (Pages / Queries)"
            }), /* @__PURE__ */ jsx("input", {
              type: "file",
              accept: ".csv,text/csv",
              onChange: handleGscCsvFile,
              style: {
                fontSize: "12px"
              }
            })]
          }), /* @__PURE__ */ jsx("textarea", {
            className: "seo-textarea",
            rows: 4,
            value: gscCsvText,
            onChange: (e) => setGscCsvText(e.target.value),
            placeholder: "Page,Query,Clicks,Impressions,CTR,Position\nhttps://yourstore.myshopify.com/products/leather-wallet,slim leather wallet,24,680,3.53%,11.4"
          }), /* @__PURE__ */ jsx("div", {
            className: "button-row",
            children: /* @__PURE__ */ jsx("button", {
              type: "submit",
              className: "seo-button",
              style: {
                padding: "7px 14px",
                fontSize: "12.5px"
              },
              disabled: gscFetcher.state !== "idle" || !gscCsvText.trim(),
              children: gscFetcher.state !== "idle" ? "Importing..." : "Analyze Search Console CSV"
            })
          })]
        }) : null, gsc.connected && gsc.summary ? /* @__PURE__ */ jsxs(Fragment, {
          children: [/* @__PURE__ */ jsxs("div", {
            className: "seo-grid grid-4",
            style: {
              gap: "12px"
            },
            children: [/* @__PURE__ */ jsxs("div", {
              className: "audit-pillar-chip",
              children: [/* @__PURE__ */ jsx("div", {
                className: "audit-pillar-chip-head",
                children: /* @__PURE__ */ jsx("span", {
                  children: "Clicks (28d)"
                })
              }), /* @__PURE__ */ jsx("strong", {
                style: {
                  fontSize: "20px"
                },
                children: gsc.summary.totalClicks
              })]
            }), /* @__PURE__ */ jsxs("div", {
              className: "audit-pillar-chip",
              children: [/* @__PURE__ */ jsx("div", {
                className: "audit-pillar-chip-head",
                children: /* @__PURE__ */ jsx("span", {
                  children: "Impressions (28d)"
                })
              }), /* @__PURE__ */ jsx("strong", {
                style: {
                  fontSize: "20px"
                },
                children: gsc.summary.totalImpressions
              })]
            }), /* @__PURE__ */ jsxs("div", {
              className: "audit-pillar-chip",
              children: [/* @__PURE__ */ jsx("div", {
                className: "audit-pillar-chip-head",
                children: /* @__PURE__ */ jsx("span", {
                  children: "Avg CTR"
                })
              }), /* @__PURE__ */ jsxs("strong", {
                style: {
                  fontSize: "20px"
                },
                children: [gsc.summary.avgCtr, "%"]
              })]
            }), /* @__PURE__ */ jsxs("div", {
              className: "audit-pillar-chip",
              children: [/* @__PURE__ */ jsx("div", {
                className: "audit-pillar-chip-head",
                children: /* @__PURE__ */ jsx("span", {
                  children: "Quick Wins (Pos 8–20)"
                })
              }), /* @__PURE__ */ jsx("strong", {
                style: {
                  fontSize: "20px",
                  color: "var(--seo-primary)"
                },
                children: gsc.summary.quickWinsCount
              })]
            })]
          }), gsc.mode === "oauth" && ((_u = gsc.availableSites) == null ? void 0 : _u.length) > 1 ? /* @__PURE__ */ jsxs("div", {
            style: {
              display: "flex",
              alignItems: "center",
              gap: "10px",
              flexWrap: "wrap"
            },
            children: [/* @__PURE__ */ jsx("small", {
              className: "seo-muted",
              children: "Switch property:"
            }), /* @__PURE__ */ jsx("select", {
              className: "seo-input",
              style: {
                width: "auto",
                minWidth: "240px",
                height: "34px",
                padding: "4px 10px"
              },
              value: gsc.siteUrl,
              onChange: (e) => handleGscSync(e.target.value),
              children: gsc.availableSites.map((s) => /* @__PURE__ */ jsx("option", {
                value: s.siteUrl,
                children: s.siteUrl
              }, s.siteUrl))
            })]
          }) : null, ((_v = gsc.quickWins) == null ? void 0 : _v.length) ? /* @__PURE__ */ jsxs("div", {
            style: {
              display: "grid",
              gap: "10px"
            },
            children: [/* @__PURE__ */ jsx("div", {
              style: {
                overflowX: "auto"
              },
              children: /* @__PURE__ */ jsxs("table", {
                className: "credit-usage-table",
                children: [/* @__PURE__ */ jsx("thead", {
                  children: /* @__PURE__ */ jsxs("tr", {
                    children: [/* @__PURE__ */ jsx("th", {
                      children: "Quick-Win Query (Pos 8–20)"
                    }), /* @__PURE__ */ jsx("th", {
                      children: "Page / Product"
                    }), /* @__PURE__ */ jsx("th", {
                      children: "Position"
                    }), /* @__PURE__ */ jsx("th", {
                      children: "Impressions / Clicks"
                    }), /* @__PURE__ */ jsx("th", {
                      children: "Action"
                    })]
                  })
                }), /* @__PURE__ */ jsx("tbody", {
                  children: (showAllQuickWins ? gsc.quickWins : gsc.quickWins.slice(0, 5)).map((qw, idx) => {
                    const rowKey = `gsc-qw:${qw.productId || idx}:${qw.query}`;
                    return /* @__PURE__ */ jsxs("tr", {
                      children: [/* @__PURE__ */ jsx("td", {
                        children: /* @__PURE__ */ jsx("strong", {
                          children: qw.query
                        })
                      }), /* @__PURE__ */ jsx("td", {
                        children: qw.productId ? /* @__PURE__ */ jsx(Link, {
                          className: "seo-inline-link",
                          to: `/app/products?focus=${qw.productId}`,
                          children: qw.productTitle || qw.path
                        }) : /* @__PURE__ */ jsx("span", {
                          className: "seo-muted",
                          style: {
                            fontSize: "12px"
                          },
                          children: qw.path
                        })
                      }), /* @__PURE__ */ jsx("td", {
                        children: /* @__PURE__ */ jsxs(StatusPill, {
                          tone: qw.position <= 12 ? "warning" : "info",
                          children: ["Pos ", qw.position]
                        })
                      }), /* @__PURE__ */ jsxs("td", {
                        style: {
                          fontSize: "12px"
                        },
                        children: [qw.impressions, " impr · ", qw.clicks, " clicks (", qw.ctr, "% CTR)"]
                      }), /* @__PURE__ */ jsx("td", {
                        children: qw.productId ? /* @__PURE__ */ jsx("button", {
                          type: "button",
                          className: "seo-button",
                          style: {
                            padding: "5px 10px",
                            fontSize: "12px"
                          },
                          disabled: !loaderData.aiReady || isAutoFixing,
                          onClick: () => handleOptimizeQuickWin(qw, rowKey),
                          children: isAutoFixing && fixingKey === rowKey ? "Optimizing..." : `AI Target Keyword (${loaderData.hasSuperAccess ? "Super" : `${CREDIT_COSTS.product_seo_fix} tok`})`
                        }) : /* @__PURE__ */ jsx("span", {
                          className: "seo-muted",
                          style: {
                            fontSize: "11.5px"
                          },
                          children: "Non-product URL"
                        })
                      })]
                    }, rowKey);
                  })
                })]
              })
            }), gsc.quickWins.length > 5 ? /* @__PURE__ */ jsx("div", {
              children: /* @__PURE__ */ jsx("button", {
                type: "button",
                className: "seo-button secondary",
                style: {
                  padding: "5px 12px",
                  fontSize: "12px"
                },
                onClick: () => setShowAllQuickWins((prev) => !prev),
                children: showAllQuickWins ? "Show Top 5 ▲" : `Show All ${gsc.quickWins.length} Quick Wins ▼`
              })
            }) : null]
          }) : /* @__PURE__ */ jsx("div", {
            className: "status-banner",
            "data-no-toast": "true",
            children: "No ranking queries found in positions 8–20 yet. Sync again once pages gather search impressions."
          })]
        }) : null]
      }), copilotBrief ? /* @__PURE__ */ jsxs("section", {
        className: "ai-diff-card",
        children: [/* @__PURE__ */ jsxs("div", {
          className: "ai-diff-head",
          children: [/* @__PURE__ */ jsxs("div", {
            children: [/* @__PURE__ */ jsx("h4", {
              style: {
                margin: 0
              },
              children: "Gemini Executive SEO Plan"
            }), /* @__PURE__ */ jsxs("p", {
              className: "seo-muted",
              style: {
                margin: "2px 0 0",
                fontSize: "12px"
              },
              children: ["Priority Focus: ", /* @__PURE__ */ jsx("strong", {
                children: copilotBrief.priorityFocus
              }), copilotBrief.generatedAt ? /* @__PURE__ */ jsxs("span", {
                suppressHydrationWarning: true,
                children: [" ", "· Saved ", new Date(copilotBrief.generatedAt).toLocaleString()]
              }) : null]
            })]
          }), /* @__PURE__ */ jsx("span", {
            className: "ctr-badge",
            children: copilotBrief.scoreProjection
          })]
        }), /* @__PURE__ */ jsx("p", {
          style: {
            margin: 0,
            fontSize: "14px",
            lineHeight: 1.5
          },
          children: copilotBrief.executiveSummary
        }), ((_w = copilotBrief.topQuickWins) == null ? void 0 : _w.length) ? /* @__PURE__ */ jsx("div", {
          className: "seo-grid grid-2",
          style: {
            gap: "10px"
          },
          children: copilotBrief.topQuickWins.map((win, idx) => /* @__PURE__ */ jsxs("div", {
            style: {
              background: "#ffffff",
              border: "1px solid var(--seo-border-soft)",
              borderRadius: "8px",
              padding: "12px",
              display: "grid",
              gap: "6px"
            },
            children: [/* @__PURE__ */ jsxs("div", {
              style: {
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "8px"
              },
              children: [/* @__PURE__ */ jsx("strong", {
                style: {
                  fontSize: "13px"
                },
                children: win.title
              }), /* @__PURE__ */ jsxs(StatusPill, {
                tone: "good",
                children: [win.impact, " Impact · ", win.effort, " Effort"]
              })]
            }), /* @__PURE__ */ jsx("p", {
              style: {
                margin: 0,
                fontSize: "13px",
                color: "var(--seo-muted)"
              },
              children: win.action
            }), win.targetPath ? /* @__PURE__ */ jsx("div", {
              children: /* @__PURE__ */ jsx(Link, {
                className: "seo-inline-link",
                to: win.targetPath,
                children: "Open Workspace →"
              })
            }) : null]
          }, idx))
        }) : null, ((_x = copilotBrief.gscQuickWinAdvice) == null ? void 0 : _x.length) ? /* @__PURE__ */ jsxs("div", {
          style: {
            display: "grid",
            gap: "8px"
          },
          children: [/* @__PURE__ */ jsx("strong", {
            style: {
              fontSize: "13px"
            },
            children: "Search Console Position 8–20 Quick Wins (Gemini Advice):"
          }), /* @__PURE__ */ jsx("div", {
            className: "seo-grid grid-2",
            style: {
              gap: "10px"
            },
            children: copilotBrief.gscQuickWinAdvice.map((item, idx) => /* @__PURE__ */ jsxs("div", {
              style: {
                background: "#ffffff",
                border: "1px solid var(--seo-border-soft)",
                borderRadius: "8px",
                padding: "11px 12px",
                display: "grid",
                gap: "4px"
              },
              children: [/* @__PURE__ */ jsxs("div", {
                style: {
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "8px"
                },
                children: [/* @__PURE__ */ jsx("strong", {
                  style: {
                    fontSize: "12.5px"
                  },
                  children: item.query || "Ranking Opportunity"
                }), item.pagePath ? /* @__PURE__ */ jsx("code", {
                  style: {
                    fontSize: "11px"
                  },
                  children: item.pagePath
                }) : null]
              }), /* @__PURE__ */ jsx("p", {
                style: {
                  margin: 0,
                  fontSize: "12.5px",
                  color: "var(--seo-muted)"
                },
                children: item.recommendation
              })]
            }, `gsc-adv-${idx}`))
          })]
        }) : null, copilotBrief.riskAlert ? /* @__PURE__ */ jsx("div", {
          className: "diff-verdict",
          children: /* @__PURE__ */ jsxs("p", {
            children: [/* @__PURE__ */ jsx("strong", {
              children: "Risk Watch:"
            }), " ", copilotBrief.riskAlert]
          })
        }) : null]
      }) : null, cannibalGroups.length > 0 ? /* @__PURE__ */ jsxs("section", {
        className: "section-card",
        children: [/* @__PURE__ */ jsxs("div", {
          className: "section-header",
          style: {
            flexWrap: "wrap",
            gap: "12px"
          },
          children: [/* @__PURE__ */ jsxs("div", {
            children: [/* @__PURE__ */ jsxs("h2", {
              children: ["Keyword Cannibalization Alerts (", cannibalGroups.length, ")"]
            }), /* @__PURE__ */ jsx("p", {
              className: "seo-muted",
              children: "Multiple products target the exact same focus keyword. Let AI assign distinct buying-intent keywords."
            })]
          }), /* @__PURE__ */ jsx("button", {
            type: "button",
            className: "seo-button secondary",
            disabled: !loaderData.aiReady || isAiWorking,
            onClick: handleResolveCannibalization,
            children: isAiWorking && activeAiAction === "cannibal" ? "Resolving Conflicts..." : `AI Resolve All (${loaderData.hasSuperAccess ? "Super" : `${CREDIT_COSTS.catalog_cannibalization} tok`})`
          })]
        }), /* @__PURE__ */ jsx("div", {
          style: {
            display: "grid",
            gap: "10px"
          },
          children: cannibalGroups.map((group) => {
            var _a3;
            return /* @__PURE__ */ jsx("div", {
              className: "issue-product-row",
              children: /* @__PURE__ */ jsxs("div", {
                className: "issue-product-info",
                children: [/* @__PURE__ */ jsxs("div", {
                  style: {
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    flexWrap: "wrap"
                  },
                  children: [/* @__PURE__ */ jsxs(StatusPill, {
                    tone: "warning",
                    children: ['Duplicate: "', group.keyword, '"']
                  }), /* @__PURE__ */ jsxs("span", {
                    className: "seo-muted",
                    style: {
                      fontSize: "12px"
                    },
                    children: ["Shared by ", group.count, " products"]
                  })]
                }), /* @__PURE__ */ jsx("div", {
                  className: "issue-product-meta",
                  children: (_a3 = group.products) == null ? void 0 : _a3.map((p) => /* @__PURE__ */ jsx(Link, {
                    className: "seo-inline-link",
                    to: `/app/products?focus=${p.id}`,
                    children: p.title
                  }, p.id))
                })]
              })
            }, group.keyword);
          })
        }), ((_y = cannibalResult == null ? void 0 : cannibalResult.resolutions) == null ? void 0 : _y.length) ? /* @__PURE__ */ jsxs("div", {
          className: "ai-diff-card",
          style: {
            marginTop: "8px"
          },
          children: [/* @__PURE__ */ jsxs("div", {
            className: "ai-diff-head",
            children: [/* @__PURE__ */ jsx("h4", {
              children: "Gemini Cannibalization Resolution Plan"
            }), /* @__PURE__ */ jsxs(StatusPill, {
              tone: "good",
              children: [cannibalResult.resolutions.length, " Suggestions"]
            })]
          }), /* @__PURE__ */ jsx("p", {
            style: {
              margin: 0,
              fontSize: "13px"
            },
            children: cannibalResult.summary
          }), /* @__PURE__ */ jsx("div", {
            style: {
              overflowX: "auto"
            },
            children: /* @__PURE__ */ jsxs("table", {
              className: "credit-usage-table",
              children: [/* @__PURE__ */ jsx("thead", {
                children: /* @__PURE__ */ jsxs("tr", {
                  children: [/* @__PURE__ */ jsx("th", {
                    children: "Product"
                  }), /* @__PURE__ */ jsx("th", {
                    children: "Old Keyword"
                  }), /* @__PURE__ */ jsx("th", {
                    children: "New AI Keyword"
                  }), /* @__PURE__ */ jsx("th", {
                    children: "Action"
                  })]
                })
              }), /* @__PURE__ */ jsx("tbody", {
                children: cannibalResult.resolutions.map((res, idx) => {
                  const isApplied = Boolean(appliedIds[res.productId]);
                  return /* @__PURE__ */ jsxs("tr", {
                    children: [/* @__PURE__ */ jsxs("td", {
                      children: [/* @__PURE__ */ jsx("strong", {
                        children: res.title || `Product ${res.productId}`
                      }), res.reason ? /* @__PURE__ */ jsx("div", {
                        className: "seo-muted",
                        style: {
                          fontSize: "11px"
                        },
                        children: res.reason
                      }) : null]
                    }), /* @__PURE__ */ jsx("td", {
                      children: /* @__PURE__ */ jsx(StatusPill, {
                        tone: "warning",
                        children: res.currentKeyword
                      })
                    }), /* @__PURE__ */ jsx("td", {
                      children: /* @__PURE__ */ jsx(StatusPill, {
                        tone: "good",
                        children: res.suggestedKeyword
                      })
                    }), /* @__PURE__ */ jsx("td", {
                      children: /* @__PURE__ */ jsx("button", {
                        type: "button",
                        className: "seo-button",
                        style: {
                          padding: "5px 10px",
                          fontSize: "12px"
                        },
                        disabled: isApplied || keywordFetcher.state !== "idle",
                        onClick: () => handleApplySuggestedKeyword(res),
                        children: isApplied ? "Applied" : "Apply Keyword"
                      })
                    })]
                  }, idx);
                })
              })]
            })
          })]
        }) : null]
      }) : null, scan ? /* @__PURE__ */ jsxs("section", {
        id: "issues",
        className: "section-card audit-section",
        children: [/* @__PURE__ */ jsxs("div", {
          className: "audit-toolbar",
          children: [/* @__PURE__ */ jsxs("div", {
            children: [/* @__PURE__ */ jsx("h2", {
              style: {
                margin: "0 0 4px"
              },
              children: viewMode === "grouped" ? `Actionable Issue Groups (${groupedIssues.length})` : `All Findings (${filteredIssues.length})`
            }), /* @__PURE__ */ jsx("p", {
              className: "seo-muted",
              style: {
                margin: 0
              },
              children: "Grouped by root cause. Click AI Fix to optimize & apply directly to Shopify with auto 301 redirects."
            })]
          }), /* @__PURE__ */ jsxs("div", {
            className: "audit-toolbar-controls",
            children: [/* @__PURE__ */ jsx("input", {
              type: "search",
              className: "seo-input",
              style: {
                width: "210px"
              },
              placeholder: "Filter product or issue...",
              value: searchQuery,
              onChange: (e) => setSearchQuery(e.target.value)
            }), /* @__PURE__ */ jsx("div", {
              className: "view-toggle",
              role: "group",
              "aria-label": "Filter by severity",
              children: ["ALL", "Critical", "Warning", "Info"].map((level) => /* @__PURE__ */ jsx("button", {
                type: "button",
                className: `view-toggle-btn ${severityFilter === level ? "active" : ""}`,
                onClick: () => setSeverityFilter(level),
                children: level
              }, level))
            }), /* @__PURE__ */ jsxs("div", {
              className: "view-toggle",
              role: "tablist",
              "aria-label": "Issue display mode",
              children: [/* @__PURE__ */ jsx("button", {
                type: "button",
                className: `view-toggle-btn ${viewMode === "grouped" ? "active" : ""}`,
                onClick: () => setViewMode("grouped"),
                children: "Smart Groups"
              }), /* @__PURE__ */ jsxs("button", {
                type: "button",
                className: `view-toggle-btn ${viewMode === "raw" ? "active" : ""}`,
                onClick: () => setViewMode("raw"),
                children: ["All Items (", filteredIssues.length, ")"]
              })]
            })]
          })]
        }), !filteredIssues.length ? /* @__PURE__ */ jsx("div", {
          className: "status-banner banner-good",
          "data-no-toast": "true",
          children: "No SEO issues match the current filter. Great job!"
        }) : viewMode === "grouped" ? /* @__PURE__ */ jsx("div", {
          className: "issue-group-list",
          children: groupedIssues.map((group) => {
            const isOpen = Boolean(openGroups[group.key]);
            const batchProducts = group.uniqueProducts.slice(0, 5);
            const groupFixKey = `group:${group.key}`;
            return /* @__PURE__ */ jsxs("div", {
              className: "issue-group-card",
              children: [/* @__PURE__ */ jsxs("div", {
                className: "issue-group-head",
                onClick: () => toggleGroup(group.key),
                role: "button",
                tabIndex: 0,
                onKeyDown: (e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    toggleGroup(group.key);
                  }
                },
                children: [/* @__PURE__ */ jsxs("div", {
                  className: "issue-group-title-wrap",
                  children: [/* @__PURE__ */ jsxs("div", {
                    style: {
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      flexWrap: "wrap"
                    },
                    children: [/* @__PURE__ */ jsx(StatusPill, {
                      tone: severityTone(group.severity),
                      children: group.severity
                    }), /* @__PURE__ */ jsx("h3", {
                      className: "issue-group-title",
                      children: group.title
                    }), /* @__PURE__ */ jsxs(StatusPill, {
                      tone: "info",
                      children: [group.items.length, " ", group.items.length === 1 ? "item" : "items"]
                    })]
                  }), /* @__PURE__ */ jsx("span", {
                    className: "seo-muted",
                    style: {
                      fontSize: "13px"
                    },
                    children: group.detail
                  })]
                }), /* @__PURE__ */ jsxs("div", {
                  className: "button-row",
                  style: {
                    alignItems: "center"
                  },
                  onClick: (e) => e.stopPropagation(),
                  children: [group.isProductFixable ? /* @__PURE__ */ jsx("button", {
                    type: "button",
                    className: "seo-button",
                    style: {
                      padding: "7px 12px",
                      fontSize: "12px"
                    },
                    disabled: !loaderData.aiReady || isAutoFixing,
                    onClick: () => handleAutoFix(batchProducts, groupFixKey),
                    children: isAutoFixing && fixingKey === groupFixKey ? "Fixing..." : batchProducts.length === 1 ? `AI Fix (${loaderData.hasSuperAccess ? "Super" : `${CREDIT_COSTS.product_seo_fix} tok`})` : `AI Fix Top ${batchProducts.length} (${loaderData.hasSuperAccess ? "Super" : `${batchProducts.length * CREDIT_COSTS.product_seo_fix} tok`})`
                  }) : /* @__PURE__ */ jsx(Link, {
                    className: "seo-button secondary",
                    style: {
                      padding: "7px 12px",
                      fontSize: "12px"
                    },
                    to: group.fixPath,
                    children: "Open Fix Tool →"
                  }), /* @__PURE__ */ jsx("button", {
                    type: "button",
                    className: "seo-button secondary",
                    style: {
                      padding: "7px 10px",
                      fontSize: "12px"
                    },
                    onClick: () => toggleGroup(group.key),
                    children: isOpen ? "Hide ▲" : `Inspect (${group.items.length}) ▼`
                  })]
                })]
              }), isOpen ? /* @__PURE__ */ jsx("div", {
                className: "issue-group-body",
                children: group.isProductFixable ? /* @__PURE__ */ jsxs(Fragment, {
                  children: [group.uniqueProducts.slice(0, groupVisibleLimit[group.key] || 25).map((product) => {
                    const rowFixKey = `product:${product.id}`;
                    return /* @__PURE__ */ jsxs("div", {
                      className: "issue-product-row",
                      children: [/* @__PURE__ */ jsxs("div", {
                        className: "issue-product-info",
                        children: [/* @__PURE__ */ jsx("strong", {
                          children: product.title || (product.handle ? `/products/${product.handle}` : `Product #${product.id}`)
                        }), /* @__PURE__ */ jsxs("div", {
                          className: "issue-product-meta",
                          children: [/* @__PURE__ */ jsxs("span", {
                            className: "issue-meta-chip",
                            children: ["/products/", product.handle || product.id]
                          }), /* @__PURE__ */ jsxs("span", {
                            className: `issue-meta-chip ${product.focusKeyword ? "" : "missing"}`,
                            children: ["Keyword: ", product.focusKeyword ? `"${product.focusKeyword}"` : "Missing"]
                          }), /* @__PURE__ */ jsxs("span", {
                            className: `issue-meta-chip ${product.metaTitle ? "" : "missing"}`,
                            children: ["Meta Title: ", product.metaTitle ? `${product.metaTitle.length} chars` : "Missing"]
                          }), /* @__PURE__ */ jsxs("span", {
                            className: `issue-meta-chip ${product.metaDescription ? "" : "missing"}`,
                            children: ["Meta Desc:", " ", product.metaDescription ? `${product.metaDescription.length} chars` : "Missing"]
                          })]
                        })]
                      }), /* @__PURE__ */ jsxs("div", {
                        className: "button-row",
                        style: {
                          alignItems: "center"
                        },
                        children: [/* @__PURE__ */ jsx("button", {
                          type: "button",
                          className: "seo-button",
                          style: {
                            padding: "6px 11px",
                            fontSize: "12px"
                          },
                          disabled: !loaderData.aiReady || isAutoFixing,
                          onClick: () => handleAutoFix([product], rowFixKey),
                          children: isAutoFixing && fixingKey === rowFixKey ? "AI Fixing..." : `1-Click AI Fix (${loaderData.hasSuperAccess ? "Super" : `${CREDIT_COSTS.product_seo_fix} tok`})`
                        }), /* @__PURE__ */ jsx(Link, {
                          className: "seo-button secondary",
                          style: {
                            padding: "6px 11px",
                            fontSize: "12px"
                          },
                          to: product.fixPath,
                          children: "Edit"
                        })]
                      })]
                    }, product.id);
                  }), group.uniqueProducts.length > (groupVisibleLimit[group.key] || 25) ? /* @__PURE__ */ jsx("div", {
                    className: "toolbar",
                    style: {
                      marginTop: 8,
                      marginBottom: 0
                    },
                    children: /* @__PURE__ */ jsxs("button", {
                      type: "button",
                      className: "seo-button secondary",
                      style: {
                        padding: "6px 12px",
                        fontSize: 12
                      },
                      onClick: () => setGroupVisibleLimit((prev) => ({
                        ...prev,
                        [group.key]: (prev[group.key] || 25) + 50
                      })),
                      children: ["Show more (", group.uniqueProducts.length - (groupVisibleLimit[group.key] || 25), " remaining)"]
                    })
                  }) : null]
                }) : group.items.slice(0, groupVisibleLimit[group.key] || 25).map((item) => /* @__PURE__ */ jsxs("div", {
                  className: "issue-product-row",
                  children: [/* @__PURE__ */ jsxs("div", {
                    className: "issue-product-info",
                    children: [/* @__PURE__ */ jsx("strong", {
                      children: item.title
                    }), /* @__PURE__ */ jsx("div", {
                      className: "issue-product-meta",
                      children: /* @__PURE__ */ jsx("span", {
                        children: item.targetUrl
                      })
                    })]
                  }), /* @__PURE__ */ jsx(Link, {
                    className: "seo-button secondary",
                    style: {
                      padding: "6px 11px",
                      fontSize: "12px"
                    },
                    to: item.fixPath,
                    children: "Open Fix Tool →"
                  })]
                }, item.id))
              }) : null]
            }, group.key);
          })
        }) : /* @__PURE__ */ jsxs("div", {
          className: "issue-list",
          children: [filteredIssues.slice(0, rawVisibleCount).map((issue) => {
            var _a3;
            const product = toProductFixInput(issue);
            const rowFixKey = product ? `raw:${issue.id}` : "";
            return /* @__PURE__ */ jsxs("article", {
              className: "issue-card",
              children: [/* @__PURE__ */ jsxs("div", {
                className: "issue-head",
                children: [/* @__PURE__ */ jsxs("div", {
                  children: [/* @__PURE__ */ jsx(StatusPill, {
                    tone: severityTone(issue.severity),
                    children: issue.severity
                  }), " ", /* @__PURE__ */ jsx("strong", {
                    children: issue.title
                  })]
                }), /* @__PURE__ */ jsxs("div", {
                  className: "button-row",
                  style: {
                    alignItems: "center"
                  },
                  children: [product ? /* @__PURE__ */ jsx("button", {
                    type: "button",
                    className: "seo-button",
                    style: {
                      padding: "5px 10px",
                      fontSize: "12px"
                    },
                    disabled: !loaderData.aiReady || isAutoFixing,
                    onClick: () => handleAutoFix([product], rowFixKey),
                    children: isAutoFixing && fixingKey === rowFixKey ? "Fixing..." : `1-Click AI Fix (${loaderData.hasSuperAccess ? "Super" : `${CREDIT_COSTS.product_seo_fix} tok`})`
                  }) : null, /* @__PURE__ */ jsx(Link, {
                    className: "seo-button secondary",
                    style: {
                      padding: "5px 10px",
                      fontSize: "12px"
                    },
                    to: issue.fixPath,
                    children: "Open Fix Tool →"
                  })]
                })]
              }), /* @__PURE__ */ jsxs("p", {
                className: "issue-url",
                children: [((_a3 = issue.meta) == null ? void 0 : _a3.productTitle) ? `${issue.meta.productTitle} — ` : "", issue.targetUrl]
              }), /* @__PURE__ */ jsx("p", {
                className: "seo-muted",
                children: issue.detail
              })]
            }, issue.id);
          }), filteredIssues.length > rawVisibleCount ? /* @__PURE__ */ jsx("div", {
            className: "toolbar",
            style: {
              marginTop: 8
            },
            children: /* @__PURE__ */ jsxs("button", {
              type: "button",
              className: "seo-button secondary",
              onClick: () => setRawVisibleCount((prev) => prev + 60),
              children: ["Show more issues (", filteredIssues.length - rawVisibleCount, " remaining)"]
            })
          }) : null]
        })]
      }) : null]
    })
  });
});
const route22 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$6,
  default: app_seoAudit,
  links: links$6,
  loader: loader$8
}, Symbol.toStringTag, { value: "Module" }));
const links$5 = () => [{
  rel: "stylesheet",
  href: seoStyles
}];
const loader$7 = async ({
  request
}) => {
  const {
    shop,
    token,
    apiVersion,
    configError
  } = await requireShopContext(request);
  const url = new URL(request.url);
  const query = (url.searchParams.get("q") || "").trim();
  const pageInfo = url.searchParams.get("page_info") || "";
  const focusId = url.searchParams.get("focus") || "";
  if (configError) {
    return {
      configError,
      shop: shop || "",
      query,
      focusId,
      rows: [],
      pagination: {
        nextPageInfo: "",
        previousPageInfo: ""
      }
    };
  }
  try {
    const result = await loadProductsPage({
      shop,
      storeDomain: shop,
      token,
      apiVersion,
      query,
      pageInfo,
      limit: 20
    });
    return {
      configError: "",
      shop: shop || "",
      query,
      focusId,
      rows: result.rows,
      pagination: result.pagination
    };
  } catch (error) {
    return {
      configError: (error == null ? void 0 : error.message) || "Unable to load Shopify products.",
      shop: shop || "",
      query,
      focusId,
      rows: [],
      pagination: {
        nextPageInfo: "",
        previousPageInfo: ""
      }
    };
  }
};
function shouldRevalidate({
  formMethod,
  defaultShouldRevalidate
}) {
  if (String(formMethod || "").toUpperCase() === "POST") {
    return false;
  }
  return defaultShouldRevalidate;
}
const action$5 = async ({
  request
}) => {
  const {
    shop,
    token,
    apiVersion,
    configError
  } = await requireShopContext(request);
  if (configError) {
    return {
      ok: false,
      error: configError
    };
  }
  const formData = await request.formData();
  const payloadRaw = formData.get("payload");
  try {
    const payload = JSON.parse(String(payloadRaw || "{}"));
    const result = await saveProductSeoAndRescan({
      shop,
      storeDomain: shop,
      token,
      apiVersion,
      productId: payload.id,
      payload
    });
    if (!(result == null ? void 0 : result.ok) && !(result == null ? void 0 : result.error) && (result == null ? void 0 : result.errors)) {
      const firstError = Object.values(result.errors).find(Boolean);
      return {
        ...result,
        error: firstError || "Unable to save product SEO changes."
      };
    }
    return result;
  } catch (error) {
    return {
      ok: false,
      error: (error == null ? void 0 : error.message) || "Failed to save product SEO changes."
    };
  }
};
function useDraftStore(rows) {
  const [drafts, setDrafts] = useState({});
  useEffect(() => {
    const raw = localStorage.getItem("seo-product-drafts");
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      setDrafts(parsed && typeof parsed === "object" ? parsed : {});
    } catch {
      setDrafts({});
    }
  }, []);
  useEffect(() => {
    localStorage.setItem("seo-product-drafts", JSON.stringify(drafts));
  }, [drafts]);
  const mergedRows = useMemo(() => {
    return rows.map((row) => ({
      ...row,
      ...drafts[row.id]
    }));
  }, [rows, drafts]);
  const patchRow = useCallback((id, patch) => {
    setDrafts((current) => ({
      ...current,
      [id]: {
        ...current[id] || {},
        ...patch
      }
    }));
  }, []);
  const clearRow = useCallback((id) => {
    setDrafts((current) => {
      const next = {
        ...current
      };
      delete next[id];
      return next;
    });
  }, []);
  return {
    rows: mergedRows,
    patchRow,
    clearRow,
    drafts
  };
}
function fieldStatusMessage(validation) {
  if (!validation) return "";
  if (!validation.valid) return validation.message;
  if (typeof validation.ideal === "boolean" && !validation.ideal) {
    return "Outside ideal range";
  }
  return "Looks good";
}
function getLiveValidation(row) {
  return {
    title: validateProductTitle(row.title),
    focusKeyword: validateFocusKeyword(row.focusKeyword),
    metaTitle: validateMetaTitle(row.metaTitle),
    metaDescription: validateMetaDescription(row.metaDescription),
    handle: validateUrlHandle(row.handle),
    description: validateProductDescription(row.descriptionHtml || "", row.focusKeyword || "")
  };
}
function getIssueItems(validation) {
  const items = [];
  if (!validation.title.valid) items.push({
    tone: "critical",
    label: validation.title.message
  });
  if (!validation.focusKeyword.valid) items.push({
    tone: "warning",
    label: validation.focusKeyword.message
  });
  if (!validation.metaTitle.valid) items.push({
    tone: "critical",
    label: validation.metaTitle.message
  });
  if (validation.metaTitle.valid && !validation.metaTitle.ideal) items.push({
    tone: "warning",
    label: "Meta title is outside ideal length (45-60)."
  });
  if (!validation.metaDescription.valid) items.push({
    tone: "critical",
    label: validation.metaDescription.message
  });
  if (validation.metaDescription.valid && !validation.metaDescription.ideal) items.push({
    tone: "warning",
    label: "Meta description is outside ideal length (120-155)."
  });
  if (!validation.handle.valid) items.push({
    tone: "critical",
    label: validation.handle.message
  });
  if (!validation.description.valid) {
    items.push({
      tone: "critical",
      label: validation.description.message
    });
  } else if (!validation.description.ideal && validation.description.message) {
    items.push({
      tone: "warning",
      label: validation.description.message
    });
  }
  return items;
}
function getHealthStatus(validation) {
  const checks = [validation.title.valid, validation.focusKeyword.valid, validation.metaTitle.valid, validation.metaDescription.valid, validation.handle.valid, Boolean(validation.metaTitle.ideal), Boolean(validation.metaDescription.ideal), Boolean(validation.description.valid && validation.description.wordCount >= 80)];
  const passed = checks.filter(Boolean).length;
  const percent = Math.round(passed / checks.length * 100);
  if (checks.slice(0, 5).some((item) => !item) || !validation.description.valid) {
    return {
      tone: "red",
      label: "Needs fixes",
      percent
    };
  }
  if (!validation.metaTitle.ideal || !validation.metaDescription.ideal || !validation.description.ideal) {
    return {
      tone: "orange",
      label: "Good, can improve",
      percent
    };
  }
  return {
    tone: "green",
    label: "Healthy",
    percent
  };
}
function getLengthState(value, rules) {
  const len = String(value || "").trim().length;
  const hardMax = rules.hardMax ?? rules.max;
  if (len > hardMax) {
    return {
      tone: "critical",
      label: `${len}/${hardMax} (${len - hardMax} over limit)`
    };
  }
  if (typeof rules.min === "number" && len < rules.min) {
    return {
      tone: "warning",
      label: `${len}/${hardMax} (${rules.min - len} short)`
    };
  }
  if (typeof rules.idealMin === "number" && typeof rules.idealMax === "number" && (len < rules.idealMin || len > rules.idealMax)) {
    return {
      tone: "warning",
      label: `${len}/${hardMax} (ideal ${rules.idealMin}-${rules.idealMax})`
    };
  }
  return {
    tone: "good",
    label: `${len}/${hardMax} in range`
  };
}
function getChangedFieldCount(row, original) {
  if (!original) return 0;
  const keys = ["title", "focusKeyword", "metaTitle", "metaDescription", "handle", "descriptionHtml"];
  return keys.filter((key) => String(row[key] || "") !== String(original[key] || "")).length;
}
function buildMinorSeoPatch(row, {
  preserveHandle = true
} = {}) {
  const cleanSpace = (text2) => String(text2 || "").replace(/\s+/g, " ").trim();
  const nextTitle = cleanSpace(row.title);
  let nextKeyword = cleanSpace(row.focusKeyword);
  if (!nextKeyword && nextTitle) {
    nextKeyword = nextTitle.split(/\s+/).slice(0, 4).join(" ").slice(0, 40).trim();
  }
  let nextMetaTitle = cleanSpace(row.metaTitle);
  if (!nextMetaTitle && nextTitle) {
    nextMetaTitle = `${nextTitle}${nextKeyword ? ` | ${nextKeyword}` : ""}`.slice(0, 60).trim();
  }
  let nextMetaDescription = cleanSpace(row.metaDescription);
  if (!nextMetaDescription) {
    const plainBody = stripHtmlTags(row.descriptionHtml || "");
    const baseText = plainBody || `${nextTitle}. Quality craft, fast shipping, and dependable value for everyday buyers.`;
    nextMetaDescription = baseText.slice(0, 155).trim();
  }
  const nextHandle = preserveHandle && validateUrlHandle(row.handle || "").valid ? row.handle : normalizeHandle(row.handle || nextTitle);
  return {
    title: nextTitle,
    focusKeyword: nextKeyword,
    metaTitle: nextMetaTitle,
    metaDescription: nextMetaDescription,
    handle: nextHandle
  };
}
const app_products = UNSAFE_withComponentProps(function ProductSeoRoute() {
  var _a2, _b;
  const data2 = useLoaderData();
  const saveFetcher = useFetcher();
  const listFetcher = useFetcher();
  const aiFetcher = useFetcher();
  const [pageData, setPageData] = useState(() => ({
    configError: data2.configError || "",
    shop: data2.shop || "",
    query: data2.query || "",
    focusId: data2.focusId || "",
    rows: data2.rows || [],
    pagination: data2.pagination || {
      nextPageInfo: "",
      previousPageInfo: ""
    }
  }));
  const [searchQuery, setSearchQuery] = useState(data2.query || "");
  const [listFilter, setListFilter] = useState("all");
  const {
    rows,
    patchRow,
    clearRow
  } = useDraftStore(pageData.rows || []);
  const [openRowId, setOpenRowId] = useState(data2.focusId || "");
  const [savingRowId, setSavingRowId] = useState("");
  const [aiRowId, setAiRowId] = useState("");
  const [aiActionLabel, setAiActionLabel] = useState("");
  const [lastAiAppliedRowId, setLastAiAppliedRowId] = useState("");
  const [aiNotesById, setAiNotesById] = useState({});
  const [auditResultsById, setAuditResultsById] = useState({});
  const [previewDescById, setPreviewDescById] = useState({});
  const [preserveHandleById, setPreserveHandleById] = useState({});
  const syncPageData = useCallback((nextData) => {
    setPageData({
      configError: nextData.configError || "",
      shop: nextData.shop || "",
      query: nextData.query || "",
      focusId: nextData.focusId || "",
      rows: nextData.rows || [],
      pagination: nextData.pagination || {
        nextPageInfo: "",
        previousPageInfo: ""
      }
    });
    setSearchQuery(nextData.query || "");
  }, []);
  const originalById = useMemo(() => {
    return (pageData.rows || []).reduce((acc, row) => {
      acc[row.id] = row;
      return acc;
    }, {});
  }, [pageData.rows]);
  useEffect(() => {
    syncPageData(data2);
  }, [data2, syncPageData]);
  useEffect(() => {
    setOpenRowId((current) => {
      var _a3;
      if (!((_a3 = pageData.rows) == null ? void 0 : _a3.length)) return "";
      if (pageData.focusId && pageData.rows.some((row) => row.id === pageData.focusId)) {
        return pageData.focusId;
      }
      if (pageData.rows.length === 1) {
        return pageData.rows[0].id;
      }
      if (!current) return "";
      if (pageData.rows.some((row) => row.id === current)) return current;
      return "";
    });
  }, [pageData.rows, pageData.focusId]);
  useEffect(() => {
    if (listFetcher.data) {
      syncPageData(listFetcher.data);
    }
  }, [listFetcher.data, syncPageData]);
  useEffect(() => {
    var _a3, _b2, _c;
    if (((_a3 = saveFetcher.data) == null ? void 0 : _a3.ok) && ((_b2 = saveFetcher.data) == null ? void 0 : _b2.productId)) {
      const productId = String(saveFetcher.data.productId);
      const normalized = saveFetcher.data.normalized || {};
      setPageData((current) => ({
        ...current,
        rows: current.rows.map((row) => String(row.id) === productId ? {
          ...row,
          ...normalized,
          id: row.id
        } : row)
      }));
      clearRow(productId);
      setSavingRowId("");
      showToast({
        tone: "success",
        title: "Product SEO Saved",
        message: `Saved "${normalized.title || "Product"}"${saveFetcher.data.redirectCreated ? " and created 301 redirect" : ""}.`
      });
    }
    if ((_c = saveFetcher.data) == null ? void 0 : _c.error) {
      setSavingRowId("");
    }
  }, [saveFetcher.data, clearRow]);
  useEffect(() => {
    var _a3, _b2, _c, _d, _e, _f, _g, _h, _i, _j;
    if (((_a3 = aiFetcher.data) == null ? void 0 : _a3.ok) && ((_b2 = aiFetcher.data) == null ? void 0 : _b2.creditsRemaining) !== void 0) {
      dispatchCreditsUpdate({
        availableCredits: aiFetcher.data.creditsRemaining,
        plan: aiFetcher.data.plan,
        superAccess: Boolean(aiFetcher.data.superAccess)
      });
    }
    if (((_c = aiFetcher.data) == null ? void 0 : _c.ok) && ((_d = aiFetcher.data) == null ? void 0 : _d.actionType) === "product_seo_fix" && aiRowId) {
      const result = aiFetcher.data.result || {};
      const patch = {
        title: result.title,
        focusKeyword: result.focusKeyword,
        handle: result.handle,
        metaTitle: result.metaTitle,
        metaDescription: result.metaDescription,
        ...typeof result.descriptionHtml === "string" && result.descriptionHtml ? {
          descriptionHtml: result.descriptionHtml
        } : {}
      };
      patchRow(aiRowId, patch);
      if (result.rationale) {
        setAiNotesById((current) => ({
          ...current,
          [aiRowId]: result.rationale
        }));
      }
      setLastAiAppliedRowId(aiRowId);
      setAiRowId("");
      setAiActionLabel("");
      showToast({
        tone: "info",
        title: "AI SEO Suggestion Ready",
        message: result.rationale || "Gemini SEO & content fields populated. Review and click Save Product SEO."
      });
    }
    if (((_e = aiFetcher.data) == null ? void 0 : _e.ok) && ((_f = aiFetcher.data) == null ? void 0 : _f.actionType) === "product_content_fix" && aiRowId) {
      const result = aiFetcher.data.result || {};
      if (typeof result.descriptionHtml === "string") {
        patchRow(aiRowId, {
          descriptionHtml: result.descriptionHtml
        });
      }
      if (result.summary) {
        setAiNotesById((current) => ({
          ...current,
          [aiRowId]: result.summary
        }));
      }
      setLastAiAppliedRowId(aiRowId);
      setAiRowId("");
      setAiActionLabel("");
      showToast({
        tone: "info",
        title: "Product Copy Updated",
        message: result.summary || "Gemini improved product description HTML. Review and save to Shopify."
      });
    }
    if (((_g = aiFetcher.data) == null ? void 0 : _g.ok) && ((_h = aiFetcher.data) == null ? void 0 : _h.actionType) === "audit_change" && aiRowId) {
      setAuditResultsById((current) => ({
        ...current,
        [aiRowId]: aiFetcher.data.result
      }));
      setLastAiAppliedRowId(aiRowId);
      setAiRowId("");
      setAiActionLabel("");
      showToast({
        tone: "info",
        title: "AI Impact Analysis Complete",
        message: ((_i = aiFetcher.data.result) == null ? void 0 : _i.verdict) || "Review the Gemini Diff Audit card below."
      });
    }
    if ((_j = aiFetcher.data) == null ? void 0 : _j.error) {
      setAiRowId("");
      setAiActionLabel("");
    }
  }, [aiFetcher.data, aiRowId, patchRow]);
  const updateAddressBar = useCallback((query, pageInfo = "") => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (query) {
      url.searchParams.set("q", query);
    } else {
      url.searchParams.delete("q");
    }
    if (pageInfo) {
      url.searchParams.set("page_info", pageInfo);
    } else {
      url.searchParams.delete("page_info");
    }
    url.searchParams.delete("focus");
    window.history.pushState({}, "", `${url.pathname}${url.search}`);
  }, []);
  const loadList = useCallback((query, pageInfo = "") => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (pageInfo) params.set("page_info", pageInfo);
    const href = params.toString() ? `/app/products?${params.toString()}` : "/app/products";
    listFetcher.load(href);
    updateAddressBar(query, pageInfo);
  }, [listFetcher, updateAddressBar]);
  function handleSearchSubmit(event) {
    event.preventDefault();
    loadList(searchQuery.trim(), "");
  }
  function saveRow(row) {
    setSavingRowId(row.id);
    const original = originalById[row.id] || {};
    saveFetcher.submit({
      payload: JSON.stringify({
        ...row,
        originalHandle: original.handle || "",
        previousValues: original,
        aiVerdict: auditResultsById[row.id] || null
      })
    }, {
      method: "post"
    });
  }
  function isHandleLocked(row) {
    var _a3;
    if (preserveHandleById[row.id] !== void 0) {
      return preserveHandleById[row.id];
    }
    return validateUrlHandle(((_a3 = originalById[row.id]) == null ? void 0 : _a3.handle) || row.handle || "").valid;
  }
  function runAiFix(row, mode = "full") {
    const keepHandle = isHandleLocked(row);
    setAiRowId(row.id);
    setAiActionLabel(mode === "minor" ? "minor" : "full");
    aiFetcher.submit({
      payload: JSON.stringify({
        actionType: "product_seo_fix",
        mode,
        preserveHandle: keepHandle,
        productId: row.id,
        title: row.title,
        focusKeyword: row.focusKeyword,
        handle: row.handle,
        metaTitle: row.metaTitle,
        metaDescription: row.metaDescription,
        descriptionHtml: row.descriptionHtml || "",
        productType: row.productType || "",
        tags: row.tags || ""
      })
    }, {
      method: "post",
      action: "/app/api/ai"
    });
  }
  function runAiContentFix(row, goal = "polish") {
    setAiRowId(row.id);
    setAiActionLabel(`content_${goal}`);
    aiFetcher.submit({
      payload: JSON.stringify({
        actionType: "product_content_fix",
        goal,
        productId: row.id,
        title: row.title,
        focusKeyword: row.focusKeyword,
        descriptionHtml: row.descriptionHtml || "",
        productType: row.productType || "",
        tags: row.tags || ""
      })
    }, {
      method: "post",
      action: "/app/api/ai"
    });
  }
  function runAiAudit(row) {
    setAiRowId(row.id);
    setAiActionLabel("audit");
    const original = originalById[row.id] || {};
    aiFetcher.submit({
      payload: JSON.stringify({
        actionType: "audit_change",
        productId: row.id,
        title: row.title,
        currentValues: original,
        newValues: row
      })
    }, {
      method: "post",
      action: "/app/api/ai"
    });
  }
  function applyLocalMinorTuneUp(row) {
    const patch = buildMinorSeoPatch(row, {
      preserveHandle: isHandleLocked(row)
    });
    patchRow(row.id, patch);
    showToast({
      tone: "info",
      title: "Minor SEO Tune-Up Applied",
      message: "Cleaned spacing, filled missing essentials, and preserved existing copy. Click Save to apply."
    });
  }
  function applyCleanSlug(row) {
    const cleanSlug = normalizeHandle(row.handle || row.title || "");
    patchRow(row.id, {
      handle: cleanSlug
    });
  }
  function revertDraft(rowId) {
    clearRow(rowId);
    setAiNotesById((current) => {
      const next = {
        ...current
      };
      delete next[rowId];
      return next;
    });
    showToast({
      tone: "info",
      title: "Draft Reverted",
      message: "Restored product fields to saved Shopify values."
    });
  }
  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (listFilter === "all") return true;
      const validation = getLiveValidation(row);
      const changed = getChangedFieldCount(row, originalById[row.id]) > 0;
      if (listFilter === "unsaved") return changed;
      if (listFilter === "thin_copy") return validation.description.wordCount < 80;
      if (listFilter === "needs_fix") return getIssueItems(validation).length > 0;
      return true;
    });
  }, [rows, listFilter, originalById]);
  return /* @__PURE__ */ jsxs(Fragment, {
    children: [/* @__PURE__ */ jsx("ui-title-bar", {
      title: "Products & Media — Product SEO"
    }), /* @__PURE__ */ jsxs("div", {
      className: "seo-wrap seo-grid",
      children: [/* @__PURE__ */ jsx(WorkspaceSubnav, {
        group: "products"
      }), pageData.configError ? /* @__PURE__ */ jsx("div", {
        className: "error-box",
        children: pageData.configError
      }) : null, /* @__PURE__ */ jsxs("div", {
        className: "toolbar",
        style: {
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 10
        },
        children: [/* @__PURE__ */ jsxs("form", {
          method: "get",
          style: {
            display: "flex",
            gap: 8,
            flex: "1 1 320px",
            alignItems: "center"
          },
          onSubmit: handleSearchSubmit,
          children: [/* @__PURE__ */ jsx("input", {
            className: "seo-input",
            name: "q",
            placeholder: "Search product title...",
            value: searchQuery,
            onChange: (event) => setSearchQuery(event.target.value),
            style: {
              maxWidth: 320
            }
          }), /* @__PURE__ */ jsx("button", {
            className: "seo-button",
            type: "submit",
            disabled: listFetcher.state !== "idle",
            children: listFetcher.state !== "idle" ? "Searching..." : "Search"
          })]
        }), /* @__PURE__ */ jsx("div", {
          className: "filter-pills",
          role: "group",
          "aria-label": "Quick product SEO filter",
          children: [{
            id: "all",
            label: `All (${rows.length})`
          }, {
            id: "needs_fix",
            label: "Needs Fixes"
          }, {
            id: "thin_copy",
            label: "Thin Copy (<80w)"
          }, {
            id: "unsaved",
            label: "Unsaved Drafts"
          }].map((pill) => /* @__PURE__ */ jsx("button", {
            type: "button",
            className: `filter-pill${listFilter === pill.id ? " active" : ""}`,
            onClick: () => setListFilter(pill.id),
            children: pill.label
          }, pill.id))
        })]
      }), ((_a2 = saveFetcher.data) == null ? void 0 : _a2.error) ? /* @__PURE__ */ jsx("div", {
        className: "error-box",
        children: saveFetcher.data.error
      }) : null, ((_b = aiFetcher.data) == null ? void 0 : _b.error) ? /* @__PURE__ */ jsx("div", {
        className: "error-box",
        children: aiFetcher.data.error
      }) : null, !filteredRows.length ? /* @__PURE__ */ jsx("div", {
        className: "empty-box",
        children: "No products found for the current filter."
      }) : /* @__PURE__ */ jsx("div", {
        className: "table-card product-list-card",
        children: /* @__PURE__ */ jsx("div", {
          className: "product-list",
          children: filteredRows.map((row) => {
            var _a3, _b2, _c;
            const validation = getLiveValidation(row);
            const issues = getIssueItems(validation);
            const health = getHealthStatus(validation);
            const signals = evaluateOnPageSeoSignals(row);
            const isOpen = openRowId === row.id;
            const changedCount = getChangedFieldCount(row, originalById[row.id]);
            const titleLen = getLengthState(row.title, {
              min: 25,
              max: 70
            });
            const keywordLen = getLengthState(row.focusKeyword, {
              min: 3,
              max: 40
            });
            const metaTitleLen = getLengthState(row.metaTitle, {
              idealMin: 45,
              idealMax: 60,
              hardMax: 65
            });
            const metaDescriptionLen = getLengthState(row.metaDescription, {
              idealMin: 120,
              idealMax: 155,
              hardMax: 160
            });
            const handleLen = getLengthState(row.handle, {
              min: 3,
              max: 45
            });
            const handleLocked = isHandleLocked(row);
            const isAiBusy = aiFetcher.state !== "idle" && aiRowId === row.id;
            const showPreview = Boolean(previewDescById[row.id]);
            const serpHost = pageData.shop || "your-store.myshopify.com";
            const serpTitle = String(row.metaTitle || row.title || "Untitled Product").trim();
            const serpDesc = String(row.metaDescription || "").trim() || stripHtmlTags(row.descriptionHtml || "").slice(0, 155) || "Add a compelling 120-155 character meta description to improve organic CTR from Google Search.";
            return /* @__PURE__ */ jsxs("article", {
              className: `product-list-item${isOpen ? " open" : ""}`,
              children: [/* @__PURE__ */ jsxs("button", {
                type: "button",
                className: "product-list-head",
                onClick: () => setOpenRowId(isOpen ? "" : row.id),
                children: [/* @__PURE__ */ jsxs("div", {
                  className: "product-head-main",
                  children: [/* @__PURE__ */ jsx("h4", {
                    children: row.title || "Untitled product"
                  }), /* @__PURE__ */ jsxs("small", {
                    children: ["/products/", row.handle || "no-handle", " · ", validation.description.wordCount, " words", row.productType ? ` · ${row.productType}` : ""]
                  })]
                }), /* @__PURE__ */ jsxs("div", {
                  className: "product-head-side",
                  children: [changedCount > 0 ? /* @__PURE__ */ jsxs("span", {
                    className: "issue-chip neutral",
                    title: "You have unsaved edits for this product",
                    children: [changedCount, " Unsaved"]
                  }) : null, /* @__PURE__ */ jsx("span", {
                    className: `live-health-pill ${health.tone}`,
                    children: health.label
                  }), /* @__PURE__ */ jsx("div", {
                    className: "row-issues-box",
                    children: issues.length ? /* @__PURE__ */ jsxs(Fragment, {
                      children: [issues.slice(0, 2).map((issue, index2) => /* @__PURE__ */ jsx("span", {
                        className: `issue-chip ${issue.tone}`,
                        children: issue.tone === "critical" ? "Critical" : "Warning"
                      }, `${row.id}-issue-${index2}`)), issues.length > 2 ? /* @__PURE__ */ jsxs("span", {
                        className: "issue-chip neutral",
                        children: ["+", issues.length - 2]
                      }) : null]
                    }) : /* @__PURE__ */ jsx("span", {
                      className: "issue-chip ok",
                      children: "No issues"
                    })
                  }), /* @__PURE__ */ jsx("span", {
                    className: `dropdown-icon${isOpen ? " open" : ""}`,
                    "aria-hidden": "true",
                    children: "▾"
                  })]
                })]
              }), isOpen ? /* @__PURE__ */ jsxs("div", {
                className: "product-edit-panel",
                children: [/* @__PURE__ */ jsxs("div", {
                  className: "live-health-block",
                  children: [/* @__PURE__ */ jsxs("div", {
                    className: "live-health-head",
                    children: [/* @__PURE__ */ jsxs("strong", {
                      children: ["Live On-Page SEO Score (", signals.passedCount, "/", signals.totalCount, " signals)"]
                    }), /* @__PURE__ */ jsxs("span", {
                      className: `health-text ${health.tone}`,
                      children: [signals.scorePercent, "%"]
                    })]
                  }), /* @__PURE__ */ jsx("div", {
                    className: "live-health-track",
                    children: /* @__PURE__ */ jsx("div", {
                      className: `live-health-bar ${health.tone}`,
                      style: {
                        width: `${signals.scorePercent}%`
                      }
                    })
                  }), /* @__PURE__ */ jsxs("div", {
                    className: "live-info-grid",
                    children: [/* @__PURE__ */ jsx("small", {
                      children: issues.length ? `${issues.length} active issue${issues.length > 1 ? "s" : ""}` : "No active SEO issues."
                    }), /* @__PURE__ */ jsx("small", {
                      children: changedCount ? `${changedCount} unsaved change${changedCount > 1 ? "s" : ""}` : "Synced with Shopify"
                    })]
                  }), /* @__PURE__ */ jsx("div", {
                    className: "signal-chips",
                    children: [{
                      label: "Keyword in Title",
                      passed: signals.keywordInTitle
                    }, {
                      label: "Keyword in Meta Title",
                      passed: signals.keywordInMetaTitle
                    }, {
                      label: "Keyword in Meta Desc",
                      passed: signals.keywordInMetaDescription
                    }, {
                      label: "Keyword in URL",
                      passed: signals.keywordInHandle
                    }, {
                      label: "Keyword in Content",
                      passed: signals.keywordInDescription
                    }, {
                      label: `${validation.description.wordCount}w Content`,
                      passed: validation.description.wordCount >= 80 && validation.description.hasStructure
                    }].map((chip) => /* @__PURE__ */ jsxs("span", {
                      className: `signal-chip ${chip.passed ? "pass" : "miss"}`,
                      children: [chip.passed ? "✓" : "○", " ", chip.label]
                    }, chip.label))
                  })]
                }), /* @__PURE__ */ jsxs("div", {
                  className: "serp-preview-box",
                  "aria-label": "Google search snippet preview",
                  children: [/* @__PURE__ */ jsx("div", {
                    className: "serp-preview-label",
                    children: "Google SERP Live Preview"
                  }), /* @__PURE__ */ jsxs("div", {
                    className: "serp-preview-url",
                    children: ["https://", serpHost, " › products › ", row.handle || "handle"]
                  }), /* @__PURE__ */ jsx("div", {
                    className: "serp-preview-title",
                    children: serpTitle.length > 60 ? `${serpTitle.slice(0, 60)}...` : serpTitle
                  }), /* @__PURE__ */ jsx("div", {
                    className: "serp-preview-desc",
                    children: serpDesc.length > 155 ? `${serpDesc.slice(0, 155)}...` : serpDesc
                  })]
                }), /* @__PURE__ */ jsxs("div", {
                  className: "minor-tune-bar",
                  children: [/* @__PURE__ */ jsxs("div", {
                    className: "minor-tune-buttons",
                    children: [/* @__PURE__ */ jsx("button", {
                      type: "button",
                      className: "seo-button secondary small-btn",
                      onClick: () => applyLocalMinorTuneUp(row),
                      title: "Cleans spaces & populates missing meta/keyword without replacing valid copy",
                      children: "🧹 Quick Minor Tune-Up (Free)"
                    }), /* @__PURE__ */ jsx("button", {
                      type: "button",
                      className: "seo-button secondary small-btn",
                      onClick: () => applyCleanSlug(row),
                      title: "Format URL handle cleanly lowercase-hyphenated",
                      children: "🔗 Format Slug"
                    }), changedCount > 0 ? /* @__PURE__ */ jsxs("button", {
                      type: "button",
                      className: "seo-button secondary small-btn",
                      onClick: () => revertDraft(row.id),
                      children: ["↺ Discard Unsaved (", changedCount, ")"]
                    }) : null]
                  }), /* @__PURE__ */ jsxs("label", {
                    className: "safe-lock-toggle",
                    children: [/* @__PURE__ */ jsx("input", {
                      type: "checkbox",
                      checked: handleLocked,
                      onChange: (event) => setPreserveHandleById((current) => ({
                        ...current,
                        [row.id]: event.target.checked
                      }))
                    }), /* @__PURE__ */ jsx("span", {
                      children: "Lock existing URL handle (skip 301 change)"
                    })]
                  })]
                }), /* @__PURE__ */ jsxs("div", {
                  className: "editor-grid",
                  children: [/* @__PURE__ */ jsxs("label", {
                    className: "editor-field",
                    children: [/* @__PURE__ */ jsx("span", {
                      children: "Product Title"
                    }), /* @__PURE__ */ jsx("input", {
                      className: "seo-input",
                      value: row.title,
                      onChange: (event) => patchRow(row.id, {
                        title: event.target.value
                      })
                    }), /* @__PURE__ */ jsxs("div", {
                      className: "field-meta",
                      children: [/* @__PURE__ */ jsx("small", {
                        className: `counter ${titleLen.tone}`,
                        children: titleLen.label
                      }), /* @__PURE__ */ jsx("small", {
                        className: "field-status",
                        children: fieldStatusMessage(validation.title)
                      })]
                    })]
                  }), /* @__PURE__ */ jsxs("label", {
                    className: "editor-field",
                    children: [/* @__PURE__ */ jsx("span", {
                      children: "Focus Keyword"
                    }), /* @__PURE__ */ jsx("input", {
                      className: "seo-input",
                      value: row.focusKeyword || "",
                      onChange: (event) => patchRow(row.id, {
                        focusKeyword: event.target.value
                      })
                    }), /* @__PURE__ */ jsxs("div", {
                      className: "field-meta",
                      children: [/* @__PURE__ */ jsx("small", {
                        className: `counter ${keywordLen.tone}`,
                        children: keywordLen.label
                      }), /* @__PURE__ */ jsx("small", {
                        className: "field-status",
                        children: fieldStatusMessage(validation.focusKeyword)
                      })]
                    })]
                  }), /* @__PURE__ */ jsxs("label", {
                    className: "editor-field",
                    children: [/* @__PURE__ */ jsx("span", {
                      children: "Meta Title"
                    }), /* @__PURE__ */ jsx("input", {
                      className: "seo-input",
                      value: row.metaTitle,
                      onChange: (event) => patchRow(row.id, {
                        metaTitle: event.target.value
                      })
                    }), /* @__PURE__ */ jsxs("div", {
                      className: "field-meta",
                      children: [/* @__PURE__ */ jsx("small", {
                        className: `counter ${metaTitleLen.tone}`,
                        children: metaTitleLen.label
                      }), /* @__PURE__ */ jsx("small", {
                        className: "field-status",
                        children: fieldStatusMessage(validation.metaTitle)
                      })]
                    })]
                  }), /* @__PURE__ */ jsxs("label", {
                    className: "editor-field",
                    children: [/* @__PURE__ */ jsx("span", {
                      children: "URL Handle"
                    }), /* @__PURE__ */ jsx("input", {
                      className: "seo-input",
                      value: row.handle,
                      onChange: (event) => patchRow(row.id, {
                        handle: event.target.value
                      })
                    }), /* @__PURE__ */ jsxs("div", {
                      className: "field-meta",
                      children: [/* @__PURE__ */ jsx("small", {
                        className: `counter ${handleLen.tone}`,
                        children: handleLen.label
                      }), /* @__PURE__ */ jsx("small", {
                        className: "field-status",
                        children: fieldStatusMessage(validation.handle)
                      })]
                    })]
                  }), /* @__PURE__ */ jsxs("label", {
                    className: "editor-field editor-field-wide",
                    children: [/* @__PURE__ */ jsx("span", {
                      children: "Meta Description"
                    }), /* @__PURE__ */ jsx("textarea", {
                      className: "seo-textarea seo-textarea-compact",
                      rows: 3,
                      value: row.metaDescription,
                      onChange: (event) => patchRow(row.id, {
                        metaDescription: event.target.value
                      })
                    }), /* @__PURE__ */ jsxs("div", {
                      className: "field-meta",
                      children: [/* @__PURE__ */ jsx("small", {
                        className: `counter ${metaDescriptionLen.tone}`,
                        children: metaDescriptionLen.label
                      }), /* @__PURE__ */ jsx("small", {
                        className: "field-status",
                        children: fieldStatusMessage(validation.metaDescription)
                      })]
                    })]
                  }), /* @__PURE__ */ jsxs("div", {
                    className: "editor-field editor-field-wide",
                    children: [/* @__PURE__ */ jsxs("div", {
                      className: "content-editor-header",
                      children: [/* @__PURE__ */ jsx("span", {
                        children: "Product Description Content (Shopify HTML)"
                      }), /* @__PURE__ */ jsxs("div", {
                        className: "content-ai-bar",
                        children: [/* @__PURE__ */ jsx("button", {
                          type: "button",
                          className: `filter-pill${!showPreview ? " active" : ""}`,
                          onClick: () => setPreviewDescById((c) => ({
                            ...c,
                            [row.id]: false
                          })),
                          children: "HTML Edit"
                        }), /* @__PURE__ */ jsx("button", {
                          type: "button",
                          className: `filter-pill${showPreview ? " active" : ""}`,
                          onClick: () => setPreviewDescById((c) => ({
                            ...c,
                            [row.id]: true
                          })),
                          children: "Preview"
                        }), /* @__PURE__ */ jsxs(Fragment, {
                          children: [/* @__PURE__ */ jsx("button", {
                            type: "button",
                            className: "seo-button secondary small-btn",
                            disabled: isAiBusy,
                            onClick: () => runAiContentFix(row, "polish"),
                            title: `Minor grammar & natural keyword polish preserving specs (${CREDIT_COSTS.product_content_fix} tokens)`,
                            children: isAiBusy && aiActionLabel === "content_polish" ? "Polishing..." : `✨ Polish Copy (${CREDIT_COSTS.product_content_fix} tok)`
                          }), /* @__PURE__ */ jsx("button", {
                            type: "button",
                            className: "seo-button secondary small-btn",
                            disabled: isAiBusy,
                            onClick: () => runAiContentFix(row, "structure"),
                            title: `Add H3 headings & scannable bullets without altering facts (${CREDIT_COSTS.product_content_fix} tokens)`,
                            children: isAiBusy && aiActionLabel === "content_structure" ? "Formatting..." : `📝 Add Bullets (${CREDIT_COSTS.product_content_fix} tok)`
                          }), /* @__PURE__ */ jsx("button", {
                            type: "button",
                            className: "seo-button secondary small-btn",
                            disabled: isAiBusy,
                            onClick: () => runAiContentFix(row, "expand"),
                            title: `Write complete 120-190w conversion SEO copy from product details (${CREDIT_COSTS.product_content_expand} tokens)`,
                            children: isAiBusy && aiActionLabel === "content_expand" ? "Writing..." : `✍️ Write Full Copy (${CREDIT_COSTS.product_content_expand} tok)`
                          })]
                        })]
                      })]
                    }), showPreview ? /* @__PURE__ */ jsx("div", {
                      className: "description-preview-box",
                      dangerouslySetInnerHTML: {
                        __html: sanitizeProductDescriptionHtml(row.descriptionHtml || "") || "<p><em>No product description yet. Use AI Write Full Copy or switch to HTML Edit.</em></p>"
                      }
                    }) : /* @__PURE__ */ jsx("textarea", {
                      className: "seo-textarea",
                      rows: 6,
                      placeholder: "<p>Write SEO-rich product overview, <h3>Key Features</h3>, and bullet highlights...</p>",
                      value: row.descriptionHtml || "",
                      onChange: (event) => patchRow(row.id, {
                        descriptionHtml: event.target.value
                      })
                    }), /* @__PURE__ */ jsxs("div", {
                      className: "field-meta",
                      children: [/* @__PURE__ */ jsxs("small", {
                        className: `counter ${validation.description.ideal ? "good" : validation.description.valid ? "warning" : "critical"}`,
                        children: [validation.description.wordCount, " words", validation.description.hasStructure ? " · Structured HTML" : " · Plain text", validation.description.hasKeyword ? " · Keyword present" : ""]
                      }), /* @__PURE__ */ jsx("small", {
                        className: "field-status",
                        children: validation.description.message || "Strong scannable on-page product copy."
                      })]
                    })]
                  })]
                }), aiNotesById[row.id] ? /* @__PURE__ */ jsxs("div", {
                  className: "status-banner banner-info",
                  "data-no-toast": "true",
                  children: [/* @__PURE__ */ jsx("strong", {
                    children: "Gemini SEO Note:"
                  }), " ", aiNotesById[row.id]]
                }) : null, issues.length ? /* @__PURE__ */ jsx("div", {
                  className: "live-issues-area",
                  children: issues.map((issue, index2) => /* @__PURE__ */ jsx("p", {
                    className: `live-issue-line ${issue.tone}`,
                    children: issue.label
                  }, `${row.id}-detail-${index2}`))
                }) : null, auditResultsById[row.id] ? /* @__PURE__ */ jsx(AiDiffInspector, {
                  auditResult: auditResultsById[row.id]
                }) : null, /* @__PURE__ */ jsxs("div", {
                  className: "row-actions",
                  children: [/* @__PURE__ */ jsxs(Fragment, {
                    children: [/* @__PURE__ */ jsx("button", {
                      className: "seo-button secondary",
                      type: "button",
                      onClick: () => runAiFix(row, "minor"),
                      disabled: isAiBusy,
                      title: `Gentle surgical refinement: fixes weak meta/keywords & light content polish without full rewrite (${CREDIT_COSTS.product_seo_minor} tokens)`,
                      children: isAiBusy && aiActionLabel === "minor" ? "Polishing..." : `✨ AI Minor Polish (${CREDIT_COSTS.product_seo_minor} tok)`
                    }), /* @__PURE__ */ jsx("button", {
                      className: "seo-button secondary",
                      type: "button",
                      onClick: () => runAiFix(row, "full"),
                      disabled: isAiBusy,
                      title: `Optimizes title, keyword, metadata & writes rich structured description HTML (${CREDIT_COSTS.product_seo_fix} tokens)`,
                      children: isAiBusy && aiActionLabel === "full" ? "Generating..." : `⚡ AI Full SEO + Content (${CREDIT_COSTS.product_seo_fix} tok)`
                    }), /* @__PURE__ */ jsx("button", {
                      className: "seo-button secondary",
                      type: "button",
                      onClick: () => runAiAudit(row),
                      disabled: isAiBusy,
                      title: `Audits proposed changes, projected CTR and warns of SEO risks (${CREDIT_COSTS.audit_change} tokens)`,
                      children: isAiBusy && aiActionLabel === "audit" ? "Auditing..." : `🤖 Gemini Diff Audit (${CREDIT_COSTS.audit_change} tok)`
                    })]
                  }), /* @__PURE__ */ jsx("button", {
                    className: "seo-button",
                    type: "button",
                    onClick: () => saveRow(row),
                    disabled: saveFetcher.state !== "idle" && savingRowId === row.id,
                    children: saveFetcher.state !== "idle" && savingRowId === row.id ? "Saving..." : changedCount > 0 ? `Save Changes (${changedCount})` : "Save Product SEO"
                  }), /* @__PURE__ */ jsx(Link, {
                    to: "/app/seo-audit",
                    children: "Open SEO Audit"
                  })]
                }), ((_a3 = saveFetcher.data) == null ? void 0 : _a3.ok) && saveFetcher.data.redirectCreated ? /* @__PURE__ */ jsx("div", {
                  style: {
                    background: "#ddf7ea",
                    color: "var(--seo-good)",
                    padding: "8px 12px",
                    borderRadius: 6,
                    fontSize: 13,
                    marginTop: 8
                  },
                  children: "🛡️ 301 URL Redirect automatically created in Shopify to protect your Google rankings!"
                }) : null, ((_b2 = aiFetcher.data) == null ? void 0 : _b2.outOfCredits) ? /* @__PURE__ */ jsxs("div", {
                  className: "error-box",
                  "data-no-toast": "true",
                  style: {
                    marginTop: 8
                  },
                  children: [aiFetcher.data.error, " ", /* @__PURE__ */ jsx(Link, {
                    to: "/app/billing",
                    children: "Upgrade to Pro"
                  })]
                }) : null, ((_c = aiFetcher.data) == null ? void 0 : _c.creditsRemaining) !== void 0 && lastAiAppliedRowId === row.id ? /* @__PURE__ */ jsx("small", {
                  style: {
                    color: "var(--seo-primary)",
                    display: "block",
                    marginTop: 4
                  },
                  children: aiFetcher.data.superAccess || aiFetcher.data.creditsDeducted === 0 ? "★ Super Access active (0 tokens deducted)." : `⚡ Deducted ${aiFetcher.data.creditsDeducted} token(s). Balance: ${aiFetcher.data.creditsRemaining} remaining.`
                }) : null]
              }) : null]
            }, row.id);
          })
        })
      }), /* @__PURE__ */ jsxs("div", {
        className: "toolbar",
        children: [/* @__PURE__ */ jsx("small", {
          children: "Showing 20 products per page"
        }), pageData.pagination.previousPageInfo ? /* @__PURE__ */ jsx("button", {
          className: "seo-button",
          type: "button",
          onClick: () => loadList(pageData.query || "", pageData.pagination.previousPageInfo),
          disabled: listFetcher.state !== "idle",
          children: "Previous page"
        }) : null, pageData.pagination.nextPageInfo ? /* @__PURE__ */ jsx("button", {
          className: "seo-button",
          type: "button",
          onClick: () => loadList(pageData.query || "", pageData.pagination.nextPageInfo),
          disabled: listFetcher.state !== "idle",
          children: "Next page"
        }) : null]
      })]
    })]
  });
});
const route23 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$5,
  default: app_products,
  links: links$5,
  loader: loader$7,
  shouldRevalidate
}, Symbol.toStringTag, { value: "Module" }));
const loader$6 = async () => {
  return redirect("/app");
};
const app_settings = UNSAFE_withComponentProps(function SettingsRemovedRoute() {
  return null;
});
const route24 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: app_settings,
  loader: loader$6
}, Symbol.toStringTag, { value: "Module" }));
const PLAN_PRO$1 = "Ecom SEO Pro";
const links$4 = () => [{
  rel: "stylesheet",
  href: seoStyles
}];
const loader$5 = async ({
  request
}) => {
  const {
    admin,
    shop,
    token,
    apiVersion,
    configError
  } = await requireShopContext(request);
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
      usageHistory: []
    };
  }
  let activeSubscriptions = [];
  let billingLoadError = "";
  try {
    activeSubscriptions = await getActiveAppSubscriptions({
      admin,
      storeDomain: shop,
      token,
      apiVersion
    });
  } catch (err) {
    billingLoadError = (err == null ? void 0 : err.message) || "";
  }
  const subscription = activeSubscriptions[0] || null;
  const isSubscribed = Boolean(subscription);
  let creditAccount = null;
  let usageHistory = [];
  let storeControl = null;
  if (shop) {
    storeControl = await getOrCreateStoreControl(shop);
    const effectivePro = isSubscribed || Boolean(storeControl == null ? void 0 : storeControl.superAccess);
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
    hasSuperAccess: Boolean(storeControl == null ? void 0 : storeControl.superAccess),
    activeAiModelLabel: formatGeminiModelName(platformAi.model || DEFAULT_GEMINI_MODEL),
    subscription,
    planName: (subscription == null ? void 0 : subscription.name) || (isSubscribed || (storeControl == null ? void 0 : storeControl.superAccess) ? "Ecom SEO Pro" : "Ecom SEO Free"),
    creditAccount: creditAccount ? {
      plan: creditAccount.plan,
      totalCredits: creditAccount.totalCredits,
      bonusCredits: creditAccount.bonusCredits,
      availableCredits: creditAccount.availableCredits,
      effectiveTotal: creditAccount.effectiveTotal,
      usedCredits: creditAccount.usedCredits,
      percentUsed: creditAccount.percentUsed,
      cycleResetAt: creditAccount.cycleResetAt
    } : null,
    creditCosts: CREDIT_COSTS,
    usageHistory
  };
};
const action$4 = async ({
  request
}) => {
  const formData = await request.formData();
  const intent = formData.get("intent");
  const url = new URL(request.url);
  if (intent !== "trial" && intent !== "pro" && intent !== "cancel" && intent !== "buyPack") {
    return redirect(`/app/billing${url.search}`);
  }
  const {
    admin,
    shop,
    token,
    apiVersion,
    configError
  } = await requireShopContext(request);
  if (configError) return {
    ok: false,
    error: configError
  };
  try {
    if (intent === "cancel") {
      const activeSubscriptions = await getActiveAppSubscriptions({
        admin,
        storeDomain: shop,
        token,
        apiVersion
      });
      const subscription = activeSubscriptions[0];
      if (subscription) {
        await cancelAppSubscription({
          admin,
          storeDomain: shop,
          token,
          apiVersion,
          subscriptionId: subscription.id
        });
      }
      const control = shop ? await getOrCreateStoreControl(shop) : null;
      if (shop && !(control == null ? void 0 : control.superAccess)) {
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
      apiVersion
    });
    if (intent === "buyPack") {
      const pkg = getTokenPackageById(formData.get("packageId"));
      const packReturnUrl = `https://${shop}/admin/apps/${process.env.SHOPIFY_API_KEY}/app/billing/return?package=${encodeURIComponent(pkg.id)}`;
      const {
        confirmationUrl: confirmationUrl2
      } = await createCreditPackPurchase({
        admin,
        storeDomain: shop,
        token,
        apiVersion,
        returnUrl: packReturnUrl,
        currencyCode,
        amount: pkg.price,
        packName: pkg.packName,
        test
      });
      return {
        externalRedirect: confirmationUrl2
      };
    }
    if (intent === "trial") {
      const {
        confirmationUrl: confirmationUrl2
      } = await createProSubscription({
        admin,
        storeDomain: shop,
        token,
        apiVersion,
        returnUrl,
        currencyCode,
        trialDays: 7,
        test
      });
      return {
        externalRedirect: confirmationUrl2
      };
    }
    const {
      confirmationUrl
    } = await createProSubscription({
      admin,
      storeDomain: shop,
      token,
      apiVersion,
      returnUrl,
      currencyCode,
      trialDays: 0,
      test
    });
    return {
      externalRedirect: confirmationUrl
    };
  } catch (error) {
    return {
      ok: false,
      error: (error == null ? void 0 : error.message) || "Unable to complete Shopify billing request."
    };
  }
};
const CREDIT_COST_ITEMS = [{
  key: "meta_fix",
  label: "Meta Tag Fix",
  defaultCost: CREDIT_COSTS.meta_fix
}, {
  key: "product_content_fix",
  label: "AI Copy Polish / Bullets",
  defaultCost: CREDIT_COSTS.product_content_fix
}, {
  key: "product_content_expand",
  label: "Full AI Description (120–190w)",
  defaultCost: CREDIT_COSTS.product_content_expand
}, {
  key: "robots_txt_improvement",
  label: "AI Robots.txt Rules",
  defaultCost: CREDIT_COSTS.robots_txt_improvement
}, {
  key: "product_seo_minor",
  label: "Product SEO Minor Polish",
  defaultCost: CREDIT_COSTS.product_seo_minor
}, {
  key: "product_seo_fix",
  label: "Full Product SEO + Content",
  defaultCost: CREDIT_COSTS.product_seo_fix
}, {
  key: "audit_change",
  label: "Gemini Diff Audit",
  defaultCost: CREDIT_COSTS.audit_change
}, {
  key: "vision_alt",
  label: "Vision Image ALT",
  defaultCost: CREDIT_COSTS.vision_alt
}, {
  key: "pagespeed_ai_fix",
  label: "PageSpeed AI Fix Plan",
  defaultCost: CREDIT_COSTS.pagespeed_ai_fix
}, {
  key: "catalog_cannibalization",
  label: "Cannibalization Resolver",
  defaultCost: CREDIT_COSTS.catalog_cannibalization
}, {
  key: "store_copilot",
  label: "Executive Copilot Brief",
  defaultCost: CREDIT_COSTS.store_copilot
}];
const app_billing = UNSAFE_withComponentProps(function BillingPage() {
  var _a2, _b;
  const {
    configError,
    isSubscribed,
    hasSuperAccess,
    activeAiModelLabel,
    subscription,
    planName,
    creditAccount,
    creditCosts = {},
    usageHistory
  } = useLoaderData();
  const navigation = useNavigation();
  const submitting = navigation.state === "submitting";
  const actionData = useActionData();
  const location = useLocation();
  const submittingIntent = (_a2 = navigation.formData) == null ? void 0 : _a2.get("intent");
  const submittingPackageId = (_b = navigation.formData) == null ? void 0 : _b.get("packageId");
  useEffect(() => {
    if (actionData && actionData.externalRedirect) {
      (window.top || window).location.href = actionData.externalRedirect;
    } else if (actionData == null ? void 0 : actionData.error) {
      showToast({
        tone: "error",
        title: "Billing Notice",
        message: actionData.error
      });
    }
  }, [actionData]);
  const isPro = isSubscribed && planName === PLAN_PRO$1;
  const hasTrial = isPro && ((subscription == null ? void 0 : subscription.trialDays) ?? 0) > 0;
  const status = (subscription == null ? void 0 : subscription.status) || (isSubscribed ? "ACTIVE" : "FREE");
  const available = (creditAccount == null ? void 0 : creditAccount.availableCredits) ?? 0;
  const effectiveTotal = (creditAccount == null ? void 0 : creditAccount.effectiveTotal) ?? PLAN_ALLOWANCES.FREE;
  const baseQuota = (creditAccount == null ? void 0 : creditAccount.totalCredits) ?? PLAN_ALLOWANCES.FREE;
  const bonusCredits = (creditAccount == null ? void 0 : creditAccount.bonusCredits) ?? 0;
  const usedCredits = (creditAccount == null ? void 0 : creditAccount.usedCredits) ?? 0;
  const percentUsed = (creditAccount == null ? void 0 : creditAccount.percentUsed) ?? 0;
  const remainingPercent = effectiveTotal > 0 ? Math.max(0, Math.min(100, Math.round(available / effectiveTotal * 100))) : 0;
  return /* @__PURE__ */ jsxs(Fragment, {
    children: [/* @__PURE__ */ jsx("ui-title-bar", {
      title: "Subscription"
    }), /* @__PURE__ */ jsxs("div", {
      className: "seo-wrap seo-grid",
      children: [/* @__PURE__ */ jsx("section", {
        className: "workspace-header-card",
        children: /* @__PURE__ */ jsxs("div", {
          className: "workspace-header-top",
          children: [/* @__PURE__ */ jsxs("div", {
            style: {
              display: "grid",
              gap: 4
            },
            children: [/* @__PURE__ */ jsx("h1", {
              className: "page-title",
              style: {
                fontSize: 20
              },
              children: "Billing & AI Token Hub"
            }), /* @__PURE__ */ jsx("p", {
              className: "seo-muted",
              style: {
                fontSize: 13
              },
              children: "Monitor monthly AI token allowances, non-expiring top-up packages, per-action token costs, and usage logs."
            })]
          }), /* @__PURE__ */ jsxs("div", {
            className: "button-row",
            children: [/* @__PURE__ */ jsx(Link, {
              to: `/app${location.search}`,
              className: "seo-button secondary",
              style: {
                padding: "6px 12px",
                fontSize: 12
              },
              children: "← Home Checklist"
            }), /* @__PURE__ */ jsx(Link, {
              to: `/app/seo-audit${location.search}`,
              className: "seo-button",
              style: {
                padding: "6px 12px",
                fontSize: 12
              },
              children: "AI Audit & Auto-Fix"
            })]
          })]
        })
      }), configError ? /* @__PURE__ */ jsx("div", {
        className: "error-box",
        children: configError
      }) : null, (actionData == null ? void 0 : actionData.error) ? /* @__PURE__ */ jsx("div", {
        className: "error-box",
        children: actionData.error
      }) : null, /* @__PURE__ */ jsxs("div", {
        className: "section-card",
        children: [/* @__PURE__ */ jsxs("div", {
          className: "toolbar",
          style: {
            justifyContent: "space-between",
            marginBottom: 14
          },
          children: [/* @__PURE__ */ jsxs("div", {
            children: [/* @__PURE__ */ jsxs("h3", {
              style: {
                margin: 0,
                display: "flex",
                alignItems: "center",
                gap: 8,
                flexWrap: "wrap"
              },
              children: [/* @__PURE__ */ jsx("span", {
                children: "⚡ AI Token Balance"
              }), /* @__PURE__ */ jsx("span", {
                className: `pill ${hasSuperAccess || (creditAccount == null ? void 0 : creditAccount.plan) === "PRO" ? "pill-good" : "pill-info"}`,
                children: hasSuperAccess ? "SUPER ACCESS (UNLIMITED)" : (creditAccount == null ? void 0 : creditAccount.plan) === "PRO" ? isSubscribed ? "PRO PLAN" : "PRO QUOTA" : "FREE PLAN"
              })]
            }), /* @__PURE__ */ jsx("p", {
              className: "metric-help",
              style: {
                margin: "4px 0 0 0"
              },
              children: hasSuperAccess ? "Administrator Super Access is enabled for this store — AI tools run without consuming tokens." : "AI actions deduct tokens based on prompt & model effort. Monthly allowances replenish automatically; purchased token packages never expire."
            })]
          }), /* @__PURE__ */ jsxs("div", {
            style: {
              textAlign: "right"
            },
            children: [/* @__PURE__ */ jsx("h2", {
              style: {
                margin: 0,
                color: hasSuperAccess ? "#4338ca" : "var(--seo-primary)"
              },
              children: hasSuperAccess ? "Unlimited" : /* @__PURE__ */ jsxs(Fragment, {
                children: [available, " ", /* @__PURE__ */ jsxs("span", {
                  style: {
                    fontSize: 14,
                    color: "var(--seo-muted)"
                  },
                  children: ["/ ", effectiveTotal]
                })]
              })
            }), /* @__PURE__ */ jsx("small", {
              style: {
                color: "var(--seo-muted)"
              },
              children: hasSuperAccess ? "Super Access Active" : `${usedCredits} used (${percentUsed}%) this cycle`
            })]
          })]
        }), /* @__PURE__ */ jsx("div", {
          style: {
            background: "var(--seo-border-soft)",
            borderRadius: 6,
            height: 10,
            overflow: "hidden",
            marginBottom: 16
          },
          title: hasSuperAccess ? "Unlimited AI usage via Super Access" : `${available} of ${effectiveTotal} credits remaining (${remainingPercent}%)`,
          children: /* @__PURE__ */ jsx("div", {
            style: {
              width: `${hasSuperAccess ? 100 : remainingPercent}%`,
              background: hasSuperAccess ? "#4f46e5" : available <= 3 ? "var(--seo-bad)" : percentUsed > 85 ? "#d97706" : "var(--seo-primary)",
              height: "100%",
              transition: "width 0.3s ease"
            }
          })
        }), /* @__PURE__ */ jsxs("div", {
          className: "seo-grid grid-4",
          style: {
            marginBottom: 16
          },
          children: [/* @__PURE__ */ jsxs("div", {
            className: "metric-card",
            style: {
              padding: 12
            },
            children: [/* @__PURE__ */ jsx("p", {
              className: "metric-label",
              style: {
                fontSize: 11
              },
              children: "Available Now"
            }), /* @__PURE__ */ jsx("h4", {
              style: {
                margin: "4px 0 0 0",
                color: hasSuperAccess ? "#4338ca" : "var(--seo-primary)"
              },
              children: hasSuperAccess ? "Unlimited ★" : `${available} tok`
            })]
          }), /* @__PURE__ */ jsxs("div", {
            className: "metric-card",
            style: {
              padding: 12
            },
            children: [/* @__PURE__ */ jsx("p", {
              className: "metric-label",
              style: {
                fontSize: 11
              },
              children: "Used This Cycle"
            }), /* @__PURE__ */ jsxs("h4", {
              style: {
                margin: "4px 0 0 0"
              },
              children: [usedCredits, " tok"]
            })]
          }), /* @__PURE__ */ jsxs("div", {
            className: "metric-card",
            style: {
              padding: 12
            },
            children: [/* @__PURE__ */ jsx("p", {
              className: "metric-label",
              style: {
                fontSize: 11
              },
              children: "Monthly + Bonus Quota"
            }), /* @__PURE__ */ jsxs("h4", {
              style: {
                margin: "4px 0 0 0",
                fontSize: 14
              },
              children: [baseQuota, " ", bonusCredits > 0 ? /* @__PURE__ */ jsxs("span", {
                style: {
                  color: "var(--seo-good)"
                },
                children: ["+ ", bonusCredits, " bonus"]
              }) : ""]
            })]
          }), /* @__PURE__ */ jsxs("div", {
            className: "metric-card",
            style: {
              padding: 12
            },
            children: [/* @__PURE__ */ jsx("p", {
              className: "metric-label",
              style: {
                fontSize: 11
              },
              children: "Replenishes · Model"
            }), /* @__PURE__ */ jsxs("h4", {
              style: {
                margin: "4px 0 0 0",
                fontSize: 12.5
              },
              children: [(creditAccount == null ? void 0 : creditAccount.cycleResetAt) ? new Date(creditAccount.cycleResetAt).toLocaleDateString() : "Next month", " · ", activeAiModelLabel || "Gemini"]
            })]
          })]
        }), /* @__PURE__ */ jsxs("div", {
          style: {
            background: "var(--seo-bg-accent)",
            padding: "12px 14px",
            borderRadius: 8
          },
          children: [/* @__PURE__ */ jsx("div", {
            style: {
              fontSize: 12,
              fontWeight: 700,
              marginBottom: 8,
              color: "var(--seo-ink)"
            },
            children: "Token Cost Per AI Action:"
          }), /* @__PURE__ */ jsx("div", {
            className: "credit-cost-grid",
            children: CREDIT_COST_ITEMS.map((item) => {
              const cost = creditCosts[item.key] ?? item.defaultCost;
              return /* @__PURE__ */ jsxs("span", {
                className: "credit-cost-chip",
                children: [/* @__PURE__ */ jsx("span", {
                  children: item.label
                }), /* @__PURE__ */ jsxs("strong", {
                  children: [cost, " tok"]
                })]
              }, item.key);
            })
          })]
        })]
      }), !hasSuperAccess ? /* @__PURE__ */ jsxs("div", {
        id: "packages",
        className: "section-card",
        children: [/* @__PURE__ */ jsxs("div", {
          className: "toolbar",
          style: {
            justifyContent: "space-between",
            marginBottom: 14
          },
          children: [/* @__PURE__ */ jsxs("div", {
            children: [/* @__PURE__ */ jsx("h4", {
              style: {
                margin: 0
              },
              children: "⚡ Need extra AI Tokens?"
            }), /* @__PURE__ */ jsx("p", {
              className: "metric-help",
              style: {
                margin: "4px 0 0 0"
              },
              children: "Choose a one-time top-up package. Purchased tokens never expire and stack on top of your monthly allowance."
            })]
          }), /* @__PURE__ */ jsx("span", {
            className: "pill pill-info",
            children: "Non-expiring top-ups"
          })]
        }), /* @__PURE__ */ jsx("div", {
          className: "seo-grid grid-3",
          style: {
            gap: 14
          },
          children: TOKEN_PACKAGES.map((pkg) => {
            const isBuyingThis = submitting && submittingIntent === "buyPack" && submittingPackageId === pkg.id;
            return /* @__PURE__ */ jsxs("div", {
              className: "metric-card",
              style: {
                padding: 18,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: 12,
                border: pkg.featured ? "2px solid var(--seo-primary)" : "1px solid var(--seo-border-soft)",
                background: pkg.featured ? "var(--seo-bg-accent)" : "#fff"
              },
              children: [/* @__PURE__ */ jsxs("div", {
                children: [/* @__PURE__ */ jsxs("div", {
                  style: {
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 8
                  },
                  children: [/* @__PURE__ */ jsx("span", {
                    className: `pill ${pkg.featured ? "pill-good" : "pill-info"}`,
                    style: {
                      fontSize: 11
                    },
                    children: pkg.tag
                  }), /* @__PURE__ */ jsx("span", {
                    style: {
                      fontSize: 11,
                      color: "var(--seo-muted)"
                    },
                    children: pkg.pricePerToken
                  })]
                }), /* @__PURE__ */ jsxs("div", {
                  style: {
                    fontSize: 22,
                    fontWeight: 700,
                    color: "var(--seo-ink)"
                  },
                  children: ["+", pkg.tokens, " Tokens"]
                }), /* @__PURE__ */ jsxs("div", {
                  style: {
                    fontSize: 20,
                    fontWeight: 700,
                    color: "var(--seo-primary)",
                    marginTop: 4
                  },
                  children: ["$", pkg.price, " ", /* @__PURE__ */ jsx("span", {
                    style: {
                      fontSize: 12,
                      fontWeight: 400,
                      color: "var(--seo-muted)"
                    },
                    children: "one-time"
                  })]
                })]
              }), /* @__PURE__ */ jsxs(Form, {
                method: "post",
                children: [/* @__PURE__ */ jsx("input", {
                  type: "hidden",
                  name: "intent",
                  value: "buyPack"
                }), /* @__PURE__ */ jsx("input", {
                  type: "hidden",
                  name: "packageId",
                  value: pkg.id
                }), /* @__PURE__ */ jsx("button", {
                  type: "submit",
                  className: `seo-button${pkg.featured ? "" : " secondary"}`,
                  disabled: submitting,
                  style: {
                    width: "100%"
                  },
                  children: isBuyingThis ? "Redirecting…" : `Buy ${pkg.tokens} Tokens ($${pkg.price})`
                })]
              })]
            }, pkg.id);
          })
        })]
      }) : null, hasSuperAccess && !isSubscribed ? /* @__PURE__ */ jsx("div", {
        className: "section-card",
        style: {
          borderColor: "#c7d2fe",
          background: "#f8faff"
        },
        children: /* @__PURE__ */ jsxs("div", {
          className: "toolbar",
          style: {
            justifyContent: "space-between",
            margin: 0
          },
          children: [/* @__PURE__ */ jsxs("div", {
            children: [/* @__PURE__ */ jsx("h3", {
              style: {
                margin: 0,
                color: "#3730a3"
              },
              children: "★ Super Access Active"
            }), /* @__PURE__ */ jsx("p", {
              className: "metric-help",
              style: {
                margin: "6px 0 0 0"
              },
              children: "Your store has Administrator Super Access enabled, giving unlimited access to all AI SEO fixes, Gemini Vision ALT optimization, Diff Audit, and Autopilot without token deductions."
            })]
          }), /* @__PURE__ */ jsx(Link, {
            to: `/app${location.search}`,
            className: "seo-button",
            children: "Dashboard"
          })]
        })
      }) : isSubscribed ? /* @__PURE__ */ jsxs("div", {
        className: "plan-active-card",
        style: {
          maxWidth: "100%"
        },
        children: [/* @__PURE__ */ jsxs("div", {
          className: "plan-header",
          children: [/* @__PURE__ */ jsx("span", {
            className: "plan-icon",
            children: "🚀"
          }), /* @__PURE__ */ jsx("h2", {
            className: "plan-active-name",
            children: "Ecom SEO Pro Active"
          })]
        }), /* @__PURE__ */ jsx("hr", {
          className: "plan-divider"
        }), /* @__PURE__ */ jsxs("div", {
          className: "plan-status-row",
          children: [/* @__PURE__ */ jsx("span", {
            className: `plan-status-pill ${hasTrial ? "trial" : "active"}`,
            children: hasTrial ? `Trial — ${subscription.trialDays} days left` : status
          }), /* @__PURE__ */ jsxs("p", {
            className: "metric-help",
            style: {
              margin: 0
            },
            children: ["$12 / month (", baseQuota, " AI Tokens / mo)"]
          })]
        }), /* @__PURE__ */ jsxs("p", {
          className: "metric-help",
          children: ["You have an active Pro subscription with ", baseQuota, " monthly AI tokens and unlimited catalog scanning."]
        }), /* @__PURE__ */ jsxs("div", {
          className: "toolbar",
          style: {
            gap: 12
          },
          children: [/* @__PURE__ */ jsx(Link, {
            to: `/app${location.search}`,
            className: "seo-button",
            children: "Dashboard"
          }), /* @__PURE__ */ jsxs(Form, {
            method: "post",
            children: [/* @__PURE__ */ jsx("input", {
              type: "hidden",
              name: "intent",
              value: "cancel"
            }), /* @__PURE__ */ jsx("button", {
              type: "submit",
              className: "seo-button",
              style: {
                backgroundColor: "#d9534f",
                borderColor: "#d43f3a"
              },
              disabled: submitting,
              children: submitting && submittingIntent === "cancel" ? "Canceling..." : "Cancel Subscription"
            })]
          })]
        })]
      }) : (creditAccount == null ? void 0 : creditAccount.plan) === "PRO" ? /* @__PURE__ */ jsxs("div", {
        className: "plan-active-card",
        style: {
          maxWidth: "100%"
        },
        children: [/* @__PURE__ */ jsxs("div", {
          className: "plan-header",
          children: [/* @__PURE__ */ jsx("span", {
            className: "plan-icon",
            children: "🚀"
          }), /* @__PURE__ */ jsx("h2", {
            className: "plan-active-name",
            children: "Pro Token Quota Active"
          })]
        }), /* @__PURE__ */ jsx("hr", {
          className: "plan-divider"
        }), /* @__PURE__ */ jsxs("div", {
          className: "plan-status-row",
          children: [/* @__PURE__ */ jsx("span", {
            className: "plan-status-pill active",
            children: "ADMIN MANAGED PRO"
          }), /* @__PURE__ */ jsxs("p", {
            className: "metric-help",
            style: {
              margin: 0
            },
            children: [baseQuota, " Monthly AI Tokens", bonusCredits > 0 ? ` + ${bonusCredits} Bonus Tokens` : ""]
          })]
        }), /* @__PURE__ */ jsx("p", {
          className: "metric-help",
          children: "Your store is already provisioned on the PRO token tier by an administrator."
        }), /* @__PURE__ */ jsxs("div", {
          className: "toolbar",
          style: {
            gap: 12
          },
          children: [/* @__PURE__ */ jsx(Link, {
            to: `/app${location.search}`,
            className: "seo-button",
            children: "Dashboard"
          }), /* @__PURE__ */ jsx(Link, {
            to: `/app/products${location.search}`,
            className: "seo-button secondary",
            children: "Optimize Products"
          })]
        })]
      }) : /* @__PURE__ */ jsx("div", {
        className: "section-card",
        style: {
          padding: 0,
          overflow: "hidden",
          border: "2px solid var(--seo-primary)"
        },
        children: /* @__PURE__ */ jsxs("div", {
          className: "seo-grid grid-2",
          style: {
            gap: 0
          },
          children: [/* @__PURE__ */ jsxs("div", {
            style: {
              padding: "32px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center"
            },
            children: [/* @__PURE__ */ jsx("span", {
              className: "pill pill-info",
              style: {
                alignSelf: "flex-start",
                marginBottom: 12,
                background: "var(--seo-primary)",
                color: "#fff"
              },
              children: "7 Days Free Trial"
            }), /* @__PURE__ */ jsx("h3", {
              style: {
                margin: "0 0 8px 0",
                fontSize: "26px",
                color: "var(--seo-ink)"
              },
              children: "Upgrade to Ecom SEO Pro"
            }), /* @__PURE__ */ jsxs("p", {
              style: {
                margin: 0,
                fontSize: "30px",
                fontWeight: "700",
                color: "var(--seo-primary)"
              },
              children: ["$12 ", /* @__PURE__ */ jsx("span", {
                style: {
                  fontSize: "15px",
                  fontWeight: "normal",
                  color: "var(--seo-muted)"
                },
                children: "/ month"
              })]
            }), /* @__PURE__ */ jsxs("p", {
              className: "metric-help",
              style: {
                marginTop: "12px",
                fontSize: "14px"
              },
              children: ["Get ", PLAN_ALLOWANCES.PRO, " AI tokens every month, automated 301 URL redirect safety, multimodal vision image alt optimizer, and unlimited store audits."]
            }), /* @__PURE__ */ jsxs("div", {
              className: "plan-cta",
              style: {
                marginTop: 20
              },
              children: [/* @__PURE__ */ jsxs(Form, {
                method: "post",
                children: [/* @__PURE__ */ jsx("input", {
                  type: "hidden",
                  name: "intent",
                  value: "trial"
                }), /* @__PURE__ */ jsx("button", {
                  className: "seo-button",
                  type: "submit",
                  disabled: submitting,
                  style: {
                    width: "100%",
                    padding: "14px",
                    fontSize: "16px"
                  },
                  children: submitting && submittingIntent === "trial" ? "Redirecting to Shopify…" : `Start 7-Day Free Trial (${PLAN_ALLOWANCES.PRO} Tokens/mo)`
                })]
              }), /* @__PURE__ */ jsx("p", {
                className: "metric-help",
                style: {
                  fontSize: "12px",
                  textAlign: "center",
                  marginTop: "10px"
                },
                children: "Auto-renews at $12/mo after trial. Cancel anytime with one click."
              })]
            })]
          }), /* @__PURE__ */ jsxs("div", {
            style: {
              padding: "32px",
              background: "var(--seo-bg-accent)",
              borderLeft: "1px solid var(--seo-border-soft)"
            },
            children: [/* @__PURE__ */ jsx("h4", {
              style: {
                margin: "0 0 16px 0",
                fontSize: "15px"
              },
              children: "Pro Plan Features:"
            }), /* @__PURE__ */ jsxs("ul", {
              style: {
                margin: 0,
                padding: 0,
                listStyle: "none",
                display: "flex",
                flexDirection: "column",
                gap: "12px"
              },
              children: [/* @__PURE__ */ jsxs("li", {
                style: {
                  display: "flex",
                  gap: "8px",
                  fontSize: "13px"
                },
                children: [/* @__PURE__ */ jsx("span", {
                  style: {
                    color: "var(--seo-primary)",
                    fontWeight: "bold"
                  },
                  children: "✓"
                }), " ", /* @__PURE__ */ jsxs("strong", {
                  children: [PLAN_ALLOWANCES.PRO, " Monthly AI Tokens"]
                }), " (vs ", PLAN_ALLOWANCES.FREE, " Free)"]
              }), /* @__PURE__ */ jsxs("li", {
                style: {
                  display: "flex",
                  gap: "8px",
                  fontSize: "13px"
                },
                children: [/* @__PURE__ */ jsx("span", {
                  style: {
                    color: "var(--seo-primary)",
                    fontWeight: "bold"
                  },
                  children: "✓"
                }), " ", /* @__PURE__ */ jsx("strong", {
                  children: "Gemini Diff Doctor"
                }), " (Before/After SEO Change Audit)"]
              }), /* @__PURE__ */ jsxs("li", {
                style: {
                  display: "flex",
                  gap: "8px",
                  fontSize: "13px"
                },
                children: [/* @__PURE__ */ jsx("span", {
                  style: {
                    color: "var(--seo-primary)",
                    fontWeight: "bold"
                  },
                  children: "✓"
                }), " ", /* @__PURE__ */ jsx("strong", {
                  children: "Multimodal Vision AI"
                }), " for Product Image ALTs"]
              }), /* @__PURE__ */ jsxs("li", {
                style: {
                  display: "flex",
                  gap: "8px",
                  fontSize: "13px"
                },
                children: [/* @__PURE__ */ jsx("span", {
                  style: {
                    color: "var(--seo-primary)",
                    fontWeight: "bold"
                  },
                  children: "✓"
                }), " ", /* @__PURE__ */ jsx("strong", {
                  children: "Automatic 301 URL Redirects"
                }), " on handle updates"]
              }), /* @__PURE__ */ jsxs("li", {
                style: {
                  display: "flex",
                  gap: "8px",
                  fontSize: "13px"
                },
                children: [/* @__PURE__ */ jsx("span", {
                  style: {
                    color: "var(--seo-primary)",
                    fontWeight: "bold"
                  },
                  children: "✓"
                }), " Unlimited Catalog Scans & Export"]
              })]
            })]
          })]
        })
      }), /* @__PURE__ */ jsxs("div", {
        id: "usage",
        className: "section-card",
        children: [/* @__PURE__ */ jsxs("div", {
          className: "toolbar",
          style: {
            justifyContent: "space-between",
            marginBottom: 12
          },
          children: [/* @__PURE__ */ jsx("h4", {
            style: {
              margin: 0
            },
            children: "Recent AI Token Usage"
          }), /* @__PURE__ */ jsx("small", {
            style: {
              color: "var(--seo-muted)"
            },
            children: "Transparent per-action deduction log"
          })]
        }), !(usageHistory == null ? void 0 : usageHistory.length) ? /* @__PURE__ */ jsx("p", {
          className: "metric-help",
          style: {
            margin: 0
          },
          children: "No AI tokens used yet. Try AI Fix or Change Audit on any product."
        }) : /* @__PURE__ */ jsx("div", {
          style: {
            overflowX: "auto"
          },
          children: /* @__PURE__ */ jsxs("table", {
            className: "credit-usage-table",
            children: [/* @__PURE__ */ jsx("thead", {
              children: /* @__PURE__ */ jsxs("tr", {
                children: [/* @__PURE__ */ jsx("th", {
                  children: "Date & Time"
                }), /* @__PURE__ */ jsx("th", {
                  children: "Action"
                }), /* @__PURE__ */ jsx("th", {
                  children: "Product"
                }), /* @__PURE__ */ jsx("th", {
                  children: "Deduction"
                }), /* @__PURE__ */ jsx("th", {
                  children: "Model"
                })]
              })
            }), /* @__PURE__ */ jsx("tbody", {
              children: usageHistory.map((log) => /* @__PURE__ */ jsxs("tr", {
                children: [/* @__PURE__ */ jsx("td", {
                  children: new Date(log.createdAt).toLocaleString()
                }), /* @__PURE__ */ jsx("td", {
                  children: /* @__PURE__ */ jsx("span", {
                    className: "pill pill-info",
                    style: {
                      fontSize: 11
                    },
                    children: log.actionType.replace(/_/g, " ").toUpperCase()
                  })
                }), /* @__PURE__ */ jsx("td", {
                  children: log.productTitle || log.productId || "-"
                }), /* @__PURE__ */ jsx("td", {
                  style: {
                    fontWeight: 700,
                    color: log.creditsDeducted < 0 ? "var(--seo-good)" : log.creditsDeducted === 0 ? "#4338ca" : "var(--seo-primary-strong)"
                  },
                  children: log.creditsDeducted < 0 ? `+${Math.abs(log.creditsDeducted)} tokens` : log.creditsDeducted === 0 ? "0 tok (Super Access)" : `-${log.creditsDeducted} token${log.creditsDeducted > 1 ? "s" : ""}`
                }), /* @__PURE__ */ jsx("td", {
                  style: {
                    fontSize: 11,
                    color: "var(--seo-muted)"
                  },
                  children: log.modelUsed
                })]
              }, log.id))
            })]
          })
        })]
      })]
    })]
  });
});
const route25 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$4,
  default: app_billing,
  links: links$4,
  loader: loader$5
}, Symbol.toStringTag, { value: "Module" }));
const PLAN_PRO = "Ecom SEO Pro";
const links$3 = () => [{
  rel: "stylesheet",
  href: seoStyles
}];
const loader$4 = async ({
  request
}) => {
  const {
    admin,
    shop,
    token,
    apiVersion,
    configError
  } = await requireShopContext(request);
  if (configError) {
    return {
      configError,
      isSubscribed: false,
      subscription: null,
      planName: null,
      packResult: null
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
        apiVersion
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
          packageLabel: pkg.label
        };
      } else {
        packResult = {
          granted: false,
          pendingOrCancelled: true
        };
      }
    } catch (err) {
      packResult = {
        granted: false,
        error: (err == null ? void 0 : err.message) || "Could not verify token package purchase."
      };
    }
  }
  let activeSubscriptions = [];
  try {
    activeSubscriptions = await getActiveAppSubscriptions({
      admin,
      storeDomain: shop,
      token,
      apiVersion
    });
  } catch {
    activeSubscriptions = [];
  }
  const subscription = activeSubscriptions[0] || null;
  const planName = (subscription == null ? void 0 : subscription.name) || null;
  if (subscription && shop) {
    await syncPlanSubscription(shop, true).catch(() => {
    });
  }
  if (shop) invalidateBillingCache(shop);
  return {
    configError: "",
    isSubscribed: Boolean(subscription),
    subscription,
    planName,
    packResult
  };
};
const app_billing_return = UNSAFE_withComponentProps(function BillingReturnPage() {
  const {
    configError,
    isSubscribed,
    subscription,
    planName,
    packResult
  } = useLoaderData();
  const location = useLocation();
  const isPro = planName === PLAN_PRO;
  const hasTrial = isPro && ((subscription == null ? void 0 : subscription.trialDays) ?? 0) > 0;
  return /* @__PURE__ */ jsxs(Fragment, {
    children: [/* @__PURE__ */ jsx("ui-title-bar", {
      title: "Billing Confirmation"
    }), /* @__PURE__ */ jsxs("div", {
      className: "seo-wrap seo-grid",
      children: [configError ? /* @__PURE__ */ jsx("div", {
        className: "error-box",
        children: configError
      }) : null, (packResult == null ? void 0 : packResult.error) ? /* @__PURE__ */ jsx("div", {
        className: "error-box",
        children: packResult.error
      }) : null, packResult ? /* @__PURE__ */ jsx("div", {
        className: "section-card",
        style: {
          maxWidth: 560
        },
        children: packResult.granted || packResult.alreadyGranted ? /* @__PURE__ */ jsxs(Fragment, {
          children: [/* @__PURE__ */ jsxs("h3", {
            style: {
              marginTop: 0
            },
            children: ["⚡ +", packResult.tokensAdded ?? 100, " AI Tokens Added!"]
          }), /* @__PURE__ */ jsxs("p", {
            className: "metric-help",
            style: {
              marginTop: 8
            },
            children: ["Your bonus token package is active and never expires. Current available balance:", " ", /* @__PURE__ */ jsxs("strong", {
              children: [packResult.availableCredits, " tokens"]
            }), "."]
          }), /* @__PURE__ */ jsxs("div", {
            className: "toolbar",
            style: {
              marginTop: 16
            },
            children: [/* @__PURE__ */ jsx(Link, {
              to: `/app/billing${location.search}`,
              className: "seo-button",
              children: "View Token Balance"
            }), /* @__PURE__ */ jsx(Link, {
              to: `/app/products${location.search}`,
              className: "seo-button secondary",
              children: "Use AI on Products"
            })]
          })]
        }) : /* @__PURE__ */ jsxs(Fragment, {
          children: [/* @__PURE__ */ jsx("h3", {
            style: {
              marginTop: 0
            },
            children: "Token package purchase not completed"
          }), /* @__PURE__ */ jsx("p", {
            className: "metric-help",
            style: {
              marginTop: 8
            },
            children: "The one-time token package payment was cancelled or is still pending confirmation."
          }), /* @__PURE__ */ jsx("div", {
            className: "toolbar",
            style: {
              marginTop: 16
            },
            children: /* @__PURE__ */ jsx(Link, {
              to: `/app/billing${location.search}`,
              className: "seo-button",
              children: "Return to Billing"
            })
          })]
        })
      }) : null, !packResult ? /* @__PURE__ */ jsx("div", {
        className: "section-card",
        style: {
          maxWidth: 560
        },
        children: isSubscribed ? /* @__PURE__ */ jsxs(Fragment, {
          children: [/* @__PURE__ */ jsx("h3", {
            style: {
              marginTop: 0
            },
            children: isPro ? "🚀 Pro plan activated!" : "Subscription active"
          }), /* @__PURE__ */ jsx("p", {
            className: "metric-help",
            style: {
              marginTop: 8
            },
            children: hasTrial ? `Your 7-day free trial has started. You'll be charged $12/month after the trial ends. Status: ${(subscription == null ? void 0 : subscription.status) || "ACTIVE"}.` : `Your Pro subscription is running. Status: ${(subscription == null ? void 0 : subscription.status) || "ACTIVE"}.`
          }), hasTrial && /* @__PURE__ */ jsxs("p", {
            className: "metric-help",
            style: {
              color: "#4f82bb",
              marginTop: 8
            },
            children: ["🎉 Trial days remaining: ", subscription.trialDays]
          }), /* @__PURE__ */ jsx("div", {
            className: "toolbar",
            style: {
              marginTop: 16
            },
            children: /* @__PURE__ */ jsx(Link, {
              to: `/app${location.search}`,
              className: "seo-button",
              children: "Go to Dashboard"
            })
          })]
        }) : /* @__PURE__ */ jsxs(Fragment, {
          children: [/* @__PURE__ */ jsx("h3", {
            style: {
              marginTop: 0
            },
            children: "No active subscription"
          }), /* @__PURE__ */ jsx("p", {
            className: "metric-help",
            style: {
              marginTop: 8
            },
            children: "It looks like you cancelled the billing confirmation. You can choose a plan below."
          }), /* @__PURE__ */ jsx("div", {
            className: "toolbar",
            style: {
              marginTop: 16
            },
            children: /* @__PURE__ */ jsx(Link, {
              to: `/app/billing${location.search}`,
              className: "seo-button",
              children: "Choose a Plan"
            })
          })]
        })
      }) : null]
    })]
  });
});
const route26 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: app_billing_return,
  links: links$3,
  loader: loader$4
}, Symbol.toStringTag, { value: "Module" }));
const links$2 = () => [{
  rel: "stylesheet",
  href: seoStyles
}];
function escapeXml(value) {
  return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
function buildXmlSitemap(urls = []) {
  const lines = [`<?xml version="1.0" encoding="UTF-8"?>`, `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`, ...urls.map((url) => `  <url><loc>${escapeXml(url)}</loc></url>`), `</urlset>`];
  return lines.join("\n");
}
function extractChildSitemaps(xmlText) {
  const matches = [];
  const regex = /<loc>(https?:\/\/[^<]+)<\/loc>/gi;
  let match = regex.exec(xmlText);
  while (match) {
    matches.push(match[1]);
    match = regex.exec(xmlText);
  }
  return matches;
}
const loader$3 = async ({
  request
}) => {
  const {
    shop,
    configError
  } = await requireShopContext(request);
  const appState = shop ? await getAppState(shop) : null;
  return {
    configError,
    shop,
    generatedAt: (appState == null ? void 0 : appState.sitemapGeneratedAt) || null,
    urls: (appState == null ? void 0 : appState.sitemapUrls) || [],
    manualUrls: (appState == null ? void 0 : appState.sitemapManualUrls) || []
  };
};
const action$3 = async ({
  request
}) => {
  const {
    shop,
    token,
    apiVersion,
    configError
  } = await requireShopContext(request);
  if (configError) {
    return {
      ok: false,
      error: configError
    };
  }
  const formData = await request.formData();
  const intent = String(formData.get("intent") || "regenerate");
  const manualUrl = String(formData.get("manualUrl") || "");
  if (intent === "checkLive") {
    try {
      const res = await fetch(`https://${shop}/sitemap.xml`);
      const xml = await res.text();
      const childSitemaps = extractChildSitemaps(xml);
      return {
        ok: true,
        intent: "checkLive",
        liveStatus: res.status,
        childSitemaps
      };
    } catch (error) {
      return {
        ok: false,
        error: `Unable to reach https://${shop}/sitemap.xml (${(error == null ? void 0 : error.message) || "network error"}).`
      };
    }
  }
  try {
    const result = await regenerateSitemap({
      shop,
      storeDomain: shop,
      token,
      apiVersion,
      extraManualUrl: manualUrl
    });
    return {
      ok: true,
      intent: "regenerate",
      ...result
    };
  } catch (error) {
    return {
      ok: false,
      error: (error == null ? void 0 : error.message) || "Failed to regenerate sitemap."
    };
  }
};
const SITEMAP_PAGE_SIZE = 50;
const app_sitemap = UNSAFE_withComponentProps(function SitemapRoute() {
  var _a2, _b, _c, _d, _e;
  const data2 = useLoaderData();
  const fetcher = useFetcher();
  const [manualUrl, setManualUrl] = useState("");
  const [urlFilter, setUrlFilter] = useState("");
  const [page, setPage] = useState(1);
  const generatedAt = ((_a2 = fetcher.data) == null ? void 0 : _a2.generatedAt) || data2.generatedAt;
  const urls = ((_b = fetcher.data) == null ? void 0 : _b.urls) || data2.urls;
  const filteredUrls = useMemo(() => {
    const q = urlFilter.trim().toLowerCase();
    if (!q) return urls;
    return urls.filter((u) => String(u).toLowerCase().includes(q));
  }, [urls, urlFilter]);
  const totalPages = Math.max(1, Math.ceil(filteredUrls.length / SITEMAP_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const visibleUrls = filteredUrls.slice((safePage - 1) * SITEMAP_PAGE_SIZE, safePage * SITEMAP_PAGE_SIZE);
  const xmlContent = useMemo(() => buildXmlSitemap(urls), [urls]);
  useEffect(() => {
    var _a3, _b2;
    if (!((_a3 = fetcher.data) == null ? void 0 : _a3.ok)) return;
    if (fetcher.data.intent === "regenerate") {
      showToast({
        tone: "success",
        title: "Sitemap Regenerated",
        message: `Inventory updated with ${((_b2 = fetcher.data.urls) == null ? void 0 : _b2.length) || 0} URLs.`
      });
    } else if (fetcher.data.intent === "checkLive") {
      showToast({
        tone: "info",
        title: "Live Sitemap Checked",
        message: `Storefront /sitemap.xml returned HTTP ${fetcher.data.liveStatus}.`
      });
    }
  }, [fetcher.data]);
  function regenerate() {
    fetcher.submit({
      intent: "regenerate",
      manualUrl
    }, {
      method: "post"
    });
    setManualUrl("");
  }
  function checkLive() {
    fetcher.submit({
      intent: "checkLive"
    }, {
      method: "post"
    });
  }
  function downloadXml() {
    if (typeof window === "undefined") return;
    const blob = new Blob([xmlContent], {
      type: "application/xml"
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sitemap-${data2.shop || "store"}.xml`;
    a.click();
    URL.revokeObjectURL(url);
  }
  return /* @__PURE__ */ jsxs(Fragment, {
    children: [/* @__PURE__ */ jsx("ui-title-bar", {
      title: "Technical & History — XML Sitemap"
    }), /* @__PURE__ */ jsxs("div", {
      className: "seo-wrap seo-grid",
      children: [/* @__PURE__ */ jsx(WorkspaceSubnav, {
        group: "technical"
      }), data2.configError ? /* @__PURE__ */ jsx("div", {
        className: "error-box",
        children: data2.configError
      }) : null, ((_c = fetcher.data) == null ? void 0 : _c.error) ? /* @__PURE__ */ jsx("div", {
        className: "error-box",
        children: fetcher.data.error
      }) : null, /* @__PURE__ */ jsx("div", {
        className: "section-card",
        style: {
          background: "var(--seo-bg-accent)",
          padding: "12px 16px"
        },
        children: /* @__PURE__ */ jsxs("small", {
          children: [/* @__PURE__ */ jsx("strong", {
            children: "How Shopify Sitemaps work:"
          }), " Shopify automatically generates and updates your root", " ", /* @__PURE__ */ jsxs("a", {
            href: `https://${data2.shop}/sitemap.xml`,
            target: "_blank",
            rel: "noreferrer",
            children: [/* @__PURE__ */ jsx("code", {
              children: "/sitemap.xml"
            }), " ↗"]
          }), ". Use this tool to inspect your live Google-facing sitemaps, validate your full catalog URL inventory, and export XML files."]
        })
      }), /* @__PURE__ */ jsxs("div", {
        className: "toolbar",
        style: {
          flexWrap: "wrap"
        },
        children: [/* @__PURE__ */ jsx("input", {
          className: "seo-input",
          placeholder: "https://example.com/custom-page",
          value: manualUrl,
          onChange: (event) => setManualUrl(event.target.value),
          style: {
            maxWidth: 320
          }
        }), /* @__PURE__ */ jsx("button", {
          className: "seo-button",
          type: "button",
          onClick: regenerate,
          disabled: fetcher.state !== "idle",
          children: "Add manual URL + regenerate"
        }), /* @__PURE__ */ jsx("button", {
          className: "seo-button secondary",
          type: "button",
          onClick: checkLive,
          disabled: fetcher.state !== "idle",
          children: fetcher.state !== "idle" ? "Checking..." : "🌐 Check Live /sitemap.xml"
        }), urls.length ? /* @__PURE__ */ jsx("button", {
          className: "seo-button secondary",
          type: "button",
          onClick: downloadXml,
          children: "⬇ Export XML"
        }) : null]
      }), ((_d = fetcher.data) == null ? void 0 : _d.intent) === "checkLive" ? /* @__PURE__ */ jsxs("div", {
        className: "section-card",
        children: [/* @__PURE__ */ jsxs("h4", {
          style: {
            margin: "0 0 8px 0"
          },
          children: ["Live Shopify Sitemap Index (HTTP ", fetcher.data.liveStatus, ")"]
        }), ((_e = fetcher.data.childSitemaps) == null ? void 0 : _e.length) ? /* @__PURE__ */ jsx("ul", {
          style: {
            margin: 0,
            paddingLeft: 18,
            fontSize: 13
          },
          children: fetcher.data.childSitemaps.map((loc) => /* @__PURE__ */ jsx("li", {
            children: /* @__PURE__ */ jsxs("a", {
              href: loc,
              target: "_blank",
              rel: "noreferrer",
              children: [loc, " ↗"]
            })
          }, loc))
        }) : /* @__PURE__ */ jsxs("p", {
          className: "metric-help",
          style: {
            margin: 0
          },
          children: ["Live sitemap checked (HTTP ", fetcher.data.liveStatus, "). Note: password-protected dev stores may restrict public sitemap access until password is removed or verified."]
        })]
      }) : null, /* @__PURE__ */ jsxs("div", {
        className: "seo-grid grid-2",
        children: [/* @__PURE__ */ jsxs("div", {
          className: "metric-card",
          children: [/* @__PURE__ */ jsx("p", {
            className: "metric-label",
            children: "Generated at"
          }), /* @__PURE__ */ jsx("h3", {
            style: {
              fontSize: 16
            },
            children: generatedAt ? new Date(generatedAt).toLocaleString() : "Not generated"
          })]
        }), /* @__PURE__ */ jsxs("div", {
          className: "metric-card",
          children: [/* @__PURE__ */ jsx("p", {
            className: "metric-label",
            children: "URL Inventory Count"
          }), /* @__PURE__ */ jsx("h3", {
            children: urls.length
          })]
        })]
      }), !urls.length ? /* @__PURE__ */ jsx("div", {
        className: "empty-box",
        children: "No sitemap URLs yet. Regenerate to populate current store data."
      }) : /* @__PURE__ */ jsxs("div", {
        className: "section-card seo-grid",
        children: [/* @__PURE__ */ jsxs("div", {
          className: "toolbar",
          style: {
            justifyContent: "space-between",
            margin: 0
          },
          children: [/* @__PURE__ */ jsx("input", {
            type: "search",
            className: "seo-input",
            placeholder: "Filter sitemap URLs...",
            value: urlFilter,
            onChange: (e) => {
              setUrlFilter(e.target.value);
              setPage(1);
            },
            style: {
              maxWidth: 320
            }
          }), /* @__PURE__ */ jsxs("small", {
            style: {
              color: "var(--seo-muted)"
            },
            children: ["Showing ", visibleUrls.length, " of ", filteredUrls.length, " URLs (Page ", safePage, "/", totalPages, ")"]
          })]
        }), /* @__PURE__ */ jsx("ul", {
          style: {
            margin: 0,
            paddingLeft: 18
          },
          children: visibleUrls.map((url) => /* @__PURE__ */ jsx("li", {
            children: url
          }, url))
        }), totalPages > 1 ? /* @__PURE__ */ jsxs("div", {
          className: "toolbar",
          style: {
            justifyContent: "space-between",
            margin: 0
          },
          children: [/* @__PURE__ */ jsx("button", {
            type: "button",
            className: "seo-button secondary",
            disabled: safePage <= 1,
            onClick: () => setPage((p) => Math.max(1, p - 1)),
            children: "Previous 50"
          }), /* @__PURE__ */ jsx("button", {
            type: "button",
            className: "seo-button secondary",
            disabled: safePage >= totalPages,
            onClick: () => setPage((p) => Math.min(totalPages, p + 1)),
            children: "Next 50"
          })]
        }) : null]
      })]
    })]
  });
});
const route27 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$3,
  default: app_sitemap,
  links: links$2,
  loader: loader$3
}, Symbol.toStringTag, { value: "Module" }));
const links$1 = () => [{
  rel: "stylesheet",
  href: seoStyles
}];
const loader$2 = async ({
  request
}) => {
  var _a2, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o, _p;
  const context = await requireShopContext(request);
  const {
    shop,
    token,
    apiVersion,
    configError
  } = context;
  const appState = shop ? await getAppState(shop) : null;
  let scan = (appState == null ? void 0 : appState.lastScan) || null;
  let scanError = "";
  if (!scan && !configError) {
    try {
      scan = await ensureScanData({
        shop,
        storeDomain: shop,
        token,
        apiVersion
      });
    } catch (error) {
      scanError = (error == null ? void 0 : error.message) || "Unable to run initial SEO scan.";
    }
  }
  let creditAccount = null;
  let hasSuperAccess = false;
  let recentRevisions = [];
  let auditSnapshots = [];
  if (shop) {
    try {
      const [creditData, storeControl, revs, snaps] = await Promise.all([getOrCreateCreditAccount(shop), getOrCreateStoreControl(shop), prisma.productRevision.findMany({
        where: {
          shop
        },
        orderBy: {
          createdAt: "desc"
        },
        take: 5,
        select: {
          id: true,
          productId: true,
          productTitle: true,
          changeType: true,
          redirectCreated: true,
          createdAt: true
        }
      }), prisma.seoAuditSnapshot.findMany({
        where: {
          shop
        },
        orderBy: {
          createdAt: "desc"
        },
        take: 8,
        select: {
          id: true,
          overallScore: true,
          serpScore: true,
          contentScore: true,
          technicalScore: true,
          visualScore: true,
          cannibalScore: true,
          criticalCount: true,
          warningCount: true,
          infoCount: true,
          createdAt: true
        }
      })]);
      creditAccount = creditData;
      hasSuperAccess = Boolean(storeControl == null ? void 0 : storeControl.superAccess);
      recentRevisions = revs;
      auditSnapshots = snaps;
    } catch (dbErr) {
      console.warn("Could not load credit/revisions for dashboard:", dbErr == null ? void 0 : dbErr.message);
    }
  }
  const robotsValid = validateRobotsRules((appState == null ? void 0 : appState.robotsTxt) || "").valid;
  const sitemapReady = Boolean(appState == null ? void 0 : appState.sitemapGeneratedAt);
  const autopilotEnabled = Boolean((_a2 = appState == null ? void 0 : appState.autopilot) == null ? void 0 : _a2.enabled);
  const gscSummary = sanitizeGscForClient(appState == null ? void 0 : appState.gsc).summary;
  const pageSpeedSummary = ((_b = appState == null ? void 0 : appState.pageSpeed) == null ? void 0 : _b.mobile) || ((_c = appState == null ? void 0 : appState.pageSpeed) == null ? void 0 : _c.desktop) ? {
    performance: ((_f = (_e = (_d = appState == null ? void 0 : appState.pageSpeed) == null ? void 0 : _d.mobile) == null ? void 0 : _e.scores) == null ? void 0 : _f.performance) ?? ((_i = (_h = (_g = appState == null ? void 0 : appState.pageSpeed) == null ? void 0 : _g.desktop) == null ? void 0 : _h.scores) == null ? void 0 : _i.performance) ?? null,
    seo: ((_l = (_k = (_j = appState == null ? void 0 : appState.pageSpeed) == null ? void 0 : _j.mobile) == null ? void 0 : _k.scores) == null ? void 0 : _l.seo) ?? ((_o = (_n = (_m = appState == null ? void 0 : appState.pageSpeed) == null ? void 0 : _m.desktop) == null ? void 0 : _n.scores) == null ? void 0 : _o.seo) ?? null,
    lastTestedAt: ((_p = appState == null ? void 0 : appState.pageSpeed) == null ? void 0 : _p.lastTestedAt) || null
  } : null;
  const compactScan = scan ? {
    generatedAt: scan.generatedAt,
    pagesScanned: scan.pagesScanned,
    indexCoverage: scan.indexCoverage,
    truncated: Boolean(scan.truncated),
    summary: scan.summary,
    trend: scan.trend,
    issueCount: Array.isArray(scan.issues) ? scan.issues.length : Number(scan.issueCount || 0)
  } : null;
  return {
    configError,
    scanError,
    scan: compactScan,
    robotsValid,
    sitemapReady,
    autopilotEnabled,
    gscSummary,
    pageSpeedSummary,
    scoreHistory: (appState == null ? void 0 : appState.scoreHistory) || [],
    creditAccount: creditAccount ? {
      availableCredits: creditAccount.availableCredits,
      effectiveTotal: creditAccount.effectiveTotal,
      usedCredits: creditAccount.usedCredits,
      plan: creditAccount.plan,
      percentUsed: creditAccount.percentUsed
    } : null,
    hasSuperAccess,
    recentRevisions,
    auditSnapshots: auditSnapshots.reverse()
  };
};
const action$2 = async ({
  request
}) => {
  const {
    shop,
    token,
    apiVersion,
    configError
  } = await requireShopContext(request);
  if (configError || !shop) {
    return {
      ok: false,
      error: configError || "Shop session required."
    };
  }
  try {
    const scan = await runFullScan({
      shop,
      storeDomain: shop,
      token,
      apiVersion
    });
    const compactScan = scan ? {
      generatedAt: scan.generatedAt,
      pagesScanned: scan.pagesScanned,
      indexCoverage: scan.indexCoverage,
      truncated: Boolean(scan.truncated),
      summary: scan.summary,
      trend: scan.trend,
      issueCount: Array.isArray(scan.issues) ? scan.issues.length : 0
    } : null;
    return {
      ok: true,
      scan: compactScan
    };
  } catch (error) {
    return {
      ok: false,
      error: (error == null ? void 0 : error.message) || "Unable to complete store scan."
    };
  }
};
function scoreRingColor(score) {
  if (score >= 80) return "#15803d";
  if (score >= 55) return "#b45309";
  return "#b91c1c";
}
const app__index = UNSAFE_withComponentProps(function DashboardPage() {
  var _a2, _b, _c;
  const {
    configError,
    scanError,
    scan: loaderScan,
    robotsValid,
    sitemapReady,
    autopilotEnabled,
    gscSummary,
    pageSpeedSummary,
    scoreHistory,
    recentRevisions,
    auditSnapshots = []
  } = useLoaderData();
  const scanFetcher = useFetcher();
  const location = useLocation();
  const [showAnalytics, setShowAnalytics] = useState(false);
  useEffect(() => {
    if (location.hash === "#analytics") {
      setShowAnalytics(true);
    }
  }, [location.hash]);
  const scan = ((_a2 = scanFetcher.data) == null ? void 0 : _a2.scan) || loaderScan;
  const summary = (scan == null ? void 0 : scan.summary) || null;
  const pillars = (summary == null ? void 0 : summary.pillars) || null;
  const pagesScanned = (scan == null ? void 0 : scan.pagesScanned) || 0;
  const indexCoverage = (scan == null ? void 0 : scan.indexCoverage) || 0;
  const trend = (scan == null ? void 0 : scan.trend) || null;
  const counts = (summary == null ? void 0 : summary.counts) || {
    critical: 0,
    warning: 0
  };
  const issueCount = (scan == null ? void 0 : scan.issueCount) ?? ((_b = scan == null ? void 0 : scan.issues) == null ? void 0 : _b.length) ?? 0;
  const score = (summary == null ? void 0 : summary.score) ?? 0;
  useEffect(() => {
    var _a3, _b2, _c2;
    if (scanFetcher.state === "idle" && ((_a3 = scanFetcher.data) == null ? void 0 : _a3.ok) && ((_b2 = scanFetcher.data) == null ? void 0 : _b2.scan)) {
      showToast({
        tone: "success",
        title: "Store Scan Complete",
        message: `Latest SEO score: ${((_c2 = scanFetcher.data.scan.summary) == null ? void 0 : _c2.score) ?? 0}/100.`
      });
    }
  }, [scanFetcher.state, scanFetcher.data]);
  const chartScoreHistory = auditSnapshots.length ? auditSnapshots.map((snap) => ({
    date: snap.createdAt,
    score: snap.overallScore
  })) : [...scoreHistory || []];
  if (typeof (summary == null ? void 0 : summary.score) === "number" && !auditSnapshots.length && !chartScoreHistory.some((entry2) => (entry2 == null ? void 0 : entry2.date) === (summary == null ? void 0 : summary.lastScanDate))) {
    chartScoreHistory.push({
      date: summary.lastScanDate || (/* @__PURE__ */ new Date()).toISOString(),
      score: summary.score
    });
  }
  const latestScores = chartScoreHistory.slice(-8);
  const prevSnapshot = auditSnapshots.length >= 2 ? auditSnapshots[auditSnapshots.length - 2] : null;
  const currSnapshot = auditSnapshots.length >= 1 ? auditSnapshots[auditSnapshots.length - 1] : null;
  const getPillarDelta = (key, currentVal) => {
    if (!prevSnapshot) return null;
    const prevVal = prevSnapshot[key];
    const nowVal = currSnapshot ? currSnapshot[key] : currentVal;
    if (typeof prevVal !== "number" || typeof nowVal !== "number") return null;
    return nowVal - prevVal;
  };
  const actionableCount = counts.critical + counts.warning;
  const visualScore = (pillars == null ? void 0 : pillars.visualScore) ?? 100;
  return /* @__PURE__ */ jsxs(Fragment, {
    children: [/* @__PURE__ */ jsx("ui-title-bar", {
      title: "Ecom SEO — Easy Workflow"
    }), /* @__PURE__ */ jsx("div", {
      className: "seo-wrap",
      children: /* @__PURE__ */ jsxs("div", {
        className: "audit-page-stack",
        children: [configError ? /* @__PURE__ */ jsx("div", {
          className: "error-box",
          children: configError
        }) : null, scanError ? /* @__PURE__ */ jsx("div", {
          className: "error-box",
          children: scanError
        }) : null, ((_c = scanFetcher.data) == null ? void 0 : _c.error) ? /* @__PURE__ */ jsx("div", {
          className: "error-box",
          children: scanFetcher.data.error
        }) : null, /* @__PURE__ */ jsxs("section", {
          className: "audit-hero",
          children: [/* @__PURE__ */ jsxs("div", {
            className: "score-ring-wrap",
            children: [/* @__PURE__ */ jsx("div", {
              className: "score-ring",
              style: {
                "--score": summary ? score : 0,
                "--ring-color": scoreRingColor(score)
              },
              children: /* @__PURE__ */ jsxs("div", {
                className: "score-ring-inner",
                children: [/* @__PURE__ */ jsx("span", {
                  className: "score-ring-value",
                  children: summary ? score : "--"
                }), /* @__PURE__ */ jsx("span", {
                  className: "score-ring-max",
                  children: "/ 100"
                })]
              })
            }), /* @__PURE__ */ jsx(StatusPill, {
              tone: !summary ? "info" : summary.health === "strong" ? "good" : summary.health === "steady" ? "warning" : "critical",
              children: (summary == null ? void 0 : summary.health) === "strong" ? "Healthy" : (summary == null ? void 0 : summary.health) === "steady" ? "Needs Work" : summary ? "At Risk" : "Pending Scan"
            })]
          }), /* @__PURE__ */ jsx("div", {
            className: "audit-hero-body",
            children: /* @__PURE__ */ jsxs("div", {
              className: "audit-hero-top",
              children: [/* @__PURE__ */ jsxs("div", {
                className: "audit-hero-heading",
                children: [/* @__PURE__ */ jsx("h1", {
                  className: "page-title",
                  children: "Easy Store SEO Workflow"
                }), /* @__PURE__ */ jsx("p", {
                  className: "seo-muted",
                  children: summary ? /* @__PURE__ */ jsxs(Fragment, {
                    children: [/* @__PURE__ */ jsxs("strong", {
                      children: [pagesScanned, " pages"]
                    }), " scanned · ", /* @__PURE__ */ jsxs("strong", {
                      children: [indexCoverage, "%"]
                    }), " indexable ·", " ", /* @__PURE__ */ jsx("strong", {
                      children: issueCount
                    }), " total findings · ", (trend == null ? void 0 : trend.label) || "Ready to optimize"]
                  }) : "Follow the 3 simple steps below to scan your store, fix issues with Gemini AI, and keep technical SEO green."
                })]
              }), /* @__PURE__ */ jsxs("div", {
                className: "audit-hero-actions",
                children: [/* @__PURE__ */ jsx(scanFetcher.Form, {
                  method: "post",
                  children: /* @__PURE__ */ jsx("button", {
                    type: "submit",
                    className: "seo-button secondary",
                    disabled: scanFetcher.state !== "idle" || Boolean(configError),
                    children: scanFetcher.state !== "idle" ? "Scanning..." : "Re-Scan Store"
                  })
                }), /* @__PURE__ */ jsx(Link, {
                  to: "/app/seo-audit",
                  className: "seo-button",
                  children: actionableCount > 0 ? `Auto-Fix ${actionableCount} Issues with AI →` : "Open AI Audit & Fix →"
                })]
              })]
            })
          })]
        }), /* @__PURE__ */ jsxs("section", {
          className: "workflow-grid",
          "aria-label": "3-Step SEO Checklist",
          children: [/* @__PURE__ */ jsxs("article", {
            className: "workflow-step-card",
            children: [/* @__PURE__ */ jsxs("div", {
              className: "workflow-step-head",
              children: [/* @__PURE__ */ jsx("span", {
                className: "workflow-step-num",
                children: "1"
              }), /* @__PURE__ */ jsx(StatusPill, {
                tone: actionableCount === 0 ? "good" : counts.critical > 0 ? "critical" : "warning",
                children: actionableCount === 0 ? "All Clear" : `${actionableCount} Needs Fix`
              })]
            }), /* @__PURE__ */ jsx("h3", {
              children: "Fix Metadata & Keywords with AI"
            }), /* @__PURE__ */ jsx("p", {
              className: "seo-muted",
              children: "Let Gemini AI inspect your products, push position 8–20 keywords, and auto-optimize new products in the background."
            }), /* @__PURE__ */ jsxs("div", {
              style: {
                display: "flex",
                gap: "6px",
                flexWrap: "wrap"
              },
              children: [/* @__PURE__ */ jsxs(StatusPill, {
                tone: autopilotEnabled ? "good" : "info",
                children: ["Autopilot: ", autopilotEnabled ? "ON" : "Off"]
              }), gscSummary ? /* @__PURE__ */ jsxs(StatusPill, {
                tone: "info",
                children: ["GSC Quick Wins: ", gscSummary.quickWinsCount || 0]
              }) : null]
            }), /* @__PURE__ */ jsxs("div", {
              className: "workflow-step-actions",
              children: [/* @__PURE__ */ jsx(Link, {
                to: "/app/seo-audit",
                className: "seo-button",
                style: {
                  fontSize: "12.5px",
                  padding: "7px 13px"
                },
                children: "AI Auto-Fix →"
              }), /* @__PURE__ */ jsx(Link, {
                to: "/app/products",
                className: "seo-button secondary",
                style: {
                  fontSize: "12.5px",
                  padding: "7px 13px"
                },
                children: "Edit Products"
              })]
            })]
          }), /* @__PURE__ */ jsxs("article", {
            className: "workflow-step-card",
            children: [/* @__PURE__ */ jsxs("div", {
              className: "workflow-step-head",
              children: [/* @__PURE__ */ jsx("span", {
                className: "workflow-step-num",
                children: "2"
              }), /* @__PURE__ */ jsxs(StatusPill, {
                tone: visualScore >= 85 ? "good" : visualScore >= 60 ? "warning" : "critical",
                children: ["Visual SEO: ", visualScore, "%"]
              })]
            }), /* @__PURE__ */ jsx("h3", {
              children: "Optimize Images & Clean URLs"
            }), /* @__PURE__ */ jsx("p", {
              className: "seo-muted",
              children: "Generate descriptive ALT tags with Vision AI and shorten messy handles with automatic Shopify 301 redirects."
            }), /* @__PURE__ */ jsxs("div", {
              className: "workflow-step-actions",
              children: [/* @__PURE__ */ jsx(Link, {
                to: "/app/image-optimizer",
                className: "seo-button secondary",
                style: {
                  fontSize: "12.5px",
                  padding: "7px 13px"
                },
                children: "Image ALT"
              }), /* @__PURE__ */ jsx(Link, {
                to: "/app/url-optimization",
                className: "seo-button secondary",
                style: {
                  fontSize: "12.5px",
                  padding: "7px 13px"
                },
                children: "URLs & 301s"
              })]
            })]
          }), /* @__PURE__ */ jsxs("article", {
            className: "workflow-step-card",
            children: [/* @__PURE__ */ jsxs("div", {
              className: "workflow-step-head",
              children: [/* @__PURE__ */ jsx("span", {
                className: "workflow-step-num",
                children: "3"
              }), /* @__PURE__ */ jsx(StatusPill, {
                tone: robotsValid && sitemapReady ? "good" : "info",
                children: (pageSpeedSummary == null ? void 0 : pageSpeedSummary.performance) !== null && (pageSpeedSummary == null ? void 0 : pageSpeedSummary.performance) !== void 0 ? `Speed: ${pageSpeedSummary.performance}/100` : robotsValid && sitemapReady ? "Ready" : "Review Setup"
              })]
            }), /* @__PURE__ */ jsx("h3", {
              children: "Technical Setup, Speed & History"
            }), /* @__PURE__ */ jsx("p", {
              className: "seo-muted",
              children: "Test live Google PageSpeed & Core Web Vitals with AI/manual fixes, valid robots.txt, XML sitemaps, and 1-click rollback."
            }), /* @__PURE__ */ jsxs("div", {
              className: "workflow-step-actions",
              children: [/* @__PURE__ */ jsx(Link, {
                to: "/app/pagespeed",
                className: "seo-button",
                style: {
                  fontSize: "12.5px",
                  padding: "7px 13px"
                },
                children: "PageSpeed Test"
              }), /* @__PURE__ */ jsx(Link, {
                to: "/app/robots",
                className: "seo-button secondary",
                style: {
                  fontSize: "12.5px",
                  padding: "7px 13px"
                },
                children: "Robots & Sitemap"
              }), /* @__PURE__ */ jsxs(Link, {
                to: "/app/revisions",
                className: "seo-button secondary",
                style: {
                  fontSize: "12.5px",
                  padding: "7px 13px"
                },
                children: ["History (", recentRevisions.length, ")"]
              })]
            })]
          })]
        }), /* @__PURE__ */ jsxs("section", {
          id: "analytics",
          className: "section-card audit-section",
          children: [/* @__PURE__ */ jsxs("div", {
            className: "section-header",
            style: {
              alignItems: "center"
            },
            children: [/* @__PURE__ */ jsxs("div", {
              children: [/* @__PURE__ */ jsx("h2", {
                style: {
                  margin: "0 0 2px",
                  fontSize: "16px"
                },
                children: "Detailed Analytics & Recent Changes"
              }), /* @__PURE__ */ jsxs("p", {
                className: "seo-muted",
                style: {
                  fontSize: "13px"
                },
                children: ["5-pillar breakdowns, historical score chart, and latest product SEO edits (", recentRevisions.length, " recent)."]
              })]
            }), /* @__PURE__ */ jsx("button", {
              type: "button",
              className: "seo-button secondary",
              style: {
                padding: "7px 14px",
                fontSize: "12.5px"
              },
              onClick: () => setShowAnalytics((prev) => !prev),
              children: showAnalytics ? "Hide Charts & History ▲" : "Show Charts & History ▼"
            })]
          }), showAnalytics ? /* @__PURE__ */ jsxs("div", {
            style: {
              display: "grid",
              gap: "18px"
            },
            children: [/* @__PURE__ */ jsxs("div", {
              className: "grid-5",
              children: [/* @__PURE__ */ jsx(PillarScoreCard, {
                label: "SERP & CTR",
                score: (pillars == null ? void 0 : pillars.serpScore) ?? 75,
                delta: getPillarDelta("serpScore", pillars == null ? void 0 : pillars.serpScore),
                description: "Title & Meta snippet length compliance"
              }), /* @__PURE__ */ jsx(PillarScoreCard, {
                label: "Content Intent",
                score: (pillars == null ? void 0 : pillars.contentScore) ?? 80,
                delta: getPillarDelta("contentScore", pillars == null ? void 0 : pillars.contentScore),
                description: "Product title & focus keyword density"
              }), /* @__PURE__ */ jsx(PillarScoreCard, {
                label: "Technical SEO",
                score: (pillars == null ? void 0 : pillars.technicalScore) ?? 90,
                delta: getPillarDelta("technicalScore", pillars == null ? void 0 : pillars.technicalScore),
                description: "Clean handles & robots crawl access"
              }), /* @__PURE__ */ jsx(PillarScoreCard, {
                label: "Visual SEO",
                score: (pillars == null ? void 0 : pillars.visualScore) ?? 70,
                delta: getPillarDelta("visualScore", pillars == null ? void 0 : pillars.visualScore),
                description: "Image ALT tag richness"
              }), /* @__PURE__ */ jsx(PillarScoreCard, {
                label: "Cannibalization",
                score: (pillars == null ? void 0 : pillars.cannibalScore) ?? 100,
                delta: getPillarDelta("cannibalScore", pillars == null ? void 0 : pillars.cannibalScore),
                description: "Unique vs conflicting focus keywords"
              })]
            }), /* @__PURE__ */ jsxs("div", {
              className: "seo-grid grid-2",
              children: [/* @__PURE__ */ jsx(IssuePieChart, {
                counts: summary == null ? void 0 : summary.counts
              }), /* @__PURE__ */ jsx(HealthTrendGraph, {
                points: latestScores
              })]
            }), /* @__PURE__ */ jsxs("div", {
              children: [/* @__PURE__ */ jsxs("div", {
                className: "toolbar",
                style: {
                  justifyContent: "space-between",
                  marginBottom: 10
                },
                children: [/* @__PURE__ */ jsx("h3", {
                  style: {
                    margin: 0,
                    fontSize: "15px"
                  },
                  children: "Recent Product Edits"
                }), /* @__PURE__ */ jsx(Link, {
                  to: "/app/revisions",
                  style: {
                    fontSize: 13
                  },
                  children: "Open Full History & Rollback →"
                })]
              }), !(recentRevisions == null ? void 0 : recentRevisions.length) ? /* @__PURE__ */ jsx("p", {
                className: "seo-muted",
                children: "No product SEO edits logged yet."
              }) : /* @__PURE__ */ jsx("div", {
                style: {
                  overflowX: "auto"
                },
                children: /* @__PURE__ */ jsxs("table", {
                  className: "credit-usage-table",
                  children: [/* @__PURE__ */ jsx("thead", {
                    children: /* @__PURE__ */ jsxs("tr", {
                      children: [/* @__PURE__ */ jsx("th", {
                        children: "Date"
                      }), /* @__PURE__ */ jsx("th", {
                        children: "Product"
                      }), /* @__PURE__ */ jsx("th", {
                        children: "Change Type"
                      }), /* @__PURE__ */ jsx("th", {
                        children: "301 Redirect"
                      }), /* @__PURE__ */ jsx("th", {
                        children: "Action"
                      })]
                    })
                  }), /* @__PURE__ */ jsx("tbody", {
                    children: recentRevisions.map((rev) => /* @__PURE__ */ jsxs("tr", {
                      children: [/* @__PURE__ */ jsx("td", {
                        suppressHydrationWarning: true,
                        children: new Date(rev.createdAt).toLocaleDateString()
                      }), /* @__PURE__ */ jsx("td", {
                        children: /* @__PURE__ */ jsx("strong", {
                          children: rev.productTitle || `Product #${rev.productId}`
                        })
                      }), /* @__PURE__ */ jsx("td", {
                        children: /* @__PURE__ */ jsx("span", {
                          className: "pill pill-info",
                          style: {
                            fontSize: 11
                          },
                          children: rev.changeType
                        })
                      }), /* @__PURE__ */ jsx("td", {
                        children: rev.redirectCreated ? /* @__PURE__ */ jsx("span", {
                          style: {
                            color: "var(--seo-good)",
                            fontWeight: 600
                          },
                          children: "🛡️ Active"
                        }) : /* @__PURE__ */ jsx("span", {
                          style: {
                            color: "var(--seo-muted)"
                          },
                          children: "—"
                        })
                      }), /* @__PURE__ */ jsxs("td", {
                        style: {
                          display: "flex",
                          gap: 10
                        },
                        children: [/* @__PURE__ */ jsx(Link, {
                          to: `/app/products?focus=${rev.productId}`,
                          style: {
                            fontSize: 12
                          },
                          children: "Edit"
                        }), /* @__PURE__ */ jsx(Link, {
                          to: "/app/revisions",
                          style: {
                            fontSize: 12
                          },
                          children: "Diff / Rollback"
                        })]
                      })]
                    }, rev.id))
                  })]
                })
              })]
            })]
          }) : null]
        })]
      })
    })]
  });
});
function PillarScoreCard({
  label: label2,
  score,
  delta,
  description
}) {
  const tone = score >= 80 ? "good" : score >= 55 ? "warn" : "bad";
  const clamped = Math.max(0, Math.min(100, Number(score) || 0));
  return /* @__PURE__ */ jsxs("div", {
    className: "pillar-card",
    children: [/* @__PURE__ */ jsx("p", {
      className: "metric-label",
      children: label2
    }), /* @__PURE__ */ jsxs("div", {
      style: {
        display: "flex",
        alignItems: "baseline",
        gap: 6
      },
      children: [/* @__PURE__ */ jsxs("h3", {
        style: {
          margin: 0,
          fontSize: 24,
          color: `var(--seo-${tone})`
        },
        children: [clamped, "%"]
      }), typeof delta === "number" && delta !== 0 ? /* @__PURE__ */ jsx("small", {
        style: {
          margin: 0,
          color: delta > 0 ? "var(--seo-good)" : "var(--seo-bad)",
          fontWeight: 700
        },
        children: delta > 0 ? `▲ +${delta}` : `▼ ${delta}`
      }) : null]
    }), /* @__PURE__ */ jsx("div", {
      className: "pillar-bar-track",
      children: /* @__PURE__ */ jsx("div", {
        className: `pillar-bar-fill ${tone}`,
        style: {
          width: `${clamped}%`
        }
      })
    }), /* @__PURE__ */ jsx("p", {
      className: "metric-help",
      style: {
        fontSize: 11.5,
        margin: 0
      },
      children: description
    })]
  });
}
function IssuePieChart({
  counts
}) {
  const critical = (counts == null ? void 0 : counts.critical) ?? 0;
  const warning = (counts == null ? void 0 : counts.warning) ?? 0;
  const info = (counts == null ? void 0 : counts.info) ?? 0;
  const total = critical + warning + info;
  const safeTotal = Math.max(1, total);
  const criticalPct = critical / safeTotal * 100;
  const warningPct = warning / safeTotal * 100;
  const infoPct = Math.max(0, 100 - criticalPct - warningPct);
  const formatPct = (value) => `${Math.round(value)}%`;
  const pieGradient = total ? `conic-gradient(
      #ef4444 0% ${criticalPct}%,
      #f59e0b ${criticalPct}% ${criticalPct + warningPct}%,
      #3b82f6 ${criticalPct + warningPct}% ${criticalPct + warningPct + infoPct}%
    )` : "conic-gradient(#e2e8f0 0% 100%)";
  return /* @__PURE__ */ jsxs("div", {
    className: "health-chart-card",
    children: [/* @__PURE__ */ jsxs("div", {
      children: [/* @__PURE__ */ jsx("h4", {
        children: "Issue Distribution"
      }), /* @__PURE__ */ jsx("p", {
        children: total ? `${total} prioritized issues found` : "No issues found in latest scan"
      })]
    }), /* @__PURE__ */ jsx("div", {
      className: "pie-wrap",
      children: /* @__PURE__ */ jsx("div", {
        className: "pie-chart",
        role: "img",
        "aria-label": "Issue distribution donut chart",
        style: {
          background: pieGradient
        },
        children: /* @__PURE__ */ jsxs("div", {
          className: "donut-hole",
          children: [/* @__PURE__ */ jsx("strong", {
            children: total
          }), /* @__PURE__ */ jsx("small", {
            children: total === 1 ? "issue" : "issues"
          })]
        })
      })
    }), /* @__PURE__ */ jsxs("div", {
      className: "chart-legend",
      children: [/* @__PURE__ */ jsxs("p", {
        children: [/* @__PURE__ */ jsx("span", {
          className: "dot dot-critical"
        }), " Critical: ", /* @__PURE__ */ jsx("strong", {
          children: critical
        }), " (", formatPct(criticalPct), ")"]
      }), /* @__PURE__ */ jsxs("p", {
        children: [/* @__PURE__ */ jsx("span", {
          className: "dot dot-warning"
        }), " Warning: ", /* @__PURE__ */ jsx("strong", {
          children: warning
        }), " (", formatPct(warningPct), ")"]
      }), /* @__PURE__ */ jsxs("p", {
        children: [/* @__PURE__ */ jsx("span", {
          className: "dot dot-info"
        }), " Info: ", /* @__PURE__ */ jsx("strong", {
          children: info
        }), " (", formatPct(infoPct), ")"]
      })]
    })]
  });
}
function HealthTrendGraph({
  points = []
}) {
  var _a2, _b;
  const graphPoints = points.length ? points.map((point) => ({
    score: (point == null ? void 0 : point.score) ?? 0,
    date: point == null ? void 0 : point.date
  })) : [{
    score: 0,
    date: null
  }];
  const width = 360;
  const height = 170;
  const padding = 20;
  const maxX = width - padding * 2;
  const maxY = height - padding * 2;
  const xStep = graphPoints.length > 1 ? maxX / (graphPoints.length - 1) : 0;
  const toY = (score) => padding + (100 - Math.max(0, Math.min(100, score))) * (maxY / 100);
  const coords = graphPoints.map((point, index2) => ({
    x: graphPoints.length > 1 ? padding + index2 * xStep : padding + maxX / 2,
    y: toY(point.score),
    score: point.score,
    date: point.date
  }));
  const polylinePoints = coords.map((p) => `${p.x},${p.y}`).join(" ");
  const areaPoints = coords.length > 1 ? `${coords[0].x},${height - padding} ${polylinePoints} ${coords[coords.length - 1].x},${height - padding}` : "";
  const latest = ((_a2 = graphPoints.at(-1)) == null ? void 0 : _a2.score) ?? 0;
  const first = ((_b = graphPoints[0]) == null ? void 0 : _b.score) ?? latest;
  const change = latest - first;
  const direction = change > 0 ? "up" : change < 0 ? "down" : "flat";
  return /* @__PURE__ */ jsxs("div", {
    className: "health-chart-card",
    children: [/* @__PURE__ */ jsxs("div", {
      children: [/* @__PURE__ */ jsx("h4", {
        children: "Health Score Trend"
      }), /* @__PURE__ */ jsx("p", {
        children: direction === "flat" ? "Steady across selected timeline" : `${change > 0 ? "+" : ""}${change} points over timeline`
      })]
    }), /* @__PURE__ */ jsxs("svg", {
      className: "trend-graph",
      viewBox: `0 0 ${width} ${height}`,
      role: "img",
      "aria-label": "SEO health score trend graph",
      children: [/* @__PURE__ */ jsx("defs", {
        children: /* @__PURE__ */ jsxs("linearGradient", {
          id: "seoTrendFill",
          x1: "0",
          x2: "0",
          y1: "0",
          y2: "1",
          children: [/* @__PURE__ */ jsx("stop", {
            offset: "0%",
            stopColor: "#0f766e",
            stopOpacity: "0.24"
          }), /* @__PURE__ */ jsx("stop", {
            offset: "100%",
            stopColor: "#0f766e",
            stopOpacity: "0.01"
          })]
        })
      }), /* @__PURE__ */ jsx("line", {
        x1: padding,
        y1: toY(100),
        x2: width - padding,
        y2: toY(100),
        className: "grid-line"
      }), /* @__PURE__ */ jsx("line", {
        x1: padding,
        y1: toY(50),
        x2: width - padding,
        y2: toY(50),
        className: "grid-line"
      }), /* @__PURE__ */ jsx("line", {
        x1: padding,
        y1: padding,
        x2: padding,
        y2: height - padding,
        className: "axis-line"
      }), /* @__PURE__ */ jsx("line", {
        x1: padding,
        y1: height - padding,
        x2: width - padding,
        y2: height - padding,
        className: "axis-line"
      }), areaPoints ? /* @__PURE__ */ jsx("polygon", {
        points: areaPoints,
        fill: "url(#seoTrendFill)"
      }) : null, coords.length > 1 ? /* @__PURE__ */ jsx("polyline", {
        points: polylinePoints,
        className: "trend-line"
      }) : null, coords.map((point, index2) => /* @__PURE__ */ jsx("circle", {
        cx: point.x,
        cy: point.y,
        r: "4.5",
        className: "trend-point"
      }, `${point.date || "point"}-${index2}`))]
    }), /* @__PURE__ */ jsxs("div", {
      className: "chart-footnote",
      style: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center"
      },
      children: [/* @__PURE__ */ jsxs("small", {
        style: {
          margin: 0
        },
        children: ["Latest score: ", /* @__PURE__ */ jsxs("strong", {
          children: [latest, "/100"]
        })]
      }), /* @__PURE__ */ jsxs("small", {
        style: {
          margin: 0
        },
        children: [graphPoints.length, " scan", graphPoints.length === 1 ? "" : "s"]
      })]
    })]
  });
}
const route28 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$2,
  default: app__index,
  links: links$1,
  loader: loader$2
}, Symbol.toStringTag, { value: "Module" }));
function aiHandleSuggestion({ title, currentHandle, focusKeyword }) {
  const base = `${focusKeyword || ""} ${title || ""}`.trim() || currentHandle || "product";
  return {
    handle: normalizeHandle(base),
    rationale: "Generated a lowercase, hyphenated handle from product intent keywords."
  };
}
function aiRobotsImprovement({ currentRules }) {
  const lines = String(currentRules || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const ensured = new Set(lines);
  ensured.add("User-agent: *");
  ensured.add("Disallow: /cart");
  ensured.add("Disallow: /search");
  ensured.add("Allow: /");
  return {
    robotsTxt: Array.from(ensured).join("\n"),
    rationale: "Added required disallow rules while preserving broad crawl access for public pages."
  };
}
async function parseInput(request) {
  const type = request.headers.get("content-type") || "";
  if (type.includes("application/json")) {
    return request.json();
  }
  const formData = await request.formData();
  const rawPayload = formData.get("payload");
  return rawPayload ? JSON.parse(String(rawPayload)) : Object.fromEntries(formData.entries());
}
const loader$1 = async ({
  request
}) => {
  const {
    shop
  } = await requireShopContext(request);
  if (!shop) {
    return {
      ok: false,
      error: "Shop context required."
    };
  }
  const account = await getOrCreateCreditAccount(shop);
  const usageHistory = await getCreditUsageHistory(shop, 15);
  return {
    ok: true,
    account: {
      plan: account.plan,
      totalCredits: account.effectiveTotal,
      usedCredits: account.usedCredits,
      availableCredits: account.availableCredits,
      percentUsed: account.percentUsed,
      cycleResetAt: account.cycleResetAt
    },
    usageHistory
  };
};
const action$1 = async ({
  request
}) => {
  var _a2, _b, _c, _d, _e;
  const {
    shop
  } = await requireShopContext(request);
  if (!shop) {
    return {
      ok: false,
      error: "Shop is required."
    };
  }
  const [appState, platformAi, access] = await Promise.all([getAppState(shop), getEffectivePlatformAiSettings(), checkStoreRouteAccess(shop, "ai_features")]);
  const aiSettings = {
    provider: platformAi.provider,
    model: platformAi.model,
    apiKey: platformAi.apiKey,
    temperature: platformAi.temperature
  };
  try {
    const payload = await parseInput(request);
    const actionType = String(payload.actionType || "").trim();
    if (!actionType) {
      return {
        ok: false,
        error: "actionType is required."
      };
    }
    if (!AI_FEATURES_ENABLED || !platformAi.isEnabled) {
      return {
        ok: false,
        error: "Platform AI features are currently disabled by administrator."
      };
    }
    if (!access.allowed) {
      return {
        ok: false,
        error: access.reason
      };
    }
    if (actionType === "get_credit_balance") {
      const account = await getOrCreateCreditAccount(shop);
      return {
        ok: true,
        account: {
          plan: account.plan,
          totalCredits: account.effectiveTotal,
          usedCredits: account.usedCredits,
          availableCredits: account.availableCredits,
          percentUsed: account.percentUsed,
          cycleResetAt: account.cycleResetAt
        }
      };
    }
    if (actionType === "get_usage_history") {
      const history = await getCreditUsageHistory(shop, 25);
      return {
        ok: true,
        history
      };
    }
    if (actionType === "url_handle_suggestion") {
      const result2 = aiHandleSuggestion(payload);
      return {
        ok: true,
        actionType,
        result: result2
      };
    }
    if (actionType === "robots_txt_improvement" && !payload.useAi) {
      const result2 = aiRobotsImprovement({
        currentRules: payload.currentRules
      });
      return {
        ok: true,
        actionType,
        result: result2
      };
    }
    const hasSuperAccess = Boolean((_a2 = access.control) == null ? void 0 : _a2.superAccess);
    const actionCost = resolveActionCreditCost(actionType, payload);
    const creditCheck = await checkCreditBalance(shop, actionType, actionCost);
    if (!hasSuperAccess && !creditCheck.allowed) {
      return {
        ok: false,
        outOfCredits: true,
        error: `Insufficient AI tokens. This action requires ${creditCheck.cost} token${creditCheck.cost > 1 ? "s" : ""}, but you have ${creditCheck.availableCredits} remaining. Upgrade to Pro or buy a token package.`,
        availableCredits: creditCheck.availableCredits,
        cost: creditCheck.cost,
        plan: creditCheck.plan
      };
    }
    let result = null;
    if (actionType === "meta_fix") {
      result = await generateMetaFix({
        settings: aiSettings,
        title: payload.title,
        focusKeyword: payload.focusKeyword,
        currentMetaTitle: payload.currentMetaTitle,
        currentMetaDescription: payload.currentMetaDescription
      });
    } else if (actionType === "product_seo_fix") {
      result = await generateProductSeoFix({
        settings: aiSettings,
        title: payload.title,
        focusKeyword: payload.focusKeyword,
        handle: payload.handle,
        metaTitle: payload.metaTitle,
        metaDescription: payload.metaDescription,
        descriptionHtml: payload.descriptionHtml || "",
        productType: payload.productType || "",
        tags: payload.tags || "",
        mode: payload.mode || "full",
        preserveHandle: Boolean(payload.preserveHandle)
      });
    } else if (actionType === "product_content_fix") {
      result = await generateProductContentFix({
        settings: aiSettings,
        title: payload.title,
        focusKeyword: payload.focusKeyword,
        descriptionHtml: payload.descriptionHtml || "",
        productType: payload.productType || "",
        tags: payload.tags || "",
        goal: payload.goal || "polish"
      });
    } else if (actionType === "audit_change") {
      result = await auditProductSeoChange({
        settings: aiSettings,
        productTitle: payload.title || payload.productTitle,
        currentValues: payload.currentValues || {},
        newValues: payload.newValues || {}
      });
    } else if (actionType === "vision_alt") {
      result = await generateVisionImageAlt({
        settings: aiSettings,
        imageUrl: payload.imageUrl,
        productTitle: payload.productTitle || payload.title
      });
    } else if (actionType === "store_copilot") {
      if (!(appState == null ? void 0 : appState.lastScan)) {
        return {
          ok: false,
          error: "Run an SEO scan first so Gemini Copilot can analyze your store audit."
        };
      }
      result = await generateStoreCopilotBrief({
        settings: aiSettings,
        storeDomain: shop,
        scan: appState.lastScan,
        gscData: appState.gsc || null
      });
      if (!(result == null ? void 0 : result.fallbackUsed)) {
        await updateAppState(shop, (current) => {
          var _a3, _b2;
          return {
            ...current,
            lastCopilotBrief: {
              ...result,
              generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
              scoreAtGeneration: ((_b2 = (_a3 = appState.lastScan) == null ? void 0 : _a3.summary) == null ? void 0 : _b2.score) ?? null
            }
          };
        });
      }
    } else if (actionType === "catalog_cannibalization") {
      const groups = ((_c = (_b = appState == null ? void 0 : appState.lastScan) == null ? void 0 : _b.summary) == null ? void 0 : _c.cannibalizedGroups) || [];
      result = await resolveKeywordCannibalization({
        settings: aiSettings,
        groups
      });
    } else if (actionType === "robots_txt_improvement" && payload.useAi) {
      result = await generateAiRobotsSuggestion({
        settings: aiSettings,
        currentRules: payload.currentRules,
        storeDomain: shop
      });
    } else if (actionType === "pagespeed_ai_fix") {
      const mobileReport = payload.mobileReport || ((_d = appState == null ? void 0 : appState.pageSpeed) == null ? void 0 : _d.mobile) || null;
      const desktopReport = payload.desktopReport || ((_e = appState == null ? void 0 : appState.pageSpeed) == null ? void 0 : _e.desktop) || null;
      const targetReport = payload.report || mobileReport || desktopReport;
      if (!targetReport) {
        return {
          ok: false,
          error: "Run a live Google PageSpeed test first so Gemini can analyze your Core Web Vitals."
        };
      }
      result = await generatePageSpeedAiFixPlan({
        settings: aiSettings,
        storeDomain: shop,
        report: targetReport,
        mobileReport,
        desktopReport,
        matchedProductTitle: payload.matchedProductTitle || ""
      });
      if (!(result == null ? void 0 : result.fallbackUsed)) {
        await updateAppState(shop, (current) => ({
          ...current,
          pageSpeed: {
            ...current.pageSpeed || {},
            lastAiPlan: {
              ...result,
              generatedAt: (/* @__PURE__ */ new Date()).toISOString()
            }
          }
        }));
      }
    } else {
      return {
        ok: false,
        error: `Unsupported actionType: ${actionType}.`
      };
    }
    if (result == null ? void 0 : result.fallbackUsed) {
      const currentAccount = await getOrCreateCreditAccount(shop);
      return {
        ok: true,
        actionType,
        result,
        creditsDeducted: 0,
        creditsRemaining: currentAccount.availableCredits,
        plan: currentAccount.plan
      };
    }
    const deduction = await deductCredits({
      shop,
      actionType,
      customCost: actionCost,
      productId: payload.productId || payload.id,
      productTitle: payload.title || payload.productTitle || (actionType === "store_copilot" ? "Store-wide Copilot" : null),
      modelUsed: aiSettings.model || DEFAULT_GEMINI_MODEL,
      bypassLimit: hasSuperAccess
    });
    return {
      ok: true,
      actionType,
      result,
      creditsDeducted: deduction.deducted,
      creditsRemaining: deduction.remainingCredits,
      plan: deduction.plan,
      superAccess: hasSuperAccess
    };
  } catch (error) {
    return {
      ok: false,
      error: (error == null ? void 0 : error.message) || "Unable to process AI request."
    };
  }
};
const route29 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$1,
  loader: loader$1
}, Symbol.toStringTag, { value: "Module" }));
const links = () => [{
  rel: "stylesheet",
  href: seoStyles
}];
function buildShopifyRobotsLiquid(rulesText) {
  const lines = String(rulesText || "").split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !/^user-agent:/i.test(line));
  const customRules = lines.filter((line) => !/^disallow:\s*\/(cart|search)$/i.test(line) && !/^allow:\s*\/$/i.test(line));
  return [`{% for group in robots.default_groups %}`, `  {{- group.user_agent -}}`, ``, `  {% for rule in group.rules %}`, `    {{- rule -}}`, `  {% endfor %}`, ``, `  {%- if group.user_agent.value == '*' -%}`, ...customRules.length ? customRules.map((r) => `    {{ '${r.replace(/'/g, "\\'")}' }}`) : [`    {{ 'Disallow: /collections/*+*' }}`], `  {%- endif -%}`, ``, `  {%- if group.sitemap != blank -%}`, `    {{ group.sitemap }}`, `  {%- endif -%}`, `{% endfor %}`].join("\n");
}
const loader = async ({
  request
}) => {
  const {
    shop,
    configError
  } = await requireShopContext(request);
  const appState = shop ? await getAppState(shop) : null;
  return {
    configError,
    shop,
    robotsTxt: (appState == null ? void 0 : appState.robotsTxt) || "",
    validation: validateRobotsRules((appState == null ? void 0 : appState.robotsTxt) || "")
  };
};
const action = async ({
  request
}) => {
  const {
    shop,
    token,
    apiVersion,
    configError
  } = await requireShopContext(request);
  if (configError) {
    return {
      ok: false,
      error: configError
    };
  }
  const formData = await request.formData();
  const intent = String(formData.get("intent") || "save");
  const robotsTxt = String(formData.get("robotsTxt") || "");
  if (intent === "fetchLive") {
    try {
      const res = await fetch(`https://${shop}/robots.txt`);
      const text2 = await res.text();
      return {
        ok: true,
        intent: "fetchLive",
        liveStatus: res.status,
        liveRobotsTxt: text2.slice(0, 8e3)
      };
    } catch (error) {
      return {
        ok: false,
        error: `Unable to fetch live https://${shop}/robots.txt (${(error == null ? void 0 : error.message) || "network error"}).`
      };
    }
  }
  const validation = validateRobotsRules(robotsTxt);
  try {
    await updateAppState(shop, (current) => ({
      ...current,
      robotsTxt
    }));
    await applyIncrementalAuditPatch({
      shop,
      storeDomain: shop,
      token,
      apiVersion,
      updatedProducts: []
    });
    return {
      ok: true,
      intent: "save",
      validation
    };
  } catch (error) {
    return {
      ok: false,
      error: (error == null ? void 0 : error.message) || "Failed to save robots.txt."
    };
  }
};
const app_robots = UNSAFE_withComponentProps(function RobotsRoute() {
  var _a2, _b, _c, _d, _e, _f, _g, _h, _i;
  const data2 = useLoaderData();
  const fetcher = useFetcher();
  const aiFetcher = useFetcher();
  const [robotsTxt, setRobotsTxt] = useState(data2.robotsTxt || "");
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    var _a3, _b2, _c2, _d2, _e2;
    if (((_a3 = aiFetcher.data) == null ? void 0 : _a3.ok) && ((_b2 = aiFetcher.data) == null ? void 0 : _b2.creditsRemaining) !== void 0) {
      dispatchCreditsUpdate({
        availableCredits: aiFetcher.data.creditsRemaining,
        plan: aiFetcher.data.plan,
        superAccess: Boolean(aiFetcher.data.superAccess)
      });
    }
    if (((_c2 = aiFetcher.data) == null ? void 0 : _c2.ok) && ((_e2 = (_d2 = aiFetcher.data) == null ? void 0 : _d2.result) == null ? void 0 : _e2.robotsTxt)) {
      setRobotsTxt(aiFetcher.data.result.robotsTxt);
      showToast({
        tone: "info",
        title: "AI Directives Ready",
        message: "Optimized robots.txt draft applied to editor."
      });
    }
  }, [aiFetcher.data]);
  useEffect(() => {
    var _a3;
    if (!((_a3 = fetcher.data) == null ? void 0 : _a3.ok)) return;
    if (fetcher.data.intent === "save") {
      showToast({
        tone: "success",
        title: "Robots.txt Saved",
        message: "Saved draft rules and updated store audit score."
      });
    } else if (fetcher.data.intent === "fetchLive") {
      showToast({
        tone: "info",
        title: "Live Robots.txt Checked",
        message: `Fetched live storefront /robots.txt (HTTP ${fetcher.data.liveStatus}).`
      });
    }
  }, [fetcher.data]);
  const validation = ((_a2 = fetcher.data) == null ? void 0 : _a2.validation) || data2.validation;
  const liquidTemplate = useMemo(() => buildShopifyRobotsLiquid(robotsTxt), [robotsTxt]);
  function submit(intent) {
    fetcher.submit({
      intent,
      robotsTxt
    }, {
      method: "post"
    });
  }
  function runAiOptimize() {
    aiFetcher.submit({
      payload: JSON.stringify({
        actionType: "robots_txt_improvement",
        useAi: true,
        currentRules: robotsTxt,
        title: "robots.txt Directives"
      })
    }, {
      method: "post",
      action: "/app/api/ai"
    });
  }
  function copyLiquid() {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(liquidTemplate);
      setCopied(true);
      showToast({
        tone: "success",
        title: "Copied Liquid Template",
        message: "Shopify templates/robots.txt.liquid copied to clipboard."
      });
      setTimeout(() => setCopied(false), 2e3);
    }
  }
  return /* @__PURE__ */ jsxs(Fragment, {
    children: [/* @__PURE__ */ jsx("ui-title-bar", {
      title: "Technical & History — Robots.txt"
    }), /* @__PURE__ */ jsxs("div", {
      className: "seo-wrap seo-grid",
      children: [/* @__PURE__ */ jsx(WorkspaceSubnav, {
        group: "technical"
      }), data2.configError ? /* @__PURE__ */ jsx("div", {
        className: "error-box",
        children: data2.configError
      }) : null, ((_b = fetcher.data) == null ? void 0 : _b.error) ? /* @__PURE__ */ jsx("div", {
        className: "error-box",
        children: fetcher.data.error
      }) : null, ((_c = aiFetcher.data) == null ? void 0 : _c.error) ? /* @__PURE__ */ jsxs("div", {
        className: "error-box",
        children: [aiFetcher.data.error, " ", ((_d = aiFetcher.data) == null ? void 0 : _d.outOfCredits) ? /* @__PURE__ */ jsx(Link, {
          to: "/app/billing",
          children: "Upgrade or manage credits"
        }) : null]
      }) : null, /* @__PURE__ */ jsx("div", {
        className: "section-card",
        style: {
          background: "var(--seo-bg-accent)",
          padding: "12px 16px"
        },
        children: /* @__PURE__ */ jsxs("small", {
          children: [/* @__PURE__ */ jsx("strong", {
            children: "How Shopify Robots.txt works:"
          }), " Shopify automatically serves `/robots.txt` from your active theme's ", /* @__PURE__ */ jsx("code", {
            children: "templates/robots.txt.liquid"
          }), ". Use this tool to inspect your live storefront file, optimize directives with Gemini AI, and export the exact Liquid template for your Shopify theme."]
        })
      }), /* @__PURE__ */ jsxs("div", {
        className: "toolbar",
        style: {
          flexWrap: "wrap"
        },
        children: [/* @__PURE__ */ jsx("button", {
          className: "seo-button secondary",
          type: "button",
          onClick: runAiOptimize,
          disabled: aiFetcher.state !== "idle",
          title: `Use Gemini AI to optimize robots.txt directives (${CREDIT_COSTS.robots_txt_improvement} tokens)`,
          children: aiFetcher.state !== "idle" ? "Optimizing..." : `🤖 Gemini AI Optimize (${CREDIT_COSTS.robots_txt_improvement} tok)`
        }), /* @__PURE__ */ jsx("button", {
          className: "seo-button secondary",
          type: "button",
          onClick: () => submit("fetchLive"),
          disabled: fetcher.state !== "idle",
          children: fetcher.state !== "idle" ? "Checking..." : "🌐 Inspect Live /robots.txt"
        }), /* @__PURE__ */ jsx("button", {
          className: "seo-button",
          type: "button",
          onClick: () => submit("save"),
          disabled: fetcher.state !== "idle",
          children: "Save Draft & Re-Audit"
        })]
      }), ((_e = fetcher.data) == null ? void 0 : _e.intent) === "fetchLive" && ((_f = fetcher.data) == null ? void 0 : _f.liveRobotsTxt) ? /* @__PURE__ */ jsxs("div", {
        className: "section-card",
        children: [/* @__PURE__ */ jsxs("div", {
          className: "toolbar",
          style: {
            justifyContent: "space-between",
            marginBottom: 8
          },
          children: [/* @__PURE__ */ jsxs("h4", {
            style: {
              margin: 0
            },
            children: ["Live Storefront `/robots.txt` (HTTP ", fetcher.data.liveStatus, ")"]
          }), /* @__PURE__ */ jsx("a", {
            href: `https://${data2.shop}/robots.txt`,
            target: "_blank",
            rel: "noreferrer",
            style: {
              fontSize: 12
            },
            children: "Open live URL ↗"
          })]
        }), /* @__PURE__ */ jsx("pre", {
          style: {
            margin: 0,
            padding: 12,
            background: "#f4f7fa",
            borderRadius: 6,
            overflowX: "auto",
            fontSize: 12
          },
          children: fetcher.data.liveRobotsTxt
        })]
      }) : null, /* @__PURE__ */ jsxs("div", {
        className: "seo-grid grid-2",
        children: [/* @__PURE__ */ jsxs("div", {
          className: "section-card seo-grid",
          children: [/* @__PURE__ */ jsx("h4", {
            style: {
              margin: 0
            },
            children: "Draft Rules & Validation"
          }), /* @__PURE__ */ jsx("textarea", {
            className: "seo-textarea",
            rows: 12,
            value: robotsTxt,
            onChange: (event) => setRobotsTxt(event.target.value)
          }), /* @__PURE__ */ jsxs("p", {
            style: {
              margin: 0
            },
            children: ["/cart disallow: ", /* @__PURE__ */ jsx("strong", {
              children: (validation == null ? void 0 : validation.disallowCart) ? "Yes" : "No"
            }), " | /search disallow:", " ", /* @__PURE__ */ jsx("strong", {
              children: (validation == null ? void 0 : validation.disallowSearch) ? "Yes" : "No"
            })]
          }), !(validation == null ? void 0 : validation.valid) ? /* @__PURE__ */ jsx("div", {
            className: "error-box",
            "data-no-toast": "true",
            children: validation == null ? void 0 : validation.message
          }) : null, ((_g = aiFetcher.data) == null ? void 0 : _g.ok) && ((_i = (_h = aiFetcher.data) == null ? void 0 : _h.result) == null ? void 0 : _i.rationale) ? /* @__PURE__ */ jsxs("small", {
            style: {
              color: "var(--seo-primary)"
            },
            children: ["🤖 ", aiFetcher.data.result.rationale, " ", aiFetcher.data.superAccess ? "(Super Access · 0 tok)" : aiFetcher.data.creditsRemaining !== void 0 ? `(${aiFetcher.data.creditsRemaining} tokens left)` : ""]
          }) : null]
        }), /* @__PURE__ */ jsxs("div", {
          className: "section-card seo-grid",
          children: [/* @__PURE__ */ jsxs("div", {
            className: "toolbar",
            style: {
              justifyContent: "space-between",
              margin: 0
            },
            children: [/* @__PURE__ */ jsx("h4", {
              style: {
                margin: 0
              },
              children: "Shopify `templates/robots.txt.liquid`"
            }), /* @__PURE__ */ jsx("button", {
              type: "button",
              className: "seo-button secondary",
              style: {
                padding: "4px 10px",
                fontSize: 12
              },
              onClick: copyLiquid,
              children: copied ? "✓ Copied!" : "Copy Liquid"
            })]
          }), /* @__PURE__ */ jsx("textarea", {
            className: "seo-textarea",
            rows: 12,
            readOnly: true,
            value: liquidTemplate,
            style: {
              fontFamily: "monospace",
              fontSize: 12
            }
          }), /* @__PURE__ */ jsxs("small", {
            style: {
              color: "var(--seo-muted)"
            },
            children: ["In Shopify Admin → Online Store → Themes → Edit code → Add a new template ", /* @__PURE__ */ jsx("code", {
              children: "robots.txt.liquid"
            }), " and paste this code."]
          })]
        })]
      })]
    })]
  });
});
const route30 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action,
  default: app_robots,
  links,
  loader
}, Symbol.toStringTag, { value: "Module" }));
const serverManifest = { "entry": { "module": "/assets/entry.client-BCcUwNAG.js", "imports": ["/assets/jsx-runtime-BKhq23Iv.js", "/assets/chunk-4ZMWKKQ3-vwIRs5Tt.js"], "css": [] }, "routes": { "root": { "id": "root", "parentId": void 0, "path": "", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": true, "hasErrorBoundary": true, "module": "/assets/root-CuC8PCQA.js", "imports": ["/assets/jsx-runtime-BKhq23Iv.js", "/assets/chunk-4ZMWKKQ3-vwIRs5Tt.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/webhooks.customers.data_request": { "id": "routes/webhooks.customers.data_request", "parentId": "root", "path": "webhooks/customers/data_request", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": false, "hasErrorBoundary": false, "module": "/assets/webhooks.customers.data_request-l0sNRNKZ.js", "imports": [], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/webhooks.app.scopes_update": { "id": "routes/webhooks.app.scopes_update", "parentId": "root", "path": "webhooks/app/scopes_update", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": false, "hasErrorBoundary": false, "module": "/assets/webhooks.app.scopes_update-l0sNRNKZ.js", "imports": [], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/webhooks.customers.redact": { "id": "routes/webhooks.customers.redact", "parentId": "root", "path": "webhooks/customers/redact", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": false, "hasErrorBoundary": false, "module": "/assets/webhooks.customers.redact-l0sNRNKZ.js", "imports": [], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/webhooks.app.uninstalled": { "id": "routes/webhooks.app.uninstalled", "parentId": "root", "path": "webhooks/app/uninstalled", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": false, "hasErrorBoundary": false, "module": "/assets/webhooks.app.uninstalled-l0sNRNKZ.js", "imports": [], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/webhooks.products.create": { "id": "routes/webhooks.products.create", "parentId": "root", "path": "webhooks/products/create", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": false, "hasErrorBoundary": false, "module": "/assets/webhooks.products.create-l0sNRNKZ.js", "imports": [], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/webhooks.shop.redact": { "id": "routes/webhooks.shop.redact", "parentId": "root", "path": "webhooks/shop/redact", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": false, "hasErrorBoundary": false, "module": "/assets/webhooks.shop.redact-l0sNRNKZ.js", "imports": [], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/api.gsc.callback": { "id": "routes/api.gsc.callback", "parentId": "root", "path": "api/gsc/callback", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": false, "hasErrorBoundary": false, "module": "/assets/api.gsc.callback-l0sNRNKZ.js", "imports": [], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/auth.login": { "id": "routes/auth.login", "parentId": "root", "path": "auth/login", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": true, "hasErrorBoundary": false, "module": "/assets/route-Q0W2627K.js", "imports": ["/assets/chunk-4ZMWKKQ3-vwIRs5Tt.js", "/assets/jsx-runtime-BKhq23Iv.js", "/assets/AppProxyProvider-COE77qUW.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/superadmin": { "id": "routes/superadmin", "parentId": "root", "path": "superadmin", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": true, "hasErrorBoundary": false, "module": "/assets/superadmin-s_8JgpYh.js", "imports": ["/assets/chunk-4ZMWKKQ3-vwIRs5Tt.js", "/assets/jsx-runtime-BKhq23Iv.js", "/assets/superadmin-pOgh_v0_.js", "/assets/toast-sKLOL4Z5.js", "/assets/toast-viewport-DXO4N6m7.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/superadmin._index": { "id": "routes/superadmin._index", "parentId": "routes/superadmin", "path": void 0, "index": true, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": true, "hasErrorBoundary": false, "module": "/assets/superadmin._index-5SP6rFjk.js", "imports": ["/assets/chunk-4ZMWKKQ3-vwIRs5Tt.js", "/assets/jsx-runtime-BKhq23Iv.js", "/assets/credits-CkGtFi8H.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/superadmin.login": { "id": "routes/superadmin.login", "parentId": "routes/superadmin", "path": "login", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": true, "hasErrorBoundary": false, "module": "/assets/superadmin.login-DAUJL0-v.js", "imports": ["/assets/chunk-4ZMWKKQ3-vwIRs5Tt.js", "/assets/jsx-runtime-BKhq23Iv.js", "/assets/superadmin-pOgh_v0_.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/superadmin.users": { "id": "routes/superadmin.users", "parentId": "routes/superadmin", "path": "users", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": true, "hasErrorBoundary": false, "module": "/assets/superadmin.users-DjMAuEk9.js", "imports": ["/assets/chunk-4ZMWKKQ3-vwIRs5Tt.js", "/assets/jsx-runtime-BKhq23Iv.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/superadmin.ai": { "id": "routes/superadmin.ai", "parentId": "routes/superadmin", "path": "ai", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": true, "hasErrorBoundary": false, "module": "/assets/superadmin.ai-D27xzy8z.js", "imports": ["/assets/chunk-4ZMWKKQ3-vwIRs5Tt.js", "/assets/jsx-runtime-BKhq23Iv.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/_index": { "id": "routes/_index", "parentId": "root", "path": void 0, "index": true, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": true, "hasErrorBoundary": false, "module": "/assets/route-DaMFI0kI.js", "imports": ["/assets/chunk-4ZMWKKQ3-vwIRs5Tt.js", "/assets/jsx-runtime-BKhq23Iv.js"], "css": ["/assets/route-Xpdx9QZl.css"], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/auth.$": { "id": "routes/auth.$", "parentId": "root", "path": "auth/*", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": false, "hasErrorBoundary": false, "module": "/assets/auth._-l0sNRNKZ.js", "imports": [], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/app": { "id": "routes/app", "parentId": "root", "path": "app", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": true, "hasErrorBoundary": true, "module": "/assets/app-DFJpeKBA.js", "imports": ["/assets/chunk-4ZMWKKQ3-vwIRs5Tt.js", "/assets/jsx-runtime-BKhq23Iv.js", "/assets/AppProxyProvider-COE77qUW.js", "/assets/seo-D9hJKExZ.js", "/assets/toast-sKLOL4Z5.js", "/assets/seo-ui-CnrZcN6m.js", "/assets/toast-viewport-DXO4N6m7.js", "/assets/credits-CkGtFi8H.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/app.url-optimization": { "id": "routes/app.url-optimization", "parentId": "routes/app", "path": "url-optimization", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": true, "hasErrorBoundary": false, "module": "/assets/app.url-optimization-DrGcPBsn.js", "imports": ["/assets/chunk-4ZMWKKQ3-vwIRs5Tt.js", "/assets/jsx-runtime-BKhq23Iv.js", "/assets/seo-D9hJKExZ.js", "/assets/seo-ui-CnrZcN6m.js", "/assets/credits-CkGtFi8H.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/app.image-optimizer": { "id": "routes/app.image-optimizer", "parentId": "routes/app", "path": "image-optimizer", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": true, "hasErrorBoundary": false, "module": "/assets/app.image-optimizer-xU1W8YNr.js", "imports": ["/assets/chunk-4ZMWKKQ3-vwIRs5Tt.js", "/assets/jsx-runtime-BKhq23Iv.js", "/assets/seo-D9hJKExZ.js", "/assets/seo-ui-CnrZcN6m.js", "/assets/toast-viewport-DXO4N6m7.js", "/assets/seoValidators-C19qhdxw.js", "/assets/credits-CkGtFi8H.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/app.bulk-meta": { "id": "routes/app.bulk-meta", "parentId": "routes/app", "path": "bulk-meta", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": true, "hasErrorBoundary": false, "module": "/assets/app.bulk-meta-Bck6L8tJ.js", "imports": ["/assets/chunk-4ZMWKKQ3-vwIRs5Tt.js", "/assets/jsx-runtime-BKhq23Iv.js", "/assets/seo-D9hJKExZ.js", "/assets/seo-ui-CnrZcN6m.js", "/assets/toast-viewport-DXO4N6m7.js", "/assets/credits-CkGtFi8H.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/app.pagespeed": { "id": "routes/app.pagespeed", "parentId": "routes/app", "path": "pagespeed", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": true, "hasErrorBoundary": false, "module": "/assets/app.pagespeed-D5VXAD_u.js", "imports": ["/assets/chunk-4ZMWKKQ3-vwIRs5Tt.js", "/assets/jsx-runtime-BKhq23Iv.js", "/assets/seo-D9hJKExZ.js", "/assets/seo-ui-CnrZcN6m.js", "/assets/toast-viewport-DXO4N6m7.js", "/assets/credits-CkGtFi8H.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/app.revisions": { "id": "routes/app.revisions", "parentId": "routes/app", "path": "revisions", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": true, "hasErrorBoundary": false, "module": "/assets/app.revisions-CTKwn45e.js", "imports": ["/assets/chunk-4ZMWKKQ3-vwIRs5Tt.js", "/assets/jsx-runtime-BKhq23Iv.js", "/assets/seo-D9hJKExZ.js", "/assets/seo-ui-CnrZcN6m.js", "/assets/credits-CkGtFi8H.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/app.seo-audit": { "id": "routes/app.seo-audit", "parentId": "routes/app", "path": "seo-audit", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": true, "hasErrorBoundary": false, "module": "/assets/app.seo-audit-CYowWpeq.js", "imports": ["/assets/chunk-4ZMWKKQ3-vwIRs5Tt.js", "/assets/jsx-runtime-BKhq23Iv.js", "/assets/seo-D9hJKExZ.js", "/assets/seo-ui-CnrZcN6m.js", "/assets/toast-viewport-DXO4N6m7.js", "/assets/credits-CkGtFi8H.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/app.products": { "id": "routes/app.products", "parentId": "routes/app", "path": "products", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": true, "hasErrorBoundary": false, "module": "/assets/app.products-BN8mx5Cv.js", "imports": ["/assets/chunk-4ZMWKKQ3-vwIRs5Tt.js", "/assets/jsx-runtime-BKhq23Iv.js", "/assets/seo-D9hJKExZ.js", "/assets/seo-ui-CnrZcN6m.js", "/assets/toast-viewport-DXO4N6m7.js", "/assets/credits-CkGtFi8H.js", "/assets/seoValidators-C19qhdxw.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/app.settings": { "id": "routes/app.settings", "parentId": "routes/app", "path": "settings", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": true, "hasErrorBoundary": false, "module": "/assets/app.settings-zJs1_TWV.js", "imports": ["/assets/chunk-4ZMWKKQ3-vwIRs5Tt.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/app.billing": { "id": "routes/app.billing", "parentId": "routes/app", "path": "billing", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": true, "hasErrorBoundary": false, "module": "/assets/app.billing-DI8QHyCr.js", "imports": ["/assets/chunk-4ZMWKKQ3-vwIRs5Tt.js", "/assets/jsx-runtime-BKhq23Iv.js", "/assets/seo-D9hJKExZ.js", "/assets/toast-viewport-DXO4N6m7.js", "/assets/credits-CkGtFi8H.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/app.billing.return": { "id": "routes/app.billing.return", "parentId": "routes/app.billing", "path": "return", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": true, "hasErrorBoundary": false, "module": "/assets/app.billing.return-BiMj82bO.js", "imports": ["/assets/chunk-4ZMWKKQ3-vwIRs5Tt.js", "/assets/jsx-runtime-BKhq23Iv.js", "/assets/seo-D9hJKExZ.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/app.sitemap": { "id": "routes/app.sitemap", "parentId": "routes/app", "path": "sitemap", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": true, "hasErrorBoundary": false, "module": "/assets/app.sitemap-DQSfiwjx.js", "imports": ["/assets/chunk-4ZMWKKQ3-vwIRs5Tt.js", "/assets/jsx-runtime-BKhq23Iv.js", "/assets/seo-D9hJKExZ.js", "/assets/seo-ui-CnrZcN6m.js", "/assets/toast-viewport-DXO4N6m7.js", "/assets/credits-CkGtFi8H.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/app._index": { "id": "routes/app._index", "parentId": "routes/app", "path": void 0, "index": true, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": true, "hasErrorBoundary": false, "module": "/assets/app._index-C--e8Lzo.js", "imports": ["/assets/chunk-4ZMWKKQ3-vwIRs5Tt.js", "/assets/jsx-runtime-BKhq23Iv.js", "/assets/seo-D9hJKExZ.js", "/assets/seo-ui-CnrZcN6m.js", "/assets/toast-viewport-DXO4N6m7.js", "/assets/credits-CkGtFi8H.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/app.api.ai": { "id": "routes/app.api.ai", "parentId": "routes/app", "path": "api/ai", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": false, "hasErrorBoundary": false, "module": "/assets/app.api.ai-l0sNRNKZ.js", "imports": [], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/app.robots": { "id": "routes/app.robots", "parentId": "routes/app", "path": "robots", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": true, "hasErrorBoundary": false, "module": "/assets/app.robots-BfLggOrB.js", "imports": ["/assets/chunk-4ZMWKKQ3-vwIRs5Tt.js", "/assets/jsx-runtime-BKhq23Iv.js", "/assets/seo-D9hJKExZ.js", "/assets/seo-ui-CnrZcN6m.js", "/assets/toast-viewport-DXO4N6m7.js", "/assets/credits-CkGtFi8H.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 } }, "url": "/assets/manifest-4829e792.js", "version": "4829e792", "sri": void 0 };
const assetsBuildDirectory = "build/client";
const basename = "/";
const future = { "unstable_optimizeDeps": false, "v8_passThroughRequests": false, "v8_trailingSlashAwareDataRequests": false, "unstable_previewServerPrerendering": false, "v8_middleware": false, "v8_splitRouteModules": false, "v8_viteEnvironmentApi": false };
const ssr = true;
const isSpaMode = false;
const prerender = [];
const routeDiscovery = { "mode": "lazy", "manifestPath": "/__manifest" };
const publicPath = "/";
const entry = { module: entryServer };
const routes = {
  "root": {
    id: "root",
    parentId: void 0,
    path: "",
    index: void 0,
    caseSensitive: void 0,
    module: route0
  },
  "routes/webhooks.customers.data_request": {
    id: "routes/webhooks.customers.data_request",
    parentId: "root",
    path: "webhooks/customers/data_request",
    index: void 0,
    caseSensitive: void 0,
    module: route1
  },
  "routes/webhooks.app.scopes_update": {
    id: "routes/webhooks.app.scopes_update",
    parentId: "root",
    path: "webhooks/app/scopes_update",
    index: void 0,
    caseSensitive: void 0,
    module: route2
  },
  "routes/webhooks.customers.redact": {
    id: "routes/webhooks.customers.redact",
    parentId: "root",
    path: "webhooks/customers/redact",
    index: void 0,
    caseSensitive: void 0,
    module: route3
  },
  "routes/webhooks.app.uninstalled": {
    id: "routes/webhooks.app.uninstalled",
    parentId: "root",
    path: "webhooks/app/uninstalled",
    index: void 0,
    caseSensitive: void 0,
    module: route4
  },
  "routes/webhooks.products.create": {
    id: "routes/webhooks.products.create",
    parentId: "root",
    path: "webhooks/products/create",
    index: void 0,
    caseSensitive: void 0,
    module: route5
  },
  "routes/webhooks.shop.redact": {
    id: "routes/webhooks.shop.redact",
    parentId: "root",
    path: "webhooks/shop/redact",
    index: void 0,
    caseSensitive: void 0,
    module: route6
  },
  "routes/api.gsc.callback": {
    id: "routes/api.gsc.callback",
    parentId: "root",
    path: "api/gsc/callback",
    index: void 0,
    caseSensitive: void 0,
    module: route7
  },
  "routes/auth.login": {
    id: "routes/auth.login",
    parentId: "root",
    path: "auth/login",
    index: void 0,
    caseSensitive: void 0,
    module: route8
  },
  "routes/superadmin": {
    id: "routes/superadmin",
    parentId: "root",
    path: "superadmin",
    index: void 0,
    caseSensitive: void 0,
    module: route9
  },
  "routes/superadmin._index": {
    id: "routes/superadmin._index",
    parentId: "routes/superadmin",
    path: void 0,
    index: true,
    caseSensitive: void 0,
    module: route10
  },
  "routes/superadmin.login": {
    id: "routes/superadmin.login",
    parentId: "routes/superadmin",
    path: "login",
    index: void 0,
    caseSensitive: void 0,
    module: route11
  },
  "routes/superadmin.users": {
    id: "routes/superadmin.users",
    parentId: "routes/superadmin",
    path: "users",
    index: void 0,
    caseSensitive: void 0,
    module: route12
  },
  "routes/superadmin.ai": {
    id: "routes/superadmin.ai",
    parentId: "routes/superadmin",
    path: "ai",
    index: void 0,
    caseSensitive: void 0,
    module: route13
  },
  "routes/_index": {
    id: "routes/_index",
    parentId: "root",
    path: void 0,
    index: true,
    caseSensitive: void 0,
    module: route14
  },
  "routes/auth.$": {
    id: "routes/auth.$",
    parentId: "root",
    path: "auth/*",
    index: void 0,
    caseSensitive: void 0,
    module: route15
  },
  "routes/app": {
    id: "routes/app",
    parentId: "root",
    path: "app",
    index: void 0,
    caseSensitive: void 0,
    module: route16
  },
  "routes/app.url-optimization": {
    id: "routes/app.url-optimization",
    parentId: "routes/app",
    path: "url-optimization",
    index: void 0,
    caseSensitive: void 0,
    module: route17
  },
  "routes/app.image-optimizer": {
    id: "routes/app.image-optimizer",
    parentId: "routes/app",
    path: "image-optimizer",
    index: void 0,
    caseSensitive: void 0,
    module: route18
  },
  "routes/app.bulk-meta": {
    id: "routes/app.bulk-meta",
    parentId: "routes/app",
    path: "bulk-meta",
    index: void 0,
    caseSensitive: void 0,
    module: route19
  },
  "routes/app.pagespeed": {
    id: "routes/app.pagespeed",
    parentId: "routes/app",
    path: "pagespeed",
    index: void 0,
    caseSensitive: void 0,
    module: route20
  },
  "routes/app.revisions": {
    id: "routes/app.revisions",
    parentId: "routes/app",
    path: "revisions",
    index: void 0,
    caseSensitive: void 0,
    module: route21
  },
  "routes/app.seo-audit": {
    id: "routes/app.seo-audit",
    parentId: "routes/app",
    path: "seo-audit",
    index: void 0,
    caseSensitive: void 0,
    module: route22
  },
  "routes/app.products": {
    id: "routes/app.products",
    parentId: "routes/app",
    path: "products",
    index: void 0,
    caseSensitive: void 0,
    module: route23
  },
  "routes/app.settings": {
    id: "routes/app.settings",
    parentId: "routes/app",
    path: "settings",
    index: void 0,
    caseSensitive: void 0,
    module: route24
  },
  "routes/app.billing": {
    id: "routes/app.billing",
    parentId: "routes/app",
    path: "billing",
    index: void 0,
    caseSensitive: void 0,
    module: route25
  },
  "routes/app.billing.return": {
    id: "routes/app.billing.return",
    parentId: "routes/app.billing",
    path: "return",
    index: void 0,
    caseSensitive: void 0,
    module: route26
  },
  "routes/app.sitemap": {
    id: "routes/app.sitemap",
    parentId: "routes/app",
    path: "sitemap",
    index: void 0,
    caseSensitive: void 0,
    module: route27
  },
  "routes/app._index": {
    id: "routes/app._index",
    parentId: "routes/app",
    path: void 0,
    index: true,
    caseSensitive: void 0,
    module: route28
  },
  "routes/app.api.ai": {
    id: "routes/app.api.ai",
    parentId: "routes/app",
    path: "api/ai",
    index: void 0,
    caseSensitive: void 0,
    module: route29
  },
  "routes/app.robots": {
    id: "routes/app.robots",
    parentId: "routes/app",
    path: "robots",
    index: void 0,
    caseSensitive: void 0,
    module: route30
  }
};
const allowedActionOrigins = false;
export {
  allowedActionOrigins,
  serverManifest as assets,
  assetsBuildDirectory,
  basename,
  entry,
  future,
  isSpaMode,
  prerender,
  publicPath,
  routeDiscovery,
  routes,
  ssr
};
