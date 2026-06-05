import OpenAI from "openai";
import type { Provider } from "../types.js";
import { config } from "../config.js";

let client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!client) client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return client;
}

export const openaiProvider: Provider = {
  name: "openai",
  label: "OpenAI GPT",
  kind: "cloud",
  model: config.models.openai,
  capabilities: {
    business: 0.9,
    reasoning: 0.85,
    general: 0.85,
    creative: 0.8,
    technical: 0.75,
    legal: 0.6,
    research: 0.6,
    market: 0.6,
    privacy: 0.2,
  },
  isAvailable: () => Boolean(process.env.OPENAI_API_KEY),
  async call(prompt, opts) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error(
        "OPENAI_API_KEY missing — add it to .env, or drop 'openai' from --providers."
      );
    }
    const response = await getClient().responses.create({
      model: config.models.openai,
      input: prompt,
      max_output_tokens: opts?.maxTokens ?? config.defaultMaxTokens,
    });
    return response.output_text ?? "";
  },
};
