import { authenticate } from "../shopify.server";
import { getShopContext } from "./shopify-admin.server";

export async function requireShopContext(request) {
  const auth = await authenticate.admin(request);
  const url = new URL(request.url);

  const sessionShop = auth?.session?.shop || "";
  const sessionToken = auth?.session?.accessToken || "";
  const urlShop = url.searchParams.get("shop") || "";

  const context = getShopContext({ sessionShop, sessionToken, urlShop });

  return {
    auth,
    admin: auth.admin,
    shop: context.storeDomain,
    token: context.token,
    apiVersion: context.apiVersion,
    configError: context.configError,
  };
}
