import { PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import type { ToolContext, ToolDef } from "../types";
import { getBalanceLamports, getBalanceSol, getHistory, getLatestBlockhash } from "../lib/rpc";
import { signAndSend } from "../lib/privy";

// Fee buffer only — amount limits live in the Privy default policy.
const FEE_BUFFER_LAMPORTS = 5_000;

// Read-only wallet tools. They need walletAddress + network on the config —
// pre-Phase-3 rows lack them, so refuse with a re-issue hint instead of guessing.
function requireWallet(ctx: ToolContext): string | null {
  if (!ctx.walletAddress) {
    return "Wallet tools are not enabled for this URL yet — regenerate it from Connect to attach the wallet.";
  }
  return null;
}

export const walletTools: ToolDef[] = [
  {
    name: "get_balance",
    category: "wallet",
    description: "Read the SOL balance of the attached wallet.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    run: async (_args, ctx) => {
      const missing = requireWallet(ctx);
      if (missing) return { text: missing, isError: true };
      const sol = await getBalanceSol(ctx.network, ctx.walletAddress as string);
      return { text: `Balance: ${sol} SOL (${ctx.network})` };
    },
  },
  {
    name: "get_history",
    category: "wallet",
    description: "Read the latest transactions of the attached wallet, newest first.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Max transactions (1-10, default 5)" },
      },
      additionalProperties: false,
    },
    run: async (args, ctx) => {
      const missing = requireWallet(ctx);
      if (missing) return { text: missing, isError: true };
      const raw = typeof args.limit === "number" ? Math.floor(args.limit) : 5;
      const limit = Math.min(10, Math.max(1, raw));
      const entries = await getHistory(ctx.network, ctx.walletAddress as string, limit);
      if (entries.length === 0) return { text: `No transactions yet (${ctx.network}).` };
      const cluster = ctx.network === "mainnet" ? "" : "?cluster=devnet";
      const lines = entries.map((e) => {
        const when = e.blockTime ? new Date(e.blockTime * 1000).toISOString() : "unknown time";
        const status = e.err ? "Failed" : "Confirmed";
        return `- ${e.signature} [${status}] ${when} https://explorer.solana.com/tx/${e.signature}${cluster}`;
      });
      return { text: `Latest ${entries.length} (${ctx.network}):\n${lines.join("\n")}` };
    },
  },
  {
    name: "send_sol",
    category: "wallet",
    description: "Send SOL from the attached wallet. Limits are enforced by the Privy policy.",
    inputSchema: {
      type: "object",
      properties: {
        to: { type: "string", description: "Destination Solana address (base58)" },
        sol: { type: "number", description: "Amount in SOL, e.g. 0.01" },
      },
      required: ["to", "sol"],
      additionalProperties: false,
    },
    run: async (args, ctx) => {
      const missing = requireWallet(ctx);
      if (missing) return { text: missing, isError: true };
      if (typeof args.to !== "string" || typeof args.sol !== "number" || !Number.isFinite(args.sol)) {
        return { text: "'to' must be an address and 'sol' a number.", isError: true };
      }
      if (args.sol <= 0) {
        return { text: "Amount must be greater than 0.", isError: true };
      }
      let destination: PublicKey;
      try {
        destination = new PublicKey(args.to);
      } catch {
        return { text: "Invalid destination address.", isError: true };
      }
      const lamports = Math.round(args.sol * 1_000_000_000);
      const sender = new PublicKey(ctx.walletAddress as string);
      const balance = await getBalanceLamports(ctx.network, sender.toBase58());
      if (balance < lamports + FEE_BUFFER_LAMPORTS) {
        return {
          text: `Insufficient balance: ${balance / 1_000_000_000} SOL available.`,
          isError: true,
        };
      }
      const { blockhash } = { blockhash: await getLatestBlockhash(ctx.network) };
      const tx = new Transaction({ feePayer: sender, recentBlockhash: blockhash }).add(
        SystemProgram.transfer({ fromPubkey: sender, toPubkey: destination, lamports }),
      );
      const serialized = Buffer.from(
        await tx.serialize({ requireAllSignatures: false, verifySignatures: false }),
      ).toString("base64");
      try {
        const hash = await signAndSend(ctx.walletId, serialized, ctx.network);
        const cluster = ctx.network === "mainnet" ? "" : "?cluster=devnet";
        return {
          text: `Sent ${args.sol} SOL (${ctx.network}): https://explorer.solana.com/tx/${hash}${cluster}`,
        };
      } catch (e) {
        return { text: `Send failed: ${e instanceof Error ? e.message : e}`, isError: true };
      }
    },
  },
];
