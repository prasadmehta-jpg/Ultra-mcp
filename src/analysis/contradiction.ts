import type { Contradiction, ProviderResult } from "../types.js";

/**
 * Lightweight, honest contradiction detection.
 *
 * We score each successful output's *recommendation polarity* from lexical
 * cues (proceed/viable/recommend vs. avoid/reject/not viable). When two
 * providers land on opposite polarities we flag a contradiction for the
 * synthesizer to reconcile. This is a heuristic signal, not a proof — it is
 * meant to draw attention, and the synthesizer makes the final call.
 */

const POSITIVE = [
  "recommend", "should proceed", "is viable", "strong fit", "go ahead",
  "promising", "worth pursuing", "yes,", "clear opportunity", "advisable",
];
const NEGATIVE = [
  "do not", "don't", "avoid", "not viable", "reject", "against", "high risk",
  "not advisable", "would not recommend", "no,", "walk away", "red flag",
];

function polarity(text: string): { sign: -1 | 0 | 1; pos: number; neg: number } {
  const lower = text.toLowerCase();
  const pos = POSITIVE.filter((p) => lower.includes(p)).length;
  const neg = NEGATIVE.filter((n) => lower.includes(n)).length;
  if (pos === 0 && neg === 0) return { sign: 0, pos, neg };
  return { sign: pos > neg ? 1 : pos < neg ? -1 : 0, pos, neg };
}

export function detectContradictions(
  results: ProviderResult[]
): Contradiction[] {
  const ok = results.filter((r) => r.success && r.output.trim().length > 0);
  const scored = ok.map((r) => ({ r, p: polarity(r.output) }));
  const out: Contradiction[] = [];

  for (let i = 0; i < scored.length; i++) {
    for (let j = i + 1; j < scored.length; j++) {
      const a = scored[i];
      const b = scored[j];
      if (a.p.sign !== 0 && b.p.sign !== 0 && a.p.sign !== b.p.sign) {
        const lean = (s: number) => (s > 0 ? "favourable" : "unfavourable");
        out.push({
          providerA: a.r.provider,
          providerB: b.r.provider,
          description: `${a.r.provider} (${a.r.role}) leans ${lean(
            a.p.sign
          )} while ${b.r.provider} (${b.r.role}) leans ${lean(b.p.sign)}.`,
          signal: `polarity ${a.r.provider}=${a.p.sign} vs ${b.r.provider}=${b.p.sign}`,
        });
      }
    }
  }
  return out;
}
