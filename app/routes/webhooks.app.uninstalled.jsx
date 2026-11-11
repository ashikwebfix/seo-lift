import { authenticate } from "../shopify.server";
import { clearShopSessions } from "../services/shop-cleanup.server.js";

export const action = async ({ request }) => {
  const { shop, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  if (shop) {
    // Only revoke active Shopify sessions on uninstall; full GDPR deletion happens in shop/redact.
    await clearShopSessions(shop);
  }

  return new Response();
};
