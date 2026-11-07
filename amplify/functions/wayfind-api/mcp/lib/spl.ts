import { Connection, PublicKey, SystemProgram, TransactionInstruction } from "@solana/web3.js";

export const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
export const TOKEN_2022_PROGRAM_ID = new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");

/** Find a token account holding enough of a mint. Faucets and apps often fund
 * non-ATA accounts, so scan real holdings instead of assuming the ATA. */
export async function findSourceAccount(
  connection: Connection,
  owner: PublicKey,
  mint: PublicKey,
  needBaseUnits: bigint,
): Promise<{ source: PublicKey; decimals: number } | null> {
  const resp = await connection
    .getParsedTokenAccountsByOwner(owner, { mint }, "confirmed")
    .catch(() => null);
  for (const acc of resp?.value ?? []) {
    const info = (
      acc.account.data as unknown as {
        parsed?: { info?: { tokenAmount?: { amount?: string; decimals?: number } } };
      }
    ).parsed?.info?.tokenAmount;
    if (typeof info?.amount !== "string" || typeof info?.decimals !== "number") continue;
    if (BigInt(info.amount) >= needBaseUnits) {
      return { source: new PublicKey(acc.pubkey.toString()), decimals: info.decimals };
    }
  }
  return null;
}

/** Derive the associated token account for (mint, owner). */
export async function findAta(mint: PublicKey, owner: PublicKey): Promise<PublicKey> {
  const [ata] = await PublicKey.findProgramAddress(
    [owner.toBytes(), TOKEN_PROGRAM_ID.toBytes(), mint.toBytes()],
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );
  return ata;
}

/** Create-ATA instruction (idempotent on-chain: fails if it exists, so only
 * add after checking the account is missing). */
export function createAtaInstruction(
  payer: PublicKey,
  ata: PublicKey,
  owner: PublicKey,
  mint: PublicKey,
): TransactionInstruction {
  return new TransactionInstruction({
    programId: ASSOCIATED_TOKEN_PROGRAM_ID,
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: ata, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: false, isWritable: false },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data: new Uint8Array(0),
  });
}

/** SPL transfer instruction (variant 3 + u64 amount LE). */
export function transferInstruction(
  source: PublicKey,
  destination: PublicKey,
  authority: PublicKey,
  amountBaseUnits: bigint,
): TransactionInstruction {
  const data = new Uint8Array(9);
  const view = new DataView(data.buffer);
  view.setUint8(0, 3);
  view.setBigUint64(1, amountBaseUnits, true);
  return new TransactionInstruction({
    programId: TOKEN_PROGRAM_ID,
    keys: [
      { pubkey: source, isSigner: false, isWritable: true },
      { pubkey: destination, isSigner: false, isWritable: true },
      { pubkey: authority, isSigner: true, isWritable: false },
    ],
    data,
  });
}
