//! Instruction handler for smallet:transfer_global_admin

use crate::*;

pub fn handler(ctx: Context<TransferGlobalAdmin>, new_admin: Pubkey) -> Result<()> {
    ctx.accounts.global_state.global_admin = new_admin;

    Ok(())
}

impl<'info> Validate<'info> for TransferGlobalAdmin<'info> {
    fn validate(&self) -> Result<()> {
        invariant!(
            self.global_state.is_global_admin(&self.admin.key()),
            InvalidGlobalAdmin
        );
        Ok(())
    }
}

// Accounts for [smallet::transfer_global_admin].
#[derive(Accounts)]
pub struct TransferGlobalAdmin<'info> {
    // The [GlobalState].
    #[account(mut)]
    pub global_state: Account<'info, GlobalState>,
    // Current global admin. Checked in the handler.
    #[account(mut)]
    pub admin: Signer<'info>,
}
