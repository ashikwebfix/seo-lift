import { useState } from "react";
import { Form, useActionData, useLoaderData, useNavigation } from "react-router";
import prisma from "../db.server";
import { looksLikeGeminiApiKey, testGeminiConnection } from "../services/ai-provider.server";
import { requireSuperAdmin } from "../services/superadmin-auth.server";
import {
  getEffectiveGscOAuthConfig,
  getEffectivePageSpeedConfig,
  getEffectivePlatformAiSettings,
  updatePlatformAiConfig,
  updatePlatformGscOAuthConfig,
  updatePlatformPageSpeedConfig,
} from "../services/store-control.server";
import {
  DEFAULT_GEMINI_MODEL,
  GEMINI_MODEL_CATALOG,
  PRESET_GEMINI_MODEL_IDS,
} from "../utils/gemini-models";

export const loader = async ({ request }) => {
  await requireSuperAdmin(request);

  const [aiConfig, gscOAuth, pageSpeedConfig, recentLogs, totalAgg] = await Promise.all([
    getEffectivePlatformAiSettings(),
    getEffectiveGscOAuthConfig(),
    getEffectivePageSpeedConfig(),
    prisma.aiCreditUsageLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 25,
    }),
    prisma.aiCreditUsageLog.aggregate({
      where: {
        actionType: { not: "credit_pack_purchase" },
        creditsDeducted: { gte: 0 },
      },
      _count: { id: true },
      _sum: { creditsDeducted: true },
    }),
  ]);

  return {
    aiConfig: {
      provider: aiConfig.provider,
      model: aiConfig.model,
      temperature: aiConfig.temperature,
      isEnabled: aiConfig.isEnabled,
      hasDbKey: aiConfig.hasDbKey,
      dbKeyMask: aiConfig.dbKeyMask,
      usingEnvFallback: aiConfig.usingEnvFallback,
      hasEffectiveKey: Boolean(aiConfig.apiKey),
      updatedBy: aiConfig.updatedBy,
      updatedAt: aiConfig.updatedAt,
    },
    gscOAuth: {
      clientId: gscOAuth.clientId,
      hasSecret: Boolean(gscOAuth.clientSecret),
      maskedSecret: gscOAuth.maskedSecret,
      hasDbConfig: gscOAuth.hasDbConfig,
      usingEnvFallback: gscOAuth.usingEnvFallback,
    },
    pageSpeedConfig: {
      hasKey: Boolean(pageSpeedConfig.apiKey),
      hasDbKey: pageSpeedConfig.hasDbKey,
      maskedKey: pageSpeedConfig.maskedKey,
      usingEnvFallback: pageSpeedConfig.usingEnvFallback,
    },
    recentLogs,
    totalCalls: totalAgg._count?.id || 0,
    totalCreditsUsed: Math.max(0, totalAgg._sum?.creditsDeducted || 0),
  };
};

