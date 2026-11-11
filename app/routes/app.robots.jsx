import { useEffect, useMemo, useState } from "react";
import { Link, useFetcher, useLoaderData } from "react-router";
import seoStyles from "../styles/seo.css?url";
import { WorkspaceSubnav, dispatchCreditsUpdate } from "../components/seo-ui";
import { showToast } from "../components/toast-viewport";
import { getAppState, updateAppState } from "../services/app-state.server";
import { requireShopContext } from "../services/route-context.server";
import { applyIncrementalAuditPatch } from "../services/seo-engine.server";
import { AI_FEATURES_ENABLED } from "../utils/feature-flags";
import { CREDIT_COSTS } from "../utils/credits.js";
import { validateRobotsRules } from "../validators/seoValidators";

export const links = () => [{ rel: "stylesheet", href: seoStyles }];

function buildShopifyRobotsLiquid(rulesText) {
  const lines = String(rulesText || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !/^user-agent:/i.test(line));

  const customRules = lines.filter(
    (line) => !/^disallow:\s*\/(cart|search)$/i.test(line) && !/^allow:\s*\/$/i.test(line),
  );

  return [
    `{% for group in robots.default_groups %}`,
    `  {{- group.user_agent -}}`,
    ``,
    `  {% for rule in group.rules %}`,
    `    {{- rule -}}`,
    `  {% endfor %}`,
    ``,
    `  {%- if group.user_agent.value == '*' -%}`,
    ...(customRules.length
      ? customRules.map((r) => `    {{ '${r.replace(/'/g, "\\'")}' }}`)
      : [`    {{ 'Disallow: /collections/*+*' }}`]),
    `  {%- endif -%}`,
    ``,
    `  {%- if group.sitemap != blank -%}`,
    `    {{ group.sitemap }}`,
    `  {%- endif -%}`,
    `{% endfor %}`,
  ].join("\n");
}

export const loader = async ({ request }) => {
  const { shop, configError } = await requireShopContext(request);
  const appState = shop ? await getAppState(shop) : null;

  return {
    configError,
    shop,
    robotsTxt: appState?.robotsTxt || "",
    validation: validateRobotsRules(appState?.robotsTxt || ""),
  };
};

export const action = async ({ request }) => {
  const { shop, token, apiVersion, configError } = await requireShopContext(request);
  if (configError) {
    return { ok: false, error: configError };
  }

  const formData = await request.formData();
  const intent = String(formData.get("intent") || "save");
  const robotsTxt = String(formData.get("robotsTxt") || "");

  if (intent === "fetchLive") {
    try {
      const res = await fetch(`https://${shop}/robots.txt`);
      const text = await res.text();
      return {
        ok: true,
        intent: "fetchLive",
        liveStatus: res.status,
        liveRobotsTxt: text.slice(0, 8000),
      };
    } catch (error) {
      return {
        ok: false,
        error: `Unable to fetch live https://${shop}/robots.txt (${error?.message || "network error"}).`,
      };
    }
  }

  const validation = validateRobotsRules(robotsTxt);

  try {
    await updateAppState(shop, (current) => ({
      ...current,
      robotsTxt,
    }));

    await applyIncrementalAuditPatch({
      shop,
      storeDomain: shop,
      token,
      apiVersion,
      updatedProducts: [],
    });

    return {
      ok: true,
      intent: "save",
      validation,
    };
  } catch (error) {
    return {
      ok: false,
      error: error?.message || "Failed to save robots.txt.",
    };
  }
};

