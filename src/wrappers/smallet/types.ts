import type { TransactionEnvelope } from "@saberhq/solana-contrib";
import type { PublicKey, TransactionInstruction } from "@solana/web3.js";
import type BN from "bn.js";

import type { GlobalStateData, SmalletData } from "../../programs";
import type { SmalletWrapper } from "./index";

export type InitSmalletWrapperArgs = {
  readonly bump: number;
  readonly base: PublicKey;
  readonly key: PublicKey;
  readonly data?: SmalletData;
  readonly globalStateData?: GlobalStateData;
};

export type PendingSmallet = {
  readonly smalletWrapper: SmalletWrapper;
  readonly tx: TransactionEnvelope;
};

export type PendingGlobalState = {
  readonly tx: TransactionEnvelope;
};

export type PendingSmalletTransaction = {
  /**
   * Pubkey of the created [Transaction]
   */
  readonly transactionKey: PublicKey;
  /**
   * Transaction to create the [Transaction]
   */
  readonly tx: TransactionEnvelope;
  /**
   * Index of the [Transaction]
   */
  readonly index: number;
};

export interface NewTransactionArgs {
  readonly proposer?: PublicKey;
  /**
   * Payer of the created [Transaction]
   */
  readonly payer?: PublicKey;
  /**
   * Instructions which compose the new [Transaction]
   */
  readonly instructions: TransactionInstruction[];
  /**
   * ETA of the new [Transaction]
   */
  readonly eta?: BN;
}

export enum GuadianActionType {
  NoAction,
  UnlockSmallet,
  SetOwners,
  SetGuadians,
}

export type PendingSmalletGuadianAction = {
  /**
   * Pubkey of the created [GuadianAction]
   */
  readonly guadianActionKey: PublicKey;
  /**
   * Transaction to create the [GuadianAction]
   */
  readonly tx: TransactionEnvelope | undefined;
  /**
   * Index of the [GuadianAction]
   */
  readonly index: number;
};
