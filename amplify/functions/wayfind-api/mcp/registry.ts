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
import { mezoGetWalletAddressTool } from "./mezo/get_wallet_address";
import { mezoGetBalancesTool } from "./mezo/get_balances";
import { mezoGetTransactionTool } from "./mezo/get_transaction";
import { mezoSendTokensTool } from "./mezo/send_tokens";
import { mezoMusdTroveStatusTool } from "./mezo/musd/trove_status";
import { mezoMusdBorrowingFeeTool } from "./mezo/musd/borrowing_fee";
import { mezoMusdSystemOverviewTool } from "./mezo/musd/system_overview";
import { mezoMusdInterestRateTool } from "./mezo/musd/interest_rate";
import { mezoMusdProtocolConstantsTool } from "./mezo/musd/protocol_constants";
import { mezoMusdMaxBorrowingCapacityTool } from "./mezo/musd/max_borrowing_capacity";
import { mezoMusdOpenTroveTool } from "./mezo/musd/open_trove";
import { mezoMusdAddCollateralTool } from "./mezo/musd/add_collateral";
import { mezoMusdWithdrawCollateralTool } from "./mezo/musd/withdraw_collateral";
import { mezoMusdRepayTool } from "./mezo/musd/repay";
import { mezoMusdCloseTroveTool } from "./mezo/musd/close_trove";
import { mezoMusdRedeemTool } from "./mezo/musd/redeem";
import { mezoMusdPoolStatusTool } from "./mezo/musd/pool_status";
import { mezoMusdStakeTool } from "./mezo/musd/stake";
import { mezoMusdUnstakeTool } from "./mezo/musd/unstake";

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
  mezoGetWalletAddressTool,
  mezoGetBalancesTool,
  mezoGetTransactionTool,
  mezoSendTokensTool,
  mezoMusdTroveStatusTool,
  mezoMusdBorrowingFeeTool,
  mezoMusdSystemOverviewTool,
  mezoMusdInterestRateTool,
  mezoMusdProtocolConstantsTool,
  mezoMusdMaxBorrowingCapacityTool,
  mezoMusdOpenTroveTool,
  mezoMusdAddCollateralTool,
  mezoMusdWithdrawCollateralTool,
  mezoMusdRepayTool,
  mezoMusdCloseTroveTool,
  mezoMusdRedeemTool,
  mezoMusdPoolStatusTool,
  mezoMusdStakeTool,
  mezoMusdUnstakeTool,
];

export const CATEGORIES: { id: Category; label: string }[] = [
  { id: "wallet", label: "Wallet Operations" },
  { id: "okx", label: "OKX DEX Swaps" },
  { id: "usdc", label: "Stablecoin Finance" },
  { id: "mezo", label: "Mezo EVM" },
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
