import { shopifyGraphqlRequest } from "./shopify-admin.server";

// ─── Plan constants ────────────────────────────────────────────────────────────
export const PLAN_FREE = "Ecom SEO Free";
export const PLAN_PRO = "Ecom SEO Pro";

// ─── Currency helpers ──────────────────────────────────────────────────────────

/**
 * Shopify's allowed currency codes for app subscription billing.
 * If a shop's currency is not in this list, fall back to "USD".
 */
const ALLOWED_BILLING_CURRENCIES = new Set([
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
  "USD",
]);

function sanitizeCurrencyCode(currencyCode) {
  const code = String(currencyCode || "USD").trim().toUpperCase();
  return ALLOWED_BILLING_CURRENCIES.has(code) ? code : "USD";
}

// ─── Query helpers ─────────────────────────────────────────────────────────────

const BILLING_CACHE_TTL_MS = 60_000;
const billingStatusCache = new Map();

export function invalidateBillingCache(shop) {
  const key = String(shop || "").trim().toLowerCase();
  if (key) {
    billingStatusCache.delete(key);
  }
}

/**
 * Short-TTL cached subscription lookup for navigation layout loaders so page switches
 * avoid hitting Shopify's GraphQL API on every click.
 */
export async function getCachedActiveAppSubscriptions({
  admin,
  storeDomain,
  token,
  apiVersion,
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
    apiVersion,
  });

  if (key) {
    billingStatusCache.set(key, {
      subscriptions,
      expiresAt: Date.now() + BILLING_CACHE_TTL_MS,
    });
  }
  return subscriptions;
}

/**
 * Returns the list of ACTIVE subscriptions for the current app installation.
 * Each entry has: id, name, status, trialDays, currentPeriodEnd.
 */
export async function getActiveAppSubscriptions({
  admin,
  storeDomain,
  token,
  apiVersion,
}) {
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
    return json?.data?.currentAppInstallation?.activeSubscriptions || [];
  }

  const data = await shopifyGraphqlRequest({
    storeDomain,
    token,
    apiVersion,
    query,
    variables: {},
  });

  return data?.currentAppInstallation?.activeSubscriptions || [];
}

/**
 * Returns the shop's default billing currency code (e.g. "USD").
 */
export async function getShopCurrencyCode({
  admin,
  storeDomain,
  token,
  apiVersion,
}) {
  const query = `
    query GetShopCurrency {
      shop {
        currencyCode
      }
    }
  `;

  if (admin) {
    const json = await adminGraphqlRequest(admin, query, {});
    return sanitizeCurrencyCode(json?.data?.shop?.currencyCode);
  }

  const data = await shopifyGraphqlRequest({
    storeDomain,
    token,
    apiVersion,
    query,
    variables: {},
  });

  return sanitizeCurrencyCode(data?.shop?.currencyCode);
}

// ─── Subscription creators ─────────────────────────────────────────────────────

/**
 * Helper to safely call admin.graphql and handle both SDK-level and GraphQL-level errors.
 */
