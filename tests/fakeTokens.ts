// For Testing: Map for matching localnet generated tokens to jupiter mint by symbol.
// Will used for only Unit tests.
import { Keypair, PublicKey } from "@solana/web3.js";
import fs from "fs";

export const TEST_TOKEN_MAPPING: {
  [symbol: string]: {
    localMint: string;
    jupiterMint: string;
  };
} = {
  WBTC: {
    localMint: "EcFhFLpDPeGXuFaJY3gLHTeCJT4FLeRbnL9DRE444FCG",
    jupiterMint: "3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh",
  },
};

export function getTestTokenKeypair(symbol: string) {
  const keypairFile = fs.readFileSync(
    __dirname +
      `/../keys/test-tokens/${TEST_TOKEN_MAPPING[symbol]?.localMint}.json`,
    { encoding: "utf8" }
  );
  return {
    keypair: Keypair.fromSecretKey(Uint8Array.from(JSON.parse(keypairFile))),
    jupMint: new PublicKey(TEST_TOKEN_MAPPING[symbol]?.jupiterMint || ""),
  };
}
