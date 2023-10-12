import type { AugmentedProvider } from "@saberhq/solana-contrib";
import { TransactionEnvelope } from "@saberhq/solana-contrib";
import type { PublicKey, TransactionInstruction } from "@solana/web3.js";
import { SystemProgram } from "@solana/web3.js";
import BN from "bn.js";

import type {
  GuadianActionData,
  SmalletData,
  SmalletProgram,
  SmalletTransactionData,
} from "../../programs";
import type { SMALLETSDK } from "../../sdk";
import {
  findGlobalState,
  findGuadianActionAddress,
  findOwnerInvokerAddress,
  findTransactionAddress,
  findWalletDerivedAddress,
} from "./pda";
import {
  GuadianActionType,
  InitSmalletWrapperArgs,
  NewTransactionArgs,
  PendingSmalletGuadianAction,
  PendingSmalletTransaction,
} from "./types";

export * from "./pda";
export * from "./types";

export class SmalletWrapper {
  readonly bump: number;
  readonly key: PublicKey;
  readonly program: SmalletProgram;
  private _data?: SmalletData;

  constructor(readonly sdk: SMALLETSDK, args: InitSmalletWrapperArgs) {
    this.bump = args.bump;
    this.key = args.key;
    this._data = args.data;
    this.program = sdk.programs.Smallet;
  }

  get provider(): AugmentedProvider {
    return this.sdk.provider;
  }

  get data(): SmalletData | undefined {
    return this._data;
  }

  async reloadData(): Promise<SmalletData> {
    this._data = await this.sdk.programs.Smallet.account.smallet.fetch(
      this.key
    );
    return this._data;
  }

  /***Proposes a new transaction */

  async newTransaction({
    proposer = this.provider.wallet.publicKey,
    payer = this.provider.wallet.publicKey,
    instructions: ixs,
    eta,
  }: NewTransactionArgs): Promise<PendingSmalletTransaction> {
    const index = (await this.reloadData()).numTransactions.toNumber();
    const [txKey, txBump] = await findTransactionAddress(this.key, index);
    const accounts = {
      smallet: this.key,
      transaction: txKey,
      proposer,
      payer,
      systemProgram: SystemProgram.programId,
    };
    const instructions: TransactionInstruction[] = [];
    if (eta === undefined) {
      instructions.push(
        this.program.instruction.createTransaction(txBump, ixs, {
          accounts,
        })
      );
    } else {
      instructions.push(
        this.program.instruction.createTransactionWithTimelock(
          txBump,
          ixs,
          eta,
          {
            accounts,
          }
        )
      );
    }

    return {
      transactionKey: txKey,
      tx: new TransactionEnvelope(this.provider, instructions),
      index,
    };
  }
  /**Creates a new transaction from an envelope */

  async newTransactionFromEnvelope({
    tx,
    ...args
  }: Omit<NewTransactionArgs, "instructions"> & {
    tx: TransactionEnvelope;
  }): Promise<PendingSmalletTransaction> {
    return this.newTransaction({
      ...args,
      instructions: tx.instructions,
    });
  }

  async fetchTransactionByIndex(
    index: number
  ): Promise<SmalletTransactionData | null> {
    const [txKey] = await findTransactionAddress(this.key, index);
    return await this.program.account.transaction.fetchNullable(txKey);
  }

  async fetchTransaction(key: PublicKey): Promise<SmalletTransactionData> {
    return await this.program.account.transaction.fetch(key);
  }

  approveTransaction(
    transactionKey: PublicKey,
    owner: PublicKey = this.provider.wallet.publicKey
  ): TransactionEnvelope {
    return new TransactionEnvelope(this.provider, [
      this.program.instruction.approve({
        accounts: {
          smallet: this.key,
          transaction: transactionKey,
          owner,
        },
      }),
    ]);
  }
  /**Executes a transaction as the new smallet */

  async executeTransaction({
    transactionKey,
    owner = this.provider.wallet.publicKey,
  }: {
    transactionKey: PublicKey;
    owner?: PublicKey;
  }): Promise<TransactionEnvelope> {
    const ix = this.program.instruction.executeTransaction(
      await this._fetchExecuteTransactionContext({ transactionKey, owner })
    );
    return new TransactionEnvelope(this.provider, [ix]);
  }
  /**Finds the derived wallet address and bump of a given index */

  async findWalletDerivedAddress(index: number): Promise<[PublicKey, number]> {
    return await findWalletDerivedAddress(this.key, index);
  }

  /**Finds the owner invoker address and bump of a given index */

