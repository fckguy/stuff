import { buildCoderMap } from "@saberhq/anchor-contrib";
import { Keypair, PublicKey } from "@solana/web3.js";
import * as dotenv from "dotenv";
dotenv.config();

import { SmalletJSON } from "./idls/smallet";
import type { SmalletProgram, SmalletTypes } from "./programs";

export interface Programs {
  Smallet: SmalletProgram;
}

export const SMALLET_ADDRESSES = {
  Smallet: new PublicKey("7iFugUof2fQaHojbxskcELz5nCfNfKJx5vd8cY7qPAYU"),
};

export const SMALLET_IDLS = {
  Smallet: SmalletJSON,
};

export const SMALLET_CODERS = buildCoderMap<{
  Smallet: SmalletTypes;
}>(SMALLET_IDLS, SMALLET_ADDRESSES);

export const ENV_SECRET_KEYPAIR = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(process.env.SECRET_KEY || ""))
);

// Configs for paymaster
export const ENV_FEE_PAYER = ENV_SECRET_KEYPAIR.publicKey;
