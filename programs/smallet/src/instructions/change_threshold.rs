//! Instruction handler for smallet:change_threshold

use crate::*;

// Instruction handler for smallet::change_threshold
pub fn handler(ctx: Context<Auth>, threshold: u64) -> Result<()> {
    // Smallet is frozen
    invariant!(!ctx.accounts.smallet.frozen, AccountFrozen);

    invariant!(
        threshold <= ctx.accounts.smallet.owners.len() as u64,
        InvalidThreshold
    );
    let smallet = &mut ctx.accounts.smallet;
    smallet.threshold = threshold;

    emit!(WalletChangeThresholdEvent {
        smallet: ctx.accounts.smallet.key(),
        threshold,
        timestamp: Clock::get()?.unix_timestamp
    });
    Ok(())
}
