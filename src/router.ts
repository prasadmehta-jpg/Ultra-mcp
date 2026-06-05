import type {
  Capability,
  Provider,
  ProviderName,
  RouteDecision,
} from "./types.js";
import { config } from "./config.js";
import { allProviders } from "./providers/registry.js";

/**
 * Routing strategy (CBR / semantic flavour, fully explainable):
 *   1. Detect which capability "aspects" a task touches, from lexical signals.
 *   2. Guarantee a multi-perspective baseline (never fewer than 2 aspects).
 *   3. For each aspect, pick the available provider with the highest capability
 *      score, lightly penalising providers already used so "many minds" really
 *      means many providers where possible.
 *   4. Record a human-readable reason (and any fallback) for every decision.
 */

const ASPECT_SIGNALS: Record<Capability, string[]> = {
  technical: [
    "architect", "code", "technical", "engineer", "stack", "scalab",
    "security", "implement", "api", "infra", "database", "latency", "system",
  ],
  business: [
    "business", "revenue", "pricing", "monet", "strategy", "cost", "margin",
    "unit econ", "go-to-market", "gtm", "customer", "growth", "investor",
  ],
  legal: [
    "legal", "complian", "contract", "regulat", "gdpr", "liabilit", "patent",
    "trademark", "terms", "privacy law", "licens",
  ],
  research: [
    "research", "evidence", "study", "citation", "validate", "verify",
    "literature", "fact", "source",
  ],
  market: [
    "market", "competitor", "industry", "trend", "tam", "demand",
    "positioning", "audience", "segment",
  ],
  creative: [
    "creative", "design", "brand", "copy", "story", "name", "tagline", "ux",
    "narrative", "slogan",
  ],
  privacy: [
    "private", "confidential", "on-prem", "on prem", "local only", "sensitive",
    "internal document", "do not share",
  ],
  reasoning: [], // baseline, always implicitly relevant
  general: [],   // baseline
};

const ROLE_BY_ASPECT: Record<Capability, string> = {
  technical: "Technical Critic",
  business: "Business Strategist",
  legal: "Legal & Compliance Reviewer",
  research: "Research Validator",
  market: "Market Intelligence Analyst",
  creative: "Creative Lead",
  privacy: "Private Document Analyst",
  reasoning: "Critical Reasoner",
  general: "Generalist Reviewer",
};

const PERSONA_BY_ASPECT: Record<Capability, string> = {
  technical:
    "You are a technical critic. Assess architecture risks, implementation gaps, scalability and security. Give concrete, ordered next steps.",
  business:
    "You are a business strategist. Evaluate model, pricing, unit economics and go-to-market. Be direct about what does and does not work.",
  legal:
    "You are a legal & compliance reviewer. Surface regulatory, contractual, IP and liability considerations. Flag where professional counsel is required.",
  research:
    "You are a research validator. Check factual claims, identify what needs verification, and separate established fact from assumption.",
  market:
    "You are a market intelligence analyst. Size the opportunity, map competitors, and identify positioning and demand signals.",
  creative:
    "You are a creative lead. Push on narrative, brand, naming and user experience. Offer concrete, original options.",
  privacy:
    "You are a private document analyst. Reason carefully over sensitive material without leaking or over-generalising.",
  reasoning:
    "You are a critical reasoner. Challenge assumptions, expose missing context, and propose alternative approaches.",
  general:
    "You are a generalist reviewer. Give a balanced, practical assessment across all relevant angles.",
};

/** Detect aspects via lexical signals, then ensure a multi-perspective baseline. */
export function detectAspects(task: string): Capability[] {
  const text = task.toLowerCase();
  const matched: Capability[] = [];

  for (const [cap, signals] of Object.entries(ASPECT_SIGNALS) as [
    Capability,
    string[]
  ][]) {
    if (signals.length === 0) continue;
    if (signals.some((s) => text.includes(s))) matched.push(cap);
  }

  // Always include critical reasoning as a perspective.
  if (!matched.includes("reasoning")) matched.push("reasoning");

  // Guarantee at least two distinct perspectives for genuine collaboration.
  if (matched.length < 2 && !matched.includes("general")) matched.push("general");

  // Bound fan-out cost.
  return matched.slice(0, Math.max(2, config.maxAspects));
}

function score(provider: Provider, aspect: Capability): number {
  return provider.capabilities[aspect] ?? 0;
}

/**
 * Build the routing plan. `pool` is the set of providers we are allowed to use
 * (already filtered for availability / human override by the caller).
 */
export function routeTask(
  task: string,
  pool: Provider[]
): RouteDecision[] {
  if (pool.length === 0) {
    throw new Error("routeTask called with an empty provider pool.");
  }

  const aspects = detectAspects(task);
  const usage = new Map<ProviderName, number>();
  const DIVERSITY_PENALTY = 0.15;

  const globalBestFor = (aspect: Capability): Provider =>
    [...allProviders()].sort((a, b) => score(b, aspect) - score(a, aspect))[0];

  return aspects.map((aspect) => {
    // Rank the *allowed* pool, penalising already-used providers for diversity.
    const ranked = [...pool].sort((a, b) => {
      const adj = (p: Provider) =>
        score(p, aspect) - (usage.get(p.name) ?? 0) * DIVERSITY_PENALTY;
      return adj(b) - adj(a);
    });

    const chosen = ranked[0];
    usage.set(chosen.name, (usage.get(chosen.name) ?? 0) + 1);

    const idealGlobal = globalBestFor(aspect);
    const fellBack =
      idealGlobal.name !== chosen.name && !pool.some((p) => p.name === idealGlobal.name);

    const used = (usage.get(chosen.name) ?? 1) - 1;
    const reasonParts = [
      `${chosen.label} scores ${score(chosen, aspect).toFixed(2)} for "${aspect}"`,
    ];
    if (used > 0) reasonParts.push("kept for diversity despite prior assignment");
    if (fellBack)
      reasonParts.push(
        `capability-best provider "${idealGlobal.name}" was unavailable`
      );

    return {
      provider: chosen.name,
      role: ROLE_BY_ASPECT[aspect],
      aspect,
      reason: reasonParts.join("; "),
      ...(fellBack ? { fallbackFrom: idealGlobal.name } : {}),
      prompt: `${PERSONA_BY_ASPECT[aspect]}\n\nTASK:\n${task}`,
    };
  });
}
