import {
  normalizeHandle,
  sanitizeProductDescriptionHtml,
  stripHtmlTags,
  validateFocusKeyword,
  validateMetaDescription,
  validateMetaTitle,
  validateProductDescription,
  validateProductTitle,
  validateUrlHandle,
} from "../validators/seoValidators.js";
import { DEFAULT_GEMINI_MODEL } from "../utils/gemini-models.js";

export const DEFAULT_AI_SETTINGS = Object.freeze({
  provider: "gemini",
  model: DEFAULT_GEMINI_MODEL,
  apiKey: "",
});

export function isVertexExpressKey(value) {
  const clean = cleanText(value);
  return /^AQ\.[0-9A-Za-z._-]{20,}$/.test(clean);
}

export function looksLikeGeminiApiKey(value) {
  const clean = cleanText(value);
  return /^AIza[0-9A-Za-z_-]{20,}$/.test(clean) || isVertexExpressKey(clean);
}

export function maskApiKey(value) {
  const clean = cleanText(value);
  if (!clean) return "";
  if (clean.length <= 8) return "*".repeat(clean.length);
  return `${clean.slice(0, 4)}...${clean.slice(-4)}`;
}

function getServerGeminiKey() {
  return typeof process !== "undefined" && process.env?.GEMINI_API_KEY
    ? cleanText(process.env.GEMINI_API_KEY)
    : "";
}

export function resolveEffectiveAiConfig(settings = {}) {
  const normalized = normalizeAiSettings(settings);
  const serverKey = getServerGeminiKey();
  return {
    ...normalized,
    apiKey: normalized.apiKey || serverKey,
    usingServerKey: !normalized.apiKey && Boolean(serverKey),
  };
}

export function getAiSettingsStatus(settings = {}) {
  const normalized = normalizeAiSettings(settings);
  const hasMerchantKey = Boolean(normalized.apiKey);
  const serverKey = getServerGeminiKey();
  const usingServerKey = !hasMerchantKey && Boolean(serverKey);
  const hasApiKey = hasMerchantKey || usingServerKey;

  return {
    hasApiKey,
    hasMerchantKey,
    usingServerKey,
    apiKeyMask: hasMerchantKey
      ? maskApiKey(normalized.apiKey)
      : usingServerKey
        ? "Platform Gemini Key (Managed)"
        : "",
    apiKeyLooksValid: hasMerchantKey
      ? (normalized.provider === "gemini" ? looksLikeGeminiApiKey(normalized.apiKey) : true)
      : usingServerKey,
  };
}

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function trimToMax(value, max) {
  const clean = cleanText(value);
  if (clean.length <= max) return clean;
  return clean.slice(0, max).trim();
}

function normalizeAiResponse(raw) {
  if (!raw || typeof raw !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [key, typeof value === "string" ? cleanText(value) : value]),
  );
}

function parseJsonObject(text) {
  const clean = String(text || "").trim();
  if (!clean) {
    throw new Error("AI provider returned an empty response.");
  }

  try {
    return JSON.parse(clean);
  } catch {
    const start = clean.indexOf("{");
    const end = clean.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(clean.slice(start, end + 1));
    }
    throw new Error("AI provider did not return valid JSON.");
  }
}

function buildMetaFallback({ title, focusKeyword }) {
  const safeTitle = trimToMax(title || "Product", 40);
  const safeKeyword = trimToMax(focusKeyword || title || "online product", 40);

  const metaTitle = trimToMax(`${safeTitle} | ${safeKeyword} | Buy Online`, 60);
  const metaDescription = trimToMax(
    `${safeTitle} with ${safeKeyword}. Fast delivery, trusted quality, clear pricing, and a simple buying experience for confident shopping today.`,
    155,
  );

  return {
    metaTitle,
    metaDescription,
  };
}

function buildProductTitleFallback({ title, focusKeyword }) {
  const cleanTitle = cleanText(title || "Product");
  const keyword = cleanText(focusKeyword || "");
  const candidates = [
    cleanTitle,
    keyword ? `${cleanTitle} - ${keyword}` : "",
    keyword ? `${cleanTitle} for ${keyword}` : "",
    `${cleanTitle} | Buy Online Today`,
  ].filter(Boolean);

  return candidates
    .map((candidate) => trimToMax(candidate, 70))
    .find((candidate) => validateProductTitle(candidate).valid) || trimToMax(`${cleanTitle} | Shop Online`, 70);
}

function buildFocusKeywordFallback({ title, focusKeyword }) {
  const cleanKeyword = cleanText(focusKeyword || "");
  if (validateFocusKeyword(cleanKeyword).valid) {
    return cleanKeyword;
  }

  const fromTitle = cleanText(title || "")
    .split(/\s+/)
    .slice(0, 4)
    .join(" ");

  if (validateFocusKeyword(fromTitle).valid) {
    return fromTitle;
  }

  return "online product";
}

function buildHandleFallback({ title, focusKeyword, handle }) {
  const candidates = [
    normalizeHandle(handle || ""),
    normalizeHandle(`${focusKeyword || ""} ${title || ""}`),
    normalizeHandle(title || ""),
    "online-product",
  ];

  return candidates.find((candidate) => validateUrlHandle(candidate).valid) || "online-product";
}

function buildProductFallback({ title, focusKeyword, handle }) {
  const nextTitle = buildProductTitleFallback({ title, focusKeyword });
  const nextKeyword = buildFocusKeywordFallback({ title: nextTitle, focusKeyword });
  const meta = buildMetaFallback({ title: nextTitle, focusKeyword: nextKeyword });

  return {
    title: nextTitle,
    focusKeyword: nextKeyword,
    handle: buildHandleFallback({ title: nextTitle, focusKeyword: nextKeyword, handle }),
    metaTitle: meta.metaTitle,
    metaDescription: meta.metaDescription,
  };
}

export function normalizeAiSettings(settings = {}) {
  const provider = String(settings.provider || DEFAULT_AI_SETTINGS.provider).trim().toLowerCase();
  const normalizedProvider = provider === "gemini" ? "gemini" : DEFAULT_AI_SETTINGS.provider;
  const model = cleanText(settings.model || DEFAULT_AI_SETTINGS.model) || DEFAULT_AI_SETTINGS.model;
  const apiKey = cleanText(settings.apiKey || "");

  return {
    provider: normalizedProvider,
    model,
    apiKey,
  };
}

function getAiErrorMessage(error) {
  const message = error?.message || "Unable to reach the AI provider.";
  return message;
}

async function postGenerateContent(url, body, apiKey) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify(body),
  });

  const rawText = await response.text();
  let parsedBody = null;
  try {
    parsedBody = rawText ? JSON.parse(rawText) : null;
  } catch {
    parsedBody = null;
  }

  return { response, parsedBody };
}

async function callGoogleGenerateContent({ model, apiKey, body }) {
  const encodedModel = encodeURIComponent(model);
  const encodedKey = encodeURIComponent(apiKey);
  const aiStudioUrl = `https://generativelanguage.googleapis.com/v1beta/models/${encodedModel}:generateContent?key=${encodedKey}`;
  const vertexV1Url = `https://aiplatform.googleapis.com/v1/publishers/google/models/${encodedModel}:generateContent?key=${encodedKey}`;
  const vertexV1Beta1Url = `https://aiplatform.googleapis.com/v1beta1/publishers/google/models/${encodedModel}:generateContent?key=${encodedKey}`;

  const endpoints = isVertexExpressKey(apiKey)
    ? [vertexV1Url, vertexV1Beta1Url, aiStudioUrl]
    : [aiStudioUrl, vertexV1Url, vertexV1Beta1Url];

  let lastError = null;

  for (const endpoint of endpoints) {
    const { response, parsedBody } = await postGenerateContent(endpoint, body, apiKey);
    if (response.ok) {
      const text = parsedBody?.candidates?.[0]?.content?.parts
        ?.map((part) => part.text || "")
        .join("")
        .trim();
      return parseJsonObject(text);
    }

    const message =
      parsedBody?.error?.message ||
      `AI provider request failed with status ${response.status}.`;
    lastError = new Error(message);

    // Only retry alternate Google endpoint on auth/key/routing errors
    if (![400, 401, 403, 404].includes(response.status)) {
      throw lastError;
    }
  }

  throw lastError || new Error("Unable to reach Gemini API.");
}

async function requestGeminiJson({ model, apiKey, prompt, temperature = 0.4 }) {
  return callGoogleGenerateContent({
    model,
    apiKey,
    body: {
      systemInstruction: {
        parts: [
          {
            text: "You write ecommerce SEO copy. Respond with JSON only. Never use markdown fences.",
          },
        ],
      },
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: typeof temperature === "number" ? temperature : 0.4,
        responseMimeType: "application/json",
      },
    },
  });
}

export async function testGeminiConnection({ apiKey, model = DEFAULT_AI_SETTINGS.model }) {
  const effective = resolveEffectiveAiConfig({ apiKey, model });
  if (!effective.apiKey) {
    throw new Error("No Gemini API key is saved or set in .env.");
  }
  const start = Date.now();
  const data = await requestGeminiJson({
    model: effective.model,
    apiKey: effective.apiKey,
    prompt: 'Return JSON: {"status":"ok","message":"Gemini connected"}',
    temperature: 0,
  });
  return {
    ok: true,
    model: effective.model,
    latencyMs: Date.now() - start,
    response: data,
  };
}

