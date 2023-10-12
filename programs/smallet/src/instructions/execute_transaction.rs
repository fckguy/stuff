//! Instruction handler for [smallet::execute_transaction] and [smallet::execute_transaction_derived].

use crate::*;

// Instruction handler for smallet::execute_transaction
pub fn execute_transaction(ctx: Context<ExecuteTransaction>) -> Result<()> {
    let smallet = &ctx.accounts.smallet;
    let wallet_seeds: &[&[&[u8]]] = &[&[
        b"Smallet" as &[u8],
        &smallet.base.to_bytes(),
        &[smallet.bump],
    ]];
    do_execute_transaction(ctx, wallet_seeds)
}

// Instruction handler for smallet::execute_transaction_derived
pub fn execute_transaction_derived(
    ctx: Context<ExecuteTransaction>,
    index: u64,
    bump: u8,
) -> Result<()> {
    let smallet = &ctx.accounts.smallet;
    // Execute the transaction signed by the smallet.
    let wallet_seeds: &[&[&[u8]]] = &[&[
        b"SmalletDerived" as &[u8],
        &smallet.key().to_bytes(),
        &index.to_le_bytes(),
        &[bump],
    ]];
    do_execute_transaction(ctx, wallet_seeds)
}

// Accounts for [smallet::execute_transaction].
#[derive(Accounts)]
pub struct ExecuteTransaction<'info> {
    // The [Smallet].
    pub smallet: Account<'info, Smallet>,
    // The [Transaction] to execute.
    #[account(mut)]
    pub transaction: Account<'info, Transaction>,
    // An owner of the [Smallet].
    pub owner: Signer<'info>,
}

impl<'info> Validate<'info> for ExecuteTransaction<'info> {
    fn validate(&self) -> Result<()> {
        assert_keys_eq!(self.smallet, self.transaction.smallet, "smallet");
        invariant!(
            self.smallet.owner_set_seqno == self.transaction.owner_set_seqno,
            OwnerSetChanged
        );
        // Checking to see if this has been executed already
        invariant!(self.transaction.executed_at == -1, AlreadyExecuted);

        let mut frozen_check = true;
        // No point in approving/unapproving if the Smallet is frozen
        // Except unfreezing Tx
        if self.transaction.instructions.len() == 1 {
            let instruction = &self.transaction.instructions[0];
            if instruction.data.len() >= 8 && instruction.data[0..8] == SET_FROZEN_DISCRIMINATOR {
                frozen_check = false;
            }
        }
        invariant!(!frozen_check || !self.smallet.frozen, AccountFrozen);
        
        let eta = self.transaction.eta;
        let clock = Clock::get()?;
        let current_ts = clock.unix_timestamp;
        msg!("current_ts: {}; eta: {}", current_ts, eta);
        // Has transaction surpassed timelock?
        invariant!(current_ts >= eta, TransactionNotReady);
        if eta != NO_ETA {
            // Has grace period passed?
            invariant!(
                current_ts <= unwrap_int!(eta.checked_add(self.smallet.grace_period)),
                TransactionIsStale
            );
        }
        // Do we have enough signers to execute the TX?
        // Consider auto-signed owner as signer
        let sig_count = self
            .transaction
            .num_signers(self.smallet.owner_sessions.clone().as_ref(), current_ts);
        invariant!(
            (sig_count as u64) >= self.smallet.threshold,
            NotEnoughSigners
        );
        // ensure that the owner is a signer
        // this prevents common frontrunning/flash loan attacks
        self.smallet.try_owner_index(self.owner.key())?;

        Ok(())
    }
}

fn do_execute_transaction(ctx: Context<ExecuteTransaction>, seeds: &[&[&[u8]]]) -> Result<()> {
    for ix in ctx.accounts.transaction.instructions.iter() {
        solana_program::program::invoke_signed(&(ix).into(), ctx.remaining_accounts, seeds)?;
    }

    // Burn the transaction to ensure one time use.
    let tx = &mut ctx.accounts.transaction;
    tx.executor = ctx.accounts.owner.key();
    tx.executed_at = Clock::get()?.unix_timestamp;

    emit!(TransactionExecuteEvent {
        smallet: ctx.accounts.smallet.key(),
        transaction: ctx.accounts.transaction.key(),
        executor: ctx.accounts.owner.key(),
        timestamp: Clock::get()?.unix_timestamp
    });
    Ok(())
}
