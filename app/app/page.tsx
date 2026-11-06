'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useWallets as useSolanaWallets } from '@privy-io/react-auth/solana';

type Cluster = 'devnet' | 'mainnet-beta';

export default function AppPage() {
  const { ready, authenticated, login, logout, user } = usePrivy();
  const { wallets, ready: walletsReady } = useWallets();
  const { wallets: solanaHookWallets, ready: solanaReady } = useSolanaWallets();
  const [cluster, setCluster] = useState<Cluster>('devnet');
  const [copied, setCopied] = useState<string | null>(null);

  const solanaWallets = useMemo(() => {
    const fromHook = solanaHookWallets.filter((w) => w.address);
    if (fromHook.length > 0) return fromHook.map((w) => ({ address: w.address as string }));
    // Fallback: app is solana-only, so any wallet here is treated as Solana.
    return wallets
      .filter((w) => w.address)
      .map((w) => ({ address: w.address as string }));
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

  if (!ready) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-24 text-center font-brico text-navy">
        <p className="text-heroslate">Loading wallet…</p>
      </main>
    );
  }

  if (!authenticated) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-24 text-center font-brico text-navy">
        <h1 className="text-4xl font-extrabold tracking-tight">Access Web3 MCP</h1>
        <p className="mx-auto mt-4 max-w-md text-heroslate">
          Log in with email or connect an external Solana wallet. A Solana embedded wallet is
          created automatically on first login.
        </p>
        <button
          onClick={login}
          className="mt-8 rounded-full bg-cta px-8 py-4 font-semibold text-white hover:bg-ctahover transition-colors"
        >
          Log in
        </button>
        <p className="mt-6">
          <Link href="/" className="text-sm font-semibold text-cta hover:underline">
            Back to landing
          </Link>
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-16 font-brico text-navy">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-extrabold tracking-tight">Your wallets</h1>
        <button
          onClick={logout}
          className="rounded-full border-2 border-navy px-5 py-2 text-sm font-semibold hover:bg-navy hover:text-white transition-colors"
        >
          Log out
        </button>
      </div>
      {user?.email?.address && (
        <p className="mt-2 text-sm text-heroslate">Signed in as {user.email.address}</p>
      )}

      <div className="mt-8 flex gap-2" role="tablist" aria-label="Solana cluster">
        {(['devnet', 'mainnet-beta'] as Cluster[]).map((c) => (
          <button
            key={c}
            role="tab"
            aria-selected={cluster === c}
            onClick={() => setCluster(c)}
            className={`rounded-full px-5 py-2 text-sm font-bold transition-colors ${
              cluster === c ? 'bg-navy text-white' : 'bg-navy/5 text-navy hover:bg-navy/10'
            }`}
          >
            {c === 'devnet' ? 'Devnet' : 'Mainnet'}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-heroslate">
        Delegation scope: {cluster === 'devnet' ? 'Devnet' : 'Mainnet'}. Balances and signing come
        later via the gateway.
      </p>

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
            <li key={w.address} className="rounded-3xl border border-navy/10 bg-white p-5 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wider text-heroslate">
                Solana · {cluster}
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

      <p className="mt-8">
        <Link href="/" className="text-sm font-semibold text-cta hover:underline">
          Back to landing
        </Link>
      </p>
    </main>
  );
}
