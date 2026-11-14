import type { ToolContext, ToolDef } from "../../types";
import { mezoExplorerTxUrl, parseDisplayAmount } from "../../lib/evm";
import { executeWithdrawCollateral } from "../musd";

export const mezoMusdWithdrawCollateralTool: ToolDef = {
  name: "mezo_musd_withdraw_collateral",
  category: "mezo",
  description: "Withdraw BTC collateral from your trove. Fails if it would drop ICR under the minimum. Policy-enforced.",
  inputSchema: {
    type: "object",
    properties: {
      collateralAmount: { type: "number", description: "BTC to withdraw, display units" },
    },
    required: ["collateralAmount"],
    additionalProperties: false,
  },
  run: async (args, ctx: ToolContext) => {
    if (!ctx.evmWalletId || !ctx.evmWalletAddress) {
      return {
        text: "Troves are not enabled for this URL yet — regenerate it from Connect to attach the EVM wallet.",
        isError: true,
      };
    }
    if (typeof args.collateralAmount !== "number" || !Number.isFinite(args.collateralAmount) || args.collateralAmount <= 0) {
      return { text: "'collateralAmount' must be a number greater than 0.", isError: true };
    }
    try {
      const hash = await executeWithdrawCollateral(
        ctx.evmWalletId,
        parseDisplayAmount(args.collateralAmount, 18),
        ctx.network,
      );
      return {
        text: `Withdrew ${args.collateralAmount} BTC collateral (Mezo ${ctx.network}): ${mezoExplorerTxUrl(ctx.network, hash)}`,
      };
    } catch (e) {
      return { text: `Withdraw failed: ${e instanceof Error ? e.message : e}`, isError: true };
    }
  },
};
