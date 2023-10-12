import { expect, use } from "chai";
import chaiAsPromised from "chai-as-promised";
import base58 from "bs58";
// @ts-ignore (TS7016) There is no type definition for this at DefinitelyTyped.
import MemoryStore from "cache-manager/lib/stores/memory";
import cacheManager from "cache-manager";
import {
  Keypair,
  PublicKey,
  Connection,
  Transaction,
  sendAndConfirmRawTransaction,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  mintTo,
  createTransferInstruction,
  createAccount,
  getAccount,
  createAssociatedTokenAccountInstruction,
  getMinimumBalanceForRentExemptAccount,
  getMint,
  getOrCreateAssociatedTokenAccount,
} from "@solana/spl-token";
import { getTokenFeeByMint, signWithTokenFee } from "../../packages/core/src";
import { TokenFee } from "../../packages/core/src/core";
import { airdropLamports } from "../common";
import { ENV_SECRET_KEYPAIR } from "../../src";
import { getTestTokenKeypair } from "../fakeTokens";

use(chaiAsPromised);

describe("createAccountIfTokenFeePaid action", async () => {
  let connection: Connection;
  let feePayerKeypair: Keypair; // Payer for submitted transactions
  let mint: PublicKey;
  let feePayerTokenAccount: PublicKey; // Account for fees in tokens
  let baseAllowedTokens: TokenFee[];
  let cache: cacheManager.Cache;
  before(async () => {
    cache = cacheManager.caching({ store: MemoryStore, max: 1000, ttl: 120 });
    connection = new Connection("http://localhost:8899/", "confirmed");
    feePayerKeypair = ENV_SECRET_KEYPAIR;
    await airdropLamports(connection, feePayerKeypair.publicKey);
    // Trying to get keypair for test token
    const testToken = getTestTokenKeypair("WBTC");
    mint = (await getMint(connection, testToken.keypair.publicKey)).address;
    // Replaced jupiter token address instead of token mint to fetch jupiter price.
    // This just for testing purpose against jupiter APIs
    const wBtcTokenFee = await getTokenFeeByMint(
      testToken.jupMint,
      feePayerKeypair,
      connection,
      await getMint(connection, mint),
      await getOrCreateAssociatedTokenAccount(
        connection,
        feePayerKeypair,
        mint,
        feePayerKeypair.publicKey
      )
    );
    feePayerTokenAccount = wBtcTokenFee!.account;
    baseAllowedTokens = [wBtcTokenFee!];
  });

  let sourceOwner: Keypair;
  let sourceAccount: PublicKey;
  let recentBlockhash = "";
  beforeEach(async () => {
    // We shouldn't airdrop any SOL to this keypair
    sourceOwner = Keypair.generate();
    sourceAccount = await createAccount(
      connection,
      feePayerKeypair,
      mint,
      sourceOwner.publicKey
    );

    await mintTo(
      connection,
      feePayerKeypair,
      mint,
      sourceAccount,
      feePayerKeypair.publicKey,
      5000000
    );

    recentBlockhash = (await connection.getRecentBlockhash()).blockhash;
  });

  it("signs a transaction with initialization fees and token transfer to a previously not used associated token account", async () => {
    const targetOwner = Keypair.generate();
    const targetAccountAddress = await getAssociatedTokenAddress(
      mint,
      targetOwner.publicKey,
      false
    );

    // We first have to create an associated account for target owner
    const accountRent = await getMinimumBalanceForRentExemptAccount(connection);
    const accountTransaction = new Transaction();
    accountTransaction.add(
      createTransferInstruction(
        sourceAccount,
        feePayerTokenAccount,
        sourceOwner.publicKey,
        100 + accountRent
      )
    );
    accountTransaction.add(
      createAssociatedTokenAccountInstruction(
        // We are using Octane's public key, since the initialization fees have to be paid in SOL
        // and our hypothetical user doesn't have any SOL.
        feePayerKeypair.publicKey,
        targetAccountAddress,
        targetOwner.publicKey,
        mint
      )
    );
    accountTransaction.feePayer = feePayerKeypair.publicKey;
    accountTransaction.recentBlockhash = recentBlockhash;
    accountTransaction.partialSign(sourceOwner);

    await expect(getAccount(connection, targetAccountAddress, "confirmed")).to
      .be.rejected;

    const { signature } = await signWithTokenFee(
      connection,
      accountTransaction,
      feePayerKeypair,
      2,
      5000,
      baseAllowedTokens,
      cache
    );
    expect(signature).to.not.be.empty;
    accountTransaction.addSignature(
      feePayerKeypair.publicKey,
      base58.decode(signature)
    );
    await sendAndConfirmRawTransaction(
      connection,
      accountTransaction.serialize(),
      { commitment: "confirmed" }
    );
    expect(
      (await connection.getSignatureStatus(signature)).value!.confirmationStatus
    ).to.be.equals("confirmed");
    expect(
      (await getAccount(connection, targetAccountAddress, "confirmed"))
        .isInitialized
    ).to.be.true;
    expect(
      (await getAccount(connection, feePayerTokenAccount, "confirmed")).amount
    ).to.equal(BigInt(100 + accountRent));
  });

  it("rejects a transaction with previously created account", async () => {
    const targetOwner = Keypair.generate();
    const targetAccount = await createAccount(
      connection,
      feePayerKeypair,
      mint,
      targetOwner.publicKey
    );

    // We first have to create an associated account for target owner
    const accountRent = await getMinimumBalanceForRentExemptAccount(connection);
    const accountTransaction = new Transaction();
    accountTransaction.add(
      createTransferInstruction(
        sourceAccount,
        feePayerTokenAccount,
        sourceOwner.publicKey,
        100 + accountRent
      )
    );
    accountTransaction.add(
      createAssociatedTokenAccountInstruction(
        // We are using Octane's public key, since the initialization fees have to be paid in SOL
        // and our hypothetical user doesn't have any SOL.
        feePayerKeypair.publicKey,
        targetAccount,
        targetOwner.publicKey,
        mint
      )
    );
    accountTransaction.feePayer = feePayerKeypair.publicKey;
    accountTransaction.recentBlockhash = recentBlockhash;
    accountTransaction.partialSign(sourceOwner);

    try {
      await signWithTokenFee(
        connection,
        accountTransaction,
        feePayerKeypair,
        2,
        5000,
        baseAllowedTokens,
        cache
      );
    } catch (e) {
      const err = e as Error;
      expect(err.message).to.include(`failed: Provided owner is not allowed`);
    }
  });

  // TODO: cover more errors while signing memory transaction.
});
