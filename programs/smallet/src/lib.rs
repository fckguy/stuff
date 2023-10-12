//! This program can be used to allow a smallet to govern anything a regular
//! [Pubkey] can govern. One can use the smallet as a BPF program upgrade
//! authority, a mint authority, etc.
//!
//! To use, one must first create a [Smallet] account, specifying two important
//! parameters:
//!
//! 1. Owners - the set of addresses that sign transactions for the smallet.
//! 2. Threshold - the number of signers required to execute a transaction.
//! 3. Minimum Delay - the minimum amount of time that must pass before a [Transaction]
//!                    can be executed. If 0, this is ignored.
//!
//! Once the [Smallet] account is created, one can create a [Transaction]
//! account, specifying the parameters for a normal Solana instruction.
//!
//! To sign, owners should invoke the [smallet::approve] instruction, and finally,
//! [smallet::execute_transaction], once enough (i.e. [Smallet::threshold]) of the owners have
//! signed.

#![allow(rustdoc::all)]
#![allow(rustdoc::missing_doc_code_examples)]
#![allow(clippy::unwrap_used)]

use anchor_lang::prelude::*;
use anchor_lang::solana_program;
use vipers::prelude::*;

mod constants;
mod events;
mod instructions;
mod state;

pub use constants::*;
pub use events::*;
pub use instructions::*;
pub use state::*;

declare_id!("7iFugUof2fQaHojbxskcELz5nCfNfKJx5vd8cY7qPAYU");

#[program]
// Smallet program
pub mod smallet {
    use super::*;

    /**
     * Initializes a global state account.
     * Deployer becomes the initial admin of global state.
     */
    pub fn initialize_global_state(ctx: Context<InitializeGlobalState>) -> Result<()> {
        instructions::initialize_global_state::handle(ctx)
    }

    // Transfer global admin for the [Smallet]
    #[access_control(ctx.accounts.validate())]
    pub fn transfer_global_admin(
        ctx: Context<TransferGlobalAdmin>,
        new_admin: Pubkey,
    ) -> Result<()> {
        instructions::transfer_global_admin::handler(ctx, new_admin)
    }

    // Set global thresholds for the [Smallet]
    #[access_control(ctx.accounts.validate())]
    pub fn set_global_thresholds(
        ctx: Context<SetGlobalThresholds>,
        change_period: Option<i64>,
        action_expires: Option<i64>,
        agree_permyriad: Option<u16>,
    ) -> Result<()> {
        instructions::set_global_thresholds::handler(
            ctx,
            change_period,
            action_expires,
            agree_permyriad,
        )
    }

    // Initializes a new [Smallet] account with a set of owners and a threshold
    #[access_control(ctx.accounts.validate())]
    pub fn create_smallet(
        ctx: Context<CreateSmallet>,
        bump: u8,
        max_owners: u8,
        owners: Vec<Pubkey>,
        threshold: u64,
        minimum_delay: i64,
        gudians_count: u8,
        gudians: Vec<Pubkey>,
    ) -> Result<()> {
        instructions::create_smallet::handler(
            ctx,
            bump,
            gudians_count,
            max_owners,
            owners,
            threshold,
            minimum_delay,
            gudians,
        )
    }

    // Sets the owners field on the smallet. The only way this can be invoked
    // is via a recursive call from execute_transaction -> set_owners.
    #[access_control(ctx.accounts.validate())]
    pub fn set_owners(ctx: Context<Auth>, owners: Vec<Pubkey>) -> Result<()> {
        instructions::set_owners::handler(ctx, owners)
    }

    // Changes the execution threshold of the smallet. The only way this can be
    // invoked is via a recursive call from execute_transaction ->
    // change_threshold.
    #[access_control(ctx.accounts.validate())]
    pub fn change_threshold(ctx: Context<Auth>, threshold: u64) -> Result<()> {
        instructions::change_threshold::handler(ctx, threshold)
    }

