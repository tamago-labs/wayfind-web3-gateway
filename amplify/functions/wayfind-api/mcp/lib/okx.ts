import { createHmac } from "node:crypto";
import { findBySymbol } from "./tokens";

// OKX DEX aggregator (Solana mainnet, chainIndex 501). Mirrors the retired
// wayfin backend routes (/api/v1/swap-quote, /swap-instruction) so old
// clients keep working. Reads OKX_API_KEY / OKX_SECRET_KEY /
// OKX_PASSPHRASE from the function environment (Amplify secrets).
const CHAIN_INDEX = "501";

function creds(): { key: string; secret: string; passphrase: string } {
  const key = process.env.OKX_API_KEY ?? "";
  const secret = process.env.OKX_SECRET_KEY ?? "";
  const passphrase = process.env.OKX_PASSPHRASE ?? "";
  if (!key || !secret || !passphrase) {
    throw new Error("OKX credentials are not configured on wayfind-api");
  }
  return { key, secret, passphrase };
}

async function okxGet(path: string, params: Record<string, string>): Promise<unknown> {
  const { key, secret, passphrase } = creds();
  const url = new URL(`https://web3.okx.com${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const requestPath = url.pathname + url.search;
  const timestamp = new Date().toISOString();
  const signature = createHmac("sha256", secret)
    .update(timestamp + "GET" + requestPath)
    .digest("base64");
  const res = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
      "OK-ACCESS-KEY": key,
      "OK-ACCESS-SIGN": signature,
      "OK-ACCESS-PASSPHRASE": passphrase,
      "OK-ACCESS-TIMESTAMP": timestamp,
    },
  });
  if (!res.ok) throw new Error(`OKX API HTTP ${res.status}`);
  const data = (await res.json()) as { code?: string; msg?: string; data?: unknown[] };
  if (data.code !== "0") throw new Error(data.msg || "OKX API error");
  return data.data?.[0];
}

export interface SwapQuoteParams {
  fromTokenAddress?: string;
  toTokenAddress?: string;
  fromSymbol?: string;
  toSymbol?: string;
  amount: string; // base units of the from token
}

/** Resolve a symbol through the token registry (mainnet — OKX is mainnet-only). */
export function resolveMainnetMint(symbol: string): string | null {
  return findBySymbol(symbol, "mainnet")?.mint ?? null;
}

/** GET /api/v6/dex/aggregator/quote — returns the raw quote object. */
export async function getSwapQuote(p: SwapQuoteParams): Promise<unknown> {
  const fromTokenAddress = p.fromTokenAddress ?? (p.fromSymbol ? resolveMainnetMint(p.fromSymbol) : null);
  const toTokenAddress = p.toTokenAddress ?? (p.toSymbol ? resolveMainnetMint(p.toSymbol) : null);
  if (!fromTokenAddress || !toTokenAddress || !p.amount) {
    throw new Error("Missing required parameters: fromTokenAddress/fromSymbol, toTokenAddress/toSymbol, amount");
  }
  return okxGet("/api/v6/dex/aggregator/quote", {
    chainIndex: CHAIN_INDEX,
    amount: p.amount,
    fromTokenAddress,
    toTokenAddress,
  });
}

export interface SwapInstructionParams extends SwapQuoteParams {
  userWalletAddress: string;
  slippagePercent?: string;
}

/** Returns { base58Transaction, routerResult, minReceiveAmount }. Live OKX
 * responses are flat ({ base58Transaction, ... }); the nested tx shape is
 * kept as a fallback. The tx is a base58 legacy transaction. */
export async function getSwapInstruction(p: SwapInstructionParams): Promise<{
  base58Transaction: string;
  routerResult: unknown;
  minReceiveAmount: string;
}> {
  const fromTokenAddress = p.fromTokenAddress ?? (p.fromSymbol ? resolveMainnetMint(p.fromSymbol) : null);
  const toTokenAddress = p.toTokenAddress ?? (p.toSymbol ? resolveMainnetMint(p.toSymbol) : null);
  if (!fromTokenAddress || !toTokenAddress || !p.amount || !p.userWalletAddress) {
    throw new Error(
      "Missing required parameters: fromTokenAddress/fromSymbol, toTokenAddress/toSymbol, amount, userWalletAddress",
    );
  }
  const swapData = (await okxGet("/api/v6/dex/aggregator/swap", {
    chainIndex: CHAIN_INDEX,
    amount: p.amount,
    fromTokenAddress,
    toTokenAddress,
    userWalletAddress: p.userWalletAddress,
    slippagePercent: p.slippagePercent ?? "0.5",
    autoSlippage: "true",
  })) as {
    base58Transaction?: string;
    routerResult?: unknown;
    minReceiveAmount?: string;
    tx?: { data?: string; minReceiveAmount?: string };
  };
  if (!swapData) throw new Error("No swap data available");
  return {
    base58Transaction: swapData.base58Transaction ?? swapData.tx?.data ?? "",
    routerResult: swapData.routerResult,
    minReceiveAmount: swapData.minReceiveAmount ?? swapData.tx?.minReceiveAmount ?? "0",
  };
}
