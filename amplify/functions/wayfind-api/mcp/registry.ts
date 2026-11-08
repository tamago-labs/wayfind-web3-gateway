import type { Category, ToolContext, ToolDef } from "./types";
import { getBalancesTool } from "./tools/wallet/get_balances";
import { getHistoryTool } from "./tools/wallet/get_history";
import { getTransactionTool } from "./tools/wallet/get_transaction";
import { getWalletAddressTool } from "./tools/wallet/get_wallet_address";
import { sendTokensTool } from "./tools/wallet/send_tokens";
import { getQuoteTool } from "./tools/okx/get_quote";
import { swapTokensTool } from "./tools/okx/swap_tokens";
import { unifiedBalanceTool } from "./tools/usdc/unified_balance";
import { usdcChainsTool } from "./tools/usdc/chains";
import { usdcDepositTool } from "./tools/usdc/deposit";
import { usdcSpendTool } from "./tools/usdc/spend";

// Registry: the single place that decides what tools/list returns.
// New tools land here as one import + one spread — nothing else changes.
// Pure allowlist: only tools named in enabledTools are listed. New URLs
// start with none enabled; owners switch them on one by one in Tools.
const allTools: ToolDef[] = [
  getBalancesTool,
  getHistoryTool,
  getTransactionTool,
  getWalletAddressTool,
  sendTokensTool,
  getQuoteTool,
  swapTokensTool,
  unifiedBalanceTool,
  usdcChainsTool,
  usdcDepositTool,
  usdcSpendTool,
];

export const CATEGORIES: { id: Category; label: string }[] = [
  { id: "wallet", label: "Wallet Operations" },
  { id: "okx", label: "OKX DEX Swaps" },
  { id: "usdc", label: "Stablecoin Finance" },
];

export function listTools(ctx: ToolContext): ToolDef[] {
  if (ctx.enabledTools === null) return allTools;
  const enabled = new Set(ctx.enabledTools);
  return allTools.filter((t) => enabled.has(t.name));
}

export function findTool(name: string, ctx: ToolContext): ToolDef | undefined {
  return listTools(ctx).find((t) => t.name === name);
}

export function toolDescriptor(t: ToolDef) {
  return { name: t.name, description: t.description, inputSchema: t.inputSchema };
}
