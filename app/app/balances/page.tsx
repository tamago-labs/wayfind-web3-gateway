'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Connection, PublicKey } from '@solana/web3.js';
import { generateClient } from 'aws-amplify/data';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useWallets as useSolanaWallets } from '@privy-io/react-auth/solana';
import type { Schema } from '@/amplify/data/resource';
import mainnetTokens from '@/data/tokens/mainnet.json';
import devnetTokens from '@/data/tokens/devnet.json';

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
  kind: 'native' | 'stable' | 'stock' | 'preipo';
}

interface Row {
  mint: string;
  symbol: string;
  name: string;
  logo: string | null;
  kind: string;
  amount: number;
}

const KIND_LABEL: Record<string, string> = {
  native: 'Native',
  stable: 'Stable',
  stock: 'Stock',
  preipo: 'Pre-IPO',
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

export default function BalancesPage() {
  const { user } = usePrivy();
  const { wallets } = useWallets();
  const { wallets: solanaHookWallets } = useSolanaWallets();
  const [rows, setRows] = useState<Row[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [network, setNetwork] = useState<'mainnet' | 'testnet'>('testnet');
  const [walletCount, setWalletCount] = useState(0);

  const solanaWallets = useMemo(() => {
    const fromHook = solanaHookWallets.filter((w) => w.address);
    if (fromHook.length > 0) return fromHook.map((w) => ({ address: w.address as string }));
    return wallets.filter((w) => w.address).map((w) => ({ address: w.address as string }));
  }, [wallets, solanaHookWallets]);

  const refresh = useCallback(async () => {
    setLoaded(false);
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
    for (const [mint, amount] of totals) {
      const reg = registry.get(mint);
      next.push({
        mint,
        symbol: reg?.symbol ?? 'Unknown',
        name: reg?.name ?? `Token ${mint.slice(0, 6)}…`,
        logo: reg?.logo ?? null,
        kind: reg?.kind ?? 'unknown',
        amount,
      });
    }
    // SOL always first, then by amount desc.
    next.sort((a, b) =>
      a.mint === '11111111111111111111111111111111'
        ? -1
        : b.mint === '11111111111111111111111111111111'
          ? 1
          : b.amount - a.amount,
    );
    setRows(next);
    setWalletCount(solanaWallets.length);
    setLoaded(true);
  }, [solanaWallets, user?.id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

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
          <p className="mt-2">Log in with email and a Solana wallet is created automatically.</p>
        </div>
      ) : (
        <>
          <p className="mt-6 text-xs text-heroslate">
            Showing {network === 'mainnet' ? 'Mainnet' : 'Devnet'}
            {walletCount > 1 ? ` · aggregated across ${walletCount} wallets` : ''} ·{' '}
            {rows.length} token{rows.length === 1 ? '' : 's'}
          </p>
          <ul className="mt-3 space-y-3">
            {rows.map((r) => (
              <li
                key={r.mint}
                className="rounded-3xl border border-navy/10 bg-white p-5 text-sm shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <Logo row={r} />
                  <div className="min-w-0">
                    <p className="truncate font-bold">
                      {r.symbol}{' '}
                      <span className="font-mono font-semibold text-heroslate">{r.name}</span>
                    </p>
                    <p className="mt-0.5 text-xs text-heroslate">
                      {KIND_LABEL[r.kind] ?? r.kind}
                    </p>
                  </div>
                  <div className="ml-auto shrink-0 text-right">
                    <p className="text-lg font-extrabold tabular-nums">
                      {r.amount.toLocaleString(undefined, { maximumFractionDigits: 6 })}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
