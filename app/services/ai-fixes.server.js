import { normalizeHandle } from "../validators/seoValidators";

function trim(text, max = 160) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return clean.slice(0, max - 1).trimEnd() + "…";
}

export function aiMetaFix({ title, focusKeyword, currentMetaTitle, currentMetaDescription }) {
  const keyword = String(focusKeyword || "").trim();
  const safeTitle = trim(title || "Product", 40);
  const nextMetaTitle = trim(
    keyword ? `${safeTitle} | ${keyword} | Buy Online` : `${safeTitle} | Buy Online`,
    60,
  );
  const nextMetaDescription = trim(
    keyword
      ? `${safeTitle} featuring ${keyword}. Fast delivery, trusted quality, and clear pricing.`
      : `${safeTitle} with fast delivery, trusted quality, and clear pricing for confident buying.`,
    155,
  );

  return {
    metaTitle: nextMetaTitle,
    metaDescription: nextMetaDescription,
    rationale: "Optimized length and keyword placement for stronger SERP readability.",
  };
}

export function aiProductSeoFix({ title, focusKeyword, handle, metaTitle, metaDescription }) {
  const suggestion = aiMetaFix({
    title,
    focusKeyword,
    currentMetaTitle: metaTitle,
    currentMetaDescription: metaDescription,
  });

  return {
    title: trim(title, 70),
    focusKeyword: trim(focusKeyword || title.split(" ").slice(0, 3).join(" "), 40),
    handle: normalizeHandle(handle || title),
    metaTitle: suggestion.metaTitle,
    metaDescription: suggestion.metaDescription,
    rationale: "Normalized core SEO fields and aligned metadata with target keyword intent.",
  };
}

export function aiHandleSuggestion({ title, currentHandle, focusKeyword }) {
  const base = `${focusKeyword || ""} ${title || ""}`.trim() || currentHandle || "product";
  return {
    handle: normalizeHandle(base),
    rationale: "Generated a lowercase, hyphenated handle from product intent keywords.",
  };
}

export function aiRobotsImprovement({ currentRules }) {
  const lines = String(currentRules || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const ensured = new Set(lines);
  ensured.add("User-agent: *");
  ensured.add("Disallow: /cart");
  ensured.add("Disallow: /search");
  ensured.add("Allow: /");

  return {
    robotsTxt: Array.from(ensured).join("\n"),
    rationale: "Added required disallow rules while preserving broad crawl access for public pages.",
  };
}
