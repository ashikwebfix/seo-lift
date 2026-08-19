var _a;
import { jsx, jsxs, Fragment } from "react/jsx-runtime";
import { PassThrough } from "stream";
import { renderToPipeableStream } from "react-dom/server";
import { ServerRouter, UNSAFE_withComponentProps, Meta, Links, Outlet, ScrollRestoration, Scripts, useLoaderData, useActionData, Form, redirect, UNSAFE_withErrorBoundaryProps, useRouteError, useFetcher, Link, useNavigation, useLocation } from "react-router";
import { createReadableStreamFromReadable } from "@react-router/node";
import { isbot } from "isbot";
import "@shopify/shopify-app-react-router/adapters/node";
import { shopifyApp, AppDistribution, ApiVersion, LoginErrorType, boundary } from "@shopify/shopify-app-react-router/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import { PrismaClient } from "@prisma/client";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { useState, useMemo, useRef, useCallback, useEffect } from "react";
if (process.env.NODE_ENV !== "production") {
  if (!global.prismaGlobal) {
    global.prismaGlobal = new PrismaClient();
  }
}
const prisma = global.prismaGlobal ?? new PrismaClient();
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
const root = UNSAFE_withComponentProps(function App() {
  return /* @__PURE__ */ jsxs("html", {
    lang: "en",
    children: [/* @__PURE__ */ jsxs("head", {
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
        href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap",
        rel: "stylesheet"
      }), /* @__PURE__ */ jsx(Meta, {}), /* @__PURE__ */ jsx(Links, {})]
    }), /* @__PURE__ */ jsxs("body", {
      children: [/* @__PURE__ */ jsx(Outlet, {}), /* @__PURE__ */ jsx(ScrollRestoration, {}), /* @__PURE__ */ jsx(Scripts, {})]
    })]
  });
});
const route0 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: root
}, Symbol.toStringTag, { value: "Module" }));
const action$c = async ({
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
const route1 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$c
}, Symbol.toStringTag, { value: "Module" }));
const action$b = async ({
  request
}) => {
  const {
    shop,
    session,
    topic
  } = await authenticate.webhook(request);
  console.log(`Received ${topic} webhook for ${shop}`);
  if (session) {
    await prisma.session.deleteMany({
      where: {
        shop
      }
    });
  }
  return new Response();
};
const route2 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$b
}, Symbol.toStringTag, { value: "Module" }));
function loginErrorMessage(loginErrors) {
  if ((loginErrors == null ? void 0 : loginErrors.shop) === LoginErrorType.MissingShop) {
    return { shop: "Please enter your shop domain to log in" };
  } else if ((loginErrors == null ? void 0 : loginErrors.shop) === LoginErrorType.InvalidShop) {
    return { shop: "Please enter a valid shop domain to log in" };
  }
  return {};
}
const loader$e = async ({
  request
}) => {
  const errors = loginErrorMessage(await login(request));
  return {
    errors
  };
};
const action$a = async ({
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
    children: /* @__PURE__ */ jsx("s-page", {
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
const route3 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$a,
  default: route$1,
  loader: loader$e
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
const loader$d = async ({
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
const route4 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: route,
  loader: loader$d
}, Symbol.toStringTag, { value: "Module" }));
const loader$c = async ({
  request
}) => {
  await authenticate.admin(request);
  return null;
};
const headers$1 = (headersArgs) => {
  return boundary.headers(headersArgs);
};
const route5 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  headers: headers$1,
  loader: loader$c
}, Symbol.toStringTag, { value: "Module" }));
const AI_FEATURES_ENABLED = false;
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
async function shopifyRestRequest({
  storeDomain,
  token,
  apiVersion,
  path,
  method = "GET",
  body
}) {
  const url = `https://${storeDomain}/admin/api/${apiVersion}${path}`;
  const response = await fetch(url, {
    method,
    headers: {
      "X-Shopify-Access-Token": token,
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: body ? JSON.stringify(body) : void 0
  });
  const text2 = await response.text();
  const contentType = response.headers.get("content-type") || "";
  const json = contentType.includes("application/json") && text2 ? JSON.parse(text2) : null;
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
  variables = {}
}) {
  const url = `https://${storeDomain}/admin/api/${apiVersion}/graphql.json`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "X-Shopify-Access-Token": token,
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify({ query, variables })
  });
  const text2 = await response.text();
  const contentType = response.headers.get("content-type") || "";
  const json = contentType.includes("application/json") && text2 ? JSON.parse(text2) : null;
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
async function fetchProducts({
  storeDomain,
  token,
  apiVersion,
  limit = 20,
  pageInfo = "",
  query = ""
}) {
  var _a2, _b;
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  if (pageInfo) {
    params.set("page_info", pageInfo);
  } else {
    params.set("fields", [
      "id",
      "title",
      "handle",
      "status",
      "updated_at",
      "metafields_global_title_tag",
      "metafields_global_description_tag"
    ].join(","));
  }
  if (query && !pageInfo) {
    params.set("title", query);
  }
  const { data, pagination } = await shopifyRestRequest({
    storeDomain,
    token,
    apiVersion,
    path: `/products.json?${params.toString()}`
  });
  const products = Array.isArray(data.products) ? data.products : [];
  if (!products.length) {
    return {
      products,
      pagination
    };
  }
  const ids = products.map((product) => toProductGid(product.id));
  const seoById = /* @__PURE__ */ new Map();
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
    variables: { ids }
  });
  for (const node of (seoData == null ? void 0 : seoData.nodes) || []) {
    const id = fromProductGid(node == null ? void 0 : node.id);
    if (!id) continue;
    seoById.set(id, {
      title: (_a2 = node == null ? void 0 : node.seo) == null ? void 0 : _a2.title,
      description: (_b = node == null ? void 0 : node.seo) == null ? void 0 : _b.description
    });
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
  const { data, pagination } = await shopifyRestRequest({
    storeDomain,
    token,
    apiVersion,
    path: `/products.json?${params.toString()}`
  });
  const products = Array.isArray(data.products) ? data.products : [];
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
async function updateProductSeo({
  storeDomain,
  token,
  apiVersion,
  productId,
  payload
}) {
  var _a2, _b;
  const data = await shopifyGraphqlRequest({
    storeDomain,
    token,
    apiVersion,
    query: `
      mutation UpdateProductSeo($input: ProductInput!) {
        productUpdate(input: $input) {
          product {
            id
            title
            handle
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
    `,
    variables: {
      input: {
        id: toProductGid(productId),
        title: payload.title,
        handle: payload.handle,
        seo: {
          title: payload.metaTitle,
          description: payload.metaDescription
        }
      }
    }
  });
  const userErrors = ((_a2 = data == null ? void 0 : data.productUpdate) == null ? void 0 : _a2.userErrors) || [];
  if (userErrors.length) {
    throw new Error(userErrors.map((entry2) => entry2.message).join(", "));
  }
  return ((_b = data == null ? void 0 : data.productUpdate) == null ? void 0 : _b.product) || null;
}
async function updateProductImageAlt({
  storeDomain,
  token,
  apiVersion,
  productId,
  imageId,
  altText
}) {
  const { data } = await shopifyRestRequest({
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
  return (data == null ? void 0 : data.image) || null;
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
  const code = "USD".toUpperCase();
  return ALLOWED_BILLING_CURRENCIES.has(code) ? code : "USD";
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
  const data = await shopifyGraphqlRequest({
    storeDomain,
    token,
    apiVersion,
    query,
    variables: {}
  });
  return ((_c = data == null ? void 0 : data.currentAppInstallation) == null ? void 0 : _c.activeSubscriptions) || [];
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
  const data = await shopifyGraphqlRequest({
    storeDomain,
    token,
    apiVersion,
    query,
    variables: {}
  });
  return sanitizeCurrencyCode((_c = data == null ? void 0 : data.shop) == null ? void 0 : _c.currencyCode);
}
async function adminGraphqlRequest(admin, mutation, variables) {
  try {
    const response = await admin.graphql(mutation, { variables });
    const json = await response.json();
    if (json == null ? void 0 : json.errors) {
      const msgs = Array.isArray(json.errors) ? json.errors.map((e) => e.message).join(", ") : String(json.errors);
      throw new Error(`Shopify GraphQL error: ${msgs}`);
    }
    return json;
  } catch (error) {
    if (error.graphQLErrors) {
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
            currencyCode: sanitizeCurrencyCode()
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
    const data = await shopifyGraphqlRequest({
      storeDomain,
      token,
      apiVersion,
      query: mutation,
      variables
    });
    payload = data == null ? void 0 : data.appSubscriptionCreate;
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
    const data = await shopifyGraphqlRequest({
      storeDomain,
      token,
      apiVersion,
      query: mutation,
      variables
    });
    payload = data == null ? void 0 : data.appSubscriptionCancel;
  }
  const userErrors = (payload == null ? void 0 : payload.userErrors) || [];
  if (userErrors.length) {
    throw new Error(
      `Shopify billing error: ${userErrors.map((e) => e.message).join(", ")}`
    );
  }
  return payload == null ? void 0 : payload.appSubscription;
}
const loader$b = async ({
  request
}) => {
  var _a2, _b;
  await authenticate.admin(request);
  const url = new URL(request.url);
  const pathname = url.pathname;
  const isBillingPath = pathname.startsWith("/app/billing");
  if (!isBillingPath) {
    try {
      const {
        admin,
        shop,
        token,
        apiVersion
      } = await requireShopContext(request);
      const activeSubscriptions = await getActiveAppSubscriptions({
        admin,
        storeDomain: shop,
        token,
        apiVersion
      });
      if (!(activeSubscriptions == null ? void 0 : activeSubscriptions.length)) {
        throw redirect(`/app/billing${url.search}`);
      }
    } catch (error) {
      if (error instanceof Response) throw error;
    }
  }
  return {
    apiKey: ((_b = (_a2 = globalThis.process) == null ? void 0 : _a2.env) == null ? void 0 : _b.SHOPIFY_API_KEY) || ""
  };
};
const app = UNSAFE_withComponentProps(function App3() {
  const {
    apiKey
  } = useLoaderData();
  return /* @__PURE__ */ jsxs(AppProvider, {
    embedded: true,
    apiKey,
    children: [/* @__PURE__ */ jsxs("s-app-nav", {
      children: [/* @__PURE__ */ jsx("s-link", {
        href: "/app",
        children: "Dashboard"
      }), /* @__PURE__ */ jsx("s-link", {
        href: "/app/seo-audit",
        children: "SEO Audit"
      }), /* @__PURE__ */ jsx("s-link", {
        href: "/app/products",
        children: "Product SEO"
      }), /* @__PURE__ */ jsx("s-link", {
        href: "/app/bulk-meta",
        children: "Bulk Meta"
      }), /* @__PURE__ */ jsx("s-link", {
        href: "/app/image-optimizer",
        children: "Image Optimizer"
      }), /* @__PURE__ */ jsx("s-link", {
        href: "/app/url-optimization",
        children: "URL Optimization"
      }), /* @__PURE__ */ jsx("s-link", {
        href: "/app/robots",
        children: "Robots.txt"
      }), /* @__PURE__ */ jsx("s-link", {
        href: "/app/sitemap",
        children: "Sitemap"
      }), null, /* @__PURE__ */ jsx("s-link", {
        href: "/app/billing",
        children: "💳 Billing"
      })]
    }), /* @__PURE__ */ jsx(Outlet, {})]
  });
});
const ErrorBoundary = UNSAFE_withErrorBoundaryProps(function ErrorBoundary2() {
  return boundary.error(useRouteError());
});
const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
const route6 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  ErrorBoundary,
  default: app,
  headers,
  loader: loader$b
}, Symbol.toStringTag, { value: "Module" }));
const seoStyles = "/assets/seo-BEcOi0od.css";
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
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}
function validateUrlHandle(value) {
  const clean = normalizeHandle(value);
  const validPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  const valid = clean.length >= 3 && clean.length <= 45 && validPattern.test(clean);
  return {
    valid,
    normalized: clean,
    message: valid ? "" : "URL handle must be lowercase, hyphenated, and 3-45 characters."
  };
}
function validateProductSeoInput(payload) {
  const cleanTitle = String(payload.title || "").trim();
  const cleanFocusKeyword = String(payload.focusKeyword || "").trim();
  const title = {
    valid: cleanTitle.length > 0,
    message: cleanTitle ? "" : "Product title is required."
  };
  const focusKeyword = cleanFocusKeyword ? validateFocusKeyword(cleanFocusKeyword) : { message: "" };
  const metaTitle = validateMetaTitle(payload.metaTitle);
  const metaDescription = validateMetaDescription(payload.metaDescription);
  const handle = validateUrlHandle(payload.handle);
  const errors = {
    title: title.message,
    focusKeyword: focusKeyword.message,
    metaTitle: metaTitle.message,
    metaDescription: metaDescription.message,
    handle: handle.message
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
      handle: handle.normalized
    },
    quality: {
      metaTitleIdeal: metaTitle.ideal,
      metaDescriptionIdeal: metaDescription.ideal
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
  return {
    id: String(product.id),
    title,
    focusKeyword,
    metaTitle,
    metaDescription,
    handle,
    updatedAt: product.updated_at || null,
    validation: {
      title: validateProductTitle(title),
      focusKeyword: validateFocusKeyword(focusKeyword),
      metaTitle: validateMetaTitle(metaTitle),
      metaDescription: validateMetaDescription(metaDescription),
      handle: validateUrlHandle(handle)
    }
  };
}
const DEFAULT_AI_SETTINGS = Object.freeze({
  provider: "gemini",
  model: "gemini-2.5-flash",
  apiKey: ""
});
function looksLikeGeminiApiKey(value) {
  const clean = cleanText(value);
  return /^AIza[0-9A-Za-z_-]{20,}$/.test(clean);
}
function maskApiKey(value) {
  const clean = cleanText(value);
  if (!clean) return "";
  if (clean.length <= 8) return "*".repeat(clean.length);
  return `${clean.slice(0, 4)}...${clean.slice(-4)}`;
}
function getAiSettingsStatus(settings = {}) {
  const normalized = normalizeAiSettings(settings);
  const hasApiKey = Boolean(normalized.apiKey);
  return {
    hasApiKey,
    apiKeyMask: maskApiKey(normalized.apiKey),
    apiKeyLooksValid: normalized.provider === "gemini" ? looksLikeGeminiApiKey(normalized.apiKey) : hasApiKey
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
async function requestGeminiJson({ model, apiKey, prompt }) {
  var _a2, _b, _c, _d, _e;
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
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
          temperature: 0.4,
          responseMimeType: "application/json"
        }
      })
    }
  );
  const rawText = await response.text();
  let parsedBody = null;
  try {
    parsedBody = rawText ? JSON.parse(rawText) : null;
  } catch {
    parsedBody = null;
  }
  if (!response.ok) {
    const message = ((_a2 = parsedBody == null ? void 0 : parsedBody.error) == null ? void 0 : _a2.message) || `AI provider request failed with status ${response.status}.`;
    throw new Error(message);
  }
  const text2 = (_e = (_d = (_c = (_b = parsedBody == null ? void 0 : parsedBody.candidates) == null ? void 0 : _b[0]) == null ? void 0 : _c.content) == null ? void 0 : _d.parts) == null ? void 0 : _e.map((part) => part.text || "").join("").trim();
  return parseJsonObject(text2);
}
async function requestSeoFixFromProvider({ settings, prompt }) {
  const normalizedSettings = normalizeAiSettings(settings);
  if (!normalizedSettings.apiKey) {
    throw new Error("Add a Gemini API key in Settings before using AI Fix.");
  }
  if (normalizedSettings.provider !== "gemini") {
    throw new Error(`Unsupported AI provider: ${normalizedSettings.provider}`);
  }
  try {
    return await requestGeminiJson({
      model: normalizedSettings.model,
      apiKey: normalizedSettings.apiKey,
      prompt
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
function normalizeProductSeoSuggestion(input2, fallbackSource) {
  const fallback = buildProductFallback(fallbackSource);
  const normalized = normalizeAiResponse(input2);
  return {
    title: validateProductTitle(normalized.title).valid ? normalized.title : fallback.title,
    focusKeyword: validateFocusKeyword(normalized.focusKeyword).valid ? normalized.focusKeyword : fallback.focusKeyword,
    handle: validateUrlHandle(normalized.handle).valid ? validateUrlHandle(normalized.handle).normalized : fallback.handle,
    metaTitle: validateMetaTitle(normalized.metaTitle).valid && validateMetaTitle(normalized.metaTitle).ideal ? normalized.metaTitle : fallback.metaTitle,
    metaDescription: validateMetaDescription(normalized.metaDescription).valid && validateMetaDescription(normalized.metaDescription).ideal ? normalized.metaDescription : fallback.metaDescription,
    rationale: normalized.rationale || "Generated with AI and normalized to ideal SEO ranges."
  };
}
async function generateProductSeoFix({ settings, title, focusKeyword, handle, metaTitle, metaDescription }) {
  const prompt = `
Create improved ecommerce SEO fields for a Shopify product.

Return JSON with keys:
- title
- focusKeyword
- handle
- metaTitle
- metaDescription
- rationale

Hard rules:
- title must be 25-70 characters
- focusKeyword must be 3-40 characters
- handle must be lowercase, hyphenated, 3-45 characters
- metaTitle must be 45-60 characters
- metaDescription must be 120-155 characters
- keep language clear, specific, and purchase-oriented
- use the focus keyword naturally

Current values:
${JSON.stringify({ title, focusKeyword, handle, metaTitle, metaDescription }, null, 2)}
`.trim();
  const response = await requestSeoFixFromProvider({ settings, prompt });
  return normalizeProductSeoSuggestion(response, {
    title,
    focusKeyword,
    handle
  });
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
const DEFAULT_ROBOTS = `User-agent: *
Disallow: /cart
Disallow: /search
Allow: /`;
const DEFAULT_STATE = {
  productSeo: {},
  imageOptimizerHistory: [],
  lastScan: null,
  scoreHistory: [],
  robotsTxt: DEFAULT_ROBOTS,
  sitemapManualUrls: [],
  sitemapGeneratedAt: null,
  sitemapUrls: [],
  aiSettings: { ...DEFAULT_AI_SETTINGS }
};
function parseState(jsonText) {
  if (!jsonText) return { ...DEFAULT_STATE };
  try {
    const parsed = JSON.parse(jsonText);
    return {
      ...DEFAULT_STATE,
      ...parsed,
      productSeo: parsed.productSeo || {},
      imageOptimizerHistory: Array.isArray(parsed.imageOptimizerHistory) ? parsed.imageOptimizerHistory : [],
      scoreHistory: Array.isArray(parsed.scoreHistory) ? parsed.scoreHistory : [],
      sitemapManualUrls: Array.isArray(parsed.sitemapManualUrls) ? parsed.sitemapManualUrls : [],
      sitemapUrls: Array.isArray(parsed.sitemapUrls) ? parsed.sitemapUrls : [],
      aiSettings: normalizeAiSettings(parsed.aiSettings || {})
    };
  } catch {
    return { ...DEFAULT_STATE };
  }
}
async function getAppState(shop) {
  const record = await prisma.appState.findUnique({ where: { shop } });
  if (!record) return { ...DEFAULT_STATE };
  return parseState(record.stateJson);
}
async function setAppState(shop, nextState) {
  return prisma.appState.upsert({
    where: { shop },
    update: { stateJson: JSON.stringify(nextState) },
    create: { shop, stateJson: JSON.stringify(nextState) }
  });
}
async function updateAppState(shop, mutator) {
  const current = await getAppState(shop);
  const next = mutator(current);
  await setAppState(shop, next);
  return next;
}
function addIssue(issues, severity, title, targetUrl, detail, fixPath) {
  issues.push({
    id: `${severity}-${issues.length + 1}`,
    severity,
    title,
    targetUrl,
    detail,
    fixPath
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
function buildSeoAudit({ storeDomain, products, appState }) {
  var _a2;
  const issues = [];
  let indexable = 0;
  for (const product of products) {
    const productUrl = `https://${storeDomain}/products/${product.handle}`;
    const productState = ((_a2 = appState.productSeo) == null ? void 0 : _a2[String(product.id)]) || {};
    const titleValid = validateProductTitle(product.title);
    if (!titleValid.valid) {
      addIssue(
        issues,
        "Warning",
        "Product title length issue",
        productUrl,
        "Product title should be between 25 and 70 characters.",
        `/app/products?focus=${product.id}`
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
        `/app/products?focus=${product.id}`
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
        `/app/products?focus=${product.id}`
      );
    } else if (!metaTitleValid.ideal) {
      addIssue(
        issues,
        "Warning",
        "Meta title outside ideal length",
        productUrl,
        "Ideal meta title length is 45-60 characters.",
        `/app/products?focus=${product.id}`
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
        `/app/products?focus=${product.id}`
      );
    } else if (!metaDescriptionValid.ideal) {
      addIssue(
        issues,
        "Warning",
        "Meta description outside ideal length",
        productUrl,
        "Ideal meta description length is 120-155 characters.",
        `/app/products?focus=${product.id}`
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
        `/app/url-optimization?focus=${product.id}`
      );
    }
    if (titleValid.valid && metaTitleValid.valid && metaDescriptionValid.valid && handleValid.valid) {
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
      lastScanDate: (/* @__PURE__ */ new Date()).toISOString()
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
async function runFullScan({ storeDomain, token, apiVersion, shop }) {
  const appState = await getAppState(shop);
  const { products } = await fetchProducts({
    storeDomain,
    token,
    apiVersion,
    limit: 250
  });
  const audit = buildSeoAudit({
    storeDomain,
    products,
    appState
  });
  const next = await updateAppState(shop, (current) => {
    const trend = buildTrendSummary(current.scoreHistory, audit.summary.score);
    const scoreHistory = [...current.scoreHistory, { date: audit.generatedAt, score: audit.summary.score }].slice(-20);
    return {
      ...current,
      lastScan: {
        ...audit,
        trend
      },
      scoreHistory
    };
  });
  return next.lastScan;
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
  query = ""
}) {
  const appState = await getAppState(shop);
  const { products, pagination } = await fetchProducts({
    storeDomain,
    token,
    apiVersion,
    limit,
    pageInfo,
    query
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
  await updateProductSeo({
    storeDomain,
    token,
    apiVersion,
    productId,
    payload: validation.normalized
  });
  await updateAppState(shop, (current) => {
    var _a2;
    return {
      ...current,
      productSeo: {
        ...current.productSeo,
        [String(productId)]: {
          ...((_a2 = current.productSeo) == null ? void 0 : _a2[String(productId)]) || {},
          focusKeyword: validation.normalized.focusKeyword
        }
      }
    };
  });
  await runFullScan({
    shop,
    storeDomain,
    token,
    apiVersion
  });
  return {
    ok: true,
    productId: String(productId),
    normalized: validation.normalized,
    quality: validation.quality
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
  await Promise.all(
    rows.map(
      (row) => updateProductSeo({
        storeDomain,
        token,
        apiVersion,
        productId: row.id,
        payload: {
          title: row.title,
          handle: validateUrlHandle(row.handle || row.title).normalized,
          metaTitle: String(row.metaTitle || "").trim(),
          metaDescription: String(row.metaDescription || "").trim()
        }
      })
    )
  );
  await runFullScan({
    shop,
    storeDomain,
    token,
    apiVersion
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
  await Promise.all(
    normalizedRows.map(
      (row) => updateProductSeo({
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
      })
    )
  );
  await runFullScan({
    shop,
    storeDomain,
    token,
    apiVersion
  });
  return {
    ok: true,
    updated: normalizedRows.length
  };
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
  try {
    await Promise.all(
      normalizedRows.map(
        (row) => updateProductImageAlt({
          storeDomain,
          token,
          apiVersion,
          productId: row.productId,
          imageId: row.id,
          altText: row.altText
        })
      )
    );
    await runFullScan({
      shop,
      storeDomain,
      token,
      apiVersion
    });
  } catch (error) {
    const historyState2 = await appendImageOptimizerHistory({
      shop,
      action: "fix",
      status: "failed",
      summary: preCheck.summary,
      attempted: normalizedRows.length,
      updated: 0,
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
  const { products } = await fetchProducts({
    storeDomain,
    token,
    apiVersion,
    limit: 250
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
const links$a = () => [{
  rel: "stylesheet",
  href: seoStyles
}];
const loader$a = async ({
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
  const result = await loadProductsPage({
    shop,
    storeDomain: shop,
    token,
    apiVersion,
    limit: 50
  });
  return {
    configError: "",
    rows: result.rows.map((row) => ({
      ...row,
      suggestedHandle: normalizeHandle(row.focusKeyword ? `${row.focusKeyword} ${row.title}` : row.title)
    }))
  };
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
  const data = useLoaderData();
  const fetcher = useFetcher();
  const [selected, setSelected] = useState({});
  const rows = useMemo(() => data.rows || [], [data.rows]);
  const dirtyRows = rows.filter((row) => row.handle !== row.suggestedHandle);
  function toggle(id, checked) {
    setSelected((current) => ({
      ...current,
      [id]: checked
    }));
  }
  function applySelected() {
    const chosen = dirtyRows.filter((row) => selected[row.id]);
    fetcher.submit({
      rows: JSON.stringify(chosen.map((row) => ({
        id: row.id,
        title: row.title,
        handle: row.handle,
        suggestedHandle: row.suggestedHandle,
        metaTitle: row.metaTitle,
        metaDescription: row.metaDescription
      })))
    }, {
      method: "post"
    });
  }
  return /* @__PURE__ */ jsx("s-page", {
    heading: "URL Optimization",
    children: /* @__PURE__ */ jsxs("div", {
      className: "seo-wrap seo-grid",
      children: [data.configError ? /* @__PURE__ */ jsx("div", {
        className: "error-box",
        children: data.configError
      }) : null, /* @__PURE__ */ jsxs("div", {
        className: "toolbar",
        children: [/* @__PURE__ */ jsx("button", {
          className: "seo-button",
          type: "button",
          onClick: applySelected,
          children: "Bulk apply clean URLs"
        }), /* @__PURE__ */ jsx(Link, {
          to: "/app",
          children: "Dashboard"
        })]
      }), ((_a2 = fetcher.data) == null ? void 0 : _a2.error) ? /* @__PURE__ */ jsx("div", {
        className: "error-box",
        children: fetcher.data.error
      }) : null, ((_b = fetcher.data) == null ? void 0 : _b.ok) ? /* @__PURE__ */ jsxs("div", {
        className: "section-card",
        children: ["Updated ", fetcher.data.updated, " URLs."]
      }) : null, !dirtyRows.length ? /* @__PURE__ */ jsx("div", {
        className: "empty-box",
        children: "All visible product handles are already normalized."
      }) : /* @__PURE__ */ jsx("div", {
        className: "table-card table-wrap",
        children: /* @__PURE__ */ jsxs("table", {
          children: [/* @__PURE__ */ jsx("thead", {
            children: /* @__PURE__ */ jsxs("tr", {
              children: [/* @__PURE__ */ jsx("th", {
                children: "Select"
              }), /* @__PURE__ */ jsx("th", {
                children: "Product"
              }), /* @__PURE__ */ jsx("th", {
                children: "Current handle"
              }), /* @__PURE__ */ jsx("th", {
                children: "Suggested handle"
              })]
            })
          }), /* @__PURE__ */ jsx("tbody", {
            children: dirtyRows.map((row) => /* @__PURE__ */ jsxs("tr", {
              children: [/* @__PURE__ */ jsx("td", {
                children: /* @__PURE__ */ jsx("input", {
                  type: "checkbox",
                  checked: Boolean(selected[row.id]),
                  onChange: (event) => toggle(row.id, event.target.checked)
                })
              }), /* @__PURE__ */ jsx("td", {
                children: row.title
              }), /* @__PURE__ */ jsx("td", {
                children: row.handle
              }), /* @__PURE__ */ jsx("td", {
                children: row.suggestedHandle
              })]
            }, row.id))
          })]
        })
      })]
    })
  });
});
const route7 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$9,
  default: app_urlOptimization,
  links: links$a,
  loader: loader$a
}, Symbol.toStringTag, { value: "Module" }));
const links$9 = () => [{
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
const loader$9 = async ({
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
const action$8 = async ({
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
function formatDate$1(value) {
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
  var _a2, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k;
  const loaderData = useLoaderData();
  const actionFetcher = useFetcher();
  const listFetcher = useFetcher();
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
  return /* @__PURE__ */ jsx("s-page", {
    heading: "Image Optimizer",
    children: /* @__PURE__ */ jsxs("div", {
      className: "seo-wrap seo-grid",
      children: [pageData.configError ? /* @__PURE__ */ jsx("div", {
        className: "error-box",
        children: pageData.configError
      }) : null, localError ? /* @__PURE__ */ jsx("div", {
        className: "error-box",
        children: localError
      }) : null, ((_d = actionFetcher.data) == null ? void 0 : _d.error) ? /* @__PURE__ */ jsx("div", {
        className: "error-box",
        children: actionFetcher.data.error
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
        }), /* @__PURE__ */ jsx(Link, {
          to: "/app",
          children: "Dashboard"
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
            children: ["Last run: ", formatDate$1(lastRun == null ? void 0 : lastRun.createdAt)]
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
      }), ((_e = actionFetcher.data) == null ? void 0 : _e.ok) && ((_f = actionFetcher.data) == null ? void 0 : _f.intent) === "checkAlt" ? /* @__PURE__ */ jsxs("div", {
        className: "section-card",
        children: [/* @__PURE__ */ jsx("strong", {
          children: "Check complete:"
        }), " ", ((_g = actionFetcher.data.summary) == null ? void 0 : _g.needsFix) || 0, " need fixes, ", ((_h = actionFetcher.data.summary) == null ? void 0 : _h.ideal) || 0, " are healthy,", " ", ((_i = actionFetcher.data.summary) == null ? void 0 : _i.missing) || 0, " missing ALT."]
      }) : null, ((_j = actionFetcher.data) == null ? void 0 : _j.ok) && ((_k = actionFetcher.data) == null ? void 0 : _k.intent) === "fixAlt" ? /* @__PURE__ */ jsxs("div", {
        className: "section-card",
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
                  }), /* @__PURE__ */ jsx("small", {
                    children: "Used by Fix selected / Update all visible"
                  })]
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
                    children: formatDate$1(entry2.createdAt)
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
    })
  });
});
const route8 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$8,
  default: app_imageOptimizer,
  links: links$9,
  loader: loader$9,
  shouldRevalidate: shouldRevalidate$1
}, Symbol.toStringTag, { value: "Module" }));
const links$8 = () => [{
  rel: "stylesheet",
  href: seoStyles
}];
const loader$8 = async ({
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
  const result = await loadProductsPage({
    shop,
    storeDomain: shop,
    token,
    apiVersion,
    limit: 50
  });
  return {
    configError: "",
    rows: result.rows
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
  var _a2, _b, _c;
  const data = useLoaderData();
  const fetcher = useFetcher();
  const aiFetcher = useFetcher();
  const [rows, setRows] = useState(data.rows || []);
  const [aiRowId, setAiRowId] = useState("");
  const [lastAiAppliedRowId, setLastAiAppliedRowId] = useState("");
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
        metaDescription: row.metaDescription
      })))
    }, {
      method: "post"
    });
  }
  useEffect(() => {
    var _a3, _b2, _c2, _d, _e;
    if (((_a3 = aiFetcher.data) == null ? void 0 : _a3.ok) && ((_b2 = aiFetcher.data) == null ? void 0 : _b2.actionType) === "meta_fix" && aiRowId) {
      patchRow(aiRowId, {
        metaTitle: ((_c2 = aiFetcher.data.result) == null ? void 0 : _c2.metaTitle) || "",
        metaDescription: ((_d = aiFetcher.data.result) == null ? void 0 : _d.metaDescription) || ""
      });
      setLastAiAppliedRowId(aiRowId);
      setAiRowId("");
    }
    if ((_e = aiFetcher.data) == null ? void 0 : _e.error) {
      setAiRowId("");
    }
  }, [aiFetcher.data, aiRowId]);
  return /* @__PURE__ */ jsx("s-page", {
    heading: "Bulk Meta Editor",
    children: /* @__PURE__ */ jsxs("div", {
      className: "seo-wrap seo-grid",
      children: [data.configError ? /* @__PURE__ */ jsx("div", {
        className: "error-box",
        children: data.configError
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
          children: "Save meta"
        }), /* @__PURE__ */ jsx(Link, {
          to: "/app",
          children: "Dashboard"
        })]
      }), ((_a2 = fetcher.data) == null ? void 0 : _a2.error) ? /* @__PURE__ */ jsx("div", {
        className: "error-box",
        children: fetcher.data.error
      }) : null, ((_b = fetcher.data) == null ? void 0 : _b.message) ? /* @__PURE__ */ jsx("div", {
        className: "error-box",
        children: fetcher.data.message
      }) : null, ((_c = aiFetcher.data) == null ? void 0 : _c.error) ? /* @__PURE__ */ jsx("div", {
        className: "error-box",
        children: aiFetcher.data.error
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
            children: rows.map((row) => /* @__PURE__ */ jsxs("tr", {
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
                children: [null, null]
              })]
            }, row.id))
          })]
        })
      })]
    })
  });
});
const route9 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$7,
  default: app_bulkMeta,
  links: links$8,
  loader: loader$8
}, Symbol.toStringTag, { value: "Module" }));
function StatusPill({ tone, children }) {
  return /* @__PURE__ */ jsx("span", { className: `pill pill-${tone}`, children });
}
function MetricCard({ label: label2, value, helpText }) {
  return /* @__PURE__ */ jsxs("div", { className: "metric-card", children: [
    /* @__PURE__ */ jsx("p", { className: "metric-label", children: label2 }),
    /* @__PURE__ */ jsx("h3", { children: value }),
    helpText ? /* @__PURE__ */ jsx("p", { className: "metric-help", children: helpText }) : null
  ] });
}
function FeatureCard({ title, description, to }) {
  return /* @__PURE__ */ jsxs(Link, { to, className: "feature-card", children: [
    /* @__PURE__ */ jsx("h4", { children: title }),
    /* @__PURE__ */ jsx("p", { children: description }),
    /* @__PURE__ */ jsx("span", { children: "Open" })
  ] });
}
const links$7 = () => [{
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
  const appState = shop ? await getAppState(shop) : null;
  return {
    configError,
    scan: (appState == null ? void 0 : appState.lastScan) || null
  };
};
const action$6 = async ({
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
    const scan = await runFullScan({
      shop,
      storeDomain: shop,
      token,
      apiVersion
    });
    return {
      ok: true,
      scan
    };
  } catch (error) {
    return {
      ok: false,
      error: (error == null ? void 0 : error.message) || "Failed to run SEO scan."
    };
  }
};
const severityRank = {
  Critical: 0,
  Warning: 1,
  Info: 2
};
function severityTone(severity) {
  if (severity === "Critical") return "critical";
  if (severity === "Warning") return "warning";
  return "info";
}
const app_seoAudit = UNSAFE_withComponentProps(function SeoAuditRoute() {
  var _a2, _b, _c, _d, _e, _f, _g;
  const data = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const scan = (actionData == null ? void 0 : actionData.scan) || data.scan;
  const issues = [...(scan == null ? void 0 : scan.issues) || []].sort((a, b) => {
    return (severityRank[a.severity] ?? 99) - (severityRank[b.severity] ?? 99);
  });
  const isSubmitting = navigation.state === "submitting";
  return /* @__PURE__ */ jsx("s-page", {
    heading: "SEO Audit / Scan",
    children: /* @__PURE__ */ jsxs("div", {
      className: "seo-wrap seo-grid",
      children: [data.configError ? /* @__PURE__ */ jsx("div", {
        className: "error-box",
        children: data.configError
      }) : null, (actionData == null ? void 0 : actionData.error) ? /* @__PURE__ */ jsx("div", {
        className: "error-box",
        children: actionData.error
      }) : null, /* @__PURE__ */ jsxs("div", {
        className: "toolbar",
        children: [/* @__PURE__ */ jsx(Form, {
          method: "post",
          children: /* @__PURE__ */ jsx("button", {
            className: "seo-button",
            type: "submit",
            disabled: Boolean(data.configError),
            children: isSubmitting ? "Scanning..." : "Run store-wide scan"
          })
        }), /* @__PURE__ */ jsx(Link, {
          to: "/app",
          children: "Back to dashboard"
        })]
      }), /* @__PURE__ */ jsxs("div", {
        className: "seo-grid grid-4",
        children: [/* @__PURE__ */ jsxs("div", {
          className: "metric-card",
          children: [/* @__PURE__ */ jsx("p", {
            className: "metric-label",
            children: "Critical"
          }), /* @__PURE__ */ jsx("h3", {
            children: ((_b = (_a2 = scan == null ? void 0 : scan.summary) == null ? void 0 : _a2.counts) == null ? void 0 : _b.critical) ?? 0
          })]
        }), /* @__PURE__ */ jsxs("div", {
          className: "metric-card",
          children: [/* @__PURE__ */ jsx("p", {
            className: "metric-label",
            children: "Warning"
          }), /* @__PURE__ */ jsx("h3", {
            children: ((_d = (_c = scan == null ? void 0 : scan.summary) == null ? void 0 : _c.counts) == null ? void 0 : _d.warning) ?? 0
          })]
        }), /* @__PURE__ */ jsxs("div", {
          className: "metric-card",
          children: [/* @__PURE__ */ jsx("p", {
            className: "metric-label",
            children: "Info"
          }), /* @__PURE__ */ jsx("h3", {
            children: ((_f = (_e = scan == null ? void 0 : scan.summary) == null ? void 0 : _e.counts) == null ? void 0 : _f.info) ?? 0
          })]
        }), /* @__PURE__ */ jsxs("div", {
          className: "metric-card",
          children: [/* @__PURE__ */ jsx("p", {
            className: "metric-label",
            children: "Last Scan"
          }), /* @__PURE__ */ jsx("h3", {
            style: {
              fontSize: 16
            },
            children: ((_g = scan == null ? void 0 : scan.summary) == null ? void 0 : _g.lastScanDate) ? new Date(scan.summary.lastScanDate).toLocaleString() : "Never"
          })]
        })]
      }), !issues.length ? /* @__PURE__ */ jsx("div", {
        className: "empty-box",
        children: "No findings yet. Run a scan to generate prioritized issues."
      }) : /* @__PURE__ */ jsxs("div", {
        className: "section-card seo-grid",
        children: [/* @__PURE__ */ jsx("h3", {
          style: {
            margin: 0
          },
          children: "Prioritized Findings"
        }), issues.map((issue) => /* @__PURE__ */ jsxs("div", {
          className: "table-card",
          children: [/* @__PURE__ */ jsxs("div", {
            className: "toolbar",
            style: {
              justifyContent: "space-between"
            },
            children: [/* @__PURE__ */ jsx("strong", {
              children: issue.title
            }), /* @__PURE__ */ jsx(StatusPill, {
              tone: severityTone(issue.severity),
              children: issue.severity
            })]
          }), /* @__PURE__ */ jsx("p", {
            style: {
              marginBottom: 8
            },
            children: issue.detail
          }), /* @__PURE__ */ jsx("p", {
            style: {
              margin: "0 0 10px",
              color: "#5f6f86"
            },
            children: issue.targetUrl
          }), /* @__PURE__ */ jsx(Link, {
            to: issue.fixPath,
            children: "Fix now"
          })]
        }, issue.id))]
      })]
    })
  });
});
const route10 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$6,
  default: app_seoAudit,
  links: links$7,
  loader: loader$7
}, Symbol.toStringTag, { value: "Module" }));
const links$6 = () => [{
  rel: "stylesheet",
  href: seoStyles
}];
const loader$6 = async ({
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
      query,
      focusId,
      rows: [],
      pagination: {
        nextPageInfo: "",
        previousPageInfo: ""
      }
    };
  }
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
    query,
    focusId,
    rows: result.rows,
    pagination: result.pagination
  };
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
    handle: validateUrlHandle(row.handle)
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
  return items;
}
function getHealthStatus(validation) {
  const checks = [validation.title.valid, validation.focusKeyword.valid, validation.metaTitle.valid, validation.metaDescription.valid, validation.handle.valid, Boolean(validation.metaTitle.ideal), Boolean(validation.metaDescription.ideal)];
  const passed = checks.filter(Boolean).length;
  const percent = Math.round(passed / checks.length * 100);
  if (checks.slice(0, 5).some((item) => !item)) {
    return {
      tone: "red",
      label: "Needs fixes",
      percent
    };
  }
  if (!validation.metaTitle.ideal || !validation.metaDescription.ideal) {
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
  const keys = ["title", "focusKeyword", "metaTitle", "metaDescription", "handle"];
  return keys.filter((key) => String(row[key] || "") !== String(original[key] || "")).length;
}
const app_products = UNSAFE_withComponentProps(function ProductSeoRoute() {
  var _a2, _b;
  const data = useLoaderData();
  const saveFetcher = useFetcher();
  const listFetcher = useFetcher();
  const aiFetcher = useFetcher();
  const [pageData, setPageData] = useState(() => ({
    configError: data.configError || "",
    query: data.query || "",
    focusId: data.focusId || "",
    rows: data.rows || [],
    pagination: data.pagination || {
      nextPageInfo: "",
      previousPageInfo: ""
    }
  }));
  const [searchQuery, setSearchQuery] = useState(data.query || "");
  const {
    rows,
    patchRow,
    clearRow
  } = useDraftStore(pageData.rows || []);
  const [openRowId, setOpenRowId] = useState(data.focusId || "");
  const [savingRowId, setSavingRowId] = useState("");
  const [aiRowId, setAiRowId] = useState("");
  const [lastAiAppliedRowId, setLastAiAppliedRowId] = useState("");
  const syncPageData = useCallback((nextData) => {
    setPageData({
      configError: nextData.configError || "",
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
    syncPageData(data);
  }, [data, syncPageData]);
  useEffect(() => {
    setOpenRowId((current) => {
      var _a3;
      if (!((_a3 = pageData.rows) == null ? void 0 : _a3.length)) return "";
      if (pageData.focusId && pageData.rows.some((row) => row.id === pageData.focusId)) {
        return pageData.focusId;
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
    }
    if ((_c = saveFetcher.data) == null ? void 0 : _c.error) {
      setSavingRowId("");
    }
  }, [saveFetcher.data, clearRow]);
  useEffect(() => {
    var _a3, _b2, _c;
    if (((_a3 = aiFetcher.data) == null ? void 0 : _a3.ok) && ((_b2 = aiFetcher.data) == null ? void 0 : _b2.actionType) === "product_seo_fix" && aiRowId) {
      patchRow(aiRowId, aiFetcher.data.result || {});
      setLastAiAppliedRowId(aiRowId);
      setAiRowId("");
    }
    if ((_c = aiFetcher.data) == null ? void 0 : _c.error) {
      setAiRowId("");
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
    saveFetcher.submit({
      payload: JSON.stringify(row)
    }, {
      method: "post"
    });
  }
  return /* @__PURE__ */ jsx("s-page", {
    heading: "Product SEO Management",
    children: /* @__PURE__ */ jsxs("div", {
      className: "seo-wrap seo-grid",
      children: [pageData.configError ? /* @__PURE__ */ jsx("div", {
        className: "error-box",
        children: pageData.configError
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
        }), /* @__PURE__ */ jsx("button", {
          className: "seo-button",
          type: "submit",
          disabled: listFetcher.state !== "idle",
          children: listFetcher.state !== "idle" ? "Searching..." : "Search"
        }), /* @__PURE__ */ jsx(Link, {
          to: "/app",
          children: "Dashboard"
        })]
      }), ((_a2 = saveFetcher.data) == null ? void 0 : _a2.error) ? /* @__PURE__ */ jsx("div", {
        className: "error-box",
        children: saveFetcher.data.error
      }) : null, ((_b = aiFetcher.data) == null ? void 0 : _b.error) ? /* @__PURE__ */ jsx("div", {
        className: "error-box",
        children: aiFetcher.data.error
      }) : null, !rows.length ? /* @__PURE__ */ jsx("div", {
        className: "empty-box",
        children: "No products found for the current filter."
      }) : /* @__PURE__ */ jsx("div", {
        className: "table-card product-list-card",
        children: /* @__PURE__ */ jsx("div", {
          className: "product-list",
          children: rows.map((row) => {
            const validation = getLiveValidation(row);
            const issues = getIssueItems(validation);
            const health = getHealthStatus(validation);
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
                    children: ["/products/", row.handle || "no-handle"]
                  })]
                }), /* @__PURE__ */ jsxs("div", {
                  className: "product-head-side",
                  children: [/* @__PURE__ */ jsx("span", {
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
                    children: [/* @__PURE__ */ jsx("strong", {
                      children: "Live SEO Status"
                    }), /* @__PURE__ */ jsxs("span", {
                      className: `health-text ${health.tone}`,
                      children: [health.percent, "%"]
                    })]
                  }), /* @__PURE__ */ jsx("div", {
                    className: "live-health-track",
                    children: /* @__PURE__ */ jsx("div", {
                      className: `live-health-bar ${health.tone}`,
                      style: {
                        width: `${health.percent}%`
                      }
                    })
                  }), /* @__PURE__ */ jsxs("div", {
                    className: "live-info-grid",
                    children: [/* @__PURE__ */ jsx("small", {
                      children: issues.length ? `${issues.length} active issue${issues.length > 1 ? "s" : ""}` : "No active SEO issues."
                    }), /* @__PURE__ */ jsx("small", {
                      children: changedCount ? `${changedCount} unsaved field change${changedCount > 1 ? "s" : ""}` : "No unsaved changes."
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
                  })]
                }), issues.length ? /* @__PURE__ */ jsx("div", {
                  className: "live-issues-area",
                  children: issues.map((issue, index2) => /* @__PURE__ */ jsx("p", {
                    className: `live-issue-line ${issue.tone}`,
                    children: issue.label
                  }, `${row.id}-detail-${index2}`))
                }) : null, /* @__PURE__ */ jsxs("div", {
                  className: "row-actions",
                  children: [null, /* @__PURE__ */ jsx("button", {
                    className: "seo-button",
                    type: "button",
                    onClick: () => saveRow(row),
                    disabled: saveFetcher.state !== "idle" && savingRowId === row.id,
                    children: saveFetcher.state !== "idle" && savingRowId === row.id ? "Saving..." : "Save Product SEO"
                  }), /* @__PURE__ */ jsx(Link, {
                    to: "/app/seo-audit",
                    children: "Open SEO Audit"
                  })]
                }), null]
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
    })
  });
});
const route11 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$5,
  default: app_products,
  links: links$6,
  loader: loader$6,
  shouldRevalidate
}, Symbol.toStringTag, { value: "Module" }));
const links$5 = () => [{
  rel: "stylesheet",
  href: seoStyles
}];
const loader$5 = async ({
  request
}) => {
  {
    return {
      configError: "",
      aiSettings: normalizeAiSettings(),
      aiStatus: getAiSettingsStatus(),
      hidden: true
    };
  }
};
const action$4 = async ({
  request
}) => {
  {
    return {
      ok: false,
      error: "AI settings are temporarily hidden."
    };
  }
};
const app_settings = UNSAFE_withComponentProps(function SettingsRoute() {
  const data = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const current = (actionData == null ? void 0 : actionData.ok) ? {
    aiSettings: actionData.aiSettings,
    aiStatus: actionData.aiStatus
  } : data;
  const isSubmitting = navigation.state === "submitting";
  return /* @__PURE__ */ jsx("s-page", {
    heading: "Settings",
    children: /* @__PURE__ */ jsxs("div", {
      className: "seo-wrap seo-grid",
      children: [data.hidden ? /* @__PURE__ */ jsxs("section", {
        className: "section-card",
        children: [/* @__PURE__ */ jsx("h3", {
          children: "Settings temporarily hidden"
        }), /* @__PURE__ */ jsx("p", {
          className: "metric-help",
          style: {
            margin: 0
          },
          children: "AI settings are still in the codebase, but the option is hidden from the app for now."
        })]
      }) : null, !data.hidden ? /* @__PURE__ */ jsxs(Fragment, {
        children: [data.configError ? /* @__PURE__ */ jsx("div", {
          className: "error-box",
          children: data.configError
        }) : null, (actionData == null ? void 0 : actionData.error) ? /* @__PURE__ */ jsx("div", {
          className: "error-box",
          children: actionData.error
        }) : null, (actionData == null ? void 0 : actionData.message) ? /* @__PURE__ */ jsx("div", {
          className: "metric-card",
          children: /* @__PURE__ */ jsx("strong", {
            children: actionData.message
          })
        }) : null, /* @__PURE__ */ jsxs("section", {
          className: "section-card",
          children: [/* @__PURE__ */ jsx("h3", {
            children: "AI Provider"
          }), /* @__PURE__ */ jsx("p", {
            className: "metric-help",
            children: "AI Fix uses the saved provider settings from this page. The default setup uses Gemini 2.5 Flash."
          }), /* @__PURE__ */ jsxs("div", {
            className: "metric-card",
            style: {
              marginTop: 16
            },
            children: [/* @__PURE__ */ jsx("p", {
              className: "metric-label",
              children: "AI status"
            }), /* @__PURE__ */ jsx("h3", {
              style: {
                marginBottom: 8
              },
              children: current.aiStatus.hasApiKey ? "Ready for AI Fix" : "API key needed"
            }), /* @__PURE__ */ jsxs("p", {
              className: "metric-help",
              style: {
                marginBottom: 4
              },
              children: ["Stored key: ", current.aiStatus.hasApiKey ? current.aiStatus.apiKeyMask : "Not saved"]
            }), /* @__PURE__ */ jsx("p", {
              className: "metric-help",
              style: {
                margin: 0
              },
              children: current.aiStatus.hasApiKey ? "For security, the full API key is never shown again after save." : "Add a Gemini API key to enable AI-generated SEO fixes."
            })]
          }), /* @__PURE__ */ jsxs(Form, {
            method: "post",
            className: "seo-grid",
            style: {
              marginTop: 16
            },
            children: [/* @__PURE__ */ jsxs("div", {
              className: "grid-2",
              children: [/* @__PURE__ */ jsxs("label", {
                className: "editor-field",
                children: [/* @__PURE__ */ jsx("span", {
                  children: "Provider"
                }), /* @__PURE__ */ jsx("select", {
                  className: "seo-input",
                  name: "provider",
                  defaultValue: current.aiSettings.provider,
                  children: /* @__PURE__ */ jsx("option", {
                    value: "gemini",
                    children: "Gemini"
                  })
                })]
              }), /* @__PURE__ */ jsxs("label", {
                className: "editor-field",
                children: [/* @__PURE__ */ jsx("span", {
                  children: "Model"
                }), /* @__PURE__ */ jsx("input", {
                  className: "seo-input",
                  name: "model",
                  defaultValue: current.aiSettings.model
                })]
              })]
            }), /* @__PURE__ */ jsxs("label", {
              className: "editor-field",
              children: [/* @__PURE__ */ jsx("span", {
                children: "API Key"
              }), /* @__PURE__ */ jsx("input", {
                className: "seo-input",
                type: "password",
                name: "apiKey",
                autoComplete: "new-password",
                autoCapitalize: "off",
                autoCorrect: "off",
                spellCheck: false,
                placeholder: current.aiStatus.hasApiKey ? "Saved. Leave blank to keep current key." : "Enter provider API key"
              }), /* @__PURE__ */ jsx("small", {
                children: current.aiStatus.hasApiKey ? `A key is already stored as ${current.aiStatus.apiKeyMask}. Leave this blank to keep it, or check remove below.` : "Save a Gemini API key here to enable AI Fix buttons across the app."
              })]
            }), /* @__PURE__ */ jsxs("label", {
              className: "editor-field",
              style: {
                gap: 8
              },
              children: [/* @__PURE__ */ jsxs("span", {
                style: {
                  display: "flex",
                  alignItems: "center",
                  gap: 8
                },
                children: [/* @__PURE__ */ jsx("input", {
                  type: "checkbox",
                  name: "clearApiKey",
                  value: "on"
                }), "Remove saved API key"]
              }), /* @__PURE__ */ jsx("small", {
                children: "Use this if you want to replace or clear the currently stored key."
              })]
            }), /* @__PURE__ */ jsxs("div", {
              className: "toolbar",
              children: [/* @__PURE__ */ jsx("button", {
                className: "seo-button",
                type: "submit",
                disabled: Boolean(data.configError) || isSubmitting,
                children: isSubmitting ? "Saving..." : "Save AI Settings"
              }), /* @__PURE__ */ jsx(Link, {
                to: "/app",
                children: "Dashboard"
              })]
            })]
          })]
        })]
      }) : null]
    })
  });
});
const route12 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$4,
  default: app_settings,
  links: links$5,
  loader: loader$5
}, Symbol.toStringTag, { value: "Module" }));
const PLAN_PRO$1 = "Ecom SEO Pro";
const links$4 = () => [{
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
      planName: null
    };
  }
  const activeSubscriptions = await getActiveAppSubscriptions({
    admin,
    storeDomain: shop,
    token,
    apiVersion
  });
  const subscription = activeSubscriptions[0] || null;
  return {
    configError: "",
    isSubscribed: Boolean(subscription),
    subscription,
    planName: (subscription == null ? void 0 : subscription.name) || null
  };
};
const action$3 = async ({
  request
}) => {
  const formData = await request.formData();
  const intent = formData.get("intent");
  const url = new URL(request.url);
  if (intent !== "trial" && intent !== "pro" && intent !== "cancel") {
    return redirect(`/app/billing${url.search}`);
  }
  const {
    auth,
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
    return redirect(`/app/billing${url.search}`);
  }
  const returnUrl = `${url.origin}/app/billing/return`;
  const test = true;
  const currencyCode = await getShopCurrencyCode({
    admin,
    storeDomain: shop,
    token,
    apiVersion
  });
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
};
const app_billing = UNSAFE_withComponentProps(function BillingPage() {
  var _a2;
  const {
    configError,
    isSubscribed,
    subscription,
    planName
  } = useLoaderData();
  const navigation = useNavigation();
  const submitting = navigation.state === "submitting";
  const actionData = useActionData();
  const location = useLocation();
  const submittingIntent = (_a2 = navigation.formData) == null ? void 0 : _a2.get("intent");
  useEffect(() => {
    if (actionData && actionData.externalRedirect) {
      window.top.location.href = actionData.externalRedirect;
    }
  }, [actionData]);
  if (isSubscribed) {
    const isPro = planName === PLAN_PRO$1;
    const hasTrial = isPro && ((subscription == null ? void 0 : subscription.trialDays) ?? 0) > 0;
    const status = (subscription == null ? void 0 : subscription.status) || "ACTIVE";
    return /* @__PURE__ */ jsx("s-page", {
      heading: "Billing & Plan",
      children: /* @__PURE__ */ jsxs("div", {
        className: "seo-wrap seo-grid",
        children: [configError ? /* @__PURE__ */ jsx("div", {
          className: "error-box",
          children: configError
        }) : null, /* @__PURE__ */ jsxs("div", {
          className: "plan-active-card",
          children: [/* @__PURE__ */ jsxs("div", {
            className: "plan-header",
            children: [/* @__PURE__ */ jsx("span", {
              className: "plan-icon",
              children: "🚀"
            }), /* @__PURE__ */ jsx("h2", {
              className: "plan-active-name",
              children: "Ecom SEO Pro"
            })]
          }), /* @__PURE__ */ jsx("hr", {
            className: "plan-divider"
          }), /* @__PURE__ */ jsxs("div", {
            className: "plan-status-row",
            children: [/* @__PURE__ */ jsx("span", {
              className: `plan-status-pill ${hasTrial ? "trial" : "active"}`,
              children: hasTrial ? `Trial — ${subscription.trialDays} days left` : status
            }), /* @__PURE__ */ jsx("p", {
              className: "metric-help",
              style: {
                margin: 0
              },
              children: "$12 / month"
            })]
          }), /* @__PURE__ */ jsx("p", {
            className: "metric-help",
            children: hasTrial ? "Your 7-day free trial is active. No charge until the trial ends. You can cancel anytime from the Shopify billing page." : "You have an active Pro subscription. All features are unlocked."
          }), /* @__PURE__ */ jsxs("div", {
            className: "toolbar",
            style: {
              gap: 12
            },
            children: [/* @__PURE__ */ jsx(Link, {
              to: `/app${location.search}`,
              className: "seo-button",
              children: "Go to Dashboard"
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
        })]
      })
    });
  }
  return /* @__PURE__ */ jsx("s-page", {
    heading: "Choose Your Plan",
    children: /* @__PURE__ */ jsxs("div", {
      className: "seo-wrap seo-grid",
      children: [configError ? /* @__PURE__ */ jsx("div", {
        className: "error-box",
        children: configError
      }) : null, /* @__PURE__ */ jsx("p", {
        className: "metric-help",
        children: "Start your 7-day free test drive, or jump straight into Pro."
      }), /* @__PURE__ */ jsxs("div", {
        className: "plan-grid",
        children: [/* @__PURE__ */ jsxs("div", {
          className: "plan-card",
          children: [/* @__PURE__ */ jsxs("div", {
            className: "plan-header",
            children: [/* @__PURE__ */ jsx("span", {
              className: "plan-icon",
              children: "🆓"
            }), /* @__PURE__ */ jsx("h3", {
              className: "plan-name",
              children: "Free Trial"
            })]
          }), /* @__PURE__ */ jsxs("p", {
            className: "plan-price",
            children: ["$0 ", /* @__PURE__ */ jsx("span", {
              children: "/ for 7 days"
            })]
          }), /* @__PURE__ */ jsxs("ul", {
            className: "plan-features",
            children: [/* @__PURE__ */ jsx("li", {
              children: "Full access to all Pro features"
            }), /* @__PURE__ */ jsx("li", {
              children: "Unlimited product SEO editing"
            }), /* @__PURE__ */ jsx("li", {
              children: "Bulk meta title & description editor"
            }), /* @__PURE__ */ jsx("li", {
              children: "Image ALT text optimizer"
            })]
          }), /* @__PURE__ */ jsxs("div", {
            className: "plan-cta",
            children: [/* @__PURE__ */ jsxs(Form, {
              method: "post",
              children: [/* @__PURE__ */ jsx("input", {
                type: "hidden",
                name: "intent",
                value: "trial"
              }), /* @__PURE__ */ jsx("button", {
                className: "seo-button btn-free",
                type: "submit",
                disabled: submitting,
                children: submitting && submittingIntent === "trial" ? "Redirecting to Shopify…" : "Start 7-Day Free Trial"
              })]
            }), /* @__PURE__ */ jsx("p", {
              className: "plan-note",
              children: "Auto-renews at $12/mo after 7 days."
            })]
          })]
        }), /* @__PURE__ */ jsxs("div", {
          className: "plan-card plan-pro",
          children: [/* @__PURE__ */ jsx("div", {
            className: "plan-badge",
            children: "Skip Trial"
          }), /* @__PURE__ */ jsxs("div", {
            className: "plan-header",
            children: [/* @__PURE__ */ jsx("span", {
              className: "plan-icon",
              children: "🚀"
            }), /* @__PURE__ */ jsx("h3", {
              className: "plan-name",
              children: "Pro Monthly"
            })]
          }), /* @__PURE__ */ jsxs("p", {
            className: "plan-price",
            children: ["$12 ", /* @__PURE__ */ jsx("span", {
              children: "/ month"
            })]
          }), /* @__PURE__ */ jsxs("ul", {
            className: "plan-features",
            children: [/* @__PURE__ */ jsx("li", {
              children: "Everything in Trial"
            }), /* @__PURE__ */ jsx("li", {
              children: "URL handle optimization"
            }), /* @__PURE__ */ jsx("li", {
              children: "AI-powered SEO fix suggestions"
            }), /* @__PURE__ */ jsx("li", {
              children: "Priority support"
            })]
          }), /* @__PURE__ */ jsxs("div", {
            className: "plan-cta",
            children: [/* @__PURE__ */ jsxs(Form, {
              method: "post",
              children: [/* @__PURE__ */ jsx("input", {
                type: "hidden",
                name: "intent",
                value: "pro"
              }), /* @__PURE__ */ jsx("button", {
                className: "seo-button",
                type: "submit",
                disabled: submitting,
                children: submitting && submittingIntent === "pro" ? "Redirecting to Shopify…" : "Subscribe to Pro"
              })]
            }), /* @__PURE__ */ jsx("p", {
              className: "plan-note",
              children: "No trial period. Direct charge."
            })]
          })]
        })]
      })]
    })
  });
});
const route13 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$3,
  default: app_billing,
  links: links$4,
  loader: loader$4
}, Symbol.toStringTag, { value: "Module" }));
const PLAN_PRO = "Ecom SEO Pro";
const links$3 = () => [{
  rel: "stylesheet",
  href: seoStyles
}];
const loader$3 = async ({
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
      planName: null
    };
  }
  const activeSubscriptions = await getActiveAppSubscriptions({
    admin,
    storeDomain: shop,
    token,
    apiVersion
  });
  const subscription = activeSubscriptions[0] || null;
  const planName = (subscription == null ? void 0 : subscription.name) || null;
  return {
    configError: "",
    isSubscribed: Boolean(subscription),
    subscription,
    planName
  };
};
const app_billing_return = UNSAFE_withComponentProps(function BillingReturnPage() {
  const {
    configError,
    isSubscribed,
    subscription,
    planName
  } = useLoaderData();
  const location = useLocation();
  const isPro = planName === PLAN_PRO;
  const hasTrial = isPro && ((subscription == null ? void 0 : subscription.trialDays) ?? 0) > 0;
  return /* @__PURE__ */ jsx("s-page", {
    heading: "Billing Confirmation",
    children: /* @__PURE__ */ jsxs("div", {
      className: "seo-wrap seo-grid",
      children: [configError ? /* @__PURE__ */ jsx("div", {
        className: "error-box",
        children: configError
      }) : null, /* @__PURE__ */ jsx("div", {
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
      })]
    })
  });
});
const route14 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: app_billing_return,
  links: links$3,
  loader: loader$3
}, Symbol.toStringTag, { value: "Module" }));
const links$2 = () => [{
  rel: "stylesheet",
  href: seoStyles
}];
const loader$2 = async ({
  request
}) => {
  const {
    shop,
    configError
  } = await requireShopContext(request);
  const appState = shop ? await getAppState(shop) : null;
  return {
    configError,
    generatedAt: (appState == null ? void 0 : appState.sitemapGeneratedAt) || null,
    urls: (appState == null ? void 0 : appState.sitemapUrls) || [],
    manualUrls: (appState == null ? void 0 : appState.sitemapManualUrls) || []
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
  if (configError) {
    return {
      ok: false,
      error: configError
    };
  }
  const formData = await request.formData();
  const manualUrl = String(formData.get("manualUrl") || "");
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
      ...result
    };
  } catch (error) {
    return {
      ok: false,
      error: (error == null ? void 0 : error.message) || "Failed to regenerate sitemap."
    };
  }
};
const app_sitemap = UNSAFE_withComponentProps(function SitemapRoute() {
  var _a2, _b, _c;
  const data = useLoaderData();
  const fetcher = useFetcher();
  const [manualUrl, setManualUrl] = useState("");
  const generatedAt = ((_a2 = fetcher.data) == null ? void 0 : _a2.generatedAt) || data.generatedAt;
  const urls = ((_b = fetcher.data) == null ? void 0 : _b.urls) || data.urls;
  function regenerate() {
    fetcher.submit({
      manualUrl
    }, {
      method: "post"
    });
    setManualUrl("");
  }
  return /* @__PURE__ */ jsx("s-page", {
    heading: "Sitemap Manager",
    children: /* @__PURE__ */ jsxs("div", {
      className: "seo-wrap seo-grid",
      children: [data.configError ? /* @__PURE__ */ jsx("div", {
        className: "error-box",
        children: data.configError
      }) : null, ((_c = fetcher.data) == null ? void 0 : _c.error) ? /* @__PURE__ */ jsx("div", {
        className: "error-box",
        children: fetcher.data.error
      }) : null, /* @__PURE__ */ jsxs("div", {
        className: "toolbar",
        children: [/* @__PURE__ */ jsx("input", {
          className: "seo-input",
          placeholder: "https://example.com/custom-page",
          value: manualUrl,
          onChange: (event) => setManualUrl(event.target.value),
          style: {
            maxWidth: 360
          }
        }), /* @__PURE__ */ jsx("button", {
          className: "seo-button",
          type: "button",
          onClick: regenerate,
          children: "Add manual URL + regenerate"
        }), /* @__PURE__ */ jsx(Link, {
          to: "/app",
          children: "Dashboard"
        })]
      }), /* @__PURE__ */ jsxs("div", {
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
            children: "URL count"
          }), /* @__PURE__ */ jsx("h3", {
            children: urls.length
          })]
        })]
      }), !urls.length ? /* @__PURE__ */ jsx("div", {
        className: "empty-box",
        children: "No sitemap URLs yet. Regenerate to populate current store data."
      }) : /* @__PURE__ */ jsx("div", {
        className: "section-card",
        children: /* @__PURE__ */ jsx("ul", {
          style: {
            margin: 0,
            paddingLeft: 18
          },
          children: urls.map((url) => /* @__PURE__ */ jsx("li", {
            children: url
          }, url))
        })
      })]
    })
  });
});
const route15 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$2,
  default: app_sitemap,
  links: links$2,
  loader: loader$2
}, Symbol.toStringTag, { value: "Module" }));
const links$1 = () => [{
  rel: "stylesheet",
  href: seoStyles
}];
const loader$1 = async ({
  request
}) => {
  var _a2, _b;
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
  return {
    configError,
    scanError,
    summary: (scan == null ? void 0 : scan.summary) || null,
    pagesScanned: (scan == null ? void 0 : scan.pagesScanned) || 0,
    issueCount: ((_a2 = scan == null ? void 0 : scan.issues) == null ? void 0 : _a2.length) || 0,
    indexCoverage: (scan == null ? void 0 : scan.indexCoverage) || 0,
    lastScanDate: ((_b = scan == null ? void 0 : scan.summary) == null ? void 0 : _b.lastScanDate) || null,
    trend: (scan == null ? void 0 : scan.trend) || null,
    scoreHistory: (appState == null ? void 0 : appState.scoreHistory) || []
  };
};
function formatDate(value) {
  if (!value) return "No scan yet";
  return new Date(value).toLocaleString();
}
const app__index = UNSAFE_withComponentProps(function DashboardPage() {
  const {
    configError,
    scanError,
    summary,
    pagesScanned,
    issueCount,
    indexCoverage,
    lastScanDate,
    trend,
    scoreHistory
  } = useLoaderData();
  const chartScoreHistory = [...scoreHistory || []];
  if (typeof (summary == null ? void 0 : summary.score) === "number" && !chartScoreHistory.some((entry2) => (entry2 == null ? void 0 : entry2.date) === (summary == null ? void 0 : summary.lastScanDate))) {
    chartScoreHistory.push({
      date: summary.lastScanDate || (/* @__PURE__ */ new Date()).toISOString(),
      score: summary.score
    });
  }
  const latestScores = chartScoreHistory.slice(-8);
  return /* @__PURE__ */ jsx("s-page", {
    heading: "Ecom SEO Dashboard",
    children: /* @__PURE__ */ jsxs("div", {
      className: "seo-wrap seo-grid",
      children: [configError ? /* @__PURE__ */ jsx("div", {
        className: "error-box",
        children: configError
      }) : null, scanError ? /* @__PURE__ */ jsx("div", {
        className: "error-box",
        children: scanError
      }) : null, /* @__PURE__ */ jsxs("div", {
        className: "toolbar",
        style: {
          justifyContent: "space-between"
        },
        children: [/* @__PURE__ */ jsxs("p", {
          style: {
            margin: 0
          },
          children: ["Overall health", " ", /* @__PURE__ */ jsx(StatusPill, {
            tone: (summary == null ? void 0 : summary.health) === "strong" ? "good" : (summary == null ? void 0 : summary.health) === "steady" ? "warning" : "critical",
            children: (summary == null ? void 0 : summary.health) || "unknown"
          })]
        }), /* @__PURE__ */ jsx(Link, {
          to: "/app/seo-audit",
          children: "Open SEO Audit"
        })]
      }), /* @__PURE__ */ jsx("p", {
        style: {
          margin: 0,
          color: "#5f6f86"
        },
        children: (trend == null ? void 0 : trend.label) || "Run recurring scans to track score trend."
      }), /* @__PURE__ */ jsxs("div", {
        className: "seo-grid grid-4",
        children: [/* @__PURE__ */ jsx(MetricCard, {
          label: "SEO Score",
          value: (summary == null ? void 0 : summary.score) ?? "-",
          helpText: "Calculated from issues and quality checks"
        }), /* @__PURE__ */ jsx(MetricCard, {
          label: "Pages Scanned",
          value: pagesScanned,
          helpText: "Products plus core crawl surfaces"
        }), /* @__PURE__ */ jsx(MetricCard, {
          label: "Issues",
          value: issueCount,
          helpText: "Critical, warning, and info findings"
        }), /* @__PURE__ */ jsx(MetricCard, {
          label: "Index Coverage",
          value: `${indexCoverage}%`,
          helpText: `Last scan: ${formatDate(lastScanDate)}`
        })]
      }), /* @__PURE__ */ jsxs("div", {
        className: "section-card overall-health-visuals",
        children: [/* @__PURE__ */ jsxs("div", {
          className: "toolbar",
          style: {
            justifyContent: "space-between"
          },
          children: [/* @__PURE__ */ jsx("h3", {
            style: {
              margin: 0
            },
            children: "Overall Health Visuals"
          }), /* @__PURE__ */ jsx("small", {
            style: {
              margin: 0
            },
            children: "Based on latest scan and score history"
          })]
        }), /* @__PURE__ */ jsxs("div", {
          className: "seo-grid grid-2",
          children: [/* @__PURE__ */ jsx(IssuePieChart, {
            counts: summary == null ? void 0 : summary.counts
          }), /* @__PURE__ */ jsx(HealthTrendGraph, {
            points: latestScores
          })]
        })]
      }), /* @__PURE__ */ jsxs("div", {
        className: "seo-grid grid-3",
        children: [/* @__PURE__ */ jsx(FeatureCard, {
          title: "SEO Audit / Scan",
          description: "Run a full scan and resolve prioritized findings.",
          to: "/app/seo-audit"
        }), /* @__PURE__ */ jsx(FeatureCard, {
          title: "Product SEO",
          description: "Edit product title, keyword, metadata, and URL handle.",
          to: "/app/products"
        }), /* @__PURE__ */ jsx(FeatureCard, {
          title: "Bulk Meta Editor",
          description: "Check and save meta title/description in bulk.",
          to: "/app/bulk-meta"
        }), /* @__PURE__ */ jsx(FeatureCard, {
          title: "Image Optimizer",
          description: "Audit image ALT text quality and bulk-fix weak ALT tags.",
          to: "/app/image-optimizer"
        }), /* @__PURE__ */ jsx(FeatureCard, {
          title: "URL Optimization",
          description: "Normalize and apply cleaner product handles.",
          to: "/app/url-optimization"
        }), /* @__PURE__ */ jsx(FeatureCard, {
          title: "Robots.txt Manager",
          description: "Maintain robots rules and validate crawl directives.",
          to: "/app/robots"
        }), /* @__PURE__ */ jsx(FeatureCard, {
          title: "Sitemap Manager",
          description: "Regenerate sitemap URL inventory with manual additions.",
          to: "/app/sitemap"
        })]
      })]
    })
  });
});
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
      #d95f5f 0% ${criticalPct}%,
      #d6a246 ${criticalPct}% ${criticalPct + warningPct}%,
      #4f82bb ${criticalPct + warningPct}% ${criticalPct + warningPct + infoPct}%
    )` : "conic-gradient(#b8c7d8 0% 100%)";
  return /* @__PURE__ */ jsxs("div", {
    className: "health-chart-card",
    children: [/* @__PURE__ */ jsxs("div", {
      children: [/* @__PURE__ */ jsx("h4", {
        children: "Issue Distribution"
      }), /* @__PURE__ */ jsx("p", {
        children: total ? `${total} issues found` : "No issues found in latest scan"
      })]
    }), /* @__PURE__ */ jsx("div", {
      className: "pie-wrap",
      children: /* @__PURE__ */ jsx("div", {
        className: "pie-chart",
        role: "img",
        "aria-label": "Issue distribution pie chart",
        style: {
          background: pieGradient
        }
      })
    }), /* @__PURE__ */ jsxs("div", {
      className: "chart-legend",
      children: [/* @__PURE__ */ jsxs("p", {
        children: [/* @__PURE__ */ jsx("span", {
          className: "dot dot-critical"
        }), " Critical: ", critical, " (", formatPct(criticalPct), ")"]
      }), /* @__PURE__ */ jsxs("p", {
        children: [/* @__PURE__ */ jsx("span", {
          className: "dot dot-warning"
        }), " Warning: ", warning, " (", formatPct(warningPct), ")"]
      }), /* @__PURE__ */ jsxs("p", {
        children: [/* @__PURE__ */ jsx("span", {
          className: "dot dot-info"
        }), " Info: ", info, " (", formatPct(infoPct), ")"]
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
  const height = 160;
  const padding = 16;
  const maxX = width - padding * 2;
  const maxY = height - padding * 2;
  const xStep = graphPoints.length > 1 ? maxX / (graphPoints.length - 1) : 0;
  const toY = (score) => padding + (100 - Math.max(0, Math.min(100, score))) * (maxY / 100);
  const polylinePoints = graphPoints.map((point, index2) => `${padding + index2 * xStep},${toY(point.score)}`).join(" ");
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
        children: direction === "flat" ? "No change in selected timeline" : `${change > 0 ? "+" : ""}${change} points over timeline`
      })]
    }), /* @__PURE__ */ jsxs("svg", {
      className: "trend-graph",
      viewBox: `0 0 ${width} ${height}`,
      role: "img",
      "aria-label": "SEO health score trend graph",
      children: [/* @__PURE__ */ jsx("line", {
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
      }), /* @__PURE__ */ jsx("polyline", {
        points: polylinePoints,
        className: "trend-line"
      }), graphPoints.map((point, index2) => /* @__PURE__ */ jsx("circle", {
        cx: padding + index2 * xStep,
        cy: toY(point.score),
        r: "4",
        className: "trend-point"
      }, `${point.date || "point"}-${index2}`))]
    }), /* @__PURE__ */ jsx("div", {
      className: "chart-footnote",
      children: /* @__PURE__ */ jsxs("small", {
        children: ["Latest score: ", latest]
      })
    })]
  });
}
const route16 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: app__index,
  links: links$1,
  loader: loader$1
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
const action$1 = async ({
  request
}) => {
  const {
    shop
  } = await requireShopContext(request);
  const appState = shop ? await getAppState(shop) : null;
  const aiSettings = appState == null ? void 0 : appState.aiSettings;
  try {
    const payload = await parseInput(request);
    const actionType = String(payload.actionType || "").trim();
    if (!actionType) {
      return {
        ok: false,
        error: "actionType is required."
      };
    }
    if (!AI_FEATURES_ENABLED && (actionType === "meta_fix" || actionType === "product_seo_fix")) {
      return {
        ok: false,
        error: "AI Fix is temporarily hidden."
      };
    }
    if (actionType === "meta_fix") {
      const result = await generateMetaFix({
        settings: aiSettings,
        title: payload.title,
        focusKeyword: payload.focusKeyword,
        currentMetaTitle: payload.currentMetaTitle,
        currentMetaDescription: payload.currentMetaDescription
      });
      return {
        ok: true,
        actionType,
        result
      };
    }
    if (actionType === "product_seo_fix") {
      const result = await generateProductSeoFix({
        settings: aiSettings,
        title: payload.title,
        focusKeyword: payload.focusKeyword,
        handle: payload.handle,
        metaTitle: payload.metaTitle,
        metaDescription: payload.metaDescription
      });
      return {
        ok: true,
        actionType,
        result
      };
    }
    if (actionType === "url_handle_suggestion") {
      const result = aiHandleSuggestion(payload);
      return {
        ok: true,
        actionType,
        result
      };
    }
    if (actionType === "robots_txt_improvement") {
      const result = aiRobotsImprovement({
        currentRules: payload.currentRules
      });
      return {
        ok: true,
        actionType,
        result
      };
    }
    return {
      ok: false,
      error: "Unsupported actionType. Use meta_fix, product_seo_fix, url_handle_suggestion, or robots_txt_improvement."
    };
  } catch (error) {
    return {
      ok: false,
      error: (error == null ? void 0 : error.message) || "Unable to process AI fix request."
    };
  }
};
const route17 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$1
}, Symbol.toStringTag, { value: "Module" }));
const links = () => [{
  rel: "stylesheet",
  href: seoStyles
}];
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
  if (intent === "aiImprove") {
    const improved = aiRobotsImprovement({
      currentRules: robotsTxt
    });
    return {
      ok: true,
      ...improved
    };
  }
  const validation = validateRobotsRules(robotsTxt);
  try {
    await updateAppState(shop, (current) => ({
      ...current,
      robotsTxt
    }));
    await runFullScan({
      shop,
      storeDomain: shop,
      token,
      apiVersion
    });
    return {
      ok: true,
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
  var _a2, _b, _c;
  const data = useLoaderData();
  const fetcher = useFetcher();
  const [robotsTxt, setRobotsTxt] = useState(data.robotsTxt || "");
  useEffect(() => {
    var _a3;
    if ((_a3 = fetcher.data) == null ? void 0 : _a3.robotsTxt) {
      setRobotsTxt(fetcher.data.robotsTxt);
    }
  }, [fetcher.data]);
  const validation = ((_a2 = fetcher.data) == null ? void 0 : _a2.validation) || data.validation;
  function submit(intent) {
    fetcher.submit({
      intent,
      robotsTxt
    }, {
      method: "post"
    });
  }
  return /* @__PURE__ */ jsx("s-page", {
    heading: "Robots.txt Manager",
    children: /* @__PURE__ */ jsxs("div", {
      className: "seo-wrap seo-grid",
      children: [data.configError ? /* @__PURE__ */ jsx("div", {
        className: "error-box",
        children: data.configError
      }) : null, ((_b = fetcher.data) == null ? void 0 : _b.error) ? /* @__PURE__ */ jsx("div", {
        className: "error-box",
        children: fetcher.data.error
      }) : null, /* @__PURE__ */ jsxs("div", {
        className: "toolbar",
        children: [/* @__PURE__ */ jsx("button", {
          className: "seo-button secondary",
          type: "button",
          onClick: () => submit("aiImprove"),
          children: "Improve with AI"
        }), /* @__PURE__ */ jsx("button", {
          className: "seo-button",
          type: "button",
          onClick: () => submit("save"),
          children: "Save and validate"
        }), /* @__PURE__ */ jsx(Link, {
          to: "/app",
          children: "Dashboard"
        })]
      }), /* @__PURE__ */ jsxs("div", {
        className: "section-card seo-grid",
        children: [/* @__PURE__ */ jsx("textarea", {
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
          }), " | /search disallow: ", /* @__PURE__ */ jsx("strong", {
            children: (validation == null ? void 0 : validation.disallowSearch) ? "Yes" : "No"
          })]
        }), !(validation == null ? void 0 : validation.valid) ? /* @__PURE__ */ jsx("div", {
          className: "error-box",
          children: validation == null ? void 0 : validation.message
        }) : null, ((_c = fetcher.data) == null ? void 0 : _c.rationale) ? /* @__PURE__ */ jsx("p", {
          style: {
            margin: 0
          },
          children: fetcher.data.rationale
        }) : null]
      })]
    })
  });
});
const route18 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action,
  default: app_robots,
  links,
  loader
}, Symbol.toStringTag, { value: "Module" }));
const serverManifest = { "entry": { "module": "/assets/entry.client-C-JQXGnO.js", "imports": ["/assets/jsx-runtime-C74AOcHn.js"], "css": [] }, "routes": { "root": { "id": "root", "parentId": void 0, "path": "", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": true, "hasErrorBoundary": false, "module": "/assets/root-CsrdjsPi.js", "imports": ["/assets/jsx-runtime-C74AOcHn.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/webhooks.app.scopes_update": { "id": "routes/webhooks.app.scopes_update", "parentId": "root", "path": "webhooks/app/scopes_update", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": false, "hasErrorBoundary": false, "module": "/assets/webhooks.app.scopes_update-l0sNRNKZ.js", "imports": [], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/webhooks.app.uninstalled": { "id": "routes/webhooks.app.uninstalled", "parentId": "root", "path": "webhooks/app/uninstalled", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": false, "hasErrorBoundary": false, "module": "/assets/webhooks.app.uninstalled-l0sNRNKZ.js", "imports": [], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/auth.login": { "id": "routes/auth.login", "parentId": "root", "path": "auth/login", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": true, "hasErrorBoundary": false, "module": "/assets/route-Bf8PzXzV.js", "imports": ["/assets/jsx-runtime-C74AOcHn.js", "/assets/AppProxyProvider-B5GcQ9AT.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/_index": { "id": "routes/_index", "parentId": "root", "path": void 0, "index": true, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": true, "hasErrorBoundary": false, "module": "/assets/route-CbzCgBQP.js", "imports": ["/assets/jsx-runtime-C74AOcHn.js"], "css": ["/assets/route-Xpdx9QZl.css"], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/auth.$": { "id": "routes/auth.$", "parentId": "root", "path": "auth/*", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": false, "hasErrorBoundary": false, "module": "/assets/auth._-l0sNRNKZ.js", "imports": [], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/app": { "id": "routes/app", "parentId": "root", "path": "app", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": true, "hasErrorBoundary": true, "module": "/assets/app-BJahGZbU.js", "imports": ["/assets/jsx-runtime-C74AOcHn.js", "/assets/AppProxyProvider-B5GcQ9AT.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/app.url-optimization": { "id": "routes/app.url-optimization", "parentId": "routes/app", "path": "url-optimization", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": true, "hasErrorBoundary": false, "module": "/assets/app.url-optimization-BFCR5N8T.js", "imports": ["/assets/jsx-runtime-C74AOcHn.js", "/assets/seo-Dib5e5j2.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/app.image-optimizer": { "id": "routes/app.image-optimizer", "parentId": "routes/app", "path": "image-optimizer", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": true, "hasErrorBoundary": false, "module": "/assets/app.image-optimizer-DR1S2Fgx.js", "imports": ["/assets/jsx-runtime-C74AOcHn.js", "/assets/seo-Dib5e5j2.js", "/assets/seoValidators-BOlgG_8R.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/app.bulk-meta": { "id": "routes/app.bulk-meta", "parentId": "routes/app", "path": "bulk-meta", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": true, "hasErrorBoundary": false, "module": "/assets/app.bulk-meta-UM9d51mQ.js", "imports": ["/assets/jsx-runtime-C74AOcHn.js", "/assets/seo-Dib5e5j2.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/app.seo-audit": { "id": "routes/app.seo-audit", "parentId": "routes/app", "path": "seo-audit", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": true, "hasErrorBoundary": false, "module": "/assets/app.seo-audit-CMlcdkGP.js", "imports": ["/assets/jsx-runtime-C74AOcHn.js", "/assets/seo-Dib5e5j2.js", "/assets/seo-ui-CdmmRLja.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/app.products": { "id": "routes/app.products", "parentId": "routes/app", "path": "products", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": true, "hasErrorBoundary": false, "module": "/assets/app.products-Cv_EO4Xp.js", "imports": ["/assets/jsx-runtime-C74AOcHn.js", "/assets/seo-Dib5e5j2.js", "/assets/seoValidators-BOlgG_8R.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/app.settings": { "id": "routes/app.settings", "parentId": "routes/app", "path": "settings", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": true, "hasErrorBoundary": false, "module": "/assets/app.settings-8vd1W5l2.js", "imports": ["/assets/jsx-runtime-C74AOcHn.js", "/assets/seo-Dib5e5j2.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/app.billing": { "id": "routes/app.billing", "parentId": "routes/app", "path": "billing", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": true, "hasErrorBoundary": false, "module": "/assets/app.billing-DeSSmb-k.js", "imports": ["/assets/jsx-runtime-C74AOcHn.js", "/assets/seo-Dib5e5j2.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/app.billing.return": { "id": "routes/app.billing.return", "parentId": "routes/app.billing", "path": "return", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": true, "hasErrorBoundary": false, "module": "/assets/app.billing.return-Cq7tGaPT.js", "imports": ["/assets/jsx-runtime-C74AOcHn.js", "/assets/seo-Dib5e5j2.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/app.sitemap": { "id": "routes/app.sitemap", "parentId": "routes/app", "path": "sitemap", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": true, "hasErrorBoundary": false, "module": "/assets/app.sitemap-BcGGHK8Y.js", "imports": ["/assets/jsx-runtime-C74AOcHn.js", "/assets/seo-Dib5e5j2.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/app._index": { "id": "routes/app._index", "parentId": "routes/app", "path": void 0, "index": true, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": true, "hasErrorBoundary": false, "module": "/assets/app._index-BkPyZYe5.js", "imports": ["/assets/jsx-runtime-C74AOcHn.js", "/assets/seo-Dib5e5j2.js", "/assets/seo-ui-CdmmRLja.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/app.api.ai": { "id": "routes/app.api.ai", "parentId": "routes/app", "path": "api/ai", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": false, "hasErrorBoundary": false, "module": "/assets/app.api.ai-l0sNRNKZ.js", "imports": [], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/app.robots": { "id": "routes/app.robots", "parentId": "routes/app", "path": "robots", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": true, "hasErrorBoundary": false, "module": "/assets/app.robots-BO1FaumK.js", "imports": ["/assets/jsx-runtime-C74AOcHn.js", "/assets/seo-Dib5e5j2.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 } }, "url": "/assets/manifest-194555f0.js", "version": "194555f0", "sri": void 0 };
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
  "routes/webhooks.app.scopes_update": {
    id: "routes/webhooks.app.scopes_update",
    parentId: "root",
    path: "webhooks/app/scopes_update",
    index: void 0,
    caseSensitive: void 0,
    module: route1
  },
  "routes/webhooks.app.uninstalled": {
    id: "routes/webhooks.app.uninstalled",
    parentId: "root",
    path: "webhooks/app/uninstalled",
    index: void 0,
    caseSensitive: void 0,
    module: route2
  },
  "routes/auth.login": {
    id: "routes/auth.login",
    parentId: "root",
    path: "auth/login",
    index: void 0,
    caseSensitive: void 0,
    module: route3
  },
  "routes/_index": {
    id: "routes/_index",
    parentId: "root",
    path: void 0,
    index: true,
    caseSensitive: void 0,
    module: route4
  },
  "routes/auth.$": {
    id: "routes/auth.$",
    parentId: "root",
    path: "auth/*",
    index: void 0,
    caseSensitive: void 0,
    module: route5
  },
  "routes/app": {
    id: "routes/app",
    parentId: "root",
    path: "app",
    index: void 0,
    caseSensitive: void 0,
    module: route6
  },
  "routes/app.url-optimization": {
    id: "routes/app.url-optimization",
    parentId: "routes/app",
    path: "url-optimization",
    index: void 0,
    caseSensitive: void 0,
    module: route7
  },
  "routes/app.image-optimizer": {
    id: "routes/app.image-optimizer",
    parentId: "routes/app",
    path: "image-optimizer",
    index: void 0,
    caseSensitive: void 0,
    module: route8
  },
  "routes/app.bulk-meta": {
    id: "routes/app.bulk-meta",
    parentId: "routes/app",
    path: "bulk-meta",
    index: void 0,
    caseSensitive: void 0,
    module: route9
  },
  "routes/app.seo-audit": {
    id: "routes/app.seo-audit",
    parentId: "routes/app",
    path: "seo-audit",
    index: void 0,
    caseSensitive: void 0,
    module: route10
  },
  "routes/app.products": {
    id: "routes/app.products",
    parentId: "routes/app",
    path: "products",
    index: void 0,
    caseSensitive: void 0,
    module: route11
  },
  "routes/app.settings": {
    id: "routes/app.settings",
    parentId: "routes/app",
    path: "settings",
    index: void 0,
    caseSensitive: void 0,
    module: route12
  },
  "routes/app.billing": {
    id: "routes/app.billing",
    parentId: "routes/app",
    path: "billing",
    index: void 0,
    caseSensitive: void 0,
    module: route13
  },
  "routes/app.billing.return": {
    id: "routes/app.billing.return",
    parentId: "routes/app.billing",
    path: "return",
    index: void 0,
    caseSensitive: void 0,
    module: route14
  },
  "routes/app.sitemap": {
    id: "routes/app.sitemap",
    parentId: "routes/app",
    path: "sitemap",
    index: void 0,
    caseSensitive: void 0,
    module: route15
  },
  "routes/app._index": {
    id: "routes/app._index",
    parentId: "routes/app",
    path: void 0,
    index: true,
    caseSensitive: void 0,
    module: route16
  },
  "routes/app.api.ai": {
    id: "routes/app.api.ai",
    parentId: "routes/app",
    path: "api/ai",
    index: void 0,
    caseSensitive: void 0,
    module: route17
  },
  "routes/app.robots": {
    id: "routes/app.robots",
    parentId: "routes/app",
    path: "robots",
    index: void 0,
    caseSensitive: void 0,
    module: route18
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
