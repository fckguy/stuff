//! Sign transactions by owning a token

use anchor_lang::prelude::*;
use anchor_lang::solana_program::instruction::Instruction;
use anchor_lang::solana_program::program::invoke_signed;
use anchor_spl::token::TokenAccount;
use vipers::assert_keys_eq;
use vipers::validate::Validate;

mod account_validators;

// Define constants
const SOULBOUND_SIGNER: &[u8] = b"Soulboundsigner";

declare_id!("6BsvgJgTTKh7ynobSBgk7D5JpRw6DyE9fifw3p2fedeG");

/// Soulbound signer program
#[program]
pub mod soulboundsigner {
    use super::*;

    #[access_control(ctx.accounts.validate())]
    pub fn invoke_signed_instruction(
        ctx: Context<InvokeSignedInstruction>,
        data: Vec<u8>,
    ) -> Result<()> {
        let mint = ctx.accounts.nft_account.mint.to_bytes();
        let seeds: &[&[u8]] = &[SOULBOUND_SIGNER, &mint];
        let (nft_addr, bump) = Pubkey::find_program_address(seeds, ctx.program_id);
        let full_seeds = &[SOULBOUND_SIGNER, &mint, &[bump]];

        assert_keys_eq!(nft_addr, ctx.accounts.nft_pda, "nft_pda");

        let accounts: Vec<AccountMeta> = ctx
            .remaining_accounts
            .iter()
            .map(|acc| AccountMeta {
                pubkey: acc.key(),
                is_signer: acc.key() == ctx.accounts.nft_pda.key() || acc.is_signer,
                is_writable: acc.is_writable,
            })
            .collect();

        // Invoke the transaction, signed by the PDA
        let ix = Instruction {
            program_id: ctx.remaining_accounts[0].key(),
            accounts,
            data,
        };
        invoke_signed(&ix, ctx.remaining_accounts, &[full_seeds])?;

        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(bump: u8)]
pub struct InvokeSignedInstruction<'info> {
    /// Authority attempting to sign.
    pub owner_authority: Signer<'info>,

    /// Account containing at least one token.
    /// This must belong to `owner_authority`.
    pub nft_account: Account<'info, TokenAccount>,

    /// PDA associated with the NFT.
    #[account(
        seeds = [SOULBOUND_SIGNER, nft_account.mint.as_ref()],
        bump = bump,
    )]
    pub nft_pda: SystemAccount<'info>,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Unauthorized.")]
    Unauthorized,
}
