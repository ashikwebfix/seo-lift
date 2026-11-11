import { buildMissingConfigMessage, getSeoEnv, resolveStoreDomain } from "../utils/env.server.js";
import { parseLinkHeader } from "../utils/pagination.js";

function getToken({ envToken, sessionToken }) {
  const cleanSession = String(sessionToken || "").trim();
  const cleanEnv = String(envToken || "").trim();
  if (cleanSession) return cleanSession;
  if (cleanEnv && !cleanEnv.includes("xxx")) return cleanEnv;
  return "";
}

export function getShopContext({ sessionShop, sessionToken, urlShop }) {
  const env = getSeoEnv();
  const storeDomain = resolveStoreDomain({
    envDomain: env.storeDomain,
    sessionShop,
    urlShop,
  });
  const token = getToken({ envToken: env.adminToken, sessionToken });

  return {
    storeDomain,
    token,
    apiVersion: env.apiVersion,
    configError: buildMissingConfigMessage({
      storeDomain,
      adminToken: token,
    }),
  };
}

const REST_MIN_INTERVAL_MS = 550; // Keeps REST bursts under Shopify's 2 calls/sec limit
const GRAPHQL_MIN_INTERVAL_MS = 100;
const DEFAULT_MAX_RETRIES = 5;

const storeBuckets = new Map();

