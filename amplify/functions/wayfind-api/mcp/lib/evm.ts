// Mezo EVM helpers — fetch-based JSON-RPC only (no viem/ethers in the
// Lambda bundle). Reads go to the Mezo RPC; writes go through Privy's
// eth_sendTransaction on the user's embedded EVM wallet, executed by the
// platform authorization key under the wallet's ethereum policy.
import { privySignedRpc } from "./privy";
import mezoTestnetTokens from "../data/mezo-testnet.json";
import mezoMainnetTokens from "../data/mezo-mainnet.json";

export type MezoNetwork = "mainnet" | "testnet";

export interface MezoTokenMeta {
  address: string;
  symbol: string;
  name: string;
  logo: string | null;
  kind: "native" | "stable" | "stock" | "preipo" | "mezo";
  decimals: number;
}

const byNetwork: Record<MezoNetwork, Map<string, MezoTokenMeta>> = {
  mainnet: new Map((mezoMainnetTokens as MezoTokenMeta[]).map((t) => [t.address.toLowerCase(), t])),
  testnet: new Map((mezoTestnetTokens as MezoTokenMeta[]).map((t) => [t.address.toLowerCase(), t])),
};

export function mezoChainId(network: MezoNetwork): number {
  return network === "mainnet" ? 31612 : 31611;
}

export function mezoCaip2(network: MezoNetwork): string {
  return `eip155:${mezoChainId(network)}`;
}

export function mezoRpcUrl(network: MezoNetwork): string {
  if (network === "mainnet") {
    return process.env.MEZO_MAINNET_RPC ?? "https://mezo-mainnet.boar.network";
  }
  return process.env.MEZO_TESTNET_RPC ?? "https://rpc.test.mezo.org";
}

export function mezoExplorerTxUrl(network: MezoNetwork, hash: string): string {
  const base =
    network === "mainnet" ? "https://explorer.mezo.org" : "https://explorer.test.mezo.org";
  return `${base}/tx/${hash}`;
}

export function mezoExplorerAddressUrl(network: MezoNetwork, address: string): string {
  const base =
    network === "mainnet" ? "https://explorer.mezo.org" : "https://explorer.test.mezo.org";
  return `${base}/address/${address}`;
}

export function isValidEvmAddress(address: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(address);
}

/** Case-insensitive symbol lookup. First match wins. */
export function findMezoBySymbol(symbol: string, network: MezoNetwork): MezoTokenMeta | null {
  const want = symbol.trim().toUpperCase();
  for (const t of byNetwork[network].values()) {
    if (t.symbol.toUpperCase() === want) return t;
  }
  return null;
}

export function listMezoTokens(network: MezoNetwork): MezoTokenMeta[] {
  return [...byNetwork[network].values()];
}

async function rpcCall<T>(network: MezoNetwork, method: string, params: unknown[]): Promise<T> {
  const res = await fetch(mezoRpcUrl(network), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!res.ok) throw new Error(`Mezo RPC ${method} → ${res.status}: ${await res.text()}`);
  const body = (await res.json()) as { result?: T; error?: { message?: string } };
  if (body.error) throw new Error(`Mezo RPC ${method} failed: ${body.error.message ?? "unknown"}`);
  return body.result as T;
}

/** Native BTC balance in wei. */
export async function getMezoNativeBalance(address: string, network: MezoNetwork): Promise<bigint> {
  const hex = await rpcCall<string>(network, "eth_getBalance", [address, "latest"]);
  return BigInt(hex);
}

const BALANCE_OF_SELECTOR = "0x70a08231";

/** ERC-20 balance in base units. */
export async function getMezoTokenBalance(
  token: string,
  owner: string,
  network: MezoNetwork,
): Promise<bigint> {
  const padded = owner.toLowerCase().replace(/^0x/, "").padStart(64, "0");
  const hex = await rpcCall<string>(network, "eth_call", [
    { to: token, data: `${BALANCE_OF_SELECTOR}${padded}` },
    "latest",
  ]);
  return BigInt(hex);
}

