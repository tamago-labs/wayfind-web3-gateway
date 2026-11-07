'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { usePrivy } from '@privy-io/react-auth';
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
  try {
    const custom = (Amplify.getConfig() as unknown as { custom?: { wayfindApi?: { functionUrl?: string } } }).custom;
    if (custom?.wayfindApi?.functionUrl) return custom.wayfindApi.functionUrl.replace(/\/$/, '');
  } catch {
    // Config not ready yet — fall through to env.
  }
  return (process.env.NEXT_PUBLIC_MCP_BASE_URL ?? '').replace(/\/$/, '');
}

export default function McpAccessCard() {
  const { user } = usePrivy();
  const { wallets } = useSolanaWallets();
  const [record, setRecord] = useState<{ serverIdHash: string; updatedAt: string } | null>(null);
  const [freshUrl, setFreshUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Privy wallet id for the first embedded Solana wallet (never displayed).
  const walletId = useMemo(() => {
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
    return (match?.id as string | undefined) ?? null;
  }, [user, wallets]);

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

  const issue = useCallback(
    async (previousHash: string | null) => {
      if (!walletId) return;
      setBusy(true);
      setError(null);
      setFreshUrl(null);
      try {
        const serverId = randomServerId();
        const serverIdHash = await sha256Hex(serverId);
        await dataClient.models.McpToolConfig.create({
          serverIdHash,
          walletId,
          enabledTools: [],
        });
        if (previousHash) {
          await dataClient.models.McpToolConfig.delete({ serverIdHash: previousHash });
        }
        const base = baseUrl();
        setFreshUrl(
          base ? `${base}/mcp/${serverId}/message` : `/mcp/${serverId}/message`,
        );
        await refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not issue MCP access.');
      } finally {
        setBusy(false);
      }
    },
    [walletId, refresh],
  );

  const revoke = useCallback(async () => {
    if (!record) return;
    setBusy(true);
    setError(null);
    try {
      await dataClient.models.McpToolConfig.delete({ serverIdHash: record.serverIdHash });
      setRecord(null);
      setFreshUrl(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not revoke MCP access.');
    } finally {
      setBusy(false);
    }
  }, [record]);

  if (!walletId) return null;

  return (
    <div className="rounded-3xl border border-navy/10 bg-white p-6 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wider text-heroslate">
        Remote MCP access
      </p>
      <p className="mt-2 text-lg font-bold">One URL per bot setup</p>
      <p className="mt-2 text-sm text-heroslate">
        Paste it into your MCP client with mcp-remote. The URL itself is the key —
        regenerate it anytime if it leaks.
      </p>

      {freshUrl && (
        <div className="mt-4 rounded-2xl bg-navy p-4 text-sm text-white">
          <p className="text-xs font-bold uppercase tracking-wider text-white/60">
            Save this now — shown once
          </p>
          <p className="mt-2 break-all font-mono text-[13px]">{freshUrl}</p>
          <button
            onClick={() => {
              navigator.clipboard.writeText(
                `{"mcpServers":{"WayfindMCP":{"command":"npx","args":["mcp-remote","${freshUrl}","--transport","http-only"]}}}`,
              );
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className="mt-3 rounded-full bg-white px-4 py-1.5 text-[13px] font-bold text-navy hover:opacity-90"
          >
            {copied ? 'Copied!' : 'Copy mcp-remote config'}
          </button>
        </div>
      )}

      {error && <p className="mt-3 text-sm font-medium text-red-600">{error}</p>}

      <div className="mt-4 flex flex-wrap gap-2">
        {!record ? (
          <button
            onClick={() => issue(null)}
            disabled={busy}
            className="rounded-full bg-navy px-5 py-2.5 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50"
          >
            {busy ? 'Issuing…' : 'Generate MCP URL'}
          </button>
        ) : (
          <>
            <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
              Active
            </span>
            <button
              onClick={() => issue(record.serverIdHash)}
              disabled={busy}
              className="rounded-full border border-navy/20 px-5 py-2.5 text-sm font-bold text-navy hover:bg-navy/5 disabled:opacity-50"
            >
              {busy ? 'Working…' : 'Regenerate'}
            </button>
            <button
              onClick={revoke}
              disabled={busy}
              className="rounded-full border border-red-200 px-5 py-2.5 text-sm font-bold text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              Revoke
            </button>
          </>
        )}
      </div>
    </div>
  );
}
