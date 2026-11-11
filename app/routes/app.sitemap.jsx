import { useEffect, useMemo, useState } from "react";
import { useFetcher, useLoaderData } from "react-router";
import seoStyles from "../styles/seo.css?url";
import { WorkspaceSubnav } from "../components/seo-ui";
import { showToast } from "../components/toast-viewport";
import { getAppState } from "../services/app-state.server";
import { requireShopContext } from "../services/route-context.server";
import { regenerateSitemap } from "../services/seo-workflows.server";

export const links = () => [{ rel: "stylesheet", href: seoStyles }];

function escapeXml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildXmlSitemap(urls = []) {
  const lines = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    ...urls.map((url) => `  <url><loc>${escapeXml(url)}</loc></url>`),
    `</urlset>`,
  ];
  return lines.join("\n");
}

function extractChildSitemaps(xmlText) {
  const matches = [];
  const regex = /<loc>(https?:\/\/[^<]+)<\/loc>/gi;
  let match = regex.exec(xmlText);
  while (match) {
    matches.push(match[1]);
    match = regex.exec(xmlText);
  }
  return matches;
}

export const loader = async ({ request }) => {
  const { shop, configError } = await requireShopContext(request);
  const appState = shop ? await getAppState(shop) : null;

  return {
    configError,
    shop,
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
  const intent = String(formData.get("intent") || "regenerate");
  const manualUrl = String(formData.get("manualUrl") || "");

  if (intent === "checkLive") {
    try {
      const res = await fetch(`https://${shop}/sitemap.xml`);
      const xml = await res.text();
      const childSitemaps = extractChildSitemaps(xml);
      return {
        ok: true,
        intent: "checkLive",
        liveStatus: res.status,
        childSitemaps,
      };
    } catch (error) {
      return {
        ok: false,
        error: `Unable to reach https://${shop}/sitemap.xml (${error?.message || "network error"}).`,
      };
    }
  }

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
      intent: "regenerate",
      ...result,
    };
  } catch (error) {
    return {
      ok: false,
      error: error?.message || "Failed to regenerate sitemap.",
    };
  }
};

const SITEMAP_PAGE_SIZE = 50;

