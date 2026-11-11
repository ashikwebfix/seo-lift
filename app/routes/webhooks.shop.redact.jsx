import { authenticate } from "../shopify.server";
import { purgeShopData } from "../services/shop-cleanup.server.js";

export const action = async ({ request }) => {
  const { shop, topic } = await authenticate.webhook(request);
  console.log(`Received compliance webhook ${topic} for ${shop}`);

  if (shop) {
    await purgeShopData(shop);
  }

  return new Response();
};