/** Display units without float loss: "1.5", "0.000032", "0". */
export function formatEvmAmount(value: bigint, decimals: number): string {
  const neg = value < 0n;
  const abs = neg ? -value : value;
  const base = 10n ** BigInt(decimals);
  const whole = abs / base;
  const frac = (abs % base).toString().padStart(decimals, "0").replace(/0+$/, "");
  return `${neg ? "-" : ""}${whole.toString()}${frac ? `.${frac}` : ""}`;
}

/** Display units (number or decimal string) → base units. Throws on bad input. */
export function parseDisplayAmount(amount: number | string, decimals: number): bigint {
  const s = typeof amount === "number" ? String(amount) : amount;
  if (!/^\d+(\.\d+)?$/.test(s.trim())) throw new Error(`Invalid amount '${s}'`);
  const [whole, frac = ""] = s.trim().split(".") as [string, string?];
  if ((frac ?? "").length > decimals) throw new Error(`Amount exceeds ${decimals} decimals`);
  const padded = ((frac ?? "") + "0".repeat(decimals)).slice(0, decimals);
  return BigInt(whole === "" ? "0" : whole) * 10n ** BigInt(decimals) + BigInt(padded === "" ? "0" : padded);
}

export function toHexWei(value: bigint): string {
  return `0x${value.toString(16)}`;
}

const TRANSFER_SELECTOR = "0xa9059cbb";

/** ERC-20 transfer calldata for transfer(to, amount). */
export function encodeErc20Transfer(to: string, amount: bigint): string {
  const addr = to.toLowerCase().replace(/^0x/, "").padStart(64, "0");
  const amt = amount.toString(16).padStart(64, "0");
  return `${TRANSFER_SELECTOR}${addr}${amt}`;
}

export interface EvmTxView {
  hash: string;
  from: string;
  to: string | null;
  valueWei: bigint;
  status: "confirmed" | "failed" | "pending";
  blockNumber: number | null;
}

export async function getMezoTransaction(
  hash: string,
  network: MezoNetwork,
): Promise<EvmTxView | null> {
  const tx = await rpcCall<
    { hash: string; from?: string; to?: string | null; value?: string; blockNumber?: string | null } | null
  >(network, "eth_getTransactionByHash", [hash]);
  if (!tx) return null;
  let status: EvmTxView["status"] = "pending";
  let blockNumber: number | null = null;
  if (tx.blockNumber) {
    blockNumber = Number.parseInt(tx.blockNumber, 16);
    const receipt = await rpcCall<{ status?: string } | null>(
      network,
      "eth_getTransactionReceipt",
      [hash],
    ).catch(() => null);
    // No receipt yet (indexing lag) is pending, not failed — only an
    // explicit 0x0 status means the transaction failed.
    if (!receipt) return { hash: tx.hash, from: tx.from ?? "unknown", to: tx.to ?? null, valueWei: BigInt(tx.value ?? "0x0"), status: "pending", blockNumber };
    status = receipt.status === "0x1" ? "confirmed" : "failed";
  }
  return {
    hash: tx.hash,
    from: tx.from ?? "unknown",
    to: tx.to ?? null,
    valueWei: BigInt(tx.value ?? "0x0"),
    status,
    blockNumber,
  };
}

/**
 * Ask Privy to sign + broadcast an EVM transaction from the user's embedded
 * wallet. The platform authorization key executes it under the wallet's
 * ethereum policy — amount limits live there, not here.
 * Response shape per Privy REST docs: { data: { hash, caip2 } }.
 */
export async function evmSendTransaction(
  evmWalletId: string,
  network: MezoNetwork,
  tx: { to: string; valueWei?: bigint; data?: string },
): Promise<string> {
  const transaction: Record<string, unknown> = {
    to: tx.to,
    chain_id: mezoChainId(network),
  };
  if (tx.valueWei !== undefined) transaction.value = toHexWei(tx.valueWei);
  if (tx.data !== undefined) transaction.data = tx.data;
  const sent = await privySignedRpc<{ data?: { hash?: string } }>(evmWalletId, {
    method: "eth_sendTransaction",
    caip2: mezoCaip2(network),
    params: { transaction },
  });
  const hash = sent.data?.hash;
  if (!hash) throw new Error("Privy returned no transaction hash");
  return hash;
}
