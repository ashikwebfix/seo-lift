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
import { CREDIT_COSTS, estimateChatActionTokens } from "../utils/credits.js";

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

export const AI_CHAT_ACTION_TYPES = Object.freeze([
  "RUN_FULL_SCAN",
  "AUTO_FIX_PRODUCTS",
  "FIX_PRODUCT_DESCRIPTION",
  "UPDATE_SPECIFIC_PRODUCT",
  "FIX_IMAGE_ALT",
  "COMPRESS_HEAVY_IMAGES",
  "FIX_ROBOTS_TXT",
  "REGENERATE_SITEMAP",
  "RUN_PAGESPEED_TEST",
  "TOGGLE_AUTOPILOT",
  "ROLLBACK_REVISION",
  "OPEN_ROUTE",
]);

const ALLOWED_CHAT_ROUTES = new Set([
  "/app",
  "/app/seo-audit",
  "/app/products",
  "/app/image-optimizer",
  "/app/bulk-meta",
  "/app/url-optimization",
  "/app/pagespeed",
  "/app/robots",
  "/app/sitemap",
  "/app/revisions",
  "/app/settings",
  "/app/billing",
]);

function clampInt(value, min, max, fallback) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(min, Math.min(max, Math.round(num)));
}

function sanitizeChatActionParams(type, rawParams = {}) {
  const params = rawParams && typeof rawParams === "object" ? rawParams : {};
  switch (type) {
    case "AUTO_FIX_PRODUCTS": {
      const productIds = Array.isArray(params.productIds)
        ? params.productIds.map((id) => cleanText(id, 120)).filter(Boolean).slice(0, 5)
        : [];
      return {
        maxProducts: clampInt(params.maxProducts, 1, 5, 3),
        productIds,
      };
    }
    case "FIX_PRODUCT_DESCRIPTION": {
      const productIds = Array.isArray(params.productIds)
        ? params.productIds.map((id) => cleanText(id, 120)).filter(Boolean).slice(0, 5)
        : [];
      const goal = ["expand", "polish", "structure"].includes(String(params.goal || ""))
        ? String(params.goal)
        : "expand";
      return {
        maxProducts: clampInt(params.maxProducts, 1, 5, productIds.length || 1),
        productIds,
        goal,
      };
    }
    case "UPDATE_SPECIFIC_PRODUCT": {
      const next = {
        productId: cleanText(params.productId || params.id || "", 120),
      };
      if (typeof params.title === "string" && params.title.trim()) {
        next.title = cleanText(params.title, 255);
      }
      if (typeof params.focusKeyword === "string" && params.focusKeyword.trim()) {
        next.focusKeyword = cleanText(params.focusKeyword, 80);
      }
      if (typeof params.metaTitle === "string" && params.metaTitle.trim()) {
        next.metaTitle = cleanText(params.metaTitle, 120);
      }
      if (typeof params.metaDescription === "string" && params.metaDescription.trim()) {
        next.metaDescription = cleanText(params.metaDescription, 220);
      }
      if (typeof params.handle === "string" && params.handle.trim()) {
        next.handle = cleanText(params.handle, 120).toLowerCase();
      }
      return next;
    }
    case "FIX_IMAGE_ALT": {
      const productIds = Array.isArray(params.productIds)
        ? params.productIds.map((id) => cleanText(id, 120)).filter(Boolean).slice(0, 10)
        : [];
      return {
        maxImages: clampInt(params.maxImages, 1, 20, 10),
        productIds,
        useAi: Boolean(params.useAi),
      };
    }
    case "COMPRESS_HEAVY_IMAGES": {
      const preset = ["balanced", "lossless", "high"].includes(String(params.preset || ""))
        ? String(params.preset)
        : "balanced";
      const productIds = Array.isArray(params.productIds)
        ? params.productIds.map((id) => cleanText(id, 120)).filter(Boolean).slice(0, 10)
        : [];
      return {
        preset,
        maxImages: clampInt(params.maxImages, 1, 15, 8),
        productIds,
      };
    }
    case "FIX_ROBOTS_TXT":
      return {
        useAi: Boolean(params.useAi),
        customRules:
          typeof params.customRules === "string" ? params.customRules.trim().slice(0, 4000) : "",
      };
    case "REGENERATE_SITEMAP":
      return {
        extraManualUrl: cleanText(params.extraManualUrl || "", 240),
      };
    case "RUN_PAGESPEED_TEST": {
      const strat = String(params.strategy || "").toLowerCase();
      return {
        strategy: strat === "desktop" ? "desktop" : strat === "both" ? "both" : "mobile",
        targetUrl: cleanText(params.targetUrl || "", 240),
      };
    }
    case "TOGGLE_AUTOPILOT":
      return {
        enabled: params.enabled !== false,
        optimizeMeta: params.optimizeMeta !== false,
        optimizeAlt: params.optimizeAlt !== false,
      };
    case "ROLLBACK_REVISION":
      return {
        revisionId: cleanText(params.revisionId || "", 120),
      };
    case "OPEN_ROUTE": {
      const route = cleanText(params.route || "/app/seo-audit", 80);
      return {
        route: ALLOWED_CHAT_ROUTES.has(route) ? route : "/app/seo-audit",
      };
    }
    default:
      return {};
  }
}

