import type { ToolDef } from "../../types";
import { getSwapInstruction, probeOkxDecimals, resolveMainnetMint } from "../../lib/okx";
import { findDecimals } from "../../lib/tokens";
import { signAndSend } from "../../lib/privy";
import { base58ToBase64 } from "../../lib/tx";

export const swapTokensTool: ToolDef = {
  name: "okx_swap_tokens",
  category: "okx",
  description:
    "Swap tokens via OKX DEX from the attached wallet (Solana mainnet only). Limits are enforced by the Privy policy.",
  inputSchema: {
    type: "object",
    properties: {
      from: { type: "string", description: "From token symbol, e.g. 'SOL'" },
      to: { type: "string", description: "To token symbol, e.g. 'USDC'" },
      amount: { type: "number", description: "Amount of the from token in display units, e.g. 0.01" },
      slippagePercent: { type: "string", description: "Slippage tolerance percent (default '0.5')" },
    },
    required: ["from", "to", "amount"],
    additionalProperties: false,
  },
  run: async (args, ctx) => {
    // OKX aggregates mainnet liquidity only — no devnet path exists.
    if (ctx.network !== "mainnet") {
      return { text: "OKX swaps are mainnet-only — switch scope to Mainnet.", isError: true };
    }
    if (!ctx.walletAddress) {
      return {
        text: "Swapping is not enabled for this URL yet — regenerate it from Connect to attach the wallet.",
        isError: true,
      };
    }
    if (
      typeof args.from !== "string" ||
      typeof args.to !== "string" ||
      typeof args.amount !== "number" ||
      !Number.isFinite(args.amount)
    ) {
      return { text: "'from'/'to' must be symbols and 'amount' a number.", isError: true };
    }
    if (args.amount <= 0) {
      return { text: "Amount must be greater than 0.", isError: true };
    }
    try {
      // Registry-first decimals (no RPC — see get_quote). Unknown-to-registry
      // tokens fall back to an OKX probe quote.
      const fromMint = resolveMainnetMint(args.from);
      if (!fromMint) return { text: `Unknown token '${args.from}' on mainnet.`, isError: true };
      const toMint = resolveMainnetMint(args.to);
      if (!toMint) return { text: `Unknown token '${args.to}' on mainnet.`, isError: true };
      const probed =
        findDecimals(args.from, "mainnet") === null ||
        findDecimals(args.to, "mainnet") === null
          ? await probeOkxDecimals(args.from, args.to)
          : { from: null as number | null, to: null as number | null };
      const decimals = findDecimals(args.from, "mainnet") ?? probed.from;
      if (typeof decimals !== "number") {
        return { text: `Could not read mint decimals for ${args.from}.`, isError: true };
      }
      const toDecimals = findDecimals(args.to, "mainnet") ?? probed.to;
      if (typeof toDecimals !== "number") {
        return { text: `Could not read mint decimals for ${args.to}.`, isError: true };
      }
      const baseUnits = Math.round(args.amount * 10 ** decimals).toString();
      const instruction = await getSwapInstruction({
        fromSymbol: args.from,
        toSymbol: args.to,
        amount: baseUnits,
        userWalletAddress: ctx.walletAddress,
        slippagePercent: typeof args.slippagePercent === "string" ? args.slippagePercent : "0.5",
      });
      if (!instruction.base58Transaction) {
        return { text: "OKX returned no swap transaction.", isError: true };
      }
      // Privy's proven path takes base64 — convert from OKX's base58.
      const txB64 = base58ToBase64(instruction.base58Transaction);
      if (!txB64) return { text: "Could not decode the OKX transaction.", isError: true };
      const hash = await signAndSend(ctx.walletId, txB64, "mainnet");
      // minReceiveAmount arrives in to-token base units — show display units.
      const minReceive = Number(instruction.minReceiveAmount) / 10 ** toDecimals;
      return {
        text: `Swapped ${args.amount} ${args.from} → ${args.to} (mainnet, min receive ${Number.isFinite(minReceive) ? minReceive : instruction.minReceiveAmount}): https://explorer.solana.com/tx/${hash}`,
      };
    } catch (e) {
      return { text: `Swap failed: ${e instanceof Error ? e.message : e}`, isError: true };
    }
  },
};
