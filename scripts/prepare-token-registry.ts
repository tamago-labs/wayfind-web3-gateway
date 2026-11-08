// Builds data/tokens/{mainnet,devnet}.json from wayfind-mcp-server sources.
// Run: npx tsx scripts/prepare-token-registry.ts
// Sources (sibling repo, read-only):
//   base-tokens.json  — SOL + stables (only devnet-mint source)
//   rwa-v1-list.json  — xStocks + RWA tokens (addresses.solana + logo)
//   pre-ipo-list.json — pre-IPO mints + prestocks images
// Decimals come from chain (getTokenAccountsByOwner), NOT this registry.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = "C:/projects/wayfind-mcp-server/src/data";

interface Entry {
  mint: string;
  symbol: string;
  name: string;
  logo: string | null;
  kind: "native" | "stable" | "stock" | "preipo";
  decimals?: number;
}

// High-confidence CoinMarketCap logo IDs only; everything else falls back
// to a letter avatar in the UI rather than a guessed URL.
const CMC = (id: number) => `https://s2.coinmarketcap.com/static/img/coins/64x64/${id}.png`;
const STABLE_LOGO: Record<string, string> = {
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: CMC(3408), // USDC
  Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB: CMC(825), // USDT
  "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU": CMC(3408), // USDC (devnet)
};

const DEVNET_MINTS = new Set([
  "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU", // USDC (devnet)
  "HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr", // EURC (devnet)
]);

const NATIVE_MINT = "11111111111111111111111111111111";

function load<T>(name: string): T {
  return JSON.parse(readFileSync(join(SRC, name), "utf8")) as T;
}

async function rpc<T>(method: string, params: unknown[]): Promise<T> {
  const body = JSON.stringify({ jsonrpc: "2.0", id: 1, method, params });
  const res = await fetch("https://api.mainnet-beta.solana.com", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
  const json = (await res.json()) as { result?: T; error?: { message?: string } };
  if (json.error) throw new Error(json.error.message ?? method);
  return json.result as T;
}

async function chainDecimals(mint: string): Promise<number | null> {
  const r = await rpc<{ value?: { decimals?: number } }>("getTokenSupply", [mint]);
  return typeof r?.value?.decimals === "number" ? r.value.decimals : null;
}

const main = async () => {
  const base = load<{ symbol: string; name: string; decimals: number; address: string }[]>(
    "base-tokens.json",
  );
  const rwa = load<{ assets: { tokens: Record<string, unknown>[] }[] }>("rwa-v1-list.json");
  const preipo = load<{ assets: { symbol: string; name: string; mint: string; image: string }[] }>(
    "pre-ipo-list.json",
  );

  const mainnet = new Map<string, Entry>();
  const devnet = new Map<string, Entry>();

  // SOL first in both (UI always shows it). Native SOL uses 9 decimals.
  const sol: Entry = { mint: NATIVE_MINT, symbol: "SOL", name: "Solana", logo: "/solana.png", kind: "native", decimals: 9 };
  mainnet.set(NATIVE_MINT, sol);
  devnet.set(NATIVE_MINT, sol);

  for (const t of base) {
    if (t.address === NATIVE_MINT) continue; // SOL seeded above; base row would mistype it
    const entry: Entry = {
      mint: t.address,
      symbol: t.symbol,
      name: t.name,
      logo: STABLE_LOGO[t.address] ?? null,
      kind: "stable",
      // base-tokens.json carries audited decimals — keep them so the backend
      // never has to RPC-fetch decimals for these at request time.
      decimals: t.decimals,
    };
    (DEVNET_MINTS.has(t.address) ? devnet : mainnet).set(t.address, entry);
  }

  let rwaCount = 0;
  for (const a of rwa.assets) {
    for (const raw of a.tokens) {
      const t = raw as {
        symbol?: string;
        name?: string;
        logo?: string;
        addresses?: Record<string, string>;
      };
      const mint = t.addresses?.solana;
      if (typeof mint !== "string" || typeof t.symbol !== "string") continue;
      if (mainnet.has(mint)) continue; // base stables win on collision
      mainnet.set(mint, {
        mint,
        symbol: t.symbol,
        name: typeof t.name === "string" ? t.name : t.symbol,
        logo: typeof t.logo === "string" && t.logo.startsWith("http") ? t.logo : null,
        kind: "stock",
      });
      rwaCount++;
    }
  }

  let preCount = 0;
  for (const a of preipo.assets) {
    if (typeof a.mint !== "string" || mainnet.has(a.mint)) continue;
    mainnet.set(a.mint, {
      mint: a.mint,
      symbol: a.symbol,
      name: a.name,
      logo: typeof a.image === "string" && a.image.startsWith("http") ? a.image : null,
      kind: "preipo",
    });
    preCount++;
  }

  // RWA / pre-IPO sources carry no decimals — fetch from chain once, here,
  // so request-time code never depends on RPC for them. getTokenSupply works
  // on restricted public RPCs; failures leave decimals undefined and the
  // backend falls back to an OKX probe (quotes) or getTokenSupply (sends).
  const missing = [...mainnet.values(), ...devnet.values()].filter(
    (e) => typeof e.decimals !== "number" && e.mint !== NATIVE_MINT,
  );
  let filled = 0;
  for (const e of missing) {
    try {
      const d = await chainDecimals(e.mint);
      if (typeof d === "number") {
        e.decimals = d;
        filled++;
      }
    } catch {
      // leave undefined — runtime fallback covers it
    }
    await new Promise((r) => setTimeout(r, 200)); // be gentle on public RPC
  }
  if (missing.length > 0) console.log(`decimals: filled ${filled}/${missing.length} from chain`);

  const outDir = join(ROOT, "data", "tokens");
  mkdirSync(outDir, { recursive: true });
  const mainList = [...mainnet.values()];
  const devList = [...devnet.values()];
  writeFileSync(join(outDir, "mainnet.json"), JSON.stringify(mainList, null, 2) + "\n");
  writeFileSync(join(outDir, "devnet.json"), JSON.stringify(devList, null, 2) + "\n");
  // The Lambda bundle cannot resolve outside its folder, so sync copies into
  // the function. Re-run this script (never hand-edit the copies) to refresh.
  const fnDir = join(ROOT, "amplify", "functions", "wayfind-api", "mcp", "data");
  mkdirSync(fnDir, { recursive: true });
  writeFileSync(join(fnDir, "mainnet.json"), JSON.stringify(mainList) + "\n");
  writeFileSync(join(fnDir, "devnet.json"), JSON.stringify(devList) + "\n");

  const kinds = (l: Entry[]) => l.reduce<Record<string, number>>((m, e) => ({ ...m, [e.kind]: (m[e.kind] ?? 0) + 1 }), {});
  const noLogo = mainList.filter((e) => !e.logo).length;
  console.log(`mainnet: ${mainList.length} (${JSON.stringify(kinds(mainList))}, rwa=${rwaCount}, preipo=${preCount}, no-logo=${noLogo})`);
  console.log(`devnet: ${devList.length} (${JSON.stringify(kinds(devList))})`);
  console.log(`wrote data/tokens/{mainnet,devnet}.json`);
};
main();
