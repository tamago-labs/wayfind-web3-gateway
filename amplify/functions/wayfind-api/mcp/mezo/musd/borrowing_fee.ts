import type { ToolDef } from "../../types";
import { parseDisplayAmount } from "../../lib/evm";
import { fetchBorrowingFee } from "../musd";

export const mezoMusdBorrowingFeeTool: ToolDef = {
  name: "mezo_musd_borrowing_fee",
  category: "mezo",
  description: "Quote the MUSD borrowing fee for a given borrow amount. Read-only.",
  inputSchema: {
    type: "object",
    properties: {
      musdAmount: { type: "number", description: "MUSD to borrow, display units (e.g. 1800)" },
    },
    required: ["musdAmount"],
    additionalProperties: false,
  },
  run: async (args, ctx) => {
    if (typeof args.musdAmount !== "number" || !Number.isFinite(args.musdAmount) || args.musdAmount <= 0) {
      return { text: "'musdAmount' must be a number greater than 0.", isError: true };
    }
    try {
      const wei = parseDisplayAmount(args.musdAmount, 18);
      const quote = await fetchBorrowingFee(wei, ctx.network);
      return { text: JSON.stringify(quote, null, 2) };
    } catch (e) {
      return { text: `Could not quote fee: ${e instanceof Error ? e.message : e}`, isError: true };
    }
  },
};