export default function RobotsRoute() {
  const data = useLoaderData();
  const fetcher = useFetcher();
  const aiFetcher = useFetcher();
  const [robotsTxt, setRobotsTxt] = useState(data.robotsTxt || "");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (aiFetcher.data?.ok && aiFetcher.data?.creditsRemaining !== undefined) {
      dispatchCreditsUpdate({
        availableCredits: aiFetcher.data.creditsRemaining,
        plan: aiFetcher.data.plan,
        superAccess: Boolean(aiFetcher.data.superAccess),
      });
    }
    if (aiFetcher.data?.ok && aiFetcher.data?.result?.robotsTxt) {
      setRobotsTxt(aiFetcher.data.result.robotsTxt);
      showToast({
        tone: "info",
        title: "AI Directives Ready",
        message: "Optimized robots.txt draft applied to editor.",
      });
    }
  }, [aiFetcher.data]);

  useEffect(() => {
    if (!fetcher.data?.ok) return;
    if (fetcher.data.intent === "save") {
      showToast({
        tone: "success",
        title: "Robots.txt Saved",
        message: "Saved draft rules and updated store audit score.",
      });
    } else if (fetcher.data.intent === "fetchLive") {
      showToast({
        tone: "info",
        title: "Live Robots.txt Checked",
        message: `Fetched live storefront /robots.txt (HTTP ${fetcher.data.liveStatus}).`,
      });
    }
  }, [fetcher.data]);

  const validation = fetcher.data?.validation || data.validation;
  const liquidTemplate = useMemo(() => buildShopifyRobotsLiquid(robotsTxt), [robotsTxt]);

  function submit(intent) {
    fetcher.submit({ intent, robotsTxt }, { method: "post" });
  }

  function runAiOptimize() {
    aiFetcher.submit(
      {
        payload: JSON.stringify({
          actionType: "robots_txt_improvement",
          useAi: true,
          currentRules: robotsTxt,
          title: "robots.txt Directives",
        }),
      },
      { method: "post", action: "/app/api/ai" },
    );
  }

  function copyLiquid() {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(liquidTemplate);
      setCopied(true);
      showToast({
        tone: "success",
        title: "Copied Liquid Template",
        message: "Shopify templates/robots.txt.liquid copied to clipboard.",
      });
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <>
      <ui-title-bar title="Technical & History — Robots.txt" />
      <div className="seo-wrap seo-grid">
        <WorkspaceSubnav group="technical" />
        {data.configError ? <div className="error-box">{data.configError}</div> : null}
        {fetcher.data?.error ? <div className="error-box">{fetcher.data.error}</div> : null}
        {aiFetcher.data?.error ? (
          <div className="error-box">
            {aiFetcher.data.error}{" "}
            {aiFetcher.data?.outOfCredits ? <Link to="/app/billing">Upgrade or manage credits</Link> : null}
          </div>
        ) : null}

        <div className="section-card" style={{ background: "var(--seo-bg-accent)", padding: "12px 16px" }}>
          <small>
            <strong>How Shopify Robots.txt works:</strong> Shopify automatically serves `/robots.txt` from your active
            theme's <code>templates/robots.txt.liquid</code>. Use this tool to inspect your live storefront file,
            optimize directives with Gemini AI, and export the exact Liquid template for your Shopify theme.
          </small>
        </div>

        <div className="toolbar" style={{ flexWrap: "wrap" }}>
          {AI_FEATURES_ENABLED ? (
            <button
              className="seo-button secondary"
              type="button"
              onClick={runAiOptimize}
              disabled={aiFetcher.state !== "idle"}
              title={`Use Gemini AI to optimize robots.txt directives (${CREDIT_COSTS.robots_txt_improvement} tokens)`}
            >
              {aiFetcher.state !== "idle"
                ? "Optimizing..."
                : `🤖 Gemini AI Optimize (${CREDIT_COSTS.robots_txt_improvement} tok)`}
            </button>
          ) : null}
          <button
            className="seo-button secondary"
            type="button"
            onClick={() => submit("fetchLive")}
            disabled={fetcher.state !== "idle"}
          >
            {fetcher.state !== "idle" ? "Checking..." : "🌐 Inspect Live /robots.txt"}
          </button>
          <button
            className="seo-button"
            type="button"
            onClick={() => submit("save")}
            disabled={fetcher.state !== "idle"}
          >
            Save Draft &amp; Re-Audit
          </button>
        </div>

        {fetcher.data?.intent === "fetchLive" && fetcher.data?.liveRobotsTxt ? (
          <div className="section-card">
            <div className="toolbar" style={{ justifyContent: "space-between", marginBottom: 8 }}>
              <h4 style={{ margin: 0 }}>Live Storefront `/robots.txt` (HTTP {fetcher.data.liveStatus})</h4>
              <a href={`https://${data.shop}/robots.txt`} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>
                Open live URL ↗
              </a>
            </div>
            <pre style={{ margin: 0, padding: 12, background: "#f4f7fa", borderRadius: 6, overflowX: "auto", fontSize: 12 }}>
              {fetcher.data.liveRobotsTxt}
            </pre>
          </div>
        ) : null}

        <div className="seo-grid grid-2">
          <div className="section-card seo-grid">
            <h4 style={{ margin: 0 }}>Draft Rules &amp; Validation</h4>
            <textarea
              className="seo-textarea"
              rows={12}
              value={robotsTxt}
              onChange={(event) => setRobotsTxt(event.target.value)}
            />
            <p style={{ margin: 0 }}>
              /cart disallow: <strong>{validation?.disallowCart ? "Yes" : "No"}</strong> | /search disallow:{" "}
              <strong>{validation?.disallowSearch ? "Yes" : "No"}</strong>
            </p>
            {!validation?.valid ? (
              <div className="error-box" data-no-toast="true">
                {validation?.message}
              </div>
            ) : null}
            {aiFetcher.data?.ok && aiFetcher.data?.result?.rationale ? (
              <small style={{ color: "var(--seo-primary)" }}>
                🤖 {aiFetcher.data.result.rationale}{" "}
                {aiFetcher.data.superAccess
                  ? "(Super Access · 0 tok)"
                  : aiFetcher.data.creditsRemaining !== undefined
                    ? `(${aiFetcher.data.creditsRemaining} tokens left)`
                    : ""}
              </small>
            ) : null}
          </div>

          <div className="section-card seo-grid">
            <div className="toolbar" style={{ justifyContent: "space-between", margin: 0 }}>
              <h4 style={{ margin: 0 }}>Shopify `templates/robots.txt.liquid`</h4>
              <button type="button" className="seo-button secondary" style={{ padding: "4px 10px", fontSize: 12 }} onClick={copyLiquid}>
                {copied ? "✓ Copied!" : "Copy Liquid"}
              </button>
            </div>
            <textarea className="seo-textarea" rows={12} readOnly value={liquidTemplate} style={{ fontFamily: "monospace", fontSize: 12 }} />
            <small style={{ color: "var(--seo-muted)" }}>
              In Shopify Admin → Online Store → Themes → Edit code → Add a new template <code>robots.txt.liquid</code> and paste this code.
            </small>
          </div>
        </div>
      </div>
    </>
  );
}
