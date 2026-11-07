import type { ToolContext } from "./types";

// Phase 1 auth: a single throwaway seed server ID from the environment so the
// MCP handshake can be proven with Inspector before Phase 2 ships per-wallet
// IDs (McpToolConfig lookup replaces this whole file's body).
// Set MCP_SEED_SERVER_ID to any unguessable string, e.g. `openssl rand -hex 16`.
export function resolveContext(serverId: string): ToolContext | null {
  const seed = process.env.MCP_SEED_SERVER_ID;
  if (!seed || serverId !== seed) return null;
  return { serverId, walletId: "seed", enabledTools: null };
}
