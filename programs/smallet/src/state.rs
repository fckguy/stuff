//! State structs
#![allow(missing_docs)]

use anchor_lang::prelude::*;
use anchor_lang::solana_program;
use vipers::prelude::*;

// Constants
const NO_ETA: i64 = -1;
const MAX_DELAY_SECONDS: i64 = 3600 * 36; // 36 hours

// Global state for the program.
#[account]
#[derive(Default, Debug)]
pub struct GlobalState {
    pub global_admin: Pubkey,
    pub guardians_change_period: i64,
    pub guardians_action_expires_time: i64,
    pub min_agree_permyriad: u16,
}

impl GlobalState {
    pub const LEN: usize = 8 + 32 + 8 + 8 + 2;

    pub fn is_global_admin(&self, address: &Pubkey) -> bool {
        self.global_admin.eq(address)
    }
}

// Main account representing a Smallet.
#[account]
#[derive(Default, Debug, PartialEq)]
pub struct Smallet {
    pub base: Pubkey,
    pub bump: u8,
    pub threshold: u64,
    pub minimum_delay: i64,
    pub grace_period: i64,
    pub owner_set_seqno: u32,
    pub num_transactions: u64,
    pub owners: Vec<Pubkey>,
    pub owner_sessions: Vec<i64>,
    pub guardians: Vec<Pubkey>,
    pub num_gudian_actions: u64,
    pub frozen: bool,
    pub locked: bool,
    pub reserved: [u64; 16],
}

impl Smallet {
    pub fn space(max_owners: u8, max_guardians: u8) -> usize {
        8 + 207 + 4 + std::mem::size_of::<Pubkey>() * (max_owners as usize)
            + 4 + std::mem::size_of::<i64>() * (max_owners as usize)
            + 4 + std::mem::size_of::<Pubkey>() * (max_guardians as usize)
    }

    pub fn owner_index_opt(&self, key: Pubkey) -> Option<usize> {
        self.owners.iter().position(|a| *a == key)
    }

    pub fn try_owner_index(&self, key: Pubkey) -> Result<usize> {
        Ok(unwrap_opt!(self.owner_index_opt(key), InvalidOwner))
    }

    pub fn is_guardian(&self, guardian: &Pubkey) -> bool {
        self.guardians.contains(guardian)
    }

    pub fn guardian_index_opt(&self, key: Pubkey) -> Option<usize> {
        self.guardians.iter().position(|a| *a == key)
    }
}

#[derive(Clone, Copy, Default, Debug, PartialEq, AnchorDeserialize, AnchorSerialize)]
pub enum GuardianActionType {
    #[default]
    NoAction,
    UnlockSmallet,
    SetOwners,
    SetGuardians,
}

#[account]
#[derive(Default, Debug, PartialEq)]
pub struct GuardianAction {
    // The [Smallet]
    pub smallet: Pubkey,
    // Action requested time
    pub action_requested_time: i64,
    // Guardians action type
    pub action_type: GuardianActionType,
    // Performed status
    pub performed: bool,
    // Gudians sign to agree protect actions
    pub agreed_signs: Vec<bool>,
    // New addresses of owners or guardians
    pub addresses: Vec<Pubkey>,
}

impl GuardianAction {
    // Computes the space a [Smallet] uses.
    pub fn space(gudians_count: u8, addresses_count: u8) -> usize {
        8 // Anchor discriminator
            + 42
            + 4 // 4 = the Vec discriminator
            + std::mem::size_of::<Pubkey>() * (addresses_count as usize)
            + 4 // 4 = the Vec discriminator
            + std::mem::size_of::<bool>() * (gudians_count as usize)
    }

    // Clear all guardians sign
    pub fn clear_signs(&mut self) {
        self.agreed_signs = vec![false; self.agreed_signs.len()];
    }

    // Set a certain guardian as signed by index
    pub fn set_signed_with_index(&mut self, idx: usize) {
        if let Some(sign) = self.agreed_signs.get_mut(idx) {
            *sign = true;
        }
    }

    pub fn check_enough_sign(&self, min_permyriad: u16) -> bool {
        let mut min_required_signs =
            (self.agreed_signs.len() as u32 * min_permyriad as u32 / 10000) as usize + 1;

        if min_required_signs == self.agreed_signs.len() + 1 {
            min_required_signs = self.agreed_signs.len();
        }

        let signed_count = self.agreed_signs.iter().filter(|&signed| *signed).count();

        return min_required_signs <= signed_count;
    }
}

