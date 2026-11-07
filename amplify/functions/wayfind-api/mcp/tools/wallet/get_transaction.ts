import { Connection } from "@solana/web3.js";
import type { ToolDef } from "../../types";
import { decodeTransaction } from "../../lib/tx";

function rpcUrl(network: "mainnet" | "testnet"): string {
  if (network === "mainnet") {
    return process.env.SOLANA_MAINNET_RPC ?? "https://api.mainnet-beta.solana.com";
  }
  return process.env.SOLANA_DEVNET_RPC ?? "https://api.devnet.solana.com";
}

export const getTransactionTool: ToolDef = {
  name: "get_transaction",
  category: "wallet",
  description: "Get details and status of one transaction by signature.",
  inputSchema: {
    type: "object",
    properties: {
      signature: { type: "string", description: "Transaction signature (base58)" },
    },
    required: ["signature"],
    additionalProperties: false,
  },
  run: async (args, ctx) => {
    if (!ctx.walletAddress) {
      return {
        text: "Transaction lookup is not enabled for this URL yet — regenerate it from Connect to attach the wallet.",
        isError: true,
      };
    }
    if (typeof args.signature !== "string" || args.signature.length < 80) {
      return { text: "Provide a transaction signature.", isError: true };
    }
    try {
      const connection = new Connection(rpcUrl(ctx.network), "confirmed");
      const d = await decodeTransaction(connection, ctx.walletAddress, args.signature);
      const parts = [
        `${d.status} (${ctx.network})`,
        d.time ?? "unknown time",
        d.kind === "sol" && d.amountSol != null
          ? `${d.direction === "out" ? "-" : "+"}${Math.abs(d.amountSol)} SOL ${d.direction === "out" ? "to" : "from"} ${d.counterparty}`
          : d.kind === "token"
            ? `token transfer${d.counterparty ? ` with ${d.counterparty}` : ""}`
            : d.kind === "program"
              ? "program interaction"
              : "unparsed transaction",
      ];
      return { text: `${d.signature}\n${parts.join(" · ")}` };
    } catch (e) {
      return { text: `Lookup failed: ${e instanceof Error ? e.message : e}`, isError: true };
    }
  },
};
