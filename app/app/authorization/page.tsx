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

// Policy options. Ids are not secrets — Privy returns them on every
// authorized wallet — so matching them client-side is safe. Anything else is
// the default no-export policy.
const POLICY_OPTIONS = [
  {
    key: 'default',
    label: 'Default',
    blurb: 'No key exports',
    ids: [] as string[],
  },
  {
    key: 'caps',
    label: 'Spending caps',
    blurb: '≤1 SOL / ≤5 USDC',
    ids: ['us7w1phwzpr2c3vsw3mgeb8r'],
  },
  {
    key: 'tight',
    label: 'Tight allowlist',
    blurb: '8 programs only',
    ids: ['sma14e3q3s2fdr9172k2csej'],
  },
] as const;

type PolicyKey = (typeof POLICY_OPTIONS)[number]['key'];

// Capability rows: [default, caps, tight]. Order must match POLICY_OPTIONS.
const ROWS: { label: string; values: [string, string, string] }[] = [
  { label: 'Key export', values: ['✕ Blocked', '✕ Blocked', '✕ Blocked'] },
  { label: 'SOL per transaction', values: ['Unlimited', '≤ 1 SOL', 'Unlimited'] },
  { label: 'USDC per transaction', values: ['Unlimited', '≤ 5 USDC', 'Unlimited'] },
  {
    label: 'Programs',
    values: ['Any program', 'System · Token · Jupiter · OKX', '8 allowlisted only'],
  },
  { label: 'Swaps', values: ['Allowed', 'Jupiter / OKX', 'Jupiter / OKX'] },
  {
    label: 'Gateway deposits',
    values: ['Allowed', 'Allowed', 'Needs program approval'],
  },
];

function currentPolicyKey(policyIds: string[]): PolicyKey | null {
  if (policyIds.length === 0) return null;
  const id = policyIds[0];
  const match = POLICY_OPTIONS.find((o) => (o.ids as readonly string[]).includes(id));
  return match ? match.key : 'default';
}

