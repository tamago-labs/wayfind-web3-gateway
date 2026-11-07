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
      if (!wallet?.id || !wallet?.address) return;
      setBusy(true);
      setError(null);
      setFreshUrl(null);
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
    [wallet, user?.id, refresh],
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
