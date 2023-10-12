import {
  PublicKey,
  Connection,
  LAMPORTS_PER_SOL,
  Keypair,
  Transaction,
} from "@solana/web3.js";
import {
  AugmentedProvider,
  TransactionEnvelope,
} from "@saberhq/solana-contrib";
import base58 from "bs58";
import cacheManager from "cache-manager";

import {
  estimateTokenFee,
  generateSponsorTx,
  signWithTokenFee,
} from "../packages/core/src";
import { TokenFee } from "../packages/core/src/core";

export async function airdropLamports(
  connection: Connection,
  ...to: PublicKey[]
) {
  for (const publicKey of to) {
    const airdropSignature = await connection.requestAirdrop(
      publicKey,
      LAMPORTS_PER_SOL
    );
    await connection.confirmTransaction(airdropSignature);
  }
}

export async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function sendTxWithSponsor(
  feePayerKeypair: Keypair,
  sponsorPayer: Keypair,
  sponsorMint: PublicKey,
  provider: AugmentedProvider,
  tx: TransactionEnvelope,
  space: number,
  baseAllowedTokens: TokenFee[],
  cache: cacheManager.Cache,
  maxSignatures: number = 3
): Promise<{ sponsorTx: Transaction; signature: string; cost: number }> {
  const { cost } = await estimateTokenFee(
    sponsorMint,
    space,
    maxSignatures,
    5000,
    baseAllowedTokens,
    provider.connection
  );
  const sponsorTx = await generateSponsorTx(
    tx,
    feePayerKeypair.publicKey,
    sponsorPayer,
    sponsorMint,
    provider,
    cost
  );
  // Await 5s for avoiding race condition limitation
  await sleep(5000);
  const { signature } = await signWithTokenFee(
    provider.connection,
    sponsorTx,
    feePayerKeypair,
    maxSignatures,
    5000,
    baseAllowedTokens,
    cache
  );
  sponsorTx.addSignature(feePayerKeypair.publicKey, base58.decode(signature));

  // Ensure the creation of smallet is successful
  await (await provider.broadcaster.broadcast(sponsorTx)).wait();
  return { sponsorTx, signature, cost };
}
