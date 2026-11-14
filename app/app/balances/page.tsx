'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Connection, PublicKey } from '@solana/web3.js';
import { generateClient } from 'aws-amplify/data';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useWallets as useSolanaWallets } from '@privy-io/react-auth/solana';
import { createPublicClient, formatUnits, http, parseAbi } from 'viem';
import type { Schema } from '@/amplify/data/resource';
import { getEvmChainForScope } from '@/lib/evmChains';
import mainnetTokens from '@/data/tokens/mainnet.json';
import devnetTokens from '@/data/tokens/devnet.json';
import mezoTestnetTokens from '@/data/tokens/mezo-testnet.json';
import mezoMainnetTokens from '@/data/tokens/mezo-mainnet.json';

const dataClient = generateClient<Schema>();

const DEVNET_RPC =
  process.env.NEXT_PUBLIC_SOLANA_DEVNET_RPC ?? 'https://api.devnet.solana.com';
const MAINNET_RPC =
  process.env.NEXT_PUBLIC_SOLANA_MAINNET_RPC ?? 'https://api.mainnet-beta.solana.com';
const TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const TOKEN_2022_PROGRAM = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';

interface RegistryEntry {
  mint: string;
  symbol: string;
  name: string;
  logo: string | null;
  kind: 'native' | 'stable' | 'stock' | 'preipo' | 'mezo';
}

interface EvmRegistryEntry {
  address: string;
  symbol: string;
  name: string;
  logo: string | null;
  kind: 'native' | 'stable' | 'stock' | 'preipo' | 'mezo';
  decimals: number;
}

interface Row {
  key: string;
  mint: string;
  symbol: string;
  name: string;
  logo: string | null;
  kind: string;
  chain: 'solana' | 'mezo';
  amount: number;
}

const ERC20_ABI = parseAbi(['function balanceOf(address owner) view returns (uint256)']);

const KIND_LABEL: Record<string, string> = {
  native: 'Native',
  stable: 'Stable',
  stock: 'Stock',
  preipo: 'Pre-IPO',
  mezo: 'Mezo',
  unknown: 'Unknown',
};

function Logo({ row }: { row: Row }) {
  const [failed, setFailed] = useState(false);
  if (row.logo && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={row.logo}
        alt={row.symbol}
        onError={() => setFailed(true)}
        className="h-10 w-10 shrink-0 rounded-full bg-navy/5 object-cover"
      />
    );
  }
  return (
    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-navy font-brico text-sm font-bold text-white">
      {row.symbol.charAt(0).toUpperCase()}
    </span>
  );
}

function TokenRow({ row }: { row: Row }) {
  return (
    <li className="rounded-3xl border border-navy/10 bg-white p-5 text-sm shadow-sm">
      <div className="flex items-center gap-3">
        <Logo row={row} />
        <div className="min-w-0">
          <p className="truncate font-bold">
            {row.symbol}{' '}
            <span className="font-mono font-semibold text-heroslate">{row.name}</span>
          </p>
          <p className="mt-0.5 text-xs text-heroslate">
            {KIND_LABEL[row.kind] ?? row.kind}
          </p>
        </div>
        <div className="ml-auto shrink-0 text-right">
          <p className="text-lg font-extrabold tabular-nums">
            {row.amount.toLocaleString(undefined, { maximumFractionDigits: 6 })}
          </p>
        </div>
      </div>
    </li>
  );
}

function ChainSection({
  title,
  icon,
  badge,
  rows,
  emptyHint,
}: {
  title: string;
  icon: React.ReactNode;
  badge: string;
  rows: Row[];
  emptyHint: string;
}) {
  return (
    <section className="mt-6">
      <div className="flex items-center gap-2">
        {icon}
        <h2 className="text-sm font-extrabold tracking-tight">{title}</h2>
        <span className="rounded-full bg-navy/5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-heroslate">
          {badge}
        </span>
        <span className="ml-auto text-xs text-heroslate">
          {rows.length} token{rows.length === 1 ? '' : 's'}
        </span>
      </div>
      {rows.length === 0 ? (
        <p className="mt-2 rounded-2xl border border-dashed border-navy/15 p-4 text-xs text-heroslate">
          {emptyHint}
        </p>
      ) : (
        <ul className="mt-2 space-y-3">
          {rows.map((r) => (
            <TokenRow key={r.key} row={r} />
          ))}
        </ul>
      )}
    </section>
  );
}

