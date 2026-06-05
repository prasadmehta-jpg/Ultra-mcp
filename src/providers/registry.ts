import type { Provider, ProviderName } from "../types.js";
import { openaiProvider } from "./openai.js";
import { anthropicProvider } from "./anthropic.js";
import { geminiProvider } from "./gemini.js";
import { ollamaProvider } from "./ollama.js";
import { mockProvider } from "./mock.js";

/**
 * The registry is the only place that knows the full provider list.
 * To add a provider: implement the Provider interface and append it here.
 */
const REGISTRY: Provider[] = [
  anthropicProvider,
  openaiProvider,
  geminiProvider,
  ollamaProvider,
  mockProvider,
];

export const MOCK_NAME = "mock";

export function allProviders(): Provider[] {
  return REGISTRY;
}

export function getProvider(name: ProviderName): Provider | undefined {
  return REGISTRY.find((p) => p.name === name);
}

/** Real, ready-to-use providers (mock excluded). */
export function availableRealProviders(): Provider[] {
  return REGISTRY.filter((p) => p.name !== MOCK_NAME && p.isAvailable());
}

export function hasAnyRealProvider(): boolean {
  return availableRealProviders().length > 0;
}