function defaultActionLabel(type, params = {}) {
  switch (type) {
    case "RUN_FULL_SCAN":
      return "Run Full SEO Audit Scan";
    case "AUTO_FIX_PRODUCTS":
      return params.productIds?.length === 1
        ? "AI Fix Product Meta & Title"
        : `AI Fix Top ${params.maxProducts || 3} Products`;
    case "FIX_PRODUCT_DESCRIPTION":
      return params.productIds?.length === 1
        ? "AI Fix Product Description"
        : `AI Fix ${params.maxProducts || 1} Description(s)`;
    case "UPDATE_SPECIFIC_PRODUCT":
      return "Save Custom Product SEO";
    case "FIX_IMAGE_ALT":
      return `Fix Missing Image ALT (${params.maxImages || 10})`;
    case "COMPRESS_HEAVY_IMAGES":
      return `Compress Images (${params.preset || "balanced"})`;
    case "FIX_ROBOTS_TXT":
      return params.customRules ? "Update Custom Robots.txt" : "Apply Best-Practice Robots.txt";
    case "REGENERATE_SITEMAP":
      return "Regenerate XML Sitemap";
    case "RUN_PAGESPEED_TEST":
      return `Run ${params.strategy === "desktop" ? "Desktop" : params.strategy === "both" ? "Mobile & Desktop" : "Mobile"} PageSpeed Test`;
    case "TOGGLE_AUTOPILOT":
      return params.enabled === false ? "Disable SEO Autopilot" : "Enable SEO Autopilot";
    case "ROLLBACK_REVISION":
      return "Rollback Last SEO Change";
    case "OPEN_ROUTE":
      return `Open ${params.route || "/app/seo-audit"}`;
    default:
      return "Run Action";
  }
}

function defaultActionCostLabel(type, params = {}) {
  if (type === "OPEN_ROUTE") return "Workspace";
  const estimate = estimateChatActionTokens({ type, params });
  if (estimate.estimatedTokens > 0) {
    return estimate.badgeLabel;
  }
  return "Free · Instant";
}

