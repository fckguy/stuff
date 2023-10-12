//! Instruction handler for smallet::create_smallet

use crate::*;

// Instruction handler for smallet::create_smallet
pub fn handler(
    ctx: Context<CreateSmallet>,
    _bump: u8,
    max_owners: u8,
    max_guardians: u8,
    owners: Vec<Pubkey>,
    threshold: u64,
    minimum_delay: i64,
    guardians: Vec<Pubkey>,
) -> Result<()> {
    invariant!(minimum_delay >= 0, "delay must be positive");
    invariant!(minimum_delay < MAX_DELAY_SECONDS, DelayTooHigh);
    invariant!((max_owners as usize) >= owners.len(), "max_owners");
    invariant!((max_guardians as usize) >= guardians.len(), "max_guardians");

    let smallet = &mut ctx.accounts.smallet;
    smallet.base = ctx.accounts.base.key();
    smallet.bump = *unwrap_int!(ctx.bumps.get("smallet"));
    smallet.threshold = threshold;
    smallet.minimum_delay = minimum_delay;
    smallet.grace_period = DEFAULT_GRACE_PERIOD;
    smallet.owner_set_seqno = 0;
    smallet.num_transactions = 0;
    smallet.owners = owners;
    smallet.owner_sessions = vec![NO_ETA; smallet.owners.len()];
    smallet.guardians = guardians;

    emit!(WalletCreateEvent {
        smallet: ctx.accounts.smallet.key(),
        owners: smallet.owners.clone(),
        threshold,
        minimum_delay,
        timestamp: Clock::get()?.unix_timestamp
    });
    Ok(())
}

// Accounts for [smallet::create_smallet].
#[derive(Accounts)]
#[instruction(bump: u8, max_owners: u8, max_guardians: u8)]
pub struct CreateSmallet<'info> {
    // Base key of the Smallet.
    pub base: Signer<'info>,
    // The [Smallet] to create.
    #[account(
        init,
        seeds = [
            b"Smallet".as_ref(),
            base.key().to_bytes().as_ref()
        ],
        bump,
        payer = payer,
        space = Smallet::space(max_owners, max_guardians),
    )]
    pub smallet: Account<'info, Smallet>,
    // Payer to create the smallet.
    #[account(mut)]
    pub payer: Signer<'info>,
    // The [System] program.
    pub system_program: Program<'info, System>,
}

impl<'info> Validate<'info> for CreateSmallet<'info> {
    fn validate(&self) -> Result<()> {
        Ok(())
    }
}
