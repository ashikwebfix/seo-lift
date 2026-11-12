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
      variantIds: Array.isArray(image.variant_ids) ? image.variant_ids.map(String) : [],
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

function toMediaImageGid(mediaId) {
  const clean = String(mediaId || "").trim();
  if (!clean) return "";
  return clean.startsWith("gid://") ? clean : `gid://shopify/MediaImage/${clean}`;
}

function toVariantGid(variantId) {
  const clean = String(variantId || "").trim();
  if (!clean) return "";
  return clean.startsWith("gid://") ? clean : `gid://shopify/ProductVariant/${clean}`;
}

async function fetchProductMediaSnapshot({
  storeDomain,
  token,
  apiVersion,
  productId,
}) {
  const data = await shopifyGraphqlRequest({
    storeDomain,
    token,
    apiVersion,
    query: `
      query ProductMediaSnapshot($id: ID!) {
        product(id: $id) {
          id
          media(first: 100) {
            nodes {
              id
              alt
              mediaContentType
              status
              ... on MediaImage {
                image {
                  id
                  url
                  width
                  height
                }
              }
            }
          }
          variants(first: 100) {
            nodes {
              id
              media(first: 5) {
                nodes {
                  id
                }
              }
              image {
                id
              }
            }
          }
        }
      }
    `,
    variables: { id: toProductGid(productId) },
  });

  const product = data?.product;
  if (!product?.id) {
    throw new Error(`Shopify product ${productId} was not found.`);
  }

  return {
    productGid: product.id,
    mediaNodes: Array.isArray(product.media?.nodes) ? product.media.nodes : [],
    variantNodes: Array.isArray(product.variants?.nodes) ? product.variants.nodes : [],
  };
}

async function uploadBufferToStagedTarget({
  stagedTarget,
  buffer,
  filename,
  mimeType,
}) {
  const targetUrl = String(stagedTarget?.url || "").trim();
  if (!targetUrl) {
    throw new Error("Shopify did not return a staged upload URL.");
  }

  const parameters = Array.isArray(stagedTarget.parameters) ? stagedTarget.parameters : [];
  const looksLikeMultipartPost =
    parameters.length > 0 &&
    !targetUrl.includes("X-Goog-Signature") &&
    !targetUrl.includes("X-Amz-Signature");

  if (looksLikeMultipartPost) {
    const formData = new FormData();
    for (const param of parameters) {
      if (param?.name) {
        formData.append(param.name, String(param.value ?? ""));
      }
    }
    formData.append("file", new Blob([buffer], { type: mimeType }), filename);

    const uploadRes = await fetch(targetUrl, {
      method: "POST",
      body: formData,
    });
    if (!uploadRes.ok) {
      const errText = await uploadRes.text().catch(() => "");
      throw new Error(
        `Staged multipart upload failed (${uploadRes.status}): ${errText.slice(0, 180) || "Upload rejected"}`,
      );
    }
    return;
  }

  const headers = {
    "Content-Type": mimeType,
  };
  for (const param of parameters) {
    if (param?.name && !/^host$/i.test(param.name)) {
      headers[param.name] = String(param.value ?? "");
    }
  }

  const uploadRes = await fetch(targetUrl, {
    method: "PUT",
    headers,
    body: buffer,
  });
  if (!uploadRes.ok) {
    const errText = await uploadRes.text().catch(() => "");
    throw new Error(
      `Staged PUT upload failed (${uploadRes.status}): ${errText.slice(0, 180) || "Upload rejected"}`,
    );
  }
}

