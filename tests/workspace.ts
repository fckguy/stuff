import * as anchor from "@project-serum/anchor";
import { chaiSolana } from "@saberhq/chai-solana";
import { SolanaProvider } from "@saberhq/solana-contrib";
import * as chai from "chai";

import type { Programs } from "../src";
import { SMALLETSDK } from "../src";

chai.use(chaiSolana);

export type Workspace = Programs;

export const makeSDK = (): SMALLETSDK => {
  const anchorProvider = anchor.AnchorProvider.env();
  anchor.setProvider(anchorProvider);

  const provider = SolanaProvider.load({
    connection: anchorProvider.connection,
    wallet: anchorProvider.wallet,
    opts: anchorProvider.opts,
  });
  return SMALLETSDK.load({
    provider,
  });
};