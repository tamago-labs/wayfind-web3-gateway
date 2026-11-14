import type { ToolContext, ToolDef } from "../types";
import {
  encodeErc20Transfer,
  evmSendTransaction,
  findMezoBySymbol,
  formatEvmAmount,
  getMezoNativeBalance,
  getMezoTokenBalance,
  isValidEvmAddress,
  mezoExplorerTxUrl,
  parseDisplayAmount,
} from "../lib/evm";

// Gas buffer in wei (0.0001 BTC) — amount limits live in the Privy policy.
const GAS_BUFFER_WEI = 100_000_000_000_000n;

export const mezoSendTokensTool: ToolDef = {
  name: "mezo_send_tokens",
  category: "mezo",
  description:
    "Send BTC, MEZO, or MUSD from the attached Mezo wallet by symbol. Limits are enforced by the Privy policy.",
  inputSchema: {
    type: "object",
    properties: {
      token: { type: "string", description: "Token symbol, e.g. 'BTC', 'MEZO', 'MUSD'" },
      amount: { type: "number", description: "Amount in display units, e.g. 0.01" },
      to: { type: "string", description: "Recipient EVM address (0x…)" },
    },
    required: ["token", "amount", "to"],
    additionalProperties: false,
  },
  run: async (args, ctx) => {
    if (!ctx.evmWalletId || !ctx.evmWalletAddress) {
      return {
        text: "Sending is not enabled for this URL yet — regenerate it from Connect to attach the EVM wallet.",
        isError: true,
      };
    }
    if (
      typeof args.token !== "string" ||
      typeof args.amount !== "number" ||
      !Number.isFinite(args.amount) ||
      typeof args.to !== "string"
    ) {
      return { text: "'token' must be a symbol, 'amount' a number, 'to' an address.", isError: true };
    }
    if (args.amount <= 0) {
      return { text: "Amount must be greater than 0.", isError: true };
    }
    if (!isValidEvmAddress(args.to)) {
      return { text: "Invalid destination address.", isError: true };
    }
    const meta = findMezoBySymbol(args.token, ctx.network);
    if (!meta) {
      return { text: `Unknown token '${args.token}' on Mezo ${ctx.network}.`, isError: true };
    }
    let baseUnits: bigint;
    try {
      baseUnits = parseDisplayAmount(args.amount, meta.decimals);
    } catch (e) {
      return { text: e instanceof Error ? e.message : "Invalid amount.", isError: true };
    }
    if (baseUnits <= 0n) {
      return { text: "Amount is smaller than the token's smallest unit.", isError: true };
    }

    try {
      if (meta.address === "native") {
        const balance = await getMezoNativeBalance(ctx.evmWalletAddress, ctx.network);
        if (balance < baseUnits + GAS_BUFFER_WEI) {
          return {
            text: `Insufficient balance: ${formatEvmAmount(balance, 18)} BTC available.`,
            isError: true,
          };
        }
        const hash = await evmSendTransaction(ctx.evmWalletId, ctx.network, {
          to: args.to,
          valueWei: baseUnits,
        });
        return { text: `Sent ${args.amount} ${meta.symbol} (Mezo ${ctx.network}): ${mezoExplorerTxUrl(ctx.network, hash)}` };
      }

      const balance = await getMezoTokenBalance(meta.address, ctx.evmWalletAddress, ctx.network);
      if (balance < baseUnits) {
        return {
          text: `Insufficient ${meta.symbol} balance: ${formatEvmAmount(balance, meta.decimals)} available.`,
          isError: true,
        };
      }
      const hash = await evmSendTransaction(ctx.evmWalletId, ctx.network, {
        to: meta.address,
        data: encodeErc20Transfer(args.to, baseUnits),
      });
      return { text: `Sent ${args.amount} ${meta.symbol} (Mezo ${ctx.network}): ${mezoExplorerTxUrl(ctx.network, hash)}` };
    } catch (e) {
      return { text: `Send failed: ${e instanceof Error ? e.message : e}`, isError: true };
    }
  },
};
