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
  const code = "USD".toUpperCase();
  return ALLOWED_BILLING_CURRENCIES.has(code) ? code : "USD";
}

// ─── Query helpers ─────────────────────────────────────────────────────────────

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
  try {
    const response = await admin.graphql(mutation, { variables });
    const json = await response.json();
    // If the SDK didn't throw but errors are in the body, surface them
    if (json?.errors) {
      const msgs = Array.isArray(json.errors)
        ? json.errors.map((e) => e.message).join(", ")
        : String(json.errors);
      throw new Error(`Shopify GraphQL error: ${msgs}`);
    }
    return json;
  } catch (error) {
    // Handle GraphqlQueryError from @shopify/shopify-api SDK
    if (error.graphQLErrors) {
      const messages = error.graphQLErrors.map((e) => e.message).join(", ");
      throw new Error(`Shopify billing error: ${messages}`);
    }
    // Handle userErrors returned in the mutation payload
    if (error.userErrors) {
      const messages = error.userErrors.map((e) => e.message).join(", ");
      throw new Error(`Shopify billing error: ${messages}`);
    }
    throw error;
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

// ─── Legacy alias (kept for backward compatibility) ────────────────────────────
export const createAppSubscription = createProSubscription;
