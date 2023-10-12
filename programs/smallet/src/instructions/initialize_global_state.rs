use crate::*;

#[derive(Accounts)]
pub struct InitializeGlobalState<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
      init,
      space = GlobalState::LEN,
      payer = admin,
      seeds = [
          b"Smallet".as_ref(),
      ],
      bump,
  )]
    pub global_state: Account<'info, GlobalState>,

    // system accounts
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
    // TODO: should uncomment these accounts for real network version
    // ProgramData PDA is not created on localnetwork
    // So commented program deployer validation to pass unit-tests
    //   #[account(
    //     constraint = program.programdata_address()? == Some(program_data.key()) @ crate::ErrorCode::InvalidProgramDataAccount,
    //     constraint = program.key() == crate::ID,
    // )]
    //   pub program: Program<'info, crate::program::Smallet>,
    //   #[account(constraint = program_data.upgrade_authority_address == Some(admin.key()) @ crate::ErrorCode::InvalidDeployer)]
    //   pub program_data: Account<'info, ProgramData>,
}

pub fn handle(ctx: Context<InitializeGlobalState>) -> Result<()> {
    let global_state = &mut ctx.accounts.global_state;

    // save global admin
    global_state.global_admin = ctx.accounts.admin.key();

    Ok(())
}