export default function BalancesPage() {
  const { user } = usePrivy();
  const { wallets } = useWallets();
  const { wallets: solanaHookWallets } = useSolanaWallets();
  const [rows, setRows] = useState<Row[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [network, setNetwork] = useState<'mainnet' | 'testnet'>('testnet');
  const [walletCount, setWalletCount] = useState(0);
  const [evmWalletCount, setEvmWalletCount] = useState(0);

  const embeddedByAddress = useMemo(() => {
    const map: Record<string, boolean> = {};
    const accounts = (user?.linkedAccounts ?? []) as Array<{
      type: string;
      address?: string;
      walletClientType?: string;
    }>;
    for (const a of accounts) {
      if (a.type === 'wallet' && a.address) map[a.address] = a.walletClientType === 'privy';
    }
    return map;
  }, [user]);

  const solanaWallets = useMemo(() => {
    const fromHook = solanaHookWallets.filter((w) => w.address);
    if (fromHook.length > 0) return fromHook.map((w) => ({ address: w.address as string }));
    // Fallback excludes EVM addresses — PublicKey() throws on 0x strings.
    return wallets
      .filter((w) => w.address && !(w.address as string).startsWith('0x'))
      .map((w) => ({ address: w.address as string }));
  }, [wallets, solanaHookWallets]);

  // Embedded only (same filter as the account modal) — external wallets must
  // never pollute the totals. Unknown (not yet in linkedAccounts) counts as
  // external until Privy reports it, matching AppSidebar behavior.
  const evmWallets = useMemo(() => {
    return wallets
      .filter(
        (w) =>
          w.address &&
          typeof w.address === 'string' &&
          (w.address as string).startsWith('0x') &&
          (embeddedByAddress[w.address as string] ?? false),
      )
      .map((w) => ({ address: w.address as string }));
  }, [wallets, embeddedByAddress]);

  const loadedOnce = useRef(false);
  const lastScope = useRef<'mainnet' | 'testnet' | null>(null);

  const refresh = useCallback(async () => {
    // Privy hooks can transiently report zero wallets a few seconds after
    // load (re-sync / embedded EVM creation). Never blank an already-loaded
    // view with that — on the very first run, fall through to the empty state.
    if (solanaWallets.length === 0 && evmWallets.length === 0) {
      if (!loadedOnce.current) {
        loadedOnce.current = true;
        setLoaded(true);
      }
      return;
    }
    // Skeleton only on first load; refetches keep old rows visible.
    if (!loadedOnce.current) setLoaded(false);
    // Scope follows the same UserProfile network the account modal saves.
    let scope: 'mainnet' | 'testnet' = 'testnet';
    if (user?.id) {
      try {
        const { data } = await dataClient.models.UserProfile.list({
          filter: { ownerId: { eq: user.id } },
        });
        const row = (data ?? []).find((r) => r.ownerId === user.id) ?? null;
        if (row?.network === 'mainnet' || row?.network === 'testnet') {
          scope = row.network;
        }
      } catch {
        // Fall through on devnet scope.
      }
    }
    setNetwork(scope);
    const registry = new Map<string, RegistryEntry>(
      (scope === 'mainnet' ? mainnetTokens : devnetTokens).map((t) => [t.mint, t as RegistryEntry]),
    );
    const connection = new Connection(scope === 'mainnet' ? MAINNET_RPC : DEVNET_RPC, 'confirmed');
    const totals = new Map<string, number>();
    await Promise.all(
      solanaWallets.map(async (w) => {
        try {
          const [lamports, ...tokenLists] = await Promise.all([
            connection.getBalance(new PublicKey(w.address)),
            connection.getParsedTokenAccountsByOwner(new PublicKey(w.address), {
              programId: new PublicKey(TOKEN_PROGRAM),
            }),
            connection.getParsedTokenAccountsByOwner(new PublicKey(w.address), {
              programId: new PublicKey(TOKEN_2022_PROGRAM),
            }),
          ]);
          totals.set(
            '11111111111111111111111111111111',
            (totals.get('11111111111111111111111111111111') ?? 0) + Number(lamports) / 1_000_000_000,
          );
          for (const list of tokenLists) {
            for (const acc of list.value) {
              const info = (acc.account.data as unknown as { parsed?: { info?: { mint?: string; tokenAmount?: { uiAmount?: number } } } }).parsed?.info;
              if (!info?.mint || typeof info.tokenAmount?.uiAmount !== 'number') continue;
              if (info.tokenAmount.uiAmount <= 0) continue;
              totals.set(info.mint, (totals.get(info.mint) ?? 0) + info.tokenAmount.uiAmount);
            }
          }
        } catch {
          // One wallet failing must not blank the rest.
        }
      }),
    );
    const next: Row[] = [];
    totals.forEach((amount, mint) => {
      const reg = registry.get(mint);
      next.push({
        key: `sol:${mint}`,
        mint,
        symbol: reg?.symbol ?? 'Unknown',
        name: reg?.name ?? `Token ${mint.slice(0, 6)}…`,
        logo: reg?.logo ?? null,
        kind: reg?.kind ?? 'unknown',
        chain: 'solana',
        amount,
      });
    });
    // Mezo EVM balances (native BTC + ERC20 list for the scope).
    const evmRegistry = new Map<string, EvmRegistryEntry>(
      (scope === 'mainnet' ? mezoMainnetTokens : mezoTestnetTokens).map((t) => [
        (t as EvmRegistryEntry).address.toLowerCase(),
        t as EvmRegistryEntry,
      ]),
    );
    const evmChain = getEvmChainForScope(scope);
    const evmClient = createPublicClient({ chain: evmChain, transport: http() });
    const evmTotals = new Map<string, number>();
    await Promise.all(
      evmWallets.map(async (w) => {
        const owner = w.address as `0x${string}`;
        try {
          const nativeBal = await evmClient.getBalance({ address: owner });
          if (nativeBal > BigInt(0)) {
            evmTotals.set(
              'native',
              (evmTotals.get('native') ?? 0) + Number(formatUnits(nativeBal, 18)),
            );
          }
        } catch {
          // Native read failing must not blank ERC20 reads.
        }
        await Promise.all(
          Array.from(evmRegistry.values())
            .filter((t) => t.address !== 'native')
            .map(async (t) => {
              try {
                const bal = (await evmClient.readContract({
                  address: t.address as `0x${string}`,
                  abi: ERC20_ABI,
                  functionName: 'balanceOf',
                  args: [owner],
                })) as bigint;
                if (bal > BigInt(0)) {
                  const key = t.address.toLowerCase();
                  evmTotals.set(
                    key,
                    (evmTotals.get(key) ?? 0) + Number(formatUnits(bal, t.decimals)),
                  );
                }
              } catch {
                // One token failing must not blank the rest.
              }
            }),
        );
      }),
    );
    evmTotals.forEach((amount, key) => {
      const reg = evmRegistry.get(key);
      next.push({
        key: `mezo:${key}`,
        mint: reg?.address ?? key,
        symbol: reg?.symbol ?? 'Unknown',
        name: reg?.name ?? `Token ${key.slice(0, 6)}…`,
        logo: reg?.logo ?? null,
        kind: reg?.kind ?? 'unknown',
        chain: 'mezo',
        amount,
      });
    });
    // SOL first, then Mezo BTC, then by amount desc (stable chain grouping).
    const rank = (r: Row) =>
      r.chain === 'solana' && r.mint === '11111111111111111111111111111111'
        ? 0
        : r.chain === 'mezo' && r.mint === 'native'
          ? 1
          : 2;
    next.sort((a, b) => rank(a) - rank(b) || b.amount - a.amount);
    // A refetch that finds nothing (RPC blip) must not wipe a loaded view —
    // unless the scope itself changed, in which case empty is a real answer.
    if (next.length === 0 && loadedOnce.current && lastScope.current === scope) return;
    lastScope.current = scope;
    loadedOnce.current = true;
    setRows(next);
    setWalletCount(solanaWallets.length);
    setEvmWalletCount(evmWallets.length);
    setLoaded(true);
  }, [solanaWallets, evmWallets, user?.id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const solRows = useMemo(() => rows.filter((r) => r.chain === 'solana'), [rows]);
  const mezoRows = useMemo(() => rows.filter((r) => r.chain === 'mezo'), [rows]);
  const scopeLabel = network === 'mainnet' ? 'Mainnet' : 'Devnet';

  return (
    <section className="mx-auto max-w-2xl pt-2">
      {!loaded ? (
        <div aria-label="Loading">
          <p className="mt-8 text-sm font-semibold text-heroslate">Loading balances…</p>
          <div className="mt-2 space-y-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="flex animate-pulse items-center gap-3 rounded-3xl border border-navy/10 bg-white p-5"
              >
                <div className="h-10 w-10 rounded-full bg-navy/10" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-24 rounded-full bg-navy/10" />
                  <div className="h-3 w-16 rounded-full bg-navy/10" />
                </div>
                <div className="h-5 w-20 rounded-full bg-navy/10" />
              </div>
            ))}
          </div>
        </div>
      ) : rows.length === 0 ? (
        <div className="mt-8 rounded-3xl border border-dashed border-navy/20 p-6 text-sm text-heroslate">
          <p className="font-bold text-navy">No wallets yet.</p>
          <p className="mt-2">Log in with email and Solana + Mezo wallets are created automatically.</p>
        </div>
      ) : (
        <>
          <ChainSection
            title="Solana"
            icon={
              // eslint-disable-next-line @next/next/no-img-element
              <img src="/solana.png" alt="Solana" className="h-5 w-5 rounded-full" loading="lazy" />
            }
            badge={scopeLabel}
            rows={solRows}
            emptyHint={`No Solana balances on ${scopeLabel}.`}
          />
          <ChainSection
            title="Mezo"
            icon={
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src="https://s2.coinmarketcap.com/static/img/coins/64x64/39727.png"
                alt="Mezo"
                className="h-5 w-5 rounded-full"
                loading="lazy"
              />
            }
            badge={network === 'mainnet' ? 'Mainnet' : 'Testnet'}
            rows={mezoRows}
            emptyHint={`No Mezo balances on ${network === 'mainnet' ? 'Mainnet' : 'Testnet'}.`}
          />
        </>
      )}
    </section>
  );
}
