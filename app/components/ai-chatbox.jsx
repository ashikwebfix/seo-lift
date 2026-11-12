/* eslint-disable react/prop-types */
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Link, useFetcher, useNavigate, useRevalidator } from "react-router";
import { CREDIT_COSTS, estimateChatActionTokens } from "../utils/credits";
import { dispatchCreditsUpdate } from "./seo-ui";
import { showToast } from "./toast-viewport";

const STARTER_PROMPTS = [
  "Audit my store and fix my biggest critical SEO issues now",
  "Update SEO, meta tags, and URL handles on my top broken products",
  "Compress oversized product images for faster PageSpeed LCP",
  "Fix missing image ALT tags, robots.txt, and rebuild my sitemap",
];

const QUICK_FAST_COMMANDS = [
  {
    id: "quick-scan",
    icon: "🔍",
    label: "Full SEO Scan",
    hint: "Scan catalog & refresh score",
    type: "RUN_FULL_SCAN",
    params: {},
  },
  {
    id: "quick-autofix",
    icon: "✨",
    label: "AI Fix Top 3 Products",
    hint: `${CREDIT_COSTS.product_seo_fix} tok/product · Title & Meta`,
    type: "AUTO_FIX_PRODUCTS",
    params: { maxProducts: 3 },
  },
  {
    id: "quick-description",
    icon: "📝",
    label: "AI Fix Descriptions",
    hint: `${CREDIT_COSTS.product_content_fix} tok/product · Rich HTML`,
    type: "FIX_PRODUCT_DESCRIPTION",
    params: { maxProducts: 2, goal: "expand" },
  },
  {
    id: "quick-alt",
    icon: "🏷️",
    label: "Fix Missing ALT",
    hint: "Free pattern SEO ALT update",
    type: "FIX_IMAGE_ALT",
    params: { maxImages: 10 },
  },
  {
    id: "quick-compress",
    icon: "🗜️",
    label: "Compress Heavy Images",
    hint: `${CREDIT_COSTS.image_compression} tok/compressed img (Sharp)`,
    type: "COMPRESS_HEAVY_IMAGES",
    params: { maxImages: 8 },
  },
  {
    id: "quick-ps-mobile",
    icon: "📱",
    label: "Mobile Speed Test",
    hint: "Live PageSpeed + LCP",
    type: "RUN_PAGESPEED_TEST",
    params: { strategy: "mobile" },
  },
  {
    id: "quick-ps-desktop",
    icon: "💻",
    label: "Desktop Speed Test",
    hint: "Live desktop diagnostics",
    type: "RUN_PAGESPEED_TEST",
    params: { strategy: "desktop" },
  },
  {
    id: "quick-robots",
    icon: "🤖",
    label: "Best-Practice Robots.txt",
    hint: "Disallow /cart & /search",
    type: "FIX_ROBOTS_TXT",
    params: { useAi: false },
  },
  {
    id: "quick-sitemap",
    icon: "🗺️",
    label: "Rebuild Sitemap",
    hint: "Sync active URLs",
    type: "REGENERATE_SITEMAP",
    params: {},
  },
  {
    id: "quick-rollback",
    icon: "↩️",
    label: "Undo Last Edit",
    hint: "Rollback latest product revision",
    type: "ROLLBACK_REVISION",
    params: {},
  },
];

function actionIcon(type) {
  switch (type) {
    case "RUN_FULL_SCAN":
      return "🔍";
    case "AUTO_FIX_PRODUCTS":
      return "✨";
    case "FIX_PRODUCT_DESCRIPTION":
    case "UPDATE_SPECIFIC_PRODUCT":
      return "📝";
    case "FIX_IMAGE_ALT":
      return "🏷️";
    case "COMPRESS_HEAVY_IMAGES":
      return "🗜️";
    case "FIX_ROBOTS_TXT":
      return "🤖";
    case "REGENERATE_SITEMAP":
      return "🗺️";
    case "RUN_PAGESPEED_TEST":
      return "⚡";
    case "TOGGLE_AUTOPILOT":
      return "🚀";
    case "ROLLBACK_REVISION":
      return "↩️";
    case "OPEN_ROUTE":
      return "↗";
    default:
      return "⚡";
  }
}

function formatActionCost(action, superAccess, selectedProduct = null) {
  if (!action) return "";
  const estimate = estimateChatActionTokens(action, { superAccess, selectedProduct });
  if (estimate.standardTotal > 0 || action.type === "COMPRESS_HEAVY_IMAGES" || action.type === "AUTO_FIX_PRODUCTS" || action.type === "FIX_PRODUCT_DESCRIPTION") {
    return estimate.badgeLabel;
  }
  return action.costLabel || estimate.badgeLabel || "";
}

function renderLines(text) {
  const parts = String(text || "").split(/\r?\n/);
  return parts.map((line, index) => (
    <span key={`${index}-${line.slice(0, 12)}`}>
      {line}
      {index < parts.length - 1 ? <br /> : null}
    </span>
  ));
}

function formatScoreDelta(report) {
  if (!report || report.afterScore == null) return null;
  if (report.beforeScore == null) {
    return { text: `SEO ${report.afterScore}/100`, tone: "good" };
  }
  const delta = Number(report.scoreDelta || 0);
  if (delta > 0) {
    return { text: `SEO ${report.beforeScore} → ${report.afterScore} (+${delta})`, tone: "good" };
  }
  if (delta < 0) {
    return { text: `SEO ${report.beforeScore} → ${report.afterScore} (${delta})`, tone: "warn" };
  }
  return { text: `SEO ${report.afterScore}/100 (Live)`, tone: "neutral" };
}