    // Creates a new [Transaction] account, automatically signed by the creator,
    // which must be one of the owners of the smallet.
    pub fn create_transaction(
        ctx: Context<CreateTransaction>,
        bump: u8,
        instructions: Vec<TXInstruction>,
    ) -> Result<()> {
        instructions::create_transaction::handler(ctx, bump, instructions, NO_ETA)
    }

    // Creates a new [Transaction] account with time delay.
    #[access_control(ctx.accounts.validate())]
    pub fn create_transaction_with_timelock(
        ctx: Context<CreateTransaction>,
        bump: u8,
        instructions: Vec<TXInstruction>,
        eta: i64,
    ) -> Result<()> {
        instructions::create_transaction::handler(ctx, bump, instructions, eta)
    }

    // Approves a transaction on behalf of an owner of the [Smallet]
    #[access_control(ctx.accounts.validate())]
    pub fn approve(ctx: Context<Approve>) -> Result<()> {
        instructions::approve::handler(ctx)
    }

    // Unapproves a transaction on behald of an owner of the [Smallet]
    #[access_control(ctx.accounts.validate())]
    pub fn unapprove(ctx: Context<Approve>) -> Result<()> {
        instructions::unapprove::handler(ctx)
    }

    // Executes the given transaction if threshold owners have signed it.
    #[access_control(ctx.accounts.validate())]
    pub fn execute_transaction(ctx: Context<ExecuteTransaction>) -> Result<()> {
        instructions::execute_transaction(ctx)
    }

    // Executes the given transaction signed by the given derived address,
    // if threshold owners have signed it.
    // This allows a Smallet to receive SOL.
    #[access_control(ctx.accounts.validate())]
    pub fn execute_transaction_derived(
        ctx: Context<ExecuteTransaction>,
        index: u64,
        bump: u8,
    ) -> Result<()> {
        instructions::execute_transaction_derived(ctx, index, bump)
    }

    // Invokes an arbitrary instruction as a PDA derived from the owner,
    // i.e. as an "Owner Invoker".
    // This is useful for using the multisig as a whitelist or as a council,
    // e.g. a whitelist of approved owners.
    #[access_control(ctx.accounts.validate())]
    pub fn owner_invoke_instruction(
        ctx: Context<OwnerInvokeInstruction>,
        index: u64,
        bump: u8,
        ix: TXInstruction,
    ) -> Result<()> {
        instructions::owner_invoke_instruction(ctx, index, bump, ix)
    }

    // Invokes an arbitrary instruction as a PDA derived from the owner,
    // i.e. as an "Owner Invoker".
    //
    // This is useful for using the multisig as a whitelist or as a council,
    // e.g. a whitelist of approved owners.
    //
    // # Arguments
    // - `index` - The index of the owner-invoker.
    // - `bump` - Bump seed of the owner-invoker.
    // - `invoker` - The owner-invoker.
    // - `data` - The raw bytes of the instruction data.
    #[access_control(ctx.accounts.validate())]
    pub fn owner_invoke_instruction_v2(
        ctx: Context<OwnerInvokeInstruction>,
        index: u64,
        bump: u8,
        invoker: Pubkey,
        data: Vec<u8>,
    ) -> Result<()> {
        instructions::owner_invoke_instruction_v2(ctx, index, bump, invoker, data)
    }

    // Creates a struct containing a reverse mapping of a subaccount to a
    // [Smallet].
    #[access_control(ctx.accounts.validate())]
    pub fn create_subaccount_info(
        ctx: Context<CreateSubaccountInfo>,
        bump: u8,
        subaccount: Pubkey,
        smallet: Pubkey,
        index: u64,
        subaccount_type: SubaccountType,
    ) -> Result<()> {
        instructions::create_subaccount::handler(
            ctx,
            bump,
            subaccount,
            smallet,
            index,
            subaccount_type,
        )
    }

    // Set session for grant auto-sign period of an owner of the [Smallet]
    #[access_control(ctx.accounts.validate())]
    pub fn set_session(ctx: Context<SetSession>, expires_at: Option<i64>) -> Result<()> {
        instructions::set_session::handler(ctx, expires_at)
    }

