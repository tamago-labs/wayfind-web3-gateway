import type { ToolDef } from "../../types";
import { isValidEvmAddress } from "../../lib/evm";
import { fetchMaxBorrowingCapacity } from "../musd";

export const mezoMusdMaxBorrowingCapacityTool: ToolDef = {
  name: "mezo_musd_max_borrowing_capacity",
  category: "mezo",
  description: "Read how much more MUSD a trove can borrow. Defaults to the attached wallet. Read-only.",
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
      const capacity = await fetchMaxBorrowingCapacity(borrower, ctx.network);
      return { text: JSON.stringify(capacity, null, 2) };
    } catch (e) {
      return { text: `Could not read borrowing capacity: ${e instanceof Error ? e.message : e}`, isError: true };
    }
  },
};
