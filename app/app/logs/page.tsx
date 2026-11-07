'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Connection, PublicKey } from '@solana/web3.js';
import { useWallets } from '@privy-io/react-auth';
import { useWallets as useSolanaWallets } from '@privy-io/react-auth/solana';

const DEVNET_RPC =
  process.env.NEXT_PUBLIC_SOLANA_DEVNET_RPC ?? 'https://api.devnet.solana.com';
const MAINNET_RPC =
  process.env.NEXT_PUBLIC_SOLANA_MAINNET_RPC ?? 'https://api.mainnet-beta.solana.com';

interface Entry {
  signature: string;
  address: string;
  network: 'mainnet' | 'testnet';
  time: number | null;
  failed: boolean;
  deltaSol: number | null;
  counterparty: string | null;
  direction: 'in' | 'out' | null;
  kind: 'sol' | 'token' | 'program' | null;
}

function short(value: string): string {
  return value.length > 12 ? `${value.slice(0, 6)}…${value.slice(-4)}` : value;
}

interface CompiledIx {
  programIdIndex?: number;
  accounts?: number[];
  data?: string;
}

const SYSTEM_PROGRAM_ID = '11111111111111111111111111111111';

const B58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function base58ToBytes(s: string): Uint8Array | null {
  try {
    // No BigInt literals: the frontend targets es5 (literals need ES2020+).
    let num = BigInt(0);
    for (const ch of s) {
      const i = B58_ALPHABET.indexOf(ch);
      if (i < 0) return null;
      num = num * BigInt(58) + BigInt(i);
    }
    const bytes: number[] = [];
    while (num > BigInt(0)) {
      bytes.unshift(Number(num & BigInt(255)));
      num >>= BigInt(8);
    }
    let zeros = 0;
    for (const ch of s) {
      if (ch === '1') zeros++;
      else break;
    }
    return new Uint8Array([...new Array(zeros).fill(0), ...bytes]);
  } catch {
    return null;
  }
}

function resolveProgramId(
  table: unknown,
  index: number | undefined,
): string | null {
  // Map values are PublicKey objects at runtime — coerce to base58 strings.
  if (index == null) return null;
  try {
    if (table instanceof Map) {
      const v = table.get(index) as unknown;
      return v == null ? null : String(v);
    }
    if (Array.isArray(table)) {
      const v = table[index] as unknown;
      return v == null ? null : String(v);
    }
    if (table && typeof table === 'object') {
      const v = (table as Record<string, unknown>)[String(index)];
      return v == null ? null : String(v);
    }
  } catch {
    return null;
  }
  return null;
}
const TOKEN_PROGRAM_IDS = new Set([
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
  'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb',
]);

function explorerUrl(e: Pick<Entry, 'signature' | 'network'>): string {
  return e.network === 'mainnet'
    ? `https://explorer.solana.com/tx/${e.signature}`
    : `https://explorer.solana.com/tx/${e.signature}?cluster=devnet`;
}

