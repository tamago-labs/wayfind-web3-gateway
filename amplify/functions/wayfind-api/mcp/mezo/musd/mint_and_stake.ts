import type { ToolContext, ToolDef } from "../../types";
import { mezoExplorerTxUrl, parseDisplayAmount } from "../../lib/evm";
import { executeMintAndStake } from "../musd";

export const mezoMusdMintAndStakeTool: ToolDef = {
  name: "mezo_musd_mint_and_stake",
  category: "mezo",
  description:
    "One-flow mint-and-stake: open a trove borrowing MUSD, then stake some into the Stability Pool for BTC liquidation gains. Each step confirms before the next. Policy-enforced.",
  inputSchema: {
    type: "object",
    properties: {
      collateralAmount: { type: "number", description: "BTC to deposit, display units" },
      musdAmount: { type: "number", description: "MUSD to borrow, display units (min 1800)" },
      stakeAmount: { type: "number", description: "MUSD to stake (≤ borrowed)" },
      maxFeePercent: {
        type: "number",
        description: "Abort if the borrowing fee exceeds this percent (default 5)",
      },
    },
    required: ["collateralAmount", "musdAmount", "stakeAmount"],
    additionalProperties: false,
  },
  run: async (args, ctx: ToolContext) => {
    if (!ctx.evmWalletId || !ctx.evmWalletAddress) {
      return {
        text: "Strategy is not enabled for this URL yet — regenerate it from Connect to attach the EVM wallet.",
        isError: true,
      };
    }
    for (const k of ["collateralAmount", "musdAmount", "stakeAmount"] as const) {
      const v = args[k];
      if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) {
        return { text: `'${k}' must be a number greater than 0.`, isError: true };
      }
    }
    const maxFeePercent =
      typeof args.maxFeePercent === "number" && Number.isFinite(args.maxFeePercent) && args.maxFeePercent > 0
        ? args.maxFeePercent
        : 5;
    try {
      const r = await executeMintAndStake(
        ctx.evmWalletId,
        ctx.evmWalletAddress,
        parseDisplayAmount(args.collateralAmount as number, 18),
        parseDisplayAmount(args.musdAmount as number, 18),
        parseDisplayAmount(args.stakeAmount as number, 18),
        maxFeePercent,
        ctx.network,
      );
      return {
        text:
          `Mint-and-stake done (Mezo ${ctx.network}): borrowed ${r.musdBorrowed} MUSD against BTC collateral, ` +
          `staked ${r.musdStaked} MUSD (pool share now ${r.poolShareAfter}, TCR ${r.tcr}${r.recoveryMode ? ", RECOVERY MODE" : ""}).\n` +
          `Open: ${mezoExplorerTxUrl(ctx.network, r.openTxHash)}\n` +
          (r.approveHash ? `Approve: ${mezoExplorerTxUrl(ctx.network, r.approveHash)}\n` : "") +
          `Stake: ${mezoExplorerTxUrl(ctx.network, r.stakeTxHash)}`,
      };
    } catch (e) {
      return { text: `Mint-and-stake failed: ${e instanceof Error ? e.message : e}`, isError: true };
    }
  },
};
