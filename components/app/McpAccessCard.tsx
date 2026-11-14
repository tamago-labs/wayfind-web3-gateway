'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useWallets as useSolanaWallets } from '@privy-io/react-auth/solana';
import type { Schema } from '@/amplify/data/resource';

const dataClient = generateClient<Schema>();

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function randomServerId(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function baseUrl(): string {
  // Same-origin first: /mcp/* rewrites (next.config.js) proxy to the Lambda
  // endpoint, so URLs stay short (https://web3.wayfind.click/mcp/...).
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin.replace(/\/$/, '');
  }
  try {
    const custom = (Amplify.getConfig() as unknown as { custom?: { wayfindApi?: { functionUrl?: string } } }).custom;
    if (custom?.wayfindApi?.functionUrl) return custom.wayfindApi.functionUrl.replace(/\/$/, '');
  } catch {
    // Config not ready yet — fall through to env.
  }
  return (process.env.NEXT_PUBLIC_MCP_BASE_URL ?? '').replace(/\/$/, '');
}

function storageKey(walletId: string): string {
  return `wayfind-mcp-url:${walletId}`;
}

/** Older issues may have stored a relative /mcp/... URL (empty base) — prefix origin. */
function toAbsolute(url: string): string {
  if (!url.startsWith('/')) return url;
  const base = baseUrl();
  return base ? `${base}${url}` : url;
}

function serverIdFromUrl(url: string): string | null {
  const m = /\/mcp\/([^/]+)\/message\/?$/.exec(url);
  return m ? m[1] : null;
}

export function maskUrl(url: string): string {
  // Keep the stored URL's own origin (old long Lambda URLs stay recognizable).
  const m = /^(https?:\/\/[^/]+)\/mcp\//.exec(url);
  const prefix = m ? m[1] : baseUrl() || url.slice(0, url.indexOf('/mcp/'));
  return `${prefix}/mcp/****************/message`;
}

export function mcpJsonSnippet(url: string): string {
  return JSON.stringify(
    {
      mcpServers: {
        WayfindMCP: {
          command: 'npx',
          args: ['mcp-remote', url, '--transport', 'http-only'],
        },
      },
    },
    null,
    8,
  );
}

