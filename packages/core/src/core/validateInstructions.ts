import { PublicKey } from "@saberhq/solana-contrib";
import { ASSOCIATED_TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Keypair, SystemProgram, Transaction } from "@solana/web3.js";
import { SMALLET_ADDRESSES } from "../../../../src";

// Prevent draining by making sure that the fee payer isn't provided as writable or a signer to any instruction.
// Throws an error if transaction contain instructions that could potentially drain fee payer.
// Create account Ix is excepted in this validation. It will be validated by SOL / Token consumed status check later.
export async function validateInstructions(
  transaction: Transaction,
  feePayer: Keypair
): Promise<PublicKey[]> {
  let accounts: PublicKey[] = [];
  for (const instruction of transaction.instructions) {
    for (const key of instruction.keys) {
      if (
        (key.isWritable || key.isSigner) &&
        key.pubkey.equals(feePayer.publicKey) &&
        !(
          // TODO: need to check if create account Ixs use only SystemProgram & AssociatedTokenProgram
          (
            instruction.programId.equals(SystemProgram.programId) ||
            instruction.programId.equals(ASSOCIATED_TOKEN_PROGRAM_ID) ||
            instruction.programId.equals(SMALLET_ADDRESSES.Smallet)
          )
        )
      ) {
        throw new Error("invalid account");
      }

      if (!accounts.find((account) => account.equals(key.pubkey)))
        accounts.push(key.pubkey);
    }
  }
  return accounts;
}
