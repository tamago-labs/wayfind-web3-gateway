import { env } from "$amplify/env/revoke-signer";
import type { Schema } from "../../data/resource";

type Handler = Schema["revokeSigner"]["functionHandler"];

// Verify revocation, don't perform it: the client removes signers with its own
// signature (removeSigners); this confirms Privy agrees before the UI updates.
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
  const wallet = (await res.json()) as {
    id: string;
    address: string;
    additional_signers?: Array<{ signer_id?: string }>;
  };
  const signerIds = (wallet.additional_signers ?? [])
    .map((s) => s.signer_id)
    .filter((id): id is string => !!id);
  if (signerIds.length > 0) {
    throw new Error("Signers are still attached — finish Revoke in the wallet first");
  }
  return { walletId: wallet.id, address: wallet.address, revoked: true };
};