export function normalizeAiChatCopilotResponse(raw = {}) {
  const input = raw && typeof raw === "object" ? raw : {};
  const allowedSet = new Set(AI_CHAT_ACTION_TYPES);

  const rawActions = Array.isArray(input.suggestedActions) ? input.suggestedActions : [];
  const seenKeys = new Set();
  const suggestedActions = [];

  for (let i = 0; i < rawActions.length && suggestedActions.length < 4; i += 1) {
    const item = rawActions[i];
    const type = String(item?.type || "").trim().toUpperCase();
    if (!allowedSet.has(type)) continue;

    const params = sanitizeChatActionParams(type, item?.params);
    if (type === "UPDATE_SPECIFIC_PRODUCT" && !params.productId) continue;
    const dedupeKey = `${type}:${JSON.stringify(params)}`;
    if (seenKeys.has(dedupeKey)) continue;
    seenKeys.add(dedupeKey);

    const tone = ["primary", "secondary", "warning"].includes(String(item?.tone || ""))
      ? String(item.tone)
      : suggestedActions.length === 0
        ? "primary"
        : "secondary";

    suggestedActions.push({
      id: cleanText(item?.id || `act-${suggestedActions.length + 1}`, 40) || `act-${suggestedActions.length + 1}`,
      type,
      label: cleanText(item?.label || defaultActionLabel(type, params), 60) || defaultActionLabel(type, params),
      description: cleanText(item?.description || "", 180),
      tone,
      costLabel: defaultActionCostLabel(type, params),
      params,
    });
  }

  const rawAutoId = cleanText(input.autoRunActionId || "", 40);
  const autoAction = suggestedActions.find(
    (action) => action.id === rawAutoId && action.type !== "OPEN_ROUTE",
  );

  const quickReplies = Array.isArray(input.quickReplies)
    ? input.quickReplies
        .map((q) => cleanText(q, 80))
        .filter(Boolean)
        .slice(0, 4)
    : [];

  return {
    reply:
      String(input.reply || "").trim().slice(0, 3500) ||
      "I checked your current store telemetry. Select a recommended action below to fix issues directly.",
    suggestedActions,
    autoRunActionId: autoAction ? autoAction.id : "",
    quickReplies,
  };
}

