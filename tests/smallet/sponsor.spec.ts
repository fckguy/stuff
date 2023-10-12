import * as anchor from "@project-serum/anchor";
import { expectTX } from "@saberhq/chai-solana";
// @ts-ignore (TS7016) There is no type definition for this at DefinitelyTyped.
import MemoryStore from "cache-manager/lib/stores/memory";
import cacheManager from "cache-manager";
import {
  createMemoInstruction,
  PendingTransaction,
  TransactionEnvelope,
} from "@saberhq/solana-contrib";
import { sleep, u64 } from "@saberhq/token-utils";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  createAccount,
  getAccount,
  getMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from "@solana/spl-token";
import { expect } from "chai";
import invariant from "tiny-invariant";
import NodeWallet from "@project-serum/anchor/dist/cjs/nodewallet";

import { SmalletErrors } from "../../src/idls/smallet";
import type { SmalletWrapper } from "../../src/wrappers/smallet";
import {
  findSmallet,
  findSubaccountInfoAddress,
  findTransactionAddress,
  findWalletDerivedAddress,
  getSmalletSpaceSize,
  getSubAccountSpaceSize,
  getTransactionSpaceSize,
} from "../../src/wrappers/smallet";
import { makeSDK } from "../workspace";
import { TokenFee } from "../../packages/core/src/core";
import { ENV_SECRET_KEYPAIR } from "../../src";
import { airdropLamports, sendTxWithSponsor } from "../common";
import { getTestTokenKeypair } from "../fakeTokens";
import { getTokenFeeByMint } from "../../packages/core/src";

