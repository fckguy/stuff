import { expect, use } from "chai";
import chaiAsPromised from "chai-as-promised";
// @ts-ignore (TS7016) There is no type definition for this at DefinitelyTyped.
import MemoryStore from "cache-manager/lib/stores/memory";
import { Keypair, PublicKey, Connection } from "@solana/web3.js";
import {
  createMint,
  getMint,
  getOrCreateAssociatedTokenAccount,
} from "@solana/spl-token";
import { addAllowedTokenAsAdmin } from "../../packages/core/src";
import { airdropLamports } from "../common";
import { ENV_SECRET_KEYPAIR } from "../../src";
import { getTestTokenKeypair } from "../fakeTokens";

use(chaiAsPromised);

describe("configTokenFeeAsAdmin action", async () => {
  let connection: Connection;
  let feePayerKeypair: Keypair; // Payer for submitted transactions
  let mint: PublicKey;
  before(async () => {
    connection = new Connection("http://localhost:8899/", "confirmed");
    feePayerKeypair = ENV_SECRET_KEYPAIR;
    await airdropLamports(connection, feePayerKeypair.publicKey);
  });

  it("create test wBTC as admin", async () => {
    // Trying to get keypair for test token
    const testToken = getTestTokenKeypair("WBTC");
    mint = await createMint(
      connection,
      feePayerKeypair,
      feePayerKeypair.publicKey,
      null,
      9,
      testToken.keypair
    );
    const tokenInfo = await getMint(connection, mint);
    const tokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      feePayerKeypair,
      mint,
      feePayerKeypair.publicKey
    );
    // Replaced jupiter token address instead of token mint to fetch jupiter price.
    // This just for testing purpose against jupiter APIs
    const wBtcTokenFee = await addAllowedTokenAsAdmin(
      testToken.jupMint,
      feePayerKeypair,
      0.9,
      connection,
      tokenInfo,
      tokenAccount
    );
    expect(wBtcTokenFee.account).to.equal(tokenAccount.address);
  });

  // TODO: add more tests for updateLiveTokenPrices and so on
});
