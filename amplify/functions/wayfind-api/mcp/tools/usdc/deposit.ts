import type { ToolDef } from "../../types";
import { circleAdapter, circleChain, unifiedBalanceContext } from "../../lib/circle";

export const usdcDepositTool: ToolDef = {
  name: "usdc_deposit",
  category: "usdc",
  description:
    "Deposit USDC from the attached Solana wallet into Circle Unified Balance. Limits are enforced by the Privy policy.",
  inputSchema: {
    type: "object",
    properties: {
      amount: { type: "number", description: "USDC amount in display units, e.g. 1.5" },
    },
    required: ["amount"],
    additionalProperties: false,
  },
  run: async (args, ctx) => {
    if (!ctx.walletAddress) {
      return {
        text: "Deposits are not enabled for this URL yet — regenerate it from Connect to attach the wallet.",
        isError: true,
      };
    }
    if (typeof args.amount !== "number" || !Number.isFinite(args.amount) || args.amount <= 0) {
      return { text: "'amount' must be a number greater than 0.", isError: true };
    }
    try {
      const adapter = await circleAdapter(ctx.walletAddress, ctx.walletId, ctx.network);
      const context = await unifiedBalanceContext();
      const { deposit } = await import("@circle-fin/unified-balance-kit");
      const result = (await deposit(context, {
        from: { adapter, chain: circleChain(ctx.network) },
        amount: String(args.amount),
        token: "USDC",
      })) as { txHash?: string; hash?: string };
      const hash = result.txHash ?? result.hash ?? "";
      return {
        text: hash
          ? `Deposited ${args.amount} USDC into unified balance (${ctx.network}): https://solscan.io/tx/${hash}`
          : `Deposit submitted (${ctx.network}). Check usdc_unified_balance for confirmation.`,
      };
    } catch (e) {
      return { text: `Deposit failed: ${e instanceof Error ? e.message : e}`, isError: true };
    }
  },
};
