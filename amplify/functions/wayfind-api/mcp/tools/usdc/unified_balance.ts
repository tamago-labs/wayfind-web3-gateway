import type { ToolDef } from "../../types";
import { circleAdapter, circleChain, unifiedBalanceContext } from "../../lib/circle";

export const unifiedBalanceTool: ToolDef = {
  name: "usdc_unified_balance",
  category: "usdc",
  description: "Show total USDC/EURC unified balance and per-chain breakdown. Read-only.",
  inputSchema: { type: "object", properties: {}, additionalProperties: false },
  run: async (_args, ctx) => {
    if (!ctx.walletAddress) {
      return {
        text: "Unified balance is not enabled for this URL yet — regenerate it from Connect to attach the wallet.",
        isError: true,
      };
    }
    try {
      const adapter = await circleAdapter(ctx.walletAddress, ctx.walletId, ctx.network);
      const context = await unifiedBalanceContext();
      const { getBalances } = await import("@circle-fin/unified-balance-kit");
      const result = (await getBalances(context, {
        sources: [{ adapter }],
        networkType: ctx.network,
        includePending: true,
      })) as {
        token?: string;
        totalConfirmedBalance?: string;
        totalPendingBalance?: string;
        breakdown?: { breakdown?: { chain?: string; confirmedBalance?: string; pendingBalance?: string }[] }[];
      };
      const lines: string[] = [];
      for (const group of result.breakdown ?? []) {
        for (const item of group.breakdown ?? []) {
          if (item.chain === circleChain(ctx.network) || Number(item.confirmedBalance ?? 0) > 0) {
            lines.push(`${item.chain}: ${item.confirmedBalance ?? "0"} confirmed`);
          }
        }
      }
      return {
        text: `Unified ${result.token ?? "USDC"}: ${result.totalConfirmedBalance ?? "0"} confirmed on ${ctx.network}. ${lines.join(" · ") || "No deposits yet — use usdc_deposit."}`,
      };
    } catch (e) {
      return { text: `Unified balance lookup failed: ${e instanceof Error ? e.message : e}`, isError: true };
    }
  },
};
