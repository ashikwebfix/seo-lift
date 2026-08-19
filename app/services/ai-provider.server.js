import {
  normalizeHandle,
  validateFocusKeyword,
  validateMetaDescription,
  validateMetaTitle,
  validateProductTitle,
  validateUrlHandle,
} from "../validators/seoValidators.js";

export const DEFAULT_AI_SETTINGS = Object.freeze({
  provider: "gemini",
  model: "gemini-2.5-flash",
  apiKey: "",
});

export function looksLikeGeminiApiKey(value) {
  const clean = cleanText(value);
  return /^AIza[0-9A-Za-z_-]{20,}$/.test(clean);
}

export function maskApiKey(value) {
  const clean = cleanText(value);
  if (!clean) return "";
  if (clean.length <= 8) return "*".repeat(clean.length);
  return `${clean.slice(0, 4)}...${clean.slice(-4)}`;
}

export function getAiSettingsStatus(settings = {}) {
  const normalized = normalizeAiSettings(settings);
  const hasApiKey = Boolean(normalized.apiKey);

  return {
    hasApiKey,
    apiKeyMask: maskApiKey(normalized.apiKey),
    apiKeyLooksValid:
      normalized.provider === "gemini" ? looksLikeGeminiApiKey(normalized.apiKey) : hasApiKey,
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

async function requestGeminiJson({ model, apiKey, prompt }) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
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
          temperature: 0.4,
          responseMimeType: "application/json",
        },
      }),
    },
  );

  const rawText = await response.text();
  let parsedBody = null;
  try {
    parsedBody = rawText ? JSON.parse(rawText) : null;
  } catch {
    parsedBody = null;
  }

  if (!response.ok) {
    const message =
      parsedBody?.error?.message ||
      `AI provider request failed with status ${response.status}.`;
    throw new Error(message);
  }

  const text = parsedBody?.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || "")
    .join("")
    .trim();

  return parseJsonObject(text);
}

async function requestSeoFixFromProvider({ settings, prompt }) {
  const normalizedSettings = normalizeAiSettings(settings);
  if (!normalizedSettings.apiKey) {
    throw new Error("Add a Gemini API key in Settings before using AI Fix.");
  }

  if (normalizedSettings.provider !== "gemini") {
    throw new Error(`Unsupported AI provider: ${normalizedSettings.provider}`);
  }

  try {
    return await requestGeminiJson({
      model: normalizedSettings.model,
      apiKey: normalizedSettings.apiKey,
      prompt,
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

export function normalizeProductSeoSuggestion(input, fallbackSource) {
  const fallback = buildProductFallback(fallbackSource);
  const normalized = normalizeAiResponse(input);

  return {
    title: validateProductTitle(normalized.title).valid ? normalized.title : fallback.title,
    focusKeyword: validateFocusKeyword(normalized.focusKeyword).valid ? normalized.focusKeyword : fallback.focusKeyword,
    handle: validateUrlHandle(normalized.handle).valid ? validateUrlHandle(normalized.handle).normalized : fallback.handle,
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
}

export async function generateProductSeoFix({ settings, title, focusKeyword, handle, metaTitle, metaDescription }) {
  const prompt = `
Create improved ecommerce SEO fields for a Shopify product.

Return JSON with keys:
- title
- focusKeyword
- handle
- metaTitle
- metaDescription
- rationale

Hard rules:
- title must be 25-70 characters
- focusKeyword must be 3-40 characters
- handle must be lowercase, hyphenated, 3-45 characters
- metaTitle must be 45-60 characters
- metaDescription must be 120-155 characters
- keep language clear, specific, and purchase-oriented
- use the focus keyword naturally

Current values:
${JSON.stringify({ title, focusKeyword, handle, metaTitle, metaDescription }, null, 2)}
`.trim();

  const response = await requestSeoFixFromProvider({ settings, prompt });
  return normalizeProductSeoSuggestion(response, {
    title,
    focusKeyword,
    handle,
    metaTitle,
    metaDescription,
  });
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
