//! Instruction handler for smallet::create_subaccount_info

use crate::*;

// Define the constant
const SUBACCOUNT_INFO_PREFIX_LEN: usize = 8;

pub fn handler(
    ctx: Context<CreateSubaccountInfo>,
    _bump: u8,
    subaccount: Pubkey,
    smallet: Pubkey,
    index: u64,
    subaccount_type: SubaccountType,
) -> Result<()> {
    let prefix = match subaccount_type {
        SubaccountType::Derived => b"SmalletDerived",
        SubaccountType::OwnerInvoker => b"SmalletOwnerInvoker",
    };

    let (address, _derived_bump) = Pubkey::find_program_address(
        &[prefix, &smallet.to_bytes(), &index.to_le_bytes()],
        &crate::ID,
    );

    invariant!(address == subaccount, "Subaccount address does not match the expected derived address.");

    let info = &mut ctx.accounts.subaccount_info;
    info.smallet = smallet;
    info.subaccount_type = subaccount_type;
    info.index = index;

    Ok(())
}

// Accounts for [smallet::create_subaccount_info].
#[derive(Accounts)]
#[instruction(bump: u8, subaccount: Pubkey)]
pub struct CreateSubaccountInfo<'info> {
    // The [SubaccountInfo] to create.
    #[account(
        init,
        seeds = [
            b"SubaccountInfo".as_ref(),
            &subaccount.to_bytes()
        ],
        bump,
        payer = payer,
        // Use the constant here
        space = SUBACCOUNT_INFO_PREFIX_LEN + SubaccountInfo::LEN
    )]
    pub subaccount_info: Account<'info, SubaccountInfo>,
    // Payer to create the [SubaccountInfo].
    #[account(mut)]
    pub payer: Signer<'info>,
    // The [System] program.
    pub system_program: Program<'info, System>,
}

impl<'info> Validate<'info> for CreateSubaccountInfo<'info> {
    fn validate(&self) -> Result<()> {
        // no validation necessary
        Ok(())
    }
}
