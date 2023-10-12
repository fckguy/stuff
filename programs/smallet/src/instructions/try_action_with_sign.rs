//! Instruction handler for smallet:try_action_with_sign

use crate::*;

// Instruction handler for smallet::try_action_with_sign
pub fn handler(ctx: Context<PerformGuardianAction>, _index: u64) -> Result<()> {
    let global_state = &ctx.accounts.global_state;
    let smallet = &mut ctx.accounts.smallet;
    let guardian_action: &mut Account<'_, GuardianAction> = &mut ctx.accounts.guardian_action;

    // Should be guardian to perform already created guardian action
    let idx = smallet.guardian_index_opt(ctx.accounts.guardian.key());
    // Check if payer is guardian
    if let Some(guardian_idx) = idx {
        // set this guardian as signed
        guardian_action.set_signed_with_index(guardian_idx);

        // check if signs are enough for action
        if guardian_action.check_enough_sign(global_state.min_agree_permyriad) {
            perform_action(guardian_action, smallet, global_state)?;
            // TODO: Should emit event for guardian action
        }

        Ok(())
    } else {
        Err(crate::ErrorCode::InvalidGuardian.into())
    }
}

// Accounts for [smallet::try_action_with_sign].
#[derive(Accounts)]
#[instruction(index: u64)]
pub struct PerformGuardianAction<'info> {
    // Global admin or any guardian of [smallet]
    #[account(mut)]
    pub guardian: Signer<'info>,
    // The [GlobalState].
    pub global_state: Account<'info, GlobalState>,
    // The [Smallet]
    #[account(mut)]
    pub smallet: Account<'info, Smallet>,
    // Guardian action account for [smallet] change
    #[account(
        mut,
        seeds = [
            b"GuardianAction".as_ref(),
            smallet.key().to_bytes().as_ref(),
            index.to_le_bytes().as_ref()
        ],
        bump,
    )]
    pub guardian_action: Account<'info, GuardianAction>,
}

impl<'info> Validate<'info> for PerformGuardianAction<'info> {
    fn validate(&self) -> Result<()> {
        invariant!(
            self.guardian_action.smallet.eq(&self.smallet.key()),
            InvalidGuardianAction
        );
        Ok(())
    }
}