function buildAiChatFallbackResponse({
  userMessage = "",
  storeSnapshot = {},
  selectedProduct = null,
  reason = "",
}) {
  const lower = String(userMessage || "").toLowerCase();
  const scan = storeSnapshot?.scan || {};
  const health = Number.isFinite(Number(scan.healthScore)) ? Number(scan.healthScore) : null;
  const criticalCount = Number(scan.criticalCount || 0);
  const missingAlt = Number(scan.missingAltCount || storeSnapshot?.missingAltImages || 0);
  const metaIssues = Number(scan.metaIssueProducts || 0);
  const pageSpeedMobile = storeSnapshot?.pageSpeed?.mobileScore;

  const actions = [];
  if (selectedProduct?.id) {
    const cleanTitle = cleanText(selectedProduct.title || "Selected Product", 34);
    actions.push({
      id: "act-selected-seo",
      type: "AUTO_FIX_PRODUCTS",
      label: `AI Fix "${cleanTitle}" (${CREDIT_COSTS.product_seo_fix} tok)`,
      description: `Optimizes title, focus keyword, meta title, meta description & handle (${CREDIT_COSTS.product_seo_fix} tok).`,
      tone: "primary",
      params: { maxProducts: 1, productIds: [String(selectedProduct.id)] },
    });
    if (lower.includes("description") || lower.includes("copy") || lower.includes("content")) {
      actions.push({
        id: "act-selected-desc",
        type: "FIX_PRODUCT_DESCRIPTION",
        label: `AI Fix Description (${CREDIT_COSTS.product_content_fix} tok)`,
        description: `Rewrites structured HTML product description with headings & bullets (${CREDIT_COSTS.product_content_fix} tok).`,
        tone: "primary",
        params: { maxProducts: 1, productIds: [String(selectedProduct.id)], goal: "expand" },
      });
    }
  } else if (lower.includes("description") || lower.includes("copy") || lower.includes("content rewrite")) {
    actions.push({
      id: "act-desc-batch",
      type: "FIX_PRODUCT_DESCRIPTION",
      label: "AI Fix Top 3 Product Descriptions",
      description: `Generates rich SEO product description HTML (${CREDIT_COSTS.product_content_fix} tok per product).`,
      tone: "primary",
      params: { maxProducts: 3, goal: "expand" },
    });
  }
  if (lower.includes("rollback") || lower.includes("undo") || lower.includes("revert")) {
    actions.push({
      id: "act-rollback",
      type: "ROLLBACK_REVISION",
      label: "Rollback Last SEO Change",
      description: "Restores the previous saved version of your last updated product in Shopify.",
      tone: actions.length === 0 ? "primary" : "secondary",
      params: {},
    });
  }
  if (lower.includes("compress") || lower.includes("image size") || lower.includes("speed") || lower.includes("lcp") || lower.includes("heavy")) {
    actions.push({
      id: "act-compress",
      type: "COMPRESS_HEAVY_IMAGES",
      label: selectedProduct?.id ? "Compress Product Images" : "Compress Top 8 Heavy Images (Balanced)",
      description: "Re-encodes oversized catalog images into sharp, lighter files with zero manual upload.",
      tone: actions.length === 0 ? "primary" : "secondary",
      params: selectedProduct?.id
        ? { preset: "balanced", maxImages: 8, productIds: [String(selectedProduct.id)] }
        : { preset: "balanced", maxImages: 8 },
    });
  }
  if (lower.includes("alt") || missingAlt > 0) {
    actions.push({
      id: "act-alt",
      type: "FIX_IMAGE_ALT",
      label: selectedProduct?.id ? "Fix Selected Product ALT" : `Fix Up to 10 Missing ALT Tags`,
      description: "Generates descriptive SEO ALT text for product images currently missing ALT.",
      tone: actions.length === 0 ? "primary" : "secondary",
      params: selectedProduct?.id
        ? { maxImages: 10, productIds: [String(selectedProduct.id)] }
        : { maxImages: 10 },
    });
  }
  if (lower.includes("meta") || lower.includes("product") || lower.includes("title") || lower.includes("fix") || metaIssues > 0 || criticalCount > 0) {
    actions.push({
      id: "act-products",
      type: "AUTO_FIX_PRODUCTS",
      label: "AI Fix Top 3 Priority Products",
      description: "Uses AI + audit guardrails to repair meta titles, descriptions, keywords, and handles.",
      tone: actions.length === 0 ? "primary" : "secondary",
      params: { maxProducts: 3 },
    });
  }
  if (lower.includes("robots")) {
    actions.push({
      id: "act-robots",
      type: "FIX_ROBOTS_TXT",
      label: "Apply Best-Practice Robots.txt",
      description: "Updates robots.txt draft rules safely and refreshes audit score.",
      tone: "secondary",
      params: { useAi: false },
    });
  }
  if (lower.includes("sitemap")) {
    actions.push({
      id: "act-sitemap",
      type: "REGENERATE_SITEMAP",
      label: "Regenerate XML Sitemap",
      description: "Rebuilds storefront sitemap.xml URLs from active products and pages.",
      tone: "secondary",
      params: {},
    });
  }
  if (lower.includes("pagespeed") || lower.includes("lighthouse") || lower.includes("cwv")) {
    actions.push({
      id: "act-pagespeed",
      type: "RUN_PAGESPEED_TEST",
      label: "Run Live Mobile PageSpeed Test",
      description: "Fetches live Google PageSpeed / Core Web Vitals metrics for your storefront.",
      tone: "secondary",
      params: { strategy: "mobile" },
    });
  }
  if (!actions.length || lower.includes("scan") || lower.includes("audit")) {
    actions.unshift({
      id: "act-scan",
      type: "RUN_FULL_SCAN",
      label: "Run Full Store SEO Scan",
      description: "Audits all catalog products, meta tags, URLs, and technical SEO health.",
      tone: "primary",
      params: {},
    });
  }

  const normalized = normalizeAiChatCopilotResponse({
    reply: [
      reason ? `Live Gemini AI could not be reached right now (${cleanText(reason, 120)}), so I inspected your local store snapshot instead.` : "",
      health !== null
        ? `Current Store SEO Score: ${health}/100 (${criticalCount} critical issues, ${metaIssues} products needing meta/content improvements, ${missingAlt} images missing ALT${pageSpeedMobile != null ? `, Mobile PageSpeed: ${pageSpeedMobile}/100` : ""}).`
        : "No full SEO scan is cached yet. Start with a full store scan or select an instant fix action below.",
      "Click any fix button below to apply it immediately inside your store.",
    ]
      .filter(Boolean)
      .join("\n\n"),
    suggestedActions: actions,
    quickReplies: [
      "What are my top SEO issues right now?",
      "Fix my top 3 products automatically",
      "Compress heavy images for better PageSpeed",
      "Fix missing image ALT text",
    ],
  });

  return {
    ...normalized,
    fallbackUsed: true,
    fallbackReason: cleanText(reason, 180),
  };
}

