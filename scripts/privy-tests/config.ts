// Shared helpers for scripts/privy-tests/*.ts — black-box tests against Privy
// (REST API + Solana devnet) only. No Wayfind backend involved.
// Run from the repo root: npx tsx scripts/privy-tests/01-privy-connection.ts
import { createPrivateKey, sign } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// tsx scripts don't load Next.js env files — pull .env.local (then .env)
// so keys kept there work. Real shell env always wins.
for (const file of ['.env.local', '.env']) {
  const path = join(process.cwd(), file);
  if (!existsSync(path)) continue;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^\s*([^#\s=]+)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    const [, key, raw] = m;
    if (process.env[key] === undefined) {
      const value = raw.replace(/^(['"])(.*)\1$/, '$2');
      process.env[key] = value;
    }
  }
}

export const PRIVY_APP_ID = process.env.PRIVY_APP_ID ?? '';
export const PRIVY_APP_SECRET = process.env.PRIVY_APP_SECRET ?? '';
export const PRIVY_SIGNER_ID = process.env.PRIVY_SIGNER_ID ?? '';
export const PRIVY_DEFAULT_POLICY_ID = process.env.PRIVY_DEFAULT_POLICY_ID ?? '';
export const TEST_WALLET_ID = process.env.TEST_WALLET_ID ?? '';
export const TEST_SOL_DESTINATION = process.env.TEST_SOL_DESTINATION ?? '';
export const PRIVY_AUTH_PRIVATE_KEY = process.env.PRIVY_AUTH_PRIVATE_KEY ?? '';

export function assert(cond: unknown, msg: string): void {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`ok: ${msg}`);
}

export function requireEnv(name: string, value: string): void {
  if (!value) {
    console.error(`FAIL: missing env ${name}`);
    process.exit(1);
  }
}

/** Call the Privy REST API with app id + secret basic auth. */
export async function privyRest<T>(
  path: string,
  method: 'GET' | 'POST' | 'PATCH',
  body?: Record<string, unknown>,
): Promise<T> {
  requireEnv('PRIVY_APP_ID', PRIVY_APP_ID);
  requireEnv('PRIVY_APP_SECRET', PRIVY_APP_SECRET);
  const basic = Buffer.from(`${PRIVY_APP_ID}:${PRIVY_APP_SECRET}`).toString('base64');
  const res = await fetch(`https://api.privy.io/v1${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${basic}`,
      'privy-app-id': PRIVY_APP_ID,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) throw new Error(`Privy ${method} ${path} → ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

/** Minimal JSON canonicalization (recursive key sort) for signing payloads. */
function canonicalize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a < b ? -1 : a > b ? 1 : 0,
    );
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalize(v)}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

function buildSignature(method: 'POST' | 'PATCH', url: string, body: Record<string, unknown>): string {
  requireEnv('PRIVY_AUTH_PRIVATE_KEY', PRIVY_AUTH_PRIVATE_KEY);
  requireEnv('PRIVY_APP_ID', PRIVY_APP_ID);
  const payload = {
    version: 1,
    method,
    url,
    body,
    headers: { 'privy-app-id': PRIVY_APP_ID },
  };
  const serialized = canonicalize(payload);
  const b64 = PRIVY_AUTH_PRIVATE_KEY.replace(/^wallet-auth:/, '');
  const key = createPrivateKey({
    key: `-----BEGIN PRIVATE KEY-----\n${b64}\n-----END PRIVATE KEY-----`,
    format: 'pem',
  });
  return sign('sha256', Buffer.from(serialized), key).toString('base64');
}

/**
 * Privy REST call with a `privy-authorization-signature` header, signed by the
 * platform authorization key. Needed for `/rpc` (and any request on resources
 * our key owns or signs for). The Dashboard shows the private key once at
 * creation — if lost, create a new key and update PRIVY_SIGNER_ID.
 */
export async function privySignedRest<T>(
  path: string,
  method: 'POST' | 'PATCH',
  body: Record<string, unknown>,
): Promise<T> {
  requireEnv('PRIVY_APP_ID', PRIVY_APP_ID);
  requireEnv('PRIVY_APP_SECRET', PRIVY_APP_SECRET);
  const url = `https://api.privy.io/v1${path}`;
  const basic = Buffer.from(`${PRIVY_APP_ID}:${PRIVY_APP_SECRET}`).toString('base64');
  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${basic}`,
      'privy-app-id': PRIVY_APP_ID,
      'privy-authorization-signature': buildSignature(method, url, body),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Privy ${method} ${path} → ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}
