//! Instruction handler for smallet:lock_smallet

use crate::*;

// Instruction handler for smallet::lock_smallet creation
pub fn handler(ctx: Context<LockSmallet>) -> Result<()> {
    let smallet = &mut ctx.accounts.smallet;
    let global_state = &ctx.accounts.global_state;

    if !global_state.is_global_admin(&ctx.accounts.guardian.key()) {
        invariant!(
            smallet.is_guardian(&ctx.accounts.guardian.key()),
            Invalidguardian
        );
    }

    // Lock smallet immediately if signer is guardian or global admin
    smallet.locked = true;

    Ok(())
}

// Accounts for [smallet::lock_smallet].
#[derive(Accounts)]
pub struct LockSmallet<'info> {
    // Global admin or any guardian of [smallet]
    #[account(mut)]
    pub guardian: Signer<'info>,
    // The [GlobalState].
    pub global_state: Account<'info, GlobalState>,
    // The [Smallet]
    #[account(mut)]
    pub smallet: Account<'info, Smallet>,
}

impl<'info> Validate<'info> for LockSmallet<'info> {
    fn validate(&self) -> Result<()> {
        Ok(())
    }
}