// Define the smallet tests
describe("smallet sponsor pay", () => {
  const { BN, web3 } = anchor;
  const sdk = makeSDK();
  const program = sdk.programs.Smallet;

  let connection: Connection;
  let feePayerKeypair: Keypair; // Payer for submitted transactions
  let sponsorMint: PublicKey;
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
    sponsorMint = (await getMint(connection, testToken.keypair.publicKey))
      .address;
    // Replaced jupiter token address instead of token mint to fetch jupiter price.
    // This just for testing purpose against jupiter APIs
    const wBtcTokenFee = await getTokenFeeByMint(
      testToken.jupMint,
      feePayerKeypair,
      connection,
      await getMint(connection, sponsorMint),
      await getOrCreateAssociatedTokenAccount(
        connection,
        feePayerKeypair,
        sponsorMint,
        feePayerKeypair.publicKey
      )
    );
    feePayerTokenAccount = wBtcTokenFee!.account;
    baseAllowedTokens = [wBtcTokenFee!];
  });

  // Test the smallet program
  describe("Tests the smallet program with sponsor paying", () => {
    // Generate a new keypair for smallet base
    const smalletBase = web3.Keypair.generate();
    // Define the number of owners
    const numOwners = 10; // Big enough.

    const ownerA = web3.Keypair.generate();
    const ownerB = web3.Keypair.generate();
    const ownerC = web3.Keypair.generate();
    const ownerD = web3.Keypair.generate();
    // Create an array of owner public keys
    const owners = [ownerA.publicKey, ownerB.publicKey, ownerC.publicKey];
    // Define the threshold as a Big Number
    const threshold = new BN(2);

    let sponsorPayer: Keypair;
    let sponsorTokenAccount: PublicKey;
    before(async () => {
      // We shouldn't airdrop any SOL to this keypair
      sponsorPayer = Keypair.generate();
      sponsorTokenAccount = await createAccount(
        connection,
        feePayerKeypair,
        sponsorMint,
        sponsorPayer.publicKey
      );

      await mintTo(
        connection,
        feePayerKeypair,
        sponsorMint,
        sponsorTokenAccount,
        feePayerKeypair.publicKey,
        5000000
      );
    });

    let smalletWrapper: SmalletWrapper;
    before(async () => {
      // Create a new smallet
      const { smalletWrapper: wrapperInner, tx } = await sdk.newSmallet({
        numOwners,
        owners,
        threshold,
        numGuadians: numOwners,
        guadians: owners,
        base: smalletBase,
        payer: feePayerKeypair.publicKey,
      });

      // We first have to create an associated account for target owner
      expect(await getAccount(connection, feePayerTokenAccount)).to.be.not
        .empty;

      const oldBalance = (
        await getAccount(connection, feePayerTokenAccount, "confirmed")
      ).amount;
      const space = getSmalletSpaceSize(numOwners, numOwners);
      const { signature, cost } = await sendTxWithSponsor(
        feePayerKeypair,
        sponsorPayer,
        sponsorMint,
        sdk.provider,
        tx,
        space,
        baseAllowedTokens,
        cache
      );
      expect(
        (await connection.getSignatureStatus(signature)).value!
          .confirmationStatus
      ).to.be.equals("confirmed");
      expect(
        (await getAccount(connection, feePayerTokenAccount, "confirmed"))
          .isInitialized
      ).to.be.true;
      expect(
        (await getAccount(connection, feePayerTokenAccount, "confirmed"))
          .amount - oldBalance
      ).to.equal(BigInt(cost));

      smalletWrapper = wrapperInner;
    });

    // Test the happy path
    it("happy path", async () => {
      await smalletWrapper.reloadData();
      // Ensure the smallet was created
      invariant(smalletWrapper.data, "smallet was not created");
      // Verify the threshold and owners match the expected values
      expect(smalletWrapper.data.threshold).to.be.bignumber.equal(new BN(2));
      expect(smalletWrapper.data.owners).to.deep.equal(owners);
      // Find the smallet key and bump
      const [smalletKey, bump] = await findSmallet(smalletWrapper.data.base);
      expect(smalletWrapper.data.bump).to.be.equal(bump);

      const newOwners = [ownerA.publicKey, ownerB.publicKey, ownerD.publicKey];
      // Encode the data for the "set_owners" instruction
      const data = program.coder.instruction.encode("set_owners", {
        owners: newOwners,
      });
      // Create a new transaction instruction
      const instruction = new TransactionInstruction({
        programId: program.programId,
        keys: [
          {
            pubkey: smalletKey,
            isWritable: true,
            isSigner: true,
          },
        ],
        data,
      });
      // Create a new transaction proposal
      const { transactionKey, tx: proposeTx } =
        await smalletWrapper.newTransaction({
          proposer: ownerA.publicKey,
          payer: feePayerKeypair.publicKey,
          instructions: [instruction],
        });
      // proposeTx is a transaction to be processed by the smallet, signed by ownerA
      proposeTx.signers.push(ownerA);
      const space = getTransactionSpaceSize([instruction], owners.length);
      const oldBalance = (
        await getAccount(connection, feePayerTokenAccount, "confirmed")
      ).amount;
      const { signature, cost } = await sendTxWithSponsor(
        feePayerKeypair,
        sponsorPayer,
        sponsorMint,
        sdk.provider,
        proposeTx,
        space,
        baseAllowedTokens,
        cache
      );
      expect(signature).to.not.be.empty;
      expect(
        (await connection.getSignatureStatus(signature)).value!
          .confirmationStatus
      ).to.be.equals("confirmed");
      expect(
        (await getAccount(connection, feePayerTokenAccount, "confirmed"))
          .amount - oldBalance
      ).to.equal(BigInt(cost));

      // Fetch the transaction account associated with transactionKey
      const txAccount = await smalletWrapper.fetchTransaction(transactionKey);
      // Validate transaction account properties
      expect(txAccount.executedAt.toNumber()).to.equal(-1);
      expect(txAccount.ownerSetSeqno).to.equal(0);
      expect(txAccount.instructions[0]?.programId, "program id").to.eqAddress(
        program.programId
      );
      expect(txAccount.instructions[0]?.data, "data").to.deep.equal(data);
      expect(txAccount.instructions[0]?.keys, "keys").to.deep.equal(
        instruction.keys
      );
      expect(txAccount.smallet).to.eqAddress(smalletKey);

      // Other owner approves transaction.
      await expectTX(
        smalletWrapper
          .approveTransaction(transactionKey, ownerB.publicKey)
          .addSigners(ownerB)
      ).to.be.fulfilled;
      const approveTx = smalletWrapper
        .approveTransaction(transactionKey, ownerB.publicKey)
        .addSigners(ownerB);

      const { signature: approveSig } = await sendTxWithSponsor(
        feePayerKeypair,
        sponsorPayer,
        sponsorMint,
        sdk.provider,
        approveTx,
        0,
        baseAllowedTokens,
        cache
      );

      expect(approveSig).to.not.be.empty;
      expect(
        (await connection.getSignatureStatus(approveSig)).value!
          .confirmationStatus
      ).to.be.equals("confirmed");

      // Execute the transaction since the threshold is reached
      const executeTx = (
        await smalletWrapper.executeTransaction({
          transactionKey,
          owner: ownerA.publicKey,
        })
      ).addSigners(ownerA);
      const { signature: executeSig } = await sendTxWithSponsor(
        feePayerKeypair,
        sponsorPayer,
        sponsorMint,
        sdk.provider,
        executeTx,
        0,
        baseAllowedTokens,
        cache
      );

      expect(executeSig).to.not.be.empty;
      expect(
        (await connection.getSignatureStatus(executeSig)).value!
          .confirmationStatus
      ).to.be.equals("confirmed");

      // Reload smallet data and validate properties
      await smalletWrapper.reloadData();
      expect(smalletWrapper.bump).to.be.equal(bump);
      expect(smalletWrapper.data.ownerSetSeqno).to.equal(1);
      expect(smalletWrapper.data.threshold).to.bignumber.equal(new BN(2));
      expect(smalletWrapper.data.owners).to.deep.equal(newOwners);
    });
    // Test for owner set change
    it("owner set changed", async () => {
      const [transactionKey] = await findTransactionAddress(
        smalletWrapper.key,
        0
      );

      let tx = smalletWrapper
        .approveTransaction(transactionKey, ownerB.publicKey)
        .addSigners(ownerB);
      try {
        await sendTxWithSponsor(
          feePayerKeypair,
          sponsorPayer,
          sponsorMint,
          sdk.provider,
          tx,
          0,
          baseAllowedTokens,
          cache
        );
      } catch (e) {
        const err = e as Error;
        expect(err.message).to.include(
          `0x${SmalletErrors.OwnerSetChanged.code.toString(16)}`
        );
      }

      tx = await smalletWrapper.executeTransaction({
        transactionKey,
        owner: ownerA.publicKey,
      });
      tx.addSigners(ownerA);

      try {
        await sendTxWithSponsor(
          feePayerKeypair,
          sponsorPayer,
          sponsorMint,
          sdk.provider,
          tx,
          0,
          baseAllowedTokens,
          cache
        );
      } catch (e) {
        const err = e as Error;
        expect(err.message).to.include(
          `0x${SmalletErrors.OwnerSetChanged.code.toString(16)}`
        );
      }
    });
    // Test for idempotent transaction execution
    it("transaction execution is idempotent", async () => {
      const newThreshold = new u64(1);
      const data = program.coder.instruction.encode("change_threshold", {
        threshold: newThreshold,
      });

      const instruction = new TransactionInstruction({
        programId: program.programId,
        keys: [
          {
            pubkey: smalletWrapper.key,
            isWritable: true,
            isSigner: true,
          },
        ],
        data,
      });
      // Create a new transaction to change the threshold
      const { tx, transactionKey } = await smalletWrapper.newTransaction({
        proposer: ownerA.publicKey,
        instructions: [instruction],
        payer: feePayerKeypair.publicKey,
      });
      const space = getTransactionSpaceSize([instruction], owners.length);
      // Sign the transaction with ownerA
      tx.signers.push(ownerA);
      await expect(
        sendTxWithSponsor(
          feePayerKeypair,
          sponsorPayer,
          sponsorMint,
          sdk.provider,
          tx,
          space,
          baseAllowedTokens,
          cache
        )
      ).to.be.fulfilled;

      // Sleep to make sure transaction creation was finalized
      await sleep(750);

      // Other owner (ownerB) approves the transaction
      let transaction = smalletWrapper
        .approveTransaction(transactionKey, ownerB.publicKey)
        .addSigners(ownerB);
      await expect(
        sendTxWithSponsor(
          feePayerKeypair,
          sponsorPayer,
          sponsorMint,
          sdk.provider,
          transaction,
          0,
          baseAllowedTokens,
          cache
        )
      ).to.be.fulfilled;

      // Execute the transaction since the threshold is reached
      transaction = (
        await smalletWrapper.executeTransaction({
          transactionKey,
          owner: ownerA.publicKey,
        })
      ).addSigners(ownerA);
      await expect(
        sendTxWithSponsor(
          feePayerKeypair,
          sponsorPayer,
          sponsorMint,
          sdk.provider,
          transaction,
          0,
          baseAllowedTokens,
          cache
        )
      ).to.be.fulfilled;
      // Reload smallet data and validate threshold
      await smalletWrapper.reloadData();
      expect(smalletWrapper.data?.threshold).to.bignumber.eq(newThreshold);
      // Attempt to execute the transaction again (idempotent execution)
      const execTxDuplicate = await smalletWrapper.executeTransaction({
        transactionKey,
        owner: ownerB.publicKey,
      });
      execTxDuplicate.addSigners(ownerB);

      try {
        await sendTxWithSponsor(
          feePayerKeypair,
          sponsorPayer,
          sponsorMint,
          sdk.provider,
          execTxDuplicate,
          0,
          baseAllowedTokens,
          cache
        );
      } catch (e) {
        const err = e as Error;
        expect(err.message).to.include(
          `0x${SmalletErrors.AlreadyExecuted.code.toString(16)}`
        );
      }
    });
  });

  describe("Tests the smallet program with timelock", () => {
    // Define the number of owners for the smallet
    const numOwners = 10; // Big enough.
    // Generate a key pair for the smallet base
    const smalletBase = web3.Keypair.generate();

    const ownerA = web3.Keypair.generate();
    const ownerB = web3.Keypair.generate();
    const ownerC = web3.Keypair.generate();
    // Create an array of owner public keys
    const owners = [ownerA.publicKey, ownerB.publicKey, ownerC.publicKey];
    // Specify the threshold and delay values
    const threshold = new anchor.BN(1);
    const delay = new anchor.BN(10);

    let smalletWrapper: SmalletWrapper;

    let sponsorPayer: Keypair;
    let sponsorTokenAccount: PublicKey;
    before(async () => {
      // We shouldn't airdrop any SOL to this keypair
      sponsorPayer = Keypair.generate();
      sponsorTokenAccount = await createAccount(
        connection,
        feePayerKeypair,
        sponsorMint,
        sponsorPayer.publicKey
      );

      await mintTo(
        connection,
        feePayerKeypair,
        sponsorMint,
        sponsorTokenAccount,
        feePayerKeypair.publicKey,
        5000000
      );
    });

    before(async () => {
      // Create a new smallet with specified parameters
      const { smalletWrapper: wrapperInner, tx } = await sdk.newSmallet({
        numOwners,
        owners,
        threshold,
        numGuadians: numOwners,
        guadians: owners,
        base: smalletBase,
        delay,
        payer: feePayerKeypair.publicKey,
      });
      const space = getSmalletSpaceSize(numOwners, numOwners);
      await expect(
        sendTxWithSponsor(
          feePayerKeypair,
          sponsorPayer,
          sponsorMint,
          sdk.provider,
          tx,
          space,
          baseAllowedTokens,
          cache
        )
      ).to.be.fulfilled;
      smalletWrapper = wrapperInner;
    });

    it("invalid eta", async () => {
      await smalletWrapper.reloadData();
      invariant(smalletWrapper.data, "smallet was not created");
      // Find the smallet key
      const [smalletKey] = await findSmallet(smalletWrapper.data.base);
      // Specify the new owners and encode the data for set_owners instruction
      const newOwners = [ownerA.publicKey, ownerB.publicKey];
      const data = program.coder.instruction.encode("set_owners", {
        owners: newOwners,
      });
      // Create a new instruction for setting new owners
      const instruction = new TransactionInstruction({
        programId: program.programId,
        keys: [
          {
            pubkey: smalletKey,
            isWritable: true,
            isSigner: true,
          },
        ],
        data,
      });
      // Create a new transaction to set new owners
      const { tx } = await smalletWrapper.newTransaction({
        proposer: ownerB.publicKey,
        instructions: [instruction],
        payer: feePayerKeypair.publicKey,
      });
      tx.signers.push(ownerB);
      const space = getTransactionSpaceSize([instruction], owners.length);
      // Test function for handling an invalid ETA
      try {
        await sendTxWithSponsor(
          feePayerKeypair,
          sponsorPayer,
          sponsorMint,
          sdk.provider,
          tx,
          space,
          baseAllowedTokens,
          cache
        );
      } catch (e) {
        const err = e as Error;
        expect(err.message).to.include(
          `0x${SmalletErrors.InvalidETA.code.toString(16)}`
        );
      }
    });
    // Test function for executing a transaction
    it("execute tx", async () => {
      await smalletWrapper.reloadData();
      invariant(smalletWrapper.data, "smallet was not created");
      // Find the smallet key
      const [smalletKey] = await findSmallet(smalletWrapper.data.base);
      // Specify the new owners and encode the data for set_owners instruction
      const newOwners = [ownerA.publicKey, ownerB.publicKey];
      const data = program.coder.instruction.encode("set_owners", {
        owners: newOwners,
      });
      // Create a new instruction for setting new owners
      const instruction = new TransactionInstruction({
        programId: program.programId,
        keys: [
          {
            pubkey: smalletKey,
            isWritable: true,
            isSigner: true,
          },
        ],
        data,
      });
      // Calculate ETA based on minimumDelay and current timestamp
      const eta = smalletWrapper.data.minimumDelay.add(
        new BN(Date.now() / 1000 + 6) // Added 6s more for sponsor pay awaiting time
      );
      // Create a new transaction with specified parameters
      const { transactionKey, tx } = await smalletWrapper.newTransaction({
        proposer: ownerB.publicKey,
        instructions: [instruction],
        payer: feePayerKeypair.publicKey,
        eta,
      });
      tx.signers.push(ownerB);
      const space = getTransactionSpaceSize([instruction], owners.length);
      await expect(
        sendTxWithSponsor(
          feePayerKeypair,
          sponsorPayer,
          sponsorMint,
          sdk.provider,
          tx,
          space,
          baseAllowedTokens,
          cache
        )
      ).to.be.fulfilled;

      // Attempt to execute the transaction before the ETA
      const falseStartTx = await smalletWrapper.executeTransaction({
        transactionKey,
        owner: ownerA.publicKey,
      });
      falseStartTx.addSigners(ownerA);
      try {
        await sendTxWithSponsor(
          feePayerKeypair,
          sponsorPayer,
          sponsorMint,
          sdk.provider,
          falseStartTx,
          0,
          baseAllowedTokens,
          cache
        );
      } catch (e) {
        const err = e as Error;
        expect(err.message).to.include(
          `0x${SmalletErrors.TransactionNotReady.code.toString(16)}`
        );
      }
      // Calculate sleep time until ETA is reached
      const sleepTime = eta.sub(new BN(Date.now() / 1000)).add(new BN(5));
      await sleep(sleepTime.toNumber() * 1000);
      // Execute the transaction after the ETA is reached
      const execTx = (
        await smalletWrapper.executeTransaction({
          transactionKey,
          owner: ownerC.publicKey,
        })
      ).addSigners(ownerC);
      await expect(
        sendTxWithSponsor(
          feePayerKeypair,
          sponsorPayer,
          sponsorMint,
          sdk.provider,
          execTx,
          0,
          baseAllowedTokens,
          cache
        )
      ).to.be.fulfilled;
      // Reload smallet data and validate the changes
      await smalletWrapper.reloadData();
      expect(smalletWrapper.data.ownerSetSeqno).to.equal(1);
      expect(smalletWrapper.data.threshold).to.bignumber.equal(threshold);
      expect(smalletWrapper.data.owners).to.deep.equal(newOwners);
    });
  });

  describe("Execute derived transaction", () => {
    const { provider } = sdk;
    const ownerA = web3.Keypair.generate();
    const ownerB = web3.Keypair.generate();

    const owners = [
      ownerA.publicKey,
      ownerB.publicKey,
      provider.wallet.publicKey,
    ];
    let smalletWrapper: SmalletWrapper;

    let sponsorPayer: Keypair;
    let sponsorTokenAccount: PublicKey;
    before(async () => {
      // We shouldn't airdrop any SOL to this keypair
      sponsorPayer = Keypair.generate();
      sponsorTokenAccount = await createAccount(
        connection,
        feePayerKeypair,
        sponsorMint,
        sponsorPayer.publicKey
      );

      await mintTo(
        connection,
        feePayerKeypair,
        sponsorMint,
        sponsorTokenAccount,
        feePayerKeypair.publicKey,
        5000000
      );
    });

    before(async () => {
      // Create a new smallet with specified parameters
      const { smalletWrapper: wrapperInner, tx } = await sdk.newSmallet({
        numOwners: owners.length,
        owners,
        numGuadians: owners.length,
        guadians: owners,
        threshold: new BN(1),
        payer: feePayerKeypair.publicKey,
      });
      const space = getSmalletSpaceSize(owners.length, owners.length);
      await expect(
        sendTxWithSponsor(
          feePayerKeypair,
          sponsorPayer,
          sponsorMint,
          sdk.provider,
          tx,
          space,
          baseAllowedTokens,
          cache
        )
      ).to.be.fulfilled;
      smalletWrapper = wrapperInner;
    });
    // Test function for transferring lamports from the smallet
    it("Can transfer lamports from smallet", async () => {
      const { provider, key } = smalletWrapper;
      // Specify the index for deriving the wallet address
      const index = 0;
      // Find the derived wallet address using the specified index
      const [derivedWalletKey] = await findWalletDerivedAddress(key, index);
      // Transfer lamports from the provider's wallet to the derived wallet
      const tx1 = new TransactionEnvelope(provider, [
        SystemProgram.transfer({
          fromPubkey: provider.wallet.publicKey,
          toPubkey: derivedWalletKey,
          lamports: LAMPORTS_PER_SOL,
        }),
      ]);
      await expectTX(tx1, "transfer lamports to smallet").to.be.fulfilled;
      // Generate a receiver's public key for testing
      const receiver = Keypair.generate().publicKey;
      // Create an instruction to transfer lamports from the derived wallet to the receiver
      const ix = SystemProgram.transfer({
        fromPubkey: derivedWalletKey,
        toPubkey: receiver,
        lamports: LAMPORTS_PER_SOL,
      });
      // Create a new transaction and transaction key for the transfer instruction
      const { transactionKey, tx: tx2 } = await smalletWrapper.newTransaction({
        proposer: provider.wallet.publicKey,
        instructions: [ix],
        payer: feePayerKeypair.publicKey,
      });
      tx2.signers.push((provider.wallet as unknown as NodeWallet).payer);
      const space = getTransactionSpaceSize([ix], owners.length);
      await expect(
        sendTxWithSponsor(
          feePayerKeypair,
          sponsorPayer,
          sponsorMint,
          provider,
          tx2,
          space,
          baseAllowedTokens,
          cache
        )
      ).to.be.fulfilled;
      // Validate that the balance of the derived wallet has the expected amount of lamports
      expect(await provider.connection.getBalance(derivedWalletKey)).to.eq(
        LAMPORTS_PER_SOL
      );

      // Execute the transaction using the transaction key and derived wallet index
      const tx3 = await smalletWrapper.executeTransactionDerived({
        transactionKey,
        walletIndex: index,
      });
      tx3.signers.push((provider.wallet as unknown as NodeWallet).payer);
      await expect(
        sendTxWithSponsor(
          feePayerKeypair,
          sponsorPayer,
          sponsorMint,
          sdk.provider,
          tx3,
          0,
          baseAllowedTokens,
          cache
        )
      ).to.be.fulfilled;
      // Validate that the balance of the receiver has the expected amount of lamports
      expect(await provider.connection.getBalance(receiver)).to.eq(
        LAMPORTS_PER_SOL
      );
    });
  });

  describe("Owner Invoker", () => {
    const { provider } = sdk;
    const ownerA = web3.Keypair.generate();
    const ownerB = web3.Keypair.generate();

    const owners = [
      ownerA.publicKey,
      ownerB.publicKey,
      provider.wallet.publicKey,
    ];
    let smalletWrapper: SmalletWrapper;

    let sponsorPayer: Keypair;
    let sponsorTokenAccount: PublicKey;
    before(async () => {
      // We shouldn't airdrop any SOL to this keypair
      sponsorPayer = Keypair.generate();
      sponsorTokenAccount = await createAccount(
        connection,
        feePayerKeypair,
        sponsorMint,
        sponsorPayer.publicKey
      );

      await mintTo(
        connection,
        feePayerKeypair,
        sponsorMint,
        sponsorTokenAccount,
        feePayerKeypair.publicKey,
        5000000
      );
    });

    beforeEach(async () => {
      // Create a new smallet with specified parameters
      const { smalletWrapper: wrapperInner, tx } = await sdk.newSmallet({
        numOwners: owners.length,
        owners,
        numGuadians: owners.length,
        guadians: owners,
        threshold: new BN(1),
        payer: feePayerKeypair.publicKey,
      });
      const space = getSmalletSpaceSize(owners.length, owners.length);
      await expect(
        sendTxWithSponsor(
          feePayerKeypair,
          sponsorPayer,
          sponsorMint,
          sdk.provider,
          tx,
          space,
          baseAllowedTokens,
          cache
        )
      ).to.be.fulfilled;

      smalletWrapper = wrapperInner;
    });
    // Test function to invoke 1 of N
    it("should invoke 1 of N", async () => {
      const index = 5;
      // Find the owner invoker address using the specified index
      const [invokerKey] = await smalletWrapper.findOwnerInvokerAddress(index);
      // Request an airdrop of lamports to the invoker's key
      await new PendingTransaction(
        provider.connection,
        await provider.connection.requestAirdrop(invokerKey, LAMPORTS_PER_SOL)
      ).wait();
      // Create an invoke instruction for transferring lamports to the smallet
      const invokeTX = await smalletWrapper.ownerInvokeInstruction({
        index,
        instruction: SystemProgram.transfer({
          fromPubkey: invokerKey,
          toPubkey: provider.wallet.publicKey,
          lamports: LAMPORTS_PER_SOL,
        }),
      });
      invokeTX.signers.push((provider.wallet as unknown as NodeWallet).payer);
      await expect(
        sendTxWithSponsor(
          feePayerKeypair,
          sponsorPayer,
          sponsorMint,
          provider,
          invokeTX,
          0,
          baseAllowedTokens,
          cache
        )
      ).to.be.fulfilled;

      // Create a subaccount info for the invoker key associated with the wrong smallet
      let tx = await sdk.createSubaccountInfo({
        smallet: invokerKey,
        index,
        type: "ownerInvoker",
        payer: feePayerKeypair.publicKey,
      });
      const space = getSubAccountSpaceSize();
      await expect(
        sendTxWithSponsor(
          feePayerKeypair,
          sponsorPayer,
          sponsorMint,
          provider,
          tx,
          space,
          baseAllowedTokens,
          cache
        )
      ).to.be.fulfilled;
      // Find the subaccount info address for the invoker key
      const [infoKey] = await findSubaccountInfoAddress(invokerKey);
      // Fetch the subaccount info and expect it to be null
      const info =
        await sdk.programs.Smallet.account.subaccountInfo.fetchNullable(
          infoKey
        );
      expect(info).to.be.null;

      // Create a subaccount info for the invoker key associated with the correct smallet
      tx = await sdk.createSubaccountInfo({
        smallet: smalletWrapper.key,
        index,
        type: "ownerInvoker",
        payer: feePayerKeypair.publicKey,
      });
      await expect(
        sendTxWithSponsor(
          feePayerKeypair,
          sponsorPayer,
          sponsorMint,
          provider,
          tx,
          space,
          baseAllowedTokens,
          cache
        )
      ).to.be.fulfilled;
      // Fetch the subaccount info and validate its properties
      const info2 = await sdk.programs.Smallet.account.subaccountInfo.fetch(
        infoKey
      );
      expect(info2.index).to.bignumber.eq(index.toString());
      expect(info2.smallet).to.eqAddress(smalletWrapper.key);
      expect(info2.subaccountType).to.deep.eq({ ownerInvoker: {} });
    });
    // Test function to invoke 1 of N (v2)
    it("should invoke 1 of N (v2)", async () => {
      const index = 5;
      // Find the owner invoker address using the specified index
      const [invokerKey] = await smalletWrapper.findOwnerInvokerAddress(index);
      // Request an airdrop of lamports to the invoker's key
      await new PendingTransaction(
        provider.connection,
        await provider.connection.requestAirdrop(invokerKey, LAMPORTS_PER_SOL)
      ).wait();
      // Create an invoke instruction (v2) for transferring lamports to the smallet
      let invokeTX = await smalletWrapper.ownerInvokeInstructionV2({
        index,
        instruction: SystemProgram.transfer({
          fromPubkey: invokerKey,
          toPubkey: provider.wallet.publicKey,
          lamports: LAMPORTS_PER_SOL,
        }),
      });
      invokeTX.signers.push((provider.wallet as unknown as NodeWallet).payer);
      await expect(
        sendTxWithSponsor(
          feePayerKeypair,
          sponsorPayer,
          sponsorMint,
          provider,
          invokeTX,
          0,
          baseAllowedTokens,
          cache
        )
      ).to.be.fulfilled;
      // Create a subaccount info for the invoker key associated with the wrong smallet
      invokeTX = await sdk.createSubaccountInfo({
        smallet: invokerKey,
        index,
        type: "ownerInvoker",
        payer: feePayerKeypair.publicKey,
      });
      let space = getSubAccountSpaceSize();
      await expect(
        sendTxWithSponsor(
          feePayerKeypair,
          sponsorPayer,
          sponsorMint,
          provider,
          invokeTX,
          space,
          baseAllowedTokens,
          cache
        )
      ).to.be.fulfilled;
      // Find the subaccount info address for the invoker key
      const [infoKey] = await findSubaccountInfoAddress(invokerKey);
      // Fetch the subaccount info and expect it to be null
      const info =
        await sdk.programs.Smallet.account.subaccountInfo.fetchNullable(
          infoKey
        );
      expect(info).to.be.null;
      // Create a subaccount info for the invoker key associated with the correct smallet
      invokeTX = await sdk.createSubaccountInfo({
        smallet: smalletWrapper.key,
        index,
        type: "ownerInvoker",
        payer: feePayerKeypair.publicKey,
      });
      space = getSubAccountSpaceSize();
      await expect(
        sendTxWithSponsor(
          feePayerKeypair,
          sponsorPayer,
          sponsorMint,
          provider,
          invokeTX,
          space,
          baseAllowedTokens,
          cache
        )
      ).to.be.fulfilled;

      // Fetch the subaccount info and validate its properties
      const info2 = await sdk.programs.Smallet.account.subaccountInfo.fetch(
        infoKey
      );
      expect(info2.index).to.bignumber.eq(index.toString());
      expect(info2.smallet).to.eqAddress(smalletWrapper.key);
      expect(info2.subaccountType).to.deep.eq({ ownerInvoker: {} });
    });
    // Test function to invoke large TX (v2)
    it("invoke large TX (v2)", async () => {
      const index = 5;
      // Find the owner invoker address using the specified index
      const [invokerKey, invokerBump] =
        await smalletWrapper.findOwnerInvokerAddress(index);
      // Request an airdrop of lamports to the invoker's key
      await new PendingTransaction(
        provider.connection,
        await provider.connection.requestAirdrop(invokerKey, LAMPORTS_PER_SOL)
      ).wait();
      // Create the instruction to transfer lamports from the invoker to the provider's wallet
      const instructionToExecute = SystemProgram.transfer({
        fromPubkey: invokerKey,
        toPubkey: provider.wallet.publicKey,
        lamports: LAMPORTS_PER_SOL,
      });
      // Construct the ownerInvokeInstructionV2 instruction
      const ix = sdk.programs.Smallet.instruction.ownerInvokeInstructionV2(
        new BN(index),
        invokerBump,
        invokerKey,
        instructionToExecute.data,
        {
          accounts: {
            smallet: smalletWrapper.key,
            owner: ownerA.publicKey,
          },
          remainingAccounts: [
            {
              pubkey: instructionToExecute.programId,
              isSigner: false,
              isWritable: false,
            },
            // Modify the keys of the instruction, excluding the invoker key as signer
            ...instructionToExecute.keys.map((k) => {
              if (k.isSigner && invokerKey.equals(k.pubkey)) {
                return {
                  ...k,
                  isSigner: false,
                };
              }
              return k;
            }),
            // Add 17 dummy keys for the remaining accounts
            ...new Array(17).fill(null).map(() => ({
              pubkey: Keypair.generate().publicKey,
              isSigner: false,
              isWritable: false,
            })),
          ],
        }
      );
      // Create a transaction envelope with the constructed instruction
      let tx = new TransactionEnvelope(smalletWrapper.provider, [ix], [ownerA]);
      await expect(
        sendTxWithSponsor(
          feePayerKeypair,
          sponsorPayer,
          sponsorMint,
          provider,
          tx,
          0,
          baseAllowedTokens,
          cache
        )
      ).to.be.fulfilled;
      // Create a subaccount info for the invoker key associated with the wrong smallet
      tx = await sdk.createSubaccountInfo({
        smallet: invokerKey,
        index,
        type: "ownerInvoker",
        payer: feePayerKeypair.publicKey,
      });
      const space = getSubAccountSpaceSize();
      await expect(
        sendTxWithSponsor(
          feePayerKeypair,
          sponsorPayer,
          sponsorMint,
          provider,
          tx,
          space,
          baseAllowedTokens,
          cache
        )
      ).to.be.fulfilled;
      // Find the subaccount info address for the invoker key
      const [infoKey] = await findSubaccountInfoAddress(invokerKey);
      // Fetch the subaccount info and expect it to be null
      const info =
        await sdk.programs.Smallet.account.subaccountInfo.fetchNullable(
          infoKey
        );
      expect(info).to.be.null;
      // Create a subaccount info for the invoker key associated with the correct smallet
      tx = await sdk.createSubaccountInfo({
        smallet: smalletWrapper.key,
        index,
        type: "ownerInvoker",
        payer: feePayerKeypair.publicKey,
      });
      await expect(
        sendTxWithSponsor(
          feePayerKeypair,
          sponsorPayer,
          sponsorMint,
          provider,
          tx,
          space,
          baseAllowedTokens,
          cache
        )
      ).to.be.fulfilled;
      // Fetch the subaccount info and validate its properties
      const info2 = await sdk.programs.Smallet.account.subaccountInfo.fetch(
        infoKey
      );
      expect(info2.index).to.bignumber.eq(index.toString());
      expect(info2.smallet).to.eqAddress(smalletWrapper.key);
      expect(info2.subaccountType).to.deep.eq({ ownerInvoker: {} });
    });

    it("invalid invoker should fail (v2)", async () => {
      // Define the index of the invoker
      const index = 0;
      // Find the invoker key associated with the specified index
      const [invokerKey] = await smalletWrapper.findOwnerInvokerAddress(index);
      // Create an instruction to execute a memo with the invoker key as a signer
      const instructionToExecute = createMemoInstruction("hello", [invokerKey]);
      // Generate a fake invoker key and its associated invoker bump value
      const [fakeInvoker, invokerBump] = [Keypair.generate(), 254];
      const fakeInvokerKey = fakeInvoker.publicKey;
      // Construct the ownerInvokeInstructionV2 instruction with the fake invoker
      const ix = sdk.programs.Smallet.instruction.ownerInvokeInstructionV2(
        new BN(index),
        invokerBump,
        fakeInvokerKey,
        instructionToExecute.data,
        {
          accounts: {
            smallet: smalletWrapper.key,
            owner: ownerA.publicKey,
          },
          remainingAccounts: [
            {
              pubkey: instructionToExecute.programId,
              isSigner: false,
              isWritable: false,
            },
            // Modify the keys of the instruction, excluding the invoker key as signer
            ...instructionToExecute.keys.map((k) => {
              if (k.isSigner && invokerKey.equals(k.pubkey)) {
                return {
                  ...k,
                  isSigner: false,
                };
              }
              return k;
            }),
          ],
        }
      );
      // Create a transaction envelope with the constructed instruction
      const tx = new TransactionEnvelope(
        smalletWrapper.provider,
        [ix],
        [ownerA]
      );
      // Expect the transaction to be rejected with a specific error message
      try {
        await sendTxWithSponsor(
          feePayerKeypair,
          sponsorPayer,
          sponsorMint,
          provider,
          tx,
          0,
          baseAllowedTokens,
          cache
        );
      } catch (e) {
        const err = e as Error;
        if (err.message.indexOf("failed: Program failed to complete") > -1)
          expect(err.message).to.include(
            `Provided seeds do not result in a valid address`
          );
        else
          expect(err.message).to.include(
            "failed: missing required signature for instruction"
          );
      }
    });
  });

  describe("Session for Auto-Sign", () => {
    const { provider } = sdk;

    const ownerA = web3.Keypair.generate();
    const ownerB = web3.Keypair.generate();
    const ownerC = web3.Keypair.generate();
    // Create an array of owner public keys
    const owners = [
      ownerA.publicKey,
      ownerB.publicKey,
      ownerC.publicKey,
      provider.wallet.publicKey,
    ];

    let smalletWrapper: SmalletWrapper;

    let sponsorPayer: Keypair;
    let sponsorTokenAccount: PublicKey;
    before(async () => {
      // We shouldn't airdrop any SOL to this keypair
      sponsorPayer = Keypair.generate();
      sponsorTokenAccount = await createAccount(
        connection,
        feePayerKeypair,
        sponsorMint,
        sponsorPayer.publicKey
      );

      await mintTo(
        connection,
        feePayerKeypair,
        sponsorMint,
        sponsorTokenAccount,
        feePayerKeypair.publicKey,
        5000000
      );
    });

    before(async () => {
      // Create a new smallet with specified parameters
      const { smalletWrapper: wrapperInner, tx } = await sdk.newSmallet({
        numOwners: owners.length,
        owners,
        numGuadians: owners.length,
        guadians: owners,
        threshold: new BN(3),
        payer: feePayerKeypair.publicKey,
      });
      const space = getSmalletSpaceSize(owners.length, owners.length);
      await expect(
        sendTxWithSponsor(
          feePayerKeypair,
          sponsorPayer,
          sponsorMint,
          provider,
          tx,
          space,
          baseAllowedTokens,
          cache
        )
      ).to.be.fulfilled;
      smalletWrapper = wrapperInner;
    });

    // Test the initial state
    it("Test initial owners sessions", async () => {
      await smalletWrapper.reloadData();
      // Ensure the smallet was created
      invariant(smalletWrapper.data, "smallet was not created");
      // Verify the threshold and owners match the expected values
      expect(smalletWrapper.data.threshold).to.be.bignumber.equal(new BN(3));
      expect(smalletWrapper.data.owners).to.deep.equal(owners);
      expect(smalletWrapper.data.ownerSessions).to.deep.equal(
        new Array(4).fill(new BN(-1))
      );
    });

    // Attempt failed execution
    it("Test threshold changed with insufficient sigs", async () => {
      const newThreshold = new u64(1);
      const data = program.coder.instruction.encode("change_threshold", {
        threshold: newThreshold,
      });

      const instruction = new TransactionInstruction({
        programId: program.programId,
        keys: [
          {
            pubkey: smalletWrapper.key,
            isWritable: true,
            isSigner: true,
          },
        ],
        data,
      });
      // Create a new transaction to change the threshold
      const { tx, transactionKey } = await smalletWrapper.newTransaction({
        proposer: ownerA.publicKey,
        instructions: [instruction],
        payer: feePayerKeypair.publicKey,
      });
      // Sign the transaction with ownerA
      tx.signers.push(ownerA);
      const space = getTransactionSpaceSize([instruction], owners.length);
      await expect(
        sendTxWithSponsor(
          feePayerKeypair,
          sponsorPayer,
          sponsorMint,
          provider,
          tx,
          space,
          baseAllowedTokens,
          cache
        )
      ).to.be.fulfilled;

      // Sleep to make sure transaction creation was finalized
      await sleep(750);

      // Other owner (ownerB) approves the transaction
      const appTx = smalletWrapper
        .approveTransaction(transactionKey, ownerB.publicKey)
        .addSigners(ownerB);
      await expect(
        sendTxWithSponsor(
          feePayerKeypair,
          sponsorPayer,
          sponsorMint,
          provider,
          appTx,
          0,
          baseAllowedTokens,
          cache
        )
      ).to.be.fulfilled;

      // Fetch the transaction account associated with transactionKey
      const txAccount = await smalletWrapper.fetchTransaction(transactionKey);
      // Validate transaction account properties
      expect(txAccount.executedAt.toNumber()).to.equal(-1);
      expect(txAccount.ownerSetSeqno).to.equal(0);
      expect(txAccount.smallet).to.eqAddress(smalletWrapper.key);
      expect(txAccount.signers).to.deep.equal([true, true, false, false]);

      // Attempt to execute the transaction with insufficient signers
      const execTx = await smalletWrapper.executeTransaction({
        transactionKey,
        owner: ownerA.publicKey,
      });
      execTx.addSigners(ownerA);

      try {
        await sendTxWithSponsor(
          feePayerKeypair,
          sponsorPayer,
          sponsorMint,
          provider,
          execTx,
          0,
          baseAllowedTokens,
          cache
        );
      } catch (e) {
        const err = e as Error;
        expect(err.message).to.include(
          `0x${SmalletErrors.NotEnoughSigners.code.toString(16)}`
        );
      }
    });

    // Test for owner auto-sign session
    it("Test transaction execution with session", async () => {
      // Grant auto-sign permission to smallet for an owner (OwnerC)
      let tx = smalletWrapper
        .setSession({
          expiresAt: new BN(Date.now() / 1000 + 20), // added 20s more for sponsor pay awaiting time * 2
          owner: ownerC.publicKey,
        })
        .addSigners(ownerC);
      await expect(
        sendTxWithSponsor(
          feePayerKeypair,
          sponsorPayer,
          sponsorMint,
          provider,
          tx,
          0,
          baseAllowedTokens,
          cache
        )
      ).to.be.fulfilled;

      // Sleep to make sure smallet update was finalized
      await sleep(750);

      // Reload smallet data and validate sessions
      await smalletWrapper.reloadData();
      expect(
        smalletWrapper.data?.ownerSessions.filter((session) =>
          session.gt(new BN(-1))
        ).length
      ).to.equal(1);

      const [transactionKey] = await findTransactionAddress(
        smalletWrapper.key,
        0
      );

      let txAccount = await smalletWrapper.fetchTransaction(transactionKey);
      // Validate transaction account properties
      expect(txAccount.executedAt.toNumber()).to.equal(-1);
      expect(txAccount.signers).to.deep.equal([true, true, false, false]);

      // Execute again after have a auto-signed owner
      tx = await smalletWrapper.executeTransaction({
        transactionKey,
        owner: ownerA.publicKey,
      });
      tx.addSigners(ownerA);

      await expect(
        sendTxWithSponsor(
          feePayerKeypair,
          sponsorPayer,
          sponsorMint,
          provider,
          tx,
          0,
          baseAllowedTokens,
          cache
        )
      ).to.be.fulfilled;

      // Sleep to make sure transaction status updated
      await sleep(750);

      // Reload smallet data and validate threshold
      await smalletWrapper.reloadData();
      txAccount = await smalletWrapper.fetchTransaction(transactionKey);
      // Validate transaction account properties
      expect(txAccount.executedAt.toNumber()).to.gt(-1);
      // Signers count still same cause used auto-sign for last Tx
      expect(txAccount.signers).to.deep.equal([true, true, false, false]);
      expect(smalletWrapper.data?.threshold).to.bignumber.eq(new BN(1));
    });

    // Attempt failed execution due to expires session
    it("Test session expires", async () => {
      const newThreshold = new u64(2);
      const data = program.coder.instruction.encode("change_threshold", {
        threshold: newThreshold,
      });

      const instruction = new TransactionInstruction({
        programId: program.programId,
        keys: [
          {
            pubkey: smalletWrapper.key,
            isWritable: true,
            isSigner: true,
          },
        ],
        data,
      });
      // Create one more transaction to change the threshold again
      const { tx, transactionKey } = await smalletWrapper.newTransaction({
        proposer: ownerA.publicKey,
        instructions: [instruction],
        payer: feePayerKeypair.publicKey,
      });
      // Sign the transaction with ownerA
      tx.signers.push(ownerA);
      const space = getTransactionSpaceSize([instruction], owners.length);
      await expect(
        sendTxWithSponsor(
          feePayerKeypair,
          sponsorPayer,
          sponsorMint,
          provider,
          tx,
          space,
          baseAllowedTokens,
          cache
        )
      ).to.be.fulfilled;

      await sleep(750);

      // Other owner (ownerB) approves the transaction
      const appTx = smalletWrapper
        .approveTransaction(transactionKey, ownerB.publicKey)
        .addSigners(ownerB);
      await expect(
        sendTxWithSponsor(
          feePayerKeypair,
          sponsorPayer,
          sponsorMint,
          provider,
          appTx,
          0,
          baseAllowedTokens,
          cache
        )
      ).to.be.fulfilled;

      // Fetch the transaction account associated with transactionKey
      const txAccount = await smalletWrapper.fetchTransaction(transactionKey);
      // Validate transaction account properties
      expect(txAccount.executedAt.toNumber()).to.equal(-1);
      expect(txAccount.smallet).to.eqAddress(smalletWrapper.key);
      expect(txAccount.signers).to.deep.equal([true, true, false, false]);

      // Sleep to wait until an owner's session expired
      await sleep(10000);

      // Attempt to execute the transaction after an owner's auto-sign session expired
      const execTx = await smalletWrapper.executeTransaction({
        transactionKey,
        owner: ownerA.publicKey,
      });
      execTx.addSigners(ownerA);

      try {
        sendTxWithSponsor(
          feePayerKeypair,
          sponsorPayer,
          sponsorMint,
          provider,
          execTx,
          0,
          baseAllowedTokens,
          cache
        );
      } catch (e) {
        const err = e as Error;
        expect(err.message).to.include(
          `0x${SmalletErrors.NotEnoughSigners.code.toString(16)}`
        );
      }
    });
  });
});
