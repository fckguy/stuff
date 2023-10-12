use crate::InvokeSignedInstruction;
use anchor_lang::prelude::*;
use vipers::{assert_keys_eq, invariant, validate::Validate};

impl<'info> Validate<'info> for InvokeSignedInstruction<'info> {
    fn validate(&self) -> Result<()> {
        // Ensure the NFT account is owned by the `owner_authority`.
        assert_keys_eq!(
            self.owner_authority,
            self.nft_account.owner,
            "The owner_authority does not match the NFT account owner."
        );

        // Ensure the NFT account has exactly one token, indicating ownership.
        invariant!(
            self.nft_account.amount == 1,
            "Unauthorized: The NFT account must have exactly one token."
        );

        Ok(())
    }
}
