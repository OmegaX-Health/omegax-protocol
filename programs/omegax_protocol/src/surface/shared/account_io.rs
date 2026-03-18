// SPDX-License-Identifier: AGPL-3.0-or-later

use super::*;

pub(crate) fn deserialize_optional_program_account<T: AccountDeserialize>(
    account: &AccountInfo<'_>,
) -> Result<Option<T>> {
    if account.key() == crate::ID {
        return Ok(None);
    }
    require_keys_eq!(
        *account.owner,
        crate::ID,
        OmegaXProtocolError::InvalidProgramAccountData
    );
    let data = account.try_borrow_data()?;
    let mut data_slice: &[u8] = &data;
    let parsed = T::try_deserialize(&mut data_slice)
        .map_err(|_| OmegaXProtocolError::InvalidProgramAccountData)?;
    Ok(Some(parsed))
}

pub(crate) fn serialize_program_account<T: AccountSerialize>(
    account: &AccountInfo<'_>,
    value: &T,
) -> Result<()> {
    require_keys_eq!(
        *account.owner,
        crate::ID,
        OmegaXProtocolError::InvalidProgramAccountData
    );
    let mut data = account.try_borrow_mut_data()?;
    let mut writer: &mut [u8] = &mut data;
    value
        .try_serialize(&mut writer)
        .map_err(|_| OmegaXProtocolError::InvalidProgramAccountData.into())
}

pub(crate) fn read_u16(data: &[u8], offset: usize) -> Result<u16> {
    let bytes = data
        .get(offset..offset + 2)
        .ok_or(OmegaXProtocolError::InvalidQuoteSignatureInstruction)?;
    Ok(u16::from_le_bytes([bytes[0], bytes[1]]))
}

pub(crate) fn verify_quote_signature(
    instructions_sysvar: &AccountInfo<'_>,
    oracle: Pubkey,
    message: &[u8],
) -> Result<()> {
    require_keys_eq!(
        instructions_sysvar.key(),
        INSTRUCTIONS_SYSVAR_ID,
        OmegaXProtocolError::InvalidInstructionSysvar
    );

    let current_index = load_current_index_checked(instructions_sysvar)?;
    require!(
        current_index > 0,
        OmegaXProtocolError::MissingQuoteSignature
    );

    let instruction =
        load_instruction_at_checked((current_index - 1) as usize, instructions_sysvar)?;
    require_keys_eq!(
        instruction.program_id,
        ed25519_program::id(),
        OmegaXProtocolError::MissingQuoteSignature
    );

    let data = instruction.data;
    require!(
        data.len() >= 16,
        OmegaXProtocolError::InvalidQuoteSignatureInstruction
    );
    require!(
        data[0] == 1,
        OmegaXProtocolError::InvalidQuoteSignatureInstruction
    );

    let signature_instruction_index = read_u16(&data, 4)?;
    let public_key_offset = usize::from(read_u16(&data, 6)?);
    let public_key_instruction_index = read_u16(&data, 8)?;
    let message_data_offset = usize::from(read_u16(&data, 10)?);
    let message_data_size = usize::from(read_u16(&data, 12)?);
    let message_instruction_index = read_u16(&data, 14)?;

    require!(
        signature_instruction_index == u16::MAX,
        OmegaXProtocolError::InvalidQuoteSignatureInstruction
    );
    require!(
        public_key_instruction_index == u16::MAX,
        OmegaXProtocolError::InvalidQuoteSignatureInstruction
    );
    require!(
        message_instruction_index == u16::MAX,
        OmegaXProtocolError::InvalidQuoteSignatureInstruction
    );

    let public_key_bytes = data
        .get(public_key_offset..public_key_offset + 32)
        .ok_or(OmegaXProtocolError::InvalidQuoteSignatureInstruction)?;
    require!(
        public_key_bytes == oracle.as_ref(),
        OmegaXProtocolError::InvalidQuoteSignatureInstruction
    );

    let signed_message = data
        .get(message_data_offset..message_data_offset + message_data_size)
        .ok_or(OmegaXProtocolError::InvalidQuoteSignatureInstruction)?;
    require!(
        signed_message == message,
        OmegaXProtocolError::QuoteMessageMismatch
    );

    Ok(())
}

pub(crate) fn ensure_associated_token_account<'info>(
    payer: &Signer<'info>,
    associated_token_account: &AccountInfo<'info>,
    authority: &AccountInfo<'info>,
    mint: &AccountInfo<'info>,
    token_program: &Program<'info, Token>,
    associated_token_program: &Program<'info, AssociatedToken>,
    system_program: &Program<'info, System>,
) -> Result<()> {
    if associated_token_account.owner == &anchor_lang::system_program::ID
        || associated_token_account.data_is_empty()
    {
        let cpi_ctx = CpiContext::new(
            associated_token_program.to_account_info(),
            associated_token::Create {
                payer: payer.to_account_info(),
                associated_token: associated_token_account.clone(),
                authority: authority.clone(),
                mint: mint.clone(),
                system_program: system_program.to_account_info(),
                token_program: token_program.to_account_info(),
            },
        );
        associated_token::create(cpi_ctx)?;
    }
    Ok(())
}

pub(crate) fn ensure_program_account<'info>(
    payer: &Signer<'info>,
    account: &AccountInfo<'info>,
    account_seeds: &[&[u8]],
    space: usize,
    system_program: &Program<'info, System>,
) -> Result<()> {
    if account.owner == &anchor_lang::system_program::ID && account.data_is_empty() {
        let signer_groups = [account_seeds];
        let rent_lamports = Rent::get()?.minimum_balance(space);
        let cpi_ctx = CpiContext::new_with_signer(
            system_program.to_account_info(),
            system_program::CreateAccount {
                from: payer.to_account_info(),
                to: account.clone(),
            },
            &signer_groups,
        );
        system_program::create_account(cpi_ctx, rent_lamports, space as u64, &crate::ID)?;
    }
    require_keys_eq!(
        *account.owner,
        crate::ID,
        OmegaXProtocolError::AccountPoolMismatch
    );
    Ok(())
}
