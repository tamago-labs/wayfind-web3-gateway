'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { generateClient } from 'aws-amplify/data';
import { usePrivy, useSigners, useWallets } from '@privy-io/react-auth';
import { useWallets as useSolanaWallets } from '@privy-io/react-auth/solana';
import type { Schema } from '@/amplify/data/resource';

const dataClient = generateClient<Schema>();

interface WalletStatus {
  walletId: string;
  delegated: boolean;
  signerIds: string[];
  policyIds: string[];
}

function short(value: string) {
  return value.length > 12 ? `${value.slice(0, 6)}…${value.slice(-4)}` : value;
}

export default function AuthorizationPage() {
  const { user } = usePrivy();
  const { wallets } = useWallets();
  const { wallets: solanaHookWallets } = useSolanaWallets();
  const { addSigners, removeSigners } = useSigners();
  const [statusByAddress, setStatusByAddress] = useState<Record<string, WalletStatus>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const solanaWallets = useMemo(() => {
    const fromHook = solanaHookWallets.filter((w) => w.address);
    if (fromHook.length > 0) return fromHook.map((w) => ({ address: w.address as string }));
    return wallets.filter((w) => w.address).map((w) => ({ address: w.address as string }));
  }, [wallets, solanaHookWallets]);

  // Privy wallet id per address (needed for server reads). Ids never leave
  // the Privy user object except into our own backend calls.
  const idByAddress = useMemo(() => {
    const map: Record<string, string> = {};
    const accounts = (user?.linkedAccounts ?? []) as Array<{
      type: string;
      address?: string;
      id?: string;
    }>;
    for (const a of accounts) {
      if (a.type === 'wallet' && a.address && a.id) map[a.address] = a.id;
    }
    return map;
  }, [user]);

  const refresh = useCallback(async () => {
    const entries = await Promise.all(
      solanaWallets.map(async (w) => {
        const walletId = idByAddress[w.address];
        if (!walletId) return null;
        try {
          const res = await dataClient.queries.walletState({ walletId });
          const state = res.data as unknown as WalletStatus | null;
          return state ? ([w.address, state] as const) : null;
        } catch {
          return null;
        }
      }),
    );
    const next: Record<string, WalletStatus> = {};
    for (const e of entries) {
      if (e) next[e[0]] = e[1];
    }
    setStatusByAddress(next);
  }, [solanaWallets, idByAddress]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const authorize = async (address: string) => {
    setError(null);
    setBusy(address);
    try {
      const proposed = await dataClient.mutations.proposeSigner({ walletAddress: address });
      const result = proposed.data as unknown as { signerId?: string; policyId?: string } | null;
      if (!result?.signerId) throw new Error('Signer is not configured yet');
      await addSigners({
        address,
        signers: [
          {
            signerId: result.signerId,
            ...(result.policyId ? { policyIds: [result.policyId] } : {}),
          },
        ],
      });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Authorization failed');
    } finally {
      setBusy(null);
    }
  };

  const revoke = async (address: string) => {
    const status = statusByAddress[address];
    setError(null);
    setBusy(address);
    try {
      await removeSigners({ address });
      if (status) {
        await dataClient.mutations.revokeSigner({ walletId: status.walletId });
      }
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Revoke failed');
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="mx-auto max-w-2xl space-y-4 pt-2">
      <div className="rounded-3xl border border-navy/10 bg-white p-6 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wider text-heroslate">
          Delegation · Devnet
        </p>
        <p className="mt-2 text-lg font-bold">Your Bots act only with permission</p>
        <p className="mt-2 text-sm text-heroslate">
          Authorizing adds Wayfind as a signer on your wallet under the default policy. You stay
          the owner and can revoke at any time. Refresh any time: this page reads live state from
          Privy, not a copy.
        </p>
      </div>

      {error && (
        <p className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
          {error}
        </p>
      )}

      {solanaWallets.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-navy/20 p-6 text-sm text-heroslate">
          <p className="font-bold text-navy">No wallets to authorize yet.</p>
          <p className="mt-2">
            Your Solana wallet appears here after login. Check Connect if this stays empty.
          </p>
        </div>
      ) : (
        solanaWallets.map((w) => {
          const status = statusByAddress[w.address];
          return (
            <div
              key={w.address}
              className="rounded-3xl border border-navy/10 bg-white p-6 shadow-sm"
            >
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/solana.png" alt="Solana" className="h-7 w-7 rounded-full" />
                <div className="min-w-0">
                  <p className="truncate font-mono text-sm font-semibold" title={w.address}>
                    {short(w.address)}
                  </p>
                  <p className="text-xs font-semibold text-heroslate">
                    {!status
                      ? 'Checking status…'
                      : status.delegated
                        ? `Authorized · policy ${status.policyIds[0] ? short(status.policyIds[0]) : 'default'}`
                        : 'Not authorized'}
                  </p>
                </div>
                {status?.delegated ? (
                  <button
                    onClick={() => revoke(w.address)}
                    disabled={busy === w.address}
                    className="ml-auto rounded-full border-2 border-navy px-4 py-1.5 text-xs font-bold hover:bg-navy hover:text-white transition-colors disabled:opacity-50"
                  >
                    {busy === w.address ? 'Working…' : 'Revoke'}
                  </button>
                ) : (
                  <button
                    onClick={() => authorize(w.address)}
                    disabled={busy === w.address || !status}
                    className="ml-auto rounded-full bg-cta px-5 py-2 text-xs font-bold text-white hover:bg-ctahover transition-colors disabled:opacity-50"
                  >
                    {busy === w.address ? 'Working…' : 'Authorize Wayfind'}
                  </button>
                )}
              </div>
            </div>
          );
        })
      )}
    </section>
  );
}
