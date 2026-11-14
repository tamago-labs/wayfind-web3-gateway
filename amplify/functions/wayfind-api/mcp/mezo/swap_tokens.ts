import type { ToolContext, ToolDef } from "../types";
import { findMezoBySymbol, formatEvmAmount, mezoExplorerTxUrl, parseDisplayAmount } from "../lib/evm";
import { executeSwap, quoteSwap } from "./musd";

export const mezoSwapTokensTool: ToolDef = {
  name: "mezo_swap_tokens",
  category: "mezo",
  description:
    "Swap on Mezo via the pool router (MUSD/BTC, MUSD/mUSDC, MUSD/mUSDT). Approves first if needed, enforces min-out slippage. Policy-enforced.",
  inputSchema: {
    type: "object",
    properties: {
      fromToken: { type: "string", description: "Input symbol: MUSD, mUSDC, or mUSDT" },
      toToken: { type: "string", description: "Output symbol: BTC, MUSD, mUSDC, or mUSDT" },
      amount: { type: "number", description: "Input amount, display units" },
      slippagePercent: { type: "number", description: "Max slippage (default 0.5). Abort if quote moves more." },
    },
    required: ["fromToken", "toToken", "amount"],
    additionalProperties: false,
  },
  run: async (args, ctx: ToolContext) => {
    if (!ctx.evmWalletId || !ctx.evmWalletAddress) {
      return {
        text: "Swaps are not enabled for this URL yet — regenerate it from Connect to attach the EVM wallet.",
        isError: true,
      };
    }
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
      const from = findMezoBySymbol(args.fromToken as string, ctx.network);
      const to = findMezoBySymbol(args.toToken as string, ctx.network);
      if (!from || !to) {
        return { text: `Unknown token pair '${args.fromToken}' → '${args.toToken}' on Mezo ${ctx.network}.`, isError: true };
      }
      const amountWei = parseDisplayAmount(args.amount as number, from.decimals);
      const quote = await quoteSwap(from.symbol, to.symbol, amountWei, ctx.network);
      const outWei = parseDisplayAmount(quote.amountOut, to.decimals);
      if (outWei <= 0n) {
        return { text: "Quote returned zero output — pool may lack liquidity. No transaction sent.", isError: true };
      }
      const minOutWei = (outWei * BigInt(Math.max(0, Math.floor((100 - slippage) * 100)))) / 10000n;
      const hash = await executeSwap(
        ctx.evmWalletId,
        ctx.evmWalletAddress,
        from.symbol,
        to.symbol,
        amountWei,
        minOutWei,
        ctx.network,
      );
      return {
        text:
          `Swapped ${args.amount} ${from.symbol} → ~${formatEvmAmount(outWei, to.decimals)} ${to.symbol} ` +
          `(min ${formatEvmAmount(minOutWei, to.decimals)}, Mezo ${ctx.network}): ${mezoExplorerTxUrl(ctx.network, hash)}`,
      };
    } catch (e) {
      return { text: `Swap failed: ${e instanceof Error ? e.message : e}`, isError: true };
    }
  },
};
