// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  GovernanceConfig,
  MintMaxVoteWeightSource,
  SetRealmAuthorityAction,
  VoteThreshold,
  VoteThresholdType,
  VoteTipping,
  getAllGovernances,
  getGovernanceProgramVersion,
  getNativeTreasuryAddress,
  getRealm,
  getTokenOwnerRecordAddress,
  withCreateGovernance,
  withCreateNativeTreasury,
  withCreateRealm,
  withDepositGoverningTokens,
  withSetRealmAuthority,
} from '@solana/spl-governance';
import {
  AuthorityType,
  createMint,
  getAccount,
  getMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  setAuthority,
} from '@solana/spl-token';
import { Connection, Keypair, PublicKey, Transaction, TransactionInstruction } from '@solana/web3.js';
import BN from 'bn.js';
import bs58 from 'bs58';

import protocolModule from '../frontend/lib/protocol.ts';

const {
  deriveConfigV2Pda,
  getProgramId,
} = protocolModule as unknown as typeof import('../frontend/lib/protocol.ts');

const DEFAULT_REALMS_GOVERNANCE_PROGRAM_ID = 'GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw';

function requireEnv(name: string): string {
  const value = String(process.env[name] ?? '').trim();
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function parseU32Env(name: string, fallback: number): number {
  const raw = String(process.env[name] ?? '').trim();
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 0xffffffff) {
    throw new Error(`Invalid ${name}: expected integer in [0, 4294967295]`);
  }
  return parsed;
}

function parseU8Env(name: string, fallback: number): number {
  const raw = String(process.env[name] ?? '').trim();
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 255) {
    throw new Error(`Invalid ${name}: expected integer in [0, 255]`);
  }
  return parsed;
}

function parseBigIntEnv(name: string, fallback: bigint): bigint {
  const raw = String(process.env[name] ?? '').trim();
  if (!raw) return fallback;
  try {
    const parsed = BigInt(raw);
    if (parsed < 0n) {
      throw new Error('negative');
    }
    return parsed;
  } catch {
    throw new Error(`Invalid ${name}: expected unsigned integer`);
  }
}

function parseBoolEnv(name: string, fallback: boolean): boolean {
  const raw = String(process.env[name] ?? '').trim().toLowerCase();
  if (!raw) return fallback;
  if (raw === '1' || raw === 'true' || raw === 'yes') return true;
  if (raw === '0' || raw === 'false' || raw === 'no') return false;
  throw new Error(`Invalid ${name}: expected boolean (true/false)`);
}

function toSafeNumber(value: number | BN, label: string): number {
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0) {
      throw new Error(`Invalid ${label}: expected unsigned integer`);
    }
    return value;
  }
  const asNumber = Number.parseInt(value.toString(10), 10);
  if (!Number.isFinite(asNumber) || asNumber < 0) {
    throw new Error(`Invalid ${label}: expected unsigned integer`);
  }
  return asNumber;
}

function keypairFromBase58Env(name: string): Keypair {
  const value = requireEnv(name);
  return Keypair.fromSecretKey(bs58.decode(value));
}

async function sendAndConfirm(
  connection: Connection,
  payer: Keypair,
  instructions: TransactionInstruction[],
  signers: Keypair[],
  label: string,
): Promise<string> {
  if (instructions.length === 0) {
    return '';
  }

  const tx = new Transaction();
  for (const ix of instructions) {
    tx.add(ix);
  }
  tx.feePayer = payer.publicKey;

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
  tx.recentBlockhash = blockhash;

  const signerMap = new Map<string, Keypair>();
  for (const signer of [payer, ...signers]) {
    signerMap.set(signer.publicKey.toBase58(), signer);
  }
  tx.partialSign(...Array.from(signerMap.values()));

  const signature = await connection.sendRawTransaction(
    tx.serialize({ requireAllSignatures: true, verifySignatures: true }),
    { skipPreflight: false, maxRetries: 3 },
  );
  await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed');
  console.log(`[governance-bootstrap] ${label}: ${signature}`);
  return signature;
}

