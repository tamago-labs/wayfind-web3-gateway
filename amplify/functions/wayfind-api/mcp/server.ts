import { resolveContext } from "./auth";
import { CATEGORIES, findTool, listTools, toolDescriptor } from "./registry";
import type {
  JsonRpcRequest,
  JsonRpcResponse,
  ToolContext,
} from "./types";

export interface McpHttpRequest {
  method: string;
  path: string; // e.g. /mcp/<serverId> or /mcp/<serverId>/message
  body?: string | null;
}

export interface McpHttpResult {
  statusCode: number;
  body: unknown; // handler serializes
}

const SERVER_NAME = "wayfind-mcp";
const SERVER_VERSION = "0.1.0";
const SUPPORTED_PROTOCOLS = ["2024-11-05", "2025-03-26", "2025-06-18"];

const ok = (id: JsonRpcRequest["id"], result: unknown): McpHttpResult => ({
  statusCode: 200,
  body: { jsonrpc: "2.0", id, result } satisfies JsonRpcResponse,
});

const err = (
  id: JsonRpcRequest["id"],
  code: number,
  message: string,
): McpHttpResult => ({
  statusCode: 200,
  body: { jsonrpc: "2.0", id, error: { code, message } } satisfies JsonRpcResponse,
});

function parseServerId(path: string): { serverId: string; isMessage: boolean } | null {
  const m = /^\/mcp\/([^/]+)(\/message)?\/?$/.exec(path);
  if (!m) return null;
  return { serverId: m[1], isMessage: m[2] === "/message" };
}

async function handleRpc(req: JsonRpcRequest, ctx: ToolContext): Promise<McpHttpResult> {
  if (req.jsonrpc !== "2.0" || typeof req.method !== "string") {
    return err(req.id ?? null, -32600, "Invalid Request");
  }

  // Lifecycle notification — acknowledge, no body per Streamable HTTP.
  if (req.method === "notifications/initialized") {
    return { statusCode: 202, body: "" };
  }

  if (req.method === "initialize") {
    const params = req.params ?? {};
    const clientProtocol =
      typeof params.protocolVersion === "string" ? params.protocolVersion : null;
    const protocolVersion =
      clientProtocol && SUPPORTED_PROTOCOLS.includes(clientProtocol)
        ? clientProtocol
        : SUPPORTED_PROTOCOLS[SUPPORTED_PROTOCOLS.length - 1];
    return ok(req.id, {
      protocolVersion,
      capabilities: { tools: {} },
      serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
    });
  }

  if (req.method === "tools/list") {
    return ok(req.id, { tools: listTools(ctx).map(toolDescriptor) });
  }

  if (req.method === "tools/call") {
    const params = req.params ?? {};
    const name = params.name;
    if (typeof name !== "string") {
      return err(req.id, -32602, "Missing tool name");
    }
    const tool = findTool(name, ctx);
    if (!tool) return err(req.id, -32602, `Unknown tool: ${name}`);
    const args =
      params.arguments && typeof params.arguments === "object"
        ? (params.arguments as Record<string, unknown>)
        : {};
    try {
      const r = await tool.run(args, ctx);
      return ok(req.id, {
        content: [{ type: "text", text: r.text }],
        ...(r.isError ? { isError: true } : {}),
      });
    } catch (e) {
      return err(req.id, -32603, e instanceof Error ? e.message : "Tool failed");
    }
  }

  return err(req.id, -32601, `Method not found: ${req.method}`);
}

export async function handleMcp(req: McpHttpRequest): Promise<McpHttpResult> {
  const route = parseServerId(req.path);
  if (!route) return { statusCode: 404, body: { ok: false, error: "Not found" } };

  // Unknown IDs are indistinguishable from dead ones — same 404, no hints.
  const ctx = await resolveContext(route.serverId);
  if (!ctx) return { statusCode: 404, body: { ok: false, error: "Not found" } };

  // GET /mcp/{id} — human discovery doc (paste into Inspector first).
  if (req.method === "GET" && !route.isMessage) {
    return {
      statusCode: 200,
      body: {
        name: SERVER_NAME,
        version: SERVER_VERSION,
        protocol: "streamable-http",
        messageUrl: `/mcp/${route.serverId}/message`,
        categories: CATEGORIES,
        auth: "server-id-in-path",
      },
    };
  }

  if (req.method === "POST" && route.isMessage) {
    if (!req.body) return err(null, -32700, "Parse error: empty body");
    let rpc: JsonRpcRequest;
    try {
      rpc = JSON.parse(req.body) as JsonRpcRequest;
    } catch {
      return err(null, -32700, "Parse error: invalid JSON");
    }
    return handleRpc(rpc, ctx);
  }

  return { statusCode: 404, body: { ok: false, error: "Not found" } };
}
