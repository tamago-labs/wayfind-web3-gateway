import type { ToolContext, ToolDef } from "../../types";
import { mezoExplorerTxUrl, parseDisplayAmount } from "../../lib/evm";
import { executeRedeem } from "../musd";

export const mezoMusdRedeemTool: ToolDef = {
  name: "mezo_musd_redeem",
  category: "mezo",
  description:
    "Redeem MUSD for BTC at the $1 peg (minus protocol redemption fee). Burns MUSD, receives BTC. Policy-enforced.",
  inputSchema: {
    type: "object",
    properties: {
      musdAmount: { type: "number", description: "MUSD to redeem, display units" },
    },
    required: ["musdAmount"],
    additionalProperties: false,
  },
  run: async (args, ctx: ToolContext) => {
    if (!ctx.evmWalletId || !ctx.evmWalletAddress) {
      return {
        text: "Redemption is not enabled for this URL yet — regenerate it from Connect to attach the EVM wallet.",
        isError: true,
      };
    }
    if (typeof args.musdAmount !== "number" || !Number.isFinite(args.musdAmount) || args.musdAmount <= 0) {
      return { text: "'musdAmount' must be a number greater than 0.", isError: true };
    }
    try {
      const result = await executeRedeem(
        ctx.evmWalletId,
        parseDisplayAmount(args.musdAmount, 18),
        ctx.network,
      );
      const partial =
        result.redeemedMUSD !== result.requestedMUSD
          ? ` (partial fill — first trove covered ${result.redeemedMUSD})`
          : "";
      return {
        text:
          `Redeemed ${result.redeemedMUSD} MUSD for ~${result.btcReceivedEstimate} BTC (Mezo ${ctx.network})${partial}.\n` +
          mezoExplorerTxUrl(ctx.network, result.txHash),
      };
    } catch (e) {
      return { text: `Redeem failed: ${e instanceof Error ? e.message : e}`, isError: true };
    }
  },
};
