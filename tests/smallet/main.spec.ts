import * as anchor from "@project-serum/anchor";
import { expectTX } from "@saberhq/chai-solana";
import {
  createMemoInstruction,
  PendingTransaction,
  TransactionEnvelope,
} from "@saberhq/solana-contrib";
import { sleep, u64 } from "@saberhq/token-utils";
import {
  Keypair,
  LAMPORTS_PER_SOL,
  SystemProgram,
  TransactionInstruction,
} from "@solana/web3.js";
import { expect } from "chai";
import invariant from "tiny-invariant";

import { SmalletErrors } from "../../src/idls/smallet";
import type { SmalletWrapper } from "../../src/wrappers/smallet";
import {
  findSmallet,
  findSubaccountInfoAddress,
  findTransactionAddress,
  findWalletDerivedAddress,
} from "../../src/wrappers/smallet";
import { makeSDK } from "../workspace";

// Define the smallet tests
describe("smallet", () => {
  const { BN, web3 } = anchor;
  const sdk = makeSDK();
  const program = sdk.programs.Smallet;

  describe("Tests global config of the smallet program", () => {
    const { provider } = sdk;

    before(async () => {
      const { tx } = await sdk.initializeGlobalState();
      await expectTX(tx, "Initialize global pool").to.be.fulfilled;
      await sdk.reloadGlobalData();

      expect(sdk.globalData?.globalAdmin).to.eqAddress(
        provider.wallet.publicKey
      );
    });

    it("Test admin authority transfer", async () => {
      const { tx } = await sdk.transferGlobalAdmin(provider.wallet.publicKey);
      await expectTX(tx, "Transfer global admin").to.be.fulfilled;
      await sdk.reloadGlobalData();

      expect(sdk.globalData?.globalAdmin).to.eqAddress(
        provider.wallet.publicKey
      );
    });

    it("Test global thresholds change as global admin", async () => {
      const { tx } = await sdk.setGlobalThresholds({
        changePeriod: 36,
      });
      await expectTX(tx, "Change guadians change period").to.be.fulfilled;
      await sdk.reloadGlobalData();

      expect(sdk.globalData?.guadiansChangePeriod).to.be.bignumber.equal(
        new BN(36)
      );
    });
  });

  // Test the smallet program
  describe("Tests the smallet program", () => {
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

    let smalletWrapper: SmalletWrapper;
    before(async () => {
      // Create a new smallet
      const { smalletWrapper: wrapperInner, tx } = await sdk.newSmallet({
        numOwners,
        owners,
        numGuadians: numOwners,
        guadians: owners,
        threshold,
        base: smalletBase,
      });
      // Ensure the creation of smallet is successful
      await expectTX(tx, "create new smallet").to.be.fulfilled;
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
          instructions: [instruction],
        });
      // proposeTx is a transaction to be processed by the smallet, signed by ownerA
      proposeTx.signers.push(ownerA);
      await expectTX(proposeTx, "create a tx to be processed by the smallet").to
        .be.fulfilled;
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

      // Execute the transaction since the threshold is reached
      await expectTX(
        (
          await smalletWrapper.executeTransaction({
            transactionKey,
            owner: ownerA.publicKey,
          })
        ).addSigners(ownerA),
        "execute transaction"
      ).to.be.fulfilled;
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
        await tx.confirm();
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
        await tx.confirm();
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
      });
      // Sign the transaction with ownerA
      tx.signers.push(ownerA);
      await expectTX(tx, "create new transaction");

      // Sleep to make sure transaction creation was finalized
      await sleep(750);

      // Other owner (ownerB) approves the transaction
      await expectTX(
        smalletWrapper
          .approveTransaction(transactionKey, ownerB.publicKey)
          .addSigners(ownerB),
        "ownerB approves to transaction"
      ).to.be.fulfilled;

      // Execute the transaction since the threshold is reached
      await expectTX(
        (
          await smalletWrapper.executeTransaction({
            transactionKey,
            owner: ownerA.publicKey,
          })
        ).addSigners(ownerA),
        "execute transaction"
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
        await execTxDuplicate.confirm();
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

    before(async () => {
      // Create a new smallet with specified parameters
      const { smalletWrapper: wrapperInner, tx } = await sdk.newSmallet({
        numOwners,
        owners,
        threshold,
        base: smalletBase,
        numGuadians: numOwners,
        guadians: owners,
        delay,
      });
      await expectTX(tx, "create new smallet").to.be.fulfilled;
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
      });
      tx.signers.push(ownerB);
      // Test function for handling an invalid ETA
      try {
        await tx.confirm();
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
        new BN(Date.now() / 1000)
      );
      // Create a new transaction with specified parameters
      const { transactionKey, tx } = await smalletWrapper.newTransaction({
        proposer: ownerB.publicKey,
        instructions: [instruction],
        eta,
      });
      tx.signers.push(ownerB);
      await expectTX(tx, "create a tx to be processed by the smallet").to.be
        .fulfilled;
      // Attempt to execute the transaction before the ETA
      const falseStartTx = await smalletWrapper.executeTransaction({
        transactionKey,
        owner: ownerA.publicKey,
      });
      falseStartTx.addSigners(ownerA);
      try {
        await falseStartTx.confirm();
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
      await expectTX(
        (
          await smalletWrapper.executeTransaction({
            transactionKey,
            owner: ownerC.publicKey,
          })
        ).addSigners(ownerC),
        "execute transaction"
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

    before(async () => {
      // Create a new smallet with specified parameters
      const { smalletWrapper: wrapperInner, tx } = await sdk.newSmallet({
        numOwners: owners.length,
        owners,
        numGuadians: owners.length,
        guadians: owners,
        threshold: new BN(1),
      });
      await expectTX(tx, "create new smallet").to.be.fulfilled;
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
      });
      await expectTX(
        tx2,
        "queue transaction to transfer lamports out of smallet"
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
      await expectTX(tx3, "execute transaction derived").to.be.fulfilled;
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

    beforeEach(async () => {
      // Create a new smallet with specified parameters
      const { smalletWrapper: wrapperInner, tx } = await sdk.newSmallet({
        numOwners: owners.length,
        owners,
        numGuadians: owners.length,
        guadians: owners,
        threshold: new BN(1),
      });
      await expectTX(tx, "create new smallet").to.be.fulfilled;
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
      await expectTX(invokeTX, "transfer lamports to smallet").to.be.fulfilled;
      // Create a subaccount info for the invoker key associated with the wrong smallet
      await expectTX(
        await sdk.createSubaccountInfo({
          smallet: invokerKey,
          index,
          type: "ownerInvoker",
        }),
        "create wrong subaccount info"
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
      await expectTX(
        await sdk.createSubaccountInfo({
          smallet: smalletWrapper.key,
          index,
          type: "ownerInvoker",
        }),
        "create subaccount info"
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
      const invokeTX = await smalletWrapper.ownerInvokeInstructionV2({
        index,
        instruction: SystemProgram.transfer({
          fromPubkey: invokerKey,
          toPubkey: provider.wallet.publicKey,
          lamports: LAMPORTS_PER_SOL,
        }),
      });
      await expectTX(invokeTX, "transfer lamports to smallet").to.be.fulfilled;
      // Create a subaccount info for the invoker key associated with the wrong smallet
      await expectTX(
        await sdk.createSubaccountInfo({
          smallet: invokerKey,
          index,
          type: "ownerInvoker",
        }),
        "create wrong subaccount info"
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
      await expectTX(
        await sdk.createSubaccountInfo({
          smallet: smalletWrapper.key,
          index,
          type: "ownerInvoker",
        }),
        "create subaccount info"
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
            // Add 24 dummy keys for the remaining accounts
            ...new Array(24).fill(null).map(() => ({
              pubkey: Keypair.generate().publicKey,
              isSigner: false,
              isWritable: false,
            })),
          ],
        }
      );
      // Create a transaction envelope with the constructed instruction
      const tx = new TransactionEnvelope(
        smalletWrapper.provider,
        [ix],
        [ownerA]
      );
      await expectTX(tx, "transfer lamports to smallet").to.be.fulfilled;
      // Create a subaccount info for the invoker key associated with the wrong smallet
      await expectTX(
        await sdk.createSubaccountInfo({
          smallet: invokerKey,
          index,
          type: "ownerInvoker",
        }),
        "create wrong subaccount info"
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
      await expectTX(
        await sdk.createSubaccountInfo({
          smallet: smalletWrapper.key,
          index,
          type: "ownerInvoker",
        }),
        "create subaccount info"
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
      await expectTX(tx).to.be.rejectedWith(
        "failed to send transaction: Transaction simulation failed: Error processing Instruction 0"
      );
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

    before(async () => {
      // Create a new smallet with specified parameters
      const { smalletWrapper: wrapperInner, tx } = await sdk.newSmallet({
        numOwners: owners.length,
        owners,
        numGuadians: owners.length,
        guadians: owners,
        threshold: new BN(3),
      });
      await expectTX(tx, "create new smallet").to.be.fulfilled;
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
      });
      // Sign the transaction with ownerA
      tx.signers.push(ownerA);
      await expectTX(tx, "create new transaction");

      // Sleep to make sure transaction creation was finalized
      await sleep(750);

      // Other owner (ownerB) approves the transaction
      await expectTX(
        smalletWrapper
          .approveTransaction(transactionKey, ownerB.publicKey)
          .addSigners(ownerB),
        "ownerB approves to transaction"
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
        await execTx.confirm();
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
      await expectTX(
        smalletWrapper
          .setSession({
            expiresAt: new BN(Date.now() / 1000 + 10),
            owner: ownerC.publicKey,
          })
          .addSigners(ownerC),
        "grant auto-sign"
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
      await expectTX(
        (
          await smalletWrapper.executeTransaction({
            transactionKey,
            owner: ownerA.publicKey,
          })
        ).addSigners(ownerA),
        "execute transaction"
      );

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
      });
      // Sign the transaction with ownerA
      tx.signers.push(ownerA);
      await expectTX(tx, "create new transaction");

      await sleep(750);

      // Other owner (ownerB) approves the transaction
      await expectTX(
        smalletWrapper
          .approveTransaction(transactionKey, ownerB.publicKey)
          .addSigners(ownerB),
        "ownerB approves to transaction"
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
        await execTx.confirm();
      } catch (e) {
        const err = e as Error;
        expect(err.message).to.include(
          `0x${SmalletErrors.NotEnoughSigners.code.toString(16)}`
        );
      }
    });
  });

  describe("Set Frozen Smallet", () => {
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

    before(async () => {
      // Create a new smallet with specified parameters
      const { smalletWrapper: wrapperInner, tx } = await sdk.newSmallet({
        numOwners: owners.length,
        owners,
        numGuadians: owners.length,
        guadians: owners,
        threshold: new BN(2),
      });
      await expectTX(tx, "create new smallet").to.be.fulfilled;

      smalletWrapper = wrapperInner;

      await smalletWrapper.reloadData();
      invariant(smalletWrapper.data, "smallet was not created");
      expect(smalletWrapper.data.frozen).to.be.equal(false);
    });

    it("Test freeze smallet", async () => {
      const data = program.coder.instruction.encode("set_frozen", {
        frozen: true,
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
      });
      // Sign the transaction with ownerA
      tx.signers.push(ownerA);
      await expectTX(tx, "create new transaction");

      // Sleep to make sure transaction creation was finalized
      await sleep(750);

      // Other owner (ownerB) approves the transaction
      await expectTX(
        smalletWrapper
          .approveTransaction(transactionKey, ownerB.publicKey)
          .addSigners(ownerB),
        "ownerB approves to transaction"
      ).to.be.fulfilled;

      // Attempt to execute the transaction with insufficient signers
      const execTx = await smalletWrapper.executeTransaction({
        transactionKey,
        owner: ownerA.publicKey,
      });
      execTx.addSigners(ownerA);

      await expectTX(execTx, "execute transaction").to.be.fulfilled;

      // Ensure the smallet was frozen
      await smalletWrapper.reloadData();
      invariant(smalletWrapper.data, "smallet was not created");
      expect(smalletWrapper.data.frozen).to.be.equal(true);
    });

    // Attempt failed execution due to frozen
    it("Test action against frozen smallet", async () => {
      const newThreshold = new u64(3);
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
      const { tx } = await smalletWrapper.newTransaction({
        proposer: ownerA.publicKey,
        instructions: [instruction],
      });
      // Sign the transaction with ownerA
      tx.signers.push(ownerA);

      try {
        await tx.confirm();
      } catch (e) {
        const err = e as Error;
        expect(err.message).to.include(
          `0x${SmalletErrors.AccountFrozen.code.toString(16)}`
        );
      }
    });

    it("Test unfreeze smallet as admin", async () => {
      // Create a new transaction to change the threshold
      const tx = await smalletWrapper.setFrozenAdmin({
        admin: provider.wallet.publicKey,
        frozen: false,
      });
      await expectTX(tx, "unfreeze smallet");
      await sleep(750);
      // Ensure the smallet was thaw
      await smalletWrapper.reloadData();
      invariant(smalletWrapper.data, "smallet was not created");
      expect(smalletWrapper.data.frozen).to.be.equal(false);
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
      await expectTX(invokeTX, "transfer lamports to smallet").to.be.fulfilled;
      // Create a subaccount info for the invoker key associated with the wrong smallet
      await expectTX(
        await sdk.createSubaccountInfo({
          smallet: invokerKey,
          index,
          type: "ownerInvoker",
        }),
        "create wrong subaccount info"
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
      await expectTX(
        await sdk.createSubaccountInfo({
          smallet: smalletWrapper.key,
          index,
          type: "ownerInvoker",
        }),
        "create subaccount info"
      ).to.be.fulfilled;
      // Fetch the subaccount info and validate its properties
      const info2 = await sdk.programs.Smallet.account.subaccountInfo.fetch(
        infoKey
      );
      expect(info2.index).to.bignumber.eq(index.toString());
      expect(info2.smallet).to.eqAddress(smalletWrapper.key);
      expect(info2.subaccountType).to.deep.eq({ ownerInvoker: {} });
    });
  });
});