export default function AuthorizationPage() {
  const { user } = usePrivy();
  const { wallets } = useWallets();
  const { wallets: solanaHookWallets } = useSolanaWallets();
  const { addSigners, removeSigners } = useSigners();
  const [statusByAddress, setStatusByAddress] = useState<Record<string, WalletStatus>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  // Signers only attach to embedded wallets — external ones can't delegate.
  const solanaWallets = useMemo(() => {
    const embedded = new Set(
      (
        (user?.linkedAccounts ?? []) as Array<{
          type: string;
          address?: string;
          walletClientType?: string;
        }>
      )
        .filter((a) => a.type === 'wallet' && a.walletClientType === 'privy' && a.address)
        .map((a) => a.address as string),
    );
    const fromHook = solanaHookWallets.filter((w) => w.address);
    const list = fromHook.length > 0 ? fromHook : wallets.filter((w) => w.address);
    return list
      .map((w) => ({ address: w.address as string }))
      .filter((w) => embedded.has(w.address));
  }, [wallets, solanaHookWallets, user]);

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
          // wallet-state returns Privy's `id` field — stamp our own walletId
          // here so revoke() always has a real id (status.walletId used to be
          // undefined, which made every revoke fail validation).
          return state ? ([w.address, { ...state, walletId }] as const) : null;
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

  const activeAddress = selected ?? solanaWallets[0]?.address ?? null;
  const activeStatus = activeAddress ? statusByAddress[activeAddress] : undefined;
  const activeKey = activeStatus?.delegated
    ? currentPolicyKey(activeStatus.policyIds)
    : null;

  const serverError = (res: { errors?: Array<{ message?: string }> | null }): string | null =>
    res.errors?.[0]?.message ?? null;

  const attach = async (address: string, key: PolicyKey) => {
    const proposed = await dataClient.mutations.proposeSigner({
      walletAddress: address,
      policyKey: key,
    });
    // Surface the backend's real error (policy mapping, signer lookup)
    // instead of masking it — AppSync nulls data when the resolver throws.
    const err = serverError(proposed as unknown as { errors?: Array<{ message?: string }> | null });
    if (err) throw new Error(err);
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
  };

  const authorize = async (address: string, key: PolicyKey) => {
    setError(null);
    setBusy(address);
    try {
      await attach(address, key);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Authorization failed');
    } finally {
      setBusy(null);
    }
  };

  const revoke = async (address: string) => {
    const status = statusByAddress[address];
    const walletId = status?.walletId ?? idByAddress[address];
    setError(null);
    setBusy(address);
    try {
      await removeSigners({ address });
      if (walletId) {
        await dataClient.mutations.revokeSigner({ walletId });
      }
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Revoke failed');
    } finally {
      setBusy(null);
    }
  };

  const switchPolicy = async (address: string, key: PolicyKey) => {
    const status = statusByAddress[address];
    setError(null);
    setBusy(address);
    try {
      await removeSigners({ address });
      if (status) {
        await dataClient.mutations.revokeSigner({ walletId: status.walletId });
      }
      await attach(address, key);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Policy switch failed');
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="mx-auto max-w-3xl space-y-4 pt-2">
      <div
        className="rounded-3xl p-6 text-white shadow-sm"
        style={{
          background: 'linear-gradient(150deg, #0E1B2C 0%, #1B2A4A 55%, #2F7BFF 160%)',
        }}
      >
        <p className="mt-2 text-lg font-bold">Choose what your Bots are allowed to do</p>
        <p className="mt-2 text-sm text-white/70">
          Pick a policy and authorize. You stay the owner and can revoke anytime.
        </p>
      </div>

      {error && (
        <p className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
          {error}
        </p>
      )}

      {solanaWallets.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-navy/20 p-6 text-sm text-heroslate">
          <p className="font-bold text-navy">No embedded wallet to authorize yet.</p>
          <p className="mt-2">
            Only Privy embedded wallets can delegate. Yours is created automatically at login —
            check the account button below if this stays empty.
          </p>
        </div>
      ) : (
        <>
          {solanaWallets.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {solanaWallets.map((w) => {
                const s = statusByAddress[w.address];
                const isActive = w.address === activeAddress;
                return (
                  <button
                    key={w.address}
                    onClick={() => setSelected(w.address)}
                    className={`rounded-2xl border px-4 py-2 text-left transition-colors ${
                      isActive
                        ? 'border-cta bg-white shadow-sm'
                        : 'border-navy/10 bg-white/60 hover:border-navy/30'
                    }`}
                  >
                    <p className="font-mono text-xs font-bold">{short(w.address)}</p>
                    <p
                      className={`text-[11px] font-semibold ${
                        s?.delegated ? 'text-emerald-600' : 'text-heroslate'
                      }`}
                    >
                      {!s
                        ? 'Checking…'
                        : s.delegated
                          ? `Authorized · ${POLICY_OPTIONS.find((o) => o.key === currentPolicyKey(s.policyIds))?.label ?? 'Default'}`
                          : 'Not authorized'}
                    </p>
                  </button>
                );
              })}
            </div>
          )}

          {activeAddress && (
            <div className="overflow-hidden rounded-3xl border border-navy/10 bg-white shadow-sm">
              <div className="border-b border-navy/10 p-4">
                <p className="font-mono text-sm font-semibold" title={activeAddress}>
                  {activeAddress}
                </p>
                <p className="text-xs font-semibold text-heroslate">
                  {!activeStatus
                    ? 'Checking status…'
                    : activeStatus.delegated
                      ? `Authorized · ${POLICY_OPTIONS.find((o) => o.key === activeKey)?.label ?? 'Default'}`
                      : 'Not authorized'}
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="border-b border-navy/10 text-left text-xs uppercase tracking-wider text-heroslate">
                      <th className="p-4 font-bold">Capability</th>
                      {POLICY_OPTIONS.map((o) => (
                        <th key={o.key} className="p-4 font-bold">
                          {o.label}
                          <span className="block text-[11px] font-semibold normal-case text-heroslate">
                            {o.blurb}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-navy/5">
                    {ROWS.map((row) => (
                      <tr key={row.label}>
                        <td className="p-4 font-semibold">{row.label}</td>
                        {row.values.map((v, i) => (
                          <td
                            key={i}
                            className={`p-4 ${v.startsWith('✕') ? 'font-bold text-red-500' : v.startsWith('≤') ? 'font-bold' : 'text-heroslate'}`}
                          >
                            {v}
                          </td>
                        ))}
                      </tr>
                    ))}
                    <tr>
                      <td className="p-4"></td>
                      {POLICY_OPTIONS.map((o) => {
                        const isCurrent = activeStatus?.delegated && activeKey === o.key;
                        return (
                          <td key={o.key} className="p-4">
                            {isCurrent ? (
                              <span className="inline-block rounded-full bg-emerald-100 px-4 py-2 text-xs font-bold text-emerald-700">
                                Current policy
                              </span>
                            ) : (
                              <button
                                onClick={() =>
                                  activeStatus?.delegated
                                    ? switchPolicy(activeAddress, o.key)
                                    : authorize(activeAddress, o.key)
                                }
                                disabled={busy === activeAddress}
                                className="rounded-full bg-cta px-4 py-2 text-xs font-bold text-white hover:bg-ctahover transition-colors disabled:opacity-50"
                              >
                                {busy === activeAddress
                                  ? 'Working…'
                                  : activeStatus?.delegated
                                    ? `Switch to ${o.label}`
                                    : `Authorize · ${o.label}`}
                              </button>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  </tbody>
                </table>
              </div>
              {activeStatus?.delegated && (
                <div className="border-t border-navy/10 p-4 text-center">
                  <button
                    onClick={() => revoke(activeAddress)}
                    disabled={busy === activeAddress}
                    className="text-xs font-bold text-heroslate underline hover:text-navy disabled:opacity-50"
                  >
                    Revoke Wayfind access
                  </button>
                </div>
              )}
            </div>
          )}
          <p className="text-center text-xs text-heroslate">
            To switch policy, use Switch — it revokes and re-authorizes in one step.
          </p>
        </>
      )}
    </section>
  );
}
