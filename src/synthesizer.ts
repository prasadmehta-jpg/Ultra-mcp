import type {
  Contradiction,
  Provider,
  ProviderResult,
  UltraMode,
} from "./types.js";

/**
 * Turn many provider outputs into one answer.
 *
 * Consensus (MBR flavour): the synthesizer is instructed to prefer conclusions
 * that multiple providers independently support and to mark low-consensus
 * claims as tentative — i.e. minimise the risk of confidently asserting a
 * claim only one source makes. Contradictions and confidences are handed to
 * the synthesizer so its reconciliation is informed, and every contribution is
 * attributed for transparency.
 */

function buildContext(
  results: ProviderResult[],
  contradictions: Contradiction[]
): string {
  const blocks = results
    .map((r) => {
      const status = r.success
        ? `confidence ${r.confidence.toFixed(2)}`
        : `FAILED: ${r.error ?? "unknown error"}`;
      return [
        `## ${r.provider} — ${r.role} (${r.aspect}) [${status}]`,
        r.success ? r.output : "(no output)",
      ].join("\n");
    })
    .join("\n\n---\n\n");

  const contradictionBlock =
    contradictions.length > 0
      ? "\n\nDETECTED CONTRADICTIONS (heuristic; reconcile explicitly):\n" +
        contradictions.map((c) => `- ${c.description}`).join("\n")
      : "\n\nNo contradictions were detected by the heuristic pass.";

  return blocks + contradictionBlock;
}

function instructions(mode: UltraMode): string {
  if (mode === "debate") {
    return [
      "You are Ultra MCP running in DEBATE mode.",
      "1. Briefly stage the strongest disagreement between the providers.",
      "2. Weigh each side on the evidence given.",
      "3. Converge on a single reasoned position.",
      "4. Attribute key points to the providers that made them.",
      "5. Mark any claim only one provider supports as TENTATIVE.",
    ].join("\n");
  }
  return [
    "You are Ultra MCP, synthesising multiple AI outputs into one answer.",
    "1. Lead with the consensus view (points multiple providers agree on).",
    "2. Explicitly resolve or flag each detected contradiction.",
    "3. Keep the strongest specific ideas; drop repetition.",
    "4. Mark any claim only one provider supports as TENTATIVE.",
    "5. Attribute notable contributions (e.g. 'per the technical review…').",
    "6. End with a short, execution-ready recommendation.",
  ].join("\n");
}

/** Deterministic fallback when no synthesizer model is available/usable. */
function mechanicalSynthesis(
  task: string,
  results: ProviderResult[],
  contradictions: Contradiction[]
): string {
  const ok = results.filter((r) => r.success);
  const lines: string[] = [
    "# Ultra MCP — Combined Output (mechanical merge)",
    "",
    `Task: ${task}`,
    "",
    "No synthesizer model was available, so outputs are concatenated by",
    "confidence rather than reasoned together.",
    "",
  ];
  for (const r of [...ok].sort((a, b) => b.confidence - a.confidence)) {
    lines.push(`## ${r.role} — ${r.provider} (confidence ${r.confidence.toFixed(2)})`);
    lines.push(r.output, "");
  }
  if (contradictions.length > 0) {
    lines.push("## Unresolved contradictions");
    for (const c of contradictions) lines.push(`- ${c.description}`);
  }
  return lines.join("\n");
}

export async function synthesize(
  task: string,
  results: ProviderResult[],
  contradictions: Contradiction[],
  synthesizer: Provider | null,
  mode: UltraMode,
  maxTokens?: number
): Promise<string> {
  const successful = results.filter((r) => r.success);

  if (mode === "raw" || successful.length === 0 || synthesizer === null) {
    return mechanicalSynthesis(task, results, contradictions);
  }

  const prompt = [
    instructions(mode),
    "",
    `ORIGINAL TASK:\n${task}`,
    "",
    "PROVIDER OUTPUTS:",
    buildContext(results, contradictions),
    "",
    "FINAL ANSWER:",
  ].join("\n");

  try {
    return await synthesizer.call(prompt, { maxTokens });
  } catch {
    // Synthesizer itself failed → degrade to a mechanical merge rather than error.
    return mechanicalSynthesis(task, results, contradictions);
  }
}
