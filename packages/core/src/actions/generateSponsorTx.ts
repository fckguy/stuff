import {
  AugmentedProvider,
  TransactionEnvelope,
} from "@saberhq/solana-contrib";
import {
  createTransferInstruction,
  getAssociatedTokenAddress,
} from "@solana/spl-token";
import { Keypair, PublicKey, Transaction } from "@solana/web3.js";

export async function generateSponsorTx(
  tx: TransactionEnvelope,
  feePayer: PublicKey,
  sponsorPayer: Keypair,
  sponsorMint: PublicKey,
  provider: AugmentedProvider,
  estimatedFee: number
): Promise<Transaction> {
  const sourceAccount = await getAssociatedTokenAddress(
    sponsorMint,
    sponsorPayer.publicKey
  );
  const feePayerTokenAccount = await getAssociatedTokenAddress(
    sponsorMint,
    feePayer
  );

  let accountTx = tx;
  accountTx = accountTx.prepend(
    createTransferInstruction(
      sourceAccount,
      feePayerTokenAccount,
      sponsorPayer.publicKey,
      estimatedFee
    )
  );

  const accountTransaction = accountTx.addSigners(sponsorPayer).build(feePayer);

  accountTransaction.recentBlockhash = await (
    await provider.connection.getLatestBlockhash()
  ).blockhash;
  accountTransaction.partialSign(sponsorPayer);
  accountTransaction.partialSign(...tx.signers);
  return accountTransaction;
}
