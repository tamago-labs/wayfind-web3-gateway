'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Connection, PublicKey } from '@solana/web3.js';
import { generateClient } from 'aws-amplify/data';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useWallets as useSolanaWallets } from '@privy-io/react-auth/solana';
import type { Schema } from '@/amplify/data/resource';

const dataClient = generateClient<Schema>();

const DEVNET_RPC =
  process.env.NEXT_PUBLIC_SOLANA_DEVNET_RPC ?? 'https://api.devnet.solana.com';
const MAINNET_RPC =
  process.env.NEXT_PUBLIC_SOLANA_MAINNET_RPC ?? 'https://api.mainnet-beta.solana.com';

interface Row {
  address: string;
  sol: number | null;
}

export default function BalancesPage() {
  const { user } = usePrivy();
  const { wallets } = useWallets();
  const { wallets: solanaHookWallets } = useSolanaWallets();
  const [rows, setRows] = useState<Row[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [network, setNetwork] = useState<'mainnet' | 'testnet'>('testnet');

  const solanaWallets = useMemo(() => {
    const fromHook = solanaHookWallets.filter((w) => w.address);
    if (fromHook.length > 0) return fromHook.map((w) => ({ address: w.address as string }));
    return wallets.filter((w) => w.address).map((w) => ({ address: w.address as string }));
  }, [wallets, solanaHookWallets]);

  const refresh = useCallback(async () => {
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
    const connection = new Connection(scope === 'mainnet' ? MAINNET_RPC : DEVNET_RPC, 'confirmed');
    const balances = await Promise.all(
      solanaWallets.map(async (w) => {
        try {
          const lamports = await connection.getBalance(new PublicKey(w.address));
          return { address: w.address, sol: lamports / 1_000_000_000 };
        } catch {
          return { address: w.address, sol: null };
        }
      }),
    );
    setRows(balances);
    setLoaded(true);
  }, [solanaWallets, user?.id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <section className="mx-auto max-w-2xl pt-2">
      {!loaded ? (
        <p className="mt-8 text-heroslate">Loading balances…</p>
      ) : rows.length === 0 ? (
        <div className="mt-8 rounded-3xl border border-dashed border-navy/20 p-6 text-sm text-heroslate">
          <p className="font-bold text-navy">No wallets yet.</p>
          <p className="mt-2">Log in with email and a Solana wallet is created automatically.</p>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {rows.map((r) => (
            <li
              key={r.address}
              className="rounded-3xl border border-navy/10 bg-white p-5 text-sm shadow-sm"
            >
              <div className="flex items-center gap-3">
                <p className="truncate font-mono font-semibold" title={r.address}>
                  {r.address}
                </p>
                <span className="ml-auto shrink-0 rounded-full bg-navy/5 px-3 py-1 text-xs font-bold text-navy">
                  {network === 'mainnet' ? 'Mainnet' : 'Devnet'}
                </span>
              </div>
              <p className="mt-2 text-2xl font-extrabold text-navy">
                {r.sol == null ? '—' : `${r.sol.toLocaleString()} SOL`}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
