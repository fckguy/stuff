import { utils } from "@project-serum/anchor";
import { getProgramAddress } from "@saberhq/solana-contrib";
import { u64 } from "@saberhq/token-utils";
import { PublicKey, TransactionInstruction } from "@solana/web3.js";

import { SMALLET_ADDRESSES } from "../../constants";

export const findGlobalState = async (): Promise<[PublicKey, number]> => {
  return await PublicKey.findProgramAddress(
    [utils.bytes.utf8.encode("Smallet")],
    SMALLET_ADDRESSES.Smallet
  );
};

export const findProgramData = async (): Promise<[PublicKey, number]> => {
  return await PublicKey.findProgramAddress(
    [SMALLET_ADDRESSES.Smallet.toBuffer()],
    new PublicKey("BPFLoaderUpgradeab1e11111111111111111111111")
  );
};

export const findSmallet = async (
  base: PublicKey
): Promise<[PublicKey, number]> => {
  return await PublicKey.findProgramAddress(
    [utils.bytes.utf8.encode("Smallet"), base.toBuffer()],
    SMALLET_ADDRESSES.Smallet
  );
};

export const findTransactionAddress = async (
  smallet: PublicKey,
  index: number
): Promise<[PublicKey, number]> => {
  return await PublicKey.findProgramAddress(
    [
      utils.bytes.utf8.encode("Transaction"),
      smallet.toBuffer(),
      new u64(index).toBuffer(),
    ],
    SMALLET_ADDRESSES.Smallet
  );
};

export const findGuadianActionAddress = async (
  smallet: PublicKey,
  index: number
): Promise<[PublicKey, number]> => {
  return await PublicKey.findProgramAddress(
    [
      utils.bytes.utf8.encode("GuadianAction"),
      smallet.toBuffer(),
      new u64(index).toBuffer(),
    ],
    SMALLET_ADDRESSES.Smallet
  );
};

/**
 * Finds a derived address of a Smart Wallet.
 */
export const findWalletDerivedAddress = async (
  smallet: PublicKey,
  index: number
): Promise<[PublicKey, number]> => {
  return await PublicKey.findProgramAddress(
    [
      utils.bytes.utf8.encode("SmalletDerived"),
      smallet.toBuffer(),
      new u64(index).toBuffer(),
    ],
    SMALLET_ADDRESSES.Smallet
  );
};

/**
 * Finds an Owner Invoker address of a Smart Wallet.
 */
export const findOwnerInvokerAddress = async (
  smallet: PublicKey,
  index: number
): Promise<[PublicKey, number]> => {
  return await PublicKey.findProgramAddress(
    [
      utils.bytes.utf8.encode("SmalletOwnerInvoker"),
      smallet.toBuffer(),
      new u64(index).toBuffer(),
    ],
    SMALLET_ADDRESSES.Smallet
  );
};

/**
 * Finds the subaccount info address of a subaccount of a smart wallet.
 */
export const findSubaccountInfoAddress = async (
  subaccount: PublicKey
): Promise<[PublicKey, number]> => {
  return await PublicKey.findProgramAddress(
    [utils.bytes.utf8.encode("SubaccountInfo"), subaccount.toBuffer()],
    SMALLET_ADDRESSES.Smallet
  );
};

export const getSmalletAddress = (base: PublicKey): PublicKey => {
  return getProgramAddress(
    [utils.bytes.utf8.encode("Smallet"), base.toBuffer()],
    SMALLET_ADDRESSES.Smallet
  );
};

export const getGuadianActionAddress = (
  smallet: PublicKey,
  index: number
): PublicKey => {
  return getProgramAddress(
    [
      utils.bytes.utf8.encode("GuadianAction"),
      smallet.toBuffer(),
      new u64(index).toBuffer(),
    ],
    SMALLET_ADDRESSES.Smallet
  );
};

export const getTransactionAddress = (
  smallet: PublicKey,
  index: number
): PublicKey => {
  return getProgramAddress(
    [
      utils.bytes.utf8.encode("Transaction"),
      smallet.toBuffer(),
      new u64(index).toBuffer(),
    ],
    SMALLET_ADDRESSES.Smallet
  );
};

/**
 * Finds a derived address of a Smart Wallet.
 */
export const getWalletDerivedAddress = (
  smallet: PublicKey,
  index: number
): PublicKey => {
  return getProgramAddress(
    [
      utils.bytes.utf8.encode("SmalletDerived"),
      smallet.toBuffer(),
      new u64(index).toBuffer(),
    ],
    SMALLET_ADDRESSES.Smallet
  );
};

/**
 * Finds an Owner Invoker address of a Smart Wallet.
 */
export const getOwnerInvokerAddress = (
  smallet: PublicKey,
  index: number
): PublicKey => {
  return getProgramAddress(
    [
      utils.bytes.utf8.encode("SmalletOwnerInvoker"),
      smallet.toBuffer(),
      new u64(index).toBuffer(),
    ],
    SMALLET_ADDRESSES.Smallet
  );
};

/**
 * Finds the subaccount info address of a subaccount of a smart wallet.
 */
export const getSubaccountInfoAddress = (subaccount: PublicKey): PublicKey => {
  return getProgramAddress(
    [utils.bytes.utf8.encode("SubaccountInfo"), subaccount.toBuffer()],
    SMALLET_ADDRESSES.Smallet
  );
};

export const getSmalletSpaceSize = (maxOwners: number, maxGuadians: number) => {
  return (
    8 +
    32 +
    1 +
    8 * 3 +
    4 +
    8 +
    4 +
    32 * maxOwners +
    4 +
    8 * maxOwners +
    4 +
    32 * maxGuadians +
    8 +
    8 * 16 +
    1 +
    1
  );
};

export const getTransactionSpaceSize = (
  ixs: TransactionInstruction[],
  ownersCount: number
) => {
  let space =
    8 + 32 + 8 + 1 + 32 + 4 + 4 + 1 * ownersCount + 4 + 8 + 32 + 8 + 50; // extra 40 byte to match with contract pda size
  for (let ix of ixs) {
    space += 32 + ix.keys.length * 34 + ix.data.length;
  }
  return space;
};

export const getSubAccountSpaceSize = () => {
  return 8 + 32 + 1 + 8;
};
