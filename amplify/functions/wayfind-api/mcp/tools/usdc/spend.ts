import type { ToolDef } from "../../types";
import { circleAdapter, circleChain, unifiedBalanceContext } from "../../lib/circle";

export const usdcSpendTool: ToolDef = {
  name: "usdc_spend",
  category: "usdc",
  description:
    "Spend USDC from unified balance — to the Solana wallet by default, or cross-chain to another chain/recipient. Limits are enforced by the Privy policy.",
  inputSchema: {
    type: "object",
    properties: {
      amount: { type: "number", description: "USDC amount in display units, e.g. 1.5" },
      targetChain: {
        type: "string",
        description: "Destination chain identifier, e.g. 'Base_Sepolia' on testnet. Omit to receive on Solana.",
      },
      recipient: {
        type: "string",
        description: "Recipient address on the destination chain. Omit to receive at the attached wallet.",
      },
    },
    required: ["amount"],
    additionalProperties: false,
  },
  run: async (args, ctx) => {
    if (!ctx.walletAddress) {
      return {
        text: "Spending is not enabled for this URL yet — regenerate it from Connect to attach the wallet.",
        isError: true,
      };
    }
    if (typeof args.amount !== "number" || !Number.isFinite(args.amount) || args.amount <= 0) {
      return { text: "'amount' must be a number greater than 0.", isError: true };
    }
    try {
      const adapter = await circleAdapter(ctx.walletAddress, ctx.walletId, ctx.network);
      const context = await unifiedBalanceContext();
      const { getSupportedChains, spend } = await import("@circle-fin/unified-balance-kit");
      const to: { adapter: unknown; chain: string; recipientAddress?: string } = {
        adapter,
        chain: circleChain(ctx.network),
      };
      if (typeof args.targetChain === "string" && args.targetChain) {
        // Validate against live destination list for this network set.
        const dests = getSupportedChains(context, "USDC", { forwarderSupported: "destination" }) as {
          name?: string;
          isTestnet?: boolean;
        }[];
        const ok = dests.some(
          (c) => c.name === args.targetChain && (ctx.network === "mainnet" ? !c.isTestnet : c.isTestnet),
        );
        if (!ok) {
          return {
            text: `'${args.targetChain}' is not a unified-balance destination on ${ctx.network}. Use usdc_chains to list valid targets.`,
            isError: true,
          };
        }
        to.chain = args.targetChain;
      }
      if (typeof args.recipient === "string" && args.recipient) {
        to.recipientAddress = args.recipient;
      }
      const result = (await spend(context, {
        amount: String(args.amount),
        token: "USDC",
        from: [{ adapter }],
        to,
      })) as { txHash?: string; hash?: string };
      const hash = result.txHash ?? result.hash ?? "";
      const where = to.recipientAddress ?? "the attached wallet";
      return {
        text: hash
          ? `Spent ${args.amount} USDC to ${to.chain} → ${where} (${ctx.network}): https://solscan.io/tx/${hash}`
          : `Spend submitted to ${to.chain} (${ctx.network}). Check usdc_unified_balance for confirmation.`,
      };
    } catch (e) {
      return { text: `Spend failed: ${e instanceof Error ? e.message : e}`, isError: true };
    }
  },
};
