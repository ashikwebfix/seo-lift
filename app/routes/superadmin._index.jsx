import { useEffect, useMemo, useState } from "react";
import { Form, useActionData, useFetcher, useLoaderData, useNavigation } from "react-router";
import { requireSuperAdmin } from "../services/superadmin-auth.server";
import {
  ALL_FEATURE_KEYS,
  getOrCreateStoreControl,
  listAllManagedStores,
  PLATFORM_FEATURES,
  updateStoreControl,
  updateStoreTokens,
} from "../services/store-control.server";
import { getOrCreateCreditAccount } from "../services/credit-manager.server";
import { PLAN_ALLOWANCES } from "../utils/credits.js";

export const loader = async ({ request }) => {
  await requireSuperAdmin(request);
  const stores = await listAllManagedStores();
  return {
    stores,
    features: PLATFORM_FEATURES,
  };
};

export const action = async ({ request }) => {
  const adminUser = await requireSuperAdmin(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");
  const shop = String(formData.get("shop") || "").trim().toLowerCase();

  try {
    if (intent === "provisionStore") {
      if (!shop || !shop.includes(".")) {
        return { ok: false, error: "Enter a valid store domain (e.g. my-store.myshopify.com)." };
      }
      const accessLevel = String(formData.get("accessLevel") || "FULL");
      const superAccess = formData.get("superAccess") === "on";
      const shopifyAccessToken = String(formData.get("shopifyAccessToken") || "").trim();

      await getOrCreateStoreControl(shop);
      await updateStoreControl({
        shop,
        accessLevel,
        superAccess,
        allowedFeatures: ALL_FEATURE_KEYS,
        updatedBy: adminUser.email,
      });
      await getOrCreateCreditAccount(shop, superAccess ? "PRO" : "FREE");
      if (shopifyAccessToken) {
        await updateStoreTokens({ shop, shopifyAccessToken });
      }
      return { ok: true, message: `Store "${shop}" provisioned and configured.` };
    }

    if (!shop) {
      return { ok: false, error: "Shop domain is required." };
    }

    if (intent === "updateAccess") {
      const accessLevel = String(formData.get("accessLevel") || "FULL");
      const superAccess = formData.get("superAccess") === "on";
      const allowedFeatures = formData.getAll("allowedFeatures").map(String);
      const notes = String(formData.get("notes") || "");

      await updateStoreControl({
        shop,
        accessLevel,
        superAccess,
        allowedFeatures,
        notes,
        updatedBy: adminUser.email,
      });

      return {
        ok: true,
        shop,
        message: `Access updated for ${shop} (${accessLevel}${superAccess ? " + Super Access" : ""}).`,
      };
    }

    if (intent === "updateTokens") {
      const creditPlan = String(formData.get("creditPlan") || "FREE");
      const totalCredits = formData.get("totalCredits");
      const bonusCredits = formData.get("bonusCredits");
      const resetUsedCredits = formData.get("resetUsedCredits") === "on";
      const shopifyAccessToken = String(formData.get("shopifyAccessToken") || "");
      const shopifyScopes = String(formData.get("shopifyScopes") || "");

      const updatedAccount = await updateStoreTokens({
        shop,
        creditPlan,
        totalCredits,
        bonusCredits,
        resetUsedCredits,
        shopifyAccessToken,
        shopifyScopes,
      });

      return {
        ok: true,
        intent: "updateTokens",
        shop,
        updatedCredits: {
          plan: updatedAccount.plan,
          totalCredits: updatedAccount.totalCredits,
          bonusCredits: updatedAccount.bonusCredits,
          usedCredits: updatedAccount.usedCredits,
          availableCredits: updatedAccount.availableCredits,
          effectiveTotal: updatedAccount.effectiveTotal,
        },
        message: `Updated ${shop}: ${updatedAccount.plan} plan · ${updatedAccount.availableCredits}/${updatedAccount.effectiveTotal} credits available.`,
      };
    }

    return { ok: false, error: "Unsupported action intent." };
  } catch (error) {
    return {
      ok: false,
      error: error?.message || "Failed to update store configuration.",
    };
  }
};

export default function SuperAdminStoresPage() {
  const { stores, features } = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [expandedShop, setExpandedShop] = useState(stores[0]?.shop || "");
  const [showAddStore, setShowAddStore] = useState(false);

  const summary = useMemo(() => {
    return {
      total: stores.length,
      full: stores.filter((s) => s.control.accessLevel === "FULL").length,
      partial: stores.filter((s) => s.control.accessLevel === "PARTIAL").length,
      superAccess: stores.filter((s) => s.control.superAccess).length,
      totalAiCalls: stores.reduce((sum, s) => sum + (s.stats?.totalAiCalls || 0), 0),
    };
  }, [stores]);

  const filteredStores = useMemo(() => {
    const q = search.trim().toLowerCase();
    return stores.filter((store) => {
      if (q && !store.shop.toLowerCase().includes(q)) return false;
      if (filter === "SUPER") return store.control.superAccess;
      if (filter !== "ALL") return store.control.accessLevel === filter;
      return true;
    });
  }, [stores, search, filter]);

  return (
    <div className="sa-grid">
      {actionData?.error ? <div className="sa-alert error">{actionData.error}</div> : null}
      {actionData?.ok && actionData?.message ? <div className="sa-alert success">{actionData.message}</div> : null}

      {/* ─── KPI Overview ─── */}
      <div className="sa-grid-5">
        <div className="sa-kpi">
          <p className="sa-kpi-label">Total Stores</p>
          <p className="sa-kpi-value">{summary.total}</p>
        </div>
        <div className="sa-kpi">
          <p className="sa-kpi-label">Full Access</p>
          <p className="sa-kpi-value" style={{ color: "var(--sa-good)" }}>{summary.full}</p>
        </div>
        <div className="sa-kpi">
          <p className="sa-kpi-label">Partial Access</p>
          <p className="sa-kpi-value" style={{ color: "var(--sa-warn)" }}>{summary.partial}</p>
        </div>
        <div className="sa-kpi">
          <p className="sa-kpi-label">Super Access</p>
          <p className="sa-kpi-value" style={{ color: "var(--sa-super)" }}>{summary.superAccess}</p>
        </div>
        <div className="sa-kpi">
          <p className="sa-kpi-label">Total AI Requests</p>
          <p className="sa-kpi-value" style={{ color: "var(--sa-primary)" }}>{summary.totalAiCalls}</p>
        </div>
      </div>

      {/* ─── Toolbar & Add Store Form ─── */}
      <div className="sa-card sa-grid">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", flex: 1 }}>
            <input
              type="search"
              className="sa-input"
              placeholder="Search store domain (e.g. mystore.myshopify.com)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ maxWidth: 320 }}
            />
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {["ALL", "FULL", "PARTIAL", "SUSPENDED", "SUPER"].map((key) => (
                <button
                  key={key}
                  type="button"
                  className={`sa-btn ${filter === key ? "" : "secondary"}`}
                  style={{ padding: "6px 12px", fontSize: 12 }}
                  onClick={() => setFilter(key)}
                >
                  {key}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            className="sa-btn secondary"
            onClick={() => setShowAddStore((v) => !v)}
          >
            {showAddStore ? "Close" : "+ Provision Store"}
          </button>
        </div>

        {showAddStore ? (
          <Form
            method="post"
            action="/superadmin?index"
            style={{
              padding: 16,
              background: "#f8fafc",
              borderRadius: 10,
              border: "1px solid var(--sa-border-soft)",
              display: "grid",
              gap: 12,
            }}
          >
            <input type="hidden" name="intent" value="provisionStore" />
            <h4 style={{ margin: 0 }}>Pre-Provision / Add Store</h4>
            <div className="sa-grid-3">
              <div className="sa-field">
                <label>Store Domain</label>
                <input name="shop" required placeholder="store-name.myshopify.com" className="sa-input" />
              </div>
              <div className="sa-field">
                <label>Initial Access Level</label>
                <select name="accessLevel" className="sa-select" defaultValue="FULL">
                  <option value="FULL">Full Access</option>
                  <option value="PARTIAL">Partial Access</option>
                  <option value="SUSPENDED">Suspended</option>
                </select>
              </div>
              <div className="sa-field">
                <label>Optional Admin Token (shpat_...)</label>
                <input name="shopifyAccessToken" type="password" placeholder="shpat_..." className="sa-input" />
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                <input type="checkbox" name="superAccess" />
                <span>Grant Super Access (Pro override + Unlimited AI)</span>
              </label>
              <button type="submit" className="sa-btn" disabled={isSubmitting}>
                Save Store
              </button>
            </div>
          </Form>
        ) : null}
      </div>

      {/* ─── Stores Table ─── */}
      <div className="sa-card" style={{ padding: 0, overflow: "hidden" }}>
        {!filteredStores.length ? (
          <div style={{ padding: 32, textAlign: "center", color: "var(--sa-muted)" }}>
            No matching stores found. Stores appear automatically once installed or provisioned.
          </div>
        ) : (
          <div className="sa-table-wrap">
            <table className="sa-table">
              <thead>
                <tr>
                  <th>Store Domain</th>
                  <th>Shopify Token</th>
                  <th>Access Level</th>
                  <th>Super Access</th>
                  <th>AI Credits &amp; Plan</th>
                  <th>SEO Score</th>
                  <th>Manage</th>
                </tr>
              </thead>
              <tbody>
                {filteredStores.map((store) => {
                  const isExpanded = expandedShop === store.shop;
                  const levelTone =
                    store.control.accessLevel === "FULL"
                      ? "good"
                      : store.control.accessLevel === "PARTIAL"
                        ? "warn"
                        : "bad";

                  return (
                    <StoreRowBlock
                      key={store.shop}
                      store={store}
                      features={features}
                      levelTone={levelTone}
                      isExpanded={isExpanded}
                      onToggle={() => setExpandedShop(isExpanded ? "" : store.shop)}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StoreRowBlock({ store, features, levelTone, isExpanded, onToggle }) {
  const accessFetcher = useFetcher();
  const tokensFetcher = useFetcher();

  const [accessLevel, setAccessLevel] = useState(store.control.accessLevel);
  const [superAccess, setSuperAccess] = useState(Boolean(store.control.superAccess));
  const [notes, setNotes] = useState(store.control.notes || "");
  const [selectedFeatures, setSelectedFeatures] = useState(
    () => new Set(store.control.allowedFeatures || features.map((f) => f.key)),
  );

  const [creditPlan, setCreditPlan] = useState(store.credits.plan || "FREE");
  const [totalCredits, setTotalCredits] = useState(String(store.credits.totalCredits ?? PLAN_ALLOWANCES.FREE));
  const [bonusCredits, setBonusCredits] = useState(String(store.credits.bonusCredits ?? 0));
  const [resetUsedCredits, setResetUsedCredits] = useState(false);
  const [shopifyAccessToken, setShopifyAccessToken] = useState("");
  const [shopifyScopes, setShopifyScopes] = useState(store.sessionStatus.scopes || "");

  // Sync controlled inputs whenever loader refreshes store data
  useEffect(() => {
    setAccessLevel(store.control.accessLevel);
    setSuperAccess(Boolean(store.control.superAccess));
    setNotes(store.control.notes || "");
    setSelectedFeatures(new Set(store.control.allowedFeatures || features.map((f) => f.key)));
  }, [store.control, features]);

  useEffect(() => {
    setCreditPlan(store.credits.plan || "FREE");
    setTotalCredits(String(store.credits.totalCredits ?? PLAN_ALLOWANCES.FREE));
    setBonusCredits(String(store.credits.bonusCredits ?? 0));
    setShopifyScopes(store.sessionStatus.scopes || "");
  }, [store.credits, store.sessionStatus.scopes]);

  useEffect(() => {
    if (tokensFetcher.state === "idle" && tokensFetcher.data?.ok && tokensFetcher.data?.intent === "updateTokens") {
      setResetUsedCredits(false);
      setShopifyAccessToken("");
    }
  }, [tokensFetcher.state, tokensFetcher.data]);

  function handlePlanChange(nextPlan) {
    setCreditPlan(nextPlan);
    if (nextPlan === "PRO" && (totalCredits === String(PLAN_ALLOWANCES.FREE) || totalCredits === "")) {
      setTotalCredits(String(PLAN_ALLOWANCES.PRO));
    } else if (nextPlan === "FREE" && totalCredits === String(PLAN_ALLOWANCES.PRO)) {
      setTotalCredits(String(PLAN_ALLOWANCES.FREE));
    }
  }

  function toggleFeature(key) {
    setSelectedFeatures((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const isSavingAccess = accessFetcher.state !== "idle";
  const isSavingTokens = tokensFetcher.state !== "idle";

  return (
    <>
      <tr>
        <td>
          <strong>{store.shop}</strong>
          <div style={{ fontSize: 11.5, color: "var(--sa-muted)", marginTop: 2 }}>
            {store.stats.totalRevisions} revisions • {store.stats.totalAiCalls} AI calls
          </div>
        </td>
        <td>
          {store.sessionStatus.connected ? (
            <div>
              <span className="sa-pill good">Connected</span>
              <div style={{ fontSize: 11, color: "var(--sa-muted)", marginTop: 3 }}>
                <code>{store.sessionStatus.maskedToken}</code>
              </div>
            </div>
          ) : (
            <span className="sa-pill bad">No Token</span>
          )}
        </td>
        <td>
          <span className={`sa-pill ${levelTone}`}>{store.control.accessLevel}</span>
          {store.control.accessLevel === "PARTIAL" ? (
            <div style={{ fontSize: 11, color: "var(--sa-muted)", marginTop: 3 }}>
              {store.control.allowedFeatures.length}/{features.length} modules
            </div>
          ) : null}
        </td>
        <td>
          {store.control.superAccess ? (
            <span className="sa-pill super">★ Super Access</span>
          ) : (
            <span style={{ color: "var(--sa-muted)", fontSize: 12 }}>Standard</span>
          )}
        </td>
        <td>
          <strong>{store.credits.availableCredits}</strong>{" "}
          <span style={{ color: "var(--sa-muted)", fontSize: 12 }}>
            / {store.credits.effectiveTotal}
          </span>
          {store.credits.bonusCredits > 0 ? (
            <div style={{ fontSize: 11, color: "var(--sa-good)" }}>
              +{store.credits.bonusCredits} bonus
            </div>
          ) : null}
          <div style={{ marginTop: 3 }}>
            <span className={`sa-pill ${store.credits.plan === "PRO" ? "good" : "info"}`}>
              {store.credits.plan}
            </span>
          </div>
        </td>
        <td>
          {store.lastScan?.score !== null && store.lastScan?.score !== undefined ? (
            <div>
              <strong>{store.lastScan.score}/100</strong>
              <div style={{ fontSize: 11, color: "var(--sa-muted)" }}>
                {store.lastScan.pagesScanned} pages
              </div>
            </div>
          ) : (
            <span style={{ color: "var(--sa-muted)", fontSize: 12 }}>No scan</span>
          )}
        </td>
        <td>
          <button type="button" className="sa-btn secondary" style={{ padding: "6px 12px", fontSize: 12 }} onClick={onToggle}>
            {isExpanded ? "Close" : "Manage"}
          </button>
        </td>
      </tr>

      {isExpanded ? (
        <tr>
          <td colSpan={7} style={{ padding: 0 }}>
            <div className="sa-store-drawer">
              <div className="sa-grid-2">
                {/* ─── Panel 1: Access & Super Access Control ─── */}
                <accessFetcher.Form
                  method="post"
                  action="/superadmin?index"
                  className="sa-card sa-grid"
                  style={{ boxShadow: "none" }}
                >
                  <input type="hidden" name="intent" value="updateAccess" />
                  <input type="hidden" name="shop" value={store.shop} />

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h4 style={{ margin: 0 }}>Access &amp; Permissions</h4>
                    {store.control.updatedBy ? (
                      <small style={{ color: "var(--sa-muted)" }}>Updated by {store.control.updatedBy}</small>
                    ) : null}
                  </div>

                  {accessFetcher.data?.error ? (
                    <div className="sa-alert error">{accessFetcher.data.error}</div>
                  ) : null}
                  {accessFetcher.data?.ok && accessFetcher.data?.message ? (
                    <div className="sa-alert success">{accessFetcher.data.message}</div>
                  ) : null}

                  <div className="sa-field">
                    <label>Access Level</label>
                    <select
                      name="accessLevel"
                      className="sa-select"
                      value={accessLevel}
                      onChange={(e) => setAccessLevel(e.target.value)}
                    >
                      <option value="FULL">Full Access (All Modules Enabled)</option>
                      <option value="PARTIAL">Partial Access (Selected Modules Only)</option>
                      <option value="SUSPENDED">Suspended (Lock App Access)</option>
                    </select>
                  </div>

                  <label className="sa-checkbox-card" style={{ borderColor: "#ddd6fe", background: "#faf5ff" }}>
                    <input
                      type="checkbox"
                      name="superAccess"
                      checked={superAccess}
                      onChange={(e) => setSuperAccess(e.target.checked)}
                    />
                    <span>
                      <strong style={{ color: "var(--sa-super)" }}>Allow Super Access</strong> — Bypass billing paywall, unlock Pro features &amp; unlimited AI
                    </span>
                  </label>

                  {accessLevel === "PARTIAL" ? (
                    <div className="sa-field">
                      <label>Allowed Modules (Partial Access)</label>
                      <div className="sa-feature-grid">
                        {features.map((feat) => (
                          <label key={feat.key} className="sa-checkbox-card">
                            <input
                              type="checkbox"
                              name="allowedFeatures"
                              value={feat.key}
                              checked={selectedFeatures.has(feat.key)}
                              onChange={() => toggleFeature(feat.key)}
                            />
                            <span>{feat.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ) : (
                    Array.from(selectedFeatures).map((k) => (
                      <input key={k} type="hidden" name="allowedFeatures" value={k} />
                    ))
                  )}

                  <div className="sa-field">
                    <label>Admin Notes (Internal Only)</label>
                    <textarea
                      name="notes"
                      rows={2}
                      className="sa-textarea"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Notes about this merchant's plan or permissions..."
                    />
                  </div>

                  <button type="submit" className="sa-btn" disabled={isSavingAccess}>
                    {isSavingAccess ? "Saving Access..." : "Save Access Settings"}
                  </button>
                </accessFetcher.Form>

                {/* ─── Panel 2: Token & Credit Quota Updater ─── */}
                <tokensFetcher.Form
                  method="post"
                  action="/superadmin?index"
                  className="sa-card sa-grid"
                  style={{ boxShadow: "none" }}
                >
                  <input type="hidden" name="intent" value="updateTokens" />
                  <input type="hidden" name="shop" value={store.shop} />

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <h4 style={{ margin: 0 }}>Update Tokens &amp; Quotas</h4>
                    <small style={{ color: "var(--sa-muted)" }}>
                      Available: <strong>{store.credits.availableCredits}</strong> / {store.credits.effectiveTotal}
                    </small>
                  </div>

                  {tokensFetcher.data?.error ? (
                    <div className="sa-alert error">{tokensFetcher.data.error}</div>
                  ) : null}
                  {tokensFetcher.data?.ok && tokensFetcher.data?.message ? (
                    <div className="sa-alert success">{tokensFetcher.data.message}</div>
                  ) : null}

                  <div className="sa-grid-3">
                    <div className="sa-field">
                      <label>Credit Plan</label>
                      <select
                        name="creditPlan"
                        className="sa-select"
                        value={creditPlan}
                        onChange={(e) => handlePlanChange(e.target.value)}
                      >
                        <option value="FREE">FREE</option>
                        <option value="PRO">PRO</option>
                      </select>
                    </div>
                    <div className="sa-field">
                      <label>Monthly Quota</label>
                      <input
                        name="totalCredits"
                        type="number"
                        min={0}
                        className="sa-input"
                        value={totalCredits}
                        onChange={(e) => setTotalCredits(e.target.value)}
                      />
                    </div>
                    <div className="sa-field">
                      <label>Bonus Credits</label>
                      <input
                        name="bonusCredits"
                        type="number"
                        min={0}
                        className="sa-input"
                        value={bonusCredits}
                        onChange={(e) => setBonusCredits(e.target.value)}
                      />
                    </div>
                  </div>

                  <label className="sa-checkbox-card">
                    <input
                      type="checkbox"
                      name="resetUsedCredits"
                      checked={resetUsedCredits}
                      onChange={(e) => setResetUsedCredits(e.target.checked)}
                    />
                    <span>
                      Reset cycle used credits to 0 (currently used: <strong>{store.credits.usedCredits}</strong>)
                    </span>
                  </label>

                  <hr style={{ border: 0, borderTop: "1px solid var(--sa-border-soft)", margin: "2px 0" }} />

                  <div className="sa-field">
                    <label>
                      Rotate / Update Shopify Offline Access Token{" "}
                      {store.sessionStatus.maskedToken ? `(${store.sessionStatus.maskedToken})` : ""}
                    </label>
                    <input
                      name="shopifyAccessToken"
                      type="password"
                      autoComplete="new-password"
                      value={shopifyAccessToken}
                      onChange={(e) => setShopifyAccessToken(e.target.value)}
                      placeholder="Leave blank to keep existing token, or paste shpat_..."
                      className="sa-input"
                    />
                  </div>

                  <div className="sa-field">
                    <label>Shopify Scopes (Optional Override)</label>
                    <input
                      name="shopifyScopes"
                      type="text"
                      value={shopifyScopes}
                      onChange={(e) => setShopifyScopes(e.target.value)}
                      placeholder="write_products,write_metaobjects..."
                      className="sa-input"
                    />
                  </div>

                  <button type="submit" className="sa-btn" disabled={isSavingTokens}>
                    {isSavingTokens ? "Updating Tokens & Credits..." : "Update Tokens & Credits"}
                  </button>
                </tokensFetcher.Form>
              </div>
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}