async function requestSeoFixFromProvider({ settings, prompt }) {
  const effectiveSettings = resolveEffectiveAiConfig(settings);
  if (!effectiveSettings.apiKey) {
    throw new Error("Platform Gemini AI credentials are not configured yet. Set them up in /superadmin.");
  }

  if (effectiveSettings.provider !== "gemini") {
    throw new Error(`Unsupported AI provider: ${effectiveSettings.provider}`);
  }

  try {
    return await requestGeminiJson({
      model: effectiveSettings.model,
      apiKey: effectiveSettings.apiKey,
      prompt,
      temperature: settings?.temperature,
    });
  } catch (error) {
    throw new Error(getAiErrorMessage(error));
  }
}

export function normalizeMetaSuggestion(input, fallbackSource) {
  const fallback = buildMetaFallback(fallbackSource);
  const normalized = normalizeAiResponse(input);

  const metaTitle = validateMetaTitle(normalized.metaTitle).valid && validateMetaTitle(normalized.metaTitle).ideal
    ? normalized.metaTitle
    : fallback.metaTitle;
  const metaDescription = validateMetaDescription(normalized.metaDescription).valid && validateMetaDescription(normalized.metaDescription).ideal
    ? normalized.metaDescription
    : fallback.metaDescription;

  return {
    metaTitle,
    metaDescription,
    rationale: normalized.rationale || "Generated with AI and normalized to ideal SEO length ranges.",
  };
}

export function normalizeProductSeoSuggestion(input, fallbackSource, options = {}) {
  const fallback = buildProductFallback(fallbackSource);
  const rawDesc = typeof input?.descriptionHtml === "string" ? sanitizeProductDescriptionHtml(input.descriptionHtml) : "";
  const normalized = normalizeAiResponse(input);
  const keepHandle =
    Boolean(options.preserveHandle) && validateUrlHandle(fallbackSource?.handle || "").valid;
  const resolvedHandle = keepHandle
    ? validateUrlHandle(fallbackSource.handle).normalized
    : validateUrlHandle(normalized.handle).valid
      ? validateUrlHandle(normalized.handle).normalized
      : fallback.handle;

  const result = {
    title: validateProductTitle(normalized.title).valid ? normalized.title : fallback.title,
    focusKeyword: validateFocusKeyword(normalized.focusKeyword).valid ? normalized.focusKeyword : fallback.focusKeyword,
    handle: resolvedHandle,
    metaTitle:
      validateMetaTitle(normalized.metaTitle).valid && validateMetaTitle(normalized.metaTitle).ideal
        ? normalized.metaTitle
        : fallback.metaTitle,
    metaDescription:
      validateMetaDescription(normalized.metaDescription).valid && validateMetaDescription(normalized.metaDescription).ideal
        ? normalized.metaDescription
        : fallback.metaDescription,
    rationale: normalized.rationale || "Generated with AI and normalized to ideal SEO ranges.",
  };

  if (rawDesc && stripHtmlTags(rawDesc).length >= 20) {
    result.descriptionHtml = rawDesc;
  }

  return result;
}