async function pollMediaReady({
  storeDomain,
  token,
  apiVersion,
  mediaGid,
  maxAttempts = 18,
  delayMs = 700,
}) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const data = await shopifyGraphqlRequest({
      storeDomain,
      token,
      apiVersion,
      query: `
        query PollMediaImage($id: ID!) {
          node(id: $id) {
            id
            ... on MediaImage {
              status
              alt
              image {
                id
                url
                width
                height
              }
              mediaErrors {
                code
                message
              }
            }
          }
        }
      `,
      variables: { id: mediaGid },
    });

    const node = data?.node;
    if (!node) {
      throw new Error("Uploaded Shopify media record disappeared during processing.");
    }

    if (node.status === "READY") {
      return node;
    }

    if (node.status === "FAILED") {
      const reason = (node.mediaErrors || []).map((e) => e.message).filter(Boolean).join(", ");
      throw new Error(`Shopify failed processing compressed image: ${reason || "Media processing error"}`);
    }

    if (attempt < maxAttempts - 1) {
      await sleep(delayMs);
    }
  }

  throw new Error("Timed out waiting for Shopify CDN to finish processing compressed image.");
}

async function deleteProductMediaNodes({
  storeDomain,
  token,
  apiVersion,
  productGid,
  mediaIds,
}) {
  const validIds = (Array.isArray(mediaIds) ? mediaIds : []).filter(Boolean);
  if (!validIds.length) return;

  const data = await shopifyGraphqlRequest({
    storeDomain,
    token,
    apiVersion,
    query: `
      mutation DeleteProductMedia($productId: ID!, $mediaIds: [ID!]!) {
        productDeleteMedia(productId: $productId, mediaIds: $mediaIds) {
          deletedMediaIds
          userErrors {
            field
            message
          }
        }
      }
    `,
    variables: {
      productId: productGid,
      mediaIds: validIds,
    },
  });

  const userErrors = data?.productDeleteMedia?.userErrors || [];
  if (userErrors.length) {
    throw new Error(userErrors.map((e) => e.message).join(", "));
  }
}

async function replaceProductImageViaRestFallback({
  storeDomain,
  token,
  apiVersion,
  productId,
  oldImageId,
  buffer,
  filename,
  altText,
  position,
  variantIds,
}) {
  const numericVariants = (Array.isArray(variantIds) ? variantIds : [])
    .map((id) => Number(fromProductGid(id)))
    .filter((id) => Number.isFinite(id) && id > 0);

  const payload = {
    image: {
      attachment: buffer.toString("base64"),
      filename,
      alt: altText,
      position,
      ...(numericVariants.length ? { variant_ids: numericVariants } : {}),
    },
  };

  const { data: created } = await shopifyRestRequest({
    storeDomain,
    token,
    apiVersion,
    path: `/products/${String(productId)}/images.json`,
    method: "POST",
    body: payload,
  });

  const newImg = created?.image;
  if (!newImg?.id) {
    throw new Error("Shopify REST image replacement did not return the new uploaded image.");
  }

  if (oldImageId && String(oldImageId) !== String(newImg.id)) {
    await shopifyRestRequest({
      storeDomain,
      token,
      apiVersion,
      path: `/products/${String(productId)}/images/${String(oldImageId)}.json`,
      method: "DELETE",
    });
  }

  return {
    productId: String(productId),
    oldImageId: String(oldImageId || ""),
    oldMediaId: "",
    newMediaId: "",
    newImageId: String(newImg.id),
    newImageUrl: String(newImg.src || ""),
    width: Number(newImg.width || 0),
    height: Number(newImg.height || 0),
    altText: String(newImg.alt || altText),
    position: Number(newImg.position || position),
    variantIds: Array.isArray(newImg.variant_ids)
      ? newImg.variant_ids.map(String)
      : numericVariants.map(String),
  };
}

/**
 * Uploads a compressed image binary to Shopify via GraphQL staged upload,
 * waits for READY status, re-links variants and gallery position cleanly,
 * and removes the old uncompressed media only after the replacement succeeds.
 */
