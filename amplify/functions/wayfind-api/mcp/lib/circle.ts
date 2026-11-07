import { Connection, PublicKey } from "@solana/web3.js";
import { createSolanaAdapterFromProvider } from "@circle-fin/adapter-solana";
import { privySignedRpc } from "./privy";

export type CircleNetwork = "mainnet" | "testnet";

/** Circle chain identifiers (UnifiedBalanceChain / BridgeChain values). */
export function circleChain(network: CircleNetwork): string {
  return network === "mainnet" ? "Solana" : "Solana_Devnet";
}

function rpcUrl(network: CircleNetwork): string {
  const url =
    network === "mainnet" ? process.env.SOLANA_MAINNET_RPC : process.env.NEXT_PUBLIC_SOLANA_DEVNET_RPC;
  return url || "https://api.mainnet-beta.solana.com";
}

/**
 * Sign-only through Privy — returns base64 signed tx, broadcasts nothing.
 * Shape proven live: POST /wallets/{id}/rpc → data.signed_transaction.
 */
async function privySign(walletId: string, transactionB64: string): Promise<string> {
  const res = await privySignedRpc<{ data?: { signed_transaction?: string } }>(walletId, {
    method: "signTransaction",
    params: { transaction: transactionB64, encoding: "base64" },
  });
  const signed = res.data?.signed_transaction;
  if (!signed) throw new Error("Privy returned no signed transaction");
  return signed;
}

/**
 * Privy-backed Solana wallet-standard provider for Circle kits. The kits call
 * signTransaction (sign-only) and broadcast via our Connection themselves —
 * the platform signer key never leaves Privy.
 */
function privyProvider(walletAddress: string, walletId: string) {
  const publicKey = new PublicKey(walletAddress);
  const signOne = async (transaction: unknown): Promise<unknown> => {
    const raw: Uint8Array = (transaction as { serialize(): Uint8Array }).serialize();
    const signedB64 = await privySign(walletId, Buffer.from(raw).toString("base64"));
    // Deserialize with the input's own class (kits bundle web3.js v1).
    const Ctor = (transaction as { constructor: { deserialize(b: Uint8Array): unknown } }).constructor;
    return Ctor.deserialize(Buffer.from(signedB64, "base64"));
  };
  return {
    isConnected: true,
    publicKey,
    connect: async () => ({ publicKey }),
    disconnect: async () => {},
    signTransaction: signOne,
    signAllTransactions: async (txs: unknown[]) => Promise.all(txs.map(signOne)),
  };
}

/** Circle Solana adapter wired to the attached Privy wallet. */
export async function circleAdapter(walletAddress: string, walletId: string, network: CircleNetwork) {
  const connection = new Connection(rpcUrl(network), "confirmed");
  return createSolanaAdapterFromProvider({
    // provider type is wallet-standard-loose; our shape satisfies it at runtime.
    provider: privyProvider(walletAddress, walletId) as never,
    connection: connection as never,
  });
}

/** Fresh Unified Balance kit context (sync static data, no network calls). */
export async function unifiedBalanceContext() {
  const { createUnifiedBalanceKitContext } = await import("@circle-fin/unified-balance-kit");
  return createUnifiedBalanceKitContext();
}
