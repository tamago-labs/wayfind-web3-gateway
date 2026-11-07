import { PublicKey, SystemProgram, Transaction, type Blockhash } from "@solana/web3.js";
import type { ToolDef } from "../../types";
import { getBalanceLamports, getLatestBlockhash } from "../../lib/rpc";
import { signAndSend } from "../../lib/privy";

// Fee buffer only — amount limits live in the Privy default policy.
const FEE_BUFFER_LAMPORTS = 5_000;

export const sendSolTool: ToolDef = {
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
    if (!ctx.walletAddress) {
      return {
        text: "Sending is not enabled for this URL yet — regenerate it from Connect to attach the wallet.",
        isError: true,
      };
    }
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
    const sender = new PublicKey(ctx.walletAddress);
    const balance = await getBalanceLamports(ctx.network, sender.toBase58());
    if (balance < lamports + FEE_BUFFER_LAMPORTS) {
      return {
        text: `Insufficient balance: ${balance / 1_000_000_000} SOL available.`,
        isError: true,
      };
    }
    const blockhash = await getLatestBlockhash(ctx.network);
    // web3.js v3 ctor requires blockhash + lastValidBlockHeight — assign
    // properties instead (same wire format script 05 proven at runtime).
    const tx = new Transaction();
    tx.feePayer = sender;
    tx.recentBlockhash = blockhash as Blockhash;
    tx.add(SystemProgram.transfer({ fromPubkey: sender, toPubkey: destination, lamports }));
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
};
