import type { Category, ToolContext, ToolDef } from "./types";
import { addTool, divideTool, multiplyTool, pingTool, subtractTool } from "./tools/system/math";
import { pingTool as ping } from "./tools/system/ping";
import {
  getBalanceTool,
  getBalancesTool,
} from "./tools/wallet/get_balances";
import { getHistoryTool } from "./tools/wallet/get_history";
import { getTransactionTool } from "./tools/wallet/get_transaction";
import { getWalletAddressTool } from "./tools/wallet/get_wallet_address";
import { sendSolTool } from "./tools/wallet/send_sol";

// Registry: the single place that decides what tools/list returns.
// New tools land here as one import + one spread — nothing else changes.
const allTools: ToolDef[] = [
  ping,
  addTool,
  subtractTool,
  multiplyTool,
  divideTool,
  getBalancesTool,
  getBalanceTool, // deprecated alias, same handler
  getHistoryTool,
  getTransactionTool,
  getWalletAddressTool,
  sendSolTool,
];

export const CATEGORIES: { id: Category; label: string }[] = [
  { id: "system", label: "System" },
  { id: "wallet", label: "Wallet operations" },
  { id: "stocks", label: "Tokenized stocks" },
  { id: "trading", label: "OKX DEX trading" },
  { id: "payments", label: "Circle payments" },
];

export function listTools(ctx: ToolContext): ToolDef[] {
  if (ctx.enabledTools === null) return allTools;
  const enabled = new Set(ctx.enabledTools);
  // System tools are always on — they are the connectivity smoke test.
  return allTools.filter((t) => t.category === "system" || enabled.has(t.name));
}

export function findTool(name: string, ctx: ToolContext): ToolDef | undefined {
  return listTools(ctx).find((t) => t.name === name);
}

export function toolDescriptor(t: ToolDef) {
  return { name: t.name, description: t.description, inputSchema: t.inputSchema };
}
