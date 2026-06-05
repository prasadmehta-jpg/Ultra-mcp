import Anthropic from "@anthropic-ai/sdk";
import type { Provider } from "../types.js";
import { config } from "../config.js";

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

export const anthropicProvider: Provider = {
  name: "anthropic",
  label: "Anthropic Claude",
  kind: "cloud",
  model: config.models.anthropic,
  capabilities: {
    technical: 0.9,
    reasoning: 0.9,
    legal: 0.85,
    general: 0.85,
    creative: 0.8,
    business: 0.75,
    research: 0.7,
    market: 0.6,
    privacy: 0.3,
  },
  isAvailable: () => Boolean(process.env.ANTHROPIC_API_KEY),
  async call(prompt, opts) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error(
        "ANTHROPIC_API_KEY missing — add it to .env, or drop 'anthropic' from --providers."
      );
    }
    const message = await getClient().messages.create({
      model: config.models.anthropic,
      max_tokens: opts?.maxTokens ?? config.defaultMaxTokens,
      messages: [{ role: "user", content: prompt }],
    });
    return message.content
      .map((block) => ("text" in block ? block.text : ""))
      .join("\n");
  },
};
