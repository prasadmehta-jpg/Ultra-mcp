import { promises as fs } from "node:fs";
import path from "node:path";
import type {
  Provider,
  UltraMode,
  UltraOptions,
  UltraResult,
  UltraTrace,
} from "./types.js";
import { config } from "./config.js";
import { preflightEthics } from "./ethics.js";
import { routeTask } from "./router.js";
import { executeRoute } from "./orchestrator.js";
import { synthesize } from "./synthesizer.js";
import { detectContradictions } from "./analysis/contradiction.js";
import { overallConfidence } from "./analysis/confidence.js";
import {
  allProviders,
  availableRealProviders,
  getProvider,
} from "./providers/registry.js";

/** Resolve the allowed provider pool, honouring any human override. */
function resolvePool(options: UltraOptions, notes: string[]): Provider[] {
  if (options.providers && options.providers.length > 0) {
    const picked = options.providers
      .map((n) => getProvider(n))
      .filter((p): p is Provider => Boolean(p));
    const unknown = options.providers.filter((n) => !getProvider(n));
    if (unknown.length > 0) notes.push(`Ignored unknown providers: ${unknown.join(", ")}.`);
    const ready = picked.filter((p) => p.isAvailable() || p.name === "mock");
    const notReady = picked.filter((p) => !p.isAvailable() && p.name !== "mock");
    if (notReady.length > 0)
      notes.push(`Requested but unavailable: ${notReady.map((p) => p.name).join(", ")}.`);
    if (ready.length > 0) return ready;
    notes.push("No requested provider was available.");
  }

  const real = availableRealProviders();
  if (real.length > 0) return real;

  notes.push(
    "No real provider configured (no API keys / Ollama disabled) — running in offline mock mode."
  );
  return [getProvider("mock")!];
}

/** Pick the synthesizer: explicit override → strongest reasoning → mock/null. */
function resolveSynthesizer(
  options: UltraOptions,
  pool: Provider[],
  notes: string[]
): Provider | null {
  if (options.synthesizer) {
    const chosen = getProvider(options.synthesizer);
    if (chosen && (chosen.isAvailable() || chosen.name === "mock")) return chosen;
    notes.push(`Requested synthesizer "${options.synthesizer}" unavailable; auto-selecting.`);
  }
  const real = availableRealProviders();
  if (real.length > 0) {
    return [...real].sort(
      (a, b) => (b.capabilities.reasoning ?? 0) - (a.capabilities.reasoning ?? 0)
    )[0];
  }
  // Only mock available → return it so mock raw-merge still labels clearly.
  return pool.find((p) => p.name === "mock") ?? null;
}

async function writeAudit(trace: UltraTrace): Promise<void> {
  if (!config.auditDir) return;
  try {
    await fs.mkdir(config.auditDir, { recursive: true });
    const file = path.join(
      config.auditDir,
      `ultra-${trace.startedAt.replace(/[:.]/g, "-")}.json`
    );
    await fs.writeFile(file, JSON.stringify(trace, null, 2), "utf8");
  } catch {
    // Auditing is best-effort; never fail the run because of it.
  }
}

/**
 * Run the full Ultra MCP pipeline for one task.
 * One request in → one synthesized answer + a complete, transparent trace out.
 */
export async function runUltra(
  task: string,
  options: UltraOptions = {}
): Promise<UltraResult> {
  const startedAt = new Date().toISOString();
  const start = Date.now();
  const notes: string[] = [];
  const mode: UltraMode = options.mode ?? "synthesis";

  // 1. Ethics pre-flight.
  const ethics = preflightEthics(task);
  if (ethics.blocked) {
    const finishedAt = new Date().toISOString();
    const trace: UltraTrace = {
      task, mode, startedAt, finishedAt,
      durationMs: Date.now() - start,
      routes: [], results: [], contradictions: [],
      synthesizer: null, overallConfidence: 0,
      notes: [ethics.reason ?? "Blocked by ethics pre-flight."],
    };
    return { finalAnswer: ethics.reason ?? "Request declined.", trace };
  }

  // 2. Resolve providers + route.
  const pool = resolvePool(options, notes);
  const routes = routeTask(task, pool);

  // 3. Execute every route concurrently (graceful per-route failure).
  const results = await Promise.all(
    routes.map((route) =>
      executeRoute(getProvider(route.provider)!, route, options.maxTokens)
    )
  );

  // 4. Analyse.
  const contradictions = detectContradictions(results);
  const confidence = overallConfidence(results);

  // 5. Synthesize.
  const synthesizer = resolveSynthesizer(options, pool, notes);
  const finalAnswer = await synthesize(
    task,
    results,
    contradictions,
    synthesizer,
    mode,
    options.maxTokens
  );

  // 6. Assemble + audit.
  const finishedAt = new Date().toISOString();
  const trace: UltraTrace = {
    task, mode, startedAt, finishedAt,
    durationMs: Date.now() - start,
    routes, results, contradictions,
    synthesizer: synthesizer?.name ?? null,
    overallConfidence: confidence,
    notes,
  };
  await writeAudit(trace);

  return { finalAnswer, trace };
}

/** Cheap, no-cost preview of the routing plan (no provider calls). */
export function previewRoutes(task: string, options: UltraOptions = {}) {
  const ethics = preflightEthics(task);
  if (ethics.blocked) return { blocked: true, reason: ethics.reason, routes: [] };
  const notes: string[] = [];
  const pool = resolvePool(options, notes);
  return { blocked: false, notes, routes: routeTask(task, pool) };
}

/** Provider directory for the list tool. */
export function listProviders() {
  return allProviders().map((p) => ({
    name: p.name,
    label: p.label,
    kind: p.kind,
    model: p.model,
    available: p.isAvailable(),
    capabilities: p.capabilities,
  }));
}
