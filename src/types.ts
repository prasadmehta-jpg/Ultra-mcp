/**
 * Ultra MCP — shared type definitions.
 *
 * Everything that crosses a module boundary is typed here so the router,
 * orchestrator, analysis layer and synthesizer all speak the same language.
 */

/** Capability dimensions a task can require and a provider can be good at. */
export type Capability =
  | "technical"
  | "business"
  | "legal"
  | "research"
  | "market"
  | "creative"
  | "reasoning"
  | "privacy"
  | "general";

export const ALL_CAPABILITIES: Capability[] = [
  "technical",
  "business",
  "legal",
  "research",
  "market",
  "creative",
  "reasoning",
  "privacy",
  "general",
];

/** Provider names are free-form strings so the registry stays extensible. */
export type ProviderName = string;

/** How strong a provider is at each capability, 0..1. Missing = 0. */
export type CapabilityProfile = Partial<Record<Capability, number>>;

/** A pluggable AI backend. Implement this interface to add a provider. */
export interface Provider {
  name: ProviderName;
  label: string;
  kind: "cloud" | "local" | "mock";
  model: string;
  capabilities: CapabilityProfile;
  /** Cheap, synchronous readiness check (e.g. is the API key present). */
  isAvailable(): boolean;
  /** Run a single prompt and return plain text. Must throw on failure. */
  call(prompt: string, opts?: { maxTokens?: number }): Promise<string>;
}

export type UltraMode = "synthesis" | "debate" | "raw";

/** A single routing decision, carrying an explainable reason. */
export interface RouteDecision {
  provider: ProviderName;
  role: string;
  aspect: Capability;
  prompt: string;
  reason: string;
  /** Set when the capability-best provider was unavailable and we fell back. */
  fallbackFrom?: ProviderName;
}

/** The result of executing one route against one provider. */
export interface ProviderResult {
  provider: ProviderName;
  role: string;
  aspect: Capability;
  success: boolean;
  output: string;
  error?: string;
  latencyMs: number;
  /** Heuristic, NOT a calibrated probability. See analysis/confidence.ts. */
  confidence: number;
  confidenceReason: string;
}

export interface Contradiction {
  providerA: ProviderName;
  providerB: ProviderName;
  description: string;
  signal: string;
}

/** Everything Ultra did, exposed for transparency / audit. */
export interface UltraTrace {
  task: string;
  mode: UltraMode;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  routes: RouteDecision[];
  results: ProviderResult[];
  contradictions: Contradiction[];
  synthesizer: ProviderName | null;
  overallConfidence: number;
  notes: string[];
}

export interface UltraOptions {
  /** Human override: restrict to these providers (by name). */
  providers?: ProviderName[];
  /** Human override: force this provider to do the final synthesis. */
  synthesizer?: ProviderName;
  mode?: UltraMode;
  maxTokens?: number;
}

export interface UltraResult {
  finalAnswer: string;
  trace: UltraTrace;
}
