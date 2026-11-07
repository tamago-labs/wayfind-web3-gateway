import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  type Blockhash,
} from "@solana/web3.js";
import type { ToolContext, ToolDef } from "../../types";
import { getBalanceLamports, getLatestBlockhash } from "../../lib/rpc";
import { signAndSend } from "../../lib/privy";
import { findBySymbol } from "../../lib/tokens";
import {
  createAtaInstruction,
  findAta,
  findSourceAccount,
  transferInstruction,
} from "../../lib/spl";

// Fee buffer only — amount limits live in the Privy default policy.
const FEE_BUFFER_LAMPORTS = 5_000;

function rpcUrl(network: "mainnet" | "testnet"): string {
  if (network === "mainnet") {
    return process.env.SOLANA_MAINNET_RPC ?? "https://api.mainnet-beta.solana.com";
  }
  return process.env.SOLANA_DEVNET_RPC ?? "https://api.devnet.solana.com";
}

async function buildAndSend(
  ctx: ToolContext,
  sender: PublicKey,
  build: (tx: Transaction) => Promise<void> | void,
  label: string,
): Promise<{ text: string; isError?: boolean }> {
  const blockhash = await getLatestBlockhash(ctx.network);
  // web3.js v3 ctor requires blockhash + lastValidBlockHeight — assign
  // properties instead (same wire format script 05 proven at runtime).
  const tx = new Transaction();
  tx.feePayer = sender;
  tx.recentBlockhash = blockhash as Blockhash;
  await build(tx);
  const serialized = Buffer.from(
    await tx.serialize({ requireAllSignatures: false, verifySignatures: false }),
  ).toString("base64");
  try {
    const hash = await signAndSend(ctx.walletId, serialized, ctx.network);
    const cluster = ctx.network === "mainnet" ? "" : "?cluster=devnet";
    return {
      text: `Sent ${label} (${ctx.network}): https://explorer.solana.com/tx/${hash}${cluster}`,
    };
  } catch (e) {
    return { text: `Send failed: ${e instanceof Error ? e.message : e}`, isError: true };
  }
}

export const sendTokensTool: ToolDef = {
  name: "send_tokens",
  category: "wallet",
  description:
    "Send SOL or SPL tokens from the attached wallet by symbol. Limits are enforced by the Privy policy.",
  inputSchema: {
    type: "object",
    properties: {
      token: { type: "string", description: "Token symbol, e.g. 'SOL', 'USDC', 'CRCLX'" },
      amount: { type: "number", description: "Amount in display units, e.g. 0.01" },
      to: { type: "string", description: "Recipient Solana address (base58)" },
    },
    required: ["token", "amount", "to"],
    additionalProperties: false,
  },
  run: async (args, ctx) => {
    if (!ctx.walletAddress) {
      return {
        text: "Sending is not enabled for this URL yet — regenerate it from Connect to attach the wallet.",
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
    let destination: PublicKey;
    try {
      destination = new PublicKey(args.to);
    } catch {
      return { text: "Invalid destination address.", isError: true };
    }
    const meta = findBySymbol(args.token, ctx.network);
    if (!meta) {
      return { text: `Unknown token '${args.token}' on ${ctx.network}.`, isError: true };
    }
    const sender = new PublicKey(ctx.walletAddress);
    const connection = new Connection(rpcUrl(ctx.network), "confirmed");

    // Native SOL path (unchanged wire format).
    if (meta.kind === "native") {
      const lamports = Math.round(args.amount * 1_000_000_000);
      const balance = await getBalanceLamports(ctx.network, sender.toBase58());
      if (balance < lamports + FEE_BUFFER_LAMPORTS) {
        return {
          text: `Insufficient balance: ${balance / 1_000_000_000} SOL available.`,
          isError: true,
        };
      }
      return buildAndSend(ctx, sender, (tx) => {
        tx.add(
          SystemProgram.transfer({ fromPubkey: sender, toPubkey: destination, lamports }),
        );
      }, `${args.amount} ${meta.symbol}`);
    }

    // SPL path. Source is the real holding account (faucets often fund
    // non-ATA accounts); destination is the ATA, created if missing.
    const mint = new PublicKey(meta.mint);
    const mintInfo = await connection.getParsedAccountInfo(mint).catch(() => null);
    const decimals = (mintInfo?.value?.data as unknown as { parsed?: { info?: { decimals?: number } } })
      ?.parsed?.info?.decimals;
    if (typeof decimals !== "number") {
      return { text: `Could not read mint decimals for ${meta.symbol}.`, isError: true };
    }
    const baseUnits = BigInt(Math.round(args.amount * 10 ** decimals));
    if (baseUnits <= 0n) {
      return { text: "Amount is smaller than the token's smallest unit.", isError: true };
    }
    const holding = await findSourceAccount(connection, sender, mint, baseUnits);
    if (!holding) {
      return { text: `Insufficient ${meta.symbol} balance on this wallet.`, isError: true };
    }
    const destAta = await findAta(mint, destination);
    const destExists = await connection.getAccountInfo(destAta).catch(() => null);
    return buildAndSend(ctx, sender, (tx) => {
      if (!destExists) tx.add(createAtaInstruction(sender, destAta, destination, mint));
      tx.add(transferInstruction(holding.source, destAta, sender, baseUnits));
    }, `${args.amount} ${meta.symbol}`);
  },
};
