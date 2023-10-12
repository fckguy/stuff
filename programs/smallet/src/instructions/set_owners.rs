//! Instruction handler for smallet:set_owners

use crate::*;

// Instruction handler for smallet::set_owners
pub fn handler(ctx: Context<Auth>, owners: Vec<Pubkey>) -> Result<()> {
    let smallet = &mut ctx.accounts.smallet;
    if (owners.len() as u64) < smallet.threshold {
        smallet.threshold = owners.len() as u64;
    }

    smallet.owners = owners.clone();
    smallet.owner_set_seqno = unwrap_int!(smallet.owner_set_seqno.checked_add(1));
    // Revoke all sessions when change a set of owners
    smallet.owner_sessions = vec![NO_ETA; owners.len()];

    emit!(WalletSetOwnersEvent {
        smallet: ctx.accounts.smallet.key(),
        owners,
        timestamp: Clock::get()?.unix_timestamp
    });
    Ok(())
}

// Accounts for [smallet::set_owners] and [smallet::change_threshold].
#[derive(Accounts)]
pub struct Auth<'info> {
    // The [Smallet]
    #[account(mut, signer)]
    pub smallet: Account<'info, Smallet>,
}

impl<'info> Validate<'info> for Auth<'info> {
    fn validate(&self) -> Result<()> {
        invariant!(
            self.smallet.to_account_info().is_signer,
            "smallet.is_signer"
        );
        // Smallet is frozen
        invariant!(!self.smallet.frozen, AccountFrozen);
        Ok(())
    }
}
