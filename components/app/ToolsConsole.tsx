'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { generateClient } from 'aws-amplify/data';
import { usePrivy } from '@privy-io/react-auth';
import type { Schema } from '@/amplify/data/resource';
import { CATALOG, toolMeta } from './toolsCatalog';
import AddToolsModal from './AddToolsModal';

const dataClient = generateClient<Schema>();

export interface ToolConfig {
  serverIdHash: string;
  walletId: string;
  walletAddress?: string | null;
  network?: string | null;
  enabledTools: string[];
  updatedAt: string;
}

export default function ToolsConsole() {
  const { user } = usePrivy();
  const [configs, setConfigs] = useState<ToolConfig[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Race-safe saves: per-URL promise chain (no same-tick double-write),
  // a save-seq so stale background reads can't clobber fresh rows, and a
  // pending set so refresh() never overwrites rows being written.
  const chains = useRef<Record<string, Promise<void>>>({});
  const seq = useRef<Record<string, number>>({});
  const pendingSet = useRef<Set<string>>(new Set());
  const configsRef = useRef<ToolConfig[]>([]);
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

  // Stable string — Privy recreates the user object (and the Set) on token
  // refreshes; reloading on that churn is what used to wipe fresh toggles.
  const embeddedIdsKey = useMemo(() => Array.from(embeddedIds).sort().join(','), [embeddedIds]);

  const refresh = useCallback(async () => {
    try {
      const res = await dataClient.models.McpToolConfig.list({ limit: 100 });
      const ids = new Set(embeddedIdsKey ? embeddedIdsKey.split(',') : []);
      setConfigs((prev) => {
        const localByHash = new Map(prev.map((c) => [c.serverIdHash, c]));
        const next: ToolConfig[] = [];
        for (const r of res.data ?? []) {
          if (!ids.has(r.walletId)) continue;
          // A row being written right now keeps its local (newer) state.
          if (pendingSet.current.has(r.serverIdHash)) {
            const local = localByHash.get(r.serverIdHash);
            if (local) {
              next.push(local);
              continue;
            }
          }
          next.push({
            serverIdHash: r.serverIdHash,
            walletId: r.walletId,
            walletAddress: r.walletAddress,
            network: r.network,
            enabledTools: (r.enabledTools ?? []).filter(
              (t): t is string => typeof t === 'string',
            ),
            updatedAt: r.updatedAt,
          });
        }
        return next;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load tool settings.');
    } finally {
      setLoaded(true);
    }
  }, [embeddedIdsKey]);

  useEffect(() => {
    if (embeddedIdsKey) void refresh();
    else setLoaded(true);
  }, [refresh, embeddedIdsKey]);

  const saveTools = useCallback(async (serverIdHash: string, next: string[]) => {
    const n = (seq.current[serverIdHash] ?? 0) + 1;
    seq.current[serverIdHash] = n;
    pendingSet.current.add(serverIdHash);
    const prev = chains.current[serverIdHash] ?? Promise.resolve();
    const run = prev.then(async () => {
      const updated = await dataClient.models.McpToolConfig.update({
        serverIdHash,
        enabledTools: next,
      });
      if (seq.current[serverIdHash] === n) {
        setConfigs((cs) =>
          cs.map((c) =>
            c.serverIdHash === serverIdHash
              ? { ...c, enabledTools: next, updatedAt: updated.data?.updatedAt ?? c.updatedAt }
              : c,
          ),
        );
      }
    });
    chains.current[serverIdHash] = run.catch(() => {});
    try {
      await run;
    } finally {
      pendingSet.current.delete(serverIdHash);
    }
  }, []);

  const mutateTools = useCallback(
    async (serverIdHash: string, tool: string, add: boolean) => {
      const key = `${serverIdHash}:${tool}`;
      setBusyKey(key);
      setError(null);
      const before = configsRef.current.find((c) => c.serverIdHash === serverIdHash);
      const prevTools = before?.enabledTools ?? [];
      const next = add
        ? Array.from(new Set([...prevTools, tool]))
        : prevTools.filter((t) => t !== tool);
      // Optimistic UI with rollback on failure.
      setConfigs((cs) =>
        cs.map((c) => (c.serverIdHash === serverIdHash ? { ...c, enabledTools: next } : c)),
      );
      try {
        await saveTools(serverIdHash, next);
      } catch (e) {
        setConfigs((cs) =>
          cs.map((c) =>
            c.serverIdHash === serverIdHash ? { ...c, enabledTools: prevTools } : c,
          ),
        );
        setError(e instanceof Error ? e.message : 'Could not save tool settings.');
      } finally {
        setBusyKey((b) => (b === key ? null : b));
      }
    },
    [saveTools],
  );

  const addTool = useCallback(
    (serverIdHash: string, tool: string) => mutateTools(serverIdHash, tool, true),
    [mutateTools],
  );
  // Batched add: one optimistic update + one save, so rapid per-tool Adds
  // can't clobber each other off the same snapshot (last-write-wins).
  const addTools = useCallback(
    async (serverIdHash: string, tools: string[]) => {
      if (tools.length === 0) return;
      const key = `${serverIdHash}:*`;
      setBusyKey(key);
      setError(null);
      const before = configsRef.current.find((c) => c.serverIdHash === serverIdHash);
      const prevTools = before?.enabledTools ?? [];
      const next = Array.from(new Set([...prevTools, ...tools]));
      setConfigs((cs) =>
        cs.map((c) => (c.serverIdHash === serverIdHash ? { ...c, enabledTools: next } : c)),
      );
      try {
        await saveTools(serverIdHash, next);
      } catch (e) {
        setConfigs((cs) =>
          cs.map((c) =>
            c.serverIdHash === serverIdHash ? { ...c, enabledTools: prevTools } : c,
          ),
        );
        setError(e instanceof Error ? e.message : 'Could not save tool settings.');
      } finally {
        setBusyKey((b) => (b === key ? null : b));
      }
    },
    [saveTools],
  );
  const removeTool = useCallback(
    (serverIdHash: string, tool: string) => mutateTools(serverIdHash, tool, false),
    [mutateTools],
  );

  if (!loaded) return <p className="text-sm text-heroslate">Loading tools…</p>;

  if (configs.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-navy/20 p-6 text-sm text-heroslate">
        <p className="font-bold text-navy">No MCP URL yet</p>
        <p className="mt-2">
          Generate one in{' '}
          <Link href="/app/connect" className="font-semibold text-cta hover:underline">
            Connect
          </Link>{' '}
          first — new URLs start with no tools enabled. Add them here, one by one.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-end">
        <button
          onClick={() => setModalOpen(true)}
          className="rounded-full bg-navy px-5 py-2.5 text-sm font-bold text-white hover:opacity-90"
        >
          Add tools
        </button>
      </div>

      {error && <p className="mt-3 text-sm font-medium text-red-600">{error}</p>}

      <div className="mt-3 space-y-3">
        {configs.map((c) => (
          <div
            key={c.serverIdHash}
            className="rounded-3xl border border-navy/10 bg-white p-5 shadow-sm"
          >
            {configs.length > 1 && (
              <p className="text-xs font-bold uppercase tracking-wider text-heroslate">
                {(c.walletAddress ?? c.walletId).slice(0, 8)}… ·{' '}
                {c.network === 'mainnet' ? 'Mainnet' : 'Testnet'}
              </p>
            )}
            {c.enabledTools.length === 0 ? (
              <p className="mt-2 text-sm text-heroslate">
                No tools yet — press Add tools to get started.
              </p>
            ) : (
              <div className="space-y-3">
                {CATALOG.map((cat) => {
                  const names = c.enabledTools.filter(
                    (n) => toolMeta(n).categoryId === cat.id,
                  );
                  if (names.length === 0) return null;
                  return (
                    <div
                      key={cat.id}
                      className="rounded-2xl border border-navy/10 bg-ice p-4"
                    >
                      <div className="flex items-center gap-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={cat.icon}
                          alt={`${cat.label} icon`}
                          className="h-6 w-6 shrink-0 rounded-full object-cover"
                        />
                        <p className="text-xs font-bold uppercase tracking-wider text-heroslate">
                          {cat.label}
                        </p>
                      </div>
                      <ul className="mt-3 space-y-2">
                        {names.map((name) => {
                          const meta = toolMeta(name);
                          const key = `${c.serverIdHash}:${name}`;
                          return (
                            <li key={name} className="flex items-center gap-3 text-sm">
                              <div className="min-w-0 flex-1">
                                <p className="font-mono font-semibold">{name}</p>
                                {meta.description && (
                                  <p className="truncate text-xs text-heroslate">
                                    {meta.description}
                                  </p>
                                )}
                              </div>
                              <button
                                onClick={() => removeTool(c.serverIdHash, name)}
                                disabled={busyKey === key}
                                aria-label={`Remove ${name}`}
                                className="shrink-0 rounded-full border border-red-200 px-3 py-1 text-xs font-bold text-red-600 hover:bg-red-50 disabled:opacity-50"
                              >
                                {busyKey === key ? 'Removing…' : 'Remove'}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      <AddToolsModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        configs={configs}
        onAdd={addTool}
        onAddAll={addTools}
        busyKey={busyKey}
      />
    </div>
  );
}
