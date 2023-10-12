import { generateErrorMap } from "@saberhq/anchor-contrib";

export type SoulboundsignerIDL = {
  version: "0.1.0";
  name: "soulboundsigner";
  instructions: [
    {
      name: "invokeSignedInstruction";
      accounts: [
        {
          name: "ownerAuthority";
          isMut: false;
          isSigner: true;
        },
        {
          name: "nftAccount";
          isMut: false;
          isSigner: false;
        },
        {
          name: "nftPda";
          isMut: false;
          isSigner: false;
          pda: {
            seeds: [
              {
                kind: "const";
                type: "string";
                value: "Soulboundsigner";
              },
              {
                kind: "account";
                type: "publicKey";
                account: "TokenAccount";
                path: "nft_account.mint";
              }
            ];
          };
        }
      ];
      args: [
        {
          name: "data";
          type: "bytes";
        }
      ];
    }
  ];
  errors: [
    {
      code: 6000;
      name: "Unauthorized";
      msg: "Unauthorized.";
    }
  ];
};
export const SoulboundsignerJSON: SoulboundsignerIDL = {
  version: "0.1.0",
  name: "soulboundsigner",
  instructions: [
    {
      name: "invokeSignedInstruction",
      accounts: [
        {
          name: "ownerAuthority",
          isMut: false,
          isSigner: true,
        },
        {
          name: "nftAccount",
          isMut: false,
          isSigner: false,
        },
        {
          name: "nftPda",
          isMut: false,
          isSigner: false,
          pda: {
            seeds: [
              {
                kind: "const",
                type: "string",
                value: "Soulboundsigner",
              },
              {
                kind: "account",
                type: "publicKey",
                account: "TokenAccount",
                path: "nft_account.mint",
              },
            ],
          },
        },
      ],
      args: [
        {
          name: "data",
          type: "bytes",
        },
      ],
    },
  ],
  errors: [
    {
      code: 6000,
      name: "Unauthorized",
      msg: "Unauthorized.",
    },
  ],
};
export const SoulboundsignerErrors = generateErrorMap(SoulboundsignerJSON);
