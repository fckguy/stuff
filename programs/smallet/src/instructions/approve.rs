//! Instruction handler for smallet:approve

use crate::*;

// Instruction handler for smallet::approve
pub fn handler(ctx: Context<Approve>) -> Result<()> {
    let owner_index = ctx
        .accounts
        .smallet
        .try_owner_index(ctx.accounts.owner.key())?;
    ctx.accounts.transaction.signers[owner_index] = true;

    emit!(TransactionApproveEvent {
        smallet: ctx.accounts.smallet.key(),
        transaction: ctx.accounts.transaction.key(),
        owner: ctx.accounts.owner.key(),
        timestamp: Clock::get()?.unix_timestamp
    });
    Ok(())
}
// This validator is used for both approve and unapprove.

impl<'info> Validate<'info> for Approve<'info> {
    fn validate(&self) -> Result<()> {
        let mut frozen_check = true;
        // No point in approving/unapproving if the Smallet is frozen
        // Except unfreezing Tx
        if self.transaction.instructions.len() == 1 {
            let instruction = &self.transaction.instructions[0];
            if instruction.data.len() >= 8 && instruction.data[0..8] == SET_FROZEN_DISCRIMINATOR {
                frozen_check = false;
            }
        }
        invariant!(!frozen_check || !self.smallet.frozen, AccountFrozen);

        // The TX in question should belong to the smallet
        assert_keys_eq!(self.smallet, self.transaction.smallet);
        // If the owner set has changed, should not allow approvals/unapprovals to change
        // This can potentially cause someone to be able to approve/unapprove someone else's TXs.
        invariant!(
            self.smallet.owner_set_seqno == self.transaction.owner_set_seqno,
            OwnerSetChanged
        );
        // No point in approving/unapproving if the TX is already executed (duh)
        invariant!(self.transaction.executed_at == -1, AlreadyExecuted);

        Ok(())
    }
}
// Accounts for [smallet::approve].
#[derive(Accounts)]
pub struct Approve<'info> {
    // The [Smallet].
    pub smallet: Account<'info, Smallet>,
    // The [Transaction].
    #[account(mut, has_one = smallet)]
    pub transaction: Account<'info, Transaction>,
    // One of the smallet owners. Checked in the handler.
    pub owner: Signer<'info>,
}
