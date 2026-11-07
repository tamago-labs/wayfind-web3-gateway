// Circle kits bundle web3.js v1 (they call getRecentBlockhash, removed in
// v3) — the adapter connection and provider keys must be v1 instances.
import { Connection, PublicKey } from "@solana/web3js-v1";
import { privySignedRpc } from "./privy";

export type CircleNetwork = "mainnet" | "testnet";

/** Circle chain identifiers (UnifiedBalanceChain / BridgeChain values). */
export function circleChain(network: CircleNetwork): string {
  return network === "mainnet" ? "Solana" : "Solana_Devnet";
}

function rpcUrl(network: CircleNetwork): string {
  const url =
    network === "mainnet" ? process.env.SOLANA_MAINNET_RPC : process.env.NEXT_PUBLIC_SOLANA_DEVNET_RPC;
  return url || (network === "mainnet" ? "https://api.mainnet-beta.solana.com" : "https://api.devnet.solana.com");
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
    // Gateway spend signs a burn-intent message — Privy signs it remotely.
    signMessage: async (message: Uint8Array) => {
      const res = await privySignedRpc<{ data?: { signature?: string } }>(walletId, {
        method: "signMessage",
        params: { message: Buffer.from(message).toString("base64"), encoding: "base64" },
      });
      const sig = res.data?.signature;
      if (!sig) throw new Error("Privy returned no message signature");
      return { signature: new Uint8Array(Buffer.from(sig, "base64")) };
    },
  };
}

/** Circle Solana adapter wired to the attached Privy wallet. */
export async function circleAdapter(walletAddress: string, walletId: string, network: CircleNetwork) {
  // NB: createSolanaAdapterFromProvider silently drops custom connections
  // (it always builds per-chain defaults) — construct SolanaAdapter directly
  // so reads and broadcasts use our RPC.
  const { SolanaAdapter } = await import("@circle-fin/adapter-solana");
  const { Solana, SolanaDevnet } = await import("@circle-fin/bridge-kit/chains");
  const connection = new Connection(rpcUrl(network), "confirmed");
  const provider = privyProvider(walletAddress, walletId);
  // Same provider-signer shape the factory builds (isProviderSigner flag
  // selects the sign-then-broadcast path, keyed off our connection).
  const signer = {
    publicKey: provider.publicKey,
    get secretKey() {
      return new Uint8Array(0);
    },
    isProviderSigner: true,
    signTransaction: provider.signTransaction,
    signAllTransactions: provider.signAllTransactions,
    signMessage: provider.signMessage,
  };
  return new SolanaAdapter(
    { connection: connection as never, signer: signer as never },
    {
      addressContext: "user-controlled",
      supportedChains: [(network === "mainnet" ? Solana : SolanaDevnet) as never],
    },
  );
}

/** Fresh Unified Balance kit context (sync static data, no network calls). */
export async function unifiedBalanceContext() {
  const { createUnifiedBalanceKitContext } = await import("@circle-fin/unified-balance-kit");
  return createUnifiedBalanceKitContext();
}