async function main() {
  const rpcUrl = String(
    process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
  ).trim();
  const governanceCluster = String(process.env.GOVERNANCE_CLUSTER || 'devnet').trim();
  const governanceProgramId = new PublicKey(
    String(process.env.GOVERNANCE_PROGRAM_ID || DEFAULT_REALMS_GOVERNANCE_PROGRAM_ID).trim(),
  );
  const governanceProgramVersionOverride = parseU8Env('GOVERNANCE_PROGRAM_VERSION', 0);
  const programIdRaw = String(process.env.PROTOCOL_PROGRAM_ID || 'Bn6eixac1QEEVErGBvBjxAd6pgB9e2q4XHvAkinQ5y1B').trim();
  process.env.NEXT_PUBLIC_PROTOCOL_PROGRAM_ID = programIdRaw;

  const governanceSigner = keypairFromBase58Env('GOVERNANCE_SECRET_KEY_BASE58');
  const realmName = String(process.env.GOVERNANCE_REALM_NAME || 'OmegaX Devnet Beta DAO').trim();
  const realmOverride = String(process.env.GOVERNANCE_REALM || '').trim();

  const governanceTokenMintOverride = String(process.env.GOVERNANCE_TOKEN_MINT || '').trim();
  const governanceTokenDecimals = parseU8Env('GOVERNANCE_TOKEN_DECIMALS', 0);
  const governanceTokenMintAmount = parseBigIntEnv('GOVERNANCE_TOKEN_MINT_AMOUNT', 1_000_000n);
  const governanceDepositAmount = parseBigIntEnv('GOVERNANCE_DEPOSIT_AMOUNT', 1n);
  const enforceImmutableGovernanceMint = parseBoolEnv('ENFORCE_IMMUTABLE_GOVERNANCE_MINT', true);
  const lockRealmAuthorityToGovernance = parseBoolEnv('LOCK_REALM_AUTHORITY_TO_GOVERNANCE', true);
  const enforceExistingGovernanceSecurityFloor = parseBoolEnv('ENFORCE_EXISTING_GOVERNANCE_SECURITY_FLOOR', true);
  const allowRealmNameMismatch = parseBoolEnv('ALLOW_REALM_NAME_MISMATCH', false);
  const allowZeroHoldUp = parseBoolEnv('GOVERNANCE_ALLOW_ZERO_HOLDUP', false);

  const minCommunityTokensToCreateGovernance = parseBigIntEnv('MIN_COMMUNITY_TOKENS_TO_CREATE_GOVERNANCE', 1n);
  const minCommunityTokensToCreateProposal = parseBigIntEnv('MIN_COMMUNITY_TOKENS_TO_CREATE_PROPOSAL', 1n);
  const communityVoteThresholdPct = parseU8Env('GOVERNANCE_COMMUNITY_YES_VOTE_THRESHOLD_PCT', 60);
  const baseVotingTime = parseU32Env('GOVERNANCE_BASE_VOTING_TIME_SECS', 3600);
  const votingCoolOffTime = parseU32Env('GOVERNANCE_VOTING_COOLOFF_SECS', 0);
  const minInstructionHoldUpTime = parseU32Env('GOVERNANCE_MIN_INSTRUCTION_HOLDUP_SECS', 900);
  const depositExemptProposalCount = parseU8Env('GOVERNANCE_DEPOSIT_EXEMPT_PROPOSAL_COUNT', 0);

  if (baseVotingTime < 3600) {
    throw new Error('GOVERNANCE_BASE_VOTING_TIME_SECS must be >= 3600 (SPL Governance requirement).');
  }
  if (communityVoteThresholdPct < 1 || communityVoteThresholdPct > 100) {
    throw new Error('GOVERNANCE_COMMUNITY_YES_VOTE_THRESHOLD_PCT must be in [1, 100].');
  }
  if (governanceDepositAmount === 0n) {
    throw new Error('GOVERNANCE_DEPOSIT_AMOUNT must be > 0 to establish governance voting power.');
  }
  if (minInstructionHoldUpTime === 0 && !allowZeroHoldUp) {
    throw new Error(
      'GOVERNANCE_MIN_INSTRUCTION_HOLDUP_SECS=0 is unsafe. Set GOVERNANCE_ALLOW_ZERO_HOLDUP=true only for temporary testing.',
    );
  }

  const connection = new Connection(rpcUrl, 'confirmed');
  const protocolProgramId = getProgramId();
  if (protocolProgramId.toBase58() !== programIdRaw) {
    throw new Error(
      `Program id mismatch between env and generated contract: ${programIdRaw} vs ${protocolProgramId.toBase58()}`,
    );
  }

  const configV2Pda = deriveConfigV2Pda(protocolProgramId);
  const detectedGovernanceProgramVersion = await getGovernanceProgramVersion(
    connection,
    governanceProgramId,
    governanceCluster,
  );
  let governanceProgramVersion = detectedGovernanceProgramVersion;
  if (governanceProgramVersionOverride > 0) {
    governanceProgramVersion = governanceProgramVersionOverride;
  } else if (
    governanceProgramVersion === 1 &&
    governanceProgramId.toBase58() === DEFAULT_REALMS_GOVERNANCE_PROGRAM_ID
  ) {
    // SPL Governance helper can return an outdated fallback on clusters where version discovery lags;
    // the canonical GovER5* deployment uses v3 instruction layouts.
    governanceProgramVersion = 3;
    console.warn(
      `[governance-bootstrap] warning: detected governance program version=1 for ${DEFAULT_REALMS_GOVERNANCE_PROGRAM_ID}; using fallback version=3.`,
    );
  } else if (governanceProgramVersion === 1) {
    console.warn(
      `[governance-bootstrap] warning: governance program version resolved to 1. Set GOVERNANCE_PROGRAM_VERSION explicitly if your deployment uses newer layouts.`,
    );
  }

  const [derivedRealmAddress] = await PublicKey.findProgramAddress(
    [Buffer.from('governance'), Buffer.from(realmName)],
    governanceProgramId,
  );
  const realmAddress = realmOverride ? new PublicKey(realmOverride) : derivedRealmAddress;

  const realmAccountInfo = await connection.getAccountInfo(realmAddress, 'confirmed');
  const realmExists = Boolean(realmAccountInfo);
  if (realmOverride && !realmExists) {
    throw new Error(`GOVERNANCE_REALM=${realmAddress.toBase58()} was provided but account does not exist.`);
  }

  let governanceTokenMint = governanceTokenMintOverride
    ? new PublicKey(governanceTokenMintOverride)
    : null;
  let createdGovernanceTokenMint = false;
  let realmAuthority: PublicKey | null = null;

  if (realmExists) {
    const realm = await getRealm(connection, realmAddress);
    realmAuthority = realm.account.authority ?? null;
    if (!realm.account.name || realm.account.name !== realmName) {
      const message = `[governance-bootstrap] realm name mismatch (${realm.account.name}) vs requested (${realmName}).`;
      if (!allowRealmNameMismatch) {
        throw new Error(`${message} Set ALLOW_REALM_NAME_MISMATCH=true only when intentionally reusing a different realm.`);
      }
      console.warn(`${message} continuing because ALLOW_REALM_NAME_MISMATCH=true.`);
    }
    if (governanceTokenMint && !realm.account.communityMint.equals(governanceTokenMint)) {
      throw new Error(
        `GOVERNANCE_TOKEN_MINT mismatch: realm uses ${realm.account.communityMint.toBase58()} but override is ${governanceTokenMint.toBase58()}.`,
      );
    }
    governanceTokenMint = realm.account.communityMint;
  } else {
    if (!governanceTokenMint) {
      governanceTokenMint = await createMint(
        connection,
        governanceSigner,
        governanceSigner.publicKey,
        null,
        governanceTokenDecimals,
      );
      createdGovernanceTokenMint = true;
      console.log(`[governance-bootstrap] create_governance_token_mint: ${governanceTokenMint.toBase58()}`);
    }

    const instructions: TransactionInstruction[] = [];
    await withCreateRealm(
      instructions,
      governanceProgramId,
      governanceProgramVersion,
      realmName,
      governanceSigner.publicKey,
      governanceTokenMint,
      governanceSigner.publicKey,
      undefined,
      MintMaxVoteWeightSource.FULL_SUPPLY_FRACTION,
      new BN(minCommunityTokensToCreateGovernance.toString()),
      undefined,
      undefined,
    );
    await sendAndConfirm(connection, governanceSigner, instructions, [governanceSigner], 'create_realm');
    realmAuthority = governanceSigner.publicKey;
  }

  if (!governanceTokenMint) {
    throw new Error('Unable to determine governance token mint.');
  }

  const governanceTokenAta = await getOrCreateAssociatedTokenAccount(
    connection,
    governanceSigner,
    governanceTokenMint,
    governanceSigner.publicKey,
  );

  if (createdGovernanceTokenMint && governanceTokenMintAmount > 0n) {
    await mintTo(
      connection,
      governanceSigner,
      governanceTokenMint,
      governanceTokenAta.address,
      governanceSigner,
      governanceTokenMintAmount,
    );
    console.log(`[governance-bootstrap] mint_governance_tokens: ${governanceTokenMintAmount.toString()}`);
  }

  const tokenAccount = await getAccount(connection, governanceTokenAta.address, 'confirmed');
  if (tokenAccount.amount < governanceDepositAmount) {
    throw new Error(
      `Governance signer token balance (${tokenAccount.amount.toString()}) is below GOVERNANCE_DEPOSIT_AMOUNT (${governanceDepositAmount.toString()}).`,
    );
  }

  const tokenOwnerRecordAddress = await getTokenOwnerRecordAddress(
    governanceProgramId,
    realmAddress,
    governanceTokenMint,
    governanceSigner.publicKey,
  );
  const tokenOwnerRecordInfo = await connection.getAccountInfo(tokenOwnerRecordAddress, 'confirmed');

  if (!tokenOwnerRecordInfo) {
    const instructions: TransactionInstruction[] = [];
    await withDepositGoverningTokens(
      instructions,
      governanceProgramId,
      governanceProgramVersion,
      realmAddress,
      governanceTokenAta.address,
      governanceTokenMint,
      governanceSigner.publicKey,
      governanceSigner.publicKey,
      governanceSigner.publicKey,
      new BN(governanceDepositAmount.toString()),
      true,
    );
    await sendAndConfirm(connection, governanceSigner, instructions, [governanceSigner], 'deposit_governing_tokens');
  } else {
    console.log('[governance-bootstrap] deposit_governing_tokens: token owner record already exists');
  }

  if (enforceImmutableGovernanceMint) {
    const mintState = await getMint(connection, governanceTokenMint, 'confirmed');
    if (mintState.mintAuthority) {
      if (!mintState.mintAuthority.equals(governanceSigner.publicKey)) {
        throw new Error(
          `Governance token mint authority is ${mintState.mintAuthority.toBase58()} (expected none or ${governanceSigner.publicKey.toBase58()}).`,
        );
      }
      await setAuthority(
        connection,
        governanceSigner,
        governanceTokenMint,
        governanceSigner,
        AuthorityType.MintTokens,
        null,
      );
      console.log('[governance-bootstrap] revoke_governance_mint_authority: done');
    }

    const postMintState = await getMint(connection, governanceTokenMint, 'confirmed');
    if (postMintState.freezeAuthority) {
      if (!postMintState.freezeAuthority.equals(governanceSigner.publicKey)) {
        throw new Error(
          `Governance token freeze authority is ${postMintState.freezeAuthority.toBase58()} (expected none or ${governanceSigner.publicKey.toBase58()}).`,
        );
      }
      await setAuthority(
        connection,
        governanceSigner,
        governanceTokenMint,
        governanceSigner,
        AuthorityType.FreezeAccount,
        null,
      );
      console.log('[governance-bootstrap] revoke_governance_freeze_authority: done');
    }
  }

  const existingGovernances = await getAllGovernances(connection, governanceProgramId, realmAddress);
  const existingGovernanceForConfig = existingGovernances.find((entry) =>
    entry.account.governedAccount.equals(configV2Pda),
  );
  let governanceAddress = existingGovernanceForConfig?.pubkey;

  if (existingGovernanceForConfig && enforceExistingGovernanceSecurityFloor) {
    const existingHoldUp = toSafeNumber(
      existingGovernanceForConfig.account.config.minInstructionHoldUpTime,
      'existing governance minInstructionHoldUpTime',
    );
    if (existingHoldUp === 0 && !allowZeroHoldUp) {
      throw new Error(
        `Existing governance ${existingGovernanceForConfig.pubkey.toBase58()} has zero hold-up. This is unsafe for production.`,
      );
    }
    if (existingHoldUp < minInstructionHoldUpTime) {
      throw new Error(
        `Existing governance hold-up (${existingHoldUp}s) is below required floor (${minInstructionHoldUpTime}s).`,
      );
    }
  }

  if (!governanceAddress) {
    if (!realmAuthority) {
      throw new Error(
        'Realm authority is unset; cannot create governance for protocol config without a realm authority signer.',
      );
    }
    if (!realmAuthority.equals(governanceSigner.publicKey)) {
      throw new Error(
        `Realm authority is ${realmAuthority.toBase58()}, but governance signer is ${governanceSigner.publicKey.toBase58()}. Refusing to create governance under external authority.`,
      );
    }

    const governanceConfig = new GovernanceConfig({
      communityVoteThreshold: new VoteThreshold({
        type: VoteThresholdType.YesVotePercentage,
        value: communityVoteThresholdPct,
      }),
      minCommunityTokensToCreateProposal: new BN(minCommunityTokensToCreateProposal.toString()),
      minInstructionHoldUpTime,
      baseVotingTime,
      communityVoteTipping: VoteTipping.Early,
      minCouncilTokensToCreateProposal: new BN(0),
      councilVoteThreshold: new VoteThreshold({ type: VoteThresholdType.Disabled }),
      councilVetoVoteThreshold: new VoteThreshold({ type: VoteThresholdType.Disabled }),
      communityVetoVoteThreshold: new VoteThreshold({ type: VoteThresholdType.Disabled }),
      councilVoteTipping: VoteTipping.Disabled,
      votingCoolOffTime,
      depositExemptProposalCount,
    });

    const instructions: TransactionInstruction[] = [];
    governanceAddress = await withCreateGovernance(
      instructions,
      governanceProgramId,
      governanceProgramVersion,
      realmAddress,
      configV2Pda,
      governanceConfig,
      tokenOwnerRecordAddress,
      governanceSigner.publicKey,
      governanceSigner.publicKey,
    );
    await sendAndConfirm(connection, governanceSigner, instructions, [governanceSigner], 'create_account_governance');
  } else {
    console.log('[governance-bootstrap] create_account_governance: already exists');
  }

  if (lockRealmAuthorityToGovernance) {
    const latestRealm = await getRealm(connection, realmAddress);
    const currentRealmAuthority = latestRealm.account.authority ?? null;

    if (!currentRealmAuthority) {
      throw new Error('Realm authority is already removed; expected governance PDA authority for managed operation.');
    }

    if (currentRealmAuthority.equals(governanceAddress)) {
      console.log('[governance-bootstrap] set_realm_authority_checked: already configured');
    } else if (currentRealmAuthority.equals(governanceSigner.publicKey)) {
      const instructions: TransactionInstruction[] = [];
      withSetRealmAuthority(
        instructions,
        governanceProgramId,
        governanceProgramVersion,
        realmAddress,
        governanceSigner.publicKey,
        governanceAddress,
        SetRealmAuthorityAction.SetChecked,
      );
      await sendAndConfirm(
        connection,
        governanceSigner,
        instructions,
        [governanceSigner],
        'set_realm_authority_checked',
      );
    } else {
      throw new Error(
        `Realm authority is ${currentRealmAuthority.toBase58()} and cannot be changed by governance signer ${governanceSigner.publicKey.toBase58()}.`,
      );
    }
  }

  const nativeTreasuryAddress = await getNativeTreasuryAddress(governanceProgramId, governanceAddress);
  const nativeTreasuryInfo = await connection.getAccountInfo(nativeTreasuryAddress, 'confirmed');
  if (!nativeTreasuryInfo) {
    const instructions: TransactionInstruction[] = [];
    await withCreateNativeTreasury(
      instructions,
      governanceProgramId,
      governanceProgramVersion,
      governanceAddress,
      governanceSigner.publicKey,
    );
    await sendAndConfirm(connection, governanceSigner, instructions, [governanceSigner], 'create_native_treasury');
  } else {
    console.log('[governance-bootstrap] create_native_treasury: already exists');
  }

  console.log('');
  console.log('[governance-bootstrap] Complete');
  console.log(`[governance-bootstrap] rpc_url=${rpcUrl}`);
  console.log(`[governance-bootstrap] governance_program_id=${governanceProgramId.toBase58()}`);
  console.log(`[governance-bootstrap] governance_program_version_detected=${detectedGovernanceProgramVersion}`);
  console.log(`[governance-bootstrap] governance_program_version=${governanceProgramVersion}`);
  console.log(`[governance-bootstrap] governance_signer=${governanceSigner.publicKey.toBase58()}`);
  console.log(`[governance-bootstrap] governance_realm_name=${realmName}`);
  console.log(`[governance-bootstrap] governance_realm=${realmAddress.toBase58()}`);
  console.log(`[governance-bootstrap] governance_config=${governanceAddress.toBase58()}`);
  console.log(`[governance-bootstrap] governance_treasury=${nativeTreasuryAddress.toBase58()}`);
  console.log(`[governance-bootstrap] governance_token_mint=${governanceTokenMint.toBase58()}`);
  console.log(`[governance-bootstrap] governance_token_owner_record=${tokenOwnerRecordAddress.toBase58()}`);
  console.log(`[governance-bootstrap] governance_token_owner_ata=${governanceTokenAta.address.toBase58()}`);
  console.log(`[governance-bootstrap] protocol_config_pda=${configV2Pda.toBase58()}`);
  console.log(`[governance-bootstrap] immutable_governance_mint=${enforceImmutableGovernanceMint}`);
  console.log(`[governance-bootstrap] lock_realm_authority_to_governance=${lockRealmAuthorityToGovernance}`);
  console.log(
    `[governance-bootstrap] enforce_existing_governance_security_floor=${enforceExistingGovernanceSecurityFloor}`,
  );
  console.log(`[governance-bootstrap] allow_realm_name_mismatch=${allowRealmNameMismatch}`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[governance-bootstrap] failed: ${message}`);
  process.exit(1);
});
