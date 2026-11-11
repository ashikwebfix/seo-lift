export const DEFAULT_GEMINI_MODEL = "gemini-3.8-flash";

export const GEMINI_MODEL_CATALOG = Object.freeze([
  {
    id: "gemini-3.8-flash",
    label: "Gemini 3.8 Flash (Latest • Recommended)",
    group: "Gemini 3.5 – 3.8 Series",
  },
  {
    id: "gemini-3.7-flash",
    label: "Gemini 3.7 Flash",
    group: "Gemini 3.5 – 3.8 Series",
  },
  {
    id: "gemini-3.6-flash",
    label: "Gemini 3.6 Flash",
    group: "Gemini 3.5 – 3.8 Series",
  },
  {
    id: "gemini-3.5-flash",
    label: "Gemini 3.5 Flash",
    group: "Gemini 3.5 – 3.8 Series",
  },
  {
    id: "gemini-3.5-flash-lite",
    label: "Gemini 3.5 Flash-Lite (Fastest / Low Cost)",
    group: "Gemini 3.5 – 3.8 Series",
  },
  {
    id: "gemini-3.1-pro",
    label: "Gemini 3.1 Pro (Deep Reasoning)",
    group: "Gemini 3.1 Series",
  },
  {
    id: "gemini-3.1-pro-preview",
    label: "Gemini 3.1 Pro Preview",
    group: "Gemini 3.1 Series",
  },
  {
    id: "gemini-3.1-flash-lite",
    label: "Gemini 3.1 Flash-Lite",
    group: "Gemini 3.1 Series",
  },
  {
    id: "gemini-2.5-flash",
    label: "Gemini 2.5 Flash (Legacy)",
    group: "Legacy Gemini 2.x",
  },
  {
    id: "gemini-2.5-pro",
    label: "Gemini 2.5 Pro (Legacy)",
    group: "Legacy Gemini 2.x",
  },
  {
    id: "gemini-2.0-flash",
    label: "Gemini 2.0 Flash (Legacy)",
    group: "Legacy Gemini 2.x",
  },
]);

export const PRESET_GEMINI_MODEL_IDS = GEMINI_MODEL_CATALOG.map((model) => model.id);

export function formatGeminiModelName(modelId) {
  const match = GEMINI_MODEL_CATALOG.find((m) => m.id === modelId);
  return match ? match.label.replace(/\s*\(.*\)/, "") : String(modelId || DEFAULT_GEMINI_MODEL);
}

