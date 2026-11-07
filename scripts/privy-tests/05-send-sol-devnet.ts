// 05 - send-sol-devnet: transfer 1000 lamports from the test wallet through
// Privy signing on devnet. Spends devnet SOL only.
// Run: npx tsx scripts/privy-tests/05-send-sol-devnet.ts
import { Connection, PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import {
  TEST_SOL_DESTINATION,
  TEST_WALLET_ID,
  assert,
  privyRest,
  privySignedRest,
  requireEnv,
} from './config.js';

const DEVNET_RPC = process.env.SOLANA_DEVNET_RPC ?? 'https://api.devnet.solana.com';
const DEVNET_CAIP2 = 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1';

async function main(): Promise<void> {
  requireEnv('TEST_WALLET_ID', TEST_WALLET_ID);
  const wallet = await privyRest<{ id: string; address: string }>(
    `/wallets/${TEST_WALLET_ID}`,
    'GET',
  );
  console.log(`  wallet: ${wallet.address} (${wallet.id})`);

  const connection = new Connection(DEVNET_RPC, 'confirmed');
  const sender = new PublicKey(wallet.address);
  const destination = new PublicKey(TEST_SOL_DESTINATION || wallet.address);
  const lamports = 1_000;

  const balance = await connection.getBalance(sender);
  assert(balance >= lamports + 5_000, `test wallet can cover transfer (${balance} lamports)`);

  const { blockhash } = await connection.getLatestBlockhash();
  const tx = new Transaction({ feePayer: sender, recentBlockhash: blockhash }).add(
    SystemProgram.transfer({ fromPubkey: sender, toPubkey: destination, lamports }),
  );
  const serialized = Buffer.from(
    await tx.serialize({ requireAllSignatures: false, verifySignatures: false }),
  ).toString('base64');

  const sent = await privySignedRest<{
    method: string;
    data: { hash: string; caip2: string };
  }>(`/wallets/${wallet.id}/rpc`, 'POST', {
    method: 'signAndSendTransaction',
    caip2: DEVNET_CAIP2,
    params: { transaction: serialized, encoding: 'base64' },
  });
  assert(
    typeof sent.data?.hash === 'string' && sent.data.hash.length > 0,
    'signAndSendTransaction → hash',
  );
  console.log(`  signature: ${sent.data.hash}`);
  console.log(`  explorer: https://explorer.solana.com/tx/${sent.data.hash}?cluster=devnet`);

  console.log('05-send-sol-devnet: PASS');
}

main().catch((err) => {
  console.error('05-send-sol-devnet: FAIL', err instanceof Error ? err.message : err);
  process.exit(1);
});


// PS C:\projects\wayfind-web3> npx tsx scripts/privy-tests/05-send-sol-devnet.ts
//   wallet: A1AwLk6RHhvbZTgUSTo944J518MiNrUJu5PU76Hq6K84 (ue24ivn3tofvdnog8i0jtzcz)
// ok: test wallet can cover transfer (500000000 lamports)
// ok: signAndSendTransaction → hash
//   signature: 3dmiKzVDfqq2Eae5AZkg74a5aduxLYvnQEdYGQvbKQXgM68K5qcD3hR2i2QRBrBjV4MfybHMHqADaQ9KN8uWsdf1
//   explorer: https://explorer.solana.com/tx/3dmiKzVDfqq2Eae5AZkg74a5aduxLYvnQEdYGQvbKQXgM68K5qcD3hR2i2QRBrBjV4MfybHMHqADaQ9KN8uWsdf1?cluster=devnet
// 05-send-sol-devnet: PASS