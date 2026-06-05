import type { Provider } from "../types.js";

/**
 * Deterministic offline provider. Used only as a last resort when no real
 * provider is configured, so the full pipeline (routing → orchestration →
 * contradiction detection → synthesis) still runs end-to-end with zero keys.
 *
 * Its output is clearly labelled as simulated so it is never mistaken for a
 * real model answer. It is intentionally excluded from the "real provider" set
 * in the registry.
 */
export const mockProvider: Provider = {
  name: "mock",
  label: "Offline Mock",
  kind: "mock",
  model: "deterministic-stub",
  capabilities: { general: 0.3, reasoning: 0.3 },
  isAvailable: () => true,
  async call(prompt) {
    const firstLine = prompt.split("\n").find((l) => l.trim().length > 0) ?? "";
    return [
      "[SIMULATED OUTPUT — no real AI provider was configured]",
      "",
      `This is a deterministic stand-in so you can exercise Ultra MCP offline.`,
      `Add an OPENAI_API_KEY / ANTHROPIC_API_KEY / GEMINI_API_KEY (or enable`,
      `Ollama) to get genuine multi-AI collaboration.`,
      "",
      `Prompt began with: "${firstLine.slice(0, 160)}"`,
    ].join("\n");
  },
};
