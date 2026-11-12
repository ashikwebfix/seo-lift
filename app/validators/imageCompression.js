export const IMAGE_SIZE_THRESHOLDS = Object.freeze({
  OPTIMAL_MAX_BYTES: 200 * 1024, // 200 KB target for fast storefront LCP
  CRITICAL_BYTES: 600 * 1024, // > 600 KB severely hurts mobile PageSpeed
  MAX_SAFE_DIMENSION: 2048, // Retina-sharp Shopify product display cap
  CRITICAL_DIMENSION: 3000,
  PNG_CONVERT_RECOMMENDED_BYTES: 180 * 1024,
});

export const COMPRESSION_PRESETS = Object.freeze({
  pagespeed_balanced: Object.freeze({
    id: "pagespeed_balanced",
    label: "PageSpeed Balanced (Recommended)",
    badge: "Best LCP / Quality Ratio",
    description:
      "Caps dimensions at 2048px, optimizes at quality 80 (MozJPEG / palette PNG / WebP), strips EXIF metadata, and converts bloated opaque PNGs.",
    maxWidth: 2048,
    maxHeight: 2048,
    quality: 80,
    format: "smart",
    targetMaxKb: 0,
  }),
  pagespeed_aggressive: Object.freeze({
    id: "pagespeed_aggressive",
    label: "Mobile LCP Speed (Smallest File)",
    badge: "Max KB Savings",
    description:
      "Caps dimensions at 1600px, converts to WebP quality 72, and enforces a <= 180 KB deterministic size ceiling when possible.",
    maxWidth: 1600,
    maxHeight: 1600,
    quality: 72,
    format: "webp",
    targetMaxKb: 180,
  }),
  lossless_safe: Object.freeze({
    id: "lossless_safe",
    label: "Studio Quality (Preserve Format)",
    badge: "Near-Lossless",
    description:
      "Keeps original format, caps dimensions at 2400px, uses quality 88, and strips unused camera EXIF/XMP metadata safely.",
    maxWidth: 2400,
    maxHeight: 2400,
    quality: 88,
    format: "preserve",
    targetMaxKb: 0,
  }),
  custom: Object.freeze({
    id: "custom",
    label: "Custom Fixed Rules",
    badge: "Configurable",
    description:
      "Configure exact fixed pixel limits, output format, encoder quality (45-95), and an optional max KB ceiling.",
    maxWidth: 2048,
    maxHeight: 2048,
    quality: 80,
    format: "smart",
    targetMaxKb: 0,
  }),
});

export const VALID_OUTPUT_FORMATS = Object.freeze([
  "smart",
  "preserve",
  "webp",
  "jpeg",
  "png",
]);

function clampInt(value, fallback, min, max) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, Math.round(num)));
}

export function normalizeCompressionOptions(raw = {}) {
  const presetKey = Object.prototype.hasOwnProperty.call(
    COMPRESSION_PRESETS,
    String(raw?.preset || "").trim(),
  )
    ? String(raw.preset).trim()
    : "pagespeed_balanced";

  const preset = COMPRESSION_PRESETS[presetKey];
  if (presetKey !== "custom") {
    return {
      preset: preset.id,
      maxWidth: preset.maxWidth,
      maxHeight: preset.maxHeight,
      quality: preset.quality,
      format: preset.format,
      targetMaxKb: preset.targetMaxKb,
    };
  }

  const maxWidth = clampInt(raw?.maxWidth, preset.maxWidth, 400, 4096);
  const maxHeight = clampInt(raw?.maxHeight, maxWidth, 400, 4096);
  const quality = clampInt(raw?.quality, preset.quality, 45, 95);
  const rawFormat = String(raw?.format || preset.format).trim().toLowerCase();
  const format = VALID_OUTPUT_FORMATS.includes(rawFormat) ? rawFormat : preset.format;
  const targetMaxKb = clampInt(raw?.targetMaxKb, 0, 0, 5000);

  return {
    preset: "custom",
    maxWidth,
    maxHeight,
    quality,
    format,
    targetMaxKb,
  };
}

export function formatBytes(bytes) {
  if (bytes === null || bytes === undefined || !Number.isFinite(Number(bytes)) || Number(bytes) < 0) {
    return "Unknown";
  }
  const value = Number(bytes);
  if (value < 1024) return `${Math.round(value)} B`;
  const kb = value / 1024;
  if (kb < 1024) return `${kb >= 100 ? Math.round(kb) : kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(2)} MB`;
}

export function inferImageFormatFromUrl(url = "", mimeType = "") {
  const cleanMime = String(mimeType || "").trim().toLowerCase();
  if (cleanMime.includes("webp")) return "webp";
  if (cleanMime.includes("png")) return "png";
  if (cleanMime.includes("jpeg") || cleanMime.includes("jpg")) return "jpeg";
  if (cleanMime.includes("gif")) return "gif";
  if (cleanMime.includes("avif")) return "avif";
  if (cleanMime.includes("svg")) return "svg";

  const cleanPath = String(url || "").split("?")[0].split("#")[0].toLowerCase();
  const extMatch = cleanPath.match(/\.([a-z0-9]+)$/);
  const ext = extMatch ? extMatch[1] : "";
  if (ext === "jpg" || ext === "jpeg" || ext === "pjpeg") return "jpeg";
  if (ext === "png") return "png";
  if (ext === "webp") return "webp";
  if (ext === "gif") return "gif";
  if (ext === "avif") return "avif";
  if (ext === "svg") return "svg";
  if (ext === "bmp" || ext === "tiff" || ext === "tif") return ext;
  return "unknown";
}