async function adminGraphqlRequest(admin, mutation, variables) {
  const maxRetries = 3;
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      const response = await admin.graphql(mutation, { variables });
      if (response.status === 429 && attempt < maxRetries) {
        const retrySec = Number(response.headers?.get?.("retry-after") || 0);
        const waitMs = Number.isFinite(retrySec) && retrySec > 0 ? retrySec * 1000 : 1000 * (attempt + 1);
        await new Promise((resolve) => setTimeout(resolve, waitMs));
        continue;
      }
      const json = await response.json();
      if (Array.isArray(json?.errors) && json.errors.length) {
        const throttled = json.errors.some(
          (e) => e?.extensions?.code === "THROTTLED" || /throttled/i.test(String(e?.message || "")),
        );
        if (throttled && attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
          continue;
        }
        const msgs = json.errors.map((e) => e.message).join(", ");
        throw new Error(`Shopify GraphQL error: ${msgs}`);
      }
      if (json?.errors) {
        throw new Error(`Shopify GraphQL error: ${String(json.errors)}`);
      }
      return json;
    } catch (error) {
      if (error.graphQLErrors) {
        const throttled = error.graphQLErrors.some(
          (e) => e?.extensions?.code === "THROTTLED" || /throttled/i.test(String(e?.message || "")),
        );
        if (throttled && attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
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

export async function createFreeSubscription({
  admin,
  storeDomain,
  token,
  apiVersion,
  returnUrl,
  test = false,
}) {
  const mutation = `
    mutation AppSubscriptionCreate(
      $name: String!
      $lineItems: [AppSubscriptionLineItemInput!]!
      $returnUrl: URL!
      $test: Boolean
    ) {
      appSubscriptionCreate(
        name: $name
        returnUrl: $returnUrl
        lineItems: $lineItems
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

  // $0 usage-based cap – valid for a "free forever" tier
  const lineItems = [
    {
      plan: {
        appUsagePricingDetails: {
          cappedAmount: { amount: 0, currencyCode: "USD" },
          terms: "Free plan – no charges apply.",
        },
      },
    },
  ];

  let payload;
  const variables = { name: PLAN_FREE, lineItems, returnUrl, test };

  if (admin) {
    const json = await adminGraphqlRequest(admin, mutation, variables);
    payload = json?.data?.appSubscriptionCreate;
  } else {
    const data = await shopifyGraphqlRequest({
      storeDomain,
      token,
      apiVersion,
      query: mutation,
      variables,
    });
    payload = data?.appSubscriptionCreate;
  }
  const userErrors = payload?.userErrors || [];
  if (userErrors.length) {
    throw new Error(
      `Shopify billing error: ${userErrors.map((e) => e.message).join(", ")}`,
    );
  }

  const confirmationUrl = payload?.confirmationUrl;
  if (!confirmationUrl) {
    throw new Error(
      "Shopify billing error: Missing confirmationUrl for free plan",
    );
  }

  return {
    confirmationUrl,
    appSubscriptionId: payload?.appSubscription?.id || null,
  };
}

/**
 * Creates a PRO recurring subscription with a 7-day free trial at $12/month.
 */
export async function createProSubscription({
  admin,
  storeDomain,
  token,
  apiVersion,
  returnUrl,
  currencyCode,
  trialDays = 7,
  test = false,
}) {
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
            currencyCode: sanitizeCurrencyCode(currencyCode),
          },
          interval: "EVERY_30_DAYS",
        },
      },
    },
  ];

  let payload;
  const variables = { name: PLAN_PRO, lineItems, returnUrl, trialDays, test };

  if (admin) {
    const json = await adminGraphqlRequest(admin, mutation, variables);
    payload = json?.data?.appSubscriptionCreate;
  } else {
    const data = await shopifyGraphqlRequest({
      storeDomain,
      token,
      apiVersion,
      query: mutation,
      variables,
    });
    payload = data?.appSubscriptionCreate;
  }
  const userErrors = payload?.userErrors || [];
  if (userErrors.length) {
    throw new Error(
      `Shopify billing error: ${userErrors.map((e) => e.message).join(", ")}`,
    );
  }

  const confirmationUrl = payload?.confirmationUrl;
  if (!confirmationUrl) {
    throw new Error(
      "Shopify billing error: Missing confirmationUrl for pro plan",
    );
  }

  return {
    confirmationUrl,
    appSubscriptionId: payload?.appSubscription?.id || null,
  };
}

/**
 * Cancels an active app subscription.
 */
export async function cancelAppSubscription({
  admin,
  storeDomain,
  token,
  apiVersion,
  subscriptionId,
}) {
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
    payload = json?.data?.appSubscriptionCancel;
  } else {
    const data = await shopifyGraphqlRequest({
      storeDomain,
      token,
      apiVersion,
      query: mutation,
      variables,
    });
    payload = data?.appSubscriptionCancel;
  }

  const userErrors = payload?.userErrors || [];
  if (userErrors.length) {
    throw new Error(
      `Shopify billing error: ${userErrors.map((e) => e.message).join(", ")}`,
    );
  }

  return payload?.appSubscription;
}

async function runBillingGraphql({ admin, storeDomain, token, apiVersion, query, variables = {} }) {
  if (admin) {
    const json = await adminGraphqlRequest(admin, query, variables);
    return json?.data || {};
  }

  return shopifyGraphqlRequest({
    storeDomain,
    token,
    apiVersion,
    query,
    variables,
  });
}

export async function createCreditPackPurchase({
  admin,
  storeDomain,
  token,
  apiVersion,
  returnUrl,
  currencyCode,
  amount = 5,
  packName = "100 AI Tokens Package",
  test = false,
}) {
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
      currencyCode: sanitizeCurrencyCode(currencyCode),
    },
    returnUrl,
    test,
  };

  const data = await runBillingGraphql({
    admin,
    storeDomain,
    token,
    apiVersion,
    query: mutation,
    variables,
  });

  const payload = data?.appPurchaseOneTimeCreate;
  const userErrors = payload?.userErrors || [];
  if (userErrors.length) {
    throw new Error(
      `Shopify billing error: ${userErrors.map((e) => e.message).join(", ")}`,
    );
  }

  const confirmationUrl = payload?.confirmationUrl;
  if (!confirmationUrl) {
    throw new Error("Shopify billing error: Missing confirmationUrl for credit pack purchase.");
  }

  return {
    confirmationUrl,
    purchaseId: payload?.appPurchaseOneTime?.id || null,
  };
}

export async function getOneTimePurchases({
  admin,
  storeDomain,
  token,
  apiVersion,
}) {
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

  const data = await runBillingGraphql({
    admin,
    storeDomain,
    token,
    apiVersion,
    query,
  });

  return data?.currentAppInstallation?.oneTimePurchases?.nodes || [];
}

// ─── Legacy alias (kept for backward compatibility) ────────────────────────────
export const createAppSubscription = createProSubscription;