export async function generateProductSeoFix({
  settings,
  title,
  focusKeyword,
  handle,
  metaTitle,
  metaDescription,
  descriptionHtml = "",
  productType = "",
  tags = "",
  mode = "full",
  preserveHandle = false,
}) {
  const cleanMode = mode === "minor" ? "minor" : "full";
  const shouldKeepHandle = Boolean(preserveHandle) && validateUrlHandle(handle || "").valid;
  const currentBodyExcerpt = stripHtmlTags(descriptionHtml).slice(0, 700);

  const modeGuidance =
    cleanMode === "minor"
      ? `MODE: MINOR SEO POLISH (SURGICAL EDIT)
- Make minimal, high-leverage tweaks rather than rewriting from scratch.
- If title is already valid (25-70 chars) and natural, keep its core wording and make only minor clarity/keyword refinement.
- Focus primarily on fixing metaTitle (45-60), metaDescription (120-155), focusKeyword precision, and lightly polishing descriptionHtml grammar, readability, and natural keyword inclusion without removing existing specs.`
      : `MODE: FULL AI SEO + CONTENT OPTIMIZATION
- Optimize every SEO field for organic ranking and buyer conversion.
- Write rich, trustworthy Shopify product HTML in descriptionHtml (100-180 words): an engaging <p> intro mentioning the focus keyword once naturally, an <h3>Key Features &amp; Benefits</h3><ul><li>...</li></ul> block, and a concise closing <p>. Only reference details supported by the product info (do not fabricate unverified certifications or dimensions).`;

  const prompt = `
Create improved ecommerce SEO fields and product description HTML for a Shopify product.

${modeGuidance}

Return JSON with keys:
- title
- focusKeyword
- handle
- metaTitle
- metaDescription
- descriptionHtml
- rationale

Hard rules:
- title must be 25-70 characters
- focusKeyword must be 3-40 characters
- ${shouldKeepHandle ? `MUST keep handle exact: "${handle}"` : "handle must be lowercase, hyphenated, 3-45 characters"}
- metaTitle must be 45-60 characters
- metaDescription must be 120-155 characters
- descriptionHtml must be clean semantic Shopify HTML (<p>, <h3>, <ul>, <li>, <strong>) with zero scripts or styles
- keep language clear, specific, and purchase-oriented; avoid keyword stuffing

Current values:
${JSON.stringify(
  {
    title,
    focusKeyword,
    handle,
    metaTitle,
    metaDescription,
    productType,
    tags,
    currentDescriptionExcerpt: currentBodyExcerpt,
    currentDescriptionHtml: descriptionHtml ? String(descriptionHtml).slice(0, 1500) : "",
  },
  null,
  2,
)}
`.trim();

  const response = await requestSeoFixFromProvider({ settings, prompt });
  return normalizeProductSeoSuggestion(
    response,
    {
      title,
      focusKeyword,
      handle,
      metaTitle,
      metaDescription,
      descriptionHtml,
    },
    { preserveHandle: shouldKeepHandle },
  );
}

export async function generateProductContentFix({
  settings,
  title,
  focusKeyword = "",
  descriptionHtml = "",
  productType = "",
  tags = "",
  goal = "polish",
}) {
  const cleanGoal = ["polish", "structure", "expand"].includes(goal) ? goal : "polish";
  const currentExcerpt = stripHtmlTags(descriptionHtml).slice(0, 1200);

  const goalInstructions = {
    polish:
      "Perform a light minor SEO polish: fix grammar, awkward phrasing, spacing, and readability while keeping original specs and structure intact. Include the focus keyword naturally once if helpful.",
    structure:
      "Reformat the product copy into high-converting, scannable Shopify HTML: short opening <p>, clear <h3>Highlights</h3> with 3-5 <ul><li> bullets, and concise closing <p>. Preserve all factual specs.",
    expand:
      "Write a comprehensive, conversion-ready SEO product description (120-190 words) using semantic HTML (<p>, <h3>, <ul>, <li>, <strong>) tailored strictly to the product context, naturally placing the focus keyword early without fluff or made-up specs.",
  }[cleanGoal];

  const prompt = `
You are an expert ecommerce SEO copywriter optimizing a Shopify product description.

Task (${cleanGoal}): ${goalInstructions}

Rules:
- Return clean semantic HTML only inside "descriptionHtml" using <p>, <h2>, <h3>, <ul>, <li>, <strong>, <em> (no <script>, <style>, inline CSS, or markdown fences).
- Never invent fake materials, dimensions, warranties, or medical claims not supported by the product input.
- Return JSON only:
{
  "descriptionHtml": "<p>...</p>",
  "summary": "1 concise sentence describing what improved"
}

Product context:
${JSON.stringify(
  {
    title,
    focusKeyword,
    productType,
    tags,
    existingWordCount: validateProductDescription(descriptionHtml, focusKeyword).wordCount,
    existingText: currentExcerpt,
    existingHtml: String(descriptionHtml || "").slice(0, 2000),
  },
  null,
  2,
)}
`.trim();

  const response = await requestSeoFixFromProvider({ settings, prompt });
  const cleanedHtml = sanitizeProductDescriptionHtml(response?.descriptionHtml || descriptionHtml || "");
  if (!stripHtmlTags(cleanedHtml)) {
    throw new Error("AI did not return usable product description content.");
  }
  const check = validateProductDescription(cleanedHtml, focusKeyword);
  return {
    descriptionHtml: cleanedHtml,
    wordCount: check.wordCount,
    hasStructure: check.hasStructure,
    hasKeyword: check.hasKeyword,
    summary: cleanText(response?.summary || `Updated product description (${check.wordCount} words).`),
  };
}

export async function generateMetaFix({ settings, title, focusKeyword, currentMetaTitle, currentMetaDescription }) {
  const prompt = `
Create improved SEO metadata for a Shopify product.

Return JSON with keys:
- metaTitle
- metaDescription
- rationale

Hard rules:
- metaTitle must be 45-60 characters
- metaDescription must be 120-155 characters
- keep the copy readable and conversion-focused
- use the focus keyword naturally when provided

Current values:
${JSON.stringify({ title, focusKeyword, currentMetaTitle, currentMetaDescription }, null, 2)}
`.trim();

  const response = await requestSeoFixFromProvider({ settings, prompt });
  return normalizeMetaSuggestion(response, {
    title,
    focusKeyword,
  });
}

