// 01 - privy-connection: app credentials reach the Privy API. Uses the
// app-wide wallet list as the probe (it lists every wallet in the app).
// Run: npx tsx scripts/privy-tests/01-privy-connection.ts
import { assert, privyRest } from './config.js';

async function main(): Promise<void> {
  const res = await privyRest<unknown[] | { data?: unknown[] }>('/wallets', 'GET');
  const wallets = Array.isArray(res) ? res : (res.data ?? []);
  assert(Array.isArray(wallets), 'Privy API reachable with app credentials');

  console.log('01-privy-connection: PASS');
}

main().catch((err) => {
  console.error('01-privy-connection: FAIL', err instanceof Error ? err.message : err);
  process.exit(1);
});


// {"data":[{"id":"euw77xqgzfnx87jezd33m3ns","address":"ndKH49YfQM9qriLFhPVg8o9H3JwL34AU357HYdVM2SH","chain_type":"solana","policy_ids":[],"additional_signers":[],"exported_at":null,"imported_at":null,"archived_at":null,"created_at":1793991126174,"owner_id":"syuqnr62lzsltmv66sznnt7i","parent_wallet_id":null,"entity":{"type":"user","id":"cmw5bzvhh00vb0hjxicb9a7bo"}}],"next_cursor":null}