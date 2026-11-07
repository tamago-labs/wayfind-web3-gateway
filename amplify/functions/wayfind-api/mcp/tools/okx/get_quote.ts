import { Connection, PublicKey } from "@solana/web3.js";
import type { ToolDef } from "../../types";
import { getSwapQuote, resolveMainnetMint } from "../../lib/okx";

export const getQuoteTool: ToolDef = {
  name: "okx_get_quote",
  category: "okx",
  description: "Get an OKX DEX swap quote (Solana mainnet). Read-only.",
  inputSchema: {
    type: "object",
    properties: {
      from: { type: "string", description: "From token symbol, e.g. 'SOL'" },
      to: { type: "string", description: "To token symbol, e.g. 'USDC'" },
      amount: { type: "number", description: "Amount of the from token in display units, e.g. 0.01" },
    },
    required: ["from", "to", "amount"],
    additionalProperties: false,
  },
  run: async (args) => {
    if (
      typeof args.from !== "string" ||
      typeof args.to !== "string" ||
      typeof args.amount !== "number" ||
      !Number.isFinite(args.amount) ||
      args.amount <= 0
    ) {
      return { text: "'from'/'to' must be symbols and 'amount' a number greater than 0.", isError: true };
    }
    try {
      // Same display→base conversion swap_tokens uses (mainnet mint decimals).
      const fromMint = resolveMainnetMint(args.from);
      if (!fromMint) return { text: `Unknown token '${args.from}' on mainnet.`, isError: true };
      const connection = new Connection(
        process.env.SOLANA_MAINNET_RPC ?? "https://api.mainnet-beta.solana.com",
        "confirmed",
      );
      const mintInfo = await connection.getParsedAccountInfo(new PublicKey(fromMint)).catch(() => null);
      const decimals = (
        mintInfo?.value?.data as unknown as { parsed?: { info?: { decimals?: number } } }
      )?.parsed?.info?.decimals;
      if (typeof decimals !== "number") {
        return { text: `Could not read mint decimals for ${args.from}.`, isError: true };
      }
      const q = (await getSwapQuote({
        fromSymbol: args.from,
        toSymbol: args.to,
        amount: Math.round(args.amount * 10 ** decimals).toString(),
      })) as {
        fromToken?: { tokenSymbol?: string; tokenUnitPrice?: string; decimal?: string };
        toToken?: { tokenSymbol?: string; tokenUnitPrice?: string; decimal?: string };
        toTokenAmount?: string;
        dexRouterList?: { dexProtocol?: { dexName?: string; percent?: string } }[];
      };
      const fmt = (base?: string, decimals?: string) => {
        const d = Number(decimals ?? 0);
        if (!base || !Number.isFinite(d)) return base ?? "?";
        return (Number(base) / 10 ** d).toString();
      };
      const routers = (q.dexRouterList ?? [])
        .map((r) => `${r.dexProtocol?.dexName ?? "?"} ${r.dexProtocol?.percent ?? "?"}%`)
        .join(", ");
      return {
        text: `Quote: ${args.amount} ${q.fromToken?.tokenSymbol ?? args.from} (~$${q.fromToken?.tokenUnitPrice ?? "?"}) → ${fmt(q.toTokenAmount, q.toToken?.decimal)} ${q.toToken?.tokenSymbol ?? args.to} (~$${q.toToken?.tokenUnitPrice ?? "?"}). Route: ${routers || "n/a"}.`,
      };
    } catch (e) {
      return { text: `Quote failed: ${e instanceof Error ? e.message : e}`, isError: true };
    }
  },
};
