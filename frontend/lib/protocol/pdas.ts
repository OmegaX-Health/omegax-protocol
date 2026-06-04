// SPDX-License-Identifier: AGPL-3.0-or-later

import { PublicKey } from "@solana/web3.js";

import { getProgramId, toPublicKey } from "./address";
import {
  BPF_UPGRADEABLE_LOADER_PROGRAM_ID,
  SEED_ALLOCATION_LEDGER,
  SEED_ALLOCATION_POSITION,
  SEED_CAPITAL_CLASS,
  SEED_CLAIM_CASE,
  SEED_DOMAIN_ASSET_LEDGER,
  SEED_DOMAIN_ASSET_VAULT,
  SEED_DOMAIN_ASSET_VAULT_TOKEN,
  SEED_FUNDING_LINE,
  SEED_FUNDING_LINE_LEDGER,
  SEED_HEALTH_PLAN,
  SEED_LIQUIDITY_POOL,
  SEED_LP_POSITION,
  SEED_MEMBER_POSITION,
  SEED_MEMBERSHIP_ANCHOR_SEAT,
  SEED_OBLIGATION,
  SEED_ORACLE_PROFILE,
  SEED_PLAN_RESERVE_LEDGER,
  SEED_POLICY_SERIES,
  SEED_POOL_CLASS_LEDGER,
  SEED_PROTOCOL_GOVERNANCE,
  SEED_RESERVE_DOMAIN,
  ZERO_PUBKEY_KEY,
} from "./constants";
import { assertSeedId, TEXT_ENCODER } from "./encoding";
import type { PublicKeyish } from "./types";

function derivePda(seeds: Uint8Array[], programId = getProgramId()): PublicKey {
  return PublicKey.findProgramAddressSync(seeds, programId)[0];
}

function stringSeed(value: string, label: string): Uint8Array {
  assertSeedId(value, label);
  return TEXT_ENCODER.encode(value);
}

export function deriveProtocolGovernancePda(programId = getProgramId()): PublicKey {
  return derivePda([TEXT_ENCODER.encode(SEED_PROTOCOL_GOVERNANCE)], programId);
}

export function deriveProgramDataAddress(programId = getProgramId()): PublicKey {
  return derivePda([programId.toBuffer()], BPF_UPGRADEABLE_LOADER_PROGRAM_ID);
}

export function deriveReserveDomainPda(params: {
  domainId: string;
  programId?: PublicKey;
}): PublicKey {
  return derivePda(
    [TEXT_ENCODER.encode(SEED_RESERVE_DOMAIN), stringSeed(params.domainId, "domain id")],
    params.programId ?? getProgramId(),
  );
}

export function deriveDomainAssetVaultPda(params: {
  reserveDomain: PublicKeyish;
  assetMint: PublicKeyish;
  programId?: PublicKey;
}): PublicKey {
  return derivePda(
    [
      TEXT_ENCODER.encode(SEED_DOMAIN_ASSET_VAULT),
      toPublicKey(params.reserveDomain).toBytes(),
      toPublicKey(params.assetMint).toBytes(),
    ],
    params.programId ?? getProgramId(),
  );
}

// PDA-derived address for the SPL token account that holds vault assets. The
// program initialises this account with `token::authority = domain_asset_vault`
// (see CreateDomainAssetVault context) so outflow CPIs can sign as the vault
// PDA. Operators no longer pre-create this token account.
export function deriveDomainAssetVaultTokenAccountPda(params: {
  reserveDomain: PublicKeyish;
  assetMint: PublicKeyish;
  programId?: PublicKey;
}): PublicKey {
  return derivePda(
    [
      TEXT_ENCODER.encode(SEED_DOMAIN_ASSET_VAULT_TOKEN),
      toPublicKey(params.reserveDomain).toBytes(),
      toPublicKey(params.assetMint).toBytes(),
    ],
    params.programId ?? getProgramId(),
  );
}

