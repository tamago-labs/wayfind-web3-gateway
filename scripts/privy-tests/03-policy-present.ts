// 03 - policy-present: the default Bot policy exists and matches the contract
// our backend will reference (transfer ceiling + allowlist shape).
// Run: npx tsx scripts/privy-tests/03-policy-present.ts
import { PRIVY_DEFAULT_POLICY_ID, assert, privyRest, requireEnv } from './config.js';

async function main(): Promise<void> {
  requireEnv('PRIVY_DEFAULT_POLICY_ID', PRIVY_DEFAULT_POLICY_ID);
  const policy = (await privyRest<Record<string, unknown>>(
    `/policies/${PRIVY_DEFAULT_POLICY_ID}`,
    'GET',
  )) as { id?: string; rules?: unknown[] };
  assert(policy.id === PRIVY_DEFAULT_POLICY_ID, 'default policy → found by id');
  assert(Array.isArray(policy.rules) && policy.rules.length > 0, 'default policy → has rules');
  console.log(`  rules: ${policy.rules?.length}`);

  console.log('03-policy-present: PASS');
}

main().catch((err) => {
  console.error('03-policy-present: FAIL', err instanceof Error ? err.message : err);
  process.exit(1);
});