export function analyzeImageSizeHealth({
  width = 0,
  height = 0,
  fileSizeBytes = null,
  format = "unknown",
} = {}) {
  const w = Math.max(0, Number(width || 0));
  const h = Math.max(0, Number(height || 0));
  const maxDimension = Math.max(w, h);
  const hasSize =
    fileSizeBytes !== null &&
    fileSizeBytes !== undefined &&
    Number.isFinite(Number(fileSizeBytes)) &&
    Number(fileSizeBytes) > 0;
  const bytes = hasSize ? Number(fileSizeBytes) : null;
  const cleanFormat = String(format || "unknown").toLowerCase();

  const criticalFile = Boolean(hasSize && bytes > IMAGE_SIZE_THRESHOLDS.CRITICAL_BYTES);
  const heavyFile = Boolean(hasSize && bytes > IMAGE_SIZE_THRESHOLDS.OPTIMAL_MAX_BYTES);
  const criticalDimensions = maxDimension > IMAGE_SIZE_THRESHOLDS.CRITICAL_DIMENSION;
  const oversizedDimensions = maxDimension > IMAGE_SIZE_THRESHOLDS.MAX_SAFE_DIMENSION;
  const bloatedPng =
    cleanFormat === "png" &&
    (!hasSize || bytes > IMAGE_SIZE_THRESHOLDS.PNG_CONVERT_RECOMMENDED_BYTES);
  const legacyBitmap = cleanFormat === "bmp" || cleanFormat === "tiff" || cleanFormat === "tif";

  const reasons = [];
  if (criticalFile) {
    reasons.push(`Critical file weight (${formatBytes(bytes)} > 600 KB) slows PageSpeed LCP`);
  } else if (heavyFile) {
    reasons.push(`Heavy file (${formatBytes(bytes)} > 200 KB target)`);
  }

  if (criticalDimensions) {
    reasons.push(`Very large resolution (${w}×${h}px > 3000px)`);
  } else if (oversizedDimensions) {
    reasons.push(`Oversized resolution (${w}×${h}px > 2048px display cap)`);
  }

  if (bloatedPng) {
    reasons.push("Large PNG file — converting to WebP/MozJPEG cuts transfer bytes");
  } else if (legacyBitmap) {
    reasons.push(`Uncompressed ${cleanFormat.toUpperCase()} format should be converted to WebP/JPEG`);
  }

  let status = "optimal";
  if (criticalFile || criticalDimensions || legacyBitmap) {
    status = "critical";
  } else if (heavyFile || oversizedDimensions || bloatedPng) {
    status = "needs-optimization";
  } else if (!hasSize && maxDimension === 0) {
    status = "unchecked";
  }

  const needsOptimization = status === "critical" || status === "needs-optimization";
  const estimatedSavablePercent =
    status === "critical"
      ? 55
      : status === "needs-optimization"
        ? 35
        : 0;

  return {
    status,
    needsOptimization,
    heavyFile,
    criticalFile,
    oversizedDimensions,
    criticalDimensions,
    bloatedPng,
    legacyBitmap,
    hasSize,
    fileSizeBytes: bytes,
    fileSizeLabel: formatBytes(bytes),
    dimensionsLabel: w > 0 && h > 0 ? `${w}×${h}` : "Unknown",
    maxDimension,
    format: cleanFormat,
    reasons,
    estimatedSavablePercent,
  };
}

export function summarizeCompressionRows(rows = []) {
  const safeRows = Array.isArray(rows) ? rows : [];
  let totalBytes = 0;
  let knownSizeCount = 0;
  let critical = 0;
  let needsOptimization = 0;
  let optimal = 0;
  let unchecked = 0;
  let oversizedCount = 0;
  let heavyCount = 0;

  for (const row of safeRows) {
    const health = row.sizeHealth || analyzeImageSizeHealth({
      width: row.width,
      height: row.height,
      fileSizeBytes: row.fileSizeBytes,
      format: row.format,
    });

    if (health.hasSize) {
      knownSizeCount += 1;
      totalBytes += health.fileSizeBytes;
    }
    if (health.oversizedDimensions) oversizedCount += 1;
    if (health.heavyFile) heavyCount += 1;

    if (health.status === "critical") {
      critical += 1;
      needsOptimization += 1;
    } else if (health.status === "needs-optimization") {
      needsOptimization += 1;
    } else if (health.status === "optimal") {
      optimal += 1;
    } else {
      unchecked += 1;
    }
  }

  return {
    total: safeRows.length,
    totalBytes,
    totalFormatted: knownSizeCount > 0 ? formatBytes(totalBytes) : "Unknown",
    knownSizeCount,
    critical,
    warning: Math.max(0, needsOptimization - critical),
    needsOptimization,
    optimal,
    unchecked,
    oversizedCount,
    heavyCount,
  };
}

