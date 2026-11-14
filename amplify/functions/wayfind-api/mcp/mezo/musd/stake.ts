import type { ToolContext, ToolDef } from "../../types";
import { mezoExplorerTxUrl, parseDisplayAmount } from "../../lib/evm";
import { executeStake } from "../musd";

export const mezoMusdStakeTool: ToolDef = {
  name: "mezo_musd_stake",
  category: "mezo",
  description:
    "Stake MUSD into the Stability Pool to earn BTC liquidation gains + interest. Approves the pool first if needed. Policy-enforced.",
  inputSchema: {
    type: "object",
    properties: {
      musdAmount: { type: "number", description: "MUSD to stake, display units" },
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
      const { approveHash, stakeHash } = await executeStake(
        ctx.evmWalletId,
        ctx.evmWalletAddress,
        parseDisplayAmount(args.musdAmount, 18),
        ctx.network,
      );
      const lines = [
        `Staked ${args.musdAmount} MUSD into the Stability Pool (Mezo ${ctx.network}): ${mezoExplorerTxUrl(ctx.network, stakeHash)}`,
      ];
      if (approveHash) lines.push(`Approve: ${mezoExplorerTxUrl(ctx.network, approveHash)}`);
      return { text: lines.join("\n") };
    } catch (e) {
      return { text: `Stake failed: ${e instanceof Error ? e.message : e}`, isError: true };
    }
  },
};
