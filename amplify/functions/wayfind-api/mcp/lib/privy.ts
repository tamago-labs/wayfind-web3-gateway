// Server-side Privy signing — mirrors scripts/privy-tests/config.ts so the
// Lambda sends exactly what the proven scripts send. Reads plain process.env
// (secrets are injected at runtime by the function resource, not stored here).
import { createPrivateKey, sign } from "node:crypto";

const CAIP2: Record<"mainnet" | "testnet", string> = {
  mainnet: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
  testnet: "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
};

function required(name: string): string {
  const v = process.env[name] ?? "";
  if (!v) throw new Error(`${name} is not configured on wayfind-api`);
  return v;
}

/** Minimal JSON canonicalization (recursive key sort) for signing payloads. */
function canonicalize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a < b ? -1 : a > b ? 1 : 0,
    );
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalize(v)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function buildSignature(method: "POST", url: string, body: Record<string, unknown>): string {
  const appId = required("PRIVY_APP_ID");
  const rawKey = required("PRIVY_AUTH_PRIVATE_KEY");
  const payload = {
    version: 1,
    method,
    url,
    body,
    headers: { "privy-app-id": appId },
  };
  const serialized = canonicalize(payload);
  const b64 = rawKey.replace(/^wallet-auth:/, "");
  const key = createPrivateKey({
    key: `-----BEGIN PRIVATE KEY-----\n${b64}\n-----END PRIVATE KEY-----`,
    format: "pem",
  });
  return sign("sha256", Buffer.from(serialized), key).toString("base64");
}

/**
 * Privy REST call signed by the platform authorization key — the same call
 * script 05 uses for /rpc. Throws with the Privy error text on failure.
 */
export async function privySignedRpc<T>(walletId: string, body: Record<string, unknown>): Promise<T> {
  const appId = required("PRIVY_APP_ID");
  const appSecret = required("PRIVY_APP_SECRET");
  const path = `/wallets/${walletId}/rpc`;
  const url = `https://api.privy.io/v1${path}`;
  const basic = Buffer.from(`${appId}:${appSecret}`).toString("base64");
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${basic}`,
      "privy-app-id": appId,
      "privy-authorization-signature": buildSignature("POST", url, body),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Privy POST ${path} → ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

/**
 * Ask Privy to sign + broadcast an unsigned base64 Solana transaction.
 * Amount limits live in the Privy default policy — the tool does not cap.
 */
export async function signAndSend(
  walletId: string,
  transactionB64: string,
  network: "mainnet" | "testnet",
): Promise<string> {
  const sent = await privySignedRpc<{ data?: { hash?: string } }>(walletId, {
    method: "signAndSendTransaction",
    caip2: CAIP2[network],
    params: { transaction: transactionB64, encoding: "base64" },
  });
  const hash = sent.data?.hash;
  if (!hash) throw new Error("Privy returned no transaction hash");
  return hash;
}