export async function auditProductSeoChange({
  settings,
  productTitle,
  currentValues = {},
  newValues = {},
}) {
  const handleChanged = Boolean(
    currentValues.handle &&
    newValues.handle &&
    currentValues.handle !== newValues.handle
  );

  const compactState = (state) => ({
    title: state.title || "",
    focusKeyword: state.focusKeyword || "",
    handle: state.handle || "",
    metaTitle: state.metaTitle || "",
    metaDescription: state.metaDescription || "",
    descriptionWordCount: validateProductDescription(state.descriptionHtml || "", state.focusKeyword || "").wordCount,
    descriptionExcerpt: stripHtmlTags(state.descriptionHtml || "").slice(0, 400),
  });

  const prompt = `
You are a senior ecommerce SEO analyst. Evaluate the following proposed SEO changes for a Shopify product: "${productTitle || "Product"}".

Original SEO State:
${JSON.stringify(compactState(currentValues), null, 2)}

Proposed New SEO State:
${JSON.stringify(compactState(newValues), null, 2)}

Handle changed: ${handleChanged ? "YES (301 redirect needed)" : "NO"}

Evaluate the impact and return JSON only:
{
  "intentShift": "A concise sentence explaining how search intent or keyword alignment shifted",
  "projectedCtrDelta": "+X% to +Y% (e.g. '+10% to +15%') or 'Neutral'",
  "riskRating": "LOW" | "MODERATE" | "HIGH",
  "redirectRecommended": ${handleChanged},
  "keyImprovements": ["Improvement point 1", "Improvement point 2"],
  "warnings": ["Warning if any, e.g. handle change or keyword deletion"],
  "verdict": "Clear recommendation whether to accept this change or what to refine"
}
`.trim();

  try {
    const response = await requestSeoFixFromProvider({ settings, prompt });
    return {
      intentShift: cleanText(response.intentShift || "Optimized keyword targeting and metadata length for higher SERP visibility."),
      projectedCtrDelta: cleanText(response.projectedCtrDelta || "+8% to +14%"),
      riskRating: ["LOW", "MODERATE", "HIGH"].includes(String(response.riskRating || "").toUpperCase())
        ? String(response.riskRating).toUpperCase()
        : handleChanged ? "MODERATE" : "LOW",
      redirectRecommended: Boolean(response.redirectRecommended || handleChanged),
      keyImprovements: Array.isArray(response.keyImprovements) && response.keyImprovements.length
        ? response.keyImprovements.map(cleanText)
        : ["Better alignment with high-converting search intent", "Metadata formatted to prevent Google truncation"],
      warnings: Array.isArray(response.warnings)
        ? response.warnings.map(cleanText).filter(Boolean)
        : handleChanged ? ["Handle change detected: Ensure 301 redirect is active to prevent 404 errors."] : [],
      verdict: cleanText(response.verdict || "Recommended change. Improves keyword relevance without exceeding SERP limits."),
    };
  } catch (error) {
    return {
      intentShift: "Enhanced search intent alignment with target keywords.",
      projectedCtrDelta: "+5% to +10%",
      riskRating: handleChanged ? "MODERATE" : "LOW",
      redirectRecommended: handleChanged,
      keyImprovements: [
        "Normalized title and metadata to ideal search engine lengths",
        handleChanged ? "Cleaned URL slug structure" : "Maintained canonical handle stability",
      ],
      warnings: handleChanged ? ["URL handle changed. A 301 redirect is recommended to preserve SEO authority."] : [],
      verdict: "Acceptable update. Review metadata preview before saving.",
      fallbackUsed: true,
      error: error?.message,
    };
  }
}

