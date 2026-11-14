import type { ToolContext, ToolDef } from "../types";
import { formatEvmAmount, getMezoTransaction, mezoExplorerTxUrl } from "../lib/evm";

export const mezoGetTransactionTool: ToolDef = {
  name: "mezo_get_transaction",
  category: "mezo",
  description: "Look up one Mezo transaction by hash: status, from/to, value, block.",
  inputSchema: {
    type: "object",
    properties: {
      hash: { type: "string", description: "Transaction hash (0x…)" },
    },
    required: ["hash"],
    additionalProperties: false,
  },
  run: async (args, ctx) => {
    if (typeof args.hash !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(args.hash)) {
      return { text: "'hash' must be a 0x transaction hash.", isError: true };
    }
    let view;
    try {
      view = await getMezoTransaction(args.hash, ctx.network);
    } catch (e) {
      return { text: `Could not read transaction: ${e instanceof Error ? e.message : e}`, isError: true };
    }
    if (!view) return { text: `Transaction not found on Mezo ${ctx.network}.`, isError: true };
    return {
      text:
        `Mezo transaction (${ctx.network}, ${view.status}):\n` +
        `hash: ${view.hash}\nfrom: ${view.from}\nto: ${view.to ?? "—"}\n` +
        `value: ${formatEvmAmount(view.valueWei, 18)} BTC\n` +
        `block: ${view.blockNumber ?? "pending"}\n` +
        mezoExplorerTxUrl(ctx.network, view.hash),
    };
  },
};
