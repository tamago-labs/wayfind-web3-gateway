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
  const { walletAddress } = event.arguments;
  const signerName = env.PRIVY_SIGNER_NAME ?? "";
  const signerIdOverride = env.PRIVY_SIGNER_ID ?? "";
  const policyId = env.PRIVY_DEFAULT_POLICY_ID ?? "";

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
