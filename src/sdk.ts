import { newProgramMap } from "@saberhq/anchor-contrib";
import type { AugmentedProvider, Provider } from "@saberhq/solana-contrib";
import {
  SolanaAugmentedProvider,
  TransactionEnvelope,
} from "@saberhq/solana-contrib";
import { u64 } from "@saberhq/token-utils";
import type { PublicKey, Signer } from "@solana/web3.js";
import { Keypair, SYSVAR_RENT_PUBKEY, SystemProgram } from "@solana/web3.js";
import BN from "bn.js";
import mapValues from "lodash.mapvalues";

import type { Programs } from "./constants";
import { SMALLET_ADDRESSES, SMALLET_IDLS } from "./constants";
import type { PendingGlobalState, PendingSmallet } from "./wrappers/smallet";
import {
  findGlobalState,
  findOwnerInvokerAddress,
  // findProgramData,
  findSmallet,
  findSubaccountInfoAddress,
  findWalletDerivedAddress,
  SmalletWrapper,
} from "./wrappers/smallet";
import { GlobalStateData } from "./programs";

/** SMALLET SDK */
export class SMALLETSDK {
  private _data?: GlobalStateData;

  constructor(
    readonly provider: AugmentedProvider,
    readonly programs: Programs
  ) {}
  /**
   * Creates a new instance of the SDK with the given keypair.
   */
  withSigner(signer: Signer): SMALLETSDK {
    return SMALLETSDK.load({
      provider: this.provider.withSigner(signer),
      addresses: mapValues(this.programs, (v) => v.programId),
    });
  }

  loadSmallet(key: PublicKey): Promise<SmalletWrapper> {
    return SmalletWrapper.load(this, key);
  }
  /**
   * Initialize global state
   */
  async initializeGlobalState(): Promise<PendingGlobalState> {
    const [globalState] = await findGlobalState();
    // TODO: Should uncomment these lines too
    // const [programData] = await findProgramData();

    const ix = this.programs.Smallet.instruction.initializeGlobalState({
      accounts: {
        admin: this.provider.wallet.publicKey,
        globalState,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
        // program: this.programs.Smallet.programId,
        // programData,
      },
    });
    return {
      tx: new TransactionEnvelope(this.provider, [ix]),
    };
  }

  /**
   * Transfer global Admin
   */
  async transferGlobalAdmin(newAdmin: PublicKey) {
    const [globalState] = await findGlobalState();
    const ix = this.programs.Smallet.instruction.transferGlobalAdmin(newAdmin, {
      accounts: {
        globalState,
        admin: this.provider.wallet.publicKey,
      },
    });
    return {
      tx: new TransactionEnvelope(this.provider, [ix]),
    };
  }

  /**
   * Change global thresholds as Admin
   */
  async setGlobalThresholds({
    changePeriod,
    actionExpires,
    minAgreePermyriad,
  }: {
    changePeriod?: number;
    actionExpires?: number;
    minAgreePermyriad?: number;
  }) {
    const [globalState] = await findGlobalState();
    const ix = this.programs.Smallet.instruction.setGlobalThresholds(
      changePeriod ? new BN(changePeriod) : null,
      actionExpires ? new BN(actionExpires) : null,
      minAgreePermyriad ? new BN(minAgreePermyriad) : null,
      {
        accounts: {
          globalState,
          admin: this.provider.wallet.publicKey,
        },
      }
    );
    return {
      tx: new TransactionEnvelope(this.provider, [ix]),
    };
  }

  async reloadGlobalData(): Promise<GlobalStateData> {
    const [globalKey] = await findGlobalState();
    this._data = await this.programs.Smallet.account.globalState.fetch(
      globalKey
    );
    return this._data;
  }

  get globalData(): GlobalStateData | undefined {
    return this._data;
  }

  /**
   * Creates a subaccount info.
   */
  async createSubaccountInfo({
    smallet,
    index,
    type,
    payer = this.provider.wallet.publicKey,
  }: {
    smallet: PublicKey;
    index: number;
    type: "derived" | "ownerInvoker";
    payer?: PublicKey;
  }) {
    const [subaccount] =
      type === "derived"
        ? await findWalletDerivedAddress(smallet, index)
        : await findOwnerInvokerAddress(smallet, index);
    const [subaccountInfo, bump] = await findSubaccountInfoAddress(subaccount);
    return this.provider.newTX([
      this.programs.Smallet.instruction.createSubaccountInfo(
        bump,
        subaccount,
        smallet,
        new u64(index),
        {
          [type]: {},
        },
        {
          accounts: {
            subaccountInfo,
            payer,
            systemProgram: SystemProgram.programId,
          },
        }
      ),
    ]);
  }
  /**
   * Create a new multisig account
   */
  async newSmallet({
    owners,
    threshold,
    numOwners,
    guadians,
    numGuadians,
    base = Keypair.generate(),
    delay = new BN(0),
    payer = this.provider.wallet.publicKey,
  }: {
    owners: PublicKey[];
    threshold: BN;
    /**
     * Number of owners in the smart wallet.
     */
    numOwners: number;
    guadians: PublicKey[];
    /**
     * Number of guadians in the smart wallet.
     */
    numGuadians: number;
    base?: Signer;
    /**
     * Timelock delay in seconds
     */
    delay?: BN;
    payer?: PublicKey;
  }): Promise<PendingSmallet> {
    const [smallet, bump] = await findSmallet(base.publicKey);

    const ix = this.programs.Smallet.instruction.createSmallet(
      bump,
      numOwners,
      owners,
      threshold,
      delay,
      numGuadians,
      guadians,
      {
        accounts: {
          base: base.publicKey,
          smallet,
          payer,
          systemProgram: SystemProgram.programId,
        },
      }
    );

    return {
      smalletWrapper: new SmalletWrapper(this, {
        bump,
        key: smallet,
        base: base.publicKey,
      }),
      tx: new TransactionEnvelope(this.provider, [ix], [base]),
    };
  }

  /**
   * Loads the SDK.
   * @returns
   */
  static load({
    provider,
    addresses = SMALLET_ADDRESSES,
  }: {
    // Provider
    provider: Provider;
    // Addresses of each program.
    addresses?: { [K in keyof Programs]?: PublicKey };
  }): SMALLETSDK {
    const allAddresses = { ...SMALLET_ADDRESSES, ...addresses };
    const programs = newProgramMap<Programs>(
      provider,
      SMALLET_IDLS,
      allAddresses
    );
    return new SMALLETSDK(new SolanaAugmentedProvider(provider), programs);
  }
}
