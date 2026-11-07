import { env } from "$amplify/env/wallet-state";
import type { Schema } from "../../data/resource";

type Handler = Schema["walletState"]["functionHandler"];

interface PrivyWallet {
  id: string;
  address: string;
  chain_type: string;
  additional_signers?: Array<{ signer_id?: string }>;
  policy_ids?: string[];
}

// Refresh-proof delegation check: read the wallet from Privy (app auth is
// enough for GET) and report who may sign for it.
export const handler: Handler = async (event) => {
  const { walletId } = event.arguments;
  const appId = env.PRIVY_APP_ID ?? "";
  const appSecret = env.PRIVY_APP_SECRET ?? "";
  if (!appId || !appSecret) throw new Error("PRIVY_APP_ID / PRIVY_APP_SECRET are not configured");

  const res = await fetch(`https://api.privy.io/v1/wallets/${walletId}`, {
    headers: {
      Authorization: `Basic ${Buffer.from(`${appId}:${appSecret}`).toString("base64")}`,
      "privy-app-id": appId,
    },
  });
  if (!res.ok) throw new Error(`Privy GET /wallets/${walletId} → ${res.status}`);
  const wallet = (await res.json()) as PrivyWallet;
  const signerIds = (wallet.additional_signers ?? [])
    .map((s) => s.signer_id)
    .filter((id): id is string => !!id);
  return {
    id: wallet.id,
    address: wallet.address,
    chainType: wallet.chain_type,
    delegated: signerIds.length > 0,
    signerIds,
    policyIds: wallet.policy_ids ?? [],
  };
};