export async function generateVisionImageAlt({ settings, imageUrl, productTitle }) {
  const fallbackAlt = `${trimToMax(productTitle || "Product", 40)} - detailed product view`;
  const effective = resolveEffectiveAiConfig(settings);

  if (!effective.apiKey || !imageUrl) {
    return {
      altText: fallbackAlt,
      source: "heuristic",
      fallbackUsed: true,
    };
  }

  try {
    const imgResponse = await fetch(imageUrl);
    if (!imgResponse.ok) throw new Error("Could not fetch image from URL");
    const buffer = await imgResponse.arrayBuffer();
    const base64Data = Buffer.from(buffer).toString("base64");
    const mimeType = imgResponse.headers.get("content-type") || "image/jpeg";

    const prompt = `Write an optimized, descriptive Google Image SEO ALT tag for this product photo of "${productTitle}".
Rules:
- 40 to 120 characters
- Accurately describe visual details (color, cut, texture, style, perspective)
- No keyword stuffing, natural human phrasing
- Return JSON: {"altText": "...", "visualDetails": "..."}`;

    const parsed = await callGoogleGenerateContent({
      model: effective.model,
      apiKey: effective.apiKey,
      body: {
        contents: [
          {
            role: "user",
            parts: [
              {
                inlineData: {
                  mimeType,
                  data: base64Data,
                },
              },
              { text: prompt },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.3,
          responseMimeType: "application/json",
        },
      },
    });
    const altText = cleanText(parsed.altText || fallbackAlt);

    return {
      altText: trimToMax(altText, 125),
      visualDetails: parsed.visualDetails || "",
      source: "gemini_vision",
      fallbackUsed: false,
    };
  } catch (error) {
    return {
      altText: fallbackAlt,
      source: "fallback",
      fallbackUsed: true,
      error: error?.message,
    };
  }
}

export async function generateStoreCopilotBrief({ settings, storeDomain, scan, gscData = null }) {
  const summary = scan?.summary || {};
  const pillars = summary.pillars || {};
  const topIssues = (scan?.issues || []).slice(0, 15).map((issue) => ({
    severity: issue.severity,
    title: issue.title,
    targetUrl: issue.targetUrl,
    fixPath: issue.fixPath,
  }));

  const gscConnected = Boolean(gscData?.connected);
  const gscQuickWins = gscConnected
    ? (gscData.quickWins || []).slice(0, 10).map((qw) => ({
        query: qw.query,
        path: qw.path,
        productTitle: qw.productTitle || "",
        position: qw.position,
        impressions: qw.impressions,
        clicks: qw.clicks,
        ctrPercent: qw.ctr,
      }))
    : [];
  const gscSummaryBlock = gscConnected
    ? `
Google Search Console Live Performance:
- Total Clicks: ${gscData.summary?.totalClicks ?? 0} | Impressions: ${gscData.summary?.totalImpressions ?? 0} | Avg CTR: ${gscData.summary?.avgCtr ?? 0}% | Avg Position: ${gscData.summary?.avgPosition ?? 0}
- Quick-Win Keywords Currently Ranking Positions 8-20:
${JSON.stringify(gscQuickWins, null, 2)}
`
    : "\nGoogle Search Console: Not connected yet.\n";

  const prompt = `
You are an executive ecommerce SEO strategist analyzing the Shopify store "${storeDomain || "Store"}".

Current Audit Summary:
- Overall Score: ${summary.score ?? 0}/100 (${summary.health || "unknown"})
- Pages Scanned: ${scan?.pagesScanned ?? 0}
- Index Coverage: ${scan?.indexCoverage ?? 0}%
- Critical / Warning / Info: ${summary.counts?.critical ?? 0} / ${summary.counts?.warning ?? 0} / ${summary.counts?.info ?? 0}
- 5-Pillar Scores: ${JSON.stringify(pillars)}
${gscSummaryBlock}
Sample Top Findings:
${JSON.stringify(topIssues, null, 2)}

Return JSON only:
{
  "executiveSummary": "2-3 sentences summarizing store health, biggest bottleneck, and commercial opportunity (mention Search Console rankings/quick-wins if connected)",
  "scoreProjection": "Estimated score gain (e.g. '+12 to +18 pts after fixing top critical issues')",
  "topQuickWins": [
    {
      "title": "Actionable quick win title",
      "impact": "HIGH",
      "effort": "LOW",
      "action": "Specific step the merchant should take",
      "targetPath": "/app/products"
    }
  ],
  "gscQuickWinAdvice": [
    {
      "query": "exact quick-win query from positions 8-20 (empty array if GSC not connected)",
      "pagePath": "/products/...",
      "recommendation": "Specific meta title/CTR angle to push this query from page 2 to top 5"
    }
  ],
  "priorityFocus": "The single highest-ROI focus area right now",
  "riskAlert": "Any major SEO risk spotted (or 'No immediate structural risks')"
}
`.trim();

  const response = await requestSeoFixFromProvider({ settings, prompt });

  return {
    executiveSummary: cleanText(response.executiveSummary || "Store audit analyzed. Prioritize resolving critical metadata issues first."),
    scoreProjection: cleanText(response.scoreProjection || "+8 to +15 points"),
    topQuickWins: Array.isArray(response.topQuickWins)
      ? response.topQuickWins.slice(0, 4).map((item) => ({
          title: cleanText(item?.title || "Optimize high-priority products"),
          impact: cleanText(item?.impact || "HIGH"),
          effort: cleanText(item?.effort || "LOW"),
          action: cleanText(item?.action || "Update missing meta titles and focus keywords."),
          targetPath: cleanText(item?.targetPath || "/app/products"),
        }))
      : [],
    gscQuickWinAdvice: Array.isArray(response.gscQuickWinAdvice)
      ? response.gscQuickWinAdvice.slice(0, 5).map((item) => ({
          query: cleanText(item?.query || ""),
          pagePath: cleanText(item?.pagePath || ""),
          recommendation: cleanText(item?.recommendation || ""),
        })).filter((item) => Boolean(item.query || item.recommendation))
      : [],
    priorityFocus: cleanText(response.priorityFocus || "Product metadata & focus keyword coverage"),
    riskAlert: cleanText(response.riskAlert || "Monitor duplicate focus keywords to avoid cannibalization."),
  };
}

export async function resolveKeywordCannibalization({ settings, groups = [] }) {
  if (!groups.length) {
    return {
      resolutions: [],
      summary: "No keyword cannibalization conflicts detected in the current catalog.",
    };
  }

  const prompt = `
You are an ecommerce SEO architect fixing internal keyword cannibalization on a Shopify store.
Each group below contains products sharing the exact same focus keyword. Assign each product a unique, distinct, purchase-oriented focus keyword (3-40 chars) tailored to its specific title/attributes so they do not compete against each other in Google Search.

Conflicting Groups:
${JSON.stringify(groups.slice(0, 8), null, 2)}

Return JSON only:
{
  "summary": "1-2 sentences explaining the keyword differentiation strategy",
  "resolutions": [
    {
      "productId": "exact productId string from input",
      "productTitle": "product title",
      "currentKeyword": "shared keyword",
      "suggestedKeyword": "distinct 3-40 char focus keyword",
      "reasoning": "brief why this differentiates search intent"
    }
  ]
}
`.trim();

  const response = await requestSeoFixFromProvider({ settings, prompt });

  return {
    summary: cleanText(response.summary || "Differentiated focus keywords across competing products to eliminate internal SERP competition."),
    resolutions: Array.isArray(response.resolutions)
      ? response.resolutions.map((item) => ({
          productId: String(item.productId || ""),
          productTitle: cleanText(item.productTitle || ""),
          currentKeyword: cleanText(item.currentKeyword || ""),
          suggestedKeyword: trimToMax(item.suggestedKeyword || "", 40),
          reasoning: cleanText(item.reasoning || "Unique intent variation to target a distinct buyer query."),
        }))
      : [],
  };
}

export async function generateAiRobotsSuggestion({ settings, currentRules, storeDomain }) {
  const prompt = `
Optimize a Shopify store's robots.txt directives for "${storeDomain || "Shopify store"}".
Current rules:
${currentRules || "(empty)"}

Hard rules:
- Must include User-agent: *
- Must include Disallow: /cart and Disallow: /search
- Must preserve Allow: / and Sitemap guidance if helpful, without blocking /products or /collections
- Return JSON only:
{
  "robotsTxt": "clean newline-separated robots.txt content",
  "rationale": "short explanation of improvements"
}
`.trim();

  const response = await requestSeoFixFromProvider({ settings, prompt });
  return {
    robotsTxt: String(response.robotsTxt || currentRules || "").trim(),
    rationale: cleanText(response.rationale || "Updated robots.txt crawl directives with required Shopify disallow paths."),
  };
}

function summarizeReportForPrompt(report) {
  if (!report) return null;
  return {
    testedUrl: report.testedUrl,
    strategy: report.strategy,
    passwordProtected: Boolean(report.passwordProtected),
    scores: report.scores,
    lcpElement: report.lcpElement || "",
    totalBytesLabel: report.totalBytesLabel || "",
    metrics: {
      lcp: report.metrics?.lcp?.displayValue,
      inpOrTbt: report.metrics?.inp?.displayValue,
      cls: report.metrics?.cls?.displayValue,
      fcp: report.metrics?.fcp?.displayValue,
      ttfb: report.metrics?.ttfb?.displayValue,
    },
    topBottlenecks: (report.opportunities || []).slice(0, 7).map((op) => ({
      id: op.id,
      title: op.title,
      impact: op.displayValue,
      category: op.category,
      offendingResources: (op.items || []).slice(0, 3).map((it) => ({
        url: it.url || it.label,
        wastedMs: it.wastedMs,
        wastedBytes: it.wastedBytes,
      })),
    })),
    seoFailures: (report.seoFindings || []).slice(0, 6).map((item) => ({
      id: item.id,
      title: item.title,
      displayValue: item.displayValue,
    })),
  };
}

export async function generatePageSpeedAiFixPlan({
  settings,
  storeDomain,
  report,
  mobileReport = null,
  desktopReport = null,
  matchedProductTitle = "",
}) {
  const primary = report || mobileReport || desktopReport;
  if (!primary) {
    throw new Error("Run a live Google PageSpeed test before generating an AI fix plan.");
  }

  const promptPayload = {
    storeDomain: storeDomain || "Shopify store",
    matchedProductTitle: matchedProductTitle || null,
    mobile: summarizeReportForPrompt(mobileReport || (primary.strategy === "mobile" ? primary : null)),
    desktop: summarizeReportForPrompt(desktopReport || (primary.strategy === "desktop" ? primary : null)),
  };

  const prompt = `
You are a senior Shopify Core Web Vitals & technical SEO architect.
Analyze the live Google PageSpeed Insights telemetry below and generate a concrete, Shopify-specific remediation plan covering both speed (LCP, INP/TBT, CLS, TTFB) and SEO crawl/snippet health.

Live Telemetry:
${JSON.stringify(promptPayload, null, 2)}

Rules:
- Be specific to the real offending scripts/images/audits above — do not invent fake URLs or scores.
- Where a fix belongs to Shopify Liquid/theme code (e.g., layout/theme.liquid, sections/main-product.liquid, CSS aspect-ratio/font-display, deferring scripts), provide a short copy-pasteable Liquid/HTML snippet in "liquidSnippet" (or "" if not code-based).
- Valid "fixType" values: "IN_APP_SEO" (meta/ALT/robots solvable inside Ecom SEO app), "THEME_LIQUID", "APP_SCRIPTS", "IMAGES".
- Valid "targetRoute" values (only when solvable inside Ecom SEO): "/app/products", "/app/image-optimizer", "/app/bulk-meta", "/app/robots", "/app/sitemap", or "".

Return JSON only:
{
  "executiveSummary": "2-3 sentences diagnosing the #1 Core Web Vitals bottleneck and SEO opportunity.",
  "projectedPerformanceGain": "Realistic range e.g. '+12 to +22 Mobile Performance pts'",
  "projectedSeoImpact": "Concise SEO ranking/crawl outcome e.g. 'Improves LCP speed signal and resolves missing meta/ALT elements'",
  "priorityFixes": [
    {
      "title": "Actionable fix title",
      "impact": "HIGH",
      "metricTarget": "LCP",
      "fixType": "THEME_LIQUID",
      "targetRoute": "",
      "estimatedGain": "Est. 400-800ms LCP reduction",
      "actionSteps": "Clear step-by-step instruction for a Shopify merchant or developer.",
      "liquidSnippet": ""
    }
  ]
}
`.trim();

  const response = await requestSeoFixFromProvider({ settings, prompt });

  const ALLOWED_FIX_TYPES = new Set(["IN_APP_SEO", "THEME_LIQUID", "APP_SCRIPTS", "IMAGES"]);
  const ALLOWED_ROUTES = new Set([
    "/app/products",
    "/app/image-optimizer",
    "/app/bulk-meta",
    "/app/robots",
    "/app/sitemap",
  ]);

  return {
    testedUrl: primary.testedUrl,
    executiveSummary: cleanText(
      response.executiveSummary ||
        "Live PageSpeed telemetry analyzed. Prioritize reducing render-blocking assets, optimizing LCP hero images, and tightening mobile JavaScript execution.",
    ),
    projectedPerformanceGain: cleanText(response.projectedPerformanceGain || "+10 to +20 Performance pts"),
    projectedSeoImpact: cleanText(response.projectedSeoImpact || "Stronger Core Web Vitals & clean crawl/snippet signals"),
    priorityFixes: Array.isArray(response.priorityFixes)
      ? response.priorityFixes.slice(0, 6).map((item) => {
          const fixType = String(item?.fixType || "THEME_LIQUID").toUpperCase();
          const targetRoute = String(item?.targetRoute || "").trim();
          return {
            title: cleanText(item?.title || "Optimize Core Web Vitals bottleneck"),
            impact: String(item?.impact || "HIGH").toUpperCase() === "MEDIUM" ? "MEDIUM" : "HIGH",
            metricTarget: cleanText(item?.metricTarget || "LCP"),
            fixType: ALLOWED_FIX_TYPES.has(fixType) ? fixType : "THEME_LIQUID",
            targetRoute: ALLOWED_ROUTES.has(targetRoute) ? targetRoute : "",
            estimatedGain: cleanText(item?.estimatedGain || "Faster load time"),
            actionSteps: cleanText(item?.actionSteps || "Review flagged theme assets and scripts."),
            liquidSnippet: String(item?.liquidSnippet || "").trim().slice(0, 1500),
          };
        })
      : [],
  };
}
