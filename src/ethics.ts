/**
 * Minimal ethics pre-flight. This is a coarse guardrail, not a complete safety
 * system: it refuses tasks whose plain intent is to cause serious, concrete
 * harm before any provider is called. Real models still apply their own
 * policies downstream; this just avoids spending calls on clearly disallowed
 * work and gives the caller a graceful, explicit refusal.
 */

const HARD_BLOCK: { pattern: RegExp; category: string }[] = [
  { pattern: /\b(bioweapon|nerve agent|chemical weapon|weaponi[sz]e a pathogen)\b/i, category: "weapons of mass destruction" },
  { pattern: /\b(build|make|synthesi[sz]e).{0,30}\b(bomb|explosive device|ied)\b/i, category: "explosives" },
  { pattern: /\b(ransomware|keylogger|computer virus|malware)\b.{0,40}\b(write|create|build|code|develop)\b/i, category: "malware" },
  { pattern: /\b(write|create|build|code|develop)\b.{0,40}\b(ransomware|keylogger|malware)\b/i, category: "malware" },
];

export interface EthicsResult {
  blocked: boolean;
  category?: string;
  reason?: string;
}

export function preflightEthics(task: string): EthicsResult {
  for (const { pattern, category } of HARD_BLOCK) {
    if (pattern.test(task)) {
      return {
        blocked: true,
        category,
        reason: `Ultra MCP will not route this task: it appears to request ${category}. No providers were called.`,
      };
    }
  }
  return { blocked: false };
}