  async findOwnerInvokerAddress(index: number): Promise<[PublicKey, number]> {
    return await findOwnerInvokerAddress(this.key, index);
  }

  private async _fetchExecuteTransactionContext({
    transactionKey,
    owner = this.provider.wallet.publicKey,
    walletDerivedAddress = null,
  }: {
    transactionKey: PublicKey;
    owner?: PublicKey;
    walletDerivedAddress?: PublicKey | null;
  }) {
    const data = await this.fetchTransaction(transactionKey);
    return {
      accounts: {
        smallet: this.key,
        transaction: transactionKey,
        owner,
      },
      remainingAccounts: data.instructions.flatMap((ix) => [
        {
          pubkey: ix.programId,
          isSigner: false,
          isWritable: false,
        },
        ...ix.keys.map((k) => {
          if (
            k.isSigner &&
            ((walletDerivedAddress && k.pubkey.equals(walletDerivedAddress)) ||
              k.pubkey.equals(this.key))
          ) {
            return {
              ...k,
              isSigner: false,
            };
          }
          return k;
        }),
      ]),
    };
  }
  /**Executes a transaction using a wallet-derived address */

  async executeTransactionDerived({
    transactionKey,
    walletIndex,
    owner = this.provider.wallet.publicKey,
  }: {
    transactionKey: PublicKey;
    walletIndex: number;
    owner?: PublicKey;
  }): Promise<TransactionEnvelope> {
    const [walletDerivedAddress, walletBump] =
      await this.findWalletDerivedAddress(walletIndex);
    const ix = this.program.instruction.executeTransactionDerived(
      new BN(walletIndex),
      walletBump,
      await this._fetchExecuteTransactionContext({
        transactionKey,
        owner,
        walletDerivedAddress,
      })
    );
    return new TransactionEnvelope(this.provider, [ix]);
  }
  /**Executes a transaction using an owner invoker address */

