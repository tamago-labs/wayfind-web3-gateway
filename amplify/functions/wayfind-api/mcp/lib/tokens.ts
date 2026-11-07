import mainnetTokens from "../data/mainnet.json";
import devnetTokens from "../data/devnet.json";

export interface TokenMeta {
  mint: string;
  symbol: string;
  name: string;
  logo: string | null;
  kind: "native" | "stable" | "stock" | "preipo";
}

type Network = "mainnet" | "testnet";

const byNetwork: Record<Network, Map<string, TokenMeta>> = {
  mainnet: new Map((mainnetTokens as TokenMeta[]).map((t) => [t.mint, t])),
  testnet: new Map((devnetTokens as TokenMeta[]).map((t) => [t.mint, t])),
};

/** Registry lookup by mint — stock/pre-IPO mints resolve here, which is how
 * get_balances surfaces them with zero extra code per token type. */
export function resolveToken(mint: string, network: Network): TokenMeta | null {
  return byNetwork[network].get(mint) ?? null;
}
