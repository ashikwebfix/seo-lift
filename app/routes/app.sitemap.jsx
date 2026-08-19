import { useState } from "react";
import { Link, useFetcher, useLoaderData } from "react-router";
import seoStyles from "../styles/seo.css?url";
import { getAppState } from "../services/app-state.server";
import { requireShopContext } from "../services/route-context.server";
import { regenerateSitemap } from "../services/seo-workflows.server";

export const links = () => [{ rel: "stylesheet", href: seoStyles }];

export const loader = async ({ request }) => {
  const { shop, configError } = await requireShopContext(request);
  const appState = shop ? await getAppState(shop) : null;

  return {
    configError,
    generatedAt: appState?.sitemapGeneratedAt || null,
    urls: appState?.sitemapUrls || [],
    manualUrls: appState?.sitemapManualUrls || [],
  };
};

export const action = async ({ request }) => {
  const { shop, token, apiVersion, configError } = await requireShopContext(request);
  if (configError) {
    return { ok: false, error: configError };
  }

  const formData = await request.formData();
  const manualUrl = String(formData.get("manualUrl") || "");

  try {
    const result = await regenerateSitemap({
      shop,
      storeDomain: shop,
      token,
      apiVersion,
      extraManualUrl: manualUrl,
    });

    return {
      ok: true,
      ...result,
    };
  } catch (error) {
    return {
      ok: false,
      error: error?.message || "Failed to regenerate sitemap.",
    };
  }
};

export default function SitemapRoute() {
  const data = useLoaderData();
  const fetcher = useFetcher();
  const [manualUrl, setManualUrl] = useState("");

  const generatedAt = fetcher.data?.generatedAt || data.generatedAt;
  const urls = fetcher.data?.urls || data.urls;

  function regenerate() {
    fetcher.submit({ manualUrl }, { method: "post" });
    setManualUrl("");
  }

  return (
    <s-page full-width="true" heading="Sitemap Manager">
      <div className="seo-wrap seo-grid">
        {data.configError ? <div className="error-box">{data.configError}</div> : null}
        {fetcher.data?.error ? <div className="error-box">{fetcher.data.error}</div> : null}

        <div className="toolbar">
          <input
            className="seo-input"
            placeholder="https://example.com/custom-page"
            value={manualUrl}
            onChange={(event) => setManualUrl(event.target.value)}
            style={{ maxWidth: 360 }}
          />
          <button className="seo-button" type="button" onClick={regenerate}>Add manual URL + regenerate</button>
          <Link to="/app">Dashboard</Link>
        </div>

        <div className="seo-grid grid-2">
          <div className="metric-card">
            <p className="metric-label">Generated at</p>
            <h3 style={{ fontSize: 16 }}>{generatedAt ? new Date(generatedAt).toLocaleString() : "Not generated"}</h3>
          </div>
          <div className="metric-card">
            <p className="metric-label">URL count</p>
            <h3>{urls.length}</h3>
          </div>
        </div>

        {!urls.length ? (
          <div className="empty-box">No sitemap URLs yet. Regenerate to populate current store data.</div>
        ) : (
          <div className="section-card">
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {urls.map((url) => (
                <li key={url}>{url}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </s-page>
  );
}
