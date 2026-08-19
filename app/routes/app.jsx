/* global globalThis */
import { Outlet, useLoaderData, useRouteError, redirect } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { authenticate } from "../shopify.server";
import { AI_FEATURES_ENABLED } from "../utils/feature-flags";
import { requireShopContext } from "../services/route-context.server";
import { getActiveAppSubscriptions } from "../services/billing.server";

export const loader = async ({ request }) => {
  await authenticate.admin(request);

  const url = new URL(request.url);
  const pathname = url.pathname;
  const isBillingPath = pathname.startsWith("/app/billing");

  if (!isBillingPath) {
    try {
      const { admin, shop, token, apiVersion } = await requireShopContext(request);
      const activeSubscriptions = await getActiveAppSubscriptions({
        admin,
        storeDomain: shop,
        token,
        apiVersion,
      });

      // Redirect only when there is NO subscription at all (Free OR Pro both count).
      if (!activeSubscriptions?.length) {
        throw redirect(`/app/billing${url.search}`);
      }
    } catch (error) {
      if (error instanceof Response) throw error; // let redirect() pass through
      // If billing check fails for other reasons, don't block access.
    }
  }

  return { apiKey: globalThis.process?.env?.SHOPIFY_API_KEY || "" };
};

export default function App() {
  const { apiKey } = useLoaderData();

  return (
    <AppProvider embedded apiKey={apiKey}>
      <s-app-nav>
        <s-link href="/app">Dashboard</s-link>
        <s-link href="/app/seo-audit">SEO Audit</s-link>
        <s-link href="/app/products">Product SEO</s-link>
        <s-link href="/app/bulk-meta">Bulk Meta</s-link>
        <s-link href="/app/image-optimizer">Image Optimizer</s-link>
        <s-link href="/app/url-optimization">URL Optimization</s-link>
        <s-link href="/app/robots">Robots.txt</s-link>
        <s-link href="/app/sitemap">Sitemap</s-link>
        {AI_FEATURES_ENABLED ? <s-link href="/app/settings">Settings</s-link> : null}
        <s-link href="/app/billing">💳 Billing</s-link>
      </s-app-nav>
      <Outlet />
    </AppProvider>
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
