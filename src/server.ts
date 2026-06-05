#!/usr/bin/env node
import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { runUltra, previewRoutes, listProviders } from "./ultra.js";
import type { UltraMode } from "./types.js";

const server = new McpServer({ name: "ultra-mcp", version: "0.2.0" });

const modeEnum = z.enum(["synthesis", "debate", "raw"]);

server.registerTool(
  "ultra_collaborate",
  {
    title: "Ultra MCP — Collaborate",
    description:
      "Route one task across multiple AI providers, detect contradictions, score confidence, and return one synthesized answer with a full transparency trace. Use for multi-perspective tasks (e.g. 'evaluate this from technical, business, and legal angles').",
    inputSchema: {
      task: z.string().describe("The task or question to collaborate on."),
      providers: z
        .array(z.string())
        .optional()
        .describe("Override: restrict to these provider names (e.g. ['anthropic','gemini'])."),
      synthesizer: z
        .string()
        .optional()
        .describe("Override: provider name that produces the final synthesis."),
      mode: modeEnum
        .optional()
        .describe("synthesis (default) | debate (stage disagreement, then converge) | raw (no LLM merge)."),
      maxTokens: z.number().int().positive().optional(),
    },
    outputSchema: {
      finalAnswer: z.string(),
      mode: z.string(),
      synthesizer: z.string().nullable(),
      overallConfidence: z.number(),
      providersUsed: z.array(z.string()),
      contradictionCount: z.number(),
      traceJson: z.string().describe("Full UltraTrace as JSON for auditing."),
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
  async ({ task, providers, synthesizer, mode, maxTokens }) => {
    const result = await runUltra(task, {
      providers,
      synthesizer,
      mode: mode as UltraMode | undefined,
      maxTokens,
    });
    const t = result.trace;
    const structured = {
      finalAnswer: result.finalAnswer,
      mode: t.mode,
      synthesizer: t.synthesizer,
      overallConfidence: t.overallConfidence,
      providersUsed: [...new Set(t.results.map((r) => r.provider))],
      contradictionCount: t.contradictions.length,
      traceJson: JSON.stringify(t),
    };
    const summary = [
      result.finalAnswer,
      "",
      "—".repeat(20),
      `mode=${t.mode} · confidence=${t.overallConfidence.toFixed(2)} · synthesizer=${t.synthesizer ?? "none"}`,
      `providers=${structured.providersUsed.join(", ")} · contradictions=${t.contradictions.length}`,
    ].join("\n");
    return {
      content: [{ type: "text", text: summary }],
      structuredContent: structured,
    };
  }
);

server.registerTool(
  "ultra_route_preview",
  {
    title: "Ultra MCP — Route Preview",
    description:
      "Dry-run the router: show how a task would be decomposed and which provider would handle each aspect, with reasons. Makes NO provider calls (free, instant).",
    inputSchema: {
      task: z.string().describe("The task to preview routing for."),
      providers: z.array(z.string()).optional(),
    },
    outputSchema: {
      blocked: z.boolean(),
      reason: z.string().optional(),
      notes: z.array(z.string()),
      routes: z.array(
        z.object({
          provider: z.string(),
          role: z.string(),
          aspect: z.string(),
          reason: z.string(),
          fallbackFrom: z.string().optional(),
        })
      ),
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  async ({ task, providers }) => {
    const preview = previewRoutes(task, { providers });
    const structured = {
      blocked: preview.blocked,
      ...(preview.reason ? { reason: preview.reason } : {}),
      notes: ("notes" in preview ? preview.notes : []) as string[],
      routes: preview.routes.map((r) => ({
        provider: r.provider,
        role: r.role,
        aspect: r.aspect,
        reason: r.reason,
        ...(r.fallbackFrom ? { fallbackFrom: r.fallbackFrom } : {}),
      })),
    };
    const text = preview.blocked
      ? preview.reason ?? "Blocked."
      : structured.routes
          .map((r) => `• [${r.aspect}] ${r.role} → ${r.provider} — ${r.reason}`)
          .join("\n");
    return { content: [{ type: "text", text }], structuredContent: structured };
  }
);

server.registerTool(
  "ultra_list_providers",
  {
    title: "Ultra MCP — List Providers",
    description:
      "List all registered providers, whether each is currently available (key present / enabled), and their capability profiles.",
    inputSchema: {},
    outputSchema: {
      providers: z.array(
        z.object({
          name: z.string(),
          label: z.string(),
          kind: z.string(),
          model: z.string(),
          available: z.boolean(),
          capabilities: z.record(z.string(), z.number()),
        })
      ),
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  async () => {
    const providers = listProviders();
    const text = providers
      .map(
        (p) =>
          `${p.available ? "✓" : "✗"} ${p.name} (${p.kind}, ${p.model}) — ${p.label}`
      )
      .join("\n");
    return {
      content: [{ type: "text", text }],
      structuredContent: { providers },
    };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // stderr is safe: stdout is reserved for the JSON-RPC protocol.
  console.error("Ultra MCP server running on stdio.");
}

main().catch((err) => {
  console.error("Ultra MCP failed to start:", err);
  process.exit(1);
});