export async function generateAiChatCopilotReply({
  settings,
  storeDomain,
  userMessage,
  chatHistory = [],
  storeSnapshot = {},
  selectedProduct = null,
  catalogProducts = [],
}) {
  const cleanMessage = String(userMessage || "").trim().slice(0, 1500);
  if (!cleanMessage) {
    return buildAiChatFallbackResponse({
      userMessage: "",
      storeSnapshot,
      selectedProduct,
      reason: "Empty prompt.",
    });
  }

  const effectiveSettings = resolveEffectiveAiConfig(settings);
  if (!effectiveSettings.apiKey || effectiveSettings.provider !== "gemini") {
    return buildAiChatFallbackResponse({
      userMessage: cleanMessage,
      storeSnapshot,
      selectedProduct,
      reason: "Gemini AI key is not configured in /superadmin.",
    });
  }

  const compactHistory = (Array.isArray(chatHistory) ? chatHistory : [])
    .slice(-8)
    .map((entry) => ({
      role: entry?.role === "assistant" ? "assistant" : "user",
      content: String(entry?.content || "").trim().slice(0, 400),
      lastActionResult: entry?.actionResult?.summary ? cleanText(entry.actionResult.summary, 180) : undefined,
    }))
    .filter((entry) => entry.content);

  const prompt = [
    "You are EcomSEO AI Autopilot Copilot embedded inside a Shopify merchant's SEO & PageSpeed app.",
    "The user is chatting in AI Mode and wants concrete analysis AND direct one-click fixes they can execute from this chatbox.",
    "Always base numbers, product titles, and scores strictly on StoreSnapshot below. Never invent store metrics or claim you already edited Shopify unless the conversation history shows a completed actionResult.",
    "",
    "You may recommend up to 4 executable actions from this STRICT allowlist of `type` values:",
    "- RUN_FULL_SCAN: params {} (runs live full catalog SEO audit; Free)",
    `- AUTO_FIX_PRODUCTS: params { maxProducts: 1..5, productIds?: string[] } (uses AI + guardrails to optimize product title, focus keyword, meta title, meta description, and handle; ${CREDIT_COSTS.product_seo_fix} tokens per product)`,
    `- FIX_PRODUCT_DESCRIPTION: params { maxProducts: 1..5, productIds?: string[], goal: 'expand'|'polish'|'structure' } (writes structured SEO HTML product description body copy for selected/top products; ${CREDIT_COSTS.product_content_fix} tokens per product)`,
    "- UPDATE_SPECIFIC_PRODUCT: params { productId: string, title?: string, focusKeyword?: string, metaTitle?: string, metaDescription?: string, handle?: string } (directly writes exact merchant-requested SEO fields to a Shopify product + creates 301 redirect if handle changed; Free)",
    `- FIX_IMAGE_ALT: params { maxImages: 1..20, productIds?: string[], useAi?: boolean } (writes SEO ALT text to Shopify product images; heuristic fill is Free, or useAi:true uses Vision AI at ${CREDIT_COSTS.vision_alt} tokens/image)`,
    `- COMPRESS_HEAVY_IMAGES: params { preset: 'balanced'|'lossless'|'high', maxImages: 1..15, productIds?: string[] } (compresses unoptimized product images via Sharp for faster PageSpeed/LCP; ${CREDIT_COSTS.image_compression} token per compressed image, skipped images cost 0)`,
    `- FIX_ROBOTS_TXT: params { useAi?: boolean, customRules?: string } (applies best-practice/custom rules [Free] or AI-optimized directives [${CREDIT_COSTS.robots_txt_improvement} tokens])`,
    "- REGENERATE_SITEMAP: params { extraManualUrl?: string } (rebuilds XML sitemap, optionally adding a custom URL)",
    "- RUN_PAGESPEED_TEST: params { strategy: 'mobile'|'desktop'|'both', targetUrl?: string } (runs live Google PageSpeed Insights diagnostic)",
    "- TOGGLE_AUTOPILOT: params { enabled: boolean, optimizeMeta?: boolean, optimizeAlt?: boolean } (enables/disables automatic SEO optimization on new products)",
    "- ROLLBACK_REVISION: params { revisionId?: string } (safely reverts the latest or specified product SEO change in Shopify)",
    "- OPEN_ROUTE: params { route: '/app/seo-audit'|'/app/products'|'/app/image-optimizer'|'/app/bulk-meta'|'/app/url-optimization'|'/app/pagespeed'|'/app/robots'|'/app/sitemap'|'/app/revisions'|'/app/settings'|'/app/billing' }",
    "",
    "When the user says 'this product', 'selected product', or mentions a product name/handle, look up its exact `id` from `SelectedProduct` or `CatalogProducts` below and populate `productIds: [id]` or `productId: id`!",
    "After actions finish, a live Before -> After report is automatically rendered in chat.",
    "",
    "Return ONLY valid JSON with this exact shape:",
    JSON.stringify({
      reply: "Clear, practical response explaining findings in plain merchant language (use concise bullet points when listing issues).",
      suggestedActions: [
        {
          id: "act-1",
          type: "FIX_IMAGE_ALT",
          label: "Short button text (<=45 chars)",
          description: "Exact effect in the merchant's store (<=140 chars)",
          tone: "primary",
          params: { maxImages: 10 },
        },
      ],
      autoRunActionId: "Optional: exact id from suggestedActions ONLY if the user explicitly commanded to execute immediately (e.g., 'scan now', 'update this product now', 'fix missing alt now', 'compress my images now', 'enable autopilot'). Otherwise empty string.",
      quickReplies: ["2-4 short follow-up prompts the user can click next"],
    }),
    "",
    `Store Domain: ${cleanText(storeDomain, 160)}`,
    selectedProduct ? `SelectedProduct: ${JSON.stringify(selectedProduct)}` : "",
    Array.isArray(catalogProducts) && catalogProducts.length
      ? `CatalogProducts: ${JSON.stringify(catalogProducts.slice(0, 25))}`
      : "",
    `StoreSnapshot: ${JSON.stringify(storeSnapshot)}`,
    `Recent Conversation: ${JSON.stringify(compactHistory)}`,
    `Merchant Message: ${JSON.stringify(cleanMessage)}`,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const parsed = await requestGeminiJson({
      model: effectiveSettings.model,
      apiKey: effectiveSettings.apiKey,
      prompt,
      temperature: 0.3,
    });
    const normalized = normalizeAiChatCopilotResponse(parsed);
    return {
      ...normalized,
      fallbackUsed: false,
      modelUsed: effectiveSettings.model,
    };
  } catch (error) {
    return buildAiChatFallbackResponse({
      userMessage: cleanMessage,
      storeSnapshot,
      selectedProduct,
      reason: error?.message || "Gemini request failed.",
    });
  }
}
