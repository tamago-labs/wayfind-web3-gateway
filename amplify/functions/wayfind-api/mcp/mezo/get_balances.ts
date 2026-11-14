import type { ToolContext, ToolDef } from "../types";
import {
  formatEvmAmount,
  getMezoNativeBalance,
  getMezoTokenBalance,
  listMezoTokens,
} from "../lib/evm";

export const runMezoGetBalances = async (
  _args: Record<string, unknown>,
  ctx: ToolContext,
): Promise<{ text: string; isError?: boolean }> => {
  if (!ctx.evmWalletAddress) {
    return {
      text: "Mezo balances are not enabled for this URL yet — regenerate it from Connect to attach the EVM wallet.",
      isError: true,
    };
  }
  const lines: string[] = [];
  try {
    const native = await getMezoNativeBalance(ctx.evmWalletAddress, ctx.network);
    lines.push(`BTC: ${formatEvmAmount(native, 18)} (Bitcoin, Mezo gas)`);
    await Promise.all(
      listMezoTokens(ctx.network)
        .filter((t) => t.address !== "native")
        .map(async (t) => {
          try {
            const bal = await getMezoTokenBalance(t.address, ctx.evmWalletAddress as string, ctx.network);
            if (bal > 0n) lines.push(`${t.symbol}: ${formatEvmAmount(bal, t.decimals)} (${t.name})`);
          } catch {
            // One token failing must not blank the rest.
          }
        }),
    );
  } catch (e) {
    return { text: `Could not read Mezo balances: ${e instanceof Error ? e.message : e}`, isError: true };
  }
  return { text: `Mezo balances (${ctx.network}):\n${lines.join("\n")}` };
};

export const mezoGetBalancesTool: ToolDef = {
  name: "mezo_get_balances",
  category: "mezo",
  description: "Read native BTC plus MEZO and MUSD balances of the attached Mezo wallet.",
  inputSchema: {
    type: "object",
    properties: {},
    additionalProperties: false,
  },
  run: runMezoGetBalances,
};
