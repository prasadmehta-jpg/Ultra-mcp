import "dotenv/config";

/**
 * Central configuration. Every model name is overridable via env so Ultra is
 * model-agnostic; the defaults preserve the models the project shipped with.
 */
export const config = {
  models: {
    openai: process.env.ULTRA_OPENAI_MODEL ?? "gpt-5.1",
    anthropic: process.env.ULTRA_ANTHROPIC_MODEL ?? "claude-sonnet-4-5",
    gemini: process.env.ULTRA_GEMINI_MODEL ?? "gemini-2.5-pro",
    ollama: process.env.ULTRA_OLLAMA_MODEL ?? "llama3.1",
  },
  ollamaBaseUrl: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
  /** Local providers are opt-in to avoid hitting localhost when unwanted. */
  ollamaEnabled: process.env.OLLAMA_ENABLED === "true",
  defaultMaxTokens: Number(process.env.ULTRA_MAX_TOKENS ?? 1800),
  /** Max distinct task aspects to fan out on (bounds cost/latency). */
  maxAspects: Number(process.env.ULTRA_MAX_ASPECTS ?? 4),
  /** If set, every run writes a JSON audit file into this directory. */
  auditDir: process.env.ULTRA_AUDIT_DIR ?? "",
} as const;
