import { useCallback, useEffect, useRef, useState } from "react";

const TOAST_EVENT = "ecomseo:toast";
const MAX_VISIBLE_TOASTS = 4;
const RECENT_DEDUP_MS = 1600;

let toastSequence = 0;
const recentToastMap = new Map();

const DEFAULT_TITLES = Object.freeze({
  error: "Error",
  warning: "Notice",
  success: "Success",
  info: "Notice",
});

const TONE_ICONS = Object.freeze({
  error: "!",
  warning: "▲",
  success: "✓",
  info: "i",
});

function compactText(raw, maxLength = 240) {
  const clean = String(raw || "").replace(/\s+/g, " ").trim();
  if (!clean) return "";
  if (clean.length <= maxLength) return clean;
  return `${clean.slice(0, maxLength - 3).trimEnd()}...`;
}

/**
 * Triggers a global non-blocking popup toast notification in the browser.
 * Safe to call inside client effects or event handlers (no-op during SSR).
 */
export function showToast({ title, message, tone = "info", duration } = {}) {
  if (typeof window === "undefined") return;

  const cleanMessage = compactText(message);
  if (!cleanMessage) return;

  const normalizedTone = ["error", "warning", "success", "info"].includes(tone) ? tone : "info";
  const dedupKey = `${normalizedTone}::${cleanMessage}`;
  const now = Date.now();
  const prevAt = recentToastMap.get(dedupKey);
  if (prevAt && now - prevAt < RECENT_DEDUP_MS) {
    return;
  }
  recentToastMap.set(dedupKey, now);

  // Prune old dedup entries so map stays tiny over long sessions
  if (recentToastMap.size > 40) {
    for (const [key, ts] of recentToastMap.entries()) {
      if (now - ts > RECENT_DEDUP_MS * 3) recentToastMap.delete(key);
    }
  }

  window.dispatchEvent(
    new CustomEvent(TOAST_EVENT, {
      detail: {
        title: compactText(title, 60) || DEFAULT_TITLES[normalizedTone],
        message: cleanMessage,
        tone: normalizedTone,
        duration:
          typeof duration === "number"
            ? duration
            : normalizedTone === "error" || normalizedTone === "warning"
              ? 7000
              : 5000,
      },
    }),
  );
}

function classifyBannerElement(el) {
  if (!el || typeof el.matches !== "function") return null;
  if (el.closest(".seo-toast-viewport")) return null;
  if (el.matches("[data-no-toast='true']") || el.closest("[data-no-toast='true']")) return null;

  const customTone = el.getAttribute("data-toast");
  let tone = null;
  if (customTone && ["error", "warning", "success", "info"].includes(customTone)) {
    tone = customTone;
  } else if (
    el.classList.contains("error-box") ||
    el.classList.contains("banner-bad") ||
    (el.classList.contains("sa-alert") && el.classList.contains("error"))
  ) {
    tone = "error";
  } else if (el.classList.contains("banner-warn")) {
    tone = "warning";
  } else if (
    el.classList.contains("banner-good") ||
    (el.classList.contains("sa-alert") && el.classList.contains("success"))
  ) {
    tone = "success";
  } else if (el.classList.contains("status-banner") || el.classList.contains("sa-alert")) {
    tone = "info";
  }

  if (!tone) return null;

  const text = compactText(el.textContent);
  if (!text) return null;

  return {
    tone,
    title: el.getAttribute("data-toast-title") || DEFAULT_TITLES[tone],
    message: text,
  };
}

export function SeoToastViewport() {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef(new Map());
  const seenNodesRef = useRef(new WeakMap());

  const dismissToast = useCallback((id) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const scheduleDismiss = useCallback(
    (id, duration) => {
      const existing = timersRef.current.get(id);
      if (existing) clearTimeout(existing);
      const timer = setTimeout(() => {
        timersRef.current.delete(id);
        setToasts((prev) => prev.filter((item) => item.id !== id));
      }, duration);
      timersRef.current.set(id, timer);
    },
    [],
  );

  const pauseDismiss = useCallback((id) => {
    const existing = timersRef.current.get(id);
    if (existing) {
      clearTimeout(existing);
      timersRef.current.delete(id);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    function handleToastEvent(event) {
      const detail = event?.detail || {};
      const id = `toast-${++toastSequence}`;
      const duration = detail.duration || 5000;

      setToasts((prev) => {
        const next = [
          ...prev,
          {
            id,
            title: detail.title || DEFAULT_TITLES.info,
            message: detail.message || "",
            tone: detail.tone || "info",
            duration,
          },
        ];
        if (next.length > MAX_VISIBLE_TOASTS) {
          const evicted = next.slice(0, next.length - MAX_VISIBLE_TOASTS);
          for (const old of evicted) {
            const t = timersRef.current.get(old.id);
            if (t) {
              clearTimeout(t);
              timersRef.current.delete(old.id);
            }
          }
          return next.slice(-MAX_VISIBLE_TOASTS);
        }
        return next;
      });

      scheduleDismiss(id, duration);
    }

    window.addEventListener(TOAST_EVENT, handleToastEvent);
    const activeTimers = timersRef.current;

    const BANNER_SELECTOR = ".error-box, .status-banner, .sa-alert, [data-toast]";

    function inspectElement(node) {
      const info = classifyBannerElement(node);
      if (!info) return;
      const lastSeenText = seenNodesRef.current.get(node);
      if (lastSeenText === info.message) return;
      seenNodesRef.current.set(node, info.message);
      showToast(info);
    }

    function scanTree(root) {
      if (!root || root.nodeType !== 1) return;
      if (root.matches?.(BANNER_SELECTOR)) inspectElement(root);
      const nested = root.querySelectorAll?.(BANNER_SELECTOR);
      if (nested?.length) {
        nested.forEach((el) => inspectElement(el));
      }
    }

    // Observe initial banners and future dynamic error/notice banners anywhere in the app
    scanTree(document.body);

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "childList") {
          mutation.addedNodes.forEach((added) => scanTree(added));
          if (mutation.target?.nodeType === 1) {
            const ownerBanner = mutation.target.closest?.(BANNER_SELECTOR);
            if (ownerBanner) inspectElement(ownerBanner);
          }
        } else if (mutation.type === "characterData" && mutation.target?.parentElement) {
          const ownerBanner = mutation.target.parentElement.closest?.(BANNER_SELECTOR);
          if (ownerBanner) inspectElement(ownerBanner);
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => {
      window.removeEventListener(TOAST_EVENT, handleToastEvent);
      observer.disconnect();
      for (const timer of activeTimers.values()) clearTimeout(timer);
      activeTimers.clear();
    };
  }, [scheduleDismiss]);

  if (!toasts.length) return null;

  return (
    <div className="seo-toast-viewport" aria-live="polite" aria-label="Notifications">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`seo-toast seo-toast-${toast.tone}`}
          role={toast.tone === "error" ? "alert" : "status"}
          onMouseEnter={() => pauseDismiss(toast.id)}
          onMouseLeave={() => scheduleDismiss(toast.id, Math.min(3500, toast.duration))}
        >
          <span className="seo-toast-icon" aria-hidden="true">
            {TONE_ICONS[toast.tone] || "i"}
          </span>
          <div className="seo-toast-body">
            <strong className="seo-toast-title">{toast.title}</strong>
            <p className="seo-toast-message">{toast.message}</p>
          </div>
          <button
            type="button"
            className="seo-toast-close"
            onClick={() => dismissToast(toast.id)}
            aria-label="Dismiss notification"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
