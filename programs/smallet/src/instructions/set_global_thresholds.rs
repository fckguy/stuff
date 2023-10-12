//! Instruction handler for smallet:set_global_thresholds

use crate::*;

pub fn handler(
    ctx: Context<SetGlobalThresholds>,
    change_period: Option<i64>,
    action_expires: Option<i64>,
    min_agree_permyriad: Option<u16>,
) -> Result<()> {
    if let Some(period) = change_period {
        ctx.accounts.global_state.guardians_change_period = period;
    }

    if let Some(expires) = action_expires {
        ctx.accounts.global_state.guardians_action_expires_time = expires;
    }

    if let Some(permyriad) = min_agree_permyriad {
        ctx.accounts.global_state.min_agree_permyriad = permyriad;
    }

    Ok(())
}

impl<'info> Validate<'info> for SetGlobalThresholds<'info> {
    fn validate(&self) -> Result<()> {
        invariant!(
            self.global_state.is_global_admin(&self.admin.key()),
            InvalidGlobalAdmin
        );
        Ok(())
    }
}

// Accounts for [smallet::set_global_thresholds].
#[derive(Accounts)]
pub struct SetGlobalThresholds<'info> {
    // The [GlobalState].
    #[account(mut)]
    pub global_state: Account<'info, GlobalState>,
    // Current global admin. Checked in the handler.
    #[account(mut)]
    pub admin: Signer<'info>,
}
