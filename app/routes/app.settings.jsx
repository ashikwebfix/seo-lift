import { Form, Link, useActionData, useLoaderData, useNavigation } from "react-router";
import seoStyles from "../styles/seo.css?url";
import { getAppState, updateAppState } from "../services/app-state.server.js";
import { requireShopContext } from "../services/route-context.server";
import {
  getAiSettingsStatus,
  looksLikeGeminiApiKey,
  normalizeAiSettings,
} from "../services/ai-provider.server.js";
import { AI_FEATURES_ENABLED } from "../utils/feature-flags";

export const links = () => [{ rel: "stylesheet", href: seoStyles }];

export const loader = async ({ request }) => {
  if (!AI_FEATURES_ENABLED) {
    return {
      configError: "",
      aiSettings: normalizeAiSettings(),
      aiStatus: getAiSettingsStatus(),
      hidden: true,
    };
  }

  const { shop, configError } = await requireShopContext(request);
  if (configError) {
    return {
      configError,
      aiSettings: normalizeAiSettings(),
      aiStatus: getAiSettingsStatus(),
      hidden: false,
    };
  }

  const appState = await getAppState(shop);
  return {
    configError: "",
    aiSettings: {
      provider: appState.aiSettings.provider,
      model: appState.aiSettings.model,
    },
    aiStatus: getAiSettingsStatus(appState.aiSettings),
    hidden: false,
  };
};

export const action = async ({ request }) => {
  if (!AI_FEATURES_ENABLED) {
    return {
      ok: false,
      error: "AI settings are temporarily hidden.",
    };
  }

  const { shop, configError } = await requireShopContext(request);
  if (configError) {
    return { ok: false, error: configError };
  }

  try {
    const formData = await request.formData();
    const provider = String(formData.get("provider") || "gemini");
    const model = String(formData.get("model") || "gemini-2.5-flash");
    const apiKey = String(formData.get("apiKey") || "").trim();
    const clearApiKey = formData.get("clearApiKey") === "on";

    const currentState = await getAppState(shop);

    if (apiKey && provider === "gemini" && !looksLikeGeminiApiKey(apiKey)) {
      return {
        ok: false,
        error: "This does not look like a Gemini API key. Gemini keys usually start with AIza.",
      };
    }

    const mergedSettings = normalizeAiSettings({
      ...currentState.aiSettings,
      provider,
      model,
      apiKey: clearApiKey ? "" : apiKey || currentState.aiSettings.apiKey,
    });

    await updateAppState(shop, (current) => ({
      ...current,
      aiSettings: mergedSettings,
    }));

    const aiStatus = getAiSettingsStatus(mergedSettings);

    return {
      ok: true,
      message: aiStatus.hasApiKey
        ? "AI settings updated and the stored key is ready for AI Fix."
        : "AI settings updated. No API key is stored right now.",
      aiSettings: {
        provider: mergedSettings.provider,
        model: mergedSettings.model,
      },
      aiStatus,
    };
  } catch (error) {
    return {
      ok: false,
      error: error?.message || "Failed to save AI settings.",
    };
  }
};

export default function SettingsRoute() {
  const data = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const current = actionData?.ok
    ? {
        aiSettings: actionData.aiSettings,
        aiStatus: actionData.aiStatus,
      }
    : data;

  const isSubmitting = navigation.state === "submitting";

  return (
    <s-page full-width="true" heading="Settings">
      <div className="seo-wrap seo-grid">
        {data.hidden ? (
          <section className="section-card">
            <h3>Settings temporarily hidden</h3>
            <p className="metric-help" style={{ margin: 0 }}>
              AI settings are still in the codebase, but the option is hidden from the app for now.
            </p>
          </section>
        ) : null}
        {!data.hidden ? (
          <>
        {data.configError ? <div className="error-box">{data.configError}</div> : null}
        {actionData?.error ? <div className="error-box">{actionData.error}</div> : null}
        {actionData?.message ? <div className="metric-card"><strong>{actionData.message}</strong></div> : null}

        <section className="section-card">
          <h3>AI Provider</h3>
          <p className="metric-help">
            AI Fix uses the saved provider settings from this page. The default setup uses Gemini 2.5 Flash.
          </p>

          <div className="metric-card" style={{ marginTop: 16 }}>
            <p className="metric-label">AI status</p>
            <h3 style={{ marginBottom: 8 }}>
              {current.aiStatus.hasApiKey ? "Ready for AI Fix" : "API key needed"}
            </h3>
            <p className="metric-help" style={{ marginBottom: 4 }}>
              Stored key: {current.aiStatus.hasApiKey ? current.aiStatus.apiKeyMask : "Not saved"}
            </p>
            <p className="metric-help" style={{ margin: 0 }}>
              {current.aiStatus.hasApiKey
                ? "For security, the full API key is never shown again after save."
                : "Add a Gemini API key to enable AI-generated SEO fixes."}
            </p>
          </div>

          <Form method="post" className="seo-grid" style={{ marginTop: 16 }}>
            <div className="grid-2">
              <label className="editor-field">
                <span>Provider</span>
                <select className="seo-input" name="provider" defaultValue={current.aiSettings.provider}>
                  <option value="gemini">Gemini</option>
                </select>
              </label>

              <label className="editor-field">
                <span>Model</span>
                <input className="seo-input" name="model" defaultValue={current.aiSettings.model} />
              </label>
            </div>

            <label className="editor-field">
              <span>API Key</span>
              <input
                className="seo-input"
                type="password"
                name="apiKey"
                autoComplete="new-password"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                placeholder={
                  current.aiStatus.hasApiKey
                    ? "Saved. Leave blank to keep current key."
                    : "Enter provider API key"
                }
              />
              <small>
                {current.aiStatus.hasApiKey
                  ? `A key is already stored as ${current.aiStatus.apiKeyMask}. Leave this blank to keep it, or check remove below.`
                  : "Save a Gemini API key here to enable AI Fix buttons across the app."}
              </small>
            </label>

            <label className="editor-field" style={{ gap: 8 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input type="checkbox" name="clearApiKey" value="on" />
                Remove saved API key
              </span>
              <small>Use this if you want to replace or clear the currently stored key.</small>
            </label>

            <div className="toolbar">
              <button className="seo-button" type="submit" disabled={Boolean(data.configError) || isSubmitting}>
                {isSubmitting ? "Saving..." : "Save AI Settings"}
              </button>
              <Link to="/app">Dashboard</Link>
            </div>
          </Form>
        </section>
          </>
        ) : null}
      </div>
    </s-page>
  );
}
