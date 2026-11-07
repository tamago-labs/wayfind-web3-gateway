import { Connection, PublicKey } from "@solana/web3.js";
import type { ToolDef } from "../../types";
import { getSwapInstruction, resolveMainnetMint } from "../../lib/okx";
import { signAndSend } from "../../lib/privy";
import { base58ToBase64 } from "../../lib/tx";

function rpcUrl(): string {
  return process.env.SOLANA_MAINNET_RPC ?? "https://api.mainnet-beta.solana.com";
}

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
    const connection = new Connection(rpcUrl(), "confirmed");
    try {
      // Decimals come from the mint account (same source send_tokens uses).
      const fromMint = resolveMainnetMint(args.from);
      if (!fromMint) return { text: `Unknown token '${args.from}' on mainnet.`, isError: true };
      const mintInfo = await connection.getParsedAccountInfo(new PublicKey(fromMint)).catch(() => null);
      const decimals = (
        mintInfo?.value?.data as unknown as { parsed?: { info?: { decimals?: number } } }
      )?.parsed?.info?.decimals;
      if (typeof decimals !== "number") {
        return { text: `Could not read mint decimals for ${args.from}.`, isError: true };
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
      return {
        text: `Swapped ${args.amount} ${args.from} → ${args.to} (mainnet, min receive ${instruction.minReceiveAmount}): https://explorer.solana.com/tx/${hash}`,
      };
    } catch (e) {
      return { text: `Swap failed: ${e instanceof Error ? e.message : e}`, isError: true };
    }
  },
};
