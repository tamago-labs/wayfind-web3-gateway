// 04 - add-signer: attach the platform signer + default policy to the test
// wallet. Server-side mirror of what the Authorization page does via addSigners.
// Run: npx tsx scripts/privy-tests/04-add-signer.ts
import {
  PRIVY_DEFAULT_POLICY_ID,
  PRIVY_SIGNER_ID,
  TEST_WALLET_ID,
  assert,
  privyRest,
  requireEnv,
} from './config.js';

async function main(): Promise<void> {
  requireEnv('PRIVY_SIGNER_ID', PRIVY_SIGNER_ID);
  requireEnv('TEST_WALLET_ID', TEST_WALLET_ID);

  const updated = (await privyRest<Record<string, unknown>>(
    `/wallets/${TEST_WALLET_ID}`,
    'PATCH',
    {
      additional_signers: [{ signer_id: PRIVY_SIGNER_ID }],
      ...(PRIVY_DEFAULT_POLICY_ID ? { policy_ids: [PRIVY_DEFAULT_POLICY_ID] } : {}),
    },
  )) as { additional_signers?: Array<{ signer_id?: string }>; policy_ids?: string[] };

  const signerIds = (updated.additional_signers ?? []).map((s) => s.signer_id);
  assert(signerIds.includes(PRIVY_SIGNER_ID), 'wallet echoes the platform signer');
  if (PRIVY_DEFAULT_POLICY_ID) {
    assert(
      (updated.policy_ids ?? []).includes(PRIVY_DEFAULT_POLICY_ID),
      'wallet echoes the default policy',
    );
  }

  console.log('04-add-signer: PASS');
}

main().catch((err) => {
  console.error('04-add-signer: FAIL', err instanceof Error ? err.message : err);
  process.exit(1);
});
