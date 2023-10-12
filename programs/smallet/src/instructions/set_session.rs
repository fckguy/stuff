//! Instruction handler for smallet:set_session

use crate::*;

pub fn handler(ctx: Context<SetSession>, expires_at: Option<i64>) -> Result<()> {
    // Check if the owner exists in the smallet owners list
    let owner_index = ctx
        .accounts
        .smallet
        .try_owner_index(ctx.accounts.owner.key())?;

    // Revoke auto-sign grant if expires_at is None
    let mut new_ts: i64 = NO_ETA;
    let clock = Clock::get()?;
    let current_ts = clock.unix_timestamp;

    if let Some(end_ts) = expires_at {
        // Ensure the expiration time is in the future
        invariant!(end_ts >= current_ts, "Expiration time should be in the future.");
        new_ts = end_ts;
    }

    ctx.accounts.smallet.owner_sessions[owner_index] = new_ts;

    emit!(OwnerSetSessionEvent {
        smallet: ctx.accounts.smallet.key(),
        expires_at: new_ts,
        timestamp: current_ts
    });
    Ok(())
}

// Accounts for [smallet::set_session].
#[derive(Accounts)]
pub struct SetSession<'info> {
    // The [Smallet].
    #[account(mut)]
    pub smallet: Account<'info, Smallet>,
    // One of the smallet owners.
    pub owner: Signer<'info>,
}
