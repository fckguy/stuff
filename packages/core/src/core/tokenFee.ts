import { PublicKey } from "@solana/web3.js";

type SerializableTokenFee = {
  mint: string;
  account: string;
  decimals: number;
  priceInSol: number;
};

export class TokenFee {
  public mint: PublicKey;
  public account: PublicKey;
  public decimals: number;
  public priceInSol: number;

  constructor(
    mint: PublicKey,
    account: PublicKey,
    decimals: number,
    fee: number
  ) {
    this.mint = mint;
    this.account = account;
    this.decimals = decimals;
    this.priceInSol = fee;
  }

  toSerializable(): SerializableTokenFee {
    return {
      mint: this.mint.toBase58(),
      account: this.account.toBase58(),
      decimals: this.decimals,
      priceInSol: this.priceInSol,
    };
  }

  static fromSerializable(serializableToken: SerializableTokenFee): TokenFee {
    return new TokenFee(
      new PublicKey(serializableToken.mint),
      new PublicKey(serializableToken.account),
      serializableToken.decimals,
      serializableToken.priceInSol
    );
  }
}
