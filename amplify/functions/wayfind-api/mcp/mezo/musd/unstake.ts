import type { ToolContext, ToolDef } from "../../types";
import { mezoExplorerTxUrl, parseDisplayAmount } from "../../lib/evm";
import { executeUnstake } from "../musd";

export const mezoMusdUnstakeTool: ToolDef = {
  name: "mezo_musd_unstake",
  category: "mezo",
  description: "Withdraw staked MUSD from the Stability Pool. Policy-enforced.",
  inputSchema: {
    type: "object",
    properties: {
      musdAmount: { type: "number", description: "MUSD to withdraw, display units" },
    },
    required: ["musdAmount"],
    additionalProperties: false,
  },
  run: async (args, ctx: ToolContext) => {
    if (!ctx.evmWalletId || !ctx.evmWalletAddress) {
      return {
        text: "Staking is not enabled for this URL yet — regenerate it from Connect to attach the EVM wallet.",
        isError: true,
      };
    }
    if (typeof args.musdAmount !== "number" || !Number.isFinite(args.musdAmount) || args.musdAmount <= 0) {
      return { text: "'musdAmount' must be a number greater than 0.", isError: true };
    }
    try {
      const hash = await executeUnstake(
        ctx.evmWalletId,
        parseDisplayAmount(args.musdAmount, 18),
        ctx.network,
      );
      return {
        text: `Withdrew ${args.musdAmount} MUSD from the Stability Pool (Mezo ${ctx.network}): ${mezoExplorerTxUrl(ctx.network, hash)}`,
      };
    } catch (e) {
      return { text: `Unstake failed: ${e instanceof Error ? e.message : e}`, isError: true };
    }
  },
};
