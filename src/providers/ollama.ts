import type { Provider } from "../types.js";
import { config } from "../config.js";

/**
 * Local provider via Ollama (https://ollama.com). Privacy-first: prompts never
 * leave the machine. Opt-in with OLLAMA_ENABLED=true so we never probe
 * localhost unexpectedly. Uses the standard /api/generate endpoint.
 */
export const ollamaProvider: Provider = {
  name: "ollama",
  label: "Local LLM (Ollama)",
  kind: "local",
  model: config.models.ollama,
  capabilities: {
    privacy: 1.0,
    general: 0.6,
    reasoning: 0.55,
    technical: 0.55,
    business: 0.5,
    creative: 0.5,
    research: 0.45,
    market: 0.45,
    legal: 0.45,
  },
  isAvailable: () => config.ollamaEnabled,
  async call(prompt, opts) {
    if (!config.ollamaEnabled) {
      throw new Error(
        "Ollama disabled — set OLLAMA_ENABLED=true (and run `ollama serve`) to use the local provider."
      );
    }
    const res = await fetch(`${config.ollamaBaseUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: config.models.ollama,
        prompt,
        stream: false,
        options: { num_predict: opts?.maxTokens ?? config.defaultMaxTokens },
      }),
    });
    if (!res.ok) {
      throw new Error(
        `Ollama request failed (${res.status}). Is \`ollama serve\` running at ${config.ollamaBaseUrl}?`
      );
    }
    const data = (await res.json()) as { response?: string };
    return data.response ?? "";
  },
};
