import type { ToolContext, ToolDef } from "../../types";
import { mezoExplorerTxUrl, parseDisplayAmount } from "../../lib/evm";
import { executeOpenTrove } from "../musd";

export const mezoMusdOpenTroveTool: ToolDef = {
  name: "mezo_musd_open_trove",
  category: "mezo",
  description:
    "Open a MUSD trove: deposit BTC collateral and borrow MUSD (min 1800). Fee quoted first and capped; contract adds fee + 200 MUSD deposit.",
  inputSchema: {
    type: "object",
    properties: {
      musdAmount: { type: "number", description: "MUSD to borrow, display units (min 1800)" },
      collateralAmount: { type: "number", description: "BTC to deposit, display units" },
      maxFeePercent: {
        type: "number",
        description: "Abort if the borrowing fee exceeds this percent (default 5)",
      },
    },
    required: ["musdAmount", "collateralAmount"],
    additionalProperties: false,
  },
  run: async (args, ctx: ToolContext) => {
    if (!ctx.evmWalletId || !ctx.evmWalletAddress) {
      return {
        text: "Troves are not enabled for this URL yet — regenerate it from Connect to attach the EVM wallet.",
        isError: true,
      };
    }
    if (
      typeof args.musdAmount !== "number" ||
      !Number.isFinite(args.musdAmount) ||
      args.musdAmount <= 0 ||
      typeof args.collateralAmount !== "number" ||
      !Number.isFinite(args.collateralAmount) ||
      args.collateralAmount <= 0
    ) {
      return { text: "'musdAmount' and 'collateralAmount' must be numbers greater than 0.", isError: true };
    }
    const maxFeePercent =
      typeof args.maxFeePercent === "number" && Number.isFinite(args.maxFeePercent) && args.maxFeePercent > 0
        ? args.maxFeePercent
        : 5;
    try {
      const result = await executeOpenTrove(
        ctx.evmWalletId,
        ctx.evmWalletAddress,
        parseDisplayAmount(args.musdAmount, 18),
        parseDisplayAmount(args.collateralAmount, 18),
        maxFeePercent,
        ctx.network,
      );
      return {
        text:
          `Opened trove (Mezo ${ctx.network}): ${result.collateralBTC} BTC collateral, ` +
          `${result.musdBorrowed} MUSD borrowed, fee ${result.borrowingFeeMUSD} MUSD (${result.feePercent}), ` +
          `total debt ${result.totalDebtMUSD} MUSD.\n${mezoExplorerTxUrl(ctx.network, result.txHash)}`,
      };
    } catch (e) {
      return { text: `Open trove failed: ${e instanceof Error ? e.message : e}`, isError: true };
    }
  },
};
