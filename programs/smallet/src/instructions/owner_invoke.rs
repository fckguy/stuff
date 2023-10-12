//! Instruction handler for [smallet:owner_invoke_instruction] and [smallet::owner_invoke_instruction_v2].

use crate::*;

// Instruction handler for smallet::owner_invoke_instruction
pub fn owner_invoke_instruction(
    ctx: Context<OwnerInvokeInstruction>,
    index: u64,
    bump: u8,
    ix: TXInstruction,
) -> Result<()> {
    let smallet = &ctx.accounts.smallet;
    let invoker_seeds: &[&[&[u8]]] = &[&[
        b"SmalletOwnerInvoker" as &[u8],
        &smallet.key().to_bytes(),
        &index.to_le_bytes(),
        &[bump],
    ]];

    solana_program::program::invoke_signed(&(&ix).into(), ctx.remaining_accounts, invoker_seeds)?;

    Ok(())
}

// Instruction handler for smallet::owner_invoke_instruction_v2
pub fn owner_invoke_instruction_v2(
    ctx: Context<OwnerInvokeInstruction>,
    index: u64,
    bump: u8,
    invoker: Pubkey,
    data: Vec<u8>,
) -> Result<()> {
    let smallet = &ctx.accounts.smallet;
    // Execute the transaction signed by the smallet.
    let invoker_seeds: &[&[&[u8]]] = &[&[
        b"SmalletOwnerInvoker" as &[u8],
        &smallet.key().to_bytes(),
        &index.to_le_bytes(),
        &[bump],
    ]];

    let program_id = ctx.remaining_accounts[0].key();
    let accounts: Vec<AccountMeta> = ctx.remaining_accounts[1..]
        .iter()
        .map(|v| AccountMeta {
            pubkey: *v.key,
            is_signer: if v.key == &invoker { true } else { v.is_signer },
            is_writable: v.is_writable,
        })
        .collect();
    let ix = &solana_program::instruction::Instruction {
        program_id,
        accounts,
        data,
    };

    solana_program::program::invoke_signed(ix, ctx.remaining_accounts, invoker_seeds)?;
    Ok(())
}

// Accounts for [smallet::owner_invoke_instruction].
#[derive(Accounts)]
pub struct OwnerInvokeInstruction<'info> {
    // The [Smallet]
    pub smallet: Account<'info, Smallet>,
    // An owner of the [Smallet].
    pub owner: Signer<'info>,
}

impl<'info> Validate<'info> for OwnerInvokeInstruction<'info> {
    fn validate(&self) -> Result<()> {
        // Smallet is frozen
        invariant!(!self.smallet.frozen, AccountFrozen);

        self.smallet.try_owner_index(self.owner.key())?;
        Ok(())
    }
}
