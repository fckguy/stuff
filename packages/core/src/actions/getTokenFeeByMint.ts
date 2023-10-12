import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import fs from "fs";
import {
  Account,
  Mint,
  getMint,
  getOrCreateAssociatedTokenAccount,
} from "@solana/spl-token";
import { TokenFee } from "../core";
import { createTokenFee, getTokenToNativePriceInfo } from "../payer-utils";

export type TokenConfigs = {
  [mint: string]: TokenConfig;
};

export type TokenConfig = {
  allowed: boolean;
  priceInSol: number;
  margin: number;
};

const TOKEN_CONFIG_FILE = __dirname + "/../tokens_config.json";

function readTokenConfigs(): TokenConfigs {
  if (!fs.existsSync(TOKEN_CONFIG_FILE)) {
    fs.writeFileSync(TOKEN_CONFIG_FILE, JSON.stringify({}), { flag: "w" });
  }
  const configs = fs.readFileSync(TOKEN_CONFIG_FILE, { encoding: "utf8" });
  return JSON.parse(configs);
}

function writeTokenConfigs(tokenConfigs: TokenConfigs): void {
  fs.writeFileSync(TOKEN_CONFIG_FILE, JSON.stringify(tokenConfigs), {
    flag: "w",
  });
}

/**
 * Get sponsor token allowed status from config file.
 *
 * @param mint - Sponsor SPL mint
 * @param margin - Part of total user-paid fee that fee payers takes as a surplus to transaction costs.
 * @return TokenFee - Generated TokenFee object for this {mint}
 */
export async function getTokenFeeByMint(
  mint: PublicKey,
  feePayer: Keypair,
  connection: Connection,
  tokenMintInfo?: Mint,
  tokenAccount?: Account
): Promise<TokenFee | undefined> {
  const tokenConfigs = readTokenConfigs();
  const tokenInfo = tokenMintInfo ?? (await getMint(connection, mint));

  if (!tokenConfigs[tokenInfo.address.toBase58()]) return undefined;

  const account =
    tokenAccount ??
    (await getOrCreateAssociatedTokenAccount(
      connection,
      feePayer,
      tokenInfo.address,
      feePayer.publicKey
    ));

  const tokenPriceInfo = await getTokenToNativePriceInfo(mint);
  const newTokenFee = await createTokenFee(
    tokenInfo.address,
    tokenPriceInfo,
    tokenInfo,
    account.address,
    tokenConfigs[tokenInfo.address.toBase58()]!.margin
  );

  return newTokenFee;
}

/**
 * Add a token fee to the configuration.
 *
 * @param tokenFee - The token fee to add.
 * @param margin - The margin for the token fee.
 * @return TokenConfig - The added token configuration.
 */
export async function addTokenFeeToConfig(
  tokenFee: TokenFee,
  margin: number
): Promise<TokenConfig> {
  const tokenConfigs = readTokenConfigs();
  tokenConfigs[tokenFee.mint.toBase58()] = {
    allowed: true,
    priceInSol: tokenFee.priceInSol,
    margin,
  };
  writeTokenConfigs(tokenConfigs);
  return tokenConfigs[tokenFee.mint.toBase58()]!;
}