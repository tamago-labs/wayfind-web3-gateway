import type { ToolContext, ToolDef } from "../../types";
import { isValidEvmAddress } from "../../lib/evm";
import { fetchPoolStatus } from "../musd";

export const mezoMusdPoolStatusTool: ToolDef = {
  name: "mezo_musd_pool_status",
  category: "mezo",
  description: "Read Stability Pool position: staked MUSD, BTC collateral gains, pool share. Defaults to the attached wallet.",
  inputSchema: {
    type: "object",
    properties: {
      depositor: { type: "string", description: "Wallet address (defaults to the attached EVM wallet)" },
    },
    additionalProperties: false,
  },
  run: async (args, ctx: ToolContext) => {
    const depositor =
      typeof args.depositor === "string" && args.depositor.length > 0
        ? args.depositor
        : ctx.evmWalletAddress;
    if (!depositor) {
      return {
        text: "No wallet to inspect — provide depositor or regenerate from Connect to attach the EVM wallet.",
        isError: true,
      };
    }
    if (!isValidEvmAddress(depositor)) {
      return { text: "Invalid depositor address.", isError: true };
    }
    try {
      const status = await fetchPoolStatus(depositor, ctx.network);
      return { text: JSON.stringify(status, null, 2) };
    } catch (e) {
      return { text: `Could not read pool position: ${e instanceof Error ? e.message : e}`, isError: true };
    }
  },
};
