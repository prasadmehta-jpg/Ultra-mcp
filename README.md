# Ultra MCP

**A provider-agnostic AI-to-AI collaboration layer — delivered as an MCP server.**

One request → many AI minds → one synthesized answer.

Today people manually jump between ChatGPT, Claude, Gemini and local models. Ultra MCP removes that friction: it decides which AI is best for each part of a task, routes the subtasks, collects the outputs, detects contradictions, scores confidence, and synthesizes a single result.

> Think of a food court: one order, distributed to the specialist counters best suited to each dish, served back as one complete meal. The customer never thinks about which kitchen made what.

---

## What's in the box

Two ways to run the exact same engine:

| Entry point | Command | Use it for |
|---|---|---|
| **MCP server** (stdio) | `npm start` | Plug Ultra into Claude Desktop, Claude Code, or any MCP client as tools |
| **CLI** | `npm run cli -- "your task"` | Quick local runs / scripting |
| **Library** | `import { runUltra } from "ultra-mcp"` | Embed in your own app |

### MCP tools exposed
- **`ultra_collaborate`** — the main event. Route a task across providers and return one synthesized answer plus a full transparency trace. Modes: `synthesis` (default), `debate`, `raw`.
- **`ultra_route_preview`** — dry-run the router (no provider calls, free): see how a task decomposes and which provider gets each aspect, *with reasons*.
- **`ultra_list_providers`** — see every registered provider, whether it's available, and its capability profile.

---

## How it works

```
task ─▶ ethics pre-flight ─▶ router ─▶ orchestrator ─▶ analysis ─▶ synthesizer ─▶ answer + trace
                              (aspect    (parallel,     (confidence,   (consensus /
                              detection,  graceful       contradiction  debate /
                              capability  per-provider   detection)     raw)
                              matching,   failure)
                              diversity)
```

1. **Ethics pre-flight** — refuses plainly harmful tasks before spending any calls.
2. **Dynamic routing** — detects the *aspects* a task touches (technical, business, legal, research, market, creative, privacy, reasoning) from lexical signals, then assigns each aspect to the available provider with the highest capability score, spreading work across providers for genuine multi-mind coverage. **Every route carries a human-readable reason.**
3. **Orchestration** — runs all routes concurrently; a provider failure becomes a recorded failed result instead of crashing the run (*fail gracefully*).
4. **Analysis** — heuristic **confidence scoring** per output (transparent, never a black box) and **contradiction detection** across providers.
5. **Synthesis** — a chosen provider merges everything. Consensus (MBR) flavour: it prefers conclusions multiple providers independently support and marks single-source claims *tentative*; contradictions are surfaced and reconciled; contributions are attributed.
6. **Audit trail** — the full `UltraTrace` (routes, reasons, latencies, confidences, contradictions, notes) is returned and optionally written to disk.

---

## Install

```bash
npm install
cp .env.example .env   # add the keys you have — any subset works
npm run build
```

Ultra runs with **any combination** of providers, including **none**: with zero keys it falls back to a clearly-labelled offline mock so you can exercise the whole pipeline.

## Run

```bash
# CLI
npm run cli -- "Evaluate this startup from technical, business, investor, and legal angles."
npm run cli -- --mode debate --providers anthropic,gemini "Should we build on edge or cloud?"
npm run cli -- --json "..."           # full trace as JSON

# MCP server (stdio)
npm start

# Inspect the server with the official MCP Inspector
npm run inspect
```

### Use in Claude Desktop / Claude Code

Add to your MCP client config (adjust the path):

```json
{
  "mcpServers": {
    "ultra-mcp": {
      "command": "node",
      "args": ["/absolute/path/to/ultra-mcp/dist/server.js"],
      "env": {
        "OPENAI_API_KEY": "...",
        "ANTHROPIC_API_KEY": "...",
        "GEMINI_API_KEY": "..."
      }
    }
  }
}
```

---

## Providers

| Provider | Kind | Default model (override via env) | Available when |
|---|---|---|---|
| Anthropic Claude | cloud | `claude-sonnet-4-5` | `ANTHROPIC_API_KEY` set |
| OpenAI GPT | cloud | `gpt-5.1` | `OPENAI_API_KEY` set |
| Google Gemini | cloud | `gemini-2.5-pro` | `GEMINI_API_KEY` set |
| Local LLM (Ollama) | local | `llama3.1` | `OLLAMA_ENABLED=true` |
| Offline Mock | mock | — | always (last resort) |

### Adding a provider

1. Create `src/providers/yourprovider.ts` exporting a `Provider` (implement `isAvailable()` and `call()`, declare a `capabilities` profile).
2. Register it in `src/providers/registry.ts`.

That's it — the router, analysis and synthesizer pick it up automatically.

---

## Design principles (from the brief, and how they're met)

- **Provider & model agnostic** — registry + env-configurable models.
- **Extensible** — one file + one line to add a provider.
- **Transparent routing / explainable decisions** — every route has a reason; `ultra_route_preview` shows the plan for free.
- **Privacy first** — local Ollama provider; prompts to it never leave the machine.
- **Human override** — force providers, synthesizer, or mode.
- **Fail gracefully** — per-provider failures, synthesizer failure, and zero-key runs all degrade instead of crashing.
- **Audit trails** — full structured trace, optionally persisted.

## Status & honest limits

MVP / experimental. Confidence scores and contradiction detection are **transparent heuristics, not calibrated guarantees** — they're decision aids, surfaced openly. The ethics pre-flight is a coarse guardrail, not a complete safety system; downstream models still apply their own policies.

## What this is not

Ultra MCP is a general-purpose, domain-neutral collaboration layer — not tied to any specific business, vertical, or product. It is not a surveillance tool, and it is not a replacement for the official MCP standard — it is built *on* it.