    // Set frozen for the [Smallet]
    #[access_control(ctx.accounts.validate())]
    pub fn set_frozen(ctx: Context<SetFrozen>, frozen: bool) -> Result<()> {
        instructions::set_frozen::handler(ctx, frozen)
    }

    // Set frozen by admin for the [Smallet]
    #[access_control(ctx.accounts.validate())]
    pub fn set_frozen_admin(ctx: Context<SetFrozenAdmin>, frozen: bool) -> Result<()> {
        instructions::set_frozen_admin::handler(ctx, frozen)
    }

    // Set locked by admin or guardians for the [Smallet]
    #[access_control(ctx.accounts.validate())]
    pub fn lock_smallet(ctx: Context<LockSmallet>) -> Result<()> {
        instructions::lock_smallet::handler(ctx)
    }

    // Initializes a new guardian action for [Smallet] account with a set of new addresses
    #[access_control(ctx.accounts.validate())]
    pub fn create_guardian_action(
        ctx: Context<CreateGuardianAction>,
        action_type: GuardianActionType,
        guardians_count: u8,
        addresses_count: u8,
    ) -> Result<()> {
        instructions::create_guardian_action::handler(
            ctx,
            action_type,
            guardians_count,
            addresses_count,
        )
    }

    // Try perform guardian action by signing as guardian
    #[access_control(ctx.accounts.validate())]
    pub fn try_action_with_sign(ctx: Context<PerformGuardianAction>, index: u64) -> Result<()> {
        instructions::try_action_with_sign::handler(ctx, index)
    }
}

// Program errors
#[error_code]
pub enum ErrorCode {
    #[msg("The given owner is not part of this smallet.")]
    InvalidOwner,
    #[msg("The given owner is not the global admin.")]
    InvalidGlobalAdmin,
    #[msg("Global state initializer does not match the deployer of program")]
    InvalidDeployer,
    #[msg("Invalid ProgramData account")]
    InvalidProgramDataAccount,
    #[msg("Estimated execution block must satisfy delay.")]
    InvalidETA,
    #[msg("Delay greater than the maximum.")]
    DelayTooHigh,
    #[msg("Not enough owners signed this transaction.")]
    NotEnoughSigners,
    #[msg("Transaction is past the grace period.")]
    TransactionIsStale,
    #[msg("Transaction hasn't surpassed time lock.")]
    TransactionNotReady,
    #[msg("The given transaction has already been executed.")]
    AlreadyExecuted,
    #[msg("Threshold must be less than or equal to the number of owners.")]
    InvalidThreshold,
    #[msg("Owner set has changed since the creation of the transaction.")]
    OwnerSetChanged,
    #[msg("Subaccount does not belong to smallet.")]
    SubaccountOwnerMismatch,
    #[msg("Buffer already finalized.")]
    BufferFinalized,
    #[msg("Buffer bundle not found.")]
    BufferBundleNotFound,
    #[msg("Buffer index specified is out of range.")]
    BufferBundleOutOfRange,
    #[msg("Buffer has not been finalized.")]
    BufferBundleNotFinalized,
    #[msg("Buffer bundle has already been executed.")]
    BufferBundleExecuted,
    #[msg("The Smallet account is frozen.")]
    AccountFrozen,
    #[msg("The given address is not guardian or global admin.")]
    InvalidGuardian,
    #[msg("The given guardians count not matched with smallet guardians count.")]
    IncorrectGuardiansCount,
    #[msg("The given new addresses count not matched with remaining account of context.")]
    IncorrectAddressesCount,
    #[msg("Passed expiration time for enough sign to perform the guardian action.")]
    ActionExpired,
    #[msg("Not enough time passed to change guardians.")]
    NotEnoughChangePeriod,
    #[msg("Guardian action's smallet address not matched with provided smallet account.")]
    InvalidGuardianAction,
    #[msg("Guardian action is already performed.")]
    ActionAlreadyPerformed,
}
