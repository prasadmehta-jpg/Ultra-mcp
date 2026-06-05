import type { Provider, ProviderResult, RouteDecision } from "./types.js";
import { scoreResult } from "./analysis/confidence.js";

/**
 * Execute a single route. Never throws: a provider failure becomes a failed
 * ProviderResult so the rest of the pipeline degrades gracefully ("fail
 * gracefully" from the brief). Latency is measured for the audit trail.
 */
export async function executeRoute(
  provider: Provider,
  route: RouteDecision,
  maxTokens?: number
): Promise<ProviderResult> {
  const start = Date.now();
  try {
    const output = await provider.call(route.prompt, { maxTokens });
    return scoreResult({
      provider: route.provider,
      role: route.role,
      aspect: route.aspect,
      success: true,
      output,
      latencyMs: Date.now() - start,
    });
  } catch (error) {
    return scoreResult({
      provider: route.provider,
      role: route.role,
      aspect: route.aspect,
      success: false,
      output: "",
      error: error instanceof Error ? error.message : String(error),
      latencyMs: Date.now() - start,
    });
  }
}
