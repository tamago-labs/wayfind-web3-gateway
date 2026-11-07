// 06 - remove-signer: detach the platform signer from the test wallet.
// Server-side mirror of Revoke. Leaves the wallet clean for reruns.
// Run: npx tsx scripts/privy-tests/06-remove-signer.ts
import { TEST_WALLET_ID, assert, privyRest, requireEnv } from './config.js';

async function main(): Promise<void> {
  requireEnv('TEST_WALLET_ID', TEST_WALLET_ID);

  const updated = (await privyRest<Record<string, unknown>>(
    `/wallets/${TEST_WALLET_ID}`,
    'PATCH',
    { additional_signers: [] },
  )) as { additional_signers?: Array<{ signer_id?: string }> };

  assert(
    (updated.additional_signers ?? []).length === 0,
    'wallet has no additional signers left',
  );

  console.log('06-remove-signer: PASS');
}

main().catch((err) => {
  console.error('06-remove-signer: FAIL', err instanceof Error ? err.message : err);
  process.exit(1);
});
