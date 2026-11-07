'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { generateClient } from 'aws-amplify/data';
import { usePrivy } from '@privy-io/react-auth';
import type { Schema } from '@/amplify/data/resource';

const dataClient = generateClient<Schema>();

// Frontend mirror of the backend registry (mcp/registry.ts + categories/).
// Names must match; the backend stays the source of truth for execution.
const CATALOG: {
  id: string;
  label: string;
  tools: { name: string; description: string }[];
  comingSoon?: boolean;
}[] = [
  {
    id: 'wallet',
    label: 'Wallet operations',
    tools: [
      { name: 'get_balances', description: 'Read SOL plus every token balance, including stocks.' },
      { name: 'get_history', description: 'Read the latest transactions, newest first.' },
      { name: 'get_transaction', description: 'Look up one transaction by signature.' },
      { name: 'get_wallet_address', description: 'Show the attached wallet address and network.' },
      { name: 'send_tokens', description: 'Send SOL or SPL tokens by symbol. Policy-enforced.' },
    ],
  },
  { id: 'stocks', label: 'Tokenized stocks', tools: [], comingSoon: true },
  { id: 'payments', label: 'Circle payments', tools: [], comingSoon: true },
  {
    id: 'okx',
    label: 'OKX DEX Swap',
    tools: [
      { name: 'okx_get_quote', description: 'Read-only swap quote (Solana mainnet).' },
      { name: 'okx_swap_tokens', description: 'Swap via OKX DEX. Mainnet only, policy-enforced.' },
    ],
  },
  {
    id: 'usdc',
    label: 'USDC finance',
    tools: [
      { name: 'usdc_unified_balance', description: 'Total USDC + per-chain breakdown. Read-only.' },
      { name: 'usdc_chains', description: 'Valid destination chains for the current network. Read-only.' },
      { name: 'usdc_deposit', description: 'Deposit USDC into unified balance. Policy-enforced.' },
      { name: 'usdc_spend', description: 'Spend USDC, optionally cross-chain. Policy-enforced.' },
    ],
  },
];

interface Config {
  serverIdHash: string;
  walletId: string;
  walletAddress?: string | null;
  network?: string | null;
  enabledTools: string[];
  updatedAt: string;
}

export default function ToolsConsole() {
  const { user } = usePrivy();
  const [configs, setConfigs] = useState<Config[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Serialize saves per URL: rapid toggles chain instead of racing on a
  // stale enabledTools snapshot (the dropped-toggle bug). configsRef always
  // holds the latest list for recomputing inside the chain.
  const pending = useRef<Record<string, Promise<void>>>({});
  const configsRef = useRef<Config[]>([]);
  configsRef.current = configs;

  const embeddedIds = useMemo(() => {
    const accounts = (user?.linkedAccounts ?? []) as Array<{
      type: string;
      id?: string;
      walletClientType?: string;
    }>;
    return new Set(
      accounts
        .filter((a) => a.type === 'wallet' && a.walletClientType === 'privy' && a.id)
        .map((a) => a.id as string),
    );
  }, [user]);

  const refresh = useCallback(async () => {
    try {
      const res = await dataClient.models.McpToolConfig.list({ limit: 100 });
      setConfigs(
        (res.data ?? [])
          .filter((r) => embeddedIds.has(r.walletId))
          .map((r) => ({
          serverIdHash: r.serverIdHash,
          walletId: r.walletId,
          walletAddress: r.walletAddress,
          network: r.network,
          enabledTools: (r.enabledTools ?? []).filter(
            (t): t is string => typeof t === 'string',
          ),
          updatedAt: r.updatedAt,
        })),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load tool settings.');
    } finally {
      setLoaded(true);
    }
  }, [embeddedIds]);

  useEffect(() => {
    if (embeddedIds.size > 0) void refresh();
    else setLoaded(true);
  }, [refresh, embeddedIds]);

  const toggle = useCallback(async (serverIdHash: string, tool: string, on: boolean) => {
    const key = `${serverIdHash}:${tool}`;
    setBusy(key);
    setError(null);
    try {
      // Wait for any in-flight save on this URL, then recompute from the
      // latest snapshot — never from a stale closure.
      await (pending.current[serverIdHash] ?? Promise.resolve());
      const run = (async () => {
        const current = configsRef.current.find((c) => c.serverIdHash === serverIdHash);
        const next = on
          ? Array.from(new Set([...(current?.enabledTools ?? []), tool]))
          : (current?.enabledTools ?? []).filter((t) => t !== tool);
        const updated = await dataClient.models.McpToolConfig.update({
          serverIdHash,
          enabledTools: next,
        });
        setConfigs((cs) =>
          cs.map((c) =>
            c.serverIdHash === serverIdHash
              ? { ...c, enabledTools: next, updatedAt: updated.data?.updatedAt ?? c.updatedAt }
              : c,
          ),
        );
      })();
      pending.current[serverIdHash] = run.catch(() => {});
      await run;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save tool settings.');
    } finally {
      setBusy((b) => (b === key ? null : b));
    }
  }, []);

  if (!loaded) return <p className="mt-6 text-sm text-heroslate">Loading tools…</p>;

  if (configs.length === 0) {
    return (
      <div className="mt-6 rounded-3xl border border-dashed border-navy/20 p-6 text-sm text-heroslate">
        <p className="font-bold text-navy">No MCP URL yet</p>
        <p className="mt-2">
          Generate one in{' '}
          <Link href="/app/connect" className="font-semibold text-cta hover:underline">
            Connect
          </Link>{' '}
          first — new URLs start with no tools enabled. Switch them on here, one by one.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-3">
      {error && <p className="text-sm font-medium text-red-600">{error}</p>}
      {configs.map((c) => (
        <div
          key={c.serverIdHash}
          className="rounded-3xl border border-navy/10 bg-white p-5 shadow-sm"
        >
          <div className="flex items-center gap-2 text-sm">
            <p className="font-mono font-semibold" title={c.walletAddress ?? c.walletId}>
              {(c.walletAddress ?? c.walletId).slice(0, 8)}…
            </p>
            <span className="ml-auto shrink-0 font-mono text-[11px] text-heroslate" title={c.serverIdHash}>
              URL ·{c.serverIdHash.slice(0, 6)} · {new Date(c.updatedAt).toLocaleString()}
            </span>
          </div>
          <div className="mt-4 space-y-4">
            {CATALOG.map((cat) => (
              <div key={cat.id}>
                <p className="text-xs font-bold uppercase tracking-wider text-heroslate">
                  {cat.label}
                  {cat.comingSoon && <span className="ml-2">· coming soon</span>}
                </p>
                {cat.tools.length > 0 && (
                  <ul className="mt-2 space-y-2">
                    {cat.tools.map((t) => {
                      const on = c.enabledTools.includes(t.name);
                      const key = `${c.serverIdHash}:${t.name}`;
                      return (
                        <li key={t.name} className="flex items-center gap-3 text-sm">
                          <button
                            role="switch"
                            aria-checked={on}
                            disabled={busy === key}
                            onClick={() => toggle(c.serverIdHash, t.name, !on)}
                            className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                              on ? 'bg-cta' : 'bg-navy/15'
                            } cursor-pointer`}
                          >
                            <span
                              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                                on ? 'left-[22px]' : 'left-0.5'
                              }`}
                            />
                          </button>
                          <div className="min-w-0">
                            <p className="font-mono font-semibold">{t.name}</p>
                            <p className="truncate text-xs text-heroslate">{t.description}</p>
                          </div>
                          {busy === key && (
                            <span className="ml-auto text-xs text-heroslate">Saving…</span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
