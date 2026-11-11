import { redirect } from "react-router";
import { updateAppState } from "../services/app-state.server";
import {
  exchangeGscCodeForTokens,
  syncGscMetricsForShop,
  verifySignedGscState,
} from "../services/gsc.server";
import { getShopContext } from "../services/shopify-admin.server";
import prisma from "../db.server";

function buildReturnUrl(shop, host, statusParam) {
  const params = new URLSearchParams(statusParam);
  if (shop) params.set("shop", shop);
  if (host) params.set("host", host);
  return `/app/seo-audit?${params.toString()}`;
}

export const loader = async ({ request }) => {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const rawState = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  const verified = verifySignedGscState(rawState);
  if (!verified?.shop) {
    return redirect("/app/seo-audit?gscError=Invalid+or+expired+Google+OAuth+state.");
  }

  const { shop, host } = verified;
  if (oauthError) {
    return redirect(buildReturnUrl(shop, host, `gscError=${encodeURIComponent(oauthError)}`));
  }

  if (!code) {
    return redirect(buildReturnUrl(shop, host, "gscError=Missing+Google+authorization+code."));
  }

  try {
    const tokens = await exchangeGscCodeForTokens({
      code,
      origin: url.origin,
    });

    await updateAppState(shop, (current) => ({
      ...current,
      gsc: {
        ...current.gsc,
        connected: true,
        mode: "oauth",
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken || current.gsc?.refreshToken || "",
        expiresAt: tokens.expiresAt,
      },
    }));

    const offlineSession = await prisma.session.findFirst({
      where: { shop, isOnline: false },
      orderBy: { id: "desc" },
    });
    const ctx = getShopContext({
      sessionShop: shop,
      sessionToken: offlineSession?.accessToken || "",
    });

    await syncGscMetricsForShop({
      shop,
      storeDomain: ctx.storeDomain || shop,
      token: ctx.token,
      apiVersion: ctx.apiVersion,
    });

    return redirect(buildReturnUrl(shop, host, "gsc=connected"));
  } catch (error) {
    const msg = error?.message || "Google Search Console connection failed.";
    return redirect(buildReturnUrl(shop, host, `gscError=${encodeURIComponent(msg)}`));
  }
};
