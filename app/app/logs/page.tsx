'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Connection, PublicKey } from '@solana/web3.js';
import { useWallets } from '@privy-io/react-auth';
import { useWallets as useSolanaWallets } from '@privy-io/react-auth/solana';

const DEVNET_RPC = 'https://api.devnet.solana.com';

interface Entry {
  signature: string;
  address: string;
  time: number | null;
  failed: boolean;
}

export default function LogsPage() {
  const { wallets } = useWallets();
  const { wallets: solanaHookWallets } = useSolanaWallets();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loaded, setLoaded] = useState(false);

  const solanaWallets = useMemo(() => {
    const fromHook = solanaHookWallets.filter((w) => w.address);
    if (fromHook.length > 0) return fromHook.map((w) => ({ address: w.address as string }));
    return wallets.filter((w) => w.address).map((w) => ({ address: w.address as string }));
  }, [wallets, solanaHookWallets]);

  const refresh = useCallback(async () => {
    const connection = new Connection(DEVNET_RPC, 'confirmed');
    const lists = await Promise.all(
      solanaWallets.map(async (w) => {
        try {
          const sigs = await connection.getSignaturesForAddress(new PublicKey(w.address), {
            limit: 10,
          });
          return sigs.map(
            (s): Entry => ({
              signature: s.signature,
              address: w.address,
              time: s.blockTime == null ? null : Number(s.blockTime),
              failed: !!s.err,
            }),
          );
        } catch {
          return [];
        }
      }),
    );
    setEntries(
      lists.flat().sort((a, b) => (b.time ?? 0) - (a.time ?? 0)),
    );
    setLoaded(true);
  }, [solanaWallets]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <section className="mx-auto max-w-2xl pt-2">
      {!loaded ? (
        <p className="mt-8 text-heroslate">Loading activity…</p>
      ) : entries.length === 0 ? (
        <div className="mt-8 rounded-3xl border border-dashed border-navy/20 p-6 text-sm text-heroslate">
          <p className="font-bold text-navy">No activity yet.</p>
          <p className="mt-2">
            Delegated transactions will appear here with status, newest first. This reads live
            Devnet history, not a copy.
          </p>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {entries.map((e) => (
            <li
              key={e.signature}
              className="rounded-3xl border border-navy/10 bg-white p-5 text-sm shadow-sm"
            >
              <div className="flex items-center gap-2">
                <p className="truncate font-mono font-semibold" title={e.signature}>
                  {e.signature}
                </p>
                <span
                  className={`ml-auto shrink-0 rounded-full px-3 py-1 text-xs font-bold ${
                    e.failed ? 'bg-red-50 text-red-700' : 'bg-navy/5 text-navy'
                  }`}
                >
                  {e.failed ? 'Failed' : 'Confirmed'}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-3 text-xs text-heroslate">
                {e.time && <span>{new Date(e.time * 1000).toLocaleString()}</span>}
                <a
                  href={`https://explorer.solana.com/tx/${e.signature}?cluster=devnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-cta hover:underline"
                >
                  Explorer
                </a>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
