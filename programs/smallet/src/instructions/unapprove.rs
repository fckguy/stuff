//! Instruction handler for [smallet::unapprove].
use crate::*;

// Instruction handler for [smallet::unapprove].
pub fn handler(ctx: Context<Approve>) -> Result<()> {
    let owner_index = ctx
        .accounts
        .smallet
        .try_owner_index(ctx.accounts.owner.key())?;
    ctx.accounts.transaction.signers[owner_index] = false;

    emit!(TransactionUnapproveEvent {
        smallet: ctx.accounts.smallet.key(),
        transaction: ctx.accounts.transaction.key(),
        owner: ctx.accounts.owner.key(),
        timestamp: Clock::get()?.unix_timestamp
    });
    Ok(())
}