async function fetchScope(
  connection: Connection,
  address: string,
  network: 'mainnet' | 'testnet',
): Promise<Entry[]> {
  // web3.js v3 serves bigints (blockTime, balances) and parsed accountKeys
  // are plain address strings — normalize both before comparing.
  let sigs: { signature: string; blockTime?: bigint | number | null; err?: unknown }[] = [];
  try {
    sigs = await connection.getSignaturesForAddress(new PublicKey(address), { limit: 10 });
  } catch {
    return [];
  }
  return Promise.all(
    sigs.map(async (s) => {
      const base: Entry = {
        signature: s.signature,
        address,
        network,
        time: s.blockTime == null ? null : Number(s.blockTime),
        failed: !!s.err,
        deltaSol: null,
        counterparty: null,
        direction: null,
        kind: null,
      };
      try {
        // v3's GetTransactionConfig omits `encoding` (RPC defaults to json).
        // Cast keeps the exact runtime request while satisfying tsc.
        const tx = await connection.getTransaction(s.signature, {
          encoding: 'jsonParsed',
          maxSupportedTransactionVersion: 0,
        } as unknown as { maxSupportedTransactionVersion?: number });
        const message = tx?.transaction.message as unknown as {
          accountKeys?: unknown;
          instructions?: CompiledIx[];
          indexToProgramIds?: unknown;
        };
        const rawKeys = message?.accountKeys;
        // accountKeys arrive as strings, { pubkey } objects, or PublicKey
        // instances depending on the call path — coerce all three.
        const keyToString = (k: unknown): string | null => {
          if (typeof k === 'string') return k;
          if (k && typeof k === 'object') {
            const o = k as { pubkey?: unknown; toBase58?: unknown };
            if (typeof o.pubkey === 'string') return o.pubkey;
            if (typeof o.toBase58 === 'function')
              return (o.toBase58 as () => string)();
          }
          return null;
        };
        const at = (i: number | undefined): string | null => {
          if (i == null || !Array.isArray(rawKeys)) return null;
          return keyToString(rawKeys[i] as unknown);
        };
        const idx = Array.isArray(rawKeys)
          ? rawKeys.findIndex((k) => keyToString(k) === address)
          : -1;
        const meta = tx?.meta as unknown as {
          preBalances?: (bigint | number)[] | null;
          postBalances?: (bigint | number)[] | null;
        } | null;
        if (meta?.preBalances && meta?.postBalances && idx >= 0) {
          const pre = meta.preBalances[idx];
          const post = meta.postBalances[idx];
          base.deltaSol =
            (typeof pre === 'bigint' && typeof post === 'bigint'
              ? Number(post - pre)
              : Number(post) - Number(pre)) / 1_000_000_000;
        }
        const ixs = message?.instructions ?? [];
        let matched = false;
        for (const ix of ixs) {
          const programId = resolveProgramId(message?.indexToProgramIds, ix.programIdIndex);
          if (!programId) continue;
          // Native SOL transfer: instruction 2 + u64 lamports; exact amount,
          // no fee noise unlike the balance delta.
          if (programId === SYSTEM_PROGRAM_ID && (ix.accounts ?? []).length >= 2) {
            const bytes = ix.data ? base58ToBytes(ix.data) : null;
            if (bytes && bytes.length >= 12) {
              const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
              if (view.getUint32(0, true) === 2) {
                const lamports = Number(view.getBigUint64(4, true)) / 1_000_000_000;
                const source = at(ix.accounts?.[0]);
                const destination = at(ix.accounts?.[1]);
                if (source && destination) {
                  base.kind = 'sol';
                  base.direction = source === address ? 'out' : 'in';
                  base.counterparty = source === address ? destination : source;
                  base.deltaSol = base.direction === 'out' ? -lamports : lamports;
                  matched = true;
                  break;
                }
              }
            }
          }
          // SPL token move: token accounts aren't wallets, so no counterparty
          // and no SOL-direction inference — just an honest label.
          if (TOKEN_PROGRAM_IDS.has(programId)) {
            base.kind = 'token';
            matched = true;
            break;
          }
        }
        if (!matched) {
          if (ixs.length > 0) {
            base.kind = 'program';
          }
          // SOL-native direction fallback when no transfer was decoded.
          if (!base.direction && base.deltaSol != null && base.deltaSol !== 0) {
            base.direction = base.deltaSol > 0 ? 'in' : 'out';
          }
        }
      } catch {
        // Keep the row with signature-level data only.
      }
      return base;
    }),
  );
}

const TIME_OPTIONS = [
  { value: '', label: 'All time' },
  { value: '60', label: 'Last 1 hour' },
  { value: '180', label: 'Last 3 hours' },
  { value: '720', label: 'Last 12 hours' },
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: '10080', label: 'Last 7 days' },
  { value: 'custom', label: 'Custom range…' },
];

