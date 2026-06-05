#!/usr/bin/env node
import "dotenv/config";
import { runUltra } from "./ultra.js";
import type { UltraMode } from "./types.js";

/**
 * CLI usage:
 *   ultra-mcp-cli "your task here"
 *   ultra-mcp-cli --mode debate --providers anthropic,gemini "your task"
 *   ultra-mcp-cli --json "your task"          (print full trace as JSON)
 *   ultra-mcp-cli --synthesizer openai "your task"
 */
function parseArgs(argv: string[]) {
  const opts: {
    providers?: string[];
    synthesizer?: string;
    mode?: UltraMode;
    json?: boolean;
  } = {};
  const rest: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--providers") opts.providers = (argv[++i] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    else if (a === "--synthesizer") opts.synthesizer = argv[++i];
    else if (a === "--mode") opts.mode = argv[++i] as UltraMode;
    else if (a === "--json") opts.json = true;
    else rest.push(a);
  }
  return { task: rest.join(" "), opts };
}

async function main() {
  const { task, opts } = parseArgs(process.argv.slice(2));
  if (!task) {
    console.error('Usage: ultra-mcp-cli [--mode synthesis|debate|raw] [--providers a,b] [--synthesizer name] [--json] "Your task"');
    process.exit(1);
  }

  console.error("\nUltra MCP — collaborating...\n");
  const { finalAnswer, trace } = await runUltra(task, {
    providers: opts.providers,
    synthesizer: opts.synthesizer,
    mode: opts.mode,
  });

  if (opts.json) {
    console.log(JSON.stringify({ finalAnswer, trace }, null, 2));
    return;
  }

  for (const r of trace.results) {
    console.error(
      `${r.success ? "✓" : "✗"} ${r.provider} — ${r.role} (${r.aspect}) ` +
        `${r.success ? `conf ${r.confidence.toFixed(2)}, ${r.latencyMs}ms` : `error: ${r.error}`}`
    );
  }
  if (trace.contradictions.length > 0) {
    console.error("\nContradictions:");
    for (const c of trace.contradictions) console.error(`  • ${c.description}`);
  }
  for (const n of trace.notes) console.error(`note: ${n}`);

  console.log("\n================ ULTRA MCP FINAL ANSWER ================\n");
  console.log(finalAnswer);
  console.log(
    `\n[mode=${trace.mode} · confidence=${trace.overallConfidence.toFixed(2)} · synthesizer=${trace.synthesizer ?? "none"}]`
  );
  console.log("\n========================================================\n");
}

main().catch((err) => {
  console.error("Ultra MCP error:", err);
  process.exit(1);
});
