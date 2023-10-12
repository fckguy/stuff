import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  Transaction,
} from "@solana/web3.js";
import { Mint } from "@solana/spl-token";
import { TokenFee } from "../core";
import { TokenPriceInfo } from "./jupiter";

export type TokenWithPriceInfo = {
  mint: PublicKey;
  priceInfo: TokenPriceInfo;
};

export type PricingParams = {
  costInLamports: number; // might be more than transaction fee when building config for creating account
  margin: number;
};

export async function getLamportsPerSignature(
  connection: Connection
): Promise<number> {
  const transaction = new Transaction();
  transaction.feePayer = Keypair.generate().publicKey;
  transaction.recentBlockhash = (
    await connection.getLatestBlockhash()
  ).blockhash;
  return (await connection.getFeeForMessage(transaction.compileMessage()))
    ?.value!;
}

export function createTokenFee(
  mint: PublicKey,
  priceInfo: TokenPriceInfo,
  mintInfo: Mint,
  associatedAccount: PublicKey,
  margin: number
): TokenFee {
  // add desired margin
  // for example, price is 0.01, margin is 0.9, then (1 / (1 - margin)) = 10 and price after margin is 0.1.
  const tokenPriceAfterMargin = priceInfo.price * (1 / (1 - margin));

  return new TokenFee(
    mint,
    associatedAccount,
    mintInfo.decimals,
    tokenPriceAfterMargin
  );
}

export function calculateTokenCostForLamports(
  costInLamports: number,
  price: number,
  decimals: number
): number {
  // convert costInLamports (price in SOL) to price in token
  const tokenPriceForLamports = (price / LAMPORTS_PER_SOL) * costInLamports;

  // convert to int per decimals setting of token
  const tokenPriceInDecimalNotation =
    Math.floor(tokenPriceForLamports * 10 ** decimals) + 1;

  return tokenPriceInDecimalNotation;
}
