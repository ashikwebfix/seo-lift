import {
  analyzeImageSizeHealth,
  formatBytes,
  inferImageFormatFromUrl,
  normalizeCompressionOptions,
} from "../validators/imageCompression.js";

const DEFAULT_PROBE_TIMEOUT_MS = 4500;
const DEFAULT_DOWNLOAD_TIMEOUT_MS = 25000;
const MAX_DOWNLOAD_BYTES = 25 * 1024 * 1024; // 25 MB safety ceiling

let cachedSharp = null;

async function getSharp() {
  if (cachedSharp) return cachedSharp;
  try {
    const mod = await import("sharp");
    cachedSharp = mod.default || mod;
    return cachedSharp;
  } catch (error) {
    throw new Error(
      `Image compression engine (sharp) failed to initialize: ${error?.message || "Module not available"}. Run npm install on the server.`,
    );
  }
}

export function parseContentRangeTotal(headerValue) {
  const match = String(headerValue || "").match(/\/(\d+)\s*$/);
  if (!match) return null;
  const total = Number(match[1]);
  return Number.isFinite(total) && total > 0 ? total : null;
}

export async function probeImageMetadata(url, { timeoutMs = DEFAULT_PROBE_TIMEOUT_MS } = {}) {
  const cleanUrl = String(url || "").trim();
  const fallbackFormat = inferImageFormatFromUrl(cleanUrl);

  if (!cleanUrl || !/^https?:\/\//i.test(cleanUrl)) {
    return {
      fileSizeBytes: null,
      mimeType: "",
      format: fallbackFormat,
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let response = await fetch(cleanUrl, {
      method: "HEAD",
      signal: controller.signal,
    });

    let mimeType = response.headers.get("content-type") || "";
    const contentLengthHeader = response.headers.get("content-length");
    let fileSizeBytes =
      contentLengthHeader !== null && /^\d+$/.test(contentLengthHeader.trim())
        ? Number(contentLengthHeader.trim())
        : null;

    if ((!response.ok || fileSizeBytes === null || fileSizeBytes <= 0) && response.status !== 404) {
      const rangeController = new AbortController();
      const rangeTimer = setTimeout(() => rangeController.abort(), timeoutMs);
      try {
        response = await fetch(cleanUrl, {
          method: "GET",
          headers: { Range: "bytes=0-0" },
          signal: rangeController.signal,
        });
        mimeType = response.headers.get("content-type") || mimeType;
        const rangeTotal = parseContentRangeTotal(response.headers.get("content-range"));
        if (rangeTotal) {
          fileSizeBytes = rangeTotal;
        }
        if (response.body && typeof response.body.cancel === "function") {
          await response.body.cancel().catch(() => {});
        }
      } finally {
        clearTimeout(rangeTimer);
      }
    }

    const format = inferImageFormatFromUrl(cleanUrl, mimeType);
    return {
      fileSizeBytes: Number.isFinite(fileSizeBytes) && fileSizeBytes > 0 ? fileSizeBytes : null,
      mimeType: String(mimeType || "").split(";")[0].trim().toLowerCase(),
      format,
    };
  } catch {
    return {
      fileSizeBytes: null,
      mimeType: "",
      format: fallbackFormat,
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function probeImageRowsBatch(
  rows = [],
  { concurrency = 6, timeoutMs = DEFAULT_PROBE_TIMEOUT_MS } = {},
) {
  const safeRows = Array.isArray(rows) ? rows : [];
  if (!safeRows.length) return [];

  const results = new Array(safeRows.length);
  let cursor = 0;

  async function worker() {
    while (cursor < safeRows.length) {
      const idx = cursor;
      cursor += 1;
      const row = safeRows[idx];
      const hasKnownBytes =
        row.fileSizeBytes !== null &&
        row.fileSizeBytes !== undefined &&
        Number.isFinite(Number(row.fileSizeBytes)) &&
        Number(row.fileSizeBytes) > 0;

      const probed = hasKnownBytes
        ? {
            fileSizeBytes: Number(row.fileSizeBytes),
            mimeType: row.mimeType || "",
            format: row.format || inferImageFormatFromUrl(row.imageUrl, row.mimeType),
          }
        : await probeImageMetadata(row.imageUrl, { timeoutMs });

      const format = probed.format || inferImageFormatFromUrl(row.imageUrl, probed.mimeType);
      const sizeHealth = analyzeImageSizeHealth({
        width: row.width,
        height: row.height,
        fileSizeBytes: probed.fileSizeBytes,
        format,
      });

      results[idx] = {
        ...row,
        fileSizeBytes: probed.fileSizeBytes,
        fileSizeLabel: formatBytes(probed.fileSizeBytes),
        mimeType: probed.mimeType || "",
        format,
        sizeHealth,
      };
    }
  }

  const workerCount = Math.min(concurrency, safeRows.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

export async function downloadImageBuffer(
  url,
  { timeoutMs = DEFAULT_DOWNLOAD_TIMEOUT_MS, maxBytes = MAX_DOWNLOAD_BYTES } = {},
) {
  const cleanUrl = String(url || "").trim();
  if (!cleanUrl || !/^https?:\/\//i.test(cleanUrl)) {
    throw new Error("Invalid product image URL.");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(cleanUrl, {
      method: "GET",
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch image (${response.status} ${response.statusText || ""}).`);
    }

    const headerLen = Number(response.headers.get("content-length") || 0);
    if (headerLen > maxBytes) {
      throw new Error(`Image exceeds ${formatBytes(maxBytes)} download safety limit.`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    if (!buffer.length) {
      throw new Error("Downloaded image file was empty.");
    }
    if (buffer.length > maxBytes) {
      throw new Error(`Image exceeds ${formatBytes(maxBytes)} size ceiling.`);
    }

    return {
      buffer,
      mimeType: String(response.headers.get("content-type") || "").split(";")[0].trim().toLowerCase(),
      originalBytes: buffer.length,
    };
  } finally {
    clearTimeout(timer);
  }
}

export function resolveTargetFormat({ inputFormat = "jpeg", hasAlpha = false, requestedFormat = "smart" }) {
  const cleanInput = String(inputFormat || "jpeg").toLowerCase();
  const cleanRequested = String(requestedFormat || "smart").toLowerCase();

  if (cleanRequested === "webp") return "webp";
  if (cleanRequested === "jpeg") return "jpeg";
  if (cleanRequested === "png") return "png";

  if (cleanRequested === "preserve") {
    if (cleanInput === "jpeg" || cleanInput === "jpg") return "jpeg";
    if (cleanInput === "png") return "png";
    if (cleanInput === "webp") return "webp";
    return hasAlpha ? "png" : "jpeg";
  }

  // "smart" deterministic PageSpeed rule:
  // Keep JPEG as progressive MozJPEG, WebP as WebP, transparent assets as WebP,
  // and convert bloated opaque PNG/TIFF/BMP images to progressive MozJPEG.
  if (cleanInput === "webp") return "webp";
  if (cleanInput === "jpeg" || cleanInput === "jpg") return "jpeg";
  return hasAlpha ? "webp" : "jpeg";
}

function formatToMimeAndExt(format) {
  if (format === "webp") {
    return { mimeType: "image/webp", extension: "webp" };
  }
  if (format === "png") {
    return { mimeType: "image/png", extension: "png" };
  }
  return { mimeType: "image/jpeg", extension: "jpg" };
}

async function encodeSharpPipeline({
  sharp,
  inputBuffer,
  metadata,
  targetFormat,
  maxWidth,
  maxHeight,
  quality,
}) {
  let pipeline = sharp(inputBuffer, { failOn: "none" }).rotate();

  // Preserve visual colors cleanly before EXIF/ICC stripping when images use AdobeRGB/Display-P3/CMYK.
  if (metadata.space && !["srgb", "b-w"].includes(String(metadata.space).toLowerCase())) {
    pipeline = pipeline.toColorspace("srgb");
  }

  pipeline = pipeline.resize({
    width: maxWidth,
    height: maxHeight,
    fit: "inside",
    withoutEnlargement: true,
  });

  if (targetFormat === "jpeg") {
    if (metadata.hasAlpha) {
      pipeline = pipeline.flatten({ background: { r: 255, g: 255, b: 255 } });
    }
    pipeline = pipeline.jpeg({
      quality,
      mozjpeg: true,
      progressive: true,
    });
  } else if (targetFormat === "webp") {
    pipeline = pipeline.webp({
      quality,
      effort: 4,
    });
  } else {
    pipeline = pipeline.png({
      compressionLevel: 9,
      palette: true,
      quality,
    });
  }

  const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });
  return {
    buffer: data,
    width: Number(info.width || metadata.width || 0),
    height: Number(info.height || metadata.height || 0),
    bytes: Number(data.length),
  };
}

export async function compressImageBuffer(inputBuffer, rawOptions = {}) {
  if (!Buffer.isBuffer(inputBuffer) || inputBuffer.length === 0) {
    throw new Error("A non-empty image Buffer is required for compression.");
  }

  const sharp = await getSharp();
  const options = normalizeCompressionOptions(rawOptions);
  const metadata = await sharp(inputBuffer, { failOn: "none" }).metadata();
  const originalFormat = String(metadata.format || "unknown").toLowerCase();
  const originalWidth = Number(metadata.width || 0);
  const originalHeight = Number(metadata.height || 0);
  const originalBytes = inputBuffer.length;

  if (originalFormat === "svg") {
    return {
      skipped: true,
      reason: "Vector SVG asset is already resolution-independent.",
      buffer: inputBuffer,
      mimeType: "image/svg+xml",
      extension: "svg",
      format: "svg",
      originalFormat,
      originalBytes,
      compressedBytes: originalBytes,
      savedBytes: 0,
      savedPercent: 0,
      originalWidth,
      originalHeight,
      width: originalWidth,
      height: originalHeight,
      resized: false,
      formatChanged: false,
      qualityUsed: options.quality,
      options,
    };
  }

  if (originalFormat === "gif" && Number(metadata.pages || 1) > 1) {
    return {
      skipped: true,
      reason: "Animated GIF skipped to preserve animation frames.",
      buffer: inputBuffer,
      mimeType: "image/gif",
      extension: "gif",
      format: "gif",
      originalFormat,
      originalBytes,
      compressedBytes: originalBytes,
      savedBytes: 0,
      savedPercent: 0,
      originalWidth,
      originalHeight,
      width: originalWidth,
      height: originalHeight,
      resized: false,
      formatChanged: false,
      qualityUsed: options.quality,
      options,
    };
  }

  const targetFormat = resolveTargetFormat({
    inputFormat: originalFormat,
    hasAlpha: Boolean(metadata.hasAlpha),
    requestedFormat: options.format,
  });

  let currentQuality = options.quality;
  let encoded = await encodeSharpPipeline({
    sharp,
    inputBuffer,
    metadata,
    targetFormat,
    maxWidth: options.maxWidth,
    maxHeight: options.maxHeight,
    quality: currentQuality,
  });

  // Deterministic fixed-step reduction when an explicit KB ceiling is configured.
  const targetMaxBytes = options.targetMaxKb > 0 ? options.targetMaxKb * 1024 : 0;
  if (targetMaxBytes > 0 && encoded.bytes > targetMaxBytes) {
    const qualitySteps = [
      Math.max(55, currentQuality - 10),
      Math.max(50, currentQuality - 20),
      50,
    ].filter((q, idx, arr) => q < currentQuality && arr.indexOf(q) === idx);

    for (const stepQuality of qualitySteps) {
      const candidate = await encodeSharpPipeline({
        sharp,
        inputBuffer,
        metadata,
        targetFormat,
        maxWidth: options.maxWidth,
        maxHeight: options.maxHeight,
        quality: stepQuality,
      });
      if (candidate.bytes < encoded.bytes) {
        encoded = candidate;
        currentQuality = stepQuality;
      }
      if (encoded.bytes <= targetMaxBytes) {
        break;
      }
    }
  }

  const resized = encoded.width < originalWidth || encoded.height < originalHeight;
  const normalizedOriginal = originalFormat === "jpg" ? "jpeg" : originalFormat;
  const formatChanged = targetFormat !== normalizedOriginal;
  const savedBytes = Math.max(0, originalBytes - encoded.bytes);
  const { mimeType, extension } = formatToMimeAndExt(targetFormat);

  // Zero-bloat guarantee: never upload a larger re-encoded asset when no savings were achieved.
  if (encoded.bytes >= originalBytes) {
    return {
      skipped: true,
      reason: "Already optimal — re-encoding did not reduce byte size.",
      buffer: inputBuffer,
      mimeType,
      extension,
      format: normalizedOriginal,
      originalFormat,
      originalBytes,
      compressedBytes: originalBytes,
      savedBytes: 0,
      savedPercent: 0,
      originalWidth,
      originalHeight,
      width: originalWidth,
      height: originalHeight,
      resized: false,
      formatChanged: false,
      qualityUsed: currentQuality,
      options,
    };
  }

  const savedPercent = originalBytes > 0 ? Math.round((savedBytes / originalBytes) * 1000) / 10 : 0;

  return {
    skipped: false,
    reason: "",
    buffer: encoded.buffer,
    mimeType,
    extension,
    format: targetFormat,
    originalFormat,
    originalBytes,
    compressedBytes: encoded.bytes,
    savedBytes,
    savedPercent,
    originalWidth,
    originalHeight,
    width: encoded.width,
    height: encoded.height,
    resized,
    formatChanged,
    qualityUsed: currentQuality,
    options,
  };
}

