import { authenticate } from "../shopify.server";
import { runAutopilotForCreatedProduct } from "../services/seo-workflows.server";

export const action = async ({ request }) => {
  const { shop, topic, payload } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop} (product ${payload?.id || "unknown"})`);

  if (shop && payload?.id) {
    // Run AI optimization asynchronously so Shopify receives an immediate 200 OK within its 5s webhook window
    void runAutopilotForCreatedProduct({
      shop,
      productPayload: payload,
    }).catch((err) => {
      console.warn(`Autopilot failed for ${shop} product ${payload?.id}:`, err?.message);
    });
  }

  return new Response(null, { status: 200 });
};

