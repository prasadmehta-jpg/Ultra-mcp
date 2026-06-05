/**
 * Ultra MCP public API (programmatic use).
 *
 * Entry points:
 *   - MCP server: `npm start` / `dist/server.js` (bin: ultra-mcp)
 *   - CLI:        `dist/cli.js` (bin: ultra-mcp-cli)
 *   - Library:    import { runUltra } from "ultra-mcp"
 */
export { runUltra, previewRoutes, listProviders } from "./ultra.js";
export { routeTask, detectAspects } from "./router.js";
export { allProviders, getProvider } from "./providers/registry.js";
export type {
  Provider,
  ProviderResult,
  RouteDecision,
  UltraOptions,
  UltraResult,
  UltraTrace,
  UltraMode,
  Capability,
  Contradiction,
} from "./types.js";
