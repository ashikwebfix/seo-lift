function validateLength(value, min, max) {
  const text = String(value || "").trim();
  return text.length >= min && text.length <= max;
}

export function normalizeImageAlt(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

export function validateProductTitle(value) {
  const clean = String(value || "").trim();
  const valid = validateLength(clean, 25, 70);
  return {
    valid,
    message: valid ? "" : "Product title must be 25-70 characters.",
  };
}

export function validateFocusKeyword(value) {
  const clean = String(value || "").trim();
  const valid = validateLength(clean, 3, 40);
  return {
    valid,
    message: valid ? "" : "Focus keyword must be 3-40 characters.",
  };
}

export function validateMetaTitle(value) {
  const clean = String(value || "").trim();
  const hardValid = clean.length <= 65;
  const ideal = clean.length >= 45 && clean.length <= 60;

  return {
    valid: hardValid,
    ideal,
    message: hardValid ? "" : "Meta title must be 65 characters or less.",
  };
}

export function validateMetaDescription(value) {
  const clean = String(value || "").trim();
  const hardValid = clean.length <= 160;
  const ideal = clean.length >= 120 && clean.length <= 155;

  return {
    valid: hardValid,
    ideal,
    message: hardValid ? "" : "Meta description must be 160 characters or less.",
  };
}

function isGenericImageAlt(value) {
  return /^(image|photo|picture|product image|product photo|img)(?:\s+\d+)?$/i.test(value);
}

export function validateImageAlt(value) {
  const clean = normalizeImageAlt(value);
  const length = clean.length;
  const missing = length === 0;
  const tooLong = length > 125;
  const tooShort = length > 0 && length < 20;
  const generic = !missing && isGenericImageAlt(clean);
  const valid = !missing && !tooLong;
  const ideal = valid && !tooShort && !generic && length <= 110;

  let message = "";
  if (missing) {
    message = "Image ALT text is required.";
  } else if (tooLong) {
    message = "Image ALT text must be 125 characters or less.";
  } else if (generic) {
    message = "Image ALT text is too generic.";
  } else if (tooShort) {
    message = "Image ALT text should be at least 20 characters for better context.";
  }

  return {
    valid,
    ideal,
    missing,
    tooLong,
    tooShort,
    generic,
    length,
    normalized: clean,
    message,
  };
}

export function suggestImageAltText({ productTitle, position = 1, currentAlt = "" }) {
  const current = normalizeImageAlt(currentAlt);
  const currentValidation = validateImageAlt(current);
  if (current && currentValidation.valid && !currentValidation.generic && !currentValidation.tooShort) {
    return current;
  }

  const safeTitle = normalizeImageAlt(productTitle) || "Product";
  const suffix = Number(position) > 1 ? ` - view ${Number(position)}` : " - product image";
  const seed = `${safeTitle}${suffix}`;
  const trimmed = seed.length > 125 ? seed.slice(0, 125).trimEnd() : seed;

  if (trimmed.length >= 20) {
    return trimmed;
  }

  const fallback = `${safeTitle} product photo for online store listing`;
  return fallback.length > 125 ? fallback.slice(0, 125).trimEnd() : fallback;
}

export function normalizeHandle(value) {
  let clean = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  if (clean.length > 45) {
    clean = clean.slice(0, 45).replace(/-+$/, "");
  }

  return clean;
}

export function validateUrlHandle(value) {
  const handleStr = String(value || "");
  const clean = normalizeHandle(handleStr);
  const validPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  
  const valid =
    handleStr === clean &&
    handleStr.length >= 1 &&
    handleStr.length <= 45 &&
    validPattern.test(handleStr);

  return {
    valid,
    normalized: clean,
    message: valid
      ? ""
      : "URL handle must be lowercase, hyphenated, and 1-45 characters.",
  };
}

export function stripHtmlTags(html = "") {
  return String(html || "")
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\/(p|div|li|h[1-6]|tr|blockquote|section|article)>/gi, " ")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function sanitizeProductDescriptionHtml(html = "") {
  return String(html || "")
    .replace(/<(script|style|iframe|object|embed|form)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\s(href|src)\s*=\s*(['"])\s*(?:javascript:|data:text\/html)[\s\S]*?\2/gi, ' $1="#"')
    .trim();
}

function textMatchesKeyword(haystack, focusKeyword) {
  const kw = String(focusKeyword || "").trim().toLowerCase();
  if (kw.length < 3) return false;
  const normalizedHaystack = String(haystack || "").toLowerCase();
  if (normalizedHaystack.includes(kw)) return true;
  const slugHaystack = normalizedHaystack.replace(/[^a-z0-9]+/g, " ");
  const slugKw = kw.replace(/[^a-z0-9]+/g, " ").trim();
  return Boolean(slugKw) && slugHaystack.includes(slugKw);
}

export function validateProductDescription(html = "", focusKeyword = "") {
  const cleanHtml = sanitizeProductDescriptionHtml(html);
  const plainText = stripHtmlTags(cleanHtml);
  const charCount = plainText.length;
  const wordCount = plainText ? plainText.split(/\s+/).filter(Boolean).length : 0;
  const hasStructure = /<(h2|h3|ul|ol|li|p)\b/i.test(cleanHtml);
  const cleanKw = String(focusKeyword || "").trim();
  const hasKeyword = cleanKw.length >= 3 ? textMatchesKeyword(plainText, cleanKw) : false;
  const valid = charCount <= 15000;
  const ideal = valid && wordCount >= 80 && hasStructure && (cleanKw.length < 3 || hasKeyword);

  let message = "";
  if (!valid) {
    message = "Product description plain text must be 15,000 characters or less.";
  } else if (wordCount === 0) {
    message = "Add product description copy (80+ words recommended for Google ranking).";
  } else if (wordCount < 80) {
    message = `Thin description (${wordCount} words). Aim for 80+ words with key buyer benefits.`;
  } else if (!hasStructure) {
    message = "Add HTML structure (headings or bullet points) to improve scan readability.";
  } else if (cleanKw.length >= 3 && !hasKeyword) {
    message = `Mention focus keyword "${cleanKw}" naturally inside the product description.`;
  }

  return {
    valid,
    ideal,
    wordCount,
    charCount,
    hasStructure,
    hasKeyword,
    message,
  };
}

export function evaluateOnPageSeoSignals({
  title = "",
  focusKeyword = "",
  metaTitle = "",
  metaDescription = "",
  handle = "",
  descriptionHtml = "",
} = {}) {
  const cleanKw = String(focusKeyword || "").trim();
  const hasKeyword = validateFocusKeyword(cleanKw).valid;
  const desc = validateProductDescription(descriptionHtml, cleanKw);

  const keywordInTitle = hasKeyword && textMatchesKeyword(title, cleanKw);
  const keywordInMetaTitle = hasKeyword && textMatchesKeyword(metaTitle, cleanKw);
  const keywordInMetaDescription = hasKeyword && textMatchesKeyword(metaDescription, cleanKw);
  const keywordInHandle = hasKeyword && textMatchesKeyword(handle, cleanKw);
  const keywordInDescription = hasKeyword && desc.hasKeyword;

  const checks = [
    { key: "titleLength", label: "Product title (25-70 chars)", passed: validateProductTitle(title).valid },
    { key: "focusKeyword", label: "Focus keyword set (3-40 chars)", passed: hasKeyword },
    { key: "metaTitle", label: "Meta title ideal (45-60 chars)", passed: validateMetaTitle(metaTitle).valid && validateMetaTitle(metaTitle).ideal },
    { key: "metaDescription", label: "Meta description ideal (120-155 chars)", passed: validateMetaDescription(metaDescription).valid && validateMetaDescription(metaDescription).ideal },
    { key: "handle", label: "Clean SEO URL handle", passed: validateUrlHandle(handle).valid },
    { key: "keywordInTitle", label: "Focus keyword in title", passed: keywordInTitle },
    { key: "keywordInMetaTitle", label: "Focus keyword in meta title", passed: keywordInMetaTitle },
    { key: "keywordInMetaDescription", label: "Focus keyword in meta description", passed: keywordInMetaDescription },
    { key: "richDescription", label: "Rich product copy (80+ words + structure)", passed: desc.wordCount >= 80 && desc.hasStructure },
    { key: "keywordInDescription", label: "Focus keyword in description", passed: keywordInDescription },
  ];

  const passedCount = checks.filter((c) => c.passed).length;
  const totalCount = checks.length;
  return {
    checks,
    passedCount,
    totalCount,
    scorePercent: Math.round((passedCount / totalCount) * 100),
    keywordInTitle,
    keywordInMetaTitle,
    keywordInMetaDescription,
    keywordInHandle,
    keywordInDescription,
    description: desc,
  };
}

export function validateProductSeoInput(payload) {
  const cleanTitle = String(payload.title || "").trim();
  const cleanFocusKeyword = String(payload.focusKeyword || "").trim();
  const hasDescriptionPayload = typeof payload.descriptionHtml === "string";
  const cleanDescriptionHtml = hasDescriptionPayload
    ? sanitizeProductDescriptionHtml(payload.descriptionHtml)
    : undefined;
  const title = {
    valid: cleanTitle.length > 0,
    message: cleanTitle ? "" : "Product title is required.",
  };
  const focusKeyword = cleanFocusKeyword
    ? validateFocusKeyword(cleanFocusKeyword)
    : { valid: true, message: "" };
  const metaTitle = validateMetaTitle(payload.metaTitle);
  const metaDescription = validateMetaDescription(payload.metaDescription);
  const normalizedHandleCandidate = normalizeHandle(payload.handle);
  const handle = validateUrlHandle(normalizedHandleCandidate);
  const description = hasDescriptionPayload
    ? validateProductDescription(cleanDescriptionHtml, cleanFocusKeyword)
    : null;

  const errors = {
    title: title.message,
    focusKeyword: focusKeyword.message,
    metaTitle: metaTitle.message,
    metaDescription: metaDescription.message,
    handle: handle.message,
    ...(hasDescriptionPayload && description && !description.valid
      ? { descriptionHtml: description.message }
      : {}),
  };

  const hasErrors = Object.values(errors).some(Boolean);

  return {
    valid: !hasErrors,
    errors,
    normalized: {
      title: cleanTitle,
      focusKeyword: cleanFocusKeyword,
      metaTitle: String(payload.metaTitle || "").trim(),
      metaDescription: String(payload.metaDescription || "").trim(),
      handle: handle.normalized,
      ...(hasDescriptionPayload ? { descriptionHtml: cleanDescriptionHtml } : {}),
    },
    quality: {
      metaTitleIdeal: metaTitle.ideal,
      metaDescriptionIdeal: metaDescription.ideal,
      ...(description
        ? {
            descriptionIdeal: description.ideal,
            descriptionWordCount: description.wordCount,
          }
        : {}),
    },
  };
}

export function validateRobotsRules(rulesText) {
  const rules = String(rulesText || "");
  const disallowCart = /disallow:\s*\/cart/i.test(rules);
  const disallowSearch = /disallow:\s*\/search/i.test(rules);

  return {
    valid: disallowCart && disallowSearch,
    disallowCart,
    disallowSearch,
    message:
      disallowCart && disallowSearch
        ? ""
        : "robots.txt must include Disallow for /cart and /search.",
  };
}