export default function McpAccessCard({ onUrl }: { onUrl?: (url: string | null) => void }) {
  const { user } = usePrivy();
  const { wallets } = useSolanaWallets();
  const { wallets: evmWallets } = useWallets();
  const [record, setRecord] = useState<{ serverIdHash: string; updatedAt: string } | null>(null);
  // Full URL, only ever known on the device that issued it (server stores the hash).
  const [storedUrl, setStoredUrl] = useState<string | null>(null);
  const [checkedStorage, setCheckedStorage] = useState(false);
  const [revealedUrl, setRevealedUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  // Privy wallet id + address for the first embedded Solana wallet.
  // The id is never displayed; the address is stored so wallet tools work server-side.
  const wallet = useMemo(() => {
    const accounts = (user?.linkedAccounts ?? []) as Array<{
      type: string;
      address?: string;
      id?: string;
      walletClientType?: string;
    }>;
    const embeddedIds = new Set(
      accounts
        .filter((a) => a.type === 'wallet' && a.walletClientType === 'privy' && a.id)
        .map((a) => a.id as string),
    );
    const first = wallets.find((w) => w.address);
    if (!first) return null;
    const match = accounts.find(
      (a) => a.address === first.address && embeddedIds.has(a.id as string),
    );
    if (!match?.id) return null;
    return { id: match.id as string, address: first.address as string };
  }, [user, wallets]);
  const walletId = wallet?.id ?? null;

  // Embedded EVM (Mezo) wallet for the same owner. Null while still creating —
  // issuance stamps null and mezo_* tools refuse until a regenerate restamps.
  const evmWallet = useMemo(() => {
    const accounts = (user?.linkedAccounts ?? []) as Array<{
      type: string;
      address?: string;
      id?: string;
      walletClientType?: string;
    }>;
    const embeddedIds = new Set(
      accounts
        .filter((a) => a.type === 'wallet' && a.walletClientType === 'privy' && a.id)
        .map((a) => a.id as string),
    );
    const first = evmWallets.find(
      (w) => w.address && typeof w.address === 'string' && (w.address as string).startsWith('0x'),
    );
    if (!first) return null;
    const match = accounts.find(
      (a) => a.address === first.address && embeddedIds.has(a.id as string),
    );
    if (!match?.id) return null;
    return { id: match.id as string, address: first.address as string };
  }, [user, evmWallets]);

  const refresh = useCallback(async () => {
    if (!walletId) return;
    try {
      const res = await dataClient.models.McpToolConfig.list({
        filter: { walletId: { eq: walletId } },
      });
      const first = res.data[0];
      setRecord(first ? { serverIdHash: first.serverIdHash, updatedAt: first.updatedAt } : null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load MCP access.');
    }
  }, [walletId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Reconcile browser storage with the server row: a stored URL is only valid
  // if its id still hashes to the live row (regenerating elsewhere kills it).
  useEffect(() => {
    if (!walletId) return;
    setCheckedStorage(false);
    setStoredUrl(null);
    let cancelled = false;
    (async () => {
      try {
          const raw = localStorage.getItem(storageKey(walletId));
          const absolute = raw ? toAbsolute(raw) : null;
          const id = absolute ? serverIdFromUrl(absolute) : null;
          if (absolute && id) {
            // Persist the upgrade so every copy carries the base URL.
            if (absolute !== raw) {
              try {
                localStorage.setItem(storageKey(walletId), absolute);
              } catch {
                // Ignore storage errors on upgrade.
              }
            }
          const res = await dataClient.models.McpToolConfig.list({
            filter: { walletId: { eq: walletId } },
          });
          const row = res.data[0];
          if (!cancelled && row && (await sha256Hex(id)) === row.serverIdHash) {
            setStoredUrl(absolute);
          } else if (!cancelled) {
            localStorage.removeItem(storageKey(walletId));
          }
          }
      } catch {
        // Storage unavailable — fall back to no-URL states.
      } finally {
        if (!cancelled) setCheckedStorage(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [walletId]);

  // Effective URL for the tabs: the revealed one wins, then the stored one.
  const liveUrl = revealedUrl ?? storedUrl;
  useEffect(() => {
    onUrl?.(liveUrl);
  }, [liveUrl, onUrl]);

  const copy = useCallback((text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  }, []);

  const issue = useCallback(
    async (previousHash: string | null) => {
      if (!wallet?.id || !wallet?.address) return;
      setBusy(true);
      setError(null);
      setRevealedUrl(null);
      try {
        // Wallet tools read the UserProfile network server-side can't join,
        // so stamp address + network at issuance (same scope the Logs page uses).
        let network: 'mainnet' | 'testnet' = 'testnet';
        if (user?.id) {
          try {
            const { data } = await dataClient.models.UserProfile.list({
              filter: { ownerId: { eq: user.id } },
            });
            const row = (data ?? []).find((r) => r.ownerId === user.id) ?? null;
            if (row?.network === 'mainnet' || row?.network === 'testnet') {
              network = row.network;
            }
          } catch {
            // Fall through on devnet scope.
          }
        }
        const serverId = randomServerId();
        const serverIdHash = await sha256Hex(serverId);
        await dataClient.models.McpToolConfig.create({
          serverIdHash,
          walletId: wallet.id,
          walletAddress: wallet.address,
          network,
          evmWalletId: evmWallet?.id ?? null,
          evmWalletAddress: evmWallet?.address ?? null,
          enabledTools: [],
        });
        if (previousHash) {
          await dataClient.models.McpToolConfig.delete({ serverIdHash: previousHash });
        }
        const base = baseUrl();
        const url = toAbsolute(base ? `${base}/mcp/${serverId}/message` : `/mcp/${serverId}/message`);
        try {
          localStorage.setItem(storageKey(wallet.id), url);
        } catch {
          // Private mode — reveal-once still works for this session.
        }
        setStoredUrl(url);
        setRevealedUrl(url);
        await refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not issue MCP access.');
      } finally {
        setBusy(false);
      }
    },
    [wallet, evmWallet, user?.id, refresh],
  );

  const revoke = useCallback(async () => {
    if (!record) return;
    setBusy(true);
    setError(null);
    try {
      await dataClient.models.McpToolConfig.delete({ serverIdHash: record.serverIdHash });
      if (walletId) {
        try {
          localStorage.removeItem(storageKey(walletId));
        } catch {
          // Ignore storage errors on revoke.
        }
      }
      setRecord(null);
      setStoredUrl(null);
      setRevealedUrl(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not revoke MCP access.');
    } finally {
      setBusy(false);
    }
  }, [record, walletId]);

  if (!walletId) return null;

  const hasRow = !!record;
  const canShowUrl = !!storedUrl;

  return (
    <div className="rounded-3xl border border-navy/10 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-heroslate">
            Server URL
          </p>
          <p className="mt-2 text-lg font-bold">The URL to connect this Wayfind MCP server</p>
        </div>
        {hasRow && (
          <div className="flex shrink-0 gap-2">
            <button
              onClick={() => issue(record.serverIdHash)}
              disabled={busy}
              className="rounded-full border border-navy/20 px-4 py-2 text-sm font-bold text-navy hover:bg-navy/5 disabled:opacity-50"
            >
              {busy ? 'Working…' : 'Regenerate'}
            </button>
            <button
              onClick={revoke}
              disabled={busy}
              className="rounded-full border border-red-200 px-4 py-2 text-sm font-bold text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              Revoke
            </button>
          </div>
        )}
      </div>

      {!hasRow ? (
        <>
          <p className="mt-2 text-sm text-heroslate">
            One URL per bot setup. Paste it into your MCP client — the URL itself is the key,
            regenerate it anytime if it leaks.
          </p>
          <button
            onClick={() => issue(null)}
            disabled={busy}
            className="mt-4 rounded-full bg-navy px-5 py-2.5 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50"
          >
            {busy ? 'Issuing…' : 'Generate MCP URL'}
          </button>
        </>
      ) : revealedUrl ? (
        <div className="mt-4 rounded-2xl bg-navy p-4 text-sm text-white">
          <p className="text-xs font-bold uppercase tracking-wider text-white/60">
            New URL ready — copy it where you need it
          </p>
          <p className="mt-2 break-all font-mono text-[13px]">{revealedUrl}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={() => copy(revealedUrl, 'url')}
              className="rounded-full bg-white px-4 py-1.5 text-[13px] font-bold text-navy hover:opacity-90"
            >
              {copied === 'url' ? 'Copied!' : 'Copy URL'}
            </button>
            <button
              onClick={() => copy(mcpJsonSnippet(revealedUrl), 'json')}
              className="rounded-full border border-white/30 px-4 py-1.5 text-[13px] font-bold text-white hover:bg-white/10"
            >
              {copied === 'json' ? 'Copied!' : 'Copy JSON config'}
            </button>
            <button
              onClick={() => setRevealedUrl(null)}
              className="rounded-full px-4 py-1.5 text-[13px] font-bold text-white/70 hover:text-white"
            >
              I&apos;ve saved it
            </button>
          </div>
        </div>
      ) : !checkedStorage ? (
        <div className="mt-4 animate-pulse rounded-2xl bg-navy/5 p-4 text-sm text-heroslate">
          Loading…
        </div>
      ) : canShowUrl && storedUrl ? (
        <>
          <div className="mt-4 flex items-center gap-2 rounded-2xl border border-navy/15 bg-ice p-3">
            <p className="min-w-0 flex-1 truncate font-mono text-[13px] text-navy">
              {maskUrl(storedUrl)}
            </p>
            <button
              onClick={() => copy(storedUrl, 'masked')}
              className="shrink-0 rounded-full bg-navy px-4 py-1.5 text-[13px] font-bold text-white hover:opacity-90"
            >
              {copied === 'masked' ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </>
      ) : (
        <div className="mt-4 rounded-2xl border border-dashed border-navy/20 p-4 text-sm text-heroslate">
          <p className="font-bold text-navy">URL issued on another browser</p>
          <p className="mt-1">
            Regenerate above for a fresh one (old integrations stop working), or revoke it.
          </p>
        </div>
      )}

      {error && <p className="mt-3 text-sm font-medium text-red-600">{error}</p>}
    </div>
  );
}
