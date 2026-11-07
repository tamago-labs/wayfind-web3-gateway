import type { ToolContext, ToolDef } from "../types";
import { getBalanceSol, getHistory } from "../lib/rpc";

// Read-only wallet tools. They need walletAddress + network on the config —
// pre-Phase-3 rows lack them, so refuse with a re-issue hint instead of guessing.
function requireWallet(ctx: ToolContext): string | null {
  if (!ctx.walletAddress) {
    return "Wallet tools are not enabled for this URL yet — regenerate it from Connect to attach the wallet.";
  }
  return null;
}

export const walletTools: ToolDef[] = [
  {
    name: "get_balance",
    category: "wallet",
    description: "Read the SOL balance of the attached wallet.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    run: async (_args, ctx) => {
      const missing = requireWallet(ctx);
      if (missing) return { text: missing, isError: true };
      const sol = await getBalanceSol(ctx.network, ctx.walletAddress as string);
      return { text: `Balance: ${sol} SOL (${ctx.network})` };
    },
  },
  {
    name: "get_history",
    category: "wallet",
    description: "Read the latest transactions of the attached wallet, newest first.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Max transactions (1-10, default 5)" },
      },
      additionalProperties: false,
    },
    run: async (args, ctx) => {
      const missing = requireWallet(ctx);
      if (missing) return { text: missing, isError: true };
      const raw = typeof args.limit === "number" ? Math.floor(args.limit) : 5;
      const limit = Math.min(10, Math.max(1, raw));
      const entries = await getHistory(ctx.network, ctx.walletAddress as string, limit);
      if (entries.length === 0) return { text: `No transactions yet (${ctx.network}).` };
      const cluster = ctx.network === "mainnet" ? "" : "?cluster=devnet";
      const lines = entries.map((e) => {
        const when = e.blockTime ? new Date(e.blockTime * 1000).toISOString() : "unknown time";
        const status = e.err ? "Failed" : "Confirmed";
        return `- ${e.signature} [${status}] ${when} https://explorer.solana.com/tx/${e.signature}${cluster}`;
      });
      return { text: `Latest ${entries.length} (${ctx.network}):\n${lines.join("\n")}` };
    },
  },
];
