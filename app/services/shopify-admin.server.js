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

export async function shopifyRestRequest({
  storeDomain,
  token,
  apiVersion,
  path,
  method = "GET",
  body,
}) {
  const url = `https://${storeDomain}/admin/api/${apiVersion}${path}`;
  const response = await fetch(url, {
    method,
    headers: {
      "X-Shopify-Access-Token": token,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  const contentType = response.headers.get("content-type") || "";
  const json = contentType.includes("application/json") && text ? JSON.parse(text) : null;

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
}) {
  const url = `https://${storeDomain}/admin/api/${apiVersion}/graphql.json`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "X-Shopify-Access-Token": token,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });

  const text = await response.text();
  const contentType = response.headers.get("content-type") || "";
  const json = contentType.includes("application/json") && text ? JSON.parse(text) : null;

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

export async function fetchProducts({
  storeDomain,
  token,
  apiVersion,
  limit = 20,
  pageInfo = "",
  query = "",
}) {
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
      "metafields_global_description_tag",
    ].join(","));
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
    variables: { ids },
  });

  for (const node of seoData?.nodes || []) {
    const id = fromProductGid(node?.id);
    if (!id) continue;
    seoById.set(id, {
      title: node?.seo?.title,
      description: node?.seo?.description,
    });
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

export async function updateProductSeo({
  storeDomain,
  token,
  apiVersion,
  productId,
  payload,
}) {
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
          description: payload.metaDescription,
        },
      },
    },
  });

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
