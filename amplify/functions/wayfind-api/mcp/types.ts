// Shared MCP shapes. Transport is hand-rolled Streamable HTTP (Lambda-friendly,
// stateless): POST JSON-RPC to /mcp/{serverId}/message. The SDK package is only
// used for protocol constants, never for its stateful transports.

export type Category = "wallet" | "stocks" | "payments" | "okx" | "usdc";

export interface ToolContext {
  serverId: string;
  walletId: string;
  // Null on pre-Phase-3 rows — wallet tools refuse with a re-issue hint.
  walletAddress: string | null;
  network: "mainnet" | "testnet";
  enabledTools: string[] | null; // null = everything enabled (pre-Phase-2 seed mode)
}

export interface ToolResult {
  text: string;
  isError?: boolean;
}

export interface ToolDef {
  name: string;
  category: Category;
  description: string;
  // JSON Schema for the tool input (draft 2020-12 compatible subset).
  inputSchema: Record<string, unknown>;
  run: (args: Record<string, unknown>, ctx: ToolContext) => Promise<ToolResult> | ToolResult;
}

// Minimal JSON-RPC 2.0 shapes — just enough for initialize / tools/*.
export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}
