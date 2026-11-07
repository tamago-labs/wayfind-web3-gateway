import type { ToolDef } from "../../types";
import { getSwapQuote } from "../../lib/okx";

export const getQuoteTool: ToolDef = {
  name: "okx_get_quote",
  category: "okx",
  description: "Get an OKX DEX swap quote (Solana mainnet). Read-only.",
  inputSchema: {
    type: "object",
    properties: {
      from: { type: "string", description: "From token symbol, e.g. 'SOL'" },
      to: { type: "string", description: "To token symbol, e.g. 'USDC'" },
      amount: { type: "string", description: "Amount of the from token in base units" },
    },
    required: ["from", "to", "amount"],
    additionalProperties: false,
  },
  run: async (args) => {
    if (typeof args.from !== "string" || typeof args.to !== "string" || typeof args.amount !== "string") {
      return { text: "'from', 'to' must be symbols and 'amount' base units.", isError: true };
    }
    try {
      const q = (await getSwapQuote({
        fromSymbol: args.from,
        toSymbol: args.to,
        amount: args.amount,
      })) as {
        fromToken?: { tokenSymbol?: string; tokenUnitPrice?: string };
        toToken?: { tokenSymbol?: string; tokenUnitPrice?: string };
        toTokenAmount?: string;
        dexRouterList?: { dexName?: string; percent?: string }[];
      };
      const routers = (q.dexRouterList ?? []).map((r) => `${r.dexName} ${r.percent}%`).join(", ");
      return {
        text: `Quote: ${args.amount} ${q.fromToken?.tokenSymbol ?? args.from} (~$${q.fromToken?.tokenUnitPrice ?? "?"}) → ${q.toTokenAmount ?? "?"} ${q.toToken?.tokenSymbol ?? args.to} (~$${q.toToken?.tokenUnitPrice ?? "?"}). Route: ${routers || "n/a"}.`,
      };
    } catch (e) {
      return { text: `Quote failed: ${e instanceof Error ? e.message : e}`, isError: true };
    }
  },
};
