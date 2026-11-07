// Minimal Solana RPC over plain fetch — no web3.js in the Lambda bundle.
// RPC URLs are plain env (declared in functions/wayfind-api/resource.ts).

function rpcUrl(network: "mainnet" | "testnet"): string {
  if (network === "mainnet") {
    return process.env.SOLANA_MAINNET_RPC ?? "https://api.mainnet-beta.solana.com";
  }
  return process.env.SOLANA_DEVNET_RPC ?? "https://api.devnet.solana.com";
}

async function rpc<T>(network: "mainnet" | "testnet", method: string, params: unknown[]): Promise<T> {
  const res = await fetch(rpcUrl(network), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!res.ok) throw new Error(`RPC ${method} → HTTP ${res.status}`);
  const body = (await res.json()) as { result?: T; error?: { message?: string } };
  if (body.error) throw new Error(`RPC ${method}: ${body.error.message ?? "unknown error"}`);
  return body.result as T;
}

export async function getBalanceSol(network: "mainnet" | "testnet", address: string): Promise<number> {
  const lamports = await rpc<{ value: number }>(network, "getBalance", [address]);
  return lamports.value / 1_000_000_000;
}

export interface SigEntry {
  signature: string;
  blockTime: number | null;
  err: unknown;
}

export async function getHistory(
  network: "mainnet" | "testnet",
  address: string,
  limit = 10,
): Promise<SigEntry[]> {
  return rpc<SigEntry[]>(network, "getSignaturesForAddress", [address, { limit }]);
}
