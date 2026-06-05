import { GoogleGenAI } from "@google/genai";
import type { Provider } from "../types.js";
import { config } from "../config.js";

let client: GoogleGenAI | null = null;
function getClient(): GoogleGenAI {
  if (!client) client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return client;
}

export const geminiProvider: Provider = {
  name: "gemini",
  label: "Google Gemini",
  kind: "cloud",
  model: config.models.gemini,
  capabilities: {
    research: 0.9,
    market: 0.9,
    general: 0.8,
    reasoning: 0.8,
    technical: 0.75,
    business: 0.7,
    creative: 0.7,
    legal: 0.6,
    privacy: 0.2,
  },
  isAvailable: () => Boolean(process.env.GEMINI_API_KEY),
  async call(prompt, opts) {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error(
        "GEMINI_API_KEY missing — add it to .env, or drop 'gemini' from --providers."
      );
    }
    const response = await getClient().models.generateContent({
      model: config.models.gemini,
      contents: prompt,
      config: { maxOutputTokens: opts?.maxTokens ?? config.defaultMaxTokens },
    });
    return response.text ?? "";
  },
};