export default function LogsPage() {
  const { wallets } = useWallets();
  const { wallets: solanaHookWallets } = useSolanaWallets();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [direction, setDirection] = useState('');
  const [network, setNetwork] = useState('');
  const [range, setRange] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const solanaWallets = useMemo(() => {
    const fromHook = solanaHookWallets.filter((w) => w.address);
    if (fromHook.length > 0) return fromHook.map((w) => ({ address: w.address as string }));
    return wallets.filter((w) => w.address).map((w) => ({ address: w.address as string }));
  }, [wallets, solanaHookWallets]);

  const refresh = useCallback(async () => {
    // Reset every fetch (mount + wallet arrival) so the skeleton shows for
    // the real load, not just the initial empty-wallets pass.
    setLoaded(false);
    // Hold the skeleton a beat even on fast loads so it reads as intentional.
    const started = Date.now();
    const scopes = [
      { rpc: DEVNET_RPC, network: 'testnet' as const },
      { rpc: MAINNET_RPC, network: 'mainnet' as const },
    ];
    const lists = await Promise.all(
      scopes.flatMap(({ rpc, network }) => {
        const connection = new Connection(rpc, 'confirmed');
        return solanaWallets.map((w) => fetchScope(connection, w.address, network));
      }),
    );
    setEntries(
      lists
        .flat()
        .sort((a, b) => (b.time ?? 0) - (a.time ?? 0)),
    );
    const elapsed = Date.now() - started;
    if (elapsed < 600) await new Promise((r) => setTimeout(r, 600 - elapsed));
    setLoaded(true);
  }, [solanaWallets]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filtered = useMemo(() => {
    const now = Date.now();
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const todayStart = dayStart.getTime();
    const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;
    const q = query.trim().toLowerCase();
    return entries.filter((e) => {
      if (q) {
        const hay = `${e.signature} ${e.address} ${e.counterparty ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (status === 'confirmed' && e.failed) return false;
      if (status === 'failed' && !e.failed) return false;
      const dir = e.direction ?? (e.deltaSol != null && e.deltaSol !== 0
        ? e.deltaSol > 0
          ? 'in'
          : 'out'
        : null);
      if (direction === 'in' && dir !== 'in') return false;
      if (direction === 'out' && dir !== 'out') return false;
      if (network && e.network !== network) return false;
      if (range === 'today' && !(e.time != null && e.time * 1000 >= todayStart)) return false;
      if (range === 'yesterday' && !(e.time != null && e.time * 1000 >= yesterdayStart && e.time * 1000 < todayStart))
        return false;
      if (range === 'custom') {
        if (!from || !to) return true;
        if (e.time == null) return false;
        const ts = e.time * 1000;
        if (ts < new Date(from).getTime() || ts > new Date(to).getTime()) return false;
      } else if (range && e.time != null) {
        if (now - e.time * 1000 > parseFloat(range) * 60 * 1000) return false;
      } else if (range && e.time == null) {
        return false;
      }
      return true;
    });
  }, [entries, query, status, direction, network, range, from, to]);

  const selectClass =
    'cursor-pointer rounded-full bg-ice px-3 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-cta/30';

  return (
    <section className="mx-auto max-w-5xl pt-2">
      <div className="rounded-3xl border border-navy/10 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search signature or address…"
            className="min-w-[180px] flex-1 rounded-full bg-ice px-4 py-2 text-sm outline-none placeholder:text-heroslate/70 focus:ring-2 focus:ring-cta/30"
          />
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={selectClass} aria-label="Status">
            <option value="">All statuses</option>
            <option value="confirmed">Confirmed</option>
            <option value="failed">Failed</option>
          </select>
          <select value={direction} onChange={(e) => setDirection(e.target.value)} className={selectClass} aria-label="Direction">
            <option value="">In + Out</option>
            <option value="in">In</option>
            <option value="out">Out</option>
          </select>
          <select value={network} onChange={(e) => setNetwork(e.target.value)} className={selectClass} aria-label="Network">
            <option value="">All networks</option>
            <option value="testnet">Devnet</option>
            <option value="mainnet">Mainnet</option>
          </select>
          <select value={range} onChange={(e) => setRange(e.target.value)} className="cursor-pointer rounded-full bg-navy px-3 py-2 text-sm font-semibold text-white outline-none" aria-label="Time range">
            {TIME_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        {range === 'custom' && (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            <input
              type="datetime-local"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="rounded-full bg-ice px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cta/30"
            />
            <span className="text-heroslate">to</span>
            <input
              type="datetime-local"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="rounded-full bg-ice px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cta/30"
            />
          </div>
        )}
        <p className="mt-2 text-xs text-heroslate">
          {loaded ? `Showing ${filtered.length} of ${entries.length}` : 'Loading activity…'}
        </p>
      </div>

      {!loaded ? (
        <div className="mt-3" aria-label="Loading">
          <p className="px-1 text-sm font-semibold text-heroslate">Loading activity…</p>
          <div className="mt-2 overflow-hidden rounded-3xl border border-navy/10">
          <div className="grid grid-cols-[1fr_auto_auto] items-center gap-3 border-b border-navy/10 bg-ice px-4 py-3 text-xs font-bold uppercase tracking-wider text-heroslate sm:grid-cols-[1fr_auto_auto_auto_auto]">
            <span>Signature</span>
            <span className="hidden text-right sm:block">Amount</span>
            <span>Status</span>
            <span className="text-right">Time</span>
          </div>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="grid animate-pulse grid-cols-[1fr_auto_auto] items-center gap-3 border-b border-navy/5 px-4 py-4 last:border-0 sm:grid-cols-[1fr_auto_auto_auto_auto]"
            >
              <div className="h-4 rounded-full bg-navy/10" />
              <div className="hidden h-4 w-20 rounded-full bg-navy/10 sm:block" />
              <div className="h-6 w-20 rounded-full bg-navy/10" />
              <div className="h-4 w-16 rounded-full bg-navy/10" />
            </div>
          ))}
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-3 rounded-3xl border border-dashed border-navy/20 p-6 text-sm text-heroslate">
          <p className="font-bold text-navy">
            {entries.length === 0 ? 'No activity yet.' : 'Nothing matches these filters.'}
          </p>
          <p className="mt-2">
            Every action your bots take through the MCP module is recorded here for
            monitoring and audit — newest first, across both networks.
          </p>
        </div>
      ) : (
        <div className="mt-3 overflow-x-auto rounded-3xl border border-navy/10 bg-white shadow-sm">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-navy/10 bg-ice text-xs uppercase tracking-wider text-heroslate">
                <th className="px-4 py-3 font-bold">Signature</th>
                <th className="px-4 py-3 font-bold">Direction</th>
                <th className="px-4 py-3 text-right font-bold">Amount</th>
                <th className="px-4 py-3 font-bold">Status</th>
                <th className="px-4 py-3 text-right font-bold">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy/5">
            {filtered.map((e) => {
              const dir =
                e.direction ??
                (e.deltaSol != null && e.deltaSol !== 0
                  ? e.deltaSol > 0
                    ? 'in'
                    : 'out'
                  : null);
              const incoming = dir === 'in';
              const outgoing = dir === 'out';
              return (
                <tr
                  key={`${e.network}:${e.signature}`}
                  onClick={() => window.open(explorerUrl(e), '_blank', 'noopener')}
                  className="cursor-pointer hover:bg-ice/60"
                >
                  <td className="px-4 py-3">
                    <a
                      href={explorerUrl(e)}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(ev) => ev.stopPropagation()}
                      className="font-mono text-[13px] font-semibold hover:underline"
                      title={e.signature}
                    >
                      {short(e.signature)}
                    </a>{' '}
                    <span
                      className={`ml-1 rounded px-1.5 py-0.5 text-[11px] ${
                        e.network === 'mainnet'
                          ? 'bg-cta/10 font-bold text-cta'
                          : 'bg-navy/5 text-heroslate'
                      }`}
                    >
                      {e.network === 'mainnet' ? 'mainnet' : 'devnet'}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {incoming ? (
                      <span className="font-bold text-emerald-600">↓ In</span>
                    ) : outgoing ? (
                      <span className="font-bold text-cta">↑ Out</span>
                    ) : (
                      <span className="font-bold text-heroslate">·</span>
                    )}{' '}
                    {e.counterparty && (
                      <span className="text-heroslate">
                        {incoming ? 'from' : 'to'} {short(e.counterparty)}
                      </span>
                    )}
                  </td>
                  <td
                    className={`whitespace-nowrap px-4 py-3 text-right font-bold ${
                      incoming ? 'text-emerald-600' : ''
                    }`}
                  >
                    {e.kind === 'sol' && e.deltaSol != null ? (
                      `${incoming ? '+' : ''}${e.deltaSol.toFixed(6)} SOL`
                    ) : e.kind === 'token' ? (
                      <span className="text-xs font-bold text-navy">Token transfer</span>
                    ) : e.kind === 'program' ? (
                      <span className="text-xs font-bold text-navy">Program interaction</span>
                    ) : (
                      '—'
                    )}
                  </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                          e.failed ? 'bg-red-50 text-red-600' : 'bg-navy/5 text-navy'
                        }`}
                      >
                        {e.failed ? 'Failed' : 'Confirmed'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-heroslate">
                      {e.time ? new Date(e.time * 1000).toLocaleString() : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
