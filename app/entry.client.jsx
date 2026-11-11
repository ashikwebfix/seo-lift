import { startTransition, StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";
import { HydratedRouter } from "react-router/dom";

function normalizeDocumentRootBeforeHydration() {
  if (typeof document === "undefined" || !document.documentElement || !document.head) {
    return;
  }

  const root = document.documentElement;
  const head = document.head;
  const body = document.body;

  // Browser extensions or proxies sometimes inject nodes directly into <html> before <head>.
  // Relocate stray nodes out of <html> direct children so React claims <head> and <body> cleanly.
  for (const node of Array.from(root.childNodes)) {
    if (node === head || node === body) continue;
    if (node.nodeType === 8) continue;
    if (node.nodeType === 3 && !String(node.nodeValue || "").trim()) {
      root.removeChild(node);
      continue;
    }

    if (node.nodeType === 1) {
      const tag = node.nodeName.toLowerCase();
      if (tag === "style" || tag === "link" || tag === "meta" || tag === "script") {
        head.appendChild(node);
      } else if (body) {
        body.appendChild(node);
      } else {
        root.removeChild(node);
      }
    } else if (body) {
      body.appendChild(node);
    } else {
      root.removeChild(node);
    }
  }
}

normalizeDocumentRootBeforeHydration();

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <HydratedRouter />
    </StrictMode>,
  );
});

