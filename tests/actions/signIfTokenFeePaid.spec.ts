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
  mintTo,
  createTransferInstruction,
  createAccount,
  getAccount,
  getMint,
  getOrCreateAssociatedTokenAccount,
} from "@solana/spl-token";
import { sleep } from "@saberhq/solana-contrib";
import { getTokenFeeByMint, signWithTokenFee } from "../../packages/core/src";
import { TokenFee } from "../../packages/core/src/core";
import { airdropLamports } from "../common";
import { ENV_SECRET_KEYPAIR } from "../../src";
import { getTestTokenKeypair } from "../fakeTokens";

use(chaiAsPromised);

describe("signIfTokenFeePaid action", async () => {
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
      5000
    );

    recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  });

  it("signs a transaction with token transfer to Octane payer and an arbitrary transfer successfully", async () => {
    const targetOwner = Keypair.generate();
    // We assume target account is already created.
    const targetAccount = await createAccount(
      connection,
      feePayerKeypair,
      mint,
      targetOwner.publicKey
    );

    const transaction = new Transaction();
    transaction.add(
      createTransferInstruction(
        sourceAccount,
        feePayerTokenAccount,
        sourceOwner.publicKey,
        100
      )
    );
    transaction.add(
      createTransferInstruction(
        sourceAccount,
        targetAccount,
        sourceOwner.publicKey,
        100
      )
    );
    transaction.feePayer = feePayerKeypair.publicKey;
    transaction.recentBlockhash = recentBlockhash;
    transaction.partialSign(sourceOwner);

    const { signature } = await signWithTokenFee(
      connection,
      transaction,
      feePayerKeypair,
      2,
      5000,
      baseAllowedTokens,
      cache
    );
    expect(signature).to.not.be.empty;
    transaction.addSignature(
      feePayerKeypair.publicKey,
      base58.decode(signature)
    );
    await sendAndConfirmRawTransaction(connection, transaction.serialize(), {
      commitment: "confirmed",
    });

    expect(
      (await connection.getSignatureStatus(signature)).value!.confirmationStatus
    ).to.be.equals("confirmed");
    expect(
      (await getAccount(connection, sourceAccount, "confirmed")).amount
    ).to.equal(BigInt(4800));
    expect(
      (await getAccount(connection, targetAccount, "confirmed")).amount
    ).to.equal(BigInt(100));
  });

  it("rejects a duplicate transaction", async () => {
    const transaction = new Transaction();
    transaction.add(
      createTransferInstruction(
        sourceAccount,
        feePayerTokenAccount,
        sourceOwner.publicKey,
        100
      )
    );
    transaction.feePayer = feePayerKeypair.publicKey;
    transaction.recentBlockhash = recentBlockhash;
    transaction.partialSign(sourceOwner);
    const { signature } = await signWithTokenFee(
      connection,
      transaction,
      feePayerKeypair,
      2,
      5000,
      baseAllowedTokens,
      cache
    );
    expect(signature).to.not.be.empty;
    await expect(
      signWithTokenFee(
        connection,
        transaction,
        feePayerKeypair,
        2,
        5000,
        baseAllowedTokens,
        cache
      )
    ).to.be.rejectedWith("duplicate transaction");
  });

  // actually simulate race condition
  it("rejects a transfer from the same account before timeout expires", async () => {
    const sameSourceTimeout = 500;
    // Make 3 transactions with different amounts to avoid 'duplicate transaction' error
    const transaction1 = new Transaction().add(
      createTransferInstruction(
        sourceAccount,
        feePayerTokenAccount,
        sourceOwner.publicKey,
        100
      )
    );
    const transaction2 = new Transaction().add(
      createTransferInstruction(
        sourceAccount,
        feePayerTokenAccount,
        sourceOwner.publicKey,
        101
      )
    );
    const transaction3 = new Transaction().add(
      createTransferInstruction(
        sourceAccount,
        feePayerTokenAccount,
        sourceOwner.publicKey,
        102
      )
    );

    for (const transaction of [transaction1, transaction2, transaction3]) {
      transaction.feePayer = feePayerKeypair.publicKey;
      transaction.recentBlockhash = recentBlockhash;
      transaction.partialSign(sourceOwner);
    }

    const { signature: signature1 } = await signWithTokenFee(
      connection,
      transaction1,
      feePayerKeypair,
      2,
      5000,
      baseAllowedTokens,
      cache,
      sameSourceTimeout
    );
    expect(signature1).to.not.be.empty;
    await expect(
      signWithTokenFee(
        connection,
        transaction2,
        feePayerKeypair,
        2,
        5000,
        baseAllowedTokens,
        cache,
        sameSourceTimeout
      )
    ).to.be.rejectedWith("duplicate transfer");
    await sleep(sameSourceTimeout);
    const { signature: signature3 } = await signWithTokenFee(
      connection,
      transaction3,
      feePayerKeypair,
      2,
      5000,
      baseAllowedTokens,
      cache,
      sameSourceTimeout
    );
    expect(signature3).to.not.be.empty;
  });

  it("rejects a transfer with insufficient token cost", async () => {
    const transaction = new Transaction();
    transaction.add(
      createTransferInstruction(
        sourceAccount,
        feePayerTokenAccount,
        sourceOwner.publicKey,
        70
      )
    );
    transaction.feePayer = feePayerKeypair.publicKey;
    transaction.recentBlockhash = recentBlockhash;
    transaction.partialSign(sourceOwner);
    await expect(
      signWithTokenFee(
        connection,
        transaction,
        feePayerKeypair,
        2,
        5000,
        baseAllowedTokens,
        cache
      )
    ).to.be.rejectedWith("insufficient fee cost");
  });

  // todo: cover more errors
});
