import type { ToolDef } from "../../types";

export const getWalletAddressTool: ToolDef = {
  name: "get_wallet_address",
  category: "wallet",
  description: "Get the attached wallet's address and network.",
  inputSchema: {
    type: "object",
    properties: {},
    additionalProperties: false,
  },
  run: (_args, ctx) => {
    if (!ctx.walletAddress) {
      return {
        text: "No wallet is attached to this URL yet — regenerate it from Connect.",
        isError: true,
      };
    }
    return { text: `${ctx.walletAddress} (${ctx.network})` };
  },
};
