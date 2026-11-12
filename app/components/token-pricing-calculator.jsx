import { useId, useMemo, useState } from "react";
import { Link } from "react-router";
import {
  TOKEN_PRICING_CATALOG,
  calculateTokenEstimateSummary,
} from "../utils/credits";

const CALCULATOR_PRESETS = [
  {
    id: "starter",
    label: "Quick Store Tune-Up",
    counts: {
      productSeoFixes: 5,
      productDescriptionFixes: 2,
      imageCompressions: 10,
      visionAltImages: 0,
      chatMessages: 5,
      aiRobotsFixes: 1,
      pagespeedAiPlans: 0,
      copilotBriefs: 0,
    },
  },
  {
    id: "growth",
    label: "25-Product Refresh",
    counts: {
      productSeoFixes: 25,
      productDescriptionFixes: 10,
      imageCompressions: 25,
      visionAltImages: 5,
      chatMessages: 10,
      aiRobotsFixes: 1,
      pagespeedAiPlans: 1,
      copilotBriefs: 1,
    },
  },
  {
    id: "scale",
    label: "100-Product Catalog",
    counts: {
      productSeoFixes: 100,
      productDescriptionFixes: 25,
      imageCompressions: 100,
      visionAltImages: 25,
      chatMessages: 20,
      aiRobotsFixes: 2,
      pagespeedAiPlans: 1,
      copilotBriefs: 1,
    },
  },
  {
    id: "reset",
    label: "Reset (0)",
    counts: {
      productSeoFixes: 0,
      productDescriptionFixes: 0,
      imageCompressions: 0,
      visionAltImages: 0,
      chatMessages: 0,
      aiRobotsFixes: 0,
      pagespeedAiPlans: 0,
      copilotBriefs: 0,
    },
  },
];

const PRICING_CATEGORIES = [
  "All",
  "Product SEO",
  "Images & Speed",
  "AI Chat & Audits",
  "Technical SEO",
  "Free Tools",
];