export function AiChatPanel({
  mode = "drawer",
  open = true,
  initialHistory = [],
  initialSnapshot = null,
  initialCatalogProducts = [],
  aiReady = true,
  aiUnavailableReason = "",
  creditAccount = {},
  onClose = null,
  isDrawerExpanded = false,
  onToggleDrawerExpand = null,
}) {
  const chatFetcher = useFetcher();
  const execFetcher = useFetcher();
  const stateFetcher = useFetcher();
  const catalogFetcher = useFetcher();
  const navigate = useNavigate();
  const revalidator = useRevalidator();

  const headingId = useId();
  const inputId = useId();
  const hintId = useId();
  const autoRunId = useId();
  const productSearchId = useId();
  const productSelectId = useId();
  const presetSelectId = useId();
  const editTitleId = useId();
  const editKeywordId = useId();
  const editHandleId = useId();
  const editMetaTitleId = useId();
  const editMetaDescId = useId();

  const [messages, setMessages] = useState(() =>
    Array.isArray(initialHistory) ? initialHistory : [],
  );
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [catalogProducts, setCatalogProducts] = useState(() =>
    Array.isArray(initialCatalogProducts) ? initialCatalogProducts : [],
  );
  const [selectedProductId, setSelectedProductId] = useState("");
  const [productQuery, setProductQuery] = useState("");
  const [compressionPreset, setCompressionPreset] = useState("balanced");
  const [showQuickSidebar, setShowQuickSidebar] = useState(true);
  const [showDrawerQuickBar, setShowDrawerQuickBar] = useState(true);
  const [showCustomEdit, setShowCustomEdit] = useState(false);

  const [editFields, setEditFields] = useState({
    title: "",
    focusKeyword: "",
    handle: "",
    metaTitle: "",
    metaDescription: "",
  });

  const [draft, setDraft] = useState("");
  const [autoExecute, setAutoExecute] = useState(false);
  const [executingAction, setExecutingAction] = useState(null);
  const [pendingConfirmAction, setPendingConfirmAction] = useState(null);
  const [pendingUserPrompt, setPendingUserPrompt] = useState("");
  const [liveStatus, setLiveStatus] = useState("");
  const [liveCredits, setLiveCredits] = useState(() => ({
    availableCredits: Number(creditAccount?.availableCredits ?? 0),
    superAccess: Boolean(creditAccount?.superAccess),
  }));

  useEffect(() => {
    setLiveCredits((prev) => ({
      availableCredits:
        typeof creditAccount?.availableCredits === "number"
          ? creditAccount.availableCredits
          : prev.availableCredits,
      superAccess:
        creditAccount?.superAccess !== undefined
          ? Boolean(creditAccount.superAccess)
          : prev.superAccess,
    }));
  }, [creditAccount?.availableCredits, creditAccount?.superAccess]);

  const messagesContainerRef = useRef(null);
  const textareaRef = useRef(null);
  const handledChatRef = useRef(null);
  const handledExecRef = useRef(null);
  const handledStateRef = useRef(null);
  const handledCatalogRef = useRef(null);
  const hasSyncedOpenRef = useRef(false);

  const superAccess = Boolean(liveCredits.superAccess || creditAccount?.superAccess);
  const availableTokens = Number(liveCredits.availableCredits ?? 0);
  const isSending = chatFetcher.state !== "idle";
  const isExecuting = execFetcher.state !== "idle";
  const isSearchingCatalog = catalogFetcher.state !== "idle";

  const selectedProduct = useMemo(
    () => catalogProducts.find((p) => String(p.id) === String(selectedProductId)) || null,
    [catalogProducts, selectedProductId],
  );

  useEffect(() => {
    if (Array.isArray(initialHistory) && initialHistory.length > 0 && messages.length === 0) {
      setMessages(initialHistory);
    }
  }, [initialHistory]);

  useEffect(() => {
    if (initialSnapshot && !snapshot) {
      setSnapshot(initialSnapshot);
    }
  }, [initialSnapshot]);

  useEffect(() => {
    if (Array.isArray(initialCatalogProducts) && initialCatalogProducts.length > 0 && catalogProducts.length === 0) {
      setCatalogProducts(initialCatalogProducts);
    }
  }, [initialCatalogProducts]);

  // Populate inline Quick Product Editor when selected product changes
  useEffect(() => {
    if (!selectedProduct) {
      setShowCustomEdit(false);
      return;
    }
    setEditFields({
      title: selectedProduct.title || "",
      focusKeyword: selectedProduct.focusKeyword || "",
      handle: selectedProduct.handle || "",
      metaTitle: selectedProduct.metaTitle || "",
      metaDescription: selectedProduct.metaDescription || "",
    });
  }, [selectedProduct?.id, selectedProduct?.metaTitle, selectedProduct?.handle, selectedProduct?.focusKeyword]);

  // Refresh chat history + store snapshot + live catalog when drawer opens
  useEffect(() => {
    if (!open) {
      hasSyncedOpenRef.current = false;
      return;
    }
    if (mode === "drawer") {
      textareaRef.current?.focus();
    }
    if (!hasSyncedOpenRef.current && stateFetcher.state === "idle") {
      hasSyncedOpenRef.current = true;
      stateFetcher.submit(
        { payload: JSON.stringify({ actionType: "get_ai_chat_state" }) },
        { method: "post", action: "/app/api/ai" },
      );
    }
  }, [open, mode]);

  useEffect(() => {
    const data = stateFetcher.data;
    if (!data || stateFetcher.state !== "idle" || data === handledStateRef.current) return;
    handledStateRef.current = data;

    if (data.ok && data.actionType === "get_ai_chat_state") {
      if (Array.isArray(data.aiChatHistory)) setMessages(data.aiChatHistory);
      if (data.storeSnapshot) setSnapshot(data.storeSnapshot);
      if (Array.isArray(data.catalogProducts)) setCatalogProducts(data.catalogProducts);
      setLiveCredits((prev) => ({
        availableCredits:
          typeof data.creditsRemaining === "number" ? data.creditsRemaining : prev.availableCredits,
        superAccess:
          data.superAccess !== undefined ? Boolean(data.superAccess) : prev.superAccess,
      }));
      dispatchCreditsUpdate({
        availableCredits: data.creditsRemaining,
        totalCredits: data.totalCredits,
        plan: data.plan,
        superAccess: data.superAccess,
      });
    } else if (data.ok && data.actionType === "clear_ai_chat_history") {
      setMessages([]);
      setLiveStatus("Conversation cleared.");
    }
  }, [stateFetcher.data, stateFetcher.state]);

  useEffect(() => {
    const data = catalogFetcher.data;
    if (!data || catalogFetcher.state !== "idle" || data === handledCatalogRef.current) return;
    handledCatalogRef.current = data;
    if (data.ok && Array.isArray(data.catalogProducts)) {
      setCatalogProducts(data.catalogProducts);
      if (data.catalogProducts.length > 0 && !data.catalogProducts.some((p) => String(p.id) === String(selectedProductId))) {
        setSelectedProductId("");
      }
    }
  }, [catalogFetcher.data, catalogFetcher.state]);

  // Handle chat reply response
  useEffect(() => {
    const data = chatFetcher.data;
    if (!data || chatFetcher.state !== "idle" || data === handledChatRef.current) return;
    handledChatRef.current = data;
    setPendingUserPrompt("");

    if (!data.ok) {
      showToast({
        tone: "error",
        title: "AI Mode Error",
        message: data.error || "Unable to get a response from AI Mode.",
      });
      setLiveStatus(data.error || "AI request failed.");
      return;
    }

    const result = data.result || {};
    if (Array.isArray(result.aiChatHistory)) {
      setMessages(result.aiChatHistory);
    }
    if (result.storeSnapshot) {
      setSnapshot(result.storeSnapshot);
    }

    setLiveCredits((prev) => ({
      availableCredits:
        typeof data.creditsRemaining === "number" ? data.creditsRemaining : prev.availableCredits,
      superAccess:
        data.superAccess !== undefined ? Boolean(data.superAccess) : prev.superAccess,
    }));

    dispatchCreditsUpdate({
      availableCredits: data.creditsRemaining,
      totalCredits: data.totalCredits,
      plan: data.plan,
      superAccess: data.superAccess,
    });

    setLiveStatus("AI Mode responded.");

    if (autoExecute && result.autoRunActionId && Array.isArray(result.suggestedActions)) {
      const targetAction = result.suggestedActions.find(
        (act) => act.id === result.autoRunActionId && act.type !== "OPEN_ROUTE",
      );
      const lastMsg = Array.isArray(result.aiChatHistory)
        ? result.aiChatHistory[result.aiChatHistory.length - 1]
        : null;
      if (targetAction && execFetcher.state === "idle") {
        const autoEst = estimateChatActionTokens(targetAction, {
          superAccess,
          selectedProduct,
        });
        runAction(targetAction, lastMsg?.id || "", { skipConfirm: !autoEst.isBulk });
      }
    }
  }, [chatFetcher.data, chatFetcher.state, autoExecute]);

  // Handle executed store fix response
  useEffect(() => {
    const data = execFetcher.data;
    if (!data || execFetcher.state !== "idle" || data === handledExecRef.current) return;
    handledExecRef.current = data;
    setExecutingAction(null);
    setPendingConfirmAction(null);

    if (Array.isArray(data.aiChatHistory)) {
      setMessages(data.aiChatHistory);
    }
    if (data.storeSnapshot) {
      setSnapshot(data.storeSnapshot);
    }
    if (Array.isArray(data.catalogProducts)) {
      setCatalogProducts(data.catalogProducts);
    }

    setLiveCredits((prev) => ({
      availableCredits:
        typeof data.creditsRemaining === "number" ? data.creditsRemaining : prev.availableCredits,
      superAccess:
        data.superAccess !== undefined ? Boolean(data.superAccess) : prev.superAccess,
    }));

    dispatchCreditsUpdate({
      availableCredits: data.creditsRemaining,
      totalCredits: data.totalCredits,
      plan: data.plan,
      superAccess: data.superAccess,
    });

    const exec = data.execution || {};
    if (data.ok) {
      setShowCustomEdit(false);
      setLiveStatus(exec.summary || "Live store update complete.");
      showToast({
        tone: "success",
        title: exec.title || "Live Store Update Applied",
        message: exec.summary || "Updated your Shopify store SEO configuration.",
      });
      if (exec.navigateTo) {
        if (mode === "drawer" && typeof onClose === "function") {
          onClose();
        }
        navigate(exec.navigateTo);
      } else {
        revalidator.revalidate();
      }
    } else {
      setLiveStatus(data.error || exec.error || "Fix failed.");
      showToast({
        tone: "error",
        title: exec.title || "Update Could Not Complete",
        message: data.error || exec.error || "Please try again.",
      });
    }
  }, [execFetcher.data, execFetcher.state]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) {
      container.scrollTop = container.scrollHeight;
    } else {
      container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
    }
  }, [messages.length, pendingUserPrompt, isExecuting]);

  const latestAssistantIndex = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i]?.role === "assistant") return i;
    }
    return -1;
  }, [messages]);

  function sendPrompt(text) {
    const clean = String(text || "").trim();
    if (!clean || isSending || isExecuting || !aiReady) return;
    setDraft("");
    setPendingUserPrompt(clean);
    setLiveStatus("");
    chatFetcher.submit(
      {
        payload: JSON.stringify({
          actionType: "ai_chat",
          message: clean,
          autoExecute,
          selectedProduct: selectedProduct || null,
        }),
      },
      { method: "post", action: "/app/api/ai" },
    );
  }

  function runAction(action, messageId = "", { skipConfirm = false } = {}) {
    if (!action || isExecuting || isSending) return;
    if (action.type === "OPEN_ROUTE" && action.params?.route) {
      if (mode === "drawer" && typeof onClose === "function") {
        onClose();
      }
      navigate(action.params.route);
      return;
    }

    const estimate = estimateChatActionTokens(action, {
      superAccess,
      selectedProduct,
    });

    if (!skipConfirm && estimate.estimatedTokens > 0) {
      setPendingConfirmAction({ action, messageId, estimate });
      return;
    }

    setPendingConfirmAction(null);
    setExecutingAction({
      id: action.id,
      label: action.label || action.type,
      estimatedTokens: estimate.estimatedTokens,
      badgeLabel: estimate.standardTotal > 0 ? estimate.badgeLabel : "",
    });
    execFetcher.submit(
      {
        payload: JSON.stringify({
          actionType: "ai_chat_execute",
          action,
          messageId,
        }),
      },
      { method: "post", action: "/app/api/ai" },
    );
  }

  function runQuickCommand(cmd) {
    if (!cmd || isExecuting || isSending) return;
    const baseParams = { ...(cmd.params || {}) };
    if (cmd.type === "COMPRESS_HEAVY_IMAGES") {
      baseParams.preset = compressionPreset;
      if (selectedProduct) baseParams.productIds = [String(selectedProduct.id)];
    } else if (
      (cmd.type === "AUTO_FIX_PRODUCTS" || cmd.type === "FIX_PRODUCT_DESCRIPTION") &&
      selectedProduct
    ) {
      baseParams.maxProducts = 1;
      baseParams.productIds = [String(selectedProduct.id)];
    } else if (cmd.type === "FIX_IMAGE_ALT" && selectedProduct) {
      baseParams.productIds = [String(selectedProduct.id)];
    }

    const isProductScoped =
      selectedProduct &&
      (cmd.type === "AUTO_FIX_PRODUCTS" ||
        cmd.type === "FIX_PRODUCT_DESCRIPTION" ||
        cmd.type === "FIX_IMAGE_ALT" ||
        cmd.type === "COMPRESS_HEAVY_IMAGES");

    runAction({
      id: `quick-${cmd.id}-${Date.now()}`,
      type: cmd.type,
      label: isProductScoped ? `${cmd.label} (${selectedProduct.title})` : cmd.label,
      params: baseParams,
    });
  }

  function handleSaveCustomProductEdit(event) {
    event.preventDefault();
    if (!selectedProduct || isExecuting || isSending) return;
    runAction({
      id: `custom-edit-${selectedProduct.id}-${Date.now()}`,
      type: "UPDATE_SPECIFIC_PRODUCT",
      label: `Update "${selectedProduct.title}"`,
      params: {
        productId: String(selectedProduct.id),
        title: editFields.title,
        focusKeyword: editFields.focusKeyword,
        handle: editFields.handle,
        metaTitle: editFields.metaTitle,
        metaDescription: editFields.metaDescription,
      },
    });
  }

  function handleCatalogSearch(event) {
    event.preventDefault();
    if (isSearchingCatalog) return;
    catalogFetcher.submit(
      {
        payload: JSON.stringify({
          actionType: "ai_chat_catalog",
          query: productQuery.trim(),
        }),
      },
      { method: "post", action: "/app/api/ai" },
    );
  }

  function clearHistory() {
    if (isSending || isExecuting || stateFetcher.state !== "idle") return;
    setPendingConfirmAction(null);
    stateFetcher.submit(
      { payload: JSON.stringify({ actionType: "clear_ai_chat_history" }) },
      { method: "post", action: "/app/api/ai" },
    );
  }

  function handleFormSubmit(event) {
    event.preventDefault();
    sendPrompt(draft);
  }

  function handleKeyDown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendPrompt(draft);
    }
  }

  const scan = snapshot?.scan || null;
  const pageSpeed = snapshot?.pageSpeed || null;
  const autopilotEnabled = Boolean(snapshot?.autopilot?.enabled);

  function renderQuickControlContent() {
    return (
      <div className="ai-quick-panel-inner">
        <section className="ai-qp-block">
          <div className="ai-qp-heading-row">
            <h3 className="ai-qp-heading">🎯 Target Product or Entire Store</h3>
            {selectedProduct ? (
              <button
                type="button"
                className="seo-button ghost"
                style={{ padding: "2px 7px", fontSize: "11px" }}
                onClick={() => setSelectedProductId("")}
              >
                Reset to Store-Wide
              </button>
            ) : null}
          </div>

          <form className="ai-catalog-search-form" onSubmit={handleCatalogSearch}>
            <label htmlFor={productSearchId} className="visually-hidden">
              Search Shopify products
            </label>
            <input
              id={productSearchId}
              type="search"
              className="ai-qp-input"
              placeholder="Search Shopify product title..."
              value={productQuery}
              onChange={(e) => setProductQuery(e.target.value)}
            />
            <button
              type="submit"
              className="seo-button secondary ai-qp-search-btn"
              disabled={isSearchingCatalog}
            >
              {isSearchingCatalog ? "..." : "Find"}
            </button>
          </form>

          <label htmlFor={productSelectId} className="ai-qp-label">
            Active Optimization Target
          </label>
          <select
            id={productSelectId}
            className="ai-qp-select"
            value={selectedProductId}
            onChange={(e) => setSelectedProductId(e.target.value)}
          >
            <option value="">All Store / Priority Products ({catalogProducts.length} loaded)</option>
            {catalogProducts.map((product) => (
              <option key={product.id} value={String(product.id)}>
                {product.title || product.handle}
                {product.seoScore != null ? ` · SEO ${product.seoScore}%` : ""}
                {product.issueCount > 0 ? ` (${product.issueCount} issues)` : ""}
              </option>
            ))}
          </select>

          {selectedProduct ? (
            <div className="ai-selected-product-card">
              <div className="ai-selected-product-top">
                <strong className="ai-selected-title">{selectedProduct.title}</strong>
                {selectedProduct.seoScore != null ? (
                  <span
                    className={`ai-telemetry-chip ${
                      selectedProduct.seoScore >= 80 ? "good" : "warn"
                    }`}
                  >
                    {selectedProduct.seoScore}%
                  </span>
                ) : null}
              </div>
              <div className="ai-selected-meta-line">
                <span>/{selectedProduct.handle}</span>
                {selectedProduct.focusKeyword ? (
                  <span>· Key: <strong>{selectedProduct.focusKeyword}</strong></span>
                ) : (
                  <span>· No focus keyword</span>
                )}
              </div>

              <div className="ai-selected-actions-grid">
                <button
                  type="button"
                  className="seo-button ai-qp-mini-btn"
                  disabled={isExecuting || isSending || !aiReady}
                  onClick={() =>
                    runAction({
                      id: `target-seo-${selectedProduct.id}-${Date.now()}`,
                      type: "AUTO_FIX_PRODUCTS",
                      label: `AI Auto-Fix ${selectedProduct.title}`,
                      params: { maxProducts: 1, productIds: [String(selectedProduct.id)] },
                    })
                  }
                >
                  ✨ AI Title &amp; Meta ({superAccess ? "0" : CREDIT_COSTS.product_seo_fix} tok)
                </button>
                <button
                  type="button"
                  className="seo-button secondary ai-qp-mini-btn"
                  disabled={isExecuting || isSending || !aiReady}
                  onClick={() =>
                    runAction({
                      id: `target-desc-${selectedProduct.id}-${Date.now()}`,
                      type: "FIX_PRODUCT_DESCRIPTION",
                      label: `AI Fix Description: ${selectedProduct.title}`,
                      params: {
                        maxProducts: 1,
                        goal: "expand",
                        productIds: [String(selectedProduct.id)],
                      },
                    })
                  }
                >
                  📝 AI Description ({superAccess ? "0" : CREDIT_COSTS.product_content_fix} tok)
                </button>
                <button
                  type="button"
                  className="seo-button secondary ai-qp-mini-btn"
                  disabled={isExecuting || isSending}
                  onClick={() => setShowCustomEdit((prev) => !prev)}
                >
                  {showCustomEdit ? "Hide Custom Edit" : "✏️ Edit Title / Meta"}
                </button>
                <button
                  type="button"
                  className="seo-button secondary ai-qp-mini-btn"
                  disabled={isExecuting || isSending}
                  onClick={() =>
                    runAction({
                      id: `target-alt-${selectedProduct.id}-${Date.now()}`,
                      type: "FIX_IMAGE_ALT",
                      label: `Fix ALT: ${selectedProduct.title}`,
                      params: { maxImages: 10, productIds: [String(selectedProduct.id)] },
                    })
                  }
                >
                  🏷️ Fix Product ALT
                </button>
                <button
                  type="button"
                  className="seo-button secondary ai-qp-mini-btn"
                  disabled={isExecuting || isSending}
                  onClick={() =>
                    runAction({
                      id: `target-comp-${selectedProduct.id}-${Date.now()}`,
                      type: "COMPRESS_HEAVY_IMAGES",
                      label: `Compress: ${selectedProduct.title}`,
                      params: {
                        preset: compressionPreset,
                        maxImages: 8,
                        productIds: [String(selectedProduct.id)],
                      },
                    })
                  }
                >
                  🗜️ Compress ({superAccess ? "0" : `${CREDIT_COSTS.image_compression}/img`})
                </button>
              </div>

              {showCustomEdit ? (
                <form className="ai-custom-edit-form" onSubmit={handleSaveCustomProductEdit}>
                  <label htmlFor={editTitleId} className="ai-qp-label">
                    Product Title
                  </label>
                  <input
                    id={editTitleId}
                    type="text"
                    className="ai-qp-input"
                    value={editFields.title}
                    onChange={(e) => setEditFields((f) => ({ ...f, title: e.target.value }))}
                  />

                  <label htmlFor={editKeywordId} className="ai-qp-label">
                    Focus Keyword
                  </label>
                  <input
                    id={editKeywordId}
                    type="text"
                    className="ai-qp-input"
                    placeholder="e.g. waterproof hiking jacket"
                    value={editFields.focusKeyword}
                    onChange={(e) => setEditFields((f) => ({ ...f, focusKeyword: e.target.value }))}
                  />

                  <label htmlFor={editHandleId} className="ai-qp-label">
                    URL Handle
                  </label>
                  <input
                    id={editHandleId}
                    type="text"
                    className="ai-qp-input"
                    value={editFields.handle}
                    onChange={(e) => setEditFields((f) => ({ ...f, handle: e.target.value }))}
                  />

                  <label htmlFor={editMetaTitleId} className="ai-qp-label">
                    Meta Title ({editFields.metaTitle.length}/60)
                  </label>
                  <input
                    id={editMetaTitleId}
                    type="text"
                    className="ai-qp-input"
                    value={editFields.metaTitle}
                    onChange={(e) => setEditFields((f) => ({ ...f, metaTitle: e.target.value }))}
                  />

                  <label htmlFor={editMetaDescId} className="ai-qp-label">
                    Meta Description ({editFields.metaDescription.length}/160)
                  </label>
                  <textarea
                    id={editMetaDescId}
                    className="ai-qp-input"
                    rows={2}
                    value={editFields.metaDescription}
                    onChange={(e) =>
                      setEditFields((f) => ({ ...f, metaDescription: e.target.value }))
                    }
                  />

                  <button
                    type="submit"
                    className="seo-button"
                    style={{ width: "100%", marginTop: "4px" }}
                    disabled={isExecuting || isSending}
                  >
                    {isExecuting ? "Saving to Shopify..." : "Save Live to Shopify & Report"}
                  </button>
                </form>
              ) : null}
            </div>
          ) : null}
        </section>

        <section className="ai-qp-block">
          <div className="ai-qp-heading-row">
            <h3 className="ai-qp-heading">⚡ Fast One-Click Actions</h3>
            <span className="ai-qp-sub-note">Live Report in Chat</span>
          </div>

          <div className="ai-preset-row">
            <label htmlFor={presetSelectId} className="ai-qp-label" style={{ margin: 0 }}>
              Image Compression Preset
            </label>
            <select
              id={presetSelectId}
              className="ai-qp-select"
              value={compressionPreset}
              onChange={(e) => setCompressionPreset(e.target.value)}
            >
              <option value="balanced">Balanced (Recommended · High Quality)</option>
              <option value="lossless">Lossless Ultra-Sharp</option>
              <option value="high">High PageSpeed (Max Savings)</option>
            </select>
          </div>

          <div className="ai-fast-grid">
            {QUICK_FAST_COMMANDS.map((cmd) => {
              const est = estimateChatActionTokens(
                { type: cmd.type, params: cmd.params },
                { superAccess, selectedProduct },
              );
              const requiresAi =
                cmd.type === "AUTO_FIX_PRODUCTS" || cmd.type === "FIX_PRODUCT_DESCRIPTION";
              return (
                <button
                  key={cmd.id}
                  type="button"
                  className="ai-fast-action-btn"
                  disabled={isExecuting || isSending || (requiresAi && !aiReady)}
                  onClick={() => runQuickCommand(cmd)}
                  title={est.badgeLabel}
                >
                  <span className="ai-fast-icon" aria-hidden="true">{cmd.icon}</span>
                  <span className="ai-fast-text">
                    <strong>{cmd.label}</strong>
                    <small>{est.estimatedTokens > 0 ? `${est.badgeLabel}` : cmd.hint}</small>
                  </span>
                </button>
              );
            })}

            <button
              type="button"
              className="ai-fast-action-btn"
              disabled={isExecuting || isSending}
              onClick={() =>
                runAction({
                  id: `quick-autopilot-${Date.now()}`,
                  type: "TOGGLE_AUTOPILOT",
                  label: autopilotEnabled ? "Pause Autopilot" : "Enable Autopilot",
                  params: { enabled: !autopilotEnabled },
                })
              }
            >
              <span className="ai-fast-icon" aria-hidden="true">🚀</span>
              <span className="ai-fast-text">
                <strong>{autopilotEnabled ? "Pause Autopilot" : "Enable Autopilot"}</strong>
                <small>{autopilotEnabled ? "Currently ON for new products" : "Currently OFF"}</small>
              </span>
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className={`ai-chat-shell ${mode === "page" ? "ai-chat-shell-page" : "ai-chat-shell-drawer"}`}>
      <header className="ai-chat-header">
        <div className="ai-chat-title-row">
          <div className="ai-chat-brand">
            <span className="ai-chat-orb" aria-hidden="true">✨</span>
            <div>
              {mode === "page" ? (
                <h1 id={headingId} className="ai-chat-title">AI Mode</h1>
              ) : (
                <h2 id={headingId} className="ai-chat-title">AI Copilot</h2>
              )}
              <p className="ai-chat-subtitle">
                Pick a product or ask naturally — fix SEO, metadata, images, and PageSpeed with live reports
              </p>            </div>
          </div>

          <div className="ai-chat-header-controls">
            {mode === "page" ? (
              <button
                type="button"
                className="seo-button secondary ai-chat-icon-btn"
                onClick={() => setShowQuickSidebar((prev) => !prev)}
                aria-expanded={showQuickSidebar}
              >
                {showQuickSidebar ? "Hide Quick Panel" : "Show Quick Panel"}
              </button>
            ) : (
              <button
                type="button"
                className="seo-button secondary ai-chat-icon-btn"
                onClick={() => setShowDrawerQuickBar((prev) => !prev)}
                aria-expanded={showDrawerQuickBar}
              >
                {showDrawerQuickBar ? "Hide Quick Select" : "⚡ Quick Select"}
              </button>
            )}

            {mode === "drawer" && typeof onToggleDrawerExpand === "function" ? (
              <button
                type="button"
                className="seo-button secondary ai-chat-icon-btn"
                onClick={onToggleDrawerExpand}
                aria-pressed={isDrawerExpanded}
                title={isDrawerExpanded ? "Restore compact drawer width" : "Expand chatbox to full screen width"}
              >
                {isDrawerExpanded ? "⤡ Compact" : "⤢ Max Width"}
              </button>
            ) : null}

            {messages.length > 0 ? (
              <button
                type="button"
                className="seo-button ghost ai-chat-icon-btn"
                onClick={clearHistory}
                disabled={isSending || isExecuting}
                title="Clear conversation history"
              >
                Clear
              </button>
            ) : null}

            {mode === "drawer" ? (
              <Link
                to="/app/ai-mode"
                className="seo-button secondary ai-chat-icon-btn"
                onClick={() => typeof onClose === "function" && onClose()}
                title="Open full-page AI Mode workspace"
              >
                Full Page ↗
              </Link>
            ) : null}

            {mode === "drawer" && typeof onClose === "function" ? (
              <button
                type="button"
                className="seo-button secondary ai-chat-close-btn"
                onClick={onClose}
                aria-label="Close AI Mode chat"
              >
                ✕
              </button>
            ) : null}
          </div>
        </div>

        <div className="ai-chat-telemetry-bar">
          {scan ? (
            <span className={`ai-telemetry-chip ${scan.criticalCount > 0 ? "warn" : "good"}`}>
              SEO <strong>{scan.healthScore}/100</strong> · <strong>{scan.criticalCount}</strong> critical
            </span>
          ) : (
            <span className="ai-telemetry-chip">Not scanned</span>
          )}
          {pageSpeed?.mobileScore != null ? (
            <span className="ai-telemetry-chip">
              Mobile <strong>{pageSpeed.mobileScore}/100</strong>
            </span>
          ) : null}
          {selectedProduct ? (
            <span className="ai-telemetry-chip good">
              🎯 <strong>{selectedProduct.title}</strong>
            </span>
          ) : null}
          <span className={`ai-telemetry-chip ${autopilotEnabled ? "good" : ""}`}>
            Autopilot {autopilotEnabled ? "ON" : "OFF"}
          </span>
          <span className="ai-telemetry-chip">
            ⚡ <strong>{superAccess ? "∞ Super Access" : `${availableTokens.toLocaleString()} tok`}</strong>
          </span>
        </div>

        <div className="ai-chat-mode-bar">
          <label htmlFor={autoRunId} className="ai-autorun-toggle">
            <input
              id={autoRunId}
              type="checkbox"
              checked={autoExecute}
              onChange={(e) => setAutoExecute(e.target.checked)}
            />
            <span>Auto-apply fixes</span>
          </label>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <span className="ai-token-hint">
              {superAccess ? "Super Access" : `${CREDIT_COSTS.ai_chat} tok/msg`}
            </span>
            {mode === "page" ? (
              <a href="#token-calculator" className="ai-calc-jump-link">
                🧮 Calculator &amp; Pricing
              </a>
            ) : (
              <Link
                to="/app/ai-mode#token-calculator"
                className="ai-calc-jump-link"
                onClick={() => typeof onClose === "function" && onClose()}
              >
                🧮 Calculator
              </Link>
            )}
          </div>
        </div>
      </header>

      {!aiReady ? (
        <div className="ai-chat-banner-error">
          <strong>AI Chat Unavailable:</strong> {aiUnavailableReason || "Gemini AI is disabled or not configured in SuperAdmin."} (Deterministic Quick Actions still work below.)
        </div>
      ) : null}

      <div className={`ai-command-body ${mode === "page" && showQuickSidebar ? "with-sidebar" : "single-col"}`}>
        {mode === "page" && showQuickSidebar ? (
          <aside className="ai-quick-sidebar" aria-label="Quick target and fast SEO actions">
            {renderQuickControlContent()}
          </aside>
        ) : null}

        <div className="ai-chat-main-col">
          {mode === "drawer" && showDrawerQuickBar ? (
            <div className="ai-drawer-quick-bar">
              {renderQuickControlContent()}
            </div>
          ) : null}

          <div ref={messagesContainerRef} className="ai-chat-messages" role="log" aria-label="AI Mode conversation and live reports">
            {messages.length === 0 && !pendingUserPrompt ? (
              <div className="ai-chat-empty">
                <div className="ai-chat-empty-badge">✨ All-In-One Store Copilot</div>
                <h3>Tell me what to update, or pick a 1-click Fast Action</h3>
                <p className="seo-muted">
                  {scan
                    ? `Store Audit: ${scan.healthScore}/100 across ${scan.pagesScanned} pages (${scan.criticalCount} critical issues, ${scan.missingAltCount || 0} missing ALT). Select a product on the quick bar or type a command to update Shopify live and receive a Before → After report right here.`
                    : "Select any product, run a full SEO scan, fix titles/meta/handles, optimize images, or update robots.txt & sitemap—every change returns a live Before → After report directly in chat."}
                </p>
                <div className="ai-starter-grid">
                  {STARTER_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      className="ai-starter-chip"
                      disabled={!aiReady || isSending || isExecuting}
                      onClick={() => sendPrompt(prompt)}
                    >
                      <span>{prompt}</span>
                      <span aria-hidden="true">→</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {messages.map((msg, idx) => {
                  const isUser = msg.role === "user";
                  const isLatestAssistant = !isUser && idx === latestAssistantIndex;
                  const report = msg.actionResult?.liveReport || null;
                  const deltaBadge = formatScoreDelta(report);

                  return (
                    <article
                      key={msg.id || `${idx}-${msg.role}`}
                      className={`ai-bubble-row ${isUser ? "user" : "assistant"}`}
                    >
                      <div className={`ai-bubble ${isUser ? "ai-bubble-user" : "ai-bubble-assistant"}`}>
                        <div className="ai-bubble-meta">
                          <span>{isUser ? "You" : "EcomSEO AI Copilot"}</span>
                          {!isUser && msg.fallbackUsed ? (
                            <span className="ai-fallback-pill">Offline Snapshot · 0 tok</span>
                          ) : null}
                        </div>
                        <div className="ai-bubble-text">{renderLines(msg.content)}</div>

                        {msg.actionResult ? (
                          <div className={`ai-exec-card ${msg.actionResult.ok ? "ok" : "error"}`}>
                            <div className="ai-exec-head">
                              <strong>
                                {msg.actionResult.ok ? "✅" : "⚠️"}{" "}
                                {msg.actionResult.title || msg.actionResult.actionType}
                              </strong>
                              <div className="ai-exec-badges">
                                {deltaBadge ? (
                                  <span className={`ai-score-delta-pill ${deltaBadge.tone}`}>
                                    {deltaBadge.text}
                                  </span>
                                ) : null}
                                {msg.actionResult.creditInfo?.creditsDeducted > 0 ? (
                                  <span className="ai-credit-note">
                                    -{msg.actionResult.creditInfo.creditsDeducted} tok
                                  </span>
                                ) : (
                                  <span className="ai-credit-note">Live Synced</span>
                                )}
                              </div>
                            </div>

                            {Array.isArray(report?.diffs) && report.diffs.length > 0 ? (
                              <div className="ai-live-diff-wrap">
                                <table className="ai-live-diff-table">
                                  <caption className="visually-hidden">
                                    Live Before and After Update Report
                                  </caption>
                                  <thead>
                                    <tr>
                                      <th scope="col">Field / Metric</th>
                                      <th scope="col">Before</th>
                                      <th scope="col">After (Live)</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {report.diffs.map((diff, dIdx) => (
                                      <tr key={`${dIdx}-${diff.label}`}>
                                        <td><strong>{diff.label}</strong></td>
                                        <td className="ai-diff-before">{diff.before}</td>
                                        <td className="ai-diff-after">{diff.after}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            ) : Array.isArray(msg.actionResult.details) &&
                              msg.actionResult.details.length > 0 ? (
                              <ul className="ai-exec-details">
                                {msg.actionResult.details.map((line, lineIdx) => (
                                  <li key={`${lineIdx}-${String(line).slice(0, 12)}`}>{line}</li>
                                ))}
                              </ul>
                            ) : null}

                            {report?.rollbackRevisionId ? (
                              <div className="ai-exec-footer-actions">
                                <button
                                  type="button"
                                  className="seo-button ghost"
                                  style={{ padding: "4px 9px", fontSize: "11.5px" }}
                                  disabled={isExecuting || isSending}
                                  onClick={() =>
                                    runAction({
                                      id: `undo-${report.rollbackRevisionId}`,
                                      type: "ROLLBACK_REVISION",
                                      label: "Undo This Update",
                                      params: { revisionId: report.rollbackRevisionId },
                                    })
                                  }
                                >
                                  ↩️ Undo This Change
                                </button>
                                <Link
                                  to="/app/revisions"
                                  className="seo-button ghost"
                                  style={{ padding: "4px 9px", fontSize: "11.5px" }}
                                  onClick={() => mode === "drawer" && typeof onClose === "function" && onClose()}
                                >
                                  View Full History →
                                </Link>
                              </div>
                            ) : null}
                          </div>
                        ) : null}

                        {Array.isArray(msg.suggestedActions) && msg.suggestedActions.length > 0 ? (
                          <div className="ai-actions-list">
                            {msg.suggestedActions.map((act) => {
                              const completed = msg.executedActions?.[act.id];
                              const runningThis =
                                isExecuting && executingAction?.id === act.id;
                              return (
                                <div key={act.id} className="ai-action-card">
                                  <div className="ai-action-info">
                                    <div className="ai-action-title-line">
                                      <strong>
                                        {actionIcon(act.type)} {act.label}
                                      </strong>
                                      <span className="ai-action-cost">
                                        {formatActionCost(act, superAccess, selectedProduct)}
                                      </span>
                                    </div>
                                    {act.description ? (
                                      <p className="ai-action-desc">{act.description}</p>
                                    ) : null}
                                  </div>
                                  <button
                                    type="button"
                                    className={`seo-button ${
                                      completed
                                        ? "secondary"
                                        : act.tone === "secondary"
                                          ? "secondary"
                                          : ""
                                    } ai-action-run-btn`}
                                    disabled={Boolean(completed) || isExecuting || isSending}
                                    onClick={() => runAction(act, msg.id)}
                                  >
                                    {runningThis
                                      ? "Applying..."
                                      : completed
                                        ? completed.ok
                                          ? "✓ Applied"
                                          : "Retried"
                                        : act.type === "OPEN_ROUTE"
                                          ? "Open ↗"
                                          : "Apply Live Fix"}
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        ) : null}

                        {isLatestAssistant &&
                        Array.isArray(msg.quickReplies) &&
                        msg.quickReplies.length > 0 ? (
                          <div className="ai-quick-replies">
                            {msg.quickReplies.map((replyText) => (
                              <button
                                key={replyText}
                                type="button"
                                className="ai-quick-chip"
                                disabled={!aiReady || isSending || isExecuting}
                                onClick={() => sendPrompt(replyText)}
                              >
                                {replyText}
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </article>
                  );
                })}

                {pendingUserPrompt ? (
                  <article className="ai-bubble-row user">
                    <div className="ai-bubble ai-bubble-user">
                      <div className="ai-bubble-meta">
                        <span>You</span>
                      </div>
                      <div className="ai-bubble-text">{pendingUserPrompt}</div>
                    </div>
                  </article>
                ) : null}

                {isSending ? (
                  <article className="ai-bubble-row assistant" aria-label="AI is thinking">
                    <div className="ai-bubble ai-bubble-assistant ai-thinking-bubble">
                      <div className="ai-bubble-meta">
                        <span>EcomSEO AI Copilot</span>
                        <span className="ai-thinking-label">thinking…</span>
                      </div>
                      <div className="ai-typing-row">
                        <span className="ai-typing-dot" style={{ animationDelay: "0ms" }} />
                        <span className="ai-typing-dot" style={{ animationDelay: "160ms" }} />
                        <span className="ai-typing-dot" style={{ animationDelay: "320ms" }} />
                      </div>
                      <div className="ai-thinking-steps">
                        <span className="ai-thinking-step active">📋 Reading store audit &amp; SEO state</span>
                        <span className="ai-thinking-step">🧠 Generating AI response</span>
                        <span className="ai-thinking-step">⚡ Preparing action plan</span>
                      </div>
                    </div>
                  </article>
                ) : null}

                {isExecuting ? (
                  <article className="ai-bubble-row assistant" aria-label="Applying fix to store">
                    <div className="ai-bubble ai-bubble-assistant ai-executing-bubble">
                      <div className="ai-bubble-meta">
                        <span>EcomSEO AI Copilot</span>
                        <span className="ai-executing-label">executing…</span>
                      </div>
                      <div className="ai-exec-progress-title">
                        <span className="ai-exec-spinner" aria-hidden="true" />
                        <strong>{executingAction?.label || "Applying Live Store Update"}</strong>
                        {executingAction?.badgeLabel ? (
                          <span className="ai-exec-token-pill">
                            Est. {executingAction.badgeLabel}
                          </span>
                        ) : null}
                      </div>
                      <ol className="ai-exec-steps-list">
                        <li className="done">🔗 Connected to Shopify Admin API</li>
                        <li className="active">✏️ Writing SEO updates to Shopify…</li>
                        <li>📊 Refreshing live Before → After report</li>
                      </ol>
                    </div>
                  </article>
                ) : null}
              </>
            )}
            <div aria-hidden="true" style={{ height: 0 }} />
          </div>

          <div className="visually-hidden" aria-live="polite" aria-atomic="true">
            {liveStatus}
          </div>

          {pendingConfirmAction ? (
            <div className="ai-confirm-card" role="region" aria-label="Pre-run token calculation">
              <div className="ai-confirm-head">
                <div>
                  <strong>
                    🧮 Calculated Token Cost: {pendingConfirmAction.estimate.badgeLabel}
                  </strong>
                  <p>
                    Action: <strong>{pendingConfirmAction.action.label || pendingConfirmAction.action.type}</strong>
                    {pendingConfirmAction.estimate.scopeNote
                      ? ` · ${pendingConfirmAction.estimate.scopeNote}`
                      : ""}
                  </p>
                </div>
                <div className="ai-confirm-balance">
                  <span>
                    Balance: <strong>{availableTokens.toLocaleString()} tok</strong>
                  </span>
                  <span>
                    After:{" "}
                    <strong
                      className={
                        availableTokens >= pendingConfirmAction.estimate.estimatedTokens
                          ? "token-status-ok"
                          : "token-status-warn"
                      }
                    >
                      {availableTokens >= pendingConfirmAction.estimate.estimatedTokens
                        ? `${(availableTokens - pendingConfirmAction.estimate.estimatedTokens).toLocaleString()} tok`
                        : `Short ${pendingConfirmAction.estimate.estimatedTokens - availableTokens} tok`}
                    </strong>
                  </span>
                </div>
              </div>
              <div className="ai-confirm-actions">
                <button
                  type="button"
                  className="seo-button"
                  disabled={isExecuting || isSending}
                  onClick={() =>
                    runAction(
                      pendingConfirmAction.action,
                      pendingConfirmAction.messageId,
                      { skipConfirm: true },
                    )
                  }
                >
                  Confirm &amp; Run (Up to {pendingConfirmAction.estimate.estimatedTokens} tok)
                </button>
                <button
                  type="button"
                  className="seo-button secondary"
                  onClick={() => setPendingConfirmAction(null)}
                >
                  Cancel
                </button>
                {availableTokens < pendingConfirmAction.estimate.estimatedTokens ? (
                  <Link
                    to="/app/billing"
                    className="ai-calc-jump-link"
                    onClick={() => mode === "drawer" && typeof onClose === "function" && onClose()}
                  >
                    Top Up Tokens →
                  </Link>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="ai-composer-quick-strip" aria-label="Fast chat shortcuts">
            {QUICK_FAST_COMMANDS.slice(0, 5).map((cmd) => {
              const est = estimateChatActionTokens(
                { type: cmd.type, params: cmd.params },
                { superAccess, selectedProduct },
              );
              const isAiCmd = cmd.type === "AUTO_FIX_PRODUCTS" || cmd.type === "FIX_PRODUCT_DESCRIPTION";
              return (
                <button
                  key={`strip-${cmd.id}`}
                  type="button"
                  className="ai-strip-chip"
                  disabled={isExecuting || isSending || (isAiCmd && !aiReady)}
                  onClick={() => runQuickCommand(cmd)}
                  title={est.badgeLabel}
                >
                  <span aria-hidden="true">{cmd.icon}</span>
                  <span>
                    {(cmd.type === "AUTO_FIX_PRODUCTS" || cmd.type === "FIX_PRODUCT_DESCRIPTION") &&
                    selectedProduct
                      ? `${cmd.type === "FIX_PRODUCT_DESCRIPTION" ? "Desc" : "Fix"} ${selectedProduct.title.slice(0, 14)}`
                      : cmd.label}
                  </span>
                  {est.estimatedTokens > 0 ? (
                    <span className="ai-chip-tok">{est.unitCost}t</span>
                  ) : null}
                </button>
              );
            })}
          </div>

          <form className="ai-chat-composer" onSubmit={handleFormSubmit}>
            <label htmlFor={inputId} className="visually-hidden">
              Message EcomSEO AI Mode
            </label>
            <div className="ai-composer-box">
              <textarea
                ref={textareaRef}
                id={inputId}
                className="ai-composer-input"
                rows={2}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={handleKeyDown}
                aria-describedby={hintId}
                placeholder={
                  selectedProduct
                    ? `Command AI for "${selectedProduct.title}" (e.g. 'set meta title to ...' or 'auto-fix this product')...`
                    : aiReady
                      ? "Tell AI what to update (e.g. 'update product SEO for ...', 'compress heavy images', 'set robots.txt', 'run speed test')..."
                      : "Use Fast One-Click Actions above, or enable Gemini AI in SuperAdmin for chat prompts."
                }
                disabled={!aiReady || isSending || isExecuting}
              />
              <button
                type="submit"
                className="seo-button ai-composer-send"
                disabled={!aiReady || !draft.trim() || isSending || isExecuting}
              >
                {isSending ? "..." : "Send"}
              </button>
            </div>
            <div className="ai-composer-foot">
              <span id={hintId} className="seo-muted">
                Press <kbd>Enter</kbd> to send · <kbd>Shift</kbd>+<kbd>Enter</kbd> for new line
              </span>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export function AiChatDrawer({
  open = false,
  onClose,
  initialHistory = [],
  initialSnapshot = null,
  initialCatalogProducts = [],
  aiReady = true,
  aiUnavailableReason = "",
  creditAccount = {},
}) {
  const dialogRef = useRef(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      if (!dialog.open) {
        try {
          dialog.showModal();
        } catch {
          dialog.setAttribute("open", "true");
        }
      }
    } else if (dialog.open) {
      dialog.close();
    }
  }, [open]);

  // Native closedby fallback + close event sync
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return undefined;

    const handleClose = () => {
      dialog.returnValue = "";
      if (typeof onClose === "function") onClose();
    };
    dialog.addEventListener("close", handleClose);

    if ("closedBy" in HTMLDialogElement.prototype) {
      return () => dialog.removeEventListener("close", handleClose);
    }

    let pressedOutside = false;
    const isOutside = (event) => {
      const r = dialog.getBoundingClientRect();
      return (
        event.clientX < r.left ||
        event.clientX > r.right ||
        event.clientY < r.top ||
        event.clientY > r.bottom
      );
    };
    const handlePointerDown = (event) => {
      pressedOutside = isOutside(event);
    };
    const handlePointerUp = (event) => {
      if (pressedOutside && isOutside(event) && dialog.open) {
        dialog.close();
      }
      pressedOutside = false;
    };

    dialog.addEventListener("pointerdown", handlePointerDown);
    dialog.addEventListener("pointerup", handlePointerUp);
    return () => {
      dialog.removeEventListener("close", handleClose);
      dialog.removeEventListener("pointerdown", handlePointerDown);
      dialog.removeEventListener("pointerup", handlePointerUp);
    };
  }, [onClose]);

  return (
    <dialog
      ref={dialogRef}
      className={`ai-drawer-dialog${expanded ? " expanded" : ""}`}
      aria-label="Full AI Mode Chat Copilot"
      {...{ closedby: "any" }}
    >
      <AiChatPanel
        mode="drawer"
        open={open}
        initialHistory={initialHistory}
        initialSnapshot={initialSnapshot}
        initialCatalogProducts={initialCatalogProducts}
        aiReady={aiReady}
        aiUnavailableReason={aiUnavailableReason}
        creditAccount={creditAccount}
        onClose={onClose}
        isDrawerExpanded={expanded}
        onToggleDrawerExpand={() => setExpanded((prev) => !prev)}
      />
    </dialog>
  );
}
