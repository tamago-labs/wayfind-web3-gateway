import type { ToolDef } from "../../types";
import { fetchInterestRate } from "../musd";

export const mezoMusdInterestRateTool: ToolDef = {
  name: "mezo_musd_interest_rate",
  category: "mezo",
  description: "Read the current MUSD borrowing interest rate. Read-only.",
  inputSchema: {
    type: "object",
    properties: {},
    additionalProperties: false,
  },
  run: async (_args, ctx) => {
    try {
      const rate = await fetchInterestRate(ctx.network);
      return { text: JSON.stringify(rate, null, 2) };
    } catch (e) {
      return { text: `Could not read interest rate: ${e instanceof Error ? e.message : e}`, isError: true };
    }
  },
};
