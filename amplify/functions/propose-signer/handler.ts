import { env } from "$amplify/env/propose-signer";
import type { Schema } from "../../data/resource";

type Handler = Schema["proposeSigner"]["functionHandler"];

interface KeyQuorum {
  id: string;
  display_name?: string | null;
}

function basicAuth() {
  const appId = env.PRIVY_APP_ID ?? "";
  const appSecret = env.PRIVY_APP_SECRET ?? "";
  if (!appId || !appSecret) throw new Error("PRIVY_APP_ID / PRIVY_APP_SECRET are not configured");
  return {
    Authorization: `Basic ${Buffer.from(`${appId}:${appSecret}`).toString("base64")}`,
    "privy-app-id": appId,
  };
}

async function privyGet<T>(path: string): Promise<T> {
  const res = await fetch(`https://api.privy.io/v1${path}`, { headers: basicAuth() });
  if (!res.ok) throw new Error(`Privy GET ${path} → ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

// Discover the platform signer from Privy (not from client input): match the
// key quorum by id override or display name, then confirm the default policy
// still exists. Fail closed so Authorize never starts half-configured.
export const handler: Handler = async (event) => {
  const { walletAddress, policyKey } = event.arguments as {
    walletAddress: string;
    policyKey?: string | null;
  };
  const signerName = env.PRIVY_SIGNER_NAME ?? "";
  const signerIdOverride = env.PRIVY_SIGNER_ID ?? "";
  // Policy picker: frontend sends a key, backend maps it to a real policy id
  // and fail-closes on anything unknown. Ids are not secrets (they are
  // readable off any authorized wallet), so hardcoded fallbacks are safe.
  const policyByKey: Record<string, string> = {
    // NOTE: use || not ?? — Amplify injects unconfigured env as "" (empty
    // string), which ?? would keep, silently dropping the hardcoded fallback
    // and failing every non-default authorize with "Unknown policy".
    default: env.PRIVY_DEFAULT_POLICY_ID || "",
    caps:
      env.PRIVY_SPENDING_CAPS_POLICY_ID || "us7w1phwzpr2c3vsw3mgeb8r",
    tight: env.PRIVY_TIGHT_POLICY_ID || "sma14e3q3s2fdr9172k2csej",
  };
  const key = policyKey ?? "default";
  const policyId = policyByKey[key];
  if (!policyId) {
    throw new Error(
      `Unknown policy "${key}" — choose default, caps, or tight`,
    );
  }

  const quorums = await privyGet<{ data?: KeyQuorum[] }>("/key_quorums");
  const list = quorums.data ?? [];
  const match =
    (signerIdOverride && list.find((q) => q.id === signerIdOverride)) ||
    (signerName && list.find((q) => q.display_name === signerName)) ||
    null;
  if (!match) {
    throw new Error(
      signerName
        ? `No key quorum named "${signerName}" — create it in the Privy Dashboard`
        : "PRIVY_SIGNER_NAME is not configured",
    );
  }

  if (policyId) {
    await privyGet(`/policies/${policyId}`);
  }

  return {
    walletAddress,
    signerId: match.id,
    signerName: match.display_name ?? match.id,
    policyId,
  };
};
