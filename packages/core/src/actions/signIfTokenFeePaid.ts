import {
  Transaction,
  Connection,
  Keypair,
  SystemProgram,
} from "@solana/web3.js";
import { PublicKey } from "@saberhq/solana-contrib";
import type { Cache } from "cache-manager";
import base58 from "bs58";
import {
  sha256,
  simulateRawTransaction,
  validateTransaction,
  validateTransfer,
  TokenFee,
  validateInstructions,
} from "../core";
import { calculateTokenCostForLamports } from "../payer-utils";

/**
 * Sign transaction by fee payer if the first instruction is a transfer of token fee to given account
 *
 * @param connection           Connection to a Solana node
 * @param transaction          Transaction to sign
 * @param feePayer             Keypair for fee payer
 * @param maxSignatures        Maximum allowed signatures in the transaction including fee payer's
 * @param lamportsPerSignature Maximum fee payment in lamports
 * @param allowedTokens        List of tokens that can be used with token fee receiver accounts and fee details
 * @param cache                A cache to store duplicate transactions
 * @param sameSourceTimeout    An interval for transactions with same token fee source, ms
 *
 * @return {signature: string} Transaction signature by fee payer
 */
export async function signWithTokenFee(
  connection: Connection,
  transaction: Transaction,
  feePayer: Keypair,
  maxSignatures: number,
  lamportsPerSignature: number,
  allowedTokens: TokenFee[],
  cache: Cache,
  sameSourceTimeout = 5000
): Promise<{ signature: string }> {
  // Prevent simple duplicate transactions using a hash of the message
  let key = `transaction/${base58.encode(
    sha256(transaction.serializeMessage())
  )}`;
  if (await cache.get(key)) throw new Error("duplicate transaction");
  await cache.set(key, true);

  // Check that the transaction is basically valid, sign it, and serialize it, verifying the signatures
  const { signature, rawTransaction } = await validateTransaction(
    connection,
    transaction,
    feePayer,
    maxSignatures,
    lamportsPerSignature
  );

  // Get all account keys which used for instructions
  let accountKeys = await validateInstructions(transaction, feePayer);

  // Check that the transaction contains a valid transfer to Octane's token account
  const transfer = await validateTransfer(
    connection,
    transaction,
    allowedTokens
  );

  const {
    keys: { source, owner, mint },
    data: { amount },
  } = transfer;
  // console.log("Owner Token Cost:", mint.pubkey.toBase58(), amount, decimals);

  // Replace the owner account with feePayer to observe balance changes
  accountKeys = accountKeys
    .filter((account) => !account.equals(owner.pubkey))
    .concat(feePayer.publicKey);

  /*
       An attacker could make multiple signing requests before the transaction is confirmed. If the source token account
       has the minimum fee balance, validation and simulation of all these requests may succeed. All but the first
       confirmed transaction will fail because the account will be empty afterward. To prevent this race condition,
       simulation abuse, or similar attacks, we implement a simple lockout for the source token account
       for a few seconds after the transaction.
     */
  key = `transfer/lastSignature/${source.pubkey.toBase58()}`;
  const lastSignature: number | undefined = await cache.get(key);
  if (lastSignature && Date.now() - lastSignature < sameSourceTimeout) {
    throw new Error("duplicate transfer");
  }
  await cache.set(key, Date.now());

  const simRes = await simulateRawTransaction(
    connection,
    rawTransaction,
    accountKeys
  );

  // Get simulated feePayer lamports to get consumed SOL amount
  const feePayerAccounts = (simRes.accounts || [])
    .map((account, index) =>
      Object.assign({}, { ...account, key: accountKeys[index]! })
    )
    .filter(
      (account) =>
        account?.owner === SystemProgram.programId.toBase58() &&
        account.key.equals(feePayer.publicKey)
    );
  const currentFeePayerLamports = await connection.getBalance(
    feePayer.publicKey
  );
  const consumedFeePayerBalance =
    currentFeePayerLamports - feePayerAccounts[0]!.lamports!;
  // console.log("Consumed Lamports:", consumedFeePayerBalance);
  const estimatedFee = await transaction.getEstimatedFee(connection);
  if (!estimatedFee) throw new Error("can not estimate tx fee");
  // console.log("Estimated Fee:", estimatedFee);

  // Validated token cost amount against total consumed lamports in transaction
  const costToken = allowedTokens.find((token) =>
    token.mint.equals(mint.pubkey)
  )!;
  const requiredTokenCost = calculateTokenCostForLamports(
    consumedFeePayerBalance + estimatedFee,
    costToken.priceInSol,
    costToken.decimals
  );
  // console.log("Required Token Cost:", requiredTokenCost);
  if (requiredTokenCost > amount) throw new Error("insufficient fee cost");

  return { signature: signature };
}

export async function estimateTokenFee(
  mint: PublicKey,
  amount: number,
  signaturesCount: number,
  lamportsPerSignature: number,
  allowedTokens: TokenFee[],
  connection: Connection
): Promise<{ cost: number }> {
  const estimatedFee = signaturesCount * lamportsPerSignature * 2;
  const costToken = allowedTokens.find((token) => token.mint.equals(mint))!;
  const rentAmount = await connection.getMinimumBalanceForRentExemption(amount);
  // console.log(rentAmount + estimatedFee);
  const requiredTokenCost = calculateTokenCostForLamports(
    rentAmount + estimatedFee,
    costToken.priceInSol,
    costToken.decimals
  );
  // console.log("Estimated Token Cost:", requiredTokenCost);

  return {
    cost: requiredTokenCost,
  };
}
