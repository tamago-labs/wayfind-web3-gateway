// 02 - test-wallet: an app-controlled Solana wallet exists and holds devnet SOL.
// Reuses TEST_WALLET_ID when set, otherwise creates one. Funds via airdrop.
// Every later test uses this wallet.
// Run: npx tsx scripts/privy-tests/02-test-wallet.ts
import { Connection, PublicKey } from '@solana/web3.js';
import { TEST_WALLET_ID, assert, privyRest } from './config.js';

const DEVNET_RPC = process.env.SOLANA_DEVNET_RPC ?? 'https://api.devnet.solana.com';

interface PrivyWallet {
  id: string;
  address: string;
  owner_id?: string | null;
}

async function main(): Promise<void> {
  let wallet: PrivyWallet;
  if (TEST_WALLET_ID) {
    wallet = await privyRest<PrivyWallet>(`/wallets/${TEST_WALLET_ID}`, 'GET');
  } else {
    wallet = await privyRest<PrivyWallet>('/wallets', 'POST', { chain_type: 'solana' });
  }
  assert(typeof wallet.id === 'string' && wallet.id.length > 0, 'test wallet → id');
  assert(typeof wallet.address === 'string' && wallet.address.length > 0, 'test wallet → address');
  // Server-side PATCH needs an app-owned wallet (owner_id null). A user-owned
  // embedded wallet can only be changed with the owner's signature, which is
  // what the Authorization page UI flow is for — not these scripts.
  assert(
    wallet.owner_id === null || wallet.owner_id === undefined,
    `test wallet is app-owned (owner_id null) — id ${wallet.id} is user-owned, create a fresh one by unsetting TEST_WALLET_ID`,
  );
  console.log(`  wallet: ${wallet.address} (${wallet.id})`);
  if (!TEST_WALLET_ID) {
    console.log(`  save for reuse: TEST_WALLET_ID=${wallet.id}`);
  }

  const connection = new Connection(DEVNET_RPC, 'confirmed');
  const owner = new PublicKey(wallet.address);
  const balance = Number(await connection.getBalance(owner));
  console.log(`  balance: ${balance} lamports (${balance / 1_000_000_000} SOL)`);
  assert(
    Number.isFinite(balance) && balance >= 10_000,
    `test wallet funded — send devnet SOL to ${wallet.address} (https://faucet.solana.com) then rerun`,
  );

  console.log('02-test-wallet: PASS');
}

main().catch((err) => {
  console.error('02-test-wallet: FAIL', err instanceof Error ? err.message : err);
  process.exit(1);
});
