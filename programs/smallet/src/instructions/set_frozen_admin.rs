//! Instruction handler for smallet:set_frozen_admin

use crate::*;

// Instruction handler for smallet::set_frozen_admin
pub fn handler(ctx: Context<SetFrozenAdmin>, frozen: bool) -> Result<()> {
    ctx.accounts.smallet.frozen = frozen;

    emit!(OwnerSetFrozenEvent {
        smallet: ctx.accounts.smallet.key(),
        frozen,
        timestamp: Clock::get()?.unix_timestamp
    });
    Ok(())
}

impl<'info> Validate<'info> for SetFrozenAdmin<'info> {
    fn validate(&self) -> Result<()> {
        // Check if admin is the current global admin
        invariant!(
            self.global_state.is_global_admin(&self.admin.key()),
            InvalidGlobalAdmin
        );
        Ok(())
    }
}

// Accounts for [smallet::set_frozen_admin].
#[derive(Accounts)]
pub struct SetFrozenAdmin<'info> {
    // The [Smallet].
    #[account(mut)]
    pub smallet: Account<'info, Smallet>,
    // The [GlobalState].
    pub global_state: Account<'info, GlobalState>,
    // Current global admin
    #[account(mut)]
    pub admin: Signer<'info>,
}
