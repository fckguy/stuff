import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import {
  Account,
  Mint,
  getMint,
  getOrCreateAssociatedTokenAccount,
} from "@solana/spl-token";

import { TokenFee } from "../core";
import { createTokenFee, getTokenToNativePriceInfo } from "../payer-utils";
import { addTokenFeeToConfig } from "./getTokenFeeByMint";

/**
 * Allow {mint} token for using as sponsor pay.
 * This action is for the admin of this core package.
 *
 * @param mint        Sponsor SPL mint
 * @param margin      Part of total user-paid fee that fee payers takes as a surplus to transaction costs.
 *                    From 0 to 1. For example, 0.5 would mean that user pays 2x the SOL signature fee
 *                    and 0.9 would mean that user pays 10x the fee.
 *
 * @return TokenFee   Generated TokenFee object for this {mint}
 */
export async function addAllowedTokenAsAdmin(
  mint: PublicKey,
  feePayer: Keypair,
  margin: number,
  connection: Connection,
  tokenMintInfo?: Mint,
  tokenAccount?: Account
): Promise<TokenFee> {
  const tokenInfo = tokenMintInfo ?? (await getMint(connection, mint));
  const account =
    tokenAccount ??
    (await getOrCreateAssociatedTokenAccount(
      connection,
      feePayer,
      mint,
      feePayer.publicKey
    ));
  const tokenPriceInfo = await getTokenToNativePriceInfo(mint);

  const newTokenFee = await createTokenFee(
    tokenInfo.address,
    tokenPriceInfo,
    tokenInfo,
    account.address,
    margin
  );

  await addTokenFeeToConfig(newTokenFee, margin);

  return newTokenFee;
}
