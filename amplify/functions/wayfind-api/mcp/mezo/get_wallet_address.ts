import type { ToolContext, ToolDef } from "../types";
import { mezoChainId, mezoExplorerAddressUrl } from "../lib/evm";

export const mezoGetWalletAddressTool: ToolDef = {
  name: "mezo_get_wallet_address",
  category: "mezo",
  description: "Show the attached Mezo EVM wallet address, network, and chain ID.",
  inputSchema: {
    type: "object",
    properties: {},
    additionalProperties: false,
  },
  run: async (_args, ctx: ToolContext) => {
    if (!ctx.evmWalletAddress) {
      return {
        text: "Mezo is not enabled for this URL yet — regenerate it from Connect to attach the EVM wallet.",
        isError: true,
      };
    }
    const chainId = mezoChainId(ctx.network);
    return {
      text:
        `Mezo wallet (${ctx.network}, chain ${chainId}): ${ctx.evmWalletAddress}\n` +
        mezoExplorerAddressUrl(ctx.network, ctx.evmWalletAddress),
    };
  },
};
