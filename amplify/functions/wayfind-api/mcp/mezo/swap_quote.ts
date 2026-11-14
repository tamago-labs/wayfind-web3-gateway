import type { ToolContext, ToolDef } from "../types";
import { findMezoBySymbol, formatEvmAmount, parseDisplayAmount } from "../lib/evm";
import { quoteSwap } from "./musd";

export const mezoSwapQuoteTool: ToolDef = {
  name: "mezo_swap_quote",
  category: "mezo",
  description:
    "Quote a Mezo swap (MUSD/BTC volatile, MUSD/mUSDC + MUSD/mUSDT stable). Read-only — reports out-amount and min-out at slippage.",
  inputSchema: {
    type: "object",
    properties: {
      fromToken: { type: "string", description: "Input symbol: MUSD, mUSDC, or mUSDT (BTC has no approve path yet)" },
      toToken: { type: "string", description: "Output symbol: BTC, MUSD, mUSDC, or mUSDT" },
      amount: { type: "number", description: "Input amount, display units" },
      slippagePercent: { type: "number", description: "Min-out slippage guard (default 0.5)" },
    },
    required: ["fromToken", "toToken", "amount"],
    additionalProperties: false,
  },
  run: async (args, ctx) => {
    if (
      typeof args.fromToken !== "string" ||
      typeof args.toToken !== "string" ||
      typeof args.amount !== "number" ||
      !Number.isFinite(args.amount) ||
      args.amount <= 0
    ) {
      return { text: "'fromToken'/'toToken' must be symbols, 'amount' a number greater than 0.", isError: true };
    }
    const slippage =
      typeof args.slippagePercent === "number" && Number.isFinite(args.slippagePercent) && args.slippagePercent >= 0
        ? args.slippagePercent
        : 0.5;
    try {
      const from = findMezoBySymbol(args.fromToken, ctx.network);
      const to = findMezoBySymbol(args.toToken, ctx.network);
      if (!from || !to) {
        return { text: `Unknown token pair '${args.fromToken}' → '${args.toToken}' on Mezo ${ctx.network}.`, isError: true };
      }
      const quote = await quoteSwap(from.symbol, to.symbol, parseDisplayAmount(args.amount, from.decimals), ctx.network);
      const outWei = parseDisplayAmount(quote.amountOut, to.decimals);
      const minOutWei = (outWei * BigInt(Math.max(0, Math.floor((100 - slippage) * 100)))) / 10000n;
      return {
        text: JSON.stringify(
          {
            ...quote,
            slippagePercent: slippage,
            minOut: formatEvmAmount(minOutWei, to.decimals),
          },
          null,
          2,
        ),
      };
    } catch (e) {
      return { text: `Could not quote swap: ${e instanceof Error ? e.message : e}`, isError: true };
    }
  },
};
