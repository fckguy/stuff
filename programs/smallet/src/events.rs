//! Events emitted from smallet

#![allow(missing_docs)]

use crate::*;

// Emitted when smallet is first created
#[event]
pub struct WalletCreateEvent {
    // The smallet
    #[index]
    pub smallet: Pubkey,
    // Owners of created smallet
    pub owners: Vec<Pubkey>,
    // Threshold at the time of creation of the smallet
    pub threshold: u64,
    // Minimum delay at the time of creation
    pub minimum_delay: i64,
    // Unix timestamp when the event was emitted
    pub timestamp: i64,
}
// Emitted when owners of a smallet are changed.
#[event]
pub struct WalletSetOwnersEvent {
    #[index]
    // The smallet
    pub smallet: Pubkey,
    // The new owners of the smallet
    pub owners: Vec<Pubkey>,
    // Unix timestamp when event was emitted
    pub timestamp: i64,
}
// Emitted when the threshold of a smallet is changed
#[event]
pub struct WalletChangeThresholdEvent {
    #[index]
    pub smallet: Pubkey,
    // The new smallet threshold
    pub threshold: u64,
    pub timestamp: i64,
}
// Emitted when a transaction is proposed
#[event]
pub struct TransactionCreateEvent {
    #[index]
    pub smallet: Pubkey,
    #[index]
    // Proposed transaction
    pub transaction: Pubkey,
    // Owner who proposed the transaction
    pub proposer: Pubkey,
    // Instructions associated with the transaction
    pub instructions: Vec<TXInstruction>,
    // Transaction ETA
    pub eta: i64,
    pub timestamp: i64,
}
// Emitted when a transaction is approved
#[event]
pub struct TransactionApproveEvent {
    #[index]
    pub smallet: Pubkey,
    #[index]
    pub transaction: Pubkey,
    pub owner: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct TransactionUnapproveEvent {
    #[index]
    pub smallet: Pubkey,
    #[index]
    pub transaction: Pubkey,
    pub owner: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct TransactionExecuteEvent {
    #[index]
    pub smallet: Pubkey,
    #[index]
    pub transaction: Pubkey,
    pub executor: Pubkey,
    pub timestamp: i64,
}
// Emitted when a owner change auto-sign session expires
#[event]
pub struct OwnerSetSessionEvent {
    #[index]
    pub smallet: Pubkey,
    pub expires_at: i64,
    pub timestamp: i64,
}
// Emitted when a owner change frozen flag
#[event]
pub struct OwnerSetFrozenEvent {
    #[index]
    pub smallet: Pubkey,
    pub frozen: bool,
    pub timestamp: i64,
}
