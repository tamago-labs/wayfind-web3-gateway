import type { ToolContext, ToolDef } from "../../types";
import { isValidEvmAddress } from "../../lib/evm";
import { fetchTroveStatus } from "../musd";

export const mezoMusdTroveStatusTool: ToolDef = {
  name: "mezo_musd_trove_status",
  category: "mezo",
  description: "Read a Mezo trove: collateral, debt, ICR, interest owed. Defaults to the attached wallet.",
  inputSchema: {
    type: "object",
    properties: {
      borrower: { type: "string", description: "Wallet address (defaults to the attached EVM wallet)" },
    },
    additionalProperties: false,
  },
  run: async (args, ctx) => {
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
      const status = await fetchTroveStatus(borrower, ctx.network);
      return { text: JSON.stringify(status, null, 2) };
    } catch (e) {
      return { text: `Could not read trove: ${e instanceof Error ? e.message : e}`, isError: true };
    }
  },
};
