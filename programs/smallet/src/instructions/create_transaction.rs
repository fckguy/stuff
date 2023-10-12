//! Instruction handler for smallet:create_transaction

use crate::*;

// Define constants
const TRANSACTION_SEED: &[u8] = b"Transaction";

pub fn handler(
    ctx: Context<CreateTransaction>,
    _bump: u8,
    instructions: Vec<TXInstruction>,
    eta: i64,
) -> Result<()> {
    let smallet = &ctx.accounts.smallet;
    let owner_index = smallet.try_owner_index(ctx.accounts.proposer.key())?;

    let clock = Clock::get()?;
    let current_ts = clock.unix_timestamp;

    if eta != NO_ETA {
        invariant!(eta >= 0, "ETA must be positive");
        let delay = eta - current_ts;
        invariant!(delay >= 0, "ETA must be in the future");
        invariant!(delay <= MAX_DELAY_SECONDS, "Delay is too high");
        if smallet.minimum_delay != 0 {
            invariant!(eta >= current_ts + smallet.minimum_delay as i64, "Invalid ETA");
        }
    }

    // generate the signers boolean list
    let mut signers = vec![false; smallet.owners.len()];
    signers[owner_index] = true;

    let index = smallet.num_transactions;
    smallet.num_transactions += 1;

    // init the TX
    let tx = &mut ctx.accounts.transaction;
    tx.smallet = smallet.key();
    tx.index = index;
    tx.bump = *unwrap_int!(ctx.bumps.get("transaction"));

    tx.proposer = ctx.accounts.proposer.key();
    tx.instructions = instructions.clone();
    tx.signers = signers;
    tx.owner_set_seqno = smallet.owner_set_seqno;
    tx.eta = eta;

    tx.executor = Pubkey::default();
    tx.executed_at = -1;

    emit!(TransactionCreateEvent {
        smallet: ctx.accounts.smallet.key(),
        transaction: ctx.accounts.transaction.key(),
        proposer: ctx.accounts.proposer.key(),
        instructions,
        eta,
        timestamp: current_ts
    });
    Ok(())
}

// Accounts for [smallet::create_transaction].
#[derive(Accounts)]
#[instruction(bump: u8, instructions: Vec<TXInstruction>)]
pub struct CreateTransaction<'info> {
    // The [Smallet]
    #[account(mut)]
    pub smallet: Account<'info, Smallet>,
    // The [Transaction]
    #[account(
        init,
        seeds = [
            b"Transaction".as_ref(),
            smallet.key().to_bytes().as_ref(),
            smallet.num_transactions.to_le_bytes().as_ref()
        ],
        bump,
        payer = payer,
        space = Transaction::space(instructions),
    )]
    pub transaction: Account<'info, Transaction>,
    // One of the owners. Checked in the handler via [Smallet::try_owner_index].
    pub proposer: Signer<'info>,
    // Payer to create the [Transaction].
    #[account(mut)]
    pub payer: Signer<'info>,
    // The [System] program.
    pub system_program: Program<'info, System>,
}

impl<'info> Validate<'info> for CreateTransaction<'info> {
    fn validate(&self) -> Result<()> {
        // Smallet is frozen
        invariant!(!self.smallet.frozen, AccountFrozen);
        // owner_index check happens later
        Ok(())
    }
}
