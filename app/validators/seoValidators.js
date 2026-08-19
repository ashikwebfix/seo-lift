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
    handleStr.length >= 3 &&
    handleStr.length <= 45 &&
    validPattern.test(handleStr);

  return {
    valid,
    normalized: clean,
    message: valid
      ? ""
      : "URL handle must be lowercase, hyphenated, and 3-45 characters.",
  };
}

export function validateProductSeoInput(payload) {
  const cleanTitle = String(payload.title || "").trim();
  const cleanFocusKeyword = String(payload.focusKeyword || "").trim();
  const title = {
    valid: cleanTitle.length > 0,
    message: cleanTitle ? "" : "Product title is required.",
  };
  const focusKeyword = cleanFocusKeyword
    ? validateFocusKeyword(cleanFocusKeyword)
    : { valid: true, message: "" };
  const metaTitle = validateMetaTitle(payload.metaTitle);
  const metaDescription = validateMetaDescription(payload.metaDescription);
  const handle = validateUrlHandle(payload.handle);

  const errors = {
    title: title.message,
    focusKeyword: focusKeyword.message,
    metaTitle: metaTitle.message,
    metaDescription: metaDescription.message,
    handle: handle.message,
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
    },
    quality: {
      metaTitleIdeal: metaTitle.ideal,
      metaDescriptionIdeal: metaDescription.ideal,
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