export function deriveDomainAssetLedgerPda(params: {
  reserveDomain: PublicKeyish;
  assetMint: PublicKeyish;
  programId?: PublicKey;
}): PublicKey {
  return derivePda(
    [
      TEXT_ENCODER.encode(SEED_DOMAIN_ASSET_LEDGER),
      toPublicKey(params.reserveDomain).toBytes(),
      toPublicKey(params.assetMint).toBytes(),
    ],
    params.programId ?? getProgramId(),
  );
}

export function deriveHealthPlanPda(params: {
  reserveDomain: PublicKeyish;
  planId: string;
  programId?: PublicKey;
}): PublicKey {
  return derivePda(
    [
      TEXT_ENCODER.encode(SEED_HEALTH_PLAN),
      toPublicKey(params.reserveDomain).toBytes(),
      stringSeed(params.planId, "plan id"),
    ],
    params.programId ?? getProgramId(),
  );
}

export function derivePlanReserveLedgerPda(params: {
  healthPlan: PublicKeyish;
  assetMint: PublicKeyish;
  programId?: PublicKey;
}): PublicKey {
  return derivePda(
    [
      TEXT_ENCODER.encode(SEED_PLAN_RESERVE_LEDGER),
      toPublicKey(params.healthPlan).toBytes(),
      toPublicKey(params.assetMint).toBytes(),
    ],
    params.programId ?? getProgramId(),
  );
}

export function derivePolicySeriesPda(params: {
  healthPlan: PublicKeyish;
  seriesId: string;
  programId?: PublicKey;
}): PublicKey {
  return derivePda(
    [
      TEXT_ENCODER.encode(SEED_POLICY_SERIES),
      toPublicKey(params.healthPlan).toBytes(),
      stringSeed(params.seriesId, "series id"),
    ],
    params.programId ?? getProgramId(),
  );
}

export function deriveMemberPositionPda(params: {
  healthPlan: PublicKeyish;
  wallet: PublicKeyish;
  seriesScope?: PublicKeyish;
  programId?: PublicKey;
}): PublicKey {
  return derivePda(
    [
      TEXT_ENCODER.encode(SEED_MEMBER_POSITION),
      toPublicKey(params.healthPlan).toBytes(),
      toPublicKey(params.wallet).toBytes(),
      toPublicKey(params.seriesScope ?? ZERO_PUBKEY_KEY).toBytes(),
    ],
    params.programId ?? getProgramId(),
  );
}

export function deriveMembershipAnchorSeatPda(params: {
  healthPlan: PublicKeyish;
  anchorRef: PublicKeyish;
  programId?: PublicKey;
}): PublicKey {
  return derivePda(
    [
      TEXT_ENCODER.encode(SEED_MEMBERSHIP_ANCHOR_SEAT),
      toPublicKey(params.healthPlan).toBytes(),
      toPublicKey(params.anchorRef).toBytes(),
    ],
    params.programId ?? getProgramId(),
  );
}

export function deriveFundingLinePda(params: {
  healthPlan: PublicKeyish;
  lineId: string;
  programId?: PublicKey;
}): PublicKey {
  return derivePda(
    [
      TEXT_ENCODER.encode(SEED_FUNDING_LINE),
      toPublicKey(params.healthPlan).toBytes(),
      stringSeed(params.lineId, "funding line id"),
    ],
    params.programId ?? getProgramId(),
  );
}

export function deriveFundingLineLedgerPda(params: {
  fundingLine: PublicKeyish;
  assetMint: PublicKeyish;
  programId?: PublicKey;
}): PublicKey {
  return derivePda(
    [
      TEXT_ENCODER.encode(SEED_FUNDING_LINE_LEDGER),
      toPublicKey(params.fundingLine).toBytes(),
      toPublicKey(params.assetMint).toBytes(),
    ],
    params.programId ?? getProgramId(),
  );
}

