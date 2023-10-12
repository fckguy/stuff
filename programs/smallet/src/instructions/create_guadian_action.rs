//! Instruction handler for smallet:create_guardian_action

use std::collections::HashSet;
use crate::*;

// Define constants
const GUARDIAN_ACTION_SEED: &[u8] = b"GuardianAction";

pub fn handler(
    ctx: Context<CreateGuardianAction>,
    action_type: GuardianActionType,
    guardians_count: u8,
    addresses_count: u8,
) -> Result<()> {
    let global_state = &ctx.accounts.global_state;
    let smallet = &mut ctx.accounts.smallet;
    let guardian_action: &mut Account<'_, GuardianAction> = &mut ctx.accounts.guardian_action;

    invariant!(
        smallet.guardians.len() != guardians_count as usize,
        "Incorrect number of guardians."
    );

    // Deduplicate addresses
    let addresses: Vec<Pubkey> = ctx.remaining_accounts.iter().map(|info| *info.key).collect();
    let addresses: Vec<Pubkey> = addresses.into_iter().collect::<HashSet<_>>().into_iter().collect();

    invariant!(
        addresses.len() != addresses_count as usize,
        "Incorrect number of addresses."
    );

    let clock = Clock::get()?;
    let now = clock.unix_timestamp;

    guardian_action.smallet = smallet.key();
    guardian_action.action_requested_time = now;
    guardian_action.action_type = action_type;

    if global_state.is_global_admin(&ctx.accounts.guardian.key()) {
        perform_action(guardian_action, smallet, global_state)?;
        return Ok(());
    }

    guardian_action.addresses = addresses.clone();

    let idx = smallet.guardian_index_opt(ctx.accounts.guardian.key());
    if let Some(guardian_idx) = idx {
        guardian_action.clear_signs();
        guardian_action.set_signed_with_index(guardian_idx);

        if guardian_action.check_enough_sign(global_state.min_agree_permyriad) {
            perform_action(guardian_action, smallet, global_state)?;
        }

        Ok(())
    } else {
        Err(crate::ErrorCode::InvalidGuardian.into())
    }
}

// Accounts for [smallet::create_guardian_action].
#[derive(Accounts)]
#[instruction(guardians_count: u8, addresses_count: u8)]
pub struct CreateGuardianAction<'info> {
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
        init,
        seeds = [
            b"GuardianAction".as_ref(),
            smallet.key().to_bytes().as_ref(),
            smallet.num_guardian_actions.to_le_bytes().as_ref()
        ],
        bump,
        payer = guardian,
        space = GuardianAction::space(guardians_count, addresses_count),
    )]
    pub guardian_action: Account<'info, GuardianAction>,
    // The [System] program.
    pub system_program: Program<'info, System>,
}

impl<'info> Validate<'info> for CreateGuardianAction<'info> {
    fn validate(&self) -> Result<()> {
        Ok(())
    }
}

pub fn perform_action(
    guardian_action: &mut GuardianAction,
    smallet: &mut Smallet,
    global_state: &GlobalState,
) -> Result<()> {
    let clock = Clock::get()?;
    let now = clock.unix_timestamp;

    invariant!(
        now <= guardian_action.action_requested_time + global_state.guardians_action_expires_time,
        ActionExpired
    );
    invariant!(!guardian_action.performed, ActionAlreadyPerformed);

    match guardian_action.action_type {
        GuardianActionType::UnlockSmallet => {
            // Smallet should be unlock right after enough guardians signed as agree
            smallet.frozen = false;
            smallet.locked = false;
        }
        GuardianActionType::SetOwners => {
            // Smallet owners should be changed right after enough guardians signed as agree
            // TODO: for safety should consider if new addresses count is over than max_owners len
            smallet.owners = guardian_action.addresses.clone();
        }
        GuardianActionType::SetGuardians => {
            // Smallet guardians should be changed after guardians_change_period is passed even if enough guardians are signed
            // TODO: for safety should consider if new addresses count is over than max_guardians len
            invariant!(
                now >= guardian_action.action_requested_time + global_state.guardians_change_period,
                NotEnoughChangePeriod
            );
            smallet.guardians = guardian_action.addresses.clone();
        }
        _ => return Err(crate::ErrorCode::InvalidGuardian.into()),
    }

    smallet.num_guardian_actions += 1;
    guardian_action.performed = true;

    Ok(())
}