export default function SitemapRoute() {
  const data = useLoaderData();
  const fetcher = useFetcher();
  const [manualUrl, setManualUrl] = useState("");
  const [urlFilter, setUrlFilter] = useState("");
  const [page, setPage] = useState(1);

  const generatedAt = fetcher.data?.generatedAt || data.generatedAt;
  const urls = fetcher.data?.urls || data.urls;
  const filteredUrls = useMemo(() => {
    const q = urlFilter.trim().toLowerCase();
    if (!q) return urls;
    return urls.filter((u) => String(u).toLowerCase().includes(q));
  }, [urls, urlFilter]);
  const totalPages = Math.max(1, Math.ceil(filteredUrls.length / SITEMAP_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const visibleUrls = filteredUrls.slice(
    (safePage - 1) * SITEMAP_PAGE_SIZE,
    safePage * SITEMAP_PAGE_SIZE,
  );
  const xmlContent = useMemo(() => buildXmlSitemap(urls), [urls]);

  useEffect(() => {
    if (!fetcher.data?.ok) return;
    if (fetcher.data.intent === "regenerate") {
      showToast({
        tone: "success",
        title: "Sitemap Regenerated",
        message: `Inventory updated with ${fetcher.data.urls?.length || 0} URLs.`,
      });
    } else if (fetcher.data.intent === "checkLive") {
      showToast({
        tone: "info",
        title: "Live Sitemap Checked",
        message: `Storefront /sitemap.xml returned HTTP ${fetcher.data.liveStatus}.`,
      });
    }
  }, [fetcher.data]);

  function regenerate() {
    fetcher.submit({ intent: "regenerate", manualUrl }, { method: "post" });
    setManualUrl("");
  }

  function checkLive() {
    fetcher.submit({ intent: "checkLive" }, { method: "post" });
  }

  function downloadXml() {
    if (typeof window === "undefined") return;
    const blob = new Blob([xmlContent], { type: "application/xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sitemap-${data.shop || "store"}.xml`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <ui-title-bar title="Technical & History — XML Sitemap" />
      <div className="seo-wrap seo-grid">
        <WorkspaceSubnav group="technical" />
        {data.configError ? <div className="error-box">{data.configError}</div> : null}
        {fetcher.data?.error ? <div className="error-box">{fetcher.data.error}</div> : null}

        <div className="section-card" style={{ background: "var(--seo-bg-accent)", padding: "12px 16px" }}>
          <small>
            <strong>How Shopify Sitemaps work:</strong> Shopify automatically generates and updates your root{" "}
            <a href={`https://${data.shop}/sitemap.xml`} target="_blank" rel="noreferrer">
              <code>/sitemap.xml</code> ↗
            </a>
            . Use this tool to inspect your live Google-facing sitemaps, validate your full catalog URL inventory, and export XML files.
          </small>
        </div>

        <div className="toolbar" style={{ flexWrap: "wrap" }}>
          <input
            className="seo-input"
            placeholder="https://example.com/custom-page"
            value={manualUrl}
            onChange={(event) => setManualUrl(event.target.value)}
            style={{ maxWidth: 320 }}
          />
          <button className="seo-button" type="button" onClick={regenerate} disabled={fetcher.state !== "idle"}>
            Add manual URL + regenerate
          </button>
          <button className="seo-button secondary" type="button" onClick={checkLive} disabled={fetcher.state !== "idle"}>
            {fetcher.state !== "idle" ? "Checking..." : "🌐 Check Live /sitemap.xml"}
          </button>
          {urls.length ? (
            <button className="seo-button secondary" type="button" onClick={downloadXml}>
              ⬇ Export XML
            </button>
          ) : null}
        </div>

        {fetcher.data?.intent === "checkLive" ? (
          <div className="section-card">
            <h4 style={{ margin: "0 0 8px 0" }}>
              Live Shopify Sitemap Index (HTTP {fetcher.data.liveStatus})
            </h4>
            {fetcher.data.childSitemaps?.length ? (
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
                {fetcher.data.childSitemaps.map((loc) => (
                  <li key={loc}>
                    <a href={loc} target="_blank" rel="noreferrer">{loc} ↗</a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="metric-help" style={{ margin: 0 }}>
                Live sitemap checked (HTTP {fetcher.data.liveStatus}). Note: password-protected dev stores may restrict public sitemap access until password is removed or verified.
              </p>
            )}
          </div>
        ) : null}

        <div className="seo-grid grid-2">
          <div className="metric-card">
            <p className="metric-label">Generated at</p>
            <h3 style={{ fontSize: 16 }}>{generatedAt ? new Date(generatedAt).toLocaleString() : "Not generated"}</h3>
          </div>
          <div className="metric-card">
            <p className="metric-label">URL Inventory Count</p>
            <h3>{urls.length}</h3>
          </div>
        </div>

        {!urls.length ? (
          <div className="empty-box">No sitemap URLs yet. Regenerate to populate current store data.</div>
        ) : (
          <div className="section-card seo-grid">
            <div className="toolbar" style={{ justifyContent: "space-between", margin: 0 }}>
              <input
                type="search"
                className="seo-input"
                placeholder="Filter sitemap URLs..."
                value={urlFilter}
                onChange={(e) => {
                  setUrlFilter(e.target.value);
                  setPage(1);
                }}
                style={{ maxWidth: 320 }}
              />
              <small style={{ color: "var(--seo-muted)" }}>
                Showing {visibleUrls.length} of {filteredUrls.length} URLs (Page {safePage}/{totalPages})
              </small>
            </div>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {visibleUrls.map((url) => (
                <li key={url}>{url}</li>
              ))}
            </ul>
            {totalPages > 1 ? (
              <div className="toolbar" style={{ justifyContent: "space-between", margin: 0 }}>
                <button
                  type="button"
                  className="seo-button secondary"
                  disabled={safePage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous 50
                </button>
                <button
                  type="button"
                  className="seo-button secondary"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next 50
                </button>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </>
  );
}
