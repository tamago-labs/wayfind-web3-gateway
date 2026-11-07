'use client';

import { useMemo, useState } from 'react';
import { useWallets } from '@privy-io/react-auth';
import { useWallets as useSolanaWallets } from '@privy-io/react-auth/solana';

export default function ConnectPage() {
  const { wallets, ready: walletsReady } = useWallets();
  const { wallets: solanaHookWallets, ready: solanaReady } = useSolanaWallets();
  const [copied, setCopied] = useState<string | null>(null);

  const solanaWallets = useMemo(() => {
    const fromHook = solanaHookWallets.filter((w) => w.address);
    if (fromHook.length > 0) return fromHook.map((w) => ({ address: w.address as string }));
    // Fallback: app is solana-only, so any wallet here is treated as Solana.
    return wallets.filter((w) => w.address).map((w) => ({ address: w.address as string }));
  }, [wallets, solanaHookWallets]);

  const copy = async (address: string) => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(address);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      setCopied(null);
    }
  };

  return (
    <section className="mx-auto max-w-2xl pt-2">
      {!walletsReady || !solanaReady ? (
        <p className="mt-8 text-heroslate">Loading wallets…</p>
      ) : solanaWallets.length === 0 ? (
        <div className="mt-8 rounded-3xl border border-dashed border-navy/20 p-6 text-sm text-heroslate">
          <p className="font-bold text-navy">No Solana wallets yet.</p>
          <p className="mt-2">
            If you logged in with email, the embedded wallet may still be creating, wait a few
            seconds and refresh. If it never appears, check the Privy Dashboard: Solana embedded
            wallets must be enabled for this app.
          </p>
          <p className="mt-2 font-mono text-xs">
            debug: total={wallets.length} solanaHook={solanaHookWallets.length}
          </p>
        </div>
      ) : (
        <ul className="mt-6 space-y-4">
          {solanaWallets.map((w) => (
            <li
              key={w.address}
              className="rounded-3xl border border-navy/10 bg-white p-5 shadow-sm"
            >
              <p className="text-xs font-bold uppercase tracking-wider text-heroslate">
                Solana · Devnet
              </p>
              <p className="mt-2 break-all font-mono text-sm">{w.address}</p>
              <div className="mt-3">
                <button
                  onClick={() => copy(w.address)}
                  className="rounded-full bg-navy/5 px-4 py-1.5 text-xs font-bold hover:bg-navy/10"
                >
                  {copied === w.address ? 'Copied' : 'Copy'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
