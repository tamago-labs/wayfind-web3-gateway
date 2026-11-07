import type { Connection } from "@solana/web3.js";

export interface DecodedTx {
  signature: string;
  status: "Confirmed" | "Failed";
  time: string | null;
  kind: "sol" | "token" | "program" | null;
  direction: "in" | "out" | null;
  amountSol: number | null;
  counterparty: string | null;
}

const SYSTEM_PROGRAM_ID = "11111111111111111111111111111111";
const TOKEN_PROGRAM_IDS = new Set([
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
  "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
]);

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

/** Base58 (OKX tx encoding) → base64 (Privy tx encoding). */
export function base58ToBase64(s: string): string | null {
  const bytes = base58ToBytes(s);
  return bytes ? Buffer.from(bytes).toString("base64") : null;
}

function base58ToBytes(s: string): Uint8Array | null {
  try {
    let num = 0n;
    for (const ch of s) {
      const i = B58.indexOf(ch);
      if (i < 0) return null;
      num = num * 58n + BigInt(i);
    }
    const bytes: number[] = [];
    while (num > 0n) {
      bytes.unshift(Number(num & 0xffn));
      num >>= 8n;
    }
    let zeros = 0;
    for (const ch of s) {
      if (ch === "1") zeros++;
      else break;
    }
    return new Uint8Array([...new Array(zeros).fill(0), ...bytes]);
  } catch {
    return null;
  }
}

function programIdOf(table: unknown, index: number | undefined): string | null {
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
    if (table && typeof table === "object") {
      const v = (table as Record<string, unknown>)[String(index)];
      return v == null ? null : String(v);
    }
  } catch {
    return null;
  }
  return null;
}

function keyToString(k: unknown): string | null {
  if (typeof k === "string") return k;
  if (k && typeof k === "object") {
    const o = k as { pubkey?: unknown; toBase58?: unknown };
    if (typeof o.pubkey === "string") return o.pubkey;
    if (typeof o.toBase58 === "function") return (o.toBase58 as () => string)();
  }
  return null;
}

/** Decode one transaction the same way /app/logs does (compiled ix + base58
 * data + PublicKey program table). Shared decode so the tool and the page
 * can't drift apart in behavior. */
export async function decodeTransaction(
  connection: Connection,
  address: string,
  signature: string,
): Promise<DecodedTx> {
  // v3's GetTransactionConfig omits `encoding` (RPC defaults to json, which is
  // the parsed shape this decoder was proven against live). Cast keeps the
  // exact runtime request while satisfying tsc.
  const tx = await connection.getTransaction(signature, {
    encoding: "jsonParsed",
    maxSupportedTransactionVersion: 0,
  } as unknown as { maxSupportedTransactionVersion?: number });
  if (!tx) throw new Error("Transaction not found (may be pruned from history)");
  const meta = tx.meta as unknown as {
    err?: unknown;
    preBalances?: (bigint | number)[] | null;
    postBalances?: (bigint | number)[] | null;
  } | null;
  const message = tx.transaction.message as unknown as {
    accountKeys?: unknown;
    instructions?: { programIdIndex?: number; accounts?: number[]; data?: string }[];
    indexToProgramIds?: unknown;
  };
  const rawKeys = message?.accountKeys;
  const at = (i: number | undefined): string | null => {
    if (i == null || !Array.isArray(rawKeys)) return null;
    return keyToString(rawKeys[i] as unknown);
  };
  const idx = Array.isArray(rawKeys) ? rawKeys.findIndex((k) => keyToString(k) === address) : -1;
  let delta: number | null = null;
  if (meta?.preBalances && meta?.postBalances && idx >= 0) {
    const pre = meta.preBalances[idx];
    const post = meta.postBalances[idx];
    delta =
      (typeof pre === "bigint" && typeof post === "bigint" ? Number(post - pre) : Number(post) - Number(pre)) /
      1_000_000_000;
  }
  const blockTime = (tx as unknown as { blockTime?: bigint | number | null }).blockTime;
  const out: DecodedTx = {
    signature,
    status: meta?.err ? "Failed" : "Confirmed",
    time: blockTime == null ? null : new Date(Number(blockTime) * 1000).toISOString(),
    kind: null,
    direction: null,
    amountSol: delta,
    counterparty: null,
  };
  for (const ix of message?.instructions ?? []) {
    const programId = programIdOf(message?.indexToProgramIds, ix.programIdIndex);
    if (!programId) continue;
    if (programId === SYSTEM_PROGRAM_ID && (ix.accounts ?? []).length >= 2) {
      const bytes = ix.data ? base58ToBytes(ix.data) : null;
      if (bytes && bytes.length >= 12) {
        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        if (view.getUint32(0, true) === 2) {
          const lamports = Number(view.getBigUint64(4, true)) / 1_000_000_000;
          const source = at(ix.accounts?.[0]);
          const destination = at(ix.accounts?.[1]);
          if (source && destination) {
            out.kind = "sol";
            out.direction = source === address ? "out" : "in";
            out.counterparty = source === address ? destination : source;
            out.amountSol = out.direction === "out" ? -lamports : lamports;
            return out;
          }
        }
      }
    }
    if (TOKEN_PROGRAM_IDS.has(programId)) {
      out.kind = "token";
      return out;
    }
  }
  if ((message?.instructions ?? []).length > 0) out.kind = "program";
  if (!out.direction && delta != null && delta !== 0) out.direction = delta > 0 ? "in" : "out";
  return out;
}
