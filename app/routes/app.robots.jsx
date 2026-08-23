import { useEffect, useState } from "react";
import { Link, useFetcher, useLoaderData } from "react-router";
import seoStyles from "../styles/seo.css?url";
import { aiRobotsImprovement } from "../services/ai-fixes.server";
import { getAppState, updateAppState } from "../services/app-state.server";
import { requireShopContext } from "../services/route-context.server";
import { runFullScan } from "../services/seo-engine.server";
import { validateRobotsRules } from "../validators/seoValidators";

export const links = () => [{ rel: "stylesheet", href: seoStyles }];

export const loader = async ({ request }) => {
  const { shop, configError } = await requireShopContext(request);
  const appState = shop ? await getAppState(shop) : null;

  return {
    configError,
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

  if (intent === "aiImprove") {
    const improved = aiRobotsImprovement({ currentRules: robotsTxt });
    return {
      ok: true,
      ...improved,
    };
  }

  const validation = validateRobotsRules(robotsTxt);

  try {
    await updateAppState(shop, (current) => ({
      ...current,
      robotsTxt,
    }));

    await runFullScan({
      shop,
      storeDomain: shop,
      token,
      apiVersion,
    });

    return {
      ok: true,
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
  const [robotsTxt, setRobotsTxt] = useState(data.robotsTxt || "");

  useEffect(() => {
    if (fetcher.data?.robotsTxt) {
      setRobotsTxt(fetcher.data.robotsTxt);
    }
  }, [fetcher.data]);

  const validation = fetcher.data?.validation || data.validation;

  function submit(intent) {
    fetcher.submit(
      {
        intent,
        robotsTxt,
      },
      { method: "post" },
    );
  }

  return (
    <>
      <ui-title-bar title="Robots.txt Manager" />
      <div className="seo-wrap seo-grid">
        {data.configError ? <div className="error-box">{data.configError}</div> : null}
        {fetcher.data?.error ? <div className="error-box">{fetcher.data.error}</div> : null}

        <div className="toolbar">
          <button className="seo-button secondary" type="button" onClick={() => submit("aiImprove")}>Improve with AI</button>
          <button className="seo-button" type="button" onClick={() => submit("save")}>Save and validate</button>
          <Link to="/app">Dashboard</Link>
        </div>

        <div className="section-card seo-grid">
          <textarea
            className="seo-textarea"
            rows={12}
            value={robotsTxt}
            onChange={(event) => setRobotsTxt(event.target.value)}
          />
          <p style={{ margin: 0 }}>
            /cart disallow: <strong>{validation?.disallowCart ? "Yes" : "No"}</strong> | /search disallow: <strong>{validation?.disallowSearch ? "Yes" : "No"}</strong>
          </p>
          {!validation?.valid ? <div className="error-box">{validation?.message}</div> : null}
          {fetcher.data?.rationale ? <p style={{ margin: 0 }}>{fetcher.data.rationale}</p> : null}
        </div>
      </div>
        </>
  );
}
