import type { ToolDef } from "../../types";
import { getHistory } from "../../lib/rpc";

export const getHistoryTool: ToolDef = {
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
    if (!ctx.walletAddress) {
      return {
        text: "History is not enabled for this URL yet — regenerate it from Connect to attach the wallet.",
        isError: true,
      };
    }
    const raw = typeof args.limit === "number" ? Math.floor(args.limit) : 5;
    const limit = Math.min(10, Math.max(1, raw));
    const entries = await getHistory(ctx.network, ctx.walletAddress, limit);
    if (entries.length === 0) return { text: `No transactions yet (${ctx.network}).` };
    const cluster = ctx.network === "mainnet" ? "" : "?cluster=devnet";
    const lines = entries.map((e) => {
      const when = e.blockTime ? new Date(Number(e.blockTime) * 1000).toISOString() : "unknown time";
      const status = e.err ? "Failed" : "Confirmed";
      return `- ${e.signature} [${status}] ${when} https://explorer.solana.com/tx/${e.signature}${cluster}`;
    });
    return { text: `Latest ${entries.length} (${ctx.network}):\n${lines.join("\n")}` };
  },
};
