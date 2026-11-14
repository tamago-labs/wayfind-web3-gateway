import type { ToolContext, ToolDef } from "../../types";
import { mezoExplorerTxUrl, parseDisplayAmount } from "../../lib/evm";
import { executeRepay } from "../musd";

export const mezoMusdRepayTool: ToolDef = {
  name: "mezo_musd_repay",
  category: "mezo",
  description:
    "Repay MUSD debt on your trove. Approves the MUSD spend first if needed, then repays. Policy-enforced.",
  inputSchema: {
    type: "object",
    properties: {
      musdAmount: { type: "number", description: "MUSD to repay, display units" },
    },
    required: ["musdAmount"],
    additionalProperties: false,
  },
  run: async (args, ctx: ToolContext) => {
    if (!ctx.evmWalletId || !ctx.evmWalletAddress) {
      return {
        text: "Troves are not enabled for this URL yet — regenerate it from Connect to attach the EVM wallet.",
        isError: true,
      };
    }
    if (typeof args.musdAmount !== "number" || !Number.isFinite(args.musdAmount) || args.musdAmount <= 0) {
      return { text: "'musdAmount' must be a number greater than 0.", isError: true };
    }
    try {
      const { approveHash, repayHash } = await executeRepay(
        ctx.evmWalletId,
        ctx.evmWalletAddress,
        parseDisplayAmount(args.musdAmount, 18),
        ctx.network,
      );
      const lines = [
        `Repaid ${args.musdAmount} MUSD (Mezo ${ctx.network}): ${mezoExplorerTxUrl(ctx.network, repayHash)}`,
      ];
      if (approveHash) lines.push(`Approve: ${mezoExplorerTxUrl(ctx.network, approveHash)}`);
      return { text: lines.join("\n") };
    } catch (e) {
      return { text: `Repay failed: ${e instanceof Error ? e.message : e}`, isError: true };
    }
  },
};
