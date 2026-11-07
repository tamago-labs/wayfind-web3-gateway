import type { ToolDef } from "../../types";
import { unifiedBalanceContext } from "../../lib/circle";

// Swap is mainnet-only (except Arc testnet) — Solana swap has no devnet leg.
const SWAP_MAINNET = [
  "Solana", "Arc", "Ethereum", "Base", "Arbitrum", "Optimism", "Polygon", "Avalanche",
  "Sei", "Sonic", "Unichain", "World_Chain", "HyperEVM", "Cronos", "Ink", "Linea",
  "Monad", "Morph", "Plume", "XDC", "X_Layer",
];

export const usdcChainsTool: ToolDef = {
  name: "usdc_chains",
  category: "usdc",
  description: "List chains available for a USDC operation on the current scope network. Read-only.",
  inputSchema: {
    type: "object",
    properties: {
      operation: {
        type: "string",
        description: "One of: unifiedBalance, bridge, swap",
      },
    },
    required: ["operation"],
    additionalProperties: false,
  },
  run: async (args, ctx) => {
    if (args.operation !== "unifiedBalance" && args.operation !== "bridge" && args.operation !== "swap") {
      return { text: "'operation' must be unifiedBalance, bridge, or swap.", isError: true };
    }
    try {
      if (args.operation === "unifiedBalance") {
        const context = await unifiedBalanceContext();
        const { getSupportedChains } = await import("@circle-fin/unified-balance-kit");
        const chains = getSupportedChains(context, "USDC", { forwarderSupported: "destination" }) as {
          name?: string;
          isTestnet?: boolean;
        }[];
        const names = chains
          .filter((c) => (ctx.network === "mainnet" ? !c.isTestnet : c.isTestnet))
          .map((c) => c.name ?? "?");
        return { text: `USDC unified-balance destinations on ${ctx.network}: ${names.join(", ")}.` };
      }
      if (args.operation === "bridge") {
        const { BridgeKit } = await import("@circle-fin/bridge-kit");
        const chains = new BridgeKit().getSupportedChains({
          isTestnet: ctx.network === "testnet",
        }) as { name?: string }[];
        return {
          text: `USDC bridge chains on ${ctx.network}: ${chains.map((c) => c.name ?? "?").join(", ")}.`,
        };
      }
      if (ctx.network !== "mainnet") {
        return {
          text: "Circle swaps are mainnet-only on Solana — switch scope to Mainnet, or use usdc_spend for testnet movement.",
          isError: true,
        };
      }
      return { text: `Circle swap chains on mainnet: ${SWAP_MAINNET.join(", ")}.` };
    } catch (e) {
      return { text: `Chain lookup failed: ${e instanceof Error ? e.message : e}`, isError: true };
    }
  },
};