export async function replaceProductImageWithCompressed({
  storeDomain,
  token,
  apiVersion,
  productId,
  imageId,
  mediaId = "",
  buffer,
  filename,
  mimeType,
  altText = "",
  position = 1,
  variantIds = [],
}) {
  const productGid = toProductGid(productId);
  const snapshot = await fetchProductMediaSnapshot({
    storeDomain,
    token,
    apiVersion,
    productId,
  });

  const cleanImageId = String(imageId || "").trim();
  const cleanMediaGid = mediaId ? toMediaImageGid(mediaId) : "";
  const oldIndex = snapshot.mediaNodes.findIndex(
    (node) =>
      (cleanMediaGid && node.id === cleanMediaGid) ||
      (cleanImageId &&
        (fromProductGid(node.image?.id) === cleanImageId ||
          fromProductGid(node.id) === cleanImageId)),
  );
  const oldMediaNode = oldIndex >= 0 ? snapshot.mediaNodes[oldIndex] : null;
  if (!oldMediaNode) {
    throw new Error(`Original product image ${imageId || mediaId} was not found on product ${productId}.`);
  }

  const resolvedAlt = String(altText || oldMediaNode.alt || "").trim();
  const targetPosition = oldIndex >= 0 ? oldIndex : Math.max(0, Number(position || 1) - 1);

  const matchedVariantGids = new Set();
  for (const v of snapshot.variantNodes) {
    const usesOldMedia = (v.media?.nodes || []).some((m) => m.id === oldMediaNode.id);
    const usesOldImage = cleanImageId && fromProductGid(v.image?.id) === cleanImageId;
    if (usesOldMedia || usesOldImage) {
      matchedVariantGids.add(v.id);
    }
  }
  for (const vid of Array.isArray(variantIds) ? variantIds : []) {
    const gid = toVariantGid(vid);
    if (gid) matchedVariantGids.add(gid);
  }

  // Step 1: Request staged upload target
  let stagedData;
  try {
    stagedData = await shopifyGraphqlRequest({
      storeDomain,
      token,
      apiVersion,
      query: `
        mutation StagedImageUpload($input: [StagedUploadInput!]!) {
          stagedUploadsCreate(input: $input) {
            stagedTargets {
              url
              resourceUrl
              parameters {
                name
                value
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
        input: [
          {
            filename,
            mimeType,
            resource: "IMAGE",
            httpMethod: "POST",
            fileSize: String(buffer.length),
          },
        ],
      },
    });
  } catch (stagedError) {
    if (/access\s*denied/i.test(String(stagedError?.message || "")) && cleanImageId) {
      return replaceProductImageViaRestFallback({
        storeDomain,
        token,
        apiVersion,
        productId,
        oldImageId: cleanImageId,
        buffer,
        filename,
        altText: resolvedAlt,
        position: targetPosition + 1,
        variantIds: Array.from(matchedVariantGids),
      });
    }
    throw stagedError;
  }

  const stagedErrors = stagedData?.stagedUploadsCreate?.userErrors || [];
  if (stagedErrors.length) {
    throw new Error(stagedErrors.map((e) => e.message).join(", "));
  }
  const stagedTarget = stagedData?.stagedUploadsCreate?.stagedTargets?.[0];
  if (!stagedTarget?.resourceUrl) {
    throw new Error("Shopify did not return a staged resourceUrl for compressed image.");
  }

  // Step 2: Upload binary bytes to Shopify GCS/S3 staged target
  await uploadBufferToStagedTarget({
    stagedTarget,
    buffer,
    filename,
    mimeType,
  });

  // Step 3: Attach new compressed image to product (old image stays intact until READY!)
  const createMediaData = await shopifyGraphqlRequest({
    storeDomain,
    token,
    apiVersion,
    query: `
      mutation AttachCompressedProductMedia($productId: ID!, $media: [CreateMediaInput!]!) {
        productCreateMedia(productId: $productId, media: $media) {
          media {
            id
            status
            mediaContentType
          }
          mediaUserErrors {
            field
            message
          }
        }
      }
    `,
    variables: {
      productId: productGid,
      media: [
        {
          mediaContentType: "IMAGE",
          originalSource: stagedTarget.resourceUrl,
          alt: resolvedAlt,
        },
      ],
    },
  });

  const mediaErrors = createMediaData?.productCreateMedia?.mediaUserErrors || [];
  if (mediaErrors.length) {
    throw new Error(mediaErrors.map((e) => e.message).join(", "));
  }
  const createdMediaId = createMediaData?.productCreateMedia?.media?.[0]?.id;
  if (!createdMediaId) {
    throw new Error("Shopify did not return a created MediaImage ID.");
  }

  let readyMedia = null;
  try {
    // Step 4: Wait until Shopify CDN finishes ingesting the new compressed media
    readyMedia = await pollMediaReady({
      storeDomain,
      token,
      apiVersion,
      mediaGid: createdMediaId,
    });

    // Step 5: Re-bind any product variants pointing to the old image
    if (matchedVariantGids.size > 0) {
      const variantsInput = Array.from(matchedVariantGids).map((variantId) => ({
        id: variantId,
        mediaId: createdMediaId,
      }));

      for (let retry = 0; retry < 2; retry += 1) {
        const variantRes = await shopifyGraphqlRequest({
          storeDomain,
          token,
          apiVersion,
          query: `
            mutation RebindVariantMedia($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
              productVariantsBulkUpdate(productId: $productId, variants: $variants) {
                userErrors {
                  code
                  field
                  message
                }
              }
            }
          `,
          variables: {
            productId: productGid,
            variants: variantsInput,
          },
        });

        const vErrors = variantRes?.productVariantsBulkUpdate?.userErrors || [];
        if (!vErrors.length) break;
        const isPropagationLag = vErrors.some((e) => e.code === "MUST_BE_FOR_THIS_PRODUCT");
        if (isPropagationLag && retry === 0) {
          await sleep(600);
          continue;
        }
        throw new Error(vErrors.map((e) => e.message).join(", "));
      }
    }

    // Step 6: Preserve exact gallery position before deleting the old asset
    if (targetPosition >= 0) {
      const reorderRes = await shopifyGraphqlRequest({
        storeDomain,
        token,
        apiVersion,
        query: `
          mutation ReorderCompressedMedia($productId: ID!, $moves: [MoveInput!]!) {
            productReorderMedia(productId: $productId, moves: $moves) {
              userErrors {
                field
                message
              }
            }
          }
        `,
        variables: {
          productId: productGid,
          moves: [{ id: createdMediaId, newPosition: String(targetPosition) }],
        },
      });
      const rErrors = reorderRes?.productReorderMedia?.userErrors || [];
      if (rErrors.length) {
        console.warn("Media reorder warning:", rErrors);
      }
    }
  } catch (error) {
    // Cleanup the orphan new media so original image remains cleanly untouched
    await deleteProductMediaNodes({
      storeDomain,
      token,
      apiVersion,
      productGid,
      mediaIds: [createdMediaId],
    }).catch(() => {});
    throw error;
  }

  // Step 7: Safely remove the old heavy media once the compressed replacement is live & bound
  await deleteProductMediaNodes({
    storeDomain,
    token,
    apiVersion,
    productGid,
    mediaIds: [oldMediaNode.id],
  });

  return {
    productId: String(productId),
    oldImageId: cleanImageId,
    oldMediaId: oldMediaNode.id,
    newMediaId: createdMediaId,
    newImageId: fromProductGid(readyMedia?.image?.id || createdMediaId),
    newImageUrl: String(readyMedia?.image?.url || ""),
    width: Number(readyMedia?.image?.width || 0),
    height: Number(readyMedia?.image?.height || 0),
    altText: String(readyMedia?.alt || resolvedAlt),
    position: targetPosition + 1,
    variantIds: Array.from(matchedVariantGids).map(fromProductGid),
  };
}
