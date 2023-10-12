import type { AnchorDefined, AnchorTypes } from "@saberhq/anchor-contrib";
import type { AccountMeta } from "@solana/web3.js";

import type { SmalletIDL } from "../idls/smallet";

export * from "../idls/smallet";

export type SmalletTypes = AnchorTypes<
  SmalletIDL,
  {
    globalState: GlobalStateData;
    guadianAction: GuadianActionData;
    smallet: SmalletData;
    transaction: SmalletTransactionData;
    subaccountInfo: SubaccountInfoData;
  },
  {
    TXInstruction: SmalletInstruction;
    TXAccountMeta: AccountMeta;
  }
>;

type Accounts = SmalletTypes["Accounts"];
export type GlobalStateData = Accounts["GlobalState"];
export type SmalletData = Accounts["Smallet"];
export type GuadianActionData = Accounts["GuadianAction"];
export type SmalletTransactionData = Accounts["Transaction"];
export type SubaccountInfoData = Accounts["SubaccountInfo"];

export type SmalletInstruction = Omit<
  AnchorDefined<SmalletIDL>["TXInstruction"],
  "keys"
> & {
  keys: AccountMeta[];
};

export type SmalletError = SmalletTypes["Error"];
export type SmalletEvents = SmalletTypes["Events"];
export type SmalletProgram = SmalletTypes["Program"];

export type WalletCreateEvent = SmalletEvents["WalletCreateEvent"];
export type WalletSetOwnersEvent = SmalletEvents["WalletSetOwnersEvent"];
export type WalletChangeThresholdEvent =
  SmalletEvents["WalletChangeThresholdEvent"];
export type TransactionCreateEvent = SmalletEvents["TransactionCreateEvent"];
export type TransactionApproveEvent = SmalletEvents["TransactionApproveEvent"];
export type TransactionExecuteEvent = SmalletEvents["TransactionExecuteEvent"];
