//! Instruction handler for smallet:set_frozen

use crate::*;

// Instruction handler for smallet::set_frozen creation
pub fn handler(ctx: Context<SetFrozen>, frozen: bool) -> Result<()> {
    let smallet = &mut ctx.accounts.smallet;
    smallet.frozen = frozen;

    emit!(OwnerSetFrozenEvent {
        smallet: ctx.accounts.smallet.key(),
        frozen,
        timestamp: Clock::get()?.unix_timestamp
    });
    Ok(())
}

// Accounts for [smallet::set_frozen].
#[derive(Accounts)]
pub struct SetFrozen<'info> {
    // The [Smallet]
    #[account(mut, signer)]
    pub smallet: Account<'info, Smallet>,
}

impl<'info> Validate<'info> for SetFrozen<'info> {
    fn validate(&self) -> Result<()> {
        invariant!(
            self.smallet.to_account_info().is_signer,
            "smallet.is_signer"
        );
        Ok(())
    }
}
