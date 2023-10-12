import { generateErrorMap } from "@saberhq/anchor-contrib";

export type SmalletIDL = {
  version: "0.11.1";
  name: "smallet";
  instructions: [
    {
      name: "initializeGlobalState";
      accounts: [
        {
          name: "admin";
          isMut: true;
          isSigner: true;
        },
        {
          name: "globalState";
          isMut: true;
          isSigner: false;
          pda: {
            seeds: [
              {
                kind: "const";
                type: "string";
                value: "Smallet";
              }
            ];
          };
        },
        {
          name: "systemProgram";
          isMut: false;
          isSigner: false;
        },
        {
          name: "rent";
          isMut: false;
          isSigner: false;
        }
      ];
      args: [];
    },
    {
      name: "transferGlobalAdmin";
      accounts: [
        {
          name: "globalState";
          isMut: true;
          isSigner: false;
        },
        {
          name: "admin";
          isMut: true;
          isSigner: true;
        }
      ];
      args: [
        {
          name: "newAdmin";
          type: "publicKey";
        }
      ];
    },
    {
      name: "setGlobalThresholds";
      accounts: [
        {
          name: "globalState";
          isMut: true;
          isSigner: false;
        },
        {
          name: "admin";
          isMut: true;
          isSigner: true;
        }
      ];
      args: [
        {
          name: "changePeriod";
          type: {
            option: "i64";
          };
        },
        {
          name: "actionExpires";
          type: {
            option: "i64";
          };
        },
        {
          name: "agreePermyriad";
          type: {
            option: "u16";
          };
        }
      ];
    },
    {
      name: "createSmallet";
      accounts: [
        {
          name: "base";
          isMut: false;
          isSigner: true;
        },
        {
          name: "smallet";
          isMut: true;
          isSigner: false;
          pda: {
            seeds: [
              {
                kind: "const";
                type: "string";
                value: "Smallet";
              },
              {
                kind: "account";
                type: "publicKey";
                path: "base";
              }
            ];
          };
        },
        {
          name: "payer";
          isMut: true;
          isSigner: true;
        },
        {
          name: "systemProgram";
          isMut: false;
          isSigner: false;
        }
      ];
      args: [
        {
          name: "bump";
          type: "u8";
        },
        {
          name: "maxOwners";
          type: "u8";
        },
        {
          name: "owners";
          type: {
            vec: "publicKey";
          };
        },
        {
          name: "threshold";
          type: "u64";
        },
        {
          name: "minimumDelay";
          type: "i64";
        },
        {
          name: "gudiansCount";
          type: "u8";
        },
        {
          name: "gudians";
          type: {
            vec: "publicKey";
          };
        }
      ];
    },
    {
      name: "setOwners";
      accounts: [
        {
          name: "smallet";
          isMut: true;
          isSigner: true;
        }
      ];
      args: [
        {
          name: "owners";
          type: {
            vec: "publicKey";
          };
        }
      ];
    },
    {
      name: "changeThreshold";
      accounts: [
        {
          name: "smallet";
          isMut: true;
          isSigner: true;
        }
      ];
      args: [
        {
          name: "threshold";
          type: "u64";
        }
      ];
    },
    {
      name: "createTransaction";
      accounts: [
        {
          name: "smallet";
          isMut: true;
          isSigner: false;
        },
        {
          name: "transaction";
          isMut: true;
          isSigner: false;
          pda: {
            seeds: [
              {
                kind: "const";
                type: "string";
                value: "Transaction";
              },
              {
                kind: "account";
                type: "publicKey";
                account: "Smallet";
                path: "smallet";
              },
              {
                kind: "account";
                type: "u64";
                account: "Smallet";
                path: "smallet.num_transactions";
              }
            ];
          };
        },
        {
          name: "proposer";
          isMut: false;
          isSigner: true;
        },
        {
          name: "payer";
          isMut: true;
          isSigner: true;
        },
        {
          name: "systemProgram";
          isMut: false;
          isSigner: false;
        }
      ];
      args: [
        {
          name: "bump";
          type: "u8";
        },
        {
          name: "instructions";
          type: {
            vec: {
              defined: "TXInstruction";
            };
          };
        }
      ];
    },
    {
      name: "createTransactionWithTimelock";
      accounts: [
        {
          name: "smallet";
          isMut: true;
          isSigner: false;
        },
        {
          name: "transaction";
          isMut: true;
          isSigner: false;
          pda: {
            seeds: [
              {
                kind: "const";
                type: "string";
                value: "Transaction";
              },
              {
                kind: "account";
                type: "publicKey";
                account: "Smallet";
                path: "smallet";
              },
              {
                kind: "account";
                type: "u64";
                account: "Smallet";
                path: "smallet.num_transactions";
              }
            ];
          };
        },
        {
          name: "proposer";
          isMut: false;
          isSigner: true;
        },
        {
          name: "payer";
          isMut: true;
          isSigner: true;
        },
        {
          name: "systemProgram";
          isMut: false;
          isSigner: false;
        }
      ];
      args: [
        {
          name: "bump";
          type: "u8";
        },
        {
          name: "instructions";
          type: {
            vec: {
              defined: "TXInstruction";
            };
          };
        },
        {
          name: "eta";
          type: "i64";
        }
      ];
    },
    {
      name: "approve";
      accounts: [
        {
          name: "smallet";
          isMut: false;
          isSigner: false;
        },
        {
          name: "transaction";
          isMut: true;
          isSigner: false;
        },
        {
          name: "owner";
          isMut: false;
          isSigner: true;
        }
      ];
      args: [];
    },
    {
      name: "unapprove";
      accounts: [
        {
          name: "smallet";
          isMut: false;
          isSigner: false;
        },
        {
          name: "transaction";
          isMut: true;
          isSigner: false;
        },
        {
          name: "owner";
          isMut: false;
          isSigner: true;
        }
      ];
      args: [];
    },
    {
      name: "executeTransaction";
      accounts: [
        {
          name: "smallet";
          isMut: false;
          isSigner: false;
        },
        {
          name: "transaction";
          isMut: true;
          isSigner: false;
        },
        {
          name: "owner";
          isMut: false;
          isSigner: true;
        }
      ];
      args: [];
    },
    {
      name: "executeTransactionDerived";
      accounts: [
        {
          name: "smallet";
          isMut: false;
          isSigner: false;
        },
        {
          name: "transaction";
          isMut: true;
          isSigner: false;
        },
        {
          name: "owner";
          isMut: false;
          isSigner: true;
        }
      ];
      args: [
        {
          name: "index";
          type: "u64";
        },
        {
          name: "bump";
          type: "u8";
        }
      ];
    },
    {
      name: "ownerInvokeInstruction";
      accounts: [
        {
          name: "smallet";
          isMut: false;
          isSigner: false;
        },
        {
          name: "owner";
          isMut: false;
          isSigner: true;
        }
      ];
      args: [
        {
          name: "index";
          type: "u64";
        },
        {
          name: "bump";
          type: "u8";
        },
        {
          name: "ix";
          type: {
            defined: "TXInstruction";
          };
        }
      ];
    },
    {
      name: "ownerInvokeInstructionV2";
      accounts: [
        {
          name: "smallet";
          isMut: false;
          isSigner: false;
        },
        {
          name: "owner";
          isMut: false;
          isSigner: true;
        }
      ];
      args: [
        {
          name: "index";
          type: "u64";
        },
        {
          name: "bump";
          type: "u8";
        },
        {
          name: "invoker";
          type: "publicKey";
        },
        {
          name: "data";
          type: "bytes";
        }
      ];
    },
    {
      name: "createSubaccountInfo";
      accounts: [
        {
          name: "subaccountInfo";
          isMut: true;
          isSigner: false;
          pda: {
            seeds: [
              {
                kind: "const";
                type: "string";
                value: "SubaccountInfo";
              },
              {
                kind: "arg";
                type: "publicKey";
                path: "subaccount";
              }
            ];
          };
        },
        {
          name: "payer";
          isMut: true;
          isSigner: true;
        },
        {
          name: "systemProgram";
          isMut: false;
          isSigner: false;
        }
      ];
      args: [
        {
          name: "bump";
          type: "u8";
        },
        {
          name: "subaccount";
          type: "publicKey";
        },
        {
          name: "smallet";
          type: "publicKey";
        },
        {
          name: "index";
          type: "u64";
        },
        {
          name: "subaccountType";
          type: {
            defined: "SubaccountType";
          };
        }
      ];
    },
    {
      name: "setSession";
      accounts: [
        {
          name: "smallet";
          isMut: true;
          isSigner: false;
        },
        {
          name: "owner";
          isMut: false;
          isSigner: true;
        }
      ];
      args: [
        {
          name: "expiresAt";
          type: {
            option: "i64";
          };
        }
      ];
    },
    {
      name: "setFrozen";
      accounts: [
        {
          name: "smallet";
          isMut: true;
          isSigner: true;
        }
      ];
      args: [
        {
          name: "frozen";
          type: "bool";
        }
      ];
    },
    {
      name: "setFrozenAdmin";
      accounts: [
        {
          name: "smallet";
          isMut: true;
          isSigner: false;
        },
        {
          name: "globalState";
          isMut: false;
          isSigner: false;
        },
        {
          name: "admin";
          isMut: true;
          isSigner: true;
        }
      ];
      args: [
        {
          name: "frozen";
          type: "bool";
        }
      ];
    },
    {
      name: "lockSmallet";
      accounts: [
        {
          name: "guadian";
          isMut: true;
          isSigner: true;
        },
        {
          name: "globalState";
          isMut: false;
          isSigner: false;
        },
        {
          name: "smallet";
          isMut: true;
          isSigner: false;
        }
      ];
      args: [];
    },
    {
      name: "createGuadianAction";
      accounts: [
        {
          name: "guadian";
          isMut: true;
          isSigner: true;
        },
        {
          name: "globalState";
          isMut: false;
          isSigner: false;
        },
        {
          name: "smallet";
          isMut: true;
          isSigner: false;
        },
        {
          name: "guadianAction";
          isMut: true;
          isSigner: false;
          pda: {
            seeds: [
              {
                kind: "const";
                type: "string";
                value: "GuadianAction";
              },
              {
                kind: "account";
                type: "publicKey";
                account: "Smallet";
                path: "smallet";
              },
              {
                kind: "account";
                type: "u64";
                account: "Smallet";
                path: "smallet.num_gudian_actions";
              }
            ];
          };
        },
        {
          name: "systemProgram";
          isMut: false;
          isSigner: false;
        }
      ];
      args: [
        {
          name: "actionType";
          type: {
            defined: "GuadianActionType";
          };
        },
        {
          name: "guadiansCount";
          type: "u8";
        },
        {
          name: "addressesCount";
          type: "u8";
        }
      ];
    },
    {
      name: "tryActionWithSign";
      accounts: [
        {
          name: "guadian";
          isMut: true;
          isSigner: true;
        },
        {
          name: "globalState";
          isMut: false;
          isSigner: false;
        },
        {
          name: "smallet";
          isMut: true;
          isSigner: false;
        },
        {
          name: "guadianAction";
          isMut: true;
          isSigner: false;
          pda: {
            seeds: [
              {
                kind: "const";
                type: "string";
                value: "GuadianAction";
              },
              {
                kind: "account";
                type: "publicKey";
                account: "Smallet";
                path: "smallet";
              },
              {
                kind: "arg";
                type: "u64";
                path: "index";
              }
            ];
          };
        }
      ];
      args: [
        {
          name: "index";
          type: "u64";
        }
      ];
    }
  ];
  accounts: [
    {
      name: "GlobalState";
      type: {
        kind: "struct";
        fields: [
          {
            name: "globalAdmin";
            type: "publicKey";
          },
          {
            name: "guadiansChangePeriod";
            type: "i64";
          },
          {
            name: "guadiansActionExpiresTime";
            type: "i64";
          },
          {
            name: "minAgreePermyriad";
            type: "u16";
          }
        ];
      };
    },
    {
      name: "Smallet";
      type: {
        kind: "struct";
        fields: [
          {
            name: "base";
            type: "publicKey";
          },
          {
            name: "bump";
            type: "u8";
          },
          {
            name: "threshold";
            type: "u64";
          },
          {
            name: "minimumDelay";
            type: "i64";
          },
          {
            name: "gracePeriod";
            type: "i64";
          },
          {
            name: "ownerSetSeqno";
            type: "u32";
          },
          {
            name: "numTransactions";
            type: "u64";
          },
          {
            name: "owners";
            type: {
              vec: "publicKey";
            };
          },
          {
            name: "ownerSessions";
            type: {
              vec: "i64";
            };
          },
          {
            name: "guadians";
            type: {
              vec: "publicKey";
            };
          },
          {
            name: "numGudianActions";
            type: "u64";
          },
          {
            name: "frozen";
            type: "bool";
          },
          {
            name: "locked";
            type: "bool";
          },
          {
            name: "reserved";
            type: {
              array: ["u64", 16];
            };
          }
        ];
      };
    },
    {
      name: "GuadianAction";
      type: {
        kind: "struct";
        fields: [
          {
            name: "smallet";
            type: "publicKey";
          },
          {
            name: "actionRequestedTime";
            type: "i64";
          },
          {
            name: "actionType";
            type: {
              defined: "GuadianActionType";
            };
          },
          {
            name: "performed";
            type: "bool";
          },
          {
            name: "agreedSigns";
            type: {
              vec: "bool";
            };
          },
          {
            name: "addresses";
            type: {
              vec: "publicKey";
            };
          }
        ];
      };
    },
    {
      name: "Transaction";
      type: {
        kind: "struct";
        fields: [
          {
            name: "smallet";
            type: "publicKey";
          },
          {
            name: "index";
            type: "u64";
          },
          {
            name: "bump";
            type: "u8";
          },
          {
            name: "proposer";
            type: "publicKey";
          },
          {
            name: "instructions";
            type: {
              vec: {
                defined: "TXInstruction";
              };
            };
          },
          {
            name: "signers";
            type: {
              vec: "bool";
            };
          },
          {
            name: "ownerSetSeqno";
            type: "u32";
          },
          {
            name: "eta";
            type: "i64";
          },
          {
            name: "executor";
            type: "publicKey";
          },
          {
            name: "executedAt";
            type: "i64";
          }
        ];
      };
    },
    {
      name: "SubaccountInfo";
      type: {
        kind: "struct";
        fields: [
          {
            name: "smallet";
            type: "publicKey";
          },
          {
            name: "subaccountType";
            type: {
              defined: "SubaccountType";
            };
          },
          {
            name: "index";
            type: "u64";
          }
        ];
      };
    }
  ];
  types: [
    {
      name: "TXInstruction";
      type: {
        kind: "struct";
        fields: [
          {
            name: "programId";
            type: "publicKey";
          },
          {
            name: "keys";
            type: {
              vec: {
                defined: "TXAccountMeta";
              };
            };
          },
          {
            name: "data";
            type: "bytes";
          }
        ];
      };
    },
    {
      name: "TXAccountMeta";
      type: {
        kind: "struct";
        fields: [
          {
            name: "pubkey";
            type: "publicKey";
          },
          {
            name: "isSigner";
            type: "bool";
          },
          {
            name: "isWritable";
            type: "bool";
          }
        ];
      };
    },
    {
      name: "GuadianActionType";
      type: {
        kind: "enum";
        variants: [
          {
            name: "NoAction";
          },
          {
            name: "UnlockSmallet";
          },
          {
            name: "SetOwners";
          },
          {
            name: "SetGuadians";
          }
        ];
      };
    },
    {
      name: "SubaccountType";
      type: {
        kind: "enum";
        variants: [
          {
            name: "Derived";
          },
          {
            name: "OwnerInvoker";
          }
        ];
      };
    }
  ];
  events: [
    {
      name: "WalletCreateEvent";
      fields: [
        {
          name: "smallet";
          type: "publicKey";
          index: true;
        },
        {
          name: "owners";
          type: {
            vec: "publicKey";
          };
          index: false;
        },
        {
          name: "threshold";
          type: "u64";
          index: false;
        },
        {
          name: "minimumDelay";
          type: "i64";
          index: false;
        },
        {
          name: "timestamp";
          type: "i64";
          index: false;
        }
      ];
    },
    {
      name: "WalletSetOwnersEvent";
      fields: [
        {
          name: "smallet";
          type: "publicKey";
          index: true;
        },
        {
          name: "owners";
          type: {
            vec: "publicKey";
          };
          index: false;
        },
        {
          name: "timestamp";
          type: "i64";
          index: false;
        }
      ];
    },
    {
      name: "WalletChangeThresholdEvent";
      fields: [
        {
          name: "smallet";
          type: "publicKey";
          index: true;
        },
        {
          name: "threshold";
          type: "u64";
          index: false;
        },
        {
          name: "timestamp";
          type: "i64";
          index: false;
        }
      ];
    },
    {
      name: "TransactionCreateEvent";
      fields: [
        {
          name: "smallet";
          type: "publicKey";
          index: true;
        },
        {
          name: "transaction";
          type: "publicKey";
          index: true;
        },
        {
          name: "proposer";
          type: "publicKey";
          index: false;
        },
        {
          name: "instructions";
          type: {
            vec: {
              defined: "TXInstruction";
            };
          };
          index: false;
        },
        {
          name: "eta";
          type: "i64";
          index: false;
        },
        {
          name: "timestamp";
          type: "i64";
          index: false;
        }
      ];
    },
    {
      name: "TransactionApproveEvent";
      fields: [
        {
          name: "smallet";
          type: "publicKey";
          index: true;
        },
        {
          name: "transaction";
          type: "publicKey";
          index: true;
        },
        {
          name: "owner";
          type: "publicKey";
          index: false;
        },
        {
          name: "timestamp";
          type: "i64";
          index: false;
        }
      ];
    },
    {
      name: "TransactionUnapproveEvent";
      fields: [
        {
          name: "smallet";
          type: "publicKey";
          index: true;
        },
        {
          name: "transaction";
          type: "publicKey";
          index: true;
        },
        {
          name: "owner";
          type: "publicKey";
          index: false;
        },
        {
          name: "timestamp";
          type: "i64";
          index: false;
        }
      ];
    },
    {
      name: "TransactionExecuteEvent";
      fields: [
        {
          name: "smallet";
          type: "publicKey";
          index: true;
        },
        {
          name: "transaction";
          type: "publicKey";
          index: true;
        },
        {
          name: "executor";
          type: "publicKey";
          index: false;
        },
        {
          name: "timestamp";
          type: "i64";
          index: false;
        }
      ];
    },
    {
      name: "OwnerSetSessionEvent";
      fields: [
        {
          name: "smallet";
          type: "publicKey";
          index: true;
        },
        {
          name: "expiresAt";
          type: "i64";
          index: false;
        },
        {
          name: "timestamp";
          type: "i64";
          index: false;
        }
      ];
    },
    {
      name: "OwnerSetFrozenEvent";
      fields: [
        {
          name: "smallet";
          type: "publicKey";
          index: true;
        },
        {
          name: "frozen";
          type: "bool";
          index: false;
        },
        {
          name: "timestamp";
          type: "i64";
          index: false;
        }
      ];
    }
  ];
  errors: [
    {
      code: 6000;
      name: "InvalidOwner";
      msg: "The given owner is not part of this smallet.";
    },
    {
      code: 6001;
      name: "InvalidGlobalAdmin";
      msg: "The given owner is not the global admin.";
    },
    {
      code: 6002;
      name: "InvalidDeployer";
      msg: "Global state initializer does not match the deployer of program";
    },
    {
      code: 6003;
      name: "InvalidProgramDataAccount";
      msg: "Invalid ProgramData account";
    },
    {
      code: 6004;
      name: "InvalidETA";
      msg: "Estimated execution block must satisfy delay.";
    },
    {
      code: 6005;
      name: "DelayTooHigh";
      msg: "Delay greater than the maximum.";
    },
    {
      code: 6006;
      name: "NotEnoughSigners";
      msg: "Not enough owners signed this transaction.";
    },
    {
      code: 6007;
      name: "TransactionIsStale";
      msg: "Transaction is past the grace period.";
    },
    {
      code: 6008;
      name: "TransactionNotReady";
      msg: "Transaction hasn't surpassed time lock.";
    },
    {
      code: 6009;
      name: "AlreadyExecuted";
      msg: "The given transaction has already been executed.";
    },
    {
      code: 6010;
      name: "InvalidThreshold";
      msg: "Threshold must be less than or equal to the number of owners.";
    },
    {
      code: 6011;
      name: "OwnerSetChanged";
      msg: "Owner set has changed since the creation of the transaction.";
    },
    {
      code: 6012;
      name: "SubaccountOwnerMismatch";
      msg: "Subaccount does not belong to smallet.";
    },
    {
      code: 6013;
      name: "BufferFinalized";
      msg: "Buffer already finalized.";
    },
    {
      code: 6014;
      name: "BufferBundleNotFound";
      msg: "Buffer bundle not found.";
    },
    {
      code: 6015;
      name: "BufferBundleOutOfRange";
      msg: "Buffer index specified is out of range.";
    },
    {
      code: 6016;
      name: "BufferBundleNotFinalized";
      msg: "Buffer has not been finalized.";
    },
    {
      code: 6017;
      name: "BufferBundleExecuted";
      msg: "Buffer bundle has already been executed.";
    },
    {
      code: 6018;
      name: "AccountFrozen";
      msg: "The Smallet account is frozen.";
    },
    {
      code: 6019;
      name: "InvalidGuadian";
      msg: "The given address is not guadian or global admin.";
    },
    {
      code: 6020;
      name: "IncorrectGuadiansCount";
      msg: "The given guadians count not matched with smallet guadians count.";
    },
    {
      code: 6021;
      name: "IncorrectAddressesCount";
      msg: "The given new addresses count not matched with remaining account of context.";
    },
    {
      code: 6022;
      name: "ActionExpired";
      msg: "Passed expiration time for enough sign to perform the guadian action.";
    },
    {
      code: 6023;
      name: "NotEnoughChangePeriod";
      msg: "Not enough time passed to change guadians.";
    },
    {
      code: 6024;
      name: "InvalidGuadianAction";
      msg: "Guadian action's smallet address not matched with provided smallet account.";
    },
    {
      code: 6025;
      name: "ActionAlreadyPerformed";
      msg: "Guadian action is already performed.";
    }
  ];
};
export const SmalletJSON: SmalletIDL = {
  version: "0.11.1",
  name: "smallet",
  instructions: [
    {
      name: "initializeGlobalState",
      accounts: [
        {
          name: "admin",
          isMut: true,
          isSigner: true,
        },
        {
          name: "globalState",
          isMut: true,
          isSigner: false,
          pda: {
            seeds: [
              {
                kind: "const",
                type: "string",
                value: "Smallet",
              },
            ],
          },
        },
        {
          name: "systemProgram",
          isMut: false,
          isSigner: false,
        },
        {
          name: "rent",
          isMut: false,
          isSigner: false,
        },
      ],
      args: [],
    },
    {
      name: "transferGlobalAdmin",
      accounts: [
        {
          name: "globalState",
          isMut: true,
          isSigner: false,
        },
        {
          name: "admin",
          isMut: true,
          isSigner: true,
        },
      ],
      args: [
        {
          name: "newAdmin",
          type: "publicKey",
        },
      ],
    },
    {
      name: "setGlobalThresholds",
      accounts: [
        {
          name: "globalState",
          isMut: true,
          isSigner: false,
        },
        {
          name: "admin",
          isMut: true,
          isSigner: true,
        },
      ],
      args: [
        {
          name: "changePeriod",
          type: {
            option: "i64",
          },
        },
        {
          name: "actionExpires",
          type: {
            option: "i64",
          },
        },
        {
          name: "agreePermyriad",
          type: {
            option: "u16",
          },
        },
      ],
    },
    {
      name: "createSmallet",
      accounts: [
        {
          name: "base",
          isMut: false,
          isSigner: true,
        },
        {
          name: "smallet",
          isMut: true,
          isSigner: false,
          pda: {
            seeds: [
              {
                kind: "const",
                type: "string",
                value: "Smallet",
              },
              {
                kind: "account",
                type: "publicKey",
                path: "base",
              },
            ],
          },
        },
        {
          name: "payer",
          isMut: true,
          isSigner: true,
        },
        {
          name: "systemProgram",
          isMut: false,
          isSigner: false,
        },
      ],
      args: [
        {
          name: "bump",
          type: "u8",
        },
        {
          name: "maxOwners",
          type: "u8",
        },
        {
          name: "owners",
          type: {
            vec: "publicKey",
          },
        },
        {
          name: "threshold",
          type: "u64",
        },
        {
          name: "minimumDelay",
          type: "i64",
        },
        {
          name: "gudiansCount",
          type: "u8",
        },
        {
          name: "gudians",
          type: {
            vec: "publicKey",
          },
        },
      ],
    },
    {
      name: "setOwners",
      accounts: [
        {
          name: "smallet",
          isMut: true,
          isSigner: true,
        },
      ],
      args: [
        {
          name: "owners",
          type: {
            vec: "publicKey",
          },
        },
      ],
    },
    {
      name: "changeThreshold",
      accounts: [
        {
          name: "smallet",
          isMut: true,
          isSigner: true,
        },
      ],
      args: [
        {
          name: "threshold",
          type: "u64",
        },
      ],
    },
    {
      name: "createTransaction",
      accounts: [
        {
          name: "smallet",
          isMut: true,
          isSigner: false,
        },
        {
          name: "transaction",
          isMut: true,
          isSigner: false,
          pda: {
            seeds: [
              {
                kind: "const",
                type: "string",
                value: "Transaction",
              },
              {
                kind: "account",
                type: "publicKey",
                account: "Smallet",
                path: "smallet",
              },
              {
                kind: "account",
                type: "u64",
                account: "Smallet",
                path: "smallet.num_transactions",
              },
            ],
          },
        },
        {
          name: "proposer",
          isMut: false,
          isSigner: true,
        },
        {
          name: "payer",
          isMut: true,
          isSigner: true,
        },
        {
          name: "systemProgram",
          isMut: false,
          isSigner: false,
        },
      ],
      args: [
        {
          name: "bump",
          type: "u8",
        },
        {
          name: "instructions",
          type: {
            vec: {
              defined: "TXInstruction",
            },
          },
        },
      ],
    },
    {
      name: "createTransactionWithTimelock",
      accounts: [
        {
          name: "smallet",
          isMut: true,
          isSigner: false,
        },
        {
          name: "transaction",
          isMut: true,
          isSigner: false,
          pda: {
            seeds: [
              {
                kind: "const",
                type: "string",
                value: "Transaction",
              },
              {
                kind: "account",
                type: "publicKey",
                account: "Smallet",
                path: "smallet",
              },
              {
                kind: "account",
                type: "u64",
                account: "Smallet",
                path: "smallet.num_transactions",
              },
            ],
          },
        },
        {
          name: "proposer",
          isMut: false,
          isSigner: true,
        },
        {
          name: "payer",
          isMut: true,
          isSigner: true,
        },
        {
          name: "systemProgram",
          isMut: false,
          isSigner: false,
        },
      ],
      args: [
        {
          name: "bump",
          type: "u8",
        },
        {
          name: "instructions",
          type: {
            vec: {
              defined: "TXInstruction",
            },
          },
        },
        {
          name: "eta",
          type: "i64",
        },
      ],
    },
    {
      name: "approve",
      accounts: [
        {
          name: "smallet",
          isMut: false,
          isSigner: false,
        },
        {
          name: "transaction",
          isMut: true,
          isSigner: false,
        },
        {
          name: "owner",
          isMut: false,
          isSigner: true,
        },
      ],
      args: [],
    },
    {
      name: "unapprove",
      accounts: [
        {
          name: "smallet",
          isMut: false,
          isSigner: false,
        },
        {
          name: "transaction",
          isMut: true,
          isSigner: false,
        },
        {
          name: "owner",
          isMut: false,
          isSigner: true,
        },
      ],
      args: [],
    },
    {
      name: "executeTransaction",
      accounts: [
        {
          name: "smallet",
          isMut: false,
          isSigner: false,
        },
        {
          name: "transaction",
          isMut: true,
          isSigner: false,
        },
        {
          name: "owner",
          isMut: false,
          isSigner: true,
        },
      ],
      args: [],
    },
    {
      name: "executeTransactionDerived",
      accounts: [
        {
          name: "smallet",
          isMut: false,
          isSigner: false,
        },
        {
          name: "transaction",
          isMut: true,
          isSigner: false,
        },
        {
          name: "owner",
          isMut: false,
          isSigner: true,
        },
      ],
      args: [
        {
          name: "index",
          type: "u64",
        },
        {
          name: "bump",
          type: "u8",
        },
      ],
    },
    {
      name: "ownerInvokeInstruction",
      accounts: [
        {
          name: "smallet",
          isMut: false,
          isSigner: false,
        },
        {
          name: "owner",
          isMut: false,
          isSigner: true,
        },
      ],
      args: [
        {
          name: "index",
          type: "u64",
        },
        {
          name: "bump",
          type: "u8",
        },
        {
          name: "ix",
          type: {
            defined: "TXInstruction",
          },
        },
      ],
    },
    {
      name: "ownerInvokeInstructionV2",
      accounts: [
        {
          name: "smallet",
          isMut: false,
          isSigner: false,
        },
        {
          name: "owner",
          isMut: false,
          isSigner: true,
        },
      ],
      args: [
        {
          name: "index",
          type: "u64",
        },
        {
          name: "bump",
          type: "u8",
        },
        {
          name: "invoker",
          type: "publicKey",
        },
        {
          name: "data",
          type: "bytes",
        },
      ],
    },
    {
      name: "createSubaccountInfo",
      accounts: [
        {
          name: "subaccountInfo",
          isMut: true,
          isSigner: false,
          pda: {
            seeds: [
              {
                kind: "const",
                type: "string",
                value: "SubaccountInfo",
              },
              {
                kind: "arg",
                type: "publicKey",
                path: "subaccount",
              },
            ],
          },
        },
        {
          name: "payer",
          isMut: true,
          isSigner: true,
        },
        {
          name: "systemProgram",
          isMut: false,
          isSigner: false,
        },
      ],
      args: [
        {
          name: "bump",
          type: "u8",
        },
        {
          name: "subaccount",
          type: "publicKey",
        },
        {
          name: "smallet",
          type: "publicKey",
        },
        {
          name: "index",
          type: "u64",
        },
        {
          name: "subaccountType",
          type: {
            defined: "SubaccountType",
          },
        },
      ],
    },
    {
      name: "setSession",
      accounts: [
        {
          name: "smallet",
          isMut: true,
          isSigner: false,
        },
        {
          name: "owner",
          isMut: false,
          isSigner: true,
        },
      ],
      args: [
        {
          name: "expiresAt",
          type: {
            option: "i64",
          },
        },
      ],
    },
    {
      name: "setFrozen",
      accounts: [
        {
          name: "smallet",
          isMut: true,
          isSigner: true,
        },
      ],
      args: [
        {
          name: "frozen",
          type: "bool",
        },
      ],
    },
    {
      name: "setFrozenAdmin",
      accounts: [
        {
          name: "smallet",
          isMut: true,
          isSigner: false,
        },
        {
          name: "globalState",
          isMut: false,
          isSigner: false,
        },
        {
          name: "admin",
          isMut: true,
          isSigner: true,
        },
      ],
      args: [
        {
          name: "frozen",
          type: "bool",
        },
      ],
    },
    {
      name: "lockSmallet",
      accounts: [
        {
          name: "guadian",
          isMut: true,
          isSigner: true,
        },
        {
          name: "globalState",
          isMut: false,
          isSigner: false,
        },
        {
          name: "smallet",
          isMut: true,
          isSigner: false,
        },
      ],
      args: [],
    },
    {
      name: "createGuadianAction",
      accounts: [
        {
          name: "guadian",
          isMut: true,
          isSigner: true,
        },
        {
          name: "globalState",
          isMut: false,
          isSigner: false,
        },
        {
          name: "smallet",
          isMut: true,
          isSigner: false,
        },
        {
          name: "guadianAction",
          isMut: true,
          isSigner: false,
          pda: {
            seeds: [
              {
                kind: "const",
                type: "string",
                value: "GuadianAction",
              },
              {
                kind: "account",
                type: "publicKey",
                account: "Smallet",
                path: "smallet",
              },
              {
                kind: "account",
                type: "u64",
                account: "Smallet",
                path: "smallet.num_gudian_actions",
              },
            ],
          },
        },
        {
          name: "systemProgram",
          isMut: false,
          isSigner: false,
        },
      ],
      args: [
        {
          name: "actionType",
          type: {
            defined: "GuadianActionType",
          },
        },
        {
          name: "guadiansCount",
          type: "u8",
        },
        {
          name: "addressesCount",
          type: "u8",
        },
      ],
    },
    {
      name: "tryActionWithSign",
      accounts: [
        {
          name: "guadian",
          isMut: true,
          isSigner: true,
        },
        {
          name: "globalState",
          isMut: false,
          isSigner: false,
        },
        {
          name: "smallet",
          isMut: true,
          isSigner: false,
        },
        {
          name: "guadianAction",
          isMut: true,
          isSigner: false,
          pda: {
            seeds: [
              {
                kind: "const",
                type: "string",
                value: "GuadianAction",
              },
              {
                kind: "account",
                type: "publicKey",
                account: "Smallet",
                path: "smallet",
              },
              {
                kind: "arg",
                type: "u64",
                path: "index",
              },
            ],
          },
        },
      ],
      args: [
        {
          name: "index",
          type: "u64",
        },
      ],
    },
  ],
  accounts: [
    {
      name: "GlobalState",
      type: {
        kind: "struct",
        fields: [
          {
            name: "globalAdmin",
            type: "publicKey",
          },
          {
            name: "guadiansChangePeriod",
            type: "i64",
          },
          {
            name: "guadiansActionExpiresTime",
            type: "i64",
          },
          {
            name: "minAgreePermyriad",
            type: "u16",
          },
        ],
      },
    },
    {
      name: "Smallet",
      type: {
        kind: "struct",
        fields: [
          {
            name: "base",
            type: "publicKey",
          },
          {
            name: "bump",
            type: "u8",
          },
          {
            name: "threshold",
            type: "u64",
          },
          {
            name: "minimumDelay",
            type: "i64",
          },
          {
            name: "gracePeriod",
            type: "i64",
          },
          {
            name: "ownerSetSeqno",
            type: "u32",
          },
          {
            name: "numTransactions",
            type: "u64",
          },
          {
            name: "owners",
            type: {
              vec: "publicKey",
            },
          },
          {
            name: "ownerSessions",
            type: {
              vec: "i64",
            },
          },
          {
            name: "guadians",
            type: {
              vec: "publicKey",
            },
          },
          {
            name: "numGudianActions",
            type: "u64",
          },
          {
            name: "frozen",
            type: "bool",
          },
          {
            name: "locked",
            type: "bool",
          },
          {
            name: "reserved",
            type: {
              array: ["u64", 16],
            },
          },
        ],
      },
    },
    {
      name: "GuadianAction",
      type: {
        kind: "struct",
        fields: [
          {
            name: "smallet",
            type: "publicKey",
          },
          {
            name: "actionRequestedTime",
            type: "i64",
          },
          {
            name: "actionType",
            type: {
              defined: "GuadianActionType",
            },
          },
          {
            name: "performed",
            type: "bool",
          },
          {
            name: "agreedSigns",
            type: {
              vec: "bool",
            },
          },
          {
            name: "addresses",
            type: {
              vec: "publicKey",
            },
          },
        ],
      },
    },
    {
      name: "Transaction",
      type: {
        kind: "struct",
        fields: [
          {
            name: "smallet",
            type: "publicKey",
          },
          {
            name: "index",
            type: "u64",
          },
          {
            name: "bump",
            type: "u8",
          },
          {
            name: "proposer",
            type: "publicKey",
          },
          {
            name: "instructions",
            type: {
              vec: {
                defined: "TXInstruction",
              },
            },
          },
          {
            name: "signers",
            type: {
              vec: "bool",
            },
          },
          {
            name: "ownerSetSeqno",
            type: "u32",
          },
          {
            name: "eta",
            type: "i64",
          },
          {
            name: "executor",
            type: "publicKey",
          },
          {
            name: "executedAt",
            type: "i64",
          },
        ],
      },
    },
    {
      name: "SubaccountInfo",
      type: {
        kind: "struct",
        fields: [
          {
            name: "smallet",
            type: "publicKey",
          },
          {
            name: "subaccountType",
            type: {
              defined: "SubaccountType",
            },
          },
          {
            name: "index",
            type: "u64",
          },
        ],
      },
    },
  ],
  types: [
    {
      name: "TXInstruction",
      type: {
        kind: "struct",
        fields: [
          {
            name: "programId",
            type: "publicKey",
          },
          {
            name: "keys",
            type: {
              vec: {
                defined: "TXAccountMeta",
              },
            },
          },
          {
            name: "data",
            type: "bytes",
          },
        ],
      },
    },
    {
      name: "TXAccountMeta",
      type: {
        kind: "struct",
        fields: [
          {
            name: "pubkey",
            type: "publicKey",
          },
          {
            name: "isSigner",
            type: "bool",
          },
          {
            name: "isWritable",
            type: "bool",
          },
        ],
      },
    },
    {
      name: "GuadianActionType",
      type: {
        kind: "enum",
        variants: [
          {
            name: "NoAction",
          },
          {
            name: "UnlockSmallet",
          },
          {
            name: "SetOwners",
          },
          {
            name: "SetGuadians",
          },
        ],
      },
    },
    {
      name: "SubaccountType",
      type: {
        kind: "enum",
        variants: [
          {
            name: "Derived",
          },
          {
            name: "OwnerInvoker",
          },
        ],
      },
    },
  ],
  events: [
    {
      name: "WalletCreateEvent",
      fields: [
        {
          name: "smallet",
          type: "publicKey",
          index: true,
        },
        {
          name: "owners",
          type: {
            vec: "publicKey",
          },
          index: false,
        },
        {
          name: "threshold",
          type: "u64",
          index: false,
        },
        {
          name: "minimumDelay",
          type: "i64",
          index: false,
        },
        {
          name: "timestamp",
          type: "i64",
          index: false,
        },
      ],
    },
    {
      name: "WalletSetOwnersEvent",
      fields: [
        {
          name: "smallet",
          type: "publicKey",
          index: true,
        },
        {
          name: "owners",
          type: {
            vec: "publicKey",
          },
          index: false,
        },
        {
          name: "timestamp",
          type: "i64",
          index: false,
        },
      ],
    },
    {
      name: "WalletChangeThresholdEvent",
      fields: [
        {
          name: "smallet",
          type: "publicKey",
          index: true,
        },
        {
          name: "threshold",
          type: "u64",
          index: false,
        },
        {
          name: "timestamp",
          type: "i64",
          index: false,
        },
      ],
    },
    {
      name: "TransactionCreateEvent",
      fields: [
        {
          name: "smallet",
          type: "publicKey",
          index: true,
        },
        {
          name: "transaction",
          type: "publicKey",
          index: true,
        },
        {
          name: "proposer",
          type: "publicKey",
          index: false,
        },
        {
          name: "instructions",
          type: {
            vec: {
              defined: "TXInstruction",
            },
          },
          index: false,
        },
        {
          name: "eta",
          type: "i64",
          index: false,
        },
        {
          name: "timestamp",
          type: "i64",
          index: false,
        },
      ],
    },
    {
      name: "TransactionApproveEvent",
      fields: [
        {
          name: "smallet",
          type: "publicKey",
          index: true,
        },
        {
          name: "transaction",
          type: "publicKey",
          index: true,
        },
        {
          name: "owner",
          type: "publicKey",
          index: false,
        },
        {
          name: "timestamp",
          type: "i64",
          index: false,
        },
      ],
    },
    {
      name: "TransactionUnapproveEvent",
      fields: [
        {
          name: "smallet",
          type: "publicKey",
          index: true,
        },
        {
          name: "transaction",
          type: "publicKey",
          index: true,
        },
        {
          name: "owner",
          type: "publicKey",
          index: false,
        },
        {
          name: "timestamp",
          type: "i64",
          index: false,
        },
      ],
    },
    {
      name: "TransactionExecuteEvent",
      fields: [
        {
          name: "smallet",
          type: "publicKey",
          index: true,
        },
        {
          name: "transaction",
          type: "publicKey",
          index: true,
        },
        {
          name: "executor",
          type: "publicKey",
          index: false,
        },
        {
          name: "timestamp",
          type: "i64",
          index: false,
        },
      ],
    },
    {
      name: "OwnerSetSessionEvent",
      fields: [
        {
          name: "smallet",
          type: "publicKey",
          index: true,
        },
        {
          name: "expiresAt",
          type: "i64",
          index: false,
        },
        {
          name: "timestamp",
          type: "i64",
          index: false,
        },
      ],
    },
    {
      name: "OwnerSetFrozenEvent",
      fields: [
        {
          name: "smallet",
          type: "publicKey",
          index: true,
        },
        {
          name: "frozen",
          type: "bool",
          index: false,
        },
        {
          name: "timestamp",
          type: "i64",
          index: false,
        },
      ],
    },
  ],
  errors: [
    {
      code: 6000,
      name: "InvalidOwner",
      msg: "The given owner is not part of this smallet.",
    },
    {
      code: 6001,
      name: "InvalidGlobalAdmin",
      msg: "The given owner is not the global admin.",
    },
    {
      code: 6002,
      name: "InvalidDeployer",
      msg: "Global state initializer does not match the deployer of program",
    },
    {
      code: 6003,
      name: "InvalidProgramDataAccount",
      msg: "Invalid ProgramData account",
    },
    {
      code: 6004,
      name: "InvalidETA",
      msg: "Estimated execution block must satisfy delay.",
    },
    {
      code: 6005,
      name: "DelayTooHigh",
      msg: "Delay greater than the maximum.",
    },
    {
      code: 6006,
      name: "NotEnoughSigners",
      msg: "Not enough owners signed this transaction.",
    },
    {
      code: 6007,
      name: "TransactionIsStale",
      msg: "Transaction is past the grace period.",
    },
    {
      code: 6008,
      name: "TransactionNotReady",
      msg: "Transaction hasn't surpassed time lock.",
    },
    {
      code: 6009,
      name: "AlreadyExecuted",
      msg: "The given transaction has already been executed.",
    },
    {
      code: 6010,
      name: "InvalidThreshold",
      msg: "Threshold must be less than or equal to the number of owners.",
    },
    {
      code: 6011,
      name: "OwnerSetChanged",
      msg: "Owner set has changed since the creation of the transaction.",
    },
    {
      code: 6012,
      name: "SubaccountOwnerMismatch",
      msg: "Subaccount does not belong to smallet.",
    },
    {
      code: 6013,
      name: "BufferFinalized",
      msg: "Buffer already finalized.",
    },
    {
      code: 6014,
      name: "BufferBundleNotFound",
      msg: "Buffer bundle not found.",
    },
    {
      code: 6015,
      name: "BufferBundleOutOfRange",
      msg: "Buffer index specified is out of range.",
    },
    {
      code: 6016,
      name: "BufferBundleNotFinalized",
      msg: "Buffer has not been finalized.",
    },
    {
      code: 6017,
      name: "BufferBundleExecuted",
      msg: "Buffer bundle has already been executed.",
    },
    {
      code: 6018,
      name: "AccountFrozen",
      msg: "The Smallet account is frozen.",
    },
    {
      code: 6019,
      name: "InvalidGuadian",
      msg: "The given address is not guadian or global admin.",
    },
    {
      code: 6020,
      name: "IncorrectGuadiansCount",
      msg: "The given guadians count not matched with smallet guadians count.",
    },
    {
      code: 6021,
      name: "IncorrectAddressesCount",
      msg: "The given new addresses count not matched with remaining account of context.",
    },
    {
      code: 6022,
      name: "ActionExpired",
      msg: "Passed expiration time for enough sign to perform the guadian action.",
    },
    {
      code: 6023,
      name: "NotEnoughChangePeriod",
      msg: "Not enough time passed to change guadians.",
    },
    {
      code: 6024,
      name: "InvalidGuadianAction",
      msg: "Guadian action's smallet address not matched with provided smallet account.",
    },
    {
      code: 6025,
      name: "ActionAlreadyPerformed",
      msg: "Guadian action is already performed.",
    },
  ],
};
export const SmalletErrors = generateErrorMap(SmalletJSON);
