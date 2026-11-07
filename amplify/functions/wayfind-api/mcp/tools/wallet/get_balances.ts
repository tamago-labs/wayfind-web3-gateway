import { Connection, PublicKey } from "@solana/web3.js";
import type { ToolContext, ToolDef } from "../../types";
import { getBalanceLamports } from "../../lib/rpc";
import { resolveToken } from "../../lib/tokens";

const TOKEN_PROGRAMS = [
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
  "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
];

function rpcUrl(network: "mainnet" | "testnet"): string {
  if (network === "mainnet") {
    return process.env.SOLANA_MAINNET_RPC ?? "https://api.mainnet-beta.solana.com";
  }
  return process.env.SOLANA_DEVNET_RPC ?? "https://api.devnet.solana.com";
}

export const runGetBalances = async (
  _args: Record<string, unknown>,
  ctx: ToolContext,
): Promise<{ text: string; isError?: boolean }> => {
  if (!ctx.walletAddress) {
    return {
      text: "Balances are not enabled for this URL yet — regenerate it from Connect to attach the wallet.",
      isError: true,
    };
  }
  const connection = new Connection(rpcUrl(ctx.network), "confirmed");
  const owner = new PublicKey(ctx.walletAddress);
  const lines: string[] = [];
  try {
    const lamports = await getBalanceLamports(ctx.network, ctx.walletAddress);
    lines.push(`SOL: ${lamports / 1_000_000_000} SOL`);
    const tokenLists = await Promise.all(
      TOKEN_PROGRAMS.map((programId) =>
        connection
          .getParsedTokenAccountsByOwner(owner, { programId: new PublicKey(programId) })
          .then((r) => r.value)
          .catch(() => [] as unknown[]),
      ),
    );
    for (const list of tokenLists) {
      for (const acc of list) {
        const info = (
          acc.account.data as unknown as {
            parsed?: { info?: { mint?: string; tokenAmount?: { uiAmount?: number } } };
          }
        ).parsed?.info;
        if (!info?.mint || typeof info.tokenAmount?.uiAmount !== "number") continue;
        if (info.tokenAmount.uiAmount <= 0) continue;
        const meta = resolveToken(info.mint, ctx.network);
        lines.push(
          meta
            ? `${meta.symbol}: ${info.tokenAmount.uiAmount} (${meta.name})`
            : `Unknown token ${info.mint.slice(0, 8)}…: ${info.tokenAmount.uiAmount}`,
        );
      }
    }
  } catch (e) {
    return { text: `Could not read balances: ${e instanceof Error ? e.message : e}`, isError: true };
  }
  return { text: `Balances (${ctx.network}):\n${lines.join("\n")}` };
};

export const getBalancesTool: ToolDef = {
  name: "get_balances",
  category: "wallet",
  description: "Read SOL plus every token balance of the attached wallet, including stock tokens.",
  inputSchema: {
    type: "object",
    properties: {},
    additionalProperties: false,
  },
  run: runGetBalances,
};

// Deprecated alias — kept so URLs issued before the rename keep working.
export const getBalanceTool: ToolDef = {
  name: "get_balance",
  category: "wallet",
  description: "Deprecated alias of get_balances.",
  inputSchema: {
    type: "object",
    properties: {},
    additionalProperties: false,
  },
  run: runGetBalances,
};
