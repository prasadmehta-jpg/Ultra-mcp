import type { ProviderResult } from "../types.js";

/**
 * Heuristic confidence scoring.
 *
 * IMPORTANT: this is a transparent heuristic, NOT a calibrated probability.
 * It rewards successful, specific, substantive answers and penalises hedging
 * and simulated output. The reason string is always surfaced so the score is
 * explainable rather than a black box.
 */

const HEDGE_TERMS = [
  "i'm not sure", "im not sure", "uncertain", "cannot determine",
  "can't determine", "no way to know", "it depends", "unclear", "i cannot",
  "i can't", "as an ai",
];

const SPECIFICITY = /(\d|•|^\s*[-*]\s|\bstep\b|\bfirst\b|\bsecond\b)/im;

function clamp(n: number): number {
  return Math.max(0, Math.min(1, n));
}

export function scoreResult(
  partial: Omit<ProviderResult, "confidence" | "confidenceReason">
): ProviderResult {
  const reasons: string[] = [];

  if (!partial.success) {
    return {
      ...partial,
      confidence: 0,
      confidenceReason: "provider call failed",
    };
  }

  let conf = 0.5;
  reasons.push("base 0.50");

  conf += 0.2;
  reasons.push("+0.20 success");

  const text = partial.output ?? "";
  const lengthFactor = clamp(text.length / 1200) * 0.2;
  conf += lengthFactor;
  reasons.push(`+${lengthFactor.toFixed(2)} substance`);

  if (SPECIFICITY.test(text)) {
    conf += 0.1;
    reasons.push("+0.10 specificity (numbers/steps)");
  }

  const lower = text.toLowerCase();
  const hedges = HEDGE_TERMS.filter((h) => lower.includes(h)).length;
  if (hedges > 0) {
    const penalty = Math.min(0.15, hedges * 0.05);
    conf -= penalty;
    reasons.push(`-${penalty.toFixed(2)} hedging x${hedges}`);
  }

  let confidence = clamp(conf);

  // Simulated output can never be high confidence.
  if (partial.provider === "mock") {
    confidence = Math.min(confidence, 0.3);
    reasons.push("capped 0.30 (simulated)");
  }

  return { ...partial, confidence, confidenceReason: reasons.join(", ") };
}

/** Aggregate confidence: mean of successful results, scaled by coverage. */
export function overallConfidence(results: ProviderResult[]): number {
  if (results.length === 0) return 0;
  const ok = results.filter((r) => r.success);
  if (ok.length === 0) return 0;
  const mean = ok.reduce((s, r) => s + r.confidence, 0) / ok.length;
  const coverage = ok.length / results.length;
  return clamp(mean * coverage);
}