export function TokenPricingAndCalculator({
  id = "token-calculator",
  creditAccount = null,
  hasSuperAccess = false,
  onBillingPage = false,
  onSelectTopUp = null,
  locationSearch = "",
  title = "Token Calculator & Pricing List",
  subtitle = "Estimate token usage before running bulk catalog SEO fixes, description rewrites, or image compression.",
}) {
  const baseId = useId();
  const availableCredits = Number(creditAccount?.availableCredits ?? 0);
  const superAccess = Boolean(hasSuperAccess || creditAccount?.superAccess);

  const [counts, setCounts] = useState(CALCULATOR_PRESETS[0].counts);
  const [categoryFilter, setCategoryFilter] = useState("All");

  const summary = useMemo(
    () => calculateTokenEstimateSummary(counts, availableCredits, superAccess),
    [counts, availableCredits, superAccess],
  );

  const visiblePricing = useMemo(() => {
    if (categoryFilter === "All") return TOKEN_PRICING_CATALOG;
    return TOKEN_PRICING_CATALOG.filter((item) => item.category === categoryFilter);
  }, [categoryFilter]);

  function handleQtyChange(key, rawValue) {
    const parsed = rawValue === "" ? 0 : Math.max(0, Math.min(10000, Math.floor(Number(rawValue) || 0)));
    setCounts((prev) => ({
      ...prev,
      [key]: parsed,
    }));
  }

  const billingHref = `/app/billing${locationSearch || ""}`;

  return (
    <section id={id} className="section-card token-calc-section" aria-label={title}>
      <div className="token-calc-header">
        <div>
          <h2 className="section-title" style={{ marginBottom: 4 }}>
            {title}
          </h2>
          <p className="seo-subtitle" style={{ margin: 0 }}>
            {subtitle}
          </p>
        </div>
        <div className="token-calc-balance-badge">
          <span>Current Balance:</span>
          <strong>
            {superAccess ? "∞ Super Access" : `${availableCredits.toLocaleString()} tokens`}
          </strong>
        </div>
      </div>

      <div className="token-calc-grid">
        <div className="token-calc-card">
          <div className="token-calc-card-head">
            <div>
              <h3>Interactive Workload Calculator</h3>
              <p>Adjust quantities to preview total token cost before starting work.</p>
            </div>
            <div className="token-calc-presets" role="group" aria-label="Calculator Presets">
              {CALCULATOR_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className="token-preset-btn"
                  onClick={() => setCounts(preset.counts)}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <div className="token-calc-rows">
            {summary.items.map((item) => {
              const inputId = `${baseId}-${item.key}`;
              return (
                <div key={item.key} className="token-calc-row">
                  <div className="token-calc-row-label">
                    <label htmlFor={inputId}>{item.label}</label>
                    <span>
                      {item.rate} tok / {item.unit}
                    </span>
                  </div>
                  <div className="token-calc-row-input">
                    <input
                      id={inputId}
                      type="number"
                      min={0}
                      max={10000}
                      step={1}
                      value={counts[item.key] ?? 0}
                      onChange={(event) => handleQtyChange(item.key, event.target.value)}
                    />
                    <span className="token-calc-row-subtotal">
                      {item.subtotal.toLocaleString()} tok
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="token-calc-summary-box">
            <div className="token-calc-summary-main">
              <div>
                <span className="token-calc-summary-eyebrow">Estimated Tokens Needed</span>
                <div className="token-calc-summary-total">
                  <strong>{summary.billableTokens.toLocaleString()} tokens</strong>
                  {superAccess && summary.standardTokens > 0 ? (
                    <span className="token-calc-super-note">
                      Super Access active (standard rate: {summary.standardTokens.toLocaleString()} tok)
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="token-calc-summary-balance">
                <span>After Run:</span>
                <strong
                  className={
                    summary.coveredByBalance ? "token-status-ok" : "token-status-warn"
                  }
                >
                  {superAccess
                    ? "∞ Remaining"
                    : summary.coveredByBalance
                      ? `${(summary.availableCredits - summary.billableTokens).toLocaleString()} left`
                      : `Short by ${summary.shortfallTokens.toLocaleString()} tok`}
                </strong>
              </div>
            </div>

            {!summary.coveredByBalance && summary.recommendedPackage ? (
              <div className="token-calc-shortfall">
                <span>
                  Recommended top-up: <strong>{summary.recommendedPackage.label}</strong> ($
                  {summary.recommendedPackage.price}) covers this workload.
                </span>
                {onBillingPage && typeof onSelectTopUp === "function" ? (
                  <button
                    type="button"
                    className="seo-button"
                    onClick={() => onSelectTopUp(summary.recommendedPackage)}
                  >
                    Buy {summary.recommendedPackage.label} (${summary.recommendedPackage.price})
                  </button>
                ) : (
                  <Link className="seo-button" to={billingHref}>
                    Buy {summary.recommendedPackage.label} →
                  </Link>
                )}
              </div>
            ) : (
              <div className="token-calc-covered">
                Your current balance covers this planned batch. Exact tokens are only deducted as items succeed.
              </div>
            )}
          </div>
        </div>

        <div className="token-pricing-card">
          <div className="token-calc-card-head">
            <div>
              <h3>Action Token Pricing List</h3>
              <p>Exact per-action and per-item rates across AI Mode and store optimizers.</p>
            </div>
          </div>

          <div className="token-pricing-filters" role="group" aria-label="Pricing Category Filter">
            {PRICING_CATEGORIES.map((category) => (
              <button
                key={category}
                type="button"
                className={`token-filter-chip ${categoryFilter === category ? "active" : ""}`}
                onClick={() => setCategoryFilter(category)}
              >
                {category}
              </button>
            ))}
          </div>

          <div className="token-pricing-table-wrap">
            <table className="token-pricing-table">
              <thead>
                <tr>
                  <th scope="col">Action / Feature</th>
                  <th scope="col">Unit</th>
                  <th scope="col">Tokens</th>
                </tr>
              </thead>
              <tbody>
                {visiblePricing.map((row) => (
                  <tr key={row.key}>
                    <th scope="row">
                      <div className="token-pricing-name">{row.label}</div>
                      <div className="token-pricing-desc">{row.description}</div>
                    </th>
                    <td className="token-pricing-unit">{row.unit}</td>
                    <td className="token-pricing-cost">
                      <span className={`token-rate-badge ${row.cost === 0 ? "free" : ""}`}>
                        {row.cost === 0 ? "Free (0)" : `${row.cost} tok`}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}