function sleep(ms) {
  if (!ms || ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function safeParseJson(text, contentType) {
  if (!text || !String(contentType || "").includes("application/json")) {
    return null;
  }
  try {
    return JSON.parse(text);
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
      nextAllowedAt: 0,
    };
    storeBuckets.set(key, state);
  }
  return state;
}

/**
 * Serializes API calls per store and bucket type so concurrent workflows
 * never stampede Shopify's per-store rate limits.
 */
function enqueueStoreCall(storeDomain, bucketType, task) {
  const state = getBucketState(storeDomain, bucketType);
  const result = state.chain.then(() => task(state));
  state.chain = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

function parseRetryAfterMs(headerValue, attempt) {
  if (headerValue !== null && headerValue !== undefined && String(headerValue).trim() !== "") {
    const raw = String(headerValue).trim();
    const seconds = Number(raw);
    if (Number.isFinite(seconds) && seconds >= 0) {
      const ms = Math.ceil(seconds * 1000);
      return ms >= 500 ? ms + 150 : Math.max(1, ms);
    }
    const parsedDate = Date.parse(raw);
    if (Number.isFinite(parsedDate)) {
      return Math.max(100, parsedDate - Date.now() + 150);
    }
  }
  return Math.min(10000, 1200 * Math.pow(2, attempt));
}

function parseRestCallLimitDelayMs(callLimitHeader, minIntervalMs) {
  const match = String(callLimitHeader || "").trim().match(/^(\d+)\s*\/\s*(\d+)$/);
  if (!match) return minIntervalMs;
  const used = Number(match[1]);
  const max = Number(match[2]);
  if (!Number.isFinite(used) || !Number.isFinite(max) || max <= 0) return minIntervalMs;
  const remaining = max - used;
  if (remaining <= 2) return Math.max(minIntervalMs, 2000);
  if (remaining <= 6) return Math.max(minIntervalMs, 1100);
  return minIntervalMs;
}

function parseGraphqlThrottleDelayMs(json, minIntervalMs) {
  const throttle = json?.extensions?.cost?.throttleStatus;
  if (!throttle) return minIntervalMs;
  const available = Number(throttle.currentlyAvailable);
  const restoreRate = Number(throttle.restoreRate || 50);
  if (!Number.isFinite(available) || !Number.isFinite(restoreRate) || restoreRate <= 0) {
    return minIntervalMs;
  }
  if (available < 150) {
    const recoveryMs = Math.ceil(((150 - available) / restoreRate) * 1000) + 100;
    return Math.max(minIntervalMs, Math.min(5000, recoveryMs));
  }
  return minIntervalMs;
}

function isRateLimitedText(value) {
  return /exceeded 2 calls per second|throttled|too many requests/i.test(String(value || ""));
}

/**
 * Clears in-memory per-store rate-limiter queues (primarily for unit tests).
 */
export function resetShopifyRateLimiters() {
  storeBuckets.clear();
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
  computeRetryDelayMs,
}) {
  return enqueueStoreCall(storeDomain, bucketType, async (state) => {
    let lastResult = null;
    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      const waitMs = state.nextAllowedAt - Date.now();
      if (waitMs > 0) {
        await sleep(waitMs);
      }

      const response = await fetch(url, init);
      const text = await response.text();
      const contentType = response.headers.get("content-type") || "";
      const json = safeParseJson(text, contentType);
      lastResult = { response, text, json };

      if (attempt < maxRetries && shouldRetryResponse({ response, json, text })) {
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

export async function shopifyRestRequest({
  storeDomain,
  token,
  apiVersion,
  path,
  method = "GET",
  body,
  maxRetries = DEFAULT_MAX_RETRIES,
  minIntervalMs = REST_MIN_INTERVAL_MS,
}) {
  const url = `https://${storeDomain}/admin/api/${apiVersion}${path}`;
  const { response, text, json } = await executeShopifyRequestWithRetry({
    storeDomain,
    bucketType: "rest",
    url,
    init: {
      method,
      headers: {
        "X-Shopify-Access-Token": token,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    },
    maxRetries,
    minIntervalMs,
    shouldRetryResponse: ({ response: res, json: payload, text: rawText }) =>
      res.status === 429 ||
      isRateLimitedText(payload?.errors ? JSON.stringify(payload.errors) : rawText),
    computeRetryDelayMs: ({ response: res, attempt, minIntervalMs: floorMs }) =>
      Math.max(floorMs, parseRetryAfterMs(res.headers.get("retry-after"), attempt)),
    computeNextDelayMs: ({ response: res, attempt, minIntervalMs: floorMs }) => {
      if (res.status === 429) {
        return Math.max(floorMs, parseRetryAfterMs(res.headers.get("retry-after"), attempt));
      }
      return parseRestCallLimitDelayMs(res.headers.get("x-shopify-shop-api-call-limit"), floorMs);
    },
  });

  if (!response.ok) {
    const error = new Error(
      json?.errors
        ? `Shopify API error: ${JSON.stringify(json.errors)}`
        : `Shopify API request failed with status ${response.status}.`,
    );
    error.status = response.status;
    error.details = json || text;
    throw error;
  }

  return {
    data: json || {},
    pagination: parseLinkHeader(response.headers.get("link")),
  };
}

export async function shopifyGraphqlRequest({
  storeDomain,
  token,
  apiVersion,
  query,
  variables = {},
  maxRetries = DEFAULT_MAX_RETRIES,
  minIntervalMs = GRAPHQL_MIN_INTERVAL_MS,
}) {
  const url = `https://${storeDomain}/admin/api/${apiVersion}/graphql.json`;
  const { response, text, json } = await executeShopifyRequestWithRetry({
    storeDomain,
    bucketType: "graphql",
    url,
    init: {
      method: "POST",
      headers: {
        "X-Shopify-Access-Token": token,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ query, variables }),
    },
    maxRetries,
    minIntervalMs,
    shouldRetryResponse: ({ response: res, json: payload }) => {
      if (res.status === 429) return true;
      if (!Array.isArray(payload?.errors)) return false;
      return payload.errors.some(
        (entry) =>
          entry?.extensions?.code === "THROTTLED" || isRateLimitedText(entry?.message),
      );
    },
    computeRetryDelayMs: ({ response: res, json: payload, attempt, minIntervalMs: floorMs }) => {
      const retryHeader = res.headers.get("retry-after");
      if (retryHeader !== null && retryHeader !== undefined && String(retryHeader).trim() !== "") {
        return Math.max(floorMs, parseRetryAfterMs(retryHeader, attempt));
      }
      if (payload?.extensions?.cost?.throttleStatus) {
        return Math.max(floorMs, parseGraphqlThrottleDelayMs(payload, 1000));
      }
      return Math.max(floorMs, parseRetryAfterMs(null, attempt));
    },
    computeNextDelayMs: ({ response: res, json: payload, attempt, minIntervalMs: floorMs }) => {
      if (res.status === 429) {
        return Math.max(floorMs, parseRetryAfterMs(res.headers.get("retry-after"), attempt));
      }
      return parseGraphqlThrottleDelayMs(payload, floorMs);
    },
  });

  if (!response.ok) {
    const error = new Error(
      json?.errors
        ? `Shopify GraphQL error: ${JSON.stringify(json.errors)}`
        : `Shopify GraphQL request failed with status ${response.status}.`,
    );
    error.status = response.status;
    error.details = json || text;
    throw error;
  }

  if (Array.isArray(json?.errors) && json.errors.length) {
    const error = new Error(`Shopify GraphQL error: ${json.errors.map((entry) => entry.message).join(", ")}`);
    error.details = json.errors;
    throw error;
  }

  return json?.data || {};
}

function toProductGid(productId) {
  return `gid://shopify/Product/${String(productId)}`;
}

function fromProductGid(gid) {
  return String(gid || "").split("/").pop() || "";
}

function mapGraphqlProductNode(node) {
  if (!node?.id) return null;
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
    metafields_global_title_tag: String(node.seo?.title || ""),
    metafields_global_description_tag: String(node.seo?.description || ""),
  };
}

export async function fetchProducts({
  storeDomain,
  token,
  apiVersion,
  limit = 20,
  pageInfo = "",
  query = "",
  includeDescription = true,
}) {
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  if (pageInfo) {
    params.set("page_info", pageInfo);
  } else {
    const fields = [
      "id",
      "title",
      "handle",
      ...(includeDescription ? ["body_html"] : []),
      "product_type",
      "tags",
      "status",
      "updated_at",
      "metafields_global_title_tag",
      "metafields_global_description_tag",
    ];
    params.set("fields", fields.join(","));
  }

  if (query && !pageInfo) {
    params.set("title", query);
  }

  const { data, pagination } = await shopifyRestRequest({
    storeDomain,
    token,
    apiVersion,
    path: `/products.json?${params.toString()}`,
  });

  const products = Array.isArray(data.products) ? data.products : [];
  if (!products.length) {
    return {
      products,
      pagination,
    };
  }

  const ids = products.map((product) => toProductGid(product.id));
  const seoById = new Map();
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
      variables: { ids: batchIds },
    });

    for (const node of seoData?.nodes || []) {
      const id = fromProductGid(node?.id);
      if (!id) continue;
      seoById.set(id, {
        title: node?.seo?.title,
        description: node?.seo?.description,
      });
    }
  }

  const mergedProducts = products.map((product) => {
    const seo = seoById.get(String(product.id));
    return {
      ...product,
      metafields_global_title_tag: seo?.title ?? product.metafields_global_title_tag ?? "",
      metafields_global_description_tag: seo?.description ?? product.metafields_global_description_tag ?? "",
    };
  });

  return {
    products: mergedProducts,
    pagination,
  };
}

/**
 * Fetches all store products via single-protocol GraphQL cursor pagination (zero REST calls)
 * and omits heavy descriptionHtml bodies to keep catalog scans, sitemaps, and GSC matching fast.
 */
export async function fetchAllProducts({
  storeDomain,
  token,
  apiVersion,
  maxProducts = 10000,
}) {
  const allProducts = [];
  let cursor = null;
  let hasNextPage = false;

  do {
    const remaining = maxProducts - allProducts.length;
    const batchSize = Math.max(1, Math.min(250, remaining));
    const data = await shopifyGraphqlRequest({
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
      variables: { first: batchSize, after: cursor },
    });

    const connection = data?.products;
    const nodes = Array.isArray(connection?.nodes) ? connection.nodes : [];
    for (const node of nodes) {
      const mapped = mapGraphqlProductNode(node);
      if (mapped) allProducts.push(mapped);
    }

    hasNextPage = Boolean(connection?.pageInfo?.hasNextPage);
    cursor = connection?.pageInfo?.endCursor || null;
  } while (hasNextPage && cursor && allProducts.length < maxProducts);

  return {
    products: allProducts.slice(0, maxProducts),
    truncated: hasNextPage,
  };
}

/**
 * Fetches specific products by ID in batched GraphQL node queries (avoids scanning the full catalog).
 */
export async function fetchProductsByIds({
  storeDomain,
  token,
  apiVersion,
  productIds = [],
}) {
  const gids = Array.from(
    new Set(
      (Array.isArray(productIds) ? productIds : [])
        .map((id) => fromProductGid(id))
        .filter(Boolean)
        .map((id) => toProductGid(id)),
    ),
  );
  if (!gids.length) return [];

  const rows = [];
  const BATCH_SIZE = 100;
  for (let i = 0; i < gids.length; i += BATCH_SIZE) {
    const data = await shopifyGraphqlRequest({
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
      variables: { ids: gids.slice(i, i + BATCH_SIZE) },
    });

    for (const node of data?.nodes || []) {
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
  if (!product) return null;
  const imageNodes = Array.isArray(product.images?.nodes) ? product.images.nodes : [];
  return {
    id: fromProductGid(product.id),
    title: String(product.title || ""),
    handle: String(product.handle || ""),
    body_html: String(product.descriptionHtml || ""),
    product_type: String(product.productType || ""),
    tags: Array.isArray(product.tags) ? product.tags.join(", ") : String(product.tags || ""),
    metafields_global_title_tag: String(product.seo?.title || ""),
    metafields_global_description_tag: String(product.seo?.description || ""),
    images: imageNodes.map((image, index) => ({
      id: fromProductGid(image.id),
      src: String(image.url || ""),
      alt: String(image.altText || ""),
      position: index + 1,
    })),
  };
}

export async function fetchProductById({
  storeDomain,
  token,
  apiVersion,
  productId,
}) {
  const cleanId = fromProductGid(productId);
  if (!cleanId) return null;

  const data = await shopifyGraphqlRequest({
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
    variables: { id: toProductGid(cleanId) },
  });

  return mapSingleGraphqlProduct(data?.product);
}

export async function fetchProductByHandle({
  storeDomain,
  token,
  apiVersion,
  handle,
}) {
  const cleanHandle = String(handle || "").trim().toLowerCase();
  if (!cleanHandle) return null;

  const data = await shopifyGraphqlRequest({
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
    variables: { handle: cleanHandle },
  });

  return mapSingleGraphqlProduct(data?.productByHandle);
}

export async function fetchProductImages({
  storeDomain,
  token,
  apiVersion,
  limit = 50,
  pageInfo = "",
  query = "",
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
    path: `/products.json?${params.toString()}`,
  });

  const products = Array.isArray(data.products) ? data.products : [];
  const rows = products.flatMap((product) => {
    const productImages = Array.isArray(product.images) ? product.images : [];
    return productImages.map((image, index) => ({
      id: String(image.id || ""),
      productId: String(product.id || ""),
      productTitle: String(product.title || ""),
      productHandle: String(product.handle || ""),
      position: Number(image.position || index + 1),
      altText: String(image.alt || ""),
      imageUrl: String(image.src || ""),
      width: Number(image.width || 0),
      height: Number(image.height || 0),
    }));
  });

  return {
    rows,
    pagination,
  };
}

function prefersProductUpdateInput(apiVersion) {
  const match = String(apiVersion || "2025-10").match(/^(\d{4})-(\d{2})$/);
  if (!match) return true;
  const numeric = Number(`${match[1]}${match[2]}`);
  return numeric >= 202410;
}

async function runProductUpdateMutation({ storeDomain, token, apiVersion, input, useNewSchema }) {
  const query = useNewSchema
    ? `
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
    `
    : `
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
    variables: useNewSchema ? { product: input } : { input },
  });
}

export async function updateProductSeo({
  storeDomain,
  token,
  apiVersion,
  productId,
  payload,
}) {
  const input = {
    id: toProductGid(productId),
    title: payload.title,
    handle: payload.handle,
    seo: {
      title: payload.metaTitle,
      description: payload.metaDescription,
    },
  };

  if (typeof payload.descriptionHtml === "string") {
    input.descriptionHtml = payload.descriptionHtml;
  }

  const useNewFirst = prefersProductUpdateInput(apiVersion);
  let data;
  try {
    data = await runProductUpdateMutation({
      storeDomain,
      token,
      apiVersion,
      input,
      useNewSchema: useNewFirst,
    });
  } catch (error) {
    const msg = String(error?.message || "");
    const shouldTryAlternate =
      msg.includes("ProductUpdateInput") ||
      msg.includes("ProductInput") ||
      msg.includes("Unknown argument") ||
      msg.includes("Field 'product' doesn't exist");
    if (!shouldTryAlternate) throw error;
    data = await runProductUpdateMutation({
      storeDomain,
      token,
      apiVersion,
      input,
      useNewSchema: !useNewFirst,
    });
  }

  const userErrors = data?.productUpdate?.userErrors || [];
  if (userErrors.length) {
    throw new Error(userErrors.map((entry) => entry.message).join(", "));
  }

  return data?.productUpdate?.product || null;
}

export async function updateProductImageAlt({
  storeDomain,
  token,
  apiVersion,
  productId,
  imageId,
  altText,
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
        alt: String(altText || "").trim(),
      },
    },
  });

  return data?.image || null;
}

export async function createUrlRedirect({
  storeDomain,
  token,
  apiVersion,
  path,
  target,
}) {
  const cleanPath = String(path || "").trim();
  const cleanTarget = String(target || "").trim();

  if (!cleanPath || !cleanTarget || cleanPath === cleanTarget) {
    return null;
  }

  try {
    const data = await shopifyGraphqlRequest({
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
          target: cleanTarget.startsWith("/") ? cleanTarget : `/${cleanTarget}`,
        },
      },
    });

    const userErrors = data?.urlRedirectCreate?.userErrors || [];
    if (userErrors.length) {
      const isHarmless = userErrors.some((e) =>
        e.message?.toLowerCase().includes("taken") ||
        e.message?.toLowerCase().includes("already exists")
      );
      if (!isHarmless) {
        console.warn(`URL redirect warning for ${cleanPath} -> ${cleanTarget}:`, userErrors);
      }
    }

    return data?.urlRedirectCreate?.urlRedirect || null;
  } catch (error) {
    console.warn(`Failed to create 301 redirect for ${cleanPath}:`, error?.message);
    return null;
  }
}