  async ownerInvokeInstruction({
    instruction,
    index,
    owner = this.provider.wallet.publicKey,
  }: {
    instruction: TransactionInstruction;
    index: number;
    owner?: PublicKey;
  }): Promise<TransactionEnvelope> {
    const [invokerAddress, invokerBump] = await this.findOwnerInvokerAddress(
      index
    );
    const ix = this.program.instruction.ownerInvokeInstruction(
      new BN(index),
      invokerBump,
      instruction,
      {
        accounts: {
          smallet: this.key,
          owner,
        },
        remainingAccounts: [
          {
            pubkey: instruction.programId,
            isSigner: false,
            isWritable: false,
          },
          ...instruction.keys.map((k) => {
            if (k.isSigner && invokerAddress.equals(k.pubkey)) {
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
    return new TransactionEnvelope(this.provider, [ix]);
  }
  /**Executes a transaction using an owner invoker address */

  async ownerInvokeInstructionV2({
    instruction,
    index,
    owner = this.provider.wallet.publicKey,
  }: {
    instruction: TransactionInstruction;
    index: number;
    owner?: PublicKey;
  }): Promise<TransactionEnvelope> {
    const [invokerAddress, invokerBump] = await this.findOwnerInvokerAddress(
      index
    );
    const ix = this.program.instruction.ownerInvokeInstructionV2(
      new BN(index),
      invokerBump,
      invokerAddress,
      instruction.data,
      {
        accounts: {
          smallet: this.key,
          owner,
        },
        remainingAccounts: [
          {
            pubkey: instruction.programId,
            isSigner: false,
            isWritable: false,
          },
          ...instruction.keys.map((k) => {
            if (k.isSigner && invokerAddress.equals(k.pubkey)) {
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
    return new TransactionEnvelope(this.provider, [ix]);
  }

  setOwners(owners: PublicKey[]): TransactionEnvelope {
    const ix = this.program.instruction.setOwners(owners, {
      accounts: {
        smallet: this.key,
      },
    });
    return new TransactionEnvelope(this.provider, [ix]);
  }

  changeThreshold(threshold: number): TransactionEnvelope {
    const ix = this.program.instruction.changeThreshold(new BN(threshold), {
      accounts: {
        smallet: this.key,
      },
    });
    return new TransactionEnvelope(this.provider, [ix]);
  }

  // Grant / Extend / Revoke auto-sign rights of an owner
  setSession({
    expiresAt,
    owner = this.provider.wallet.publicKey,
  }: {
    expiresAt?: BN;
    owner?: PublicKey;
  }): TransactionEnvelope {
    const ix = this.program.instruction.setSession(expiresAt ?? null, {
      accounts: {
        smallet: this.key,
        owner,
      },
    });
    return new TransactionEnvelope(this.provider, [ix]);
  }

  // Grant / Extend / Revoke auto-sign rights of an owner
  async setFrozenAdmin({
    frozen,
    admin,
  }: {
    admin: PublicKey;
    frozen: boolean;
  }): Promise<TransactionEnvelope> {
    const [globalState] = await findGlobalState();

    const ix = this.program.instruction.setFrozenAdmin(frozen, {
      accounts: {
        smallet: this.key,
        globalState,
        admin,
      },
    });
    return new TransactionEnvelope(this.provider, [ix]);
  }

  /** Perform guadian action as guadians or globalAdmin */

  /// Lock smallet as any guadian
  async lockSmallet({
    guadian = this.provider.wallet.publicKey,
  }: {
    guadian: PublicKey;
  }): Promise<TransactionEnvelope> {
    const [globalState] = await findGlobalState();

    const ix = this.program.instruction.lockSmallet({
      accounts: {
        smallet: this.key,
        globalState,
        guadian,
      },
    });
    return new TransactionEnvelope(this.provider, [ix]);
  }

  /// Create guadian action for all guadians to sign
  /// Will be performed immediately for global admin
  async newGuadianAction({
    guadian = this.provider.wallet.publicKey,
    actionType,
    newAddresses,
  }: {
    guadian: PublicKey;
    actionType: GuadianActionType;
    newAddresses?: PublicKey[];
  }): Promise<PendingSmalletGuadianAction> {
    const index = (await this.reloadData()).numGudianActions.toNumber();
    const [globalState] = await findGlobalState();
    const [actionKey] = await findGuadianActionAddress(this.key, index);

    // Not create transaction if newAddresses are empty
    if (
      actionType !== GuadianActionType.UnlockSmallet &&
      !(newAddresses ?? []).length
    )
      return {
        guadianActionKey: actionKey,
        tx: undefined,
        index,
      };

    const smalletData = await this.program.account.smallet.fetch(actionKey);

    const accounts = {
      guadian,
      globalState,
      smallet: this.key,
      guadianAction: actionKey,
      systemProgram: SystemProgram.programId,
    };

    let type: { [type: string]: {} };
    switch (actionType) {
      case GuadianActionType.SetGuadians:
        type = { setGuadians: {} };
        break;
      case GuadianActionType.SetOwners:
        type = { setOwners: {} };
        break;
      case GuadianActionType.UnlockSmallet:
        type = { unlockSmallet: {} };
        break;
      default:
        type = { noAction: {} };
    }

    const instructions: TransactionInstruction[] = [];
    instructions.push(
      this.program.instruction.createGuadianAction(
        type,
        smalletData.guadians.length,
        newAddresses!.length, // Already handled empty case
        {
          accounts,
        }
      )
    );

    return {
      guadianActionKey: actionKey,
      tx: new TransactionEnvelope(this.provider, instructions),
      index,
    };
  }

  /// Create guadian action for all guadians to sign
  /// Will be performed immediately for global admin
  async signGuadianActionAndTry({
    guadian = this.provider.wallet.publicKey,
    index,
  }: {
    guadian: PublicKey;
    index: number;
  }): Promise<PendingSmalletGuadianAction> {
    const [globalState] = await findGlobalState();
    const [actionKey] = await findGuadianActionAddress(this.key, index);

    const accounts = {
      guadian,
      globalState,
      smallet: this.key,
      guadianAction: actionKey,
    };

    const instructions: TransactionInstruction[] = [];
    instructions.push(
      this.program.instruction.tryActionWithSign(new BN(index), {
        accounts,
      })
    );

    return {
      guadianActionKey: actionKey,
      tx: new TransactionEnvelope(this.provider, instructions),
      index,
    };
  }

  async fetchGuadianActionByIndex(
    index: number
  ): Promise<GuadianActionData | null> {
    const [txKey] = await findGuadianActionAddress(this.key, index);
    return await this.program.account.guadianAction.fetchNullable(txKey);
  }

  async fetchGuadianAction(key: PublicKey): Promise<GuadianActionData> {
    return await this.program.account.guadianAction.fetch(key);
  }

  /**Loads a smallet */

  static async load(sdk: SMALLETSDK, key: PublicKey): Promise<SmalletWrapper> {
    const data = await sdk.programs.Smallet.account.smallet.fetch(key);
    return new SmalletWrapper(sdk, {
      key,
      data,
      bump: data.bump,
      base: data.base,
    });
  }
}