export function deriveClaimCasePda(params: {
  healthPlan: PublicKeyish;
  claimId: string;
  programId?: PublicKey;
}): PublicKey {
  return derivePda(
    [
      TEXT_ENCODER.encode(SEED_CLAIM_CASE),
      toPublicKey(params.healthPlan).toBytes(),
      stringSeed(params.claimId, "claim id"),
    ],
    params.programId ?? getProgramId(),
  );
}

export function deriveObligationPda(params: {
  fundingLine: PublicKeyish;
  obligationId: string;
  programId?: PublicKey;
}): PublicKey {
  return derivePda(
    [
      TEXT_ENCODER.encode(SEED_OBLIGATION),
      toPublicKey(params.fundingLine).toBytes(),
      stringSeed(params.obligationId, "obligation id"),
    ],
    params.programId ?? getProgramId(),
  );
}

export function deriveLiquidityPoolPda(params: {
  reserveDomain: PublicKeyish;
  poolId: string;
  programId?: PublicKey;
}): PublicKey {
  return derivePda(
    [
      TEXT_ENCODER.encode(SEED_LIQUIDITY_POOL),
      toPublicKey(params.reserveDomain).toBytes(),
      stringSeed(params.poolId, "pool id"),
    ],
    params.programId ?? getProgramId(),
  );
}

export function deriveCapitalClassPda(params: {
  liquidityPool: PublicKeyish;
  classId: string;
  programId?: PublicKey;
}): PublicKey {
  return derivePda(
    [
      TEXT_ENCODER.encode(SEED_CAPITAL_CLASS),
      toPublicKey(params.liquidityPool).toBytes(),
      stringSeed(params.classId, "capital class id"),
    ],
    params.programId ?? getProgramId(),
  );
}

export function derivePoolClassLedgerPda(params: {
  capitalClass: PublicKeyish;
  assetMint: PublicKeyish;
  programId?: PublicKey;
}): PublicKey {
  return derivePda(
    [
      TEXT_ENCODER.encode(SEED_POOL_CLASS_LEDGER),
      toPublicKey(params.capitalClass).toBytes(),
      toPublicKey(params.assetMint).toBytes(),
    ],
    params.programId ?? getProgramId(),
  );
}

export function deriveLpPositionPda(params: {
  capitalClass: PublicKeyish;
  owner: PublicKeyish;
  programId?: PublicKey;
}): PublicKey {
  return derivePda(
    [
      TEXT_ENCODER.encode(SEED_LP_POSITION),
      toPublicKey(params.capitalClass).toBytes(),
      toPublicKey(params.owner).toBytes(),
    ],
    params.programId ?? getProgramId(),
  );
}

export function deriveAllocationPositionPda(params: {
  capitalClass: PublicKeyish;
  fundingLine: PublicKeyish;
  programId?: PublicKey;
}): PublicKey {
  return derivePda(
    [
      TEXT_ENCODER.encode(SEED_ALLOCATION_POSITION),
      toPublicKey(params.capitalClass).toBytes(),
      toPublicKey(params.fundingLine).toBytes(),
    ],
    params.programId ?? getProgramId(),
  );
}

export function deriveAllocationLedgerPda(params: {
  allocationPosition: PublicKeyish;
  assetMint: PublicKeyish;
  programId?: PublicKey;
}): PublicKey {
  return derivePda(
    [
      TEXT_ENCODER.encode(SEED_ALLOCATION_LEDGER),
      toPublicKey(params.allocationPosition).toBytes(),
      toPublicKey(params.assetMint).toBytes(),
    ],
    params.programId ?? getProgramId(),
  );
}

export function deriveOracleProfilePda(params: {
  oracle: PublicKeyish;
  programId?: PublicKey;
}): PublicKey {
  return derivePda(
    [TEXT_ENCODER.encode(SEED_ORACLE_PROFILE), toPublicKey(params.oracle).toBytes()],
    params.programId ?? getProgramId(),
  );
}
