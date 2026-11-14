import type { ToolContext, ToolDef } from "../../types";
import { isValidEvmAddress } from "../../lib/evm";
import { checkIcr } from "../musd";

export const mezoMusdCheckIcrTool: ToolDef = {
  name: "mezo_musd_check_icr",
  category: "mezo",
  description:
    "Check trove health: ICR vs MCR, TCR/recovery mode, BTC price drop to liquidation, and exact top-up/repay amounts for 150% ICR. Read-only — auto top-up needs a scheduler.",
  inputSchema: {
    type: "object",
    properties: {
      borrower: { type: "string", description: "Wallet address (defaults to the attached EVM wallet)" },
    },
    additionalProperties: false,
  },
  run: async (args, ctx: ToolContext) => {
    const borrower =
      typeof args.borrower === "string" && args.borrower.length > 0
        ? args.borrower
        : ctx.evmWalletAddress;
    if (!borrower) {
      return {
        text: "No wallet to inspect — provide borrower or regenerate from Connect to attach the EVM wallet.",
        isError: true,
      };
    }
    if (!isValidEvmAddress(borrower)) {
      return { text: "Invalid borrower address.", isError: true };
    }
    try {
      const check = await checkIcr(borrower, ctx.network);
      return { text: JSON.stringify(check, null, 2) };
    } catch (e) {
      return { text: `Could not check ICR: ${e instanceof Error ? e.message : e}`, isError: true };
    }
  },
};