export const action = async ({ request }) => {
  const adminUser = await requireSuperAdmin(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") || "save");

  try {
    if (intent === "saveGscOAuth") {
      const clientId = String(formData.get("gscClientId") || "").trim();
      const clientSecret = String(formData.get("gscClientSecret") || "").trim();
      const clearConfig = formData.get("clearGscConfig") === "on";
      await updatePlatformGscOAuthConfig({
        clientId,
        clientSecret,
        clearConfig,
        updatedBy: adminUser.email,
      });
      return {
        ok: true,
        message: clearConfig
          ? "Cleared Google Search Console OAuth database credentials."
          : "Google Search Console OAuth Client credentials saved for merchant connections.",
      };
    }

    if (intent === "savePageSpeedKey") {
      const psKey = String(formData.get("pageSpeedApiKey") || "").trim();
      const clearConfig = formData.get("clearPageSpeedKey") === "on";
      await updatePlatformPageSpeedConfig({
        apiKey: psKey,
        clearConfig,
        updatedBy: adminUser.email,
      });
      return {
        ok: true,
        message: clearConfig
          ? "Cleared Google PageSpeed Insights API key from database."
          : "Saved Google PageSpeed Insights API key for live merchant speed tests.",
      };
    }

    const customModel = String(formData.get("customModel") || "").trim();
    const modelSelect = String(formData.get("model") || "").trim();
    const resolvedSelect = modelSelect === "custom" ? "" : modelSelect;
    const submittedModel = customModel || resolvedSelect;
    const apiKey = String(formData.get("apiKey") || "").trim();

    if (intent === "test") {
      const effective = await getEffectivePlatformAiSettings();
      const keyToTest = apiKey || effective.apiKey;
      const modelToTest = submittedModel || effective.model;
      const testResult = await testGeminiConnection({
        apiKey: keyToTest,
        model: modelToTest,
      });
      return {
        ok: true,
        testResult,
        message: `Connected to ${testResult.model} in ${testResult.latencyMs}ms.`,
      };
    }

    const provider = String(formData.get("provider") || "gemini");
    const model = submittedModel || DEFAULT_GEMINI_MODEL;
    const clearApiKey = formData.get("clearApiKey") === "on";
    const temperature = Number(formData.get("temperature") ?? 0.4);
    const isEnabled = formData.get("isEnabled") === "on";

    if (apiKey && provider === "gemini" && !looksLikeGeminiApiKey(apiKey)) {
      return {
        ok: false,
        error: "Invalid Gemini API key format. Expected a Google AI Studio key ('AIza...') or Vertex Express key ('AQ....').",
      };
    }

    await updatePlatformAiConfig({
      provider,
      model,
      apiKey,
      clearApiKey,
      temperature,
      isEnabled,
      updatedBy: adminUser.email,
    });

    return {
      ok: true,
      message: "Global AI credentials updated. All stores on the platform now share this configuration.",
    };
  } catch (error) {
    return {
      ok: false,
      error: error?.message || "Unable to update AI credentials.",
    };
  }
};

export default function SuperAdminAiPage() {
  const { aiConfig, gscOAuth, pageSpeedConfig, recentLogs, totalCalls, totalCreditsUsed } = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const submittingIntent = navigation.formData?.get("intent");

  const isPreset = PRESET_GEMINI_MODEL_IDS.includes(aiConfig.model);
  const [selectedModel, setSelectedModel] = useState(isPreset ? aiConfig.model : "custom");

  const modelGroups = Array.from(new Set(GEMINI_MODEL_CATALOG.map((m) => m.group)));

  return (
    <div className="sa-grid">
      {actionData?.error ? <div className="sa-alert error">{actionData.error}</div> : null}
      {actionData?.ok && actionData?.message ? <div className="sa-alert success">{actionData.message}</div> : null}

      {/* ─── Status KPIs ─── */}
      <div className="sa-grid-3">
        <div className="sa-kpi">
          <p className="sa-kpi-label">Global AI Engine</p>
          <p className="sa-kpi-value" style={{ fontSize: 20, marginTop: 8 }}>
            {!aiConfig.isEnabled ? (
              <span className="sa-pill bad">Paused Globally</span>
            ) : aiConfig.hasEffectiveKey ? (
              <span className="sa-pill good">Active &amp; Shared</span>
            ) : (
              <span className="sa-pill warn">Key Missing</span>
            )}
          </p>
          <small style={{ color: "var(--sa-muted)" }}>
            Model: <code>{aiConfig.model}</code>
          </small>
        </div>

        <div className="sa-kpi">
          <p className="sa-kpi-label">Credential Source</p>
          <p className="sa-kpi-value" style={{ fontSize: 18, marginTop: 8 }}>
            {aiConfig.hasDbKey
              ? `SuperAdmin DB (${aiConfig.dbKeyMask})`
              : aiConfig.usingEnvFallback
                ? "Environment (.env GEMINI_API_KEY)"
                : "Not configured"}
          </p>
          <small style={{ color: "var(--sa-muted)" }}>
            Merchants have zero access to these credentials.
          </small>
        </div>

        <div className="sa-kpi">
          <p className="sa-kpi-label">Platform-Wide AI Usage</p>
          <p className="sa-kpi-value">{totalCalls} calls</p>
          <small style={{ color: "var(--sa-muted)" }}>
            {totalCreditsUsed} net credits processed across all stores
          </small>
        </div>
      </div>

      {/* ─── Global AI Credentials Form ─── */}
      <div className="sa-card sa-grid">
        <div>
          <h3 style={{ margin: 0 }}>Shared Gemini AI Credentials</h3>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--sa-muted)" }}>
            Every Shopify store using Ecom SEO routes its AI requests through this single global configuration. Supports both Google AI Studio (<code>AIza...</code>) and Vertex AI Express Mode (<code>AQ....</code>) keys.
          </p>
        </div>

        <Form method="post" className="sa-grid">

          <label className="sa-checkbox-card" style={{ background: "#f8fafc" }}>
            <input type="checkbox" name="isEnabled" defaultChecked={aiConfig.isEnabled} />
            <span>
              <strong>Enable Platform AI Globally</strong> — Unchecking pauses all AI actions across every store immediately
            </span>
          </label>

          <div className="sa-grid-3">
            <div className="sa-field">
              <label>AI Provider</label>
              <select name="provider" className="sa-select" defaultValue={aiConfig.provider}>
                <option value="gemini">Google Gemini API</option>
              </select>
            </div>

            <div className="sa-field">
              <label>Gemini Model</label>
              <select
                name="model"
                className="sa-select"
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
              >
                {modelGroups.map((group) => (
                  <optgroup key={group} label={group}>
                    {GEMINI_MODEL_CATALOG.filter((m) => m.group === group).map((modelOption) => (
                      <option key={modelOption.id} value={modelOption.id}>
                        {modelOption.id} — {modelOption.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
                <option value="custom">Custom Model ID...</option>
              </select>
            </div>

            <div className="sa-field">
              <label>Temperature (0.0 – 1.0)</label>
              <input
                name="temperature"
                type="number"
                step="0.1"
                min="0"
                max="1"
                defaultValue={aiConfig.temperature}
                className="sa-input"
              />
            </div>
          </div>

          {selectedModel === "custom" ? (
            <div className="sa-field">
              <label>Custom Gemini Model ID</label>
              <input
                name="customModel"
                type="text"
                defaultValue={isPreset ? "" : aiConfig.model}
                placeholder="e.g. gemini-3.8-live or gemini-3-flash-preview"
                className="sa-input"
              />
            </div>
          ) : null}

          <div className="sa-field">
            <label>Global Gemini API Key</label>
            <input
              name="apiKey"
              type="password"
              autoComplete="new-password"
              placeholder={
                aiConfig.hasDbKey
                  ? `Stored as ${aiConfig.dbKeyMask}. Leave blank to keep current key.`
                  : "Enter AIza... or AQ.... Gemini API key"
              }
              className="sa-input"
            />
          </div>

          <label className="sa-checkbox-card">
            <input type="checkbox" name="clearApiKey" />
            <span>Clear stored database API key (falls back to `.env` `GEMINI_API_KEY` if configured)</span>
          </label>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
            <small style={{ color: "var(--sa-muted)" }}>
              {aiConfig.updatedBy
                ? `Last updated by ${aiConfig.updatedBy} on ${new Date(aiConfig.updatedAt).toLocaleString()}`
                : "Not modified via SuperAdmin yet."}
            </small>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button type="submit" name="intent" value="test" className="sa-btn secondary" disabled={isSubmitting}>
                {isSubmitting && submittingIntent === "test" ? "Testing..." : "🧪 Test Connection"}
              </button>
              <button type="submit" name="intent" value="save" className="sa-btn" disabled={isSubmitting}>
                {isSubmitting && submittingIntent === "save" ? "Saving..." : "Save Global AI Credentials"}
              </button>
            </div>
          </div>
        </Form>
      </div>

      {/* ─── Google Search Console OAuth Setup ─── */}
      <div className="sa-card sa-grid">
        <div>
          <h3 style={{ margin: "0 0 4px 0" }}>Google Search Console OAuth App Credentials (Optional)</h3>
          <p style={{ margin: 0, color: "var(--sa-muted)", fontSize: 13 }}>
            Enables 1-click Google Search Console connection for merchants. Redirect URI:{" "}
            <code>/api/gsc/callback</code>. Merchants can also upload Search Console CSV exports without OAuth.
          </p>
        </div>

        <Form method="post" className="sa-grid" style={{ gap: 14 }}>
          <div className="sa-form-row">
            <div>
              <label className="sa-label" htmlFor="gscClientId">
                Google OAuth Client ID
              </label>
              <input
                id="gscClientId"
                name="gscClientId"
                defaultValue={gscOAuth.clientId || ""}
                placeholder="1234567890-xxx.apps.googleusercontent.com"
                className="sa-input"
              />
            </div>
            <div>
              <label className="sa-label" htmlFor="gscClientSecret">
                Google OAuth Client Secret
              </label>
              <input
                id="gscClientSecret"
                name="gscClientSecret"
                type="password"
                placeholder={
                  gscOAuth.hasSecret
                    ? `Stored (${gscOAuth.maskedSecret || "configured"}). Leave blank to keep.`
                    : "GOCSPX-..."
                }
                className="sa-input"
              />
            </div>
          </div>

          <label className="sa-checkbox-card">
            <input type="checkbox" name="clearGscConfig" />
            <span>Clear stored database GSC OAuth config (fall back to `.env` if set)</span>
          </label>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
            <small style={{ color: "var(--sa-muted)" }}>
              Status:{" "}
              {gscOAuth.clientId && gscOAuth.hasSecret
                ? gscOAuth.usingEnvFallback
                  ? "Using .env GOOGLE_GSC_CLIENT_ID/SECRET"
                  : "Active via SuperAdmin DB"
                : "Not configured (CSV import still active)"}
            </small>
            <button type="submit" name="intent" value="saveGscOAuth" className="sa-btn secondary" disabled={isSubmitting}>
              {isSubmitting && submittingIntent === "saveGscOAuth" ? "Saving..." : "Save GSC OAuth Settings"}
            </button>
          </div>
        </Form>
      </div>

      {/* ─── Google PageSpeed Insights API Key Setup ─── */}
      <div className="sa-card sa-grid">
        <div>
          <h3 style={{ margin: "0 0 4px 0" }}>Google PageSpeed Insights API Key (Optional)</h3>
          <p style={{ margin: 0, color: "var(--sa-muted)", fontSize: 13 }}>
            PageSpeed Insights works without a key at public quota, or set a Google Cloud PageSpeed Insights API key
            here (or <code>GOOGLE_PAGESPEED_API_KEY</code> in <code>.env</code>) for higher shared rate limits.
          </p>
        </div>

        <Form method="post" className="sa-grid" style={{ gap: 14 }}>
          <div>
            <label className="sa-label" htmlFor="pageSpeedApiKey">
              Google PageSpeed Insights API Key
            </label>
            <input
              id="pageSpeedApiKey"
              name="pageSpeedApiKey"
              type="password"
              placeholder={
                pageSpeedConfig?.hasDbKey
                  ? `Stored (${pageSpeedConfig.maskedKey}). Leave blank to keep.`
                  : "AIza..."
              }
              className="sa-input"
            />
          </div>

          <label className="sa-checkbox-card">
            <input type="checkbox" name="clearPageSpeedKey" />
            <span>Clear stored database PageSpeed key (fall back to `.env` or public PSI quota)</span>
          </label>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
            <small style={{ color: "var(--sa-muted)" }}>
              Status:{" "}
              {pageSpeedConfig?.hasDbKey
                ? `Active via SuperAdmin DB (${pageSpeedConfig.maskedKey})`
                : pageSpeedConfig?.usingEnvFallback
                  ? "Using .env GOOGLE_PAGESPEED_API_KEY"
                  : "Using Google public PageSpeed quota (key optional)"}
            </small>
            <button type="submit" name="intent" value="savePageSpeedKey" className="sa-btn secondary" disabled={isSubmitting}>
              {isSubmitting && submittingIntent === "savePageSpeedKey" ? "Saving..." : "Save PageSpeed API Key"}
            </button>
          </div>
        </Form>
      </div>

      {/* ─── Recent Platform AI Calls ─── */}
      <div className="sa-card sa-grid">
        <h3 style={{ margin: 0 }}>Recent Global AI Usage (All Stores)</h3>
        {!recentLogs.length ? (
          <p style={{ margin: 0, color: "var(--sa-muted)", fontSize: 13.5 }}>No AI usage logged yet.</p>
        ) : (
          <div className="sa-table-wrap">
            <table className="sa-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Store</th>
                  <th>Action</th>
                  <th>Product / Context</th>
                  <th>Credits</th>
                  <th>Model</th>
                </tr>
              </thead>
              <tbody>
                {recentLogs.map((log) => (
                  <tr key={log.id}>
                    <td>{new Date(log.createdAt).toLocaleString()}</td>
                    <td><strong>{log.shop}</strong></td>
                    <td><span className="sa-pill info">{log.actionType}</span></td>
                    <td>{log.productTitle || log.productId || "-"}</td>
                    <td>
                      <strong
                        style={{
                          color:
                            log.creditsDeducted < 0
                              ? "var(--sa-good)"
                              : log.creditsDeducted === 0
                                ? "var(--sa-muted)"
                                : "var(--sa-ink)",
                        }}
                      >
                        {log.creditsDeducted < 0
                          ? `+${Math.abs(log.creditsDeducted)}`
                          : log.creditsDeducted === 0
                            ? "0 (Super)"
                            : `-${log.creditsDeducted}`}
                      </strong>
                    </td>
                    <td><code>{log.modelUsed}</code></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