// A [Transaction] is a series of instructions that may be executed
// by a [Smallet].
#[account]
#[derive(Debug, Default, PartialEq)]
pub struct Transaction {
    // The [Smallet] account this transaction belongs to.
    pub smallet: Pubkey,
    // The auto-incremented integer index of the transaction.
    // All transactions on the [Smallet] can be looked up via this index,
    // allowing for easier browsing of a wallet's historical transactions.
    pub index: u64,
    // Bump seed.
    pub bump: u8,

    // The proposer of the [Transaction].
    pub proposer: Pubkey,
    // The instruction.
    pub instructions: Vec<TXInstruction>,
    // `signers[index]` is true iff `[Smallet]::owners[index]` signed the transaction.
    pub signers: Vec<bool>,
    // Owner set sequence number.
    pub owner_set_seqno: u32,
    // Estimated time the [Transaction] will be executed.
    // - If set to [crate::NO_ETA], the transaction may be executed at any time.
    // - Otherwise, the [Transaction] may be executed at any point after the ETA has elapsed.
    pub eta: i64,
    // The account that executed the [Transaction].
    pub executor: Pubkey,
    // When the transaction was executed. -1 if not executed.
    pub executed_at: i64,
}

impl Transaction {
    // Computes the space a [Transaction] uses.
    pub fn space(instructions: Vec<TXInstruction>) -> usize {
        8  // Anchor discriminator
            + std::mem::size_of::<Transaction>()
            + 4 // Vec discriminator
            + (instructions.iter().map(|ix| ix.space()).sum::<usize>())
    }
    // Number of signers.
    pub fn num_signers(&self, auto_signed_owners: &[i64], now: i64) -> usize {
        self.signers
            .iter()
            .zip(auto_signed_owners.iter())
            .filter(|(&signed, &auto_signed)| signed || auto_signed >= now)
            .count()
    }
}

// Instruction.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, Default, PartialEq)]
pub struct TXInstruction {
    // Pubkey of the instruction processor that executes this instruction
    pub program_id: Pubkey,
    // Metadata for what accounts should be passed to the instruction processor
    pub keys: Vec<TXAccountMeta>,
    // Opaque data passed to the instruction processor
    pub data: Vec<u8>,
}

impl TXInstruction {
    // Space that a [TXInstruction] takes up.
    pub fn space(&self) -> usize {
        std::mem::size_of::<Pubkey>()
            + (self.keys.len() as usize) * std::mem::size_of::<TXAccountMeta>()
            + (self.data.len() as usize)
    }
}

// Account metadata used to define [TXInstruction]s
#[derive(AnchorSerialize, AnchorDeserialize, Debug, PartialEq, Copy, Clone)]
pub struct TXAccountMeta {
    // An account's public key
    pub pubkey: Pubkey,
    // True if an Instruction requires a Transaction signature matching `pubkey`.
    pub is_signer: bool,
    // True if the `pubkey` can be loaded as a read-write account.
    pub is_writable: bool,
}

impl From<&TXInstruction> for solana_program::instruction::Instruction {
    fn from(tx: &TXInstruction) -> solana_program::instruction::Instruction {
        solana_program::instruction::Instruction {
            program_id: tx.program_id,
            accounts: tx.keys.clone().into_iter().map(Into::into).collect(),
            data: tx.data.clone(),
        }
    }
}

impl From<TXAccountMeta> for solana_program::instruction::AccountMeta {
    fn from(
        TXAccountMeta {
            pubkey,
            is_signer,
            is_writable,
        }: TXAccountMeta,
    ) -> solana_program::instruction::AccountMeta {
        solana_program::instruction::AccountMeta {
            pubkey,
            is_signer,
            is_writable,
        }
    }
}
// Type of Subaccount.
#[derive(
    AnchorSerialize, AnchorDeserialize, Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord,
)]
#[repr(u8)]
pub enum SubaccountType {
    // Requires the normal multisig approval process.
    Derived = 0,
    // Any owner may sign an instruction  as this address.
    OwnerInvoker = 1,
}

impl Default for SubaccountType {
    fn default() -> Self {
        SubaccountType::Derived
    }
}

// Mapping of a Subaccount to its [Smallet].
#[account]
#[derive(Copy, Default, Debug, PartialEq, Eq)]
pub struct SubaccountInfo {
    // Smallet of the sub-account.
    pub smallet: Pubkey,
    // Type of sub-account.
    pub subaccount_type: SubaccountType,
    // Index of the sub-account.
    pub index: u64,
}

impl SubaccountInfo {
    // Number of bytes that a [SubaccountInfo] uses.
    pub const LEN: usize = 32 + 1 + 8;
}
