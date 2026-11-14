import type { ToolContext, ToolDef } from "../../types";
import { mezoExplorerTxUrl } from "../../lib/evm";
import { executeCloseTrove } from "../musd";

export const mezoMusdCloseTroveTool: ToolDef = {
  name: "mezo_musd_close_trove",
  category: "mezo",
  description:
    "Close your trove and reclaim collateral. Works once debt is down to the 200 MUSD gas deposit (it settles itself, refunded on close) — repay first with mezo_musd_repay. Policy-enforced.",
  inputSchema: {
    type: "object",
    properties: {},
    additionalProperties: false,
  },
  run: async (_args, ctx: ToolContext) => {
    if (!ctx.evmWalletId || !ctx.evmWalletAddress) {
      return {
        text: "Troves are not enabled for this URL yet — regenerate it from Connect to attach the EVM wallet.",
        isError: true,
      };
    }
    try {
      const hash = await executeCloseTrove(ctx.evmWalletId, ctx.evmWalletAddress, ctx.network);
      return {
        text: `Closed trove (Mezo ${ctx.network}): ${mezoExplorerTxUrl(ctx.network, hash)}`,
      };
    } catch (e) {
      return { text: `Close trove failed: ${e instanceof Error ? e.message : e}`, isError: true };
    }
  },
};
