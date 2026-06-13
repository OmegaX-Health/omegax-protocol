// SPDX-License-Identifier: AGPL-3.0-or-later

import { BN, BorshCoder, type Idl } from "@coral-xyz/anchor";
import { Buffer } from "buffer";
import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import protocolIdl from "../../idl/omegax_protocol.json";

import {
  PROTOCOL_ACCOUNT_DISCRIMINATORS,
  PROTOCOL_INSTRUCTION_ACCOUNTS,
  PROTOCOL_INSTRUCTION_DISCRIMINATORS,
  PROTOCOL_PROGRAM_ID,
  type ProtocolInstructionAccount,
  type ProtocolInstructionName,
} from "./generated/protocol-contract";

import {
  ZERO_PUBKEY,
  ZERO_PUBKEY_KEY,
  MEMBERSHIP_GATE_KIND_OPEN,
  MEMBERSHIP_GATE_KIND_INVITE_ONLY,
  MEMBERSHIP_GATE_KIND_NFT_ANCHOR,
  MEMBERSHIP_GATE_KIND_STAKE_ANCHOR,
  MEMBERSHIP_GATE_KIND_FUNGIBLE_SNAPSHOT,
  SERIES_MODE_REWARD,
  SERIES_MODE_PROTECTION,
  SERIES_MODE_REIMBURSEMENT,
  SERIES_MODE_PARAMETRIC,
  SERIES_STATUS_DRAFT,
  SERIES_STATUS_ACTIVE,
  SERIES_STATUS_PAUSED,
  SERIES_STATUS_CLOSED,
  FUNDING_LINE_TYPE_SPONSOR_BUDGET,
  FUNDING_LINE_TYPE_PREMIUM_INCOME,
  FUNDING_LINE_TYPE_LIQUIDITY_POOL_ALLOCATION,
  FUNDING_LINE_TYPE_BACKSTOP,
  FUNDING_LINE_TYPE_SUBSIDY,
  FUNDING_LINE_STATUS_OPEN,
  ELIGIBILITY_PENDING,
  ELIGIBILITY_ELIGIBLE,
  ELIGIBILITY_PAUSED,
  ELIGIBILITY_CLOSED,
  CLAIM_INTAKE_OPEN,
  CLAIM_INTAKE_UNDER_REVIEW,
  CLAIM_INTAKE_APPROVED,
  CLAIM_INTAKE_DENIED,
  CLAIM_INTAKE_SETTLED,
  CLAIM_INTAKE_CLOSED,
  OBLIGATION_STATUS_PROPOSED,
  OBLIGATION_STATUS_RESERVED,
  OBLIGATION_STATUS_CLAIMABLE_PAYABLE,
  OBLIGATION_STATUS_SETTLED,
  OBLIGATION_STATUS_CANCELED,
  OBLIGATION_STATUS_IMPAIRED,
  OBLIGATION_STATUS_RECOVERED,
  CAPITAL_CLASS_RESTRICTION_OPEN,
  CAPITAL_CLASS_RESTRICTION_RESTRICTED,
  CAPITAL_CLASS_RESTRICTION_WRAPPER_ONLY,
  LP_QUEUE_STATUS_PENDING,
} from "./protocol/constants";
import type {
  PublicKeyish,
  BigNumberish,
  ReserveBalanceSheet,
  PartialReserveBalanceSheet,
  ReserveScopedSnapshot,
  ReserveDomainSnapshot,
  DomainAssetVaultSnapshot,
  ReserveAssetRailSnapshot,
  HealthPlanSnapshot,
  PolicySeriesSnapshot,
  MemberPositionSnapshot,
  FundingLineSnapshot,
  CapitalContributionSnapshot,
  ClaimCaseSnapshot,
  ObligationSnapshot,
  LiquidityPoolSnapshot,
  CapitalClassSnapshot,
  PoolClassLedgerSnapshot,
  LPPositionSnapshot,
  AllocationPositionSnapshot,
  AllocationLedgerSnapshot,
  OracleProfileSnapshot,
  ClaimAttestationSnapshot,
  ProtocolConsoleSnapshot,
  SponsorReadModel,
  CapitalReadModel,
  MixedReserveWaterfallRail,
  MixedReserveWaterfallModel,
  ClaimFundingReadinessState,
  ClaimFundingReadinessOtherReserveAsset,
  ClaimFundingReadiness,
  ClaimFundingReadinessInput,
  MemberReadModel,
  OracleProfileSummary,
  ReserveDomainSummary,
  DomainAssetVaultSummary,
  OracleSummary,
  OracleWithProfileSummary,
  SchemaSummary,
  ProtocolConfigSummary,
  PoolSummary,
  RuleSummary,
  ClaimDelegateAuthorizationSummary,
  CoverageClaimSummary,
  MembershipSummary,
  OutcomeAggregateSummary,
  PoolControlAuthoritySummary,
  PoolRedemptionRequestSummary,
  WalletPoolPositionSummary,
} from "./protocol/types";
import {
  asAddress,
  asAddressOrDefault,
  asOptionalAddress,
  bigintFromAnchorValue,
  decodedField,
  numberFromAnchorValue,
  resolveProtocolAccountName,
  stringFromAnchorValue,
} from "./protocol/anchor-decode";
import {
  classicTokenProgramId,
  getProgramId,
  normalizeAddress,
  toPublicKey,
} from "./protocol/address";
import {
  bytesToHex,
  hexToFixedBytes,
  normalizeHex32,
  normalizeOptionalHex32,
  ZERO_HASH_HEX,
} from "./protocol/encoding";
import {
  deriveAllocationLedgerPda,
  deriveAllocationPositionPda,
  deriveCapitalClassPda,
  deriveCapitalContributionPda,
  deriveClaimCasePda,
  deriveDomainAssetLedgerPda,
  deriveDomainAssetVaultPda,
  deriveDomainAssetVaultTokenAccountPda,
  deriveFundingLineLedgerPda,
  deriveFundingLinePda,
  deriveHealthPlanPda,
  deriveLiquidityPoolPda,
  deriveLpPositionPda,
  deriveMemberPositionPda,
  deriveObligationPda,
  deriveOracleProfilePda,
  derivePlanReserveLedgerPda,
  derivePolicySeriesPda,
  derivePoolClassLedgerPda,
  deriveReserveDomainPda,
} from "./protocol/pdas";

export * from "./protocol/constants";
export type * from "./protocol/types";
export {
  accountExists,
  classicTokenProgramId,
  getProgramId,
  normalizeAddress,
  toPublicKey,
} from "./protocol/address";
export {
  assertSeedId,
  hashStringTo32Hex,
  isSeedIdSafe,
  utf8ByteLength,
} from "./protocol/encoding";
export * from "./protocol/pdas";

export function listProtocolInstructionNames(): ProtocolInstructionName[] {
  return Object.keys(PROTOCOL_INSTRUCTION_DISCRIMINATORS) as ProtocolInstructionName[];
}

export function listProtocolInstructionAccounts(
  instructionName: ProtocolInstructionName,
): ProtocolInstructionAccount[] {
  return PROTOCOL_INSTRUCTION_ACCOUNTS[instructionName] ?? [];
}

export function listProtocolAccountNames(): string[] {
  return Object.keys(PROTOCOL_ACCOUNT_DISCRIMINATORS).sort();
}

export function toBigIntAmount(value: BigNumberish | null | undefined): bigint {
  if (value === null || value === undefined) return 0n;
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(Math.trunc(value));
  return BigInt(value);
}

export function recomputeReserveBalanceSheet(
  input: PartialReserveBalanceSheet = {},
): ReserveBalanceSheet {
  const funded = toBigIntAmount(input.funded);
  const allocated = toBigIntAmount(input.allocated);
  const reserved = toBigIntAmount(input.reserved);
  const owed = toBigIntAmount(input.owed);
  const claimable = toBigIntAmount(input.claimable);
  const payable = toBigIntAmount(input.payable);
  const settled = toBigIntAmount(input.settled);
  const impaired = toBigIntAmount(input.impaired);
  const pendingRedemption = toBigIntAmount(input.pendingRedemption ?? input.pending_redemption);
  const restricted = toBigIntAmount(input.restricted);
  const encumbered = reserved + claimable + payable + impaired + pendingRedemption + restricted;
  const free = funded > encumbered ? funded - encumbered : 0n;
  const redeemableEncumbered = encumbered + allocated;
  const redeemable = funded > redeemableEncumbered ? funded - redeemableEncumbered : 0n;

  return {
    funded,
    allocated,
    reserved,
    owed,
    claimable,
    payable,
    settled,
    impaired,
    pendingRedemption,
    restricted,
    free,
    redeemable,
  };
}

export function sumReserveBalanceSheets(
  sheets: Array<PartialReserveBalanceSheet | undefined | null>,
): ReserveBalanceSheet {
  const total = {
    funded: 0n,
    allocated: 0n,
    reserved: 0n,
    owed: 0n,
    claimable: 0n,
    payable: 0n,
    settled: 0n,
    impaired: 0n,
    pendingRedemption: 0n,
    restricted: 0n,
  };

  for (const sheet of sheets) {
    if (!sheet) continue;
    const normalized = recomputeReserveBalanceSheet(sheet);
    total.funded += normalized.funded;
    total.allocated += normalized.allocated;
    total.reserved += normalized.reserved;
    total.owed += normalized.owed;
    total.claimable += normalized.claimable;
    total.payable += normalized.payable;
    total.settled += normalized.settled;
    total.impaired += normalized.impaired;
    total.pendingRedemption += normalized.pendingRedemption;
    total.restricted += normalized.restricted;
  }

  return recomputeReserveBalanceSheet(total);
}

// Funding-line availability should come from the reserve sheet when present,
// so read models and UI surfaces don't drift onto incompatible "remaining" math.
export function availableFundingLineBalance(
  line: Pick<FundingLineSnapshot, "sheet" | "fundedAmount" | "spentAmount">,
): bigint {
  if (line.sheet) return recomputeReserveBalanceSheet(line.sheet).free;
  return toBigIntAmount(line.fundedAmount) - toBigIntAmount(line.spentAmount);
}

export function buildMixedReserveWaterfallModel(params: {
  reserveDomainAddress: PublicKeyish;
  snapshot: Pick<ProtocolConsoleSnapshot, "reserveAssetRails" | "domainAssetLedgers">;
  assetDecimalsByMint?: Record<string, number>;
  nowTs?: number;
}): MixedReserveWaterfallModel {
  const reserveDomain = normalizeAddress(params.reserveDomainAddress);
  const nowTs = params.nowTs ?? Math.floor(Date.now() / 1000);
  const ledgersByMint = new Map(
    params.snapshot.domainAssetLedgers
      .filter((ledger) => ledger.reserveDomain === reserveDomain)
      .map((ledger) => [ledger.assetMint, recomputeReserveBalanceSheet(ledger.sheet)]),
  );
  const rails = params.snapshot.reserveAssetRails
    .filter((rail) => rail.reserveDomain === reserveDomain)
    .filter((rail) => rail.active && rail.payoutEnabled)
    .sort((left, right) => left.payoutPriority - right.payoutPriority || left.assetSymbol.localeCompare(right.assetSymbol));

  const rawRails = rails.map((rail): MixedReserveWaterfallRail => {
    const sheet = ledgersByMint.get(rail.assetMint) ?? recomputeReserveBalanceSheet();
    const price = toBigIntAmount(rail.lastPriceUsd1e8);
    const publishedAt = Number(rail.lastPricePublishedAtTs ?? 0);
    const maxStaleness = Number(rail.maxStalenessSeconds ?? 0);
    const confidenceBps = Number(rail.lastPriceConfidenceBps ?? 0);
    const maxConfidenceBps = Number(rail.maxConfidenceBps ?? 0);
    const priceFresh =
      rail.capacityEnabled
      && price > 0n
      && maxStaleness > 0
      && maxConfidenceBps > 0
      && confidenceBps <= maxConfidenceBps
      && publishedAt > 0
      && publishedAt <= nowTs
      && nowTs - publishedAt <= maxStaleness;
    const decimals = Math.max(0, Math.min(18, params.assetDecimalsByMint?.[rail.assetMint] ?? 6));
    const decimalFactor = 10n ** BigInt(decimals);
    const haircutNumerator = BigInt(Math.max(0, 10_000 - rail.haircutBps));
    const uncappedCapacity = priceFresh
      ? (sheet.free * price * haircutNumerator) / (10_000n * decimalFactor)
      : 0n;
    return {
      reserveAssetRail: rail.address,
      reserveDomain: rail.reserveDomain,
      assetMint: rail.assetMint,
      assetSymbol: rail.assetSymbol,
      role: rail.role,
      payoutPriority: rail.payoutPriority,
      payoutEnabled: rail.payoutEnabled,
      capacityEnabled: rail.capacityEnabled,
      active: rail.active,
      oracleSource: rail.oracleSource,
      oracleFeedIdHex: rail.oracleFeedIdHex,
      priceFresh,
      priceUsd1e8: price,
      freeAmountRaw: sheet.free,
      haircutBps: rail.haircutBps,
      maxExposureBps: rail.maxExposureBps,
      effectiveCapacityUsd1e8: uncappedCapacity,
    };
  });
  const uncappedTotal = rawRails.reduce((sum, rail) => sum + rail.effectiveCapacityUsd1e8, 0n);
  const payoutOrder = rawRails.map((rail) => {
    if (rail.maxExposureBps <= 0 || rail.maxExposureBps >= 10_000 || uncappedTotal === 0n) return rail;
    const capped = (uncappedTotal * BigInt(rail.maxExposureBps)) / 10_000n;
    return {
      ...rail,
      effectiveCapacityUsd1e8: rail.effectiveCapacityUsd1e8 > capped ? capped : rail.effectiveCapacityUsd1e8,
    };
  });
  return {
    reserveDomain,
    payoutOrder,
    totalEffectiveCapacityUsd1e8: payoutOrder.reduce((sum, rail) => sum + rail.effectiveCapacityUsd1e8, 0n),
  };
}

function normalizeOptionalAddress(value: PublicKeyish | null | undefined): string | null {
  return value ? normalizeAddress(value) : null;
}

function matchesOptionalScope(actual: string | null | undefined, expected: string | null): boolean {
  return !expected || actual === expected;
}

function clampDecimals(value: number | undefined): number {
  return Math.max(0, Math.min(18, value ?? 6));
}

function freshRailPrice(rail: ReserveAssetRailSnapshot | null | undefined, nowTs: number): boolean {
  if (!rail || !rail.active || (!rail.capacityEnabled && !rail.payoutEnabled)) return false;
  const price = toBigIntAmount(rail.lastPriceUsd1e8);
  if (price <= 0n) return false;
  const publishedAt = Number(rail.lastPricePublishedAtTs ?? 0);
  const maxStaleness = Number(rail.maxStalenessSeconds ?? 0);
  const confidenceBps = Number(rail.lastPriceConfidenceBps ?? 0);
  const maxConfidenceBps = Number(rail.maxConfidenceBps ?? 0);
  return (
    maxStaleness > 0 &&
    maxConfidenceBps > 0 &&
    confidenceBps <= maxConfidenceBps &&
    publishedAt > 0 &&
    publishedAt <= nowTs &&
    nowTs - publishedAt <= maxStaleness
  );
}

function amountToUsd1e8(params: {
  amountRaw: bigint;
  rail: ReserveAssetRailSnapshot | null | undefined;
  decimals: number;
  nowTs: number;
}): bigint | null {
  if (!freshRailPrice(params.rail, params.nowTs)) return null;
  const price = toBigIntAmount(params.rail?.lastPriceUsd1e8);
  const decimalFactor = 10n ** BigInt(clampDecimals(params.decimals));
  return (params.amountRaw * price) / decimalFactor;
}

function fundingLineFreeForReadiness(line: FundingLineSnapshot): bigint {
  if (line.sheet) return recomputeReserveBalanceSheet(line.sheet).free;
  const funded = toBigIntAmount(line.fundedAmount);
  const spent = toBigIntAmount(line.spentAmount);
  const reserved = toBigIntAmount(line.reservedAmount);
  const encumbered = spent + reserved;
  return funded > encumbered ? funded - encumbered : 0n;
}

function maxBigIntAmount(values: Array<BigNumberish | null | undefined>): bigint {
  let max = 0n;
  for (const value of values) {
    const amount = toBigIntAmount(value);
    if (amount > max) max = amount;
  }
  return max;
}

function obligationExposureAmount(obligation: ObligationSnapshot): bigint {
  if (
    obligation.status === OBLIGATION_STATUS_SETTLED
    || obligation.status === OBLIGATION_STATUS_CANCELED
    || obligation.status === OBLIGATION_STATUS_RECOVERED
  ) {
    return 0n;
  }
  return maxBigIntAmount([
    obligation.outstandingAmount,
    obligation.reservedAmount,
    obligation.claimableAmount,
    obligation.payableAmount,
    obligation.principalAmount,
  ]);
}

function reserveOrPayableExposureAmount(obligation: ObligationSnapshot): bigint {
  if (
    obligation.status !== OBLIGATION_STATUS_RESERVED
    && obligation.status !== OBLIGATION_STATUS_CLAIMABLE_PAYABLE
  ) {
    return 0n;
  }
  return maxBigIntAmount([
    obligation.reservedAmount,
    obligation.claimableAmount,
    obligation.payableAmount,
    obligation.outstandingAmount,
    obligation.principalAmount,
  ]);
}

export function buildClaimFundingReadiness(params: ClaimFundingReadinessInput): ClaimFundingReadiness {
  const settlementMint = normalizeAddress(params.settlementMint);
  const requestedAmount = toBigIntAmount(params.requestedAmount);
  const nowTs = params.nowTs ?? Math.floor(Date.now() / 1000);
  const fundingLineAddress = normalizeOptionalAddress(params.fundingLineAddress);
  const healthPlanAddress = normalizeOptionalAddress(params.healthPlanAddress);
  const policySeriesAddress = normalizeOptionalAddress(params.policySeriesAddress);
  const selectedFundingLine = fundingLineAddress
    ? params.snapshot.fundingLines.find((line) => line.address === fundingLineAddress) ?? null
    : null;
  const reserveDomain = normalizeOptionalAddress(params.reserveDomainAddress)
    ?? selectedFundingLine?.reserveDomain
    ?? params.snapshot.domainAssetVaults.find((vault) => vault.assetMint === settlementMint)?.reserveDomain
    ?? params.snapshot.reserveAssetRails.find((rail) => rail.assetMint === settlementMint)?.reserveDomain
    ?? null;
  const warnings: string[] = [];

  const inReserve = (value: { reserveDomain: string }) => !reserveDomain || value.reserveDomain === reserveDomain;
  const lineMatchesScope = (line: FundingLineSnapshot) =>
    inReserve(line)
    && line.assetMint === settlementMint
    && matchesOptionalScope(line.healthPlan, healthPlanAddress)
    && matchesOptionalScope(line.policySeries ?? null, policySeriesAddress)
    && matchesOptionalScope(line.address, fundingLineAddress);
  const obligationMatchesScope = (obligation: ObligationSnapshot) =>
    inReserve(obligation)
    && obligation.assetMint === settlementMint
    && matchesOptionalScope(obligation.healthPlan, healthPlanAddress)
    && matchesOptionalScope(obligation.policySeries ?? null, policySeriesAddress)
    && matchesOptionalScope(obligation.fundingLine, fundingLineAddress);

  if (!reserveDomain) {
    warnings.push("No reserve domain could be inferred; readiness is limited to settlement mint totals across the snapshot.");
  }

  const settlementLedgers = params.snapshot.domainAssetLedgers
    .filter((ledger) => ledger.assetMint === settlementMint && inReserve(ledger))
    .map((ledger) => recomputeReserveBalanceSheet(ledger.sheet));
  const settlementVaultTotal = params.snapshot.domainAssetVaults
    .filter((vault) => vault.assetMint === settlementMint && inReserve(vault))
    .reduce((sum, vault) => sum + toBigIntAmount(vault.totalAssets), 0n);
  const matchingObligations = params.snapshot.obligations.filter(obligationMatchesScope);
  const reservedOrPayableAmount = matchingObligations.reduce(
    (sum, obligation) => sum + reserveOrPayableExposureAmount(obligation),
    0n,
  );
  const pendingObligationsAmount = matchingObligations.reduce(
    (sum, obligation) => sum + obligationExposureAmount(obligation),
    0n,
  );

  const poolByAddress = new Map(params.snapshot.liquidityPools.map((pool) => [pool.address, pool]));
  const classByAddress = new Map(params.snapshot.capitalClasses.map((capitalClass) => [capitalClass.address, capitalClass]));
  const queuedRedemptionsAmount = params.snapshot.lpPositions.reduce((sum, position) => {
    const capitalClass = classByAddress.get(position.capitalClass);
    const pool = capitalClass ? poolByAddress.get(capitalClass.liquidityPool) : null;
    if (!capitalClass || !pool) return sum;
    if (pool.depositAssetMint !== settlementMint || (reserveDomain && pool.reserveDomain !== reserveDomain)) return sum;
    return sum + toBigIntAmount(position.pendingRedemptionAssets);
  }, 0n);

  const settlementLedgerFree = settlementLedgers.reduce((sum, sheet) => sum + sheet.free, 0n);
  const settlementFreeFromVaultFallback = settlementVaultTotal > pendingObligationsAmount + queuedRedemptionsAmount
    ? settlementVaultTotal - pendingObligationsAmount - queuedRedemptionsAmount
    : 0n;
  const directSettlementAssetCapacityAmount = settlementLedgers.length > 0
    ? settlementLedgerFree
    : settlementFreeFromVaultFallback;

  const scopedFundingLines = params.snapshot.fundingLines.filter(lineMatchesScope);
  const activeFundingLines = scopedFundingLines.filter((line) => line.status === FUNDING_LINE_STATUS_OPEN);
  const fundingLineAvailableAmount = activeFundingLines.reduce(
    (sum, line) => sum + fundingLineFreeForReadiness(line),
    0n,
  );
  if (scopedFundingLines.length > 0 && activeFundingLines.length === 0) {
    warnings.push("Matching settlement funding line exists, but it is not open for new settlement activity.");
  }
  if (fundingLineAddress && !selectedFundingLine) {
    warnings.push("Requested funding line was not found in the snapshot.");
  }

  const immediatelySettleableAmount = scopedFundingLines.length > 0
    ? (directSettlementAssetCapacityAmount < fundingLineAvailableAmount
        ? directSettlementAssetCapacityAmount
        : fundingLineAvailableAmount)
    : directSettlementAssetCapacityAmount;

  const availableLpAllocationCapacityAmount = params.snapshot.allocationPositions
    .filter((allocation) =>
      allocation.active
      && inReserve(allocation)
      && matchesOptionalScope(allocation.healthPlan, healthPlanAddress)
      && matchesOptionalScope(allocation.policySeries ?? null, policySeriesAddress)
      && matchesOptionalScope(allocation.fundingLine, fundingLineAddress)
      && params.snapshot.fundingLines.some((line) => line.address === allocation.fundingLine && line.assetMint === settlementMint),
    )
    .reduce((sum, allocation) => {
      const allocatedAmount = toBigIntAmount(allocation.allocatedAmount);
      const reservedCapacity = toBigIntAmount(allocation.reservedCapacity);
      return sum + (allocatedAmount > reservedCapacity ? allocatedAmount - reservedCapacity : 0n);
    }, 0n);

  const railsByMint = new Map(
    params.snapshot.reserveAssetRails
      .filter((rail) => inReserve(rail))
      .map((rail) => [rail.assetMint, rail]),
  );
  const ledgerByMint = new Map(
    params.snapshot.domainAssetLedgers
      .filter((ledger) => inReserve(ledger))
      .map((ledger) => [ledger.assetMint, recomputeReserveBalanceSheet(ledger.sheet)]),
  );
  const vaultTotalsByMint = new Map<string, bigint>();
  for (const vault of params.snapshot.domainAssetVaults.filter((entry) => inReserve(entry))) {
    vaultTotalsByMint.set(vault.assetMint, (vaultTotalsByMint.get(vault.assetMint) ?? 0n) + toBigIntAmount(vault.totalAssets));
  }
  const reserveMints = new Set<string>([
    ...railsByMint.keys(),
    ...ledgerByMint.keys(),
    ...vaultTotalsByMint.keys(),
  ]);
  const otherReserveAssets = [...reserveMints]
    .filter((assetMint) => assetMint !== settlementMint)
    .sort()
    .map((assetMint): ClaimFundingReadinessOtherReserveAsset => {
      const rail = railsByMint.get(assetMint) ?? null;
      const ledger = ledgerByMint.get(assetMint);
      const freeAmountRaw = ledger?.free ?? vaultTotalsByMint.get(assetMint) ?? 0n;
      const decimals = clampDecimals(params.assetDecimalsByMint?.[assetMint]);
      const estimatedValueUsd1e8 = amountToUsd1e8({
        amountRaw: freeAmountRaw,
        rail,
        decimals,
        nowTs,
      });
      const haircutBps = Math.max(0, rail?.haircutBps ?? 0);
      const haircutAdjustedValueUsd1e8 = estimatedValueUsd1e8 === null
        ? null
        : (estimatedValueUsd1e8 * BigInt(Math.max(0, 10_000 - haircutBps))) / 10_000n;
      const assetWarnings: string[] = [
        "Non-preferred reserve asset; convert or rebalance it into the settlement mint before same-asset claim settlement.",
      ];
      if (!rail) {
        assetWarnings.push("No reserve asset rail exists for this asset.");
      } else if (!rail.payoutEnabled) {
        assetWarnings.push("Payout rail is disabled for this asset.");
      } else if (!freshRailPrice(rail, nowTs)) {
        assetWarnings.push("No fresh published price is available, so haircut-adjusted value is not counted.");
      }
      return {
        reserveAssetRail: rail?.address ?? null,
        reserveDomain: reserveDomain ?? rail?.reserveDomain ?? "",
        assetMint,
        assetSymbol: rail?.assetSymbol ?? assetMint.slice(0, 4),
        payoutEnabled: Boolean(rail?.payoutEnabled),
        payoutPriority: rail?.payoutPriority ?? 255,
        freeAmountRaw,
        priceFresh: freshRailPrice(rail, nowTs),
        priceUsd1e8: rail ? toBigIntAmount(rail.lastPriceUsd1e8) : null,
        haircutBps,
        estimatedValueUsd1e8,
        haircutAdjustedValueUsd1e8,
        immediatelySettleable: false,
        warnings: assetWarnings,
      };
    });

  const shortfallAmount = requestedAmount > immediatelySettleableAmount
    ? requestedAmount - immediatelySettleableAmount
    : 0n;
  const settlementRail = railsByMint.get(settlementMint) ?? null;
  const shortfallUsd1e8 = amountToUsd1e8({
    amountRaw: shortfallAmount,
    rail: settlementRail,
    decimals: clampDecimals(params.assetDecimalsByMint?.[settlementMint]),
    nowTs,
  });
  const otherReserveHaircutValueUsd1e8 = otherReserveAssets.reduce(
    (sum, asset) => sum + (asset.haircutAdjustedValueUsd1e8 ?? 0n),
    0n,
  );
  if (shortfallAmount > 0n) {
    warnings.push("Settlement-mint capacity is below the requested amount.");
  }
  if (otherReserveAssets.some((asset) => asset.freeAmountRaw > 0n)) {
    warnings.push("Other reserve assets do not increase settlement-mint capacity; same-asset claim settlement requires conversion or rebalancing first.");
  }
  if (shortfallAmount > 0n && shortfallUsd1e8 === null && otherReserveHaircutValueUsd1e8 > 0n) {
    warnings.push("Settlement-mint shortfall cannot be compared to other assets without a fresh settlement asset price.");
  }

  let readiness: ClaimFundingReadinessState;
  if (requestedAmount <= immediatelySettleableAmount) {
    readiness = "settle_now";
  } else if (requestedAmount <= immediatelySettleableAmount + availableLpAllocationCapacityAmount) {
    readiness = "reserve_then_settle";
  } else if (otherReserveHaircutValueUsd1e8 > 0n && (shortfallUsd1e8 === null || otherReserveHaircutValueUsd1e8 >= shortfallUsd1e8)) {
    readiness = "operator_action_required";
  } else {
    readiness = "queue_or_refund";
  }

  return {
    reserveDomain,
    settlementMint,
    requestedAmount,
    directSettlementAssetCapacityAmount,
    fundingLineAvailableAmount,
    immediatelySettleableAmount,
    reservedOrPayableAmount,
    pendingObligationsAmount,
    queuedRedemptionsAmount,
    availableLpAllocationCapacityAmount,
    otherReserveAssets,
    readiness,
    warnings,
  };
}

export function describeSeriesMode(mode: number): string {
  switch (mode) {
    case SERIES_MODE_REWARD:
      return "reward";
    case SERIES_MODE_PROTECTION:
      return "protection";
    case SERIES_MODE_REIMBURSEMENT:
      return "reimbursement";
    case SERIES_MODE_PARAMETRIC:
      return "parametric";
    default:
      return "other";
  }
}

export function describeSeriesStatus(status: number): string {
  switch (status) {
    case SERIES_STATUS_DRAFT:
      return "draft";
    case SERIES_STATUS_ACTIVE:
      return "active";
    case SERIES_STATUS_PAUSED:
      return "paused";
    case SERIES_STATUS_CLOSED:
      return "closed";
    default:
      return `unknown(${status})`;
  }
}

export function describeFundingLineType(lineType: number): string {
  switch (lineType) {
    case FUNDING_LINE_TYPE_SPONSOR_BUDGET:
      return "sponsor_budget";
    case FUNDING_LINE_TYPE_PREMIUM_INCOME:
      return "premium_income";
    case FUNDING_LINE_TYPE_LIQUIDITY_POOL_ALLOCATION:
      return "liquidity_pool_allocation";
    case FUNDING_LINE_TYPE_BACKSTOP:
      return "backstop";
    case FUNDING_LINE_TYPE_SUBSIDY:
      return "subsidy";
    default:
      return `unknown(${lineType})`;
  }
}

export function describeEligibilityStatus(status: number): string {
  switch (status) {
    case ELIGIBILITY_PENDING:
      return "pending";
    case ELIGIBILITY_ELIGIBLE:
      return "eligible";
    case ELIGIBILITY_PAUSED:
      return "paused";
    case ELIGIBILITY_CLOSED:
      return "closed";
    default:
      return `unknown(${status})`;
  }
}

export function describeClaimStatus(status: number): string {
  switch (status) {
    case CLAIM_INTAKE_OPEN:
      return "open";
    case CLAIM_INTAKE_UNDER_REVIEW:
      return "under_review";
    case CLAIM_INTAKE_APPROVED:
      return "approved";
    case CLAIM_INTAKE_DENIED:
      return "denied";
    case CLAIM_INTAKE_SETTLED:
      return "settled";
    case CLAIM_INTAKE_CLOSED:
      return "closed";
    default:
      return `unknown(${status})`;
  }
}

export function isActiveClaimStatus(status: number): boolean {
  return status === CLAIM_INTAKE_OPEN || status === CLAIM_INTAKE_UNDER_REVIEW || status === CLAIM_INTAKE_APPROVED;
}

export function describeObligationStatus(status: number): string {
  switch (status) {
    case OBLIGATION_STATUS_PROPOSED:
      return "proposed";
    case OBLIGATION_STATUS_RESERVED:
      return "reserved";
    case OBLIGATION_STATUS_CLAIMABLE_PAYABLE:
      return "claimable_or_payable";
    case OBLIGATION_STATUS_SETTLED:
      return "settled";
    case OBLIGATION_STATUS_CANCELED:
      return "canceled";
    case OBLIGATION_STATUS_IMPAIRED:
      return "impaired";
    case OBLIGATION_STATUS_RECOVERED:
      return "recovered";
    default:
      return `unknown(${status})`;
  }
}

export function hasObligationImpairment(
  obligation: Pick<ObligationSnapshot, "status" | "impairedAmount">,
): boolean {
  return obligation.status === OBLIGATION_STATUS_IMPAIRED || toBigIntAmount(obligation.impairedAmount) > 0n;
}

export function hasPendingRedemptionQueue(
  position: Pick<LPPositionSnapshot, "queueStatus" | "pendingRedemptionShares">,
): boolean {
  return position.queueStatus === LP_QUEUE_STATUS_PENDING || toBigIntAmount(position.pendingRedemptionShares) > 0n;
}

export function describeLpQueueStatus(
  position: Pick<LPPositionSnapshot, "queueStatus" | "pendingRedemptionShares">,
): string {
  if (position.queueStatus === LP_QUEUE_STATUS_PENDING) return "pending";
  if (toBigIntAmount(position.pendingRedemptionShares) > 0n) return "requested";
  return "clear";
}

export function isObligationOnDisputeWatch(
  obligation: Pick<ObligationSnapshot, "status" | "impairedAmount">,
): boolean {
  return obligation.status === OBLIGATION_STATUS_RESERVED
    || obligation.status === OBLIGATION_STATUS_CLAIMABLE_PAYABLE
    || hasObligationImpairment(obligation);
}

export function describeCapitalRestriction(restrictionMode: number): string {
  switch (restrictionMode) {
    case CAPITAL_CLASS_RESTRICTION_OPEN:
      return "open";
    case CAPITAL_CLASS_RESTRICTION_RESTRICTED:
      return "restricted";
    case CAPITAL_CLASS_RESTRICTION_WRAPPER_ONLY:
      return "wrapper_only";
    default:
      return `unknown(${restrictionMode})`;
  }
}

export function bpsRatio(numerator: bigint, denominator: bigint): bigint | null {
  if (denominator <= 0n) return null;
  return (numerator * 10_000n) / denominator;
}

export function buildSponsorReadModel(params: {
  healthPlan: HealthPlanSnapshot;
  policySeries: PolicySeriesSnapshot[];
  fundingLines: FundingLineSnapshot[];
  obligations: ObligationSnapshot[];
  claimCases: ClaimCaseSnapshot[];
  planLedger?: PartialReserveBalanceSheet;
  outcomesBySeries?: Record<string, BigNumberish>;
}): SponsorReadModel {
  const sponsorLines = params.fundingLines.filter(
    (line) => line.healthPlan === params.healthPlan.address && line.lineType === FUNDING_LINE_TYPE_SPONSOR_BUDGET,
  );
  const planSeries = params.policySeries.filter((series) => series.healthPlan === params.healthPlan.address);
  const planObligations = params.obligations.filter((obligation) => obligation.healthPlan === params.healthPlan.address);
  const planClaims = params.claimCases.filter((claimCase) => claimCase.healthPlan === params.healthPlan.address);
  const planLedger = recomputeReserveBalanceSheet(params.planLedger);

  const fundedSponsorBudget = sponsorLines.reduce(
    (sum, line) => sum + toBigIntAmount(line.fundedAmount),
    0n,
  );
  const remainingSponsorBudget = sponsorLines.reduce(
    (sum, line) => sum + availableFundingLineBalance(line),
    0n,
  );
  const committedSponsorBudget = fundedSponsorBudget - remainingSponsorBudget;

  const accruedRewards = planObligations
    .filter((obligation) => {
      const series = planSeries.find((candidate) => candidate.address === obligation.policySeries);
      return series?.mode === SERIES_MODE_REWARD;
    })
    .reduce((sum, obligation) => {
      const outstanding = toBigIntAmount(obligation.outstandingAmount ?? obligation.principalAmount);
      return sum + outstanding;
    }, 0n);

  const paidRewards = planObligations
    .filter((obligation) => {
      const series = planSeries.find((candidate) => candidate.address === obligation.policySeries);
      return series?.mode === SERIES_MODE_REWARD;
    })
    .reduce((sum, obligation) => sum + toBigIntAmount(obligation.settledAmount), 0n);

  const claimCounts = planClaims.reduce<Record<string, number>>((accumulator, claimCase) => {
    const label = describeClaimStatus(claimCase.intakeStatus);
    accumulator[label] = (accumulator[label] ?? 0) + 1;
    return accumulator;
  }, {});
  const activeClaimCount = planClaims.filter((claimCase) => isActiveClaimStatus(claimCase.intakeStatus)).length;

  const perSeriesPerformance = planSeries.map((series) => {
    const obligations = planObligations.filter((obligation) => obligation.policySeries === series.address);
    const claims = planClaims.filter((claimCase) => claimCase.policySeries === series.address);
    const settled = obligations.reduce((sum, obligation) => sum + toBigIntAmount(obligation.settledAmount), 0n);
    const reserved = obligations.reduce((sum, obligation) => sum + toBigIntAmount(obligation.reservedAmount), 0n);
    const approvedClaims = claims.reduce((sum, claimCase) => sum + toBigIntAmount(claimCase.approvedAmount), 0n);
    const paidClaims = claims.reduce((sum, claimCase) => sum + toBigIntAmount(claimCase.paidAmount), 0n);
    const outcomes = toBigIntAmount(params.outcomesBySeries?.[series.address]);

    return {
      policySeries: series.address,
      seriesId: series.seriesId,
      mode: describeSeriesMode(series.mode),
      obligations: obligations.length,
      settled,
      reserved,
      claimCount: claims.length,
      approvedClaims,
      paidClaims,
      costPerOutcome: outcomes > 0n ? settled / outcomes : null,
    };
  });

  return {
    healthPlanAddress: params.healthPlan.address,
    planId: params.healthPlan.planId,
    fundedSponsorBudget,
    remainingSponsorBudget,
    accruedRewards,
    paidRewards,
    reserveCoverageBps: bpsRatio(planLedger.funded, planLedger.reserved + planLedger.claimable + planLedger.payable),
    claimCounts,
    activeClaimCount,
    committedSponsorBudget,
    perSeriesPerformance,
  };
}

export function buildCapitalReadModel(params: {
  liquidityPool: LiquidityPoolSnapshot;
  capitalClasses: CapitalClassSnapshot[];
  classLedgers: PoolClassLedgerSnapshot[];
  allocations: AllocationPositionSnapshot[];
}): CapitalReadModel {
  const classes = params.capitalClasses
    .filter((capitalClass) => capitalClass.liquidityPool === params.liquidityPool.address)
    .map((capitalClass) => {
      const ledger = params.classLedgers.find((candidate) => candidate.capitalClass === capitalClass.address);
      const sheet = recomputeReserveBalanceSheet(ledger?.sheet);
      const exposures = params.allocations
        .filter((allocation) => allocation.capitalClass === capitalClass.address)
        .map((allocation) => ({
          healthPlan: allocation.healthPlan,
          policySeries: allocation.policySeries ?? null,
          fundingLine: allocation.fundingLine,
          allocatedAmount: toBigIntAmount(allocation.allocatedAmount),
          reservedCapacity: toBigIntAmount(allocation.reservedCapacity),
          weightBps: allocation.weightBps,
        }));

      return {
        capitalClass: capitalClass.address,
        classId: capitalClass.classId,
        nav: toBigIntAmount(capitalClass.navAssets),
        redeemable: sheet.redeemable,
        allocated: toBigIntAmount(capitalClass.allocatedAssets),
        reservedLiabilities: sheet.reserved + sheet.claimable + sheet.payable,
        pendingRedemptions: toBigIntAmount(capitalClass.pendingRedemptions),
        realizedYield: toBigIntAmount(ledger?.realizedYieldAmount),
        impairments: sheet.impaired,
        restriction: describeCapitalRestriction(capitalClass.restrictionMode),
        exposureMix: exposures,
      };
    });

  return {
    liquidityPoolAddress: params.liquidityPool.address,
    poolId: params.liquidityPool.poolId,
    totalNav: classes.reduce((sum, capitalClass) => sum + capitalClass.nav, 0n),
    totalAllocated: classes.reduce((sum, capitalClass) => sum + capitalClass.allocated, 0n),
    totalUnallocated: classes.reduce((sum, capitalClass) => sum + (capitalClass.nav - capitalClass.allocated), 0n),
    totalPendingRedemptions: classes.reduce(
      (sum, capitalClass) => sum + capitalClass.pendingRedemptions,
      0n,
    ),
    classes,
  };
}

export function buildMemberReadModel(params: {
  wallet: PublicKeyish;
  memberPositions: MemberPositionSnapshot[];
  obligations: ObligationSnapshot[];
  claimCases: ClaimCaseSnapshot[];
}): MemberReadModel {
  const wallet = normalizeAddress(params.wallet);
  const positions = params.memberPositions.filter((position) => position.wallet === wallet);

  return {
    wallet,
    planParticipations: positions.map((position) => {
      const memberObligations = params.obligations.filter(
        (obligation) => obligation.memberWallet === wallet && obligation.policySeries === position.policySeries,
      );
      const claimCases = params.claimCases.filter(
        (claimCase) => claimCase.memberPosition === position.address || claimCase.claimant === wallet,
      );
      const claimStatusCounts = claimCases.reduce<Record<string, number>>((accumulator, claimCase) => {
        const label = describeClaimStatus(claimCase.intakeStatus);
        accumulator[label] = (accumulator[label] ?? 0) + 1;
        return accumulator;
      }, {});

      return {
        healthPlan: position.healthPlan,
        policySeries: position.policySeries,
        eligibility: describeEligibilityStatus(position.eligibilityStatus),
        delegatedRights: [...position.delegatedRights],
        claimableRewards: memberObligations.reduce(
          (sum, obligation) => sum + toBigIntAmount(obligation.claimableAmount),
          0n,
        ),
        payableClaims: memberObligations.reduce(
          (sum, obligation) => sum + toBigIntAmount(obligation.payableAmount),
          0n,
        ),
        payoutHistory: memberObligations.reduce(
          (sum, obligation) => sum + toBigIntAmount(obligation.settledAmount),
          0n,
        ),
        claimStatusCounts,
      };
    }),
  };
}

export function shortenAddress(address: string, size = 4): string {
  if (!address || address.length <= size * 2 + 1) return address;
  return `${address.slice(0, size)}...${address.slice(-size)}`;
}

function explorerClusterSuffix(cluster?: string | null): string {
  const normalized = (
    cluster?.trim()
    || process.env.NEXT_PUBLIC_SOLANA_EXPLORER_CLUSTER?.trim()
    || process.env.NEXT_PUBLIC_REALMS_CLUSTER?.trim()
    || "devnet"
  );
  return normalized === "mainnet-beta" ? "" : `?cluster=${encodeURIComponent(normalized)}`;
}

export function toExplorerLink(signature: string, cluster?: string | null): string {
  return `https://explorer.solana.com/tx/${encodeURIComponent(signature)}${explorerClusterSuffix(cluster)}`;
}

export function toExplorerAddressLink(address: string, cluster?: string | null): string {
  return `https://explorer.solana.com/address/${encodeURIComponent(address)}${explorerClusterSuffix(cluster)}`;
}

const PROTOCOL_IDL = protocolIdl as Idl;
const PROTOCOL_CODER = new BorshCoder(PROTOCOL_IDL);

export const MEMBER_DELEGATED_RIGHT_FLAGS = [
  "claim_reward",
  "view_payout_history",
  "open_claim_case",
  "appoint_delegate",
  "review_decisions",
] as const;

function membershipModelLabel(membershipMode: number, membershipGateKind: number): string {
  if (membershipMode === 1 || membershipGateKind === 2 || membershipGateKind === 3 || membershipGateKind === 4) {
    return "token_gate";
  }
  if (membershipMode === 2 || membershipGateKind === 1) return "invite_only";
  return "open";
}

function membershipGateKindLabel(membershipGateKind: number): string {
  switch (membershipGateKind) {
    case MEMBERSHIP_GATE_KIND_INVITE_ONLY:
      return "invite_only";
    case MEMBERSHIP_GATE_KIND_NFT_ANCHOR:
      return "nft_anchor";
    case MEMBERSHIP_GATE_KIND_STAKE_ANCHOR:
      return "stake_anchor";
    case MEMBERSHIP_GATE_KIND_FUNGIBLE_SNAPSHOT:
      return "fungible_snapshot";
    case MEMBERSHIP_GATE_KIND_OPEN:
    default:
      return "open";
  }
}

function delegatedRightsFromMask(mask: number): string[] {
  const rights: string[] = [];
  for (let index = 0; index < MEMBER_DELEGATED_RIGHT_FLAGS.length; index += 1) {
    if ((mask & (1 << index)) !== 0) rights.push(MEMBER_DELEGATED_RIGHT_FLAGS[index]!);
  }
  return rights;
}

function reserveLedgerSnapshot(params: {
  address: string;
  reserveDomain: string;
  assetMint: string;
  sheet: unknown;
}): ReserveScopedSnapshot {
  return {
    address: params.address,
    reserveDomain: params.reserveDomain,
    assetMint: params.assetMint,
    sheet: params.sheet as PartialReserveBalanceSheet,
  };
}

function sortByLabel<T>(rows: T[], label: (value: T) => string): T[] {
  return [...rows].sort((left, right) => label(left).localeCompare(label(right)));
}

export async function loadProtocolConsoleSnapshot(connection: Connection): Promise<ProtocolConsoleSnapshot> {
  const accounts = await connection.getProgramAccounts(getProgramId(), { commitment: "confirmed" });
  const snapshot: ProtocolConsoleSnapshot = {
    protocolGovernance: null,
    reserveDomains: [],
    domainAssetVaults: [],
    reserveAssetRails: [],
    domainAssetLedgers: [],
    healthPlans: [],
    policySeries: [],
    memberPositions: [],
    fundingLines: [],
    capitalContributions: [],
    claimCases: [],
    obligations: [],
    liquidityPools: [],
    capitalClasses: [],
    lpPositions: [],
    allocationPositions: [],
    planReserveLedgers: [],
    seriesReserveLedgers: [],
    fundingLineLedgers: [],
    poolClassLedgers: [],
    allocationLedgers: [],
    outcomesBySeries: {},
    oracleProfiles: [],
    outcomeSchemas: [],
    schemaDependencyLedgers: [],
    claimAttestations: [],
  };

  const planLedgersRaw: Array<{ address: string; healthPlan: string; assetMint: string; sheet: unknown }> = [];
  const lineLedgersRaw: Array<{ address: string; fundingLine: string; assetMint: string; sheet: unknown }> = [];

  for (const row of accounts) {
    const accountName = resolveProtocolAccountName(row.account.data);
    if (!accountName) continue;
    let decoded: Record<string, unknown>;
    try {
      decoded = PROTOCOL_CODER.accounts.decode(accountName, Buffer.from(row.account.data)) as Record<string, unknown>;
    } catch {
      continue;
    }
    const address = row.pubkey.toBase58();

    switch (accountName) {
      case "ReserveDomain":
        snapshot.reserveDomains.push({
          address,
          domainId: stringFromAnchorValue(decodedField(decoded, "domainId")),
          displayName: stringFromAnchorValue(decodedField(decoded, "displayName")),
          domainAdmin: asAddress(decodedField(decoded, "domainAdmin")),
          settlementMode: Number(decodedField(decoded, "settlementMode") ?? 0),
          active: Boolean(decodedField(decoded, "active")),
          pauseFlags: Number(decodedField(decoded, "pauseFlags") ?? 0),
        });
        break;
      case "DomainAssetVault":
        snapshot.domainAssetVaults.push({
          address,
          reserveDomain: asAddress(decodedField(decoded, "reserveDomain")),
          assetMint: asAddress(decodedField(decoded, "assetMint")),
          vaultTokenAccount: asAddress(decodedField(decoded, "vaultTokenAccount")),
          totalAssets: bigintFromAnchorValue(decodedField(decoded, "totalAssets")),
          bump: Number(decodedField(decoded, "bump") ?? 0),
        });
        break;
      case "DomainAssetLedger":
        snapshot.domainAssetLedgers.push(
          reserveLedgerSnapshot({
            address,
            reserveDomain: asAddress(decodedField(decoded, "reserveDomain")),
            assetMint: asAddress(decodedField(decoded, "assetMint")),
            sheet: decoded.sheet,
          }),
        );
        break;
      case "HealthPlan":
        {
          const membershipModeValue = Number(decodedField(decoded, "membershipMode") ?? 0);
          const membershipGateKindValue = Number(decodedField(decoded, "membershipGateKind") ?? MEMBERSHIP_GATE_KIND_OPEN);
          snapshot.healthPlans.push({
            address,
            reserveDomain: asAddress(decodedField(decoded, "reserveDomain")),
            planId: stringFromAnchorValue(decodedField(decoded, "healthPlanId", "health_plan_id")),
            displayName: stringFromAnchorValue(decodedField(decoded, "displayName")),
            sponsorLabel: stringFromAnchorValue(decodedField(decoded, "organizationRef"))
              || shortenAddress(asAddress(decodedField(decoded, "sponsor")), 6),
            planAdmin: asAddress(decodedField(decoded, "planAdmin")),
            sponsorOperator: asAddress(decodedField(decoded, "sponsorOperator")),
            claimsOperator: asAddress(decodedField(decoded, "claimsOperator")),
            oracleAuthority: asAddress(decodedField(decoded, "oracleAuthority")),
            membershipModel: membershipModelLabel(membershipModeValue, membershipGateKindValue),
            membershipGateKind: membershipGateKindLabel(membershipGateKindValue),
            membershipModeValue,
            membershipGateKindValue,
            membershipGateMint: asOptionalAddress(decodedField(decoded, "membershipGateMint")) ?? ZERO_PUBKEY,
            membershipGateMinAmount: bigintFromAnchorValue(decodedField(decoded, "membershipGateMinAmount")),
            membershipInviteAuthority: asOptionalAddress(decodedField(decoded, "membershipInviteAuthority")) ?? ZERO_PUBKEY,
            pauseFlags: Number(decodedField(decoded, "pauseFlags") ?? 0),
            active: Boolean(decodedField(decoded, "active")),
          });
          break;
        }
      case "PolicySeries":
        {
          const comparabilityHashHex = bytesToHex(decodedField(decoded, "comparabilityHash"));
        snapshot.policySeries.push({
          address,
          healthPlan: asAddress(decodedField(decoded, "healthPlan")),
          seriesId: stringFromAnchorValue(decodedField(decoded, "seriesId")),
          displayName: stringFromAnchorValue(decodedField(decoded, "displayName")),
          metadataUri: stringFromAnchorValue(decodedField(decoded, "metadataUri")),
          mode: Number(decodedField(decoded, "mode") ?? 0),
          status: Number(decodedField(decoded, "status") ?? 0),
          assetMint: asAddress(decodedField(decoded, "assetMint")),
          cycleSeconds: numberFromAnchorValue(decodedField(decoded, "cycleSeconds")),
          termsVersion: stringFromAnchorValue(decodedField(decoded, "termsVersion")),
          comparabilityKey: comparabilityHashHex.slice(0, 12) || "unbound",
          comparabilityHashHex,
        });
        break;
        }
      case "MemberPosition":
        snapshot.memberPositions.push({
          address,
          wallet: asAddress(decodedField(decoded, "wallet")),
          healthPlan: asAddress(decodedField(decoded, "healthPlan")),
          policySeries: asAddress(decodedField(decoded, "policySeries")),
          eligibilityStatus: Number(decodedField(decoded, "eligibilityStatus") ?? 0),
          delegatedRights: delegatedRightsFromMask(Number(decodedField(decoded, "delegatedRights") ?? 0)),
          active: Boolean(decodedField(decoded, "active")),
        });
        break;
      case "FundingLine":
        snapshot.fundingLines.push({
          address,
          reserveDomain: asAddress(decodedField(decoded, "reserveDomain")),
          healthPlan: asAddress(decodedField(decoded, "healthPlan")),
          policySeries: asOptionalAddress(decodedField(decoded, "policySeries")),
          assetMint: asAddress(decodedField(decoded, "assetMint")),
          lineId: stringFromAnchorValue(decodedField(decoded, "lineId")),
          displayName: `${describeFundingLineType(Number(decodedField(decoded, "lineType") ?? 0)).replace(/_/g, " ")} · ${stringFromAnchorValue(decodedField(decoded, "lineId"))}`,
          lineType: Number(decodedField(decoded, "lineType") ?? 0),
          fundingPriority: Number(decodedField(decoded, "fundingPriority") ?? 0),
          fundedAmount: bigintFromAnchorValue(decodedField(decoded, "fundedAmount")),
          reservedAmount: bigintFromAnchorValue(decodedField(decoded, "reservedAmount")),
          spentAmount: bigintFromAnchorValue(decodedField(decoded, "spentAmount")),
          releasedAmount: bigintFromAnchorValue(decodedField(decoded, "releasedAmount")),
          returnedAmount: bigintFromAnchorValue(decodedField(decoded, "returnedAmount")),
          status: Number(decodedField(decoded, "status") ?? 0),
        });
        break;
      case "CapitalContribution":
        snapshot.capitalContributions.push({
          address,
          reserveDomain: asAddress(decodedField(decoded, "reserveDomain")),
          healthPlan: asAddress(decodedField(decoded, "healthPlan")),
          fundingLine: asAddress(decodedField(decoded, "fundingLine")),
          contributor: asAddress(decodedField(decoded, "contributor")),
          assetMint: asAddress(decodedField(decoded, "assetMint")),
          contributedAmount: bigintFromAnchorValue(decodedField(decoded, "contributedAmount")),
          returnedAmount: bigintFromAnchorValue(decodedField(decoded, "returnedAmount")),
          termsHashHex: bytesToHex(decodedField(decoded, "termsHash")),
        });
        break;
      case "ClaimCase":
        snapshot.claimCases.push({
          address,
          reserveDomain: asAddress(decodedField(decoded, "reserveDomain")),
          healthPlan: asAddress(decodedField(decoded, "healthPlan")),
          policySeries: asOptionalAddress(decodedField(decoded, "policySeries")),
          fundingLine: asAddress(decodedField(decoded, "fundingLine")),
          memberPosition: asAddressOrDefault(decodedField(decoded, "memberPosition")),
          claimant: asAddress(decodedField(decoded, "claimant")),
          adjudicator: asOptionalAddress(decodedField(decoded, "adjudicator")),
          claimId: stringFromAnchorValue(decodedField(decoded, "claimId")),
          evidenceRefHashHex: bytesToHex(decodedField(decoded, "evidenceRefHash")),
          decisionSupportHashHex: bytesToHex(decodedField(decoded, "decisionSupportHash")),
          intakeStatus: Number(decodedField(decoded, "intakeStatus") ?? 0),
          approvedAmount: bigintFromAnchorValue(decodedField(decoded, "approvedAmount")),
          deniedAmount: bigintFromAnchorValue(decodedField(decoded, "deniedAmount")),
          paidAmount: bigintFromAnchorValue(decodedField(decoded, "paidAmount")),
          reservedAmount: bigintFromAnchorValue(decodedField(decoded, "reservedAmount")),
          linkedObligation: asOptionalAddress(decodedField(decoded, "linkedObligation")),
        });
        break;
      case "Obligation":
        snapshot.obligations.push({
          address,
          reserveDomain: asAddress(decodedField(decoded, "reserveDomain")),
          assetMint: asAddress(decodedField(decoded, "assetMint")),
          healthPlan: asAddress(decodedField(decoded, "healthPlan")),
          policySeries: asOptionalAddress(decodedField(decoded, "policySeries")),
          memberWallet: asOptionalAddress(decodedField(decoded, "memberWallet")),
          beneficiary: asOptionalAddress(decodedField(decoded, "beneficiary")),
          fundingLine: asAddress(decodedField(decoded, "fundingLine")),
          claimCase: asOptionalAddress(decodedField(decoded, "claimCase")),
          liquidityPool: asOptionalAddress(decodedField(decoded, "liquidityPool")),
          capitalClass: asOptionalAddress(decodedField(decoded, "capitalClass")),
          allocationPosition: asOptionalAddress(decodedField(decoded, "allocationPosition")),
          obligationId: stringFromAnchorValue(decodedField(decoded, "obligationId")),
          status: Number(decodedField(decoded, "status") ?? 0),
          deliveryMode: Number(decodedField(decoded, "deliveryMode") ?? 0),
          principalAmount: bigintFromAnchorValue(decodedField(decoded, "principalAmount")),
          outstandingAmount: bigintFromAnchorValue(decodedField(decoded, "outstandingAmount")),
          reservedAmount: bigintFromAnchorValue(decodedField(decoded, "reservedAmount")),
          claimableAmount: bigintFromAnchorValue(decodedField(decoded, "claimableAmount")),
          payableAmount: bigintFromAnchorValue(decodedField(decoded, "payableAmount")),
          settledAmount: bigintFromAnchorValue(decodedField(decoded, "settledAmount")),
          impairedAmount: bigintFromAnchorValue(decodedField(decoded, "impairedAmount")),
          recoveredAmount: bigintFromAnchorValue(decodedField(decoded, "recoveredAmount")),
        });
        break;
      case "LiquidityPool":
        {
          const strategyHashHex = bytesToHex(decodedField(decoded, "strategyHash"));
          const allowedExposureHashHex = bytesToHex(decodedField(decoded, "allowedExposureHash"));
          const externalYieldAdapterHashHex = bytesToHex(decodedField(decoded, "externalYieldAdapterHash"));
        snapshot.liquidityPools.push({
          address,
          reserveDomain: asAddress(decodedField(decoded, "reserveDomain")),
          curator: asAddress(decodedField(decoded, "curator")),
          allocator: asAddress(decodedField(decoded, "allocator")),
          sentinel: asAddress(decodedField(decoded, "sentinel")),
          poolId: stringFromAnchorValue(decodedField(decoded, "poolId")),
          displayName: stringFromAnchorValue(decodedField(decoded, "displayName")),
          depositAssetMint: asAddress(decodedField(decoded, "depositAssetMint")),
          strategyThesis: isNonZeroHashHex(strategyHashHex)
            ? `strategy:${strategyHashHex.slice(0, 16)}`
            : "canonical_pool",
          strategyHashHex,
          allowedExposureHashHex,
          externalYieldAdapterHashHex,
          redemptionPolicy: Number(decodedField(decoded, "redemptionPolicy") ?? 0),
          pauseFlags: Number(decodedField(decoded, "pauseFlags") ?? 0),
          totalValueLocked: bigintFromAnchorValue(decodedField(decoded, "totalValueLocked")),
          totalAllocated: bigintFromAnchorValue(decodedField(decoded, "totalAllocated")),
          totalReserved: bigintFromAnchorValue(decodedField(decoded, "totalReserved")),
          totalImpaired: bigintFromAnchorValue(decodedField(decoded, "totalImpaired")),
          totalPendingRedemptions: bigintFromAnchorValue(decodedField(decoded, "totalPendingRedemptions")),
          active: Boolean(decodedField(decoded, "active")),
        });
        }
        break;
      case "CapitalClass":
        snapshot.capitalClasses.push({
          address,
          liquidityPool: asAddress(decodedField(decoded, "liquidityPool")),
          classId: stringFromAnchorValue(decodedField(decoded, "classId")),
          displayName: stringFromAnchorValue(decodedField(decoded, "displayName")),
          priority: Number(decodedField(decoded, "priority") ?? 0),
          restrictionMode: Number(decodedField(decoded, "restrictionMode") ?? 0),
          totalShares: bigintFromAnchorValue(decodedField(decoded, "totalShares")),
          navAssets: bigintFromAnchorValue(decodedField(decoded, "navAssets")),
          allocatedAssets: bigintFromAnchorValue(decodedField(decoded, "allocatedAssets")),
          pendingRedemptions: bigintFromAnchorValue(decodedField(decoded, "pendingRedemptions")),
          nextRedemptionSequence: bigintFromAnchorValue(decodedField(decoded, "nextRedemptionSequence")),
          nextRedemptionToProcess: bigintFromAnchorValue(decodedField(decoded, "nextRedemptionToProcess")),
          minLockupSeconds: numberFromAnchorValue(decodedField(decoded, "minLockupSeconds")),
          queueOnlyRedemptions: Boolean(decodedField(decoded, "queueOnlyRedemptions")),
          active: Boolean(decodedField(decoded, "active")),
        });
        break;
      case "LPPosition":
        snapshot.lpPositions.push({
          address,
          owner: asAddress(decodedField(decoded, "owner")),
          capitalClass: asAddress(decodedField(decoded, "capitalClass")),
          shares: bigintFromAnchorValue(decodedField(decoded, "shares")),
          subscriptionBasis: bigintFromAnchorValue(decodedField(decoded, "subscriptionBasis")),
          pendingRedemptionShares: bigintFromAnchorValue(decodedField(decoded, "pendingRedemptionShares")),
          pendingRedemptionAssets: bigintFromAnchorValue(decodedField(decoded, "pendingRedemptionAssets")),
          realizedDistributions: bigintFromAnchorValue(decodedField(decoded, "realizedDistributions")),
          impairedPrincipal: bigintFromAnchorValue(decodedField(decoded, "impairedPrincipal")),
          lockupEndsAt: numberFromAnchorValue(decodedField(decoded, "lockupEndsAt")),
          credentialed: Boolean(decodedField(decoded, "credentialed")),
          queueStatus: Number(decodedField(decoded, "queueStatus") ?? 0),
          redemptionSequence: bigintFromAnchorValue(decodedField(decoded, "redemptionSequence")),
          redemptionRequestedAt: numberFromAnchorValue(decodedField(decoded, "redemptionRequestedAt")),
        });
        break;
      case "AllocationPosition":
        snapshot.allocationPositions.push({
          address,
          reserveDomain: asAddress(decodedField(decoded, "reserveDomain")),
          liquidityPool: asAddress(decodedField(decoded, "liquidityPool")),
          capitalClass: asAddress(decodedField(decoded, "capitalClass")),
          healthPlan: asAddress(decodedField(decoded, "healthPlan")),
          policySeries: asOptionalAddress(decodedField(decoded, "policySeries")),
          fundingLine: asAddress(decodedField(decoded, "fundingLine")),
          capAmount: bigintFromAnchorValue(decodedField(decoded, "capAmount")),
          weightBps: Number(decodedField(decoded, "weightBps") ?? 0),
          allocatedAmount: bigintFromAnchorValue(decodedField(decoded, "allocatedAmount")),
          utilizedAmount: bigintFromAnchorValue(decodedField(decoded, "utilizedAmount")),
          reservedCapacity: bigintFromAnchorValue(decodedField(decoded, "reservedCapacity")),
          realizedPnl: bigintFromAnchorValue(decodedField(decoded, "realizedPnl")),
          impairedAmount: bigintFromAnchorValue(decodedField(decoded, "impairedAmount")),
          deallocationOnly: Boolean(decodedField(decoded, "deallocationOnly")),
          active: Boolean(decodedField(decoded, "active")),
        });
        break;
      case "PlanReserveLedger":
        planLedgersRaw.push({
          address,
          healthPlan: asAddress(decodedField(decoded, "healthPlan", "health_plan")),
          assetMint: asAddress(decodedField(decoded, "assetMint", "asset_mint")),
          sheet: decoded.sheet,
        });
        break;
      case "FundingLineLedger":
        lineLedgersRaw.push({
          address,
          fundingLine: asAddress(decodedField(decoded, "fundingLine", "funding_line")),
          assetMint: asAddress(decodedField(decoded, "assetMint", "asset_mint")),
          sheet: decoded.sheet,
        });
        break;
      case "PoolClassLedger":
        snapshot.poolClassLedgers.push({
          address,
          capitalClass: asAddress(decodedField(decoded, "capitalClass", "capital_class")),
          assetMint: asAddress(decodedField(decoded, "assetMint", "asset_mint")),
          sheet: decoded.sheet as PartialReserveBalanceSheet,
          totalShares: bigintFromAnchorValue(decodedField(decoded, "totalShares", "total_shares")),
          realizedYieldAmount: bigintFromAnchorValue(decodedField(decoded, "realizedYieldAmount", "realized_yield_amount")),
          realizedLossAmount: bigintFromAnchorValue(decodedField(decoded, "realizedLossAmount", "realized_loss_amount")),
        });
        break;
      case "AllocationLedger":
        snapshot.allocationLedgers.push({
          address,
          allocationPosition: asAddress(decodedField(decoded, "allocationPosition", "allocation_position")),
          assetMint: asAddress(decodedField(decoded, "assetMint", "asset_mint")),
          sheet: decoded.sheet as PartialReserveBalanceSheet,
          realizedPnl: bigintFromAnchorValue(decodedField(decoded, "realizedPnl", "realized_pnl")),
        });
        break;
      case "OracleProfile":
        snapshot.oracleProfiles.push({
          address,
          oracle: asAddress(decodedField(decoded, "oracle")),
          admin: asAddress(decodedField(decoded, "admin")),
          oracleType: Number(decodedField(decoded, "oracleType") ?? 0),
          displayName: stringFromAnchorValue(decodedField(decoded, "displayName")),
          legalName: stringFromAnchorValue(decodedField(decoded, "legalName")),
          websiteUrl: stringFromAnchorValue(decodedField(decoded, "websiteUrl")),
          appUrl: stringFromAnchorValue(decodedField(decoded, "appUrl")),
          logoUri: stringFromAnchorValue(decodedField(decoded, "logoUri")),
          webhookUrl: stringFromAnchorValue(decodedField(decoded, "webhookUrl")),
          supportedSchemaCount: Number(decodedField(decoded, "supportedSchemaCount") ?? 0),
          supportedSchemaKeyHashesHex: Array.isArray(decodedField(decoded, "supportedSchemaKeyHashes"))
            ? decodedField<Array<Uint8Array | number[]>>(decoded, "supportedSchemaKeyHashes")!
              .map((value) => bytesToHex(value))
              .filter(Boolean)
              .slice(0, Number(decodedField(decoded, "supportedSchemaCount") ?? 0) || undefined)
            : [],
          active: Boolean(decodedField(decoded, "active")),
          claimed: Boolean(decodedField(decoded, "claimed")),
          createdAtTs: numberFromAnchorValue(decodedField(decoded, "createdAtTs")),
          updatedAtTs: numberFromAnchorValue(decodedField(decoded, "updatedAtTs")),
          bump: Number(decodedField(decoded, "bump") ?? 0),
        });
        break;
      default:
        break;
    }
  }

  const planToDomain = new Map(snapshot.healthPlans.map((plan) => [plan.address, plan.reserveDomain]));
  const lineToDomain = new Map(snapshot.fundingLines.map((line) => [line.address, line.reserveDomain]));

  snapshot.planReserveLedgers = planLedgersRaw.map((ledger) =>
    reserveLedgerSnapshot({
      address: ledger.address,
      reserveDomain: planToDomain.get(ledger.healthPlan) ?? ZERO_PUBKEY,
      assetMint: ledger.assetMint,
      sheet: ledger.sheet,
    }),
  );
  snapshot.fundingLineLedgers = lineLedgersRaw.map((ledger) =>
    reserveLedgerSnapshot({
      address: ledger.address,
      reserveDomain: lineToDomain.get(ledger.fundingLine) ?? ZERO_PUBKEY,
      assetMint: ledger.assetMint,
      sheet: ledger.sheet,
    }),
  );

  snapshot.reserveDomains = sortByLabel(snapshot.reserveDomains, (row) => row.displayName || row.domainId);
  snapshot.domainAssetVaults = sortByLabel(
    snapshot.domainAssetVaults,
    (row) => `${row.reserveDomain}:${row.assetMint}`,
  );
  snapshot.reserveAssetRails = sortByLabel(snapshot.reserveAssetRails, (row) => `${row.reserveDomain}:${row.payoutPriority}:${row.assetSymbol || row.assetMint}`);
  snapshot.healthPlans = sortByLabel(snapshot.healthPlans, (row) => row.displayName || row.planId);
  snapshot.policySeries = sortByLabel(snapshot.policySeries, (row) => row.displayName || row.seriesId);
  snapshot.fundingLines = sortByLabel(snapshot.fundingLines, (row) => row.displayName || row.lineId);
  snapshot.capitalContributions = sortByLabel(
    snapshot.capitalContributions,
    (row) => `${row.fundingLine}:${row.contributor}`,
  );
  snapshot.claimCases = sortByLabel(snapshot.claimCases, (row) => row.claimId);
  snapshot.obligations = sortByLabel(snapshot.obligations, (row) => row.obligationId);
  snapshot.liquidityPools = sortByLabel(snapshot.liquidityPools, (row) => row.displayName || row.poolId);
  snapshot.capitalClasses = sortByLabel(snapshot.capitalClasses, (row) => row.displayName || row.classId);
  snapshot.memberPositions = sortByLabel(snapshot.memberPositions, (row) => `${row.healthPlan}:${row.wallet}`);
  snapshot.lpPositions = sortByLabel(snapshot.lpPositions, (row) => `${row.capitalClass}:${row.owner}`);
  snapshot.allocationPositions = sortByLabel(snapshot.allocationPositions, (row) => `${row.capitalClass}:${row.fundingLine}`);
  snapshot.oracleProfiles = sortByLabel(snapshot.oracleProfiles, (row) => row.displayName || row.oracle);
  snapshot.outcomeSchemas = sortByLabel(snapshot.outcomeSchemas, (row) => `${row.schemaKey}:${row.version}`);
  snapshot.schemaDependencyLedgers = sortByLabel(snapshot.schemaDependencyLedgers, (row) => row.schemaKeyHashHex);
  snapshot.claimAttestations.sort((left, right) =>
    right.createdAtTs - left.createdAtTs || left.address.localeCompare(right.address),
  );

  return snapshot;
}

function matchesSearch(haystacks: Array<string | null | undefined>, search?: string | null): boolean {
  const needle = search?.trim().toLowerCase();
  if (!needle) return true;
  return haystacks.some((value) => value?.toLowerCase().includes(needle));
}

function buildInstructionAccounts(
  accounts: Array<{ pubkey: PublicKeyish; isSigner?: boolean; isWritable?: boolean }>,
) {
  return accounts.map((account) => ({
    pubkey: toPublicKey(account.pubkey),
    isSigner: Boolean(account.isSigner),
    isWritable: Boolean(account.isWritable),
  }));
}

function buildProtocolInstruction(
  name: string,
  args: Record<string, unknown>,
  accounts: Array<{ pubkey: PublicKeyish; isSigner?: boolean; isWritable?: boolean }>,
): TransactionInstruction {
  const definition = PROTOCOL_IDL.instructions.find((instruction) => instruction.name === name);
  const normalizedArgs = definition?.args?.length === 1
    && definition.args[0]?.name === "args"
    && !Object.prototype.hasOwnProperty.call(args, "args")
    ? { args }
    : args;
  const encodedArgs = normalizeInstructionArgsValue(normalizedArgs);
  return new TransactionInstruction({
    programId: getProgramId(),
    keys: buildInstructionAccounts(accounts),
    data: PROTOCOL_CODER.instruction.encode(name, encodedArgs),
  });
}

function normalizeInstructionArgsValue(value: unknown): unknown {
  if (typeof value === "bigint") {
    return new BN(value.toString());
  }
  if (Array.isArray(value)) {
    return value.map((item) => normalizeInstructionArgsValue(item));
  }
  if (
    value instanceof PublicKey
    || (
      value
      && typeof value === "object"
      && "toBuffer" in value
      && typeof value.toBuffer === "function"
      && "toBase58" in value
      && typeof value.toBase58 === "function"
    )
    || value instanceof Uint8Array
    || Buffer.isBuffer(value)
    || value === null
    || value === undefined
  ) {
    return value;
  }
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, currentValue]) => [key, normalizeInstructionArgsValue(currentValue)]),
    );
  }
  return value;
}

function buildProtocolTransaction(params: {
  feePayer: PublicKeyish;
  recentBlockhash: string;
  instructions: TransactionInstruction[];
}): Transaction {
  return new Transaction({
    feePayer: toPublicKey(params.feePayer),
    recentBlockhash: params.recentBlockhash,
  }).add(...params.instructions);
}

export type ProtocolInstructionAccountInput = {
  pubkey?: PublicKeyish | null;
  isSigner?: boolean;
  isWritable?: boolean;
};

function normalizeProtocolInstructionAccounts(
  accounts: ProtocolInstructionAccountInput[],
): Array<{ pubkey: PublicKeyish; isSigner?: boolean; isWritable?: boolean }> {
  return accounts.map((account) => {
    const pubkey = account.pubkey ?? getProgramId();
    return {
      pubkey,
      isSigner: account.pubkey ? Boolean(account.isSigner) : false,
      isWritable: account.pubkey ? Boolean(account.isWritable) : false,
    };
  });
}

function optionalProtocolAccount(
  pubkey?: PublicKeyish | null,
  isWritable = false,
): ProtocolInstructionAccountInput {
  return pubkey
    ? { pubkey, isWritable }
    : { pubkey: undefined, isWritable: false };
}

function isMissingOrZeroPublicKey(pubkey?: PublicKeyish | null): boolean {
  return !pubkey || toPublicKey(pubkey).equals(ZERO_PUBKEY_KEY);
}

function optionalNonZeroProtocolAccount(
  pubkey?: PublicKeyish | null,
  isWritable = false,
): ProtocolInstructionAccountInput {
  return isMissingOrZeroPublicKey(pubkey)
    ? optionalProtocolAccount(undefined)
    : optionalProtocolAccount(pubkey, isWritable);
}

function optionalPoolClassLedgerAccount(
  capitalClassAddress: PublicKeyish | null | undefined,
  poolAssetMint: PublicKeyish | null | undefined,
): ProtocolInstructionAccountInput {
  if (!capitalClassAddress || !poolAssetMint) return optionalProtocolAccount(undefined);
  return optionalProtocolAccount(
    derivePoolClassLedgerPda({ capitalClass: capitalClassAddress, assetMint: poolAssetMint }),
    true,
  );
}

function optionalAllocationLedgerAccount(
  allocationPositionAddress: PublicKeyish | null | undefined,
  assetMint: PublicKeyish | null | undefined,
): ProtocolInstructionAccountInput {
  if (!allocationPositionAddress || !assetMint) return optionalProtocolAccount(undefined);
  return optionalProtocolAccount(
    deriveAllocationLedgerPda({ allocationPosition: allocationPositionAddress, assetMint }),
    true,
  );
}

export function buildProtocolTransactionFromInstruction(params: {
  feePayer: PublicKeyish;
  recentBlockhash: string;
  instructionName: string;
  args: Record<string, unknown>;
  accounts: ProtocolInstructionAccountInput[];
}): Transaction {
  const instruction = buildProtocolInstruction(
    params.instructionName,
    params.args,
    normalizeProtocolInstructionAccounts(params.accounts),
  );
  return buildProtocolTransaction({
    feePayer: params.feePayer,
    recentBlockhash: params.recentBlockhash,
    instructions: [instruction],
  });
}

function oracleMetadataUri(profile: OracleProfileSummary): string {
  return profile.logoUri || profile.websiteUrl || profile.appUrl || "";
}

function mapOracleSummary(profile: OracleProfileSummary): OracleWithProfileSummary {
  return {
    address: profile.address,
    oracle: profile.oracle,
    active: profile.active,
    claimed: profile.claimed,
    admin: profile.admin,
    bump: profile.bump,
    metadataUri: oracleMetadataUri(profile),
    profile,
  };
}

function configuredPublicKeyFromEnv(value?: string | null): string {
  const normalized = value?.trim();
  if (!normalized) return ZERO_PUBKEY;
  try {
    return new PublicKey(normalized).toBase58();
  } catch {
    return ZERO_PUBKEY;
  }
}

function poolAddressForSeriesInSnapshot(
  seriesAddress: string,
  snapshot: Pick<ProtocolConsoleSnapshot, "allocationPositions">,
): string | null {
  return snapshot.allocationPositions.find((allocation) => allocation.policySeries === seriesAddress)?.liquidityPool ?? null;
}

function schemaVersionForSeries(
  series: PolicySeriesSnapshot,
  snapshot: Pick<ProtocolConsoleSnapshot, "outcomeSchemas">,
): number {
  const directMatch = series.comparabilityHashHex
    ? snapshot.outcomeSchemas.find((schema) =>
      schema.schemaKeyHashHex === series.comparabilityHashHex
      && schema.version === Number.parseInt(series.termsVersion, 10),
    ) ?? snapshot.outcomeSchemas.find((schema) => schema.schemaKeyHashHex === series.comparabilityHashHex) ?? null
    : null;
  if (directMatch) return directMatch.version;
  const parsedVersion = Number.parseInt(series.termsVersion, 10);
  return Number.isFinite(parsedVersion) ? parsedVersion : 0;
}

function isNonZeroHashHex(value?: string | null): boolean {
  const normalized = value?.trim().toLowerCase().replace(/^0x/, "") ?? "";
  return /^[0-9a-f]{64}$/.test(normalized) && normalized !== ZERO_HASH_HEX;
}

export function hasConfiguredPoolTerms(
  pool?: Pick<LiquidityPoolSnapshot, "strategyHashHex" | "allowedExposureHashHex" | "externalYieldAdapterHashHex"> | null,
): boolean {
  return Boolean(
    pool
    && isNonZeroHashHex(pool.strategyHashHex)
    && isNonZeroHashHex(pool.allowedExposureHashHex)
    && isNonZeroHashHex(pool.externalYieldAdapterHashHex),
  );
}

function poolOrganizationRef(
  pool: LiquidityPoolSnapshot,
  snapshot: Pick<ProtocolConsoleSnapshot, "reserveDomains" | "allocationPositions" | "healthPlans">,
): string {
  const fundingAllocation = snapshot.allocationPositions.find((allocation) => allocation.liquidityPool === pool.address);
  const sponsorLabel = fundingAllocation
    ? snapshot.healthPlans.find((plan) => plan.address === fundingAllocation.healthPlan)?.sponsorLabel ?? null
    : null;
  if (sponsorLabel) return sponsorLabel;
  return snapshot.reserveDomains.find((domain) => domain.address === pool.reserveDomain)?.displayName ?? pool.displayName;
}

function mapPoolSummary(
  pool: LiquidityPoolSnapshot,
  snapshot: Pick<ProtocolConsoleSnapshot, "reserveDomains" | "allocationPositions" | "healthPlans">,
): PoolSummary {
  return {
    address: pool.address,
    poolId: pool.poolId,
    displayName: pool.displayName,
    reserveDomain: pool.reserveDomain,
    depositAssetMint: pool.depositAssetMint,
    authority: pool.curator || pool.allocator || pool.sentinel || ZERO_PUBKEY,
    organizationRef: poolOrganizationRef(pool, snapshot),
    active: pool.active,
  };
}

export type ProtocolReadiness = {
  protocolConfigExists: boolean;
  /** Alias of protocolConfigExists for legacy ui-capabilities call sites. */
  configInitialized?: boolean;
  poolExists: boolean;
  oracleRegistered: boolean;
  oracleProfileExists: boolean;
  poolOracleApproved: boolean;
  poolOraclePolicyConfigured: boolean;
  oracleStakePositionExists: boolean;
  inviteIssuerRegistered: boolean;
  schemaRegistered: boolean;
  ruleRegistered: boolean;
  memberEnrolled: boolean;
  claimDelegateConfigured: boolean;
  poolTermsConfigured: boolean;
  poolAssetVaultConfigured: boolean;
  coveragePolicyExists: boolean;
  coveragePolicyNftExists: boolean;
  premiumLedgerTracked: boolean;
  derived: {
    configAddress: string | null;
    poolAddress: string | null;
    poolTermsAddress: string | null;
    poolAssetVaultAddress: string | null;
    oracleEntryAddress: string | null;
    oracleProfileAddress: string | null;
    poolOracleAddress: string | null;
    poolOraclePolicyAddress: string | null;
    oracleStakeAddress: string | null;
    inviteIssuerAddress: string | null;
    membershipAddress: string | null;
    claimDelegateAddress: string | null;
    schemaAddress: string | null;
    ruleAddress: string | null;
    coveragePolicyAddress: string | null;
    coverageNftAddress: string | null;
    premiumLedgerAddress: string | null;
  };
};

export function clearProtocolDiscoveryCache(): void {
  // The canonical adapter currently reads live chain state directly for every discovery request.
}

export async function listOraclesWithProfiles(params: {
  connection: Connection;
  activeOnly?: boolean;
  search?: string | null;
}): Promise<OracleWithProfileSummary[]> {
  const snapshot = await loadProtocolConsoleSnapshot(params.connection);
  return snapshot.oracleProfiles
    .map(mapOracleSummary)
    .filter((oracle) => !params.activeOnly || oracle.active)
    .filter((oracle) =>
      matchesSearch(
        [
          oracle.oracle,
          oracle.admin,
          oracle.profile?.displayName,
          oracle.profile?.legalName,
          oracle.profile?.websiteUrl,
          oracle.profile?.appUrl,
          oracle.metadataUri,
          oracle.claimed ? "claimed" : "unclaimed",
        ],
        params.search,
      ),
    );
}

export async function listOracles(params: {
  connection: Connection;
  activeOnly?: boolean;
  search?: string | null;
}): Promise<OracleSummary[]> {
  return listOraclesWithProfiles(params);
}

export async function fetchProtocolConfig(params: {
  connection: Connection;
}): Promise<ProtocolConfigSummary | null> {
  void params;
  return null;
}

export async function listProtocolConfig(params: {
  connection: Connection;
}): Promise<ProtocolConfigSummary[]> {
  const config = await fetchProtocolConfig(params);
  return config ? [config] : [];
}

export async function listPools(params: {
  connection: Connection;
  activeOnly?: boolean;
  search?: string | null;
}): Promise<PoolSummary[]> {
  const snapshot = await loadProtocolConsoleSnapshot(params.connection);
  return snapshot.liquidityPools
    .map((pool) => mapPoolSummary(pool, snapshot))
    .filter((pool) => !params.activeOnly || pool.active)
    .filter((pool) =>
      matchesSearch(
        [
          pool.address,
          pool.poolId,
          pool.displayName,
          pool.reserveDomain,
          pool.depositAssetMint,
          pool.organizationRef,
          pool.authority,
          pool.active ? "active" : "inactive",
        ],
        params.search,
      ),
    );
}

export async function listReserveDomains(params: {
  connection: Connection;
  activeOnly?: boolean;
  search?: string | null;
}): Promise<ReserveDomainSummary[]> {
  const snapshot = await loadProtocolConsoleSnapshot(params.connection);
  return snapshot.reserveDomains
    .filter((domain) => !params.activeOnly || domain.active)
    .filter((domain) =>
      matchesSearch(
        [
          domain.domainId,
          domain.displayName,
          domain.domainAdmin,
          domain.active ? "active" : "inactive",
        ],
        params.search,
      ),
    );
}

export async function listDomainAssetVaults(params: {
  connection: Connection;
  reserveDomainAddress?: string | null;
  assetMint?: string | null;
  search?: string | null;
}): Promise<DomainAssetVaultSummary[]> {
  const snapshot = await loadProtocolConsoleSnapshot(params.connection);
  const reserveDomainAddress = params.reserveDomainAddress?.trim();
  const assetMint = params.assetMint?.trim();
  return snapshot.domainAssetVaults
    .filter((vault) => !reserveDomainAddress || vault.reserveDomain === reserveDomainAddress)
    .filter((vault) => !assetMint || vault.assetMint === assetMint)
    .filter((vault) =>
      matchesSearch(
        [
          vault.address,
          vault.reserveDomain,
          vault.assetMint,
          vault.vaultTokenAccount,
        ],
        params.search,
      ),
    );
}

export async function listSchemas(params: {
  connection: Connection;
  verifiedOnly?: boolean;
  search?: string | null;
}): Promise<SchemaSummary[]> {
  void params;
  return [];
}

export async function listPoolRules(params: {
  connection: Connection;
  poolAddress?: string | null;
  schemaKeyHashHex?: string | null;
  enabledOnly?: boolean;
  search?: string | null;
}): Promise<RuleSummary[]> {
  const snapshot = await loadProtocolConsoleSnapshot(params.connection);
  const rules: RuleSummary[] = snapshot.policySeries
    .map<RuleSummary | null>((series) => {
      const pool = poolAddressForSeriesInSnapshot(series.address, snapshot);
      if (!pool || !series.comparabilityHashHex) return null;
      const version = schemaVersionForSeries(series, snapshot);
      return {
        address: series.address,
        ruleId: `${series.seriesId}:v${version}`,
        pool,
        schemaKeyHashHex: series.comparabilityHashHex,
        schemaVersion: version,
        enabled: true,
        policySeries: series.address,
        healthPlan: series.healthPlan,
      };
    })
    .filter((rule): rule is RuleSummary => rule !== null);
  return rules
    .filter((rule) => !params.poolAddress || rule.pool === params.poolAddress)
    .filter((rule) => !params.schemaKeyHashHex || rule.schemaKeyHashHex.toLowerCase() === params.schemaKeyHashHex.trim().toLowerCase())
    .filter((rule) => !params.enabledOnly || rule.enabled)
    .filter((rule) =>
      matchesSearch(
        [
          rule.ruleId,
          rule.address,
          rule.pool,
          rule.policySeries,
          rule.healthPlan,
          rule.schemaKeyHashHex,
          rule.enabled ? "enabled" : "disabled",
        ],
        params.search,
      ),
    );
}

export async function fetchProtocolReadiness(params: {
  connection: Connection;
  poolAddress?: string | null;
  oracleAddress?: string | null;
  memberAddress?: string | null;
  stakerAddress?: string | null;
  schemaKeyHashHex?: string | null;
  ruleHashHex?: string | null;
}): Promise<ProtocolReadiness> {
  const snapshot = await loadProtocolConsoleSnapshot(params.connection);
  const poolAddress = params.poolAddress?.trim() || null;
  const oracleAddress = params.oracleAddress?.trim() || null;
  const memberAddress = params.memberAddress?.trim() || null;
  const schemaKeyHashHex = normalizeOptionalHex32(params.schemaKeyHashHex);
  const ruleHashHex = normalizeOptionalHex32(params.ruleHashHex);

  const pool = poolAddress
    ? snapshot.liquidityPools.find((entry) => entry.address === poolAddress) ?? null
    : null;
  const oracleProfile = oracleAddress
    ? snapshot.oracleProfiles.find((entry) => entry.oracle === oracleAddress || entry.address === oracleAddress) ?? null
    : null;
  const matchingSchema = schemaKeyHashHex
    ? snapshot.outcomeSchemas.find((entry) => entry.schemaKeyHashHex.toLowerCase() === schemaKeyHashHex) ?? null
    : null;
  const matchingRuleSeries = snapshot.policySeries.find((series) => {
    const poolMatches = !pool || poolAddressForSeriesInSnapshot(series.address, snapshot) === pool.address;
    const schemaMatches = !schemaKeyHashHex
      || series.comparabilityHashHex?.toLowerCase() === schemaKeyHashHex;
    const ruleMatches = !ruleHashHex || series.comparabilityHashHex?.toLowerCase() === ruleHashHex;
    return poolMatches && schemaMatches && ruleMatches;
  }) ?? null;
  const memberPosition = memberAddress
    ? snapshot.memberPositions.find((entry) => entry.wallet === memberAddress)
      ?? null
    : null;
  const matchingFundingLine = pool
    ? snapshot.allocationPositions.find((entry) => entry.liquidityPool === pool.address)?.fundingLine ?? null
    : null;
  const domainAssetVault = pool
    ? snapshot.domainAssetVaults.find((entry) =>
      entry.reserveDomain === pool.reserveDomain && entry.assetMint === pool.depositAssetMint,
    ) ?? null
    : null;
  const poolHasCoverageFlow = pool
    ? snapshot.allocationPositions.some((entry) => entry.liquidityPool === pool.address)
    : false;
  const premiumIncomeTracked = pool && matchingFundingLine
    ? snapshot.fundingLines.some((line) =>
      line.address === matchingFundingLine && line.lineType === FUNDING_LINE_TYPE_PREMIUM_INCOME,
    )
    : false;
  const poolTermsConfigured = hasConfiguredPoolTerms(pool);

  return {
    protocolConfigExists: true,
    poolExists: Boolean(pool),
    oracleRegistered: Boolean(oracleProfile),
    oracleProfileExists: Boolean(oracleProfile),
    poolOracleApproved: true,
    poolOraclePolicyConfigured: true,
    oracleStakePositionExists: false,
    inviteIssuerRegistered: false,
    schemaRegistered: Boolean(matchingSchema),
    ruleRegistered: Boolean(matchingRuleSeries),
    memberEnrolled: Boolean(memberPosition),
    claimDelegateConfigured: false,
    poolTermsConfigured,
    poolAssetVaultConfigured: Boolean(domainAssetVault),
    coveragePolicyExists: poolHasCoverageFlow,
    coveragePolicyNftExists: false,
    premiumLedgerTracked: premiumIncomeTracked,
    derived: {
      configAddress: null,
      poolAddress: pool?.address ?? poolAddress,
      poolTermsAddress: poolTermsConfigured ? pool?.address ?? null : null,
      poolAssetVaultAddress: domainAssetVault?.address ?? null,
      oracleEntryAddress: oracleProfile?.address ?? null,
      oracleProfileAddress: oracleProfile?.address ?? null,
      poolOracleAddress: null,
      poolOraclePolicyAddress: null,
      oracleStakeAddress: params.stakerAddress?.trim() || null,
      inviteIssuerAddress: null,
      membershipAddress: memberPosition?.address ?? null,
      claimDelegateAddress: null,
      schemaAddress: matchingSchema?.address ?? null,
      ruleAddress: matchingRuleSeries?.address ?? null,
      coveragePolicyAddress: matchingFundingLine,
      coverageNftAddress: null,
      premiumLedgerAddress: premiumIncomeTracked ? matchingFundingLine : null,
    },
  };
}

export function buildCreateReserveDomainTx(params: {
  authority: PublicKeyish;
  recentBlockhash: string;
  domainId: string;
  displayName: string;
  domainAdmin?: PublicKeyish | null;
  settlementMode: number;
  legalStructureHashHex?: string | null;
  complianceBaselineHashHex?: string | null;
  allowedRailMask: number;
  pauseFlags: number;
}): Transaction {
  const authority = toPublicKey(params.authority);
  return buildProtocolTransactionFromInstruction({
    feePayer: authority,
    recentBlockhash: params.recentBlockhash,
    instructionName: "create_reserve_domain",
    args: {
      domain_id: params.domainId,
      display_name: params.displayName,
      domain_admin: toPublicKey(params.domainAdmin ?? authority),
      settlement_mode: params.settlementMode,
      legal_structure_hash: Array.from(hexToFixedBytes(normalizeOptionalHex32(params.legalStructureHashHex), 32)),
      compliance_baseline_hash: Array.from(
        hexToFixedBytes(normalizeOptionalHex32(params.complianceBaselineHashHex), 32),
      ),
      allowed_rail_mask: params.allowedRailMask,
      pause_flags: params.pauseFlags,
    },
    accounts: [
      { pubkey: authority, isSigner: true, isWritable: true },
      {
        pubkey: deriveReserveDomainPda({ domainId: params.domainId }),
        isWritable: true,
      },
      { pubkey: SystemProgram.programId },
    ],
  });
}

export function buildCreateDomainAssetVaultTx(params: {
  authority: PublicKeyish;
  reserveDomainAddress: PublicKeyish;
  assetMint: PublicKeyish;
  recentBlockhash: string;
  tokenProgramId?: PublicKeyish | null;
}): Transaction {
  const authority = toPublicKey(params.authority);
  const assetMint = toPublicKey(params.assetMint);
  const tokenProgramId = classicTokenProgramId(params.tokenProgramId);
  return buildProtocolTransactionFromInstruction({
    feePayer: authority,
    recentBlockhash: params.recentBlockhash,
    instructionName: "create_domain_asset_vault",
    args: {
      asset_mint: assetMint,
    },
    accounts: [
      { pubkey: authority, isSigner: true, isWritable: true },
      { pubkey: params.reserveDomainAddress, isWritable: true },
      {
        pubkey: deriveDomainAssetVaultPda({
          reserveDomain: params.reserveDomainAddress,
          assetMint,
        }),
        isWritable: true,
      },
      {
        pubkey: deriveDomainAssetLedgerPda({
          reserveDomain: params.reserveDomainAddress,
          assetMint,
        }),
        isWritable: true,
      },
      { pubkey: assetMint },
      {
        pubkey: deriveDomainAssetVaultTokenAccountPda({
          reserveDomain: params.reserveDomainAddress,
          assetMint,
        }),
        isWritable: true,
      },
      { pubkey: tokenProgramId },
      { pubkey: SystemProgram.programId },
    ],
  });
}

export function buildUpdateReserveDomainControlsTx(params: {
  authority: PublicKeyish;
  reserveDomainAddress: PublicKeyish;
  recentBlockhash: string;
  allowedRailMask: number;
  pauseFlags: number;
  active: boolean;
  reasonHashHex?: string | null;
}): Transaction {
  const authority = toPublicKey(params.authority);
  return buildProtocolTransactionFromInstruction({
    feePayer: authority,
    recentBlockhash: params.recentBlockhash,
    instructionName: "update_reserve_domain_controls",
    args: {
      allowed_rail_mask: params.allowedRailMask,
      pause_flags: params.pauseFlags,
      active: params.active,
      reason_hash: Array.from(hexToFixedBytes(normalizeOptionalHex32(params.reasonHashHex), 32)),
    },
    accounts: [
      { pubkey: authority, isSigner: true },
      { pubkey: params.reserveDomainAddress, isWritable: true },
    ],
  });
}

export function buildUpdateHealthPlanControlsTx(params: {
  authority: PublicKeyish;
  healthPlanAddress: PublicKeyish;
  recentBlockhash: string;
  sponsorOperator: PublicKeyish;
  claimsOperator: PublicKeyish;
  oracleAuthority: PublicKeyish | null | undefined;
  membershipMode?: number;
  membershipGateKind?: number;
  membershipGateMint?: PublicKeyish | null | undefined;
  membershipGateMinAmount?: bigint;
  membershipInviteAuthority?: PublicKeyish | null | undefined;
  allowedRailMask: number;
  defaultFundingPriority: number;
  oraclePolicyHashHex?: string | null;
  schemaBindingHashHex?: string | null;
  complianceBaselineHashHex?: string | null;
  pauseFlags: number;
  active: boolean;
  reasonHashHex?: string | null;
}): Transaction {
  const authority = toPublicKey(params.authority);
  return buildProtocolTransactionFromInstruction({
    feePayer: authority,
    recentBlockhash: params.recentBlockhash,
    instructionName: "update_health_plan_controls",
    args: {
      sponsor_operator: toPublicKey(params.sponsorOperator),
      claims_operator: toPublicKey(params.claimsOperator),
      oracle_authority: toPublicKey(params.oracleAuthority ?? ZERO_PUBKEY_KEY),
      allowed_rail_mask: params.allowedRailMask,
      default_funding_priority: params.defaultFundingPriority,
      oracle_policy_hash: Array.from(hexToFixedBytes(normalizeOptionalHex32(params.oraclePolicyHashHex), 32)),
      schema_binding_hash: Array.from(hexToFixedBytes(normalizeOptionalHex32(params.schemaBindingHashHex), 32)),
      compliance_baseline_hash: Array.from(hexToFixedBytes(normalizeOptionalHex32(params.complianceBaselineHashHex), 32)),
      pause_flags: params.pauseFlags,
      active: params.active,
      reason_hash: Array.from(hexToFixedBytes(normalizeOptionalHex32(params.reasonHashHex), 32)),
    },
    accounts: [
      { pubkey: authority, isSigner: true },
      { pubkey: params.healthPlanAddress, isWritable: true },
    ],
  });
}

export function buildVersionPolicySeriesTx(params: {
  authority: PublicKeyish;
  healthPlanAddress: PublicKeyish;
  currentPolicySeriesAddress: PublicKeyish;
  assetMint: PublicKeyish;
  recentBlockhash: string;
  seriesId: string;
  displayName: string;
  metadataUri: string;
  status: number;
  adjudicationMode: number;
  termsHashHex?: string | null;
  pricingHashHex?: string | null;
  payoutHashHex?: string | null;
  reserveModelHashHex?: string | null;
  evidenceRequirementsHashHex?: string | null;
  comparabilityHashHex?: string | null;
  policyOverridesHashHex?: string | null;
  cycleSeconds: bigint;
}): Transaction {
  const authority = toPublicKey(params.authority);
  const nextPolicySeries = derivePolicySeriesPda({
    healthPlan: params.healthPlanAddress,
    seriesId: params.seriesId,
  });
  return buildProtocolTransactionFromInstruction({
    feePayer: authority,
    recentBlockhash: params.recentBlockhash,
    instructionName: "version_policy_series",
    args: {
      series_id: params.seriesId,
      display_name: params.displayName,
      metadata_uri: params.metadataUri,
      status: params.status,
      adjudication_mode: params.adjudicationMode,
      terms_hash: Array.from(hexToFixedBytes(normalizeOptionalHex32(params.termsHashHex), 32)),
      pricing_hash: Array.from(hexToFixedBytes(normalizeOptionalHex32(params.pricingHashHex), 32)),
      payout_hash: Array.from(hexToFixedBytes(normalizeOptionalHex32(params.payoutHashHex), 32)),
      reserve_model_hash: Array.from(hexToFixedBytes(normalizeOptionalHex32(params.reserveModelHashHex), 32)),
      comparability_hash: Array.from(hexToFixedBytes(normalizeOptionalHex32(params.comparabilityHashHex), 32)),
      policy_overrides_hash: Array.from(hexToFixedBytes(normalizeOptionalHex32(params.policyOverridesHashHex), 32)),
      cycle_seconds: params.cycleSeconds,
    },
    accounts: [
      { pubkey: authority, isSigner: true, isWritable: true },
      { pubkey: params.healthPlanAddress },
      { pubkey: params.currentPolicySeriesAddress, isWritable: true },
      { pubkey: nextPolicySeries, isWritable: true },
      { pubkey: SystemProgram.programId },
    ],
  });
}

export function buildCreatePolicySeriesTx(params: {
  authority: PublicKeyish;
  healthPlanAddress: PublicKeyish;
  assetMint: PublicKeyish;
  recentBlockhash: string;
  seriesId: string;
  displayName: string;
  metadataUri: string;
  mode: number;
  status: number;
  adjudicationMode: number;
  termsHashHex?: string | null;
  pricingHashHex?: string | null;
  payoutHashHex?: string | null;
  reserveModelHashHex?: string | null;
  evidenceRequirementsHashHex?: string | null;
  comparabilityHashHex?: string | null;
  policyOverridesHashHex?: string | null;
  cycleSeconds: bigint;
  termsVersion: number;
}): Transaction {
  const authority = toPublicKey(params.authority);
  const policySeries = derivePolicySeriesPda({
    healthPlan: params.healthPlanAddress,
    seriesId: params.seriesId,
  });
  return buildProtocolTransactionFromInstruction({
    feePayer: authority,
    recentBlockhash: params.recentBlockhash,
    instructionName: "create_policy_series",
    args: {
      series_id: params.seriesId,
      display_name: params.displayName,
      metadata_uri: params.metadataUri,
      asset_mint: toPublicKey(params.assetMint),
      mode: params.mode,
      status: params.status,
      adjudication_mode: params.adjudicationMode,
      terms_hash: Array.from(hexToFixedBytes(normalizeOptionalHex32(params.termsHashHex), 32)),
      pricing_hash: Array.from(hexToFixedBytes(normalizeOptionalHex32(params.pricingHashHex), 32)),
      payout_hash: Array.from(hexToFixedBytes(normalizeOptionalHex32(params.payoutHashHex), 32)),
      reserve_model_hash: Array.from(hexToFixedBytes(normalizeOptionalHex32(params.reserveModelHashHex), 32)),
      comparability_hash: Array.from(hexToFixedBytes(normalizeOptionalHex32(params.comparabilityHashHex), 32)),
      policy_overrides_hash: Array.from(
        hexToFixedBytes(normalizeOptionalHex32(params.policyOverridesHashHex), 32),
      ),
      cycle_seconds: params.cycleSeconds,
      terms_version: params.termsVersion,
    },
    accounts: [
      { pubkey: authority, isSigner: true, isWritable: true },
      { pubkey: params.healthPlanAddress },
      { pubkey: policySeries, isWritable: true },
      { pubkey: SystemProgram.programId },
    ],
  });
}

export function buildOpenFundingLineTx(params: {
  authority: PublicKeyish;
  healthPlanAddress: PublicKeyish;
  reserveDomainAddress: PublicKeyish;
  assetMint: PublicKeyish;
  recentBlockhash: string;
  lineId: string;
  policySeriesAddress?: PublicKeyish | null;
  lineType: number;
  fundingPriority: number;
  committedAmount: bigint;
  capsHashHex?: string | null;
}): Transaction {
  const authority = toPublicKey(params.authority);
  const assetMint = toPublicKey(params.assetMint);
  const fundingLine = deriveFundingLinePda({
    healthPlan: params.healthPlanAddress,
    lineId: params.lineId,
  });
  return buildProtocolTransactionFromInstruction({
    feePayer: authority,
    recentBlockhash: params.recentBlockhash,
    instructionName: "open_funding_line",
    args: {
      line_id: params.lineId,
      policy_series: toPublicKey(params.policySeriesAddress ?? ZERO_PUBKEY_KEY),
      asset_mint: assetMint,
      line_type: params.lineType,
      funding_priority: params.fundingPriority,
      committed_amount: params.committedAmount,
      caps_hash: Array.from(hexToFixedBytes(normalizeOptionalHex32(params.capsHashHex), 32)),
    },
    accounts: [
      { pubkey: authority, isSigner: true, isWritable: true },
      { pubkey: params.healthPlanAddress },
      {
        pubkey: deriveDomainAssetVaultPda({
          reserveDomain: params.reserveDomainAddress,
          assetMint,
        }),
      },
      {
        pubkey: deriveDomainAssetLedgerPda({
          reserveDomain: params.reserveDomainAddress,
          assetMint,
        }),
        isWritable: true,
      },
      { pubkey: fundingLine, isWritable: true },
      {
        pubkey: deriveFundingLineLedgerPda({
          fundingLine,
          assetMint,
        }),
        isWritable: true,
      },
      {
        pubkey: derivePlanReserveLedgerPda({
          healthPlan: params.healthPlanAddress,
          assetMint,
        }),
        isWritable: true,
      },
      optionalNonZeroProtocolAccount(params.policySeriesAddress),
      { pubkey: SystemProgram.programId },
    ],
  });
}

export function buildFundSponsorBudgetTx(params: {
  authority: PublicKeyish;
  healthPlanAddress: PublicKeyish;
  reserveDomainAddress: PublicKeyish;
  fundingLineAddress: PublicKeyish;
  assetMint: PublicKeyish;
  sourceTokenAccountAddress: PublicKeyish;
  vaultTokenAccountAddress: PublicKeyish;
  tokenProgramId?: PublicKeyish | null;
  recentBlockhash: string;
  amount: bigint;
  policySeriesAddress?: PublicKeyish | null;
}): Transaction {
  const authority = toPublicKey(params.authority);
  const tokenProgramId = classicTokenProgramId(params.tokenProgramId);
  return buildProtocolTransactionFromInstruction({
    feePayer: authority,
    recentBlockhash: params.recentBlockhash,
    instructionName: "fund_sponsor_budget",
    args: { amount: params.amount },
    accounts: [
      { pubkey: authority, isSigner: true },
      { pubkey: params.healthPlanAddress },
      {
        pubkey: deriveDomainAssetVaultPda({
          reserveDomain: params.reserveDomainAddress,
          assetMint: params.assetMint,
        }),
        isWritable: true,
      },
      {
        pubkey: deriveDomainAssetLedgerPda({
          reserveDomain: params.reserveDomainAddress,
          assetMint: params.assetMint,
        }),
        isWritable: true,
      },
      { pubkey: params.fundingLineAddress, isWritable: true },
      {
        pubkey: deriveFundingLineLedgerPda({
          fundingLine: params.fundingLineAddress,
          assetMint: params.assetMint,
        }),
        isWritable: true,
      },
      {
        pubkey: derivePlanReserveLedgerPda({
          healthPlan: params.healthPlanAddress,
          assetMint: params.assetMint,
        }),
        isWritable: true,
      },
      { pubkey: params.sourceTokenAccountAddress, isWritable: true },
      { pubkey: params.assetMint },
      { pubkey: params.vaultTokenAccountAddress, isWritable: true },
      { pubkey: tokenProgramId },
    ],
  });
}

export function buildRecordPremiumPaymentTx(params: {
  authority: PublicKeyish;
  healthPlanAddress: PublicKeyish;
  reserveDomainAddress: PublicKeyish;
  fundingLineAddress: PublicKeyish;
  assetMint: PublicKeyish;
  sourceTokenAccountAddress: PublicKeyish;
  vaultTokenAccountAddress: PublicKeyish;
  tokenProgramId?: PublicKeyish | null;
  recentBlockhash: string;
  amount: bigint;
  policySeriesAddress?: PublicKeyish | null;
  capitalClassAddress?: PublicKeyish | null;
  poolAssetMint?: PublicKeyish | null;
}): Transaction {
  const authority = toPublicKey(params.authority);
  const tokenProgramId = classicTokenProgramId(params.tokenProgramId);
  return buildProtocolTransactionFromInstruction({
    feePayer: authority,
    recentBlockhash: params.recentBlockhash,
    instructionName: "record_premium_payment",
    args: { amount: params.amount },
    accounts: [
      { pubkey: authority, isSigner: true },
      { pubkey: params.healthPlanAddress },
      {
        pubkey: deriveDomainAssetVaultPda({
          reserveDomain: params.reserveDomainAddress,
          assetMint: params.assetMint,
        }),
        isWritable: true,
      },
      {
        pubkey: deriveDomainAssetLedgerPda({
          reserveDomain: params.reserveDomainAddress,
          assetMint: params.assetMint,
        }),
        isWritable: true,
      },
      { pubkey: params.fundingLineAddress, isWritable: true },
      {
        pubkey: deriveFundingLineLedgerPda({
          fundingLine: params.fundingLineAddress,
          assetMint: params.assetMint,
        }),
        isWritable: true,
      },
      {
        pubkey: derivePlanReserveLedgerPda({
          healthPlan: params.healthPlanAddress,
          assetMint: params.assetMint,
        }),
        isWritable: true,
      },
      { pubkey: params.sourceTokenAccountAddress, isWritable: true },
      { pubkey: params.assetMint },
      { pubkey: params.vaultTokenAccountAddress, isWritable: true },
      { pubkey: tokenProgramId },
    ],
  });
}

export function buildDepositReserveCapitalTx(params: {
  contributor: PublicKeyish;
  healthPlanAddress: PublicKeyish;
  reserveDomainAddress: PublicKeyish;
  fundingLineAddress: PublicKeyish;
  assetMint: PublicKeyish;
  sourceTokenAccountAddress: PublicKeyish;
  vaultTokenAccountAddress: PublicKeyish;
  tokenProgramId?: PublicKeyish | null;
  recentBlockhash: string;
  amount: bigint;
  termsHashHex?: string | null;
}): Transaction {
  const contributor = toPublicKey(params.contributor);
  const tokenProgramId = classicTokenProgramId(params.tokenProgramId);
  return buildProtocolTransactionFromInstruction({
    feePayer: contributor,
    recentBlockhash: params.recentBlockhash,
    instructionName: "deposit_reserve_capital",
    args: {
      amount: params.amount,
      terms_hash: Array.from(hexToFixedBytes(normalizeOptionalHex32(params.termsHashHex), 32)),
    },
    accounts: [
      { pubkey: contributor, isSigner: true, isWritable: true },
      { pubkey: params.healthPlanAddress },
      {
        pubkey: deriveDomainAssetVaultPda({
          reserveDomain: params.reserveDomainAddress,
          assetMint: params.assetMint,
        }),
        isWritable: true,
      },
      {
        pubkey: deriveDomainAssetLedgerPda({
          reserveDomain: params.reserveDomainAddress,
          assetMint: params.assetMint,
        }),
        isWritable: true,
      },
      { pubkey: params.fundingLineAddress, isWritable: true },
      {
        pubkey: deriveCapitalContributionPda({
          fundingLine: params.fundingLineAddress,
          contributor,
        }),
        isWritable: true,
      },
      {
        pubkey: deriveFundingLineLedgerPda({
          fundingLine: params.fundingLineAddress,
          assetMint: params.assetMint,
        }),
        isWritable: true,
      },
      {
        pubkey: derivePlanReserveLedgerPda({
          healthPlan: params.healthPlanAddress,
          assetMint: params.assetMint,
        }),
        isWritable: true,
      },
      { pubkey: params.sourceTokenAccountAddress, isWritable: true },
      { pubkey: params.assetMint },
      { pubkey: params.vaultTokenAccountAddress, isWritable: true },
      { pubkey: tokenProgramId },
      { pubkey: SystemProgram.programId },
    ],
  });
}

export function buildReturnReserveCapitalTx(params: {
  authority: PublicKeyish;
  contributorAddress: PublicKeyish;
  healthPlanAddress: PublicKeyish;
  reserveDomainAddress: PublicKeyish;
  fundingLineAddress: PublicKeyish;
  assetMint: PublicKeyish;
  vaultTokenAccountAddress: PublicKeyish;
  recipientTokenAccountAddress: PublicKeyish;
  tokenProgramId?: PublicKeyish | null;
  recentBlockhash: string;
  amount: bigint;
  reasonHashHex?: string | null;
}): Transaction {
  const authority = toPublicKey(params.authority);
  const tokenProgramId = classicTokenProgramId(params.tokenProgramId);
  return buildProtocolTransactionFromInstruction({
    feePayer: authority,
    recentBlockhash: params.recentBlockhash,
    instructionName: "return_reserve_capital",
    args: {
      amount: params.amount,
      reason_hash: Array.from(hexToFixedBytes(normalizeOptionalHex32(params.reasonHashHex), 32)),
    },
    accounts: [
      { pubkey: authority, isSigner: true },
      { pubkey: params.healthPlanAddress },
      {
        pubkey: deriveDomainAssetVaultPda({
          reserveDomain: params.reserveDomainAddress,
          assetMint: params.assetMint,
        }),
        isWritable: true,
      },
      {
        pubkey: deriveDomainAssetLedgerPda({
          reserveDomain: params.reserveDomainAddress,
          assetMint: params.assetMint,
        }),
        isWritable: true,
      },
      { pubkey: params.fundingLineAddress, isWritable: true },
      {
        pubkey: deriveCapitalContributionPda({
          fundingLine: params.fundingLineAddress,
          contributor: params.contributorAddress,
        }),
        isWritable: true,
      },
      {
        pubkey: deriveFundingLineLedgerPda({
          fundingLine: params.fundingLineAddress,
          assetMint: params.assetMint,
        }),
        isWritable: true,
      },
      {
        pubkey: derivePlanReserveLedgerPda({
          healthPlan: params.healthPlanAddress,
          assetMint: params.assetMint,
        }),
        isWritable: true,
      },
      { pubkey: params.assetMint },
      { pubkey: params.vaultTokenAccountAddress, isWritable: true },
      { pubkey: params.recipientTokenAccountAddress, isWritable: true },
      { pubkey: tokenProgramId },
    ],
  });
}

export function buildRecordReserveEarningsTx(params: {
  authority: PublicKeyish;
  healthPlanAddress: PublicKeyish;
  reserveDomainAddress: PublicKeyish;
  fundingLineAddress: PublicKeyish;
  assetMint: PublicKeyish;
  sourceTokenAccountAddress: PublicKeyish;
  vaultTokenAccountAddress: PublicKeyish;
  tokenProgramId?: PublicKeyish | null;
  recentBlockhash: string;
  amount: bigint;
  earningsRefHashHex: string;
}): Transaction {
  const authority = toPublicKey(params.authority);
  const earningsRefHashHex = normalizeHex32(params.earningsRefHashHex);
  if (!isNonZeroHashHex(earningsRefHashHex)) {
    throw new Error("earningsRefHashHex must be a nonzero 32-byte hex string.");
  }
  const tokenProgramId = classicTokenProgramId(params.tokenProgramId);
  return buildProtocolTransactionFromInstruction({
    feePayer: authority,
    recentBlockhash: params.recentBlockhash,
    instructionName: "record_reserve_earnings",
    args: {
      amount: params.amount,
      earnings_ref_hash: Array.from(hexToFixedBytes(earningsRefHashHex, 32)),
    },
    accounts: [
      { pubkey: authority, isSigner: true },
      { pubkey: params.healthPlanAddress },
      {
        pubkey: deriveDomainAssetVaultPda({
          reserveDomain: params.reserveDomainAddress,
          assetMint: params.assetMint,
        }),
        isWritable: true,
      },
      {
        pubkey: deriveDomainAssetLedgerPda({
          reserveDomain: params.reserveDomainAddress,
          assetMint: params.assetMint,
        }),
        isWritable: true,
      },
      { pubkey: params.fundingLineAddress, isWritable: true },
      {
        pubkey: deriveFundingLineLedgerPda({
          fundingLine: params.fundingLineAddress,
          assetMint: params.assetMint,
        }),
        isWritable: true,
      },
      {
        pubkey: derivePlanReserveLedgerPda({
          healthPlan: params.healthPlanAddress,
          assetMint: params.assetMint,
        }),
        isWritable: true,
      },
      { pubkey: params.sourceTokenAccountAddress, isWritable: true },
      { pubkey: params.assetMint },
      { pubkey: params.vaultTokenAccountAddress, isWritable: true },
      { pubkey: tokenProgramId },
    ],
  });
}

export function buildCreateObligationTx(params: {
  authority: PublicKeyish;
  healthPlanAddress: PublicKeyish;
  reserveDomainAddress: PublicKeyish;
  fundingLineAddress: PublicKeyish;
  assetMint: PublicKeyish;
  recentBlockhash: string;
  obligationId: string;
  policySeriesAddress?: PublicKeyish | null;
  memberWalletAddress?: PublicKeyish | null;
  beneficiaryAddress?: PublicKeyish | null;
  claimCaseAddress?: PublicKeyish | null;
  liquidityPoolAddress?: PublicKeyish | null;
  capitalClassAddress?: PublicKeyish | null;
  allocationPositionAddress?: PublicKeyish | null;
  deliveryMode: number;
  amount: bigint;
  creationReasonHashHex?: string | null;
  poolAssetMint?: PublicKeyish | null;
}): Transaction {
  const authority = toPublicKey(params.authority);
  const obligation = deriveObligationPda({
    fundingLine: params.fundingLineAddress,
    obligationId: params.obligationId,
  });
  return buildProtocolTransactionFromInstruction({
    feePayer: authority,
    recentBlockhash: params.recentBlockhash,
    instructionName: "create_obligation",
    args: {
      obligation_id: params.obligationId,
      asset_mint: toPublicKey(params.assetMint),
      policy_series: toPublicKey(params.policySeriesAddress ?? ZERO_PUBKEY_KEY),
      member_wallet: toPublicKey(params.memberWalletAddress ?? ZERO_PUBKEY_KEY),
      beneficiary: toPublicKey(params.beneficiaryAddress ?? ZERO_PUBKEY_KEY),
      claim_case: toPublicKey(params.claimCaseAddress ?? ZERO_PUBKEY_KEY),
      delivery_mode: params.deliveryMode,
      amount: params.amount,
      creation_reason_hash: Array.from(hexToFixedBytes(normalizeOptionalHex32(params.creationReasonHashHex), 32)),
    },
    accounts: [
      { pubkey: authority, isSigner: true, isWritable: true },
      { pubkey: params.healthPlanAddress },
      {
        pubkey: deriveDomainAssetLedgerPda({
          reserveDomain: params.reserveDomainAddress,
          assetMint: params.assetMint,
        }),
        isWritable: true,
      },
      { pubkey: params.fundingLineAddress, isWritable: true },
      {
        pubkey: deriveFundingLineLedgerPda({
          fundingLine: params.fundingLineAddress,
          assetMint: params.assetMint,
        }),
        isWritable: true,
      },
      {
        pubkey: derivePlanReserveLedgerPda({
          healthPlan: params.healthPlanAddress,
          assetMint: params.assetMint,
        }),
        isWritable: true,
      },
      { pubkey: obligation, isWritable: true },
      { pubkey: SystemProgram.programId },
    ],
  });
}

export function buildOpenClaimCaseTx(params: {
  authority: PublicKeyish;
  healthPlanAddress: PublicKeyish;
  memberPositionAddress?: PublicKeyish | null;
  fundingLineAddress: PublicKeyish;
  recentBlockhash: string;
  claimId: string;
  policySeriesAddress?: PublicKeyish | null;
  claimantAddress?: PublicKeyish | null;
  evidenceRefHashHex?: string | null;
}): Transaction {
  const authority = toPublicKey(params.authority);
  const claimCase = deriveClaimCasePda({
    healthPlan: params.healthPlanAddress,
    claimId: params.claimId,
  });
  return buildProtocolTransactionFromInstruction({
    feePayer: authority,
    recentBlockhash: params.recentBlockhash,
    instructionName: "open_claim_case",
    args: {
      claim_id: params.claimId,
      policy_series: toPublicKey(params.policySeriesAddress ?? ZERO_PUBKEY_KEY),
      claimant: toPublicKey(params.claimantAddress ?? authority),
      evidence_ref_hash: Array.from(hexToFixedBytes(normalizeOptionalHex32(params.evidenceRefHashHex), 32)),
    },
    accounts: [
      { pubkey: authority, isSigner: true, isWritable: true },
      { pubkey: params.healthPlanAddress },
      { pubkey: params.fundingLineAddress },
      { pubkey: claimCase, isWritable: true },
      { pubkey: SystemProgram.programId },
    ],
  });
}

export function buildAdjudicateClaimCaseTx(params: {
  authority: PublicKeyish;
  healthPlanAddress: PublicKeyish;
  claimCaseAddress: PublicKeyish;
  recentBlockhash: string;
  reviewState: number;
  approvedAmount: bigint;
  deniedAmount: bigint;
  reserveAmount: bigint;
  evidenceRefHashHex?: string | null;
  decisionSupportHashHex?: string | null;
  obligationAddress?: PublicKeyish | null;
}): Transaction {
  const authority = toPublicKey(params.authority);
  const requiresProof = params.approvedAmount > 0n || params.reserveAmount > 0n;
  if (requiresProof && (!params.evidenceRefHashHex || !params.decisionSupportHashHex)) {
    throw new Error("claim proof fingerprints are required for money-moving adjudication");
  }
  return buildProtocolTransactionFromInstruction({
    feePayer: authority,
    recentBlockhash: params.recentBlockhash,
    instructionName: "adjudicate_claim_case",
    args: {
      review_state: params.reviewState,
      approved_amount: params.approvedAmount,
      denied_amount: params.deniedAmount,
      reserve_amount: params.reserveAmount,
      evidence_ref_hash: Array.from(hexToFixedBytes(normalizeOptionalHex32(params.evidenceRefHashHex), 32)),
      decision_support_hash: Array.from(hexToFixedBytes(normalizeOptionalHex32(params.decisionSupportHashHex), 32)),
    },
    accounts: [
      { pubkey: authority, isSigner: true },
      { pubkey: params.healthPlanAddress },
      { pubkey: params.claimCaseAddress, isWritable: true },
      optionalProtocolAccount(params.obligationAddress, true),
    ],
  });
}

function buildObligationFlowTx(params: {
  instructionName: "reserve_obligation" | "release_reserve" | "settle_obligation";
  authority: PublicKeyish;
  healthPlanAddress: PublicKeyish;
  reserveDomainAddress: PublicKeyish;
  fundingLineAddress: PublicKeyish;
  assetMint: PublicKeyish;
  obligationAddress: PublicKeyish;
  recentBlockhash: string;
  claimCaseAddress?: PublicKeyish | null;
  policySeriesAddress?: PublicKeyish | null;
  capitalClassAddress?: PublicKeyish | null;
  allocationPositionAddress?: PublicKeyish | null;
  poolAssetMint?: PublicKeyish | null;
  memberPositionAddress?: PublicKeyish | null;
  vaultTokenAccountAddress?: PublicKeyish | null;
  recipientTokenAccountAddress?: PublicKeyish | null;
  tokenProgramId?: PublicKeyish | null;
  args: Record<string, unknown>;
  includeVault?: boolean;
}): Transaction {
  const authority = toPublicKey(params.authority);
  const includeSettlementOutflow = Boolean(
    params.vaultTokenAccountAddress
      && params.recipientTokenAccountAddress,
  );
  const settlementOutflowAccounts: ProtocolInstructionAccountInput[] =
    params.instructionName === "settle_obligation"
      ? includeSettlementOutflow
        ? [
          { pubkey: params.assetMint },
          { pubkey: params.vaultTokenAccountAddress, isWritable: true },
          { pubkey: params.recipientTokenAccountAddress, isWritable: true },
          { pubkey: classicTokenProgramId(params.tokenProgramId) },
        ]
        : [
          optionalProtocolAccount(undefined),
          optionalProtocolAccount(undefined),
          optionalProtocolAccount(undefined),
          optionalProtocolAccount(undefined),
        ]
      : [];
  return buildProtocolTransactionFromInstruction({
    feePayer: authority,
    recentBlockhash: params.recentBlockhash,
    instructionName: params.instructionName,
    args: params.args,
    accounts: [
      { pubkey: authority, isSigner: true },
      { pubkey: params.healthPlanAddress },
      ...(params.includeVault ? [{
        pubkey: deriveDomainAssetVaultPda({
          reserveDomain: params.reserveDomainAddress,
          assetMint: params.assetMint,
        }),
        isWritable: true,
      }] : []),
      {
        pubkey: deriveDomainAssetLedgerPda({
          reserveDomain: params.reserveDomainAddress,
          assetMint: params.assetMint,
        }),
        isWritable: true,
      },
      { pubkey: params.fundingLineAddress, isWritable: true },
      {
        pubkey: deriveFundingLineLedgerPda({
          fundingLine: params.fundingLineAddress,
          assetMint: params.assetMint,
        }),
        isWritable: true,
      },
      {
        pubkey: derivePlanReserveLedgerPda({
          healthPlan: params.healthPlanAddress,
          assetMint: params.assetMint,
        }),
        isWritable: true,
      },
      { pubkey: params.obligationAddress, isWritable: true },
      optionalProtocolAccount(params.claimCaseAddress, true),
      ...settlementOutflowAccounts,
    ],
  });
}

export function buildReserveObligationTx(params: {
  authority: PublicKeyish;
  healthPlanAddress: PublicKeyish;
  reserveDomainAddress: PublicKeyish;
  fundingLineAddress: PublicKeyish;
  assetMint: PublicKeyish;
  obligationAddress: PublicKeyish;
  recentBlockhash: string;
  amount: bigint;
  claimCaseAddress?: PublicKeyish | null;
  policySeriesAddress?: PublicKeyish | null;
  capitalClassAddress?: PublicKeyish | null;
  allocationPositionAddress?: PublicKeyish | null;
  poolAssetMint?: PublicKeyish | null;
}): Transaction {
  return buildObligationFlowTx({
    ...params,
    instructionName: "reserve_obligation",
    args: { amount: params.amount },
  });
}

export function buildReleaseReserveTx(params: {
  authority: PublicKeyish;
  healthPlanAddress: PublicKeyish;
  reserveDomainAddress: PublicKeyish;
  fundingLineAddress: PublicKeyish;
  assetMint: PublicKeyish;
  obligationAddress: PublicKeyish;
  recentBlockhash: string;
  amount: bigint;
  claimCaseAddress?: PublicKeyish | null;
  policySeriesAddress?: PublicKeyish | null;
  capitalClassAddress?: PublicKeyish | null;
  allocationPositionAddress?: PublicKeyish | null;
  poolAssetMint?: PublicKeyish | null;
}): Transaction {
  return buildObligationFlowTx({
    ...params,
    instructionName: "release_reserve",
    args: { amount: params.amount },
  });
}

export function buildSettleObligationTx(params: {
  authority: PublicKeyish;
  healthPlanAddress: PublicKeyish;
  reserveDomainAddress: PublicKeyish;
  fundingLineAddress: PublicKeyish;
  assetMint: PublicKeyish;
  obligationAddress: PublicKeyish;
  recentBlockhash: string;
  nextStatus: number;
  amount: bigint;
  settlementReasonHashHex?: string | null;
  claimCaseAddress?: PublicKeyish | null;
  policySeriesAddress?: PublicKeyish | null;
  capitalClassAddress?: PublicKeyish | null;
  allocationPositionAddress?: PublicKeyish | null;
  poolAssetMint?: PublicKeyish | null;
  memberPositionAddress?: PublicKeyish | null;
  vaultTokenAccountAddress?: PublicKeyish | null;
  recipientTokenAccountAddress?: PublicKeyish | null;
  tokenProgramId?: PublicKeyish | null;
}): Transaction {
  return buildObligationFlowTx({
    ...params,
    instructionName: "settle_obligation",
    includeVault: true,
    args: {
      next_status: params.nextStatus,
      amount: params.amount,
      settlement_reason_hash: Array.from(hexToFixedBytes(normalizeOptionalHex32(params.settlementReasonHashHex), 32)),
    },
  });
}

export function buildSettleClaimCaseTx(params: {
  authority: PublicKeyish;
  healthPlanAddress: PublicKeyish;
  reserveDomainAddress: PublicKeyish;
  fundingLineAddress: PublicKeyish;
  assetMint: PublicKeyish;
  claimCaseAddress: PublicKeyish;
  recentBlockhash: string;
  amount: bigint;
  policySeriesAddress?: PublicKeyish | null;
  obligationAddress?: PublicKeyish | null;
  capitalClassAddress?: PublicKeyish | null;
  allocationPositionAddress?: PublicKeyish | null;
  poolAssetMint?: PublicKeyish | null;
  memberPositionAddress?: PublicKeyish | null;
  vaultTokenAccountAddress?: PublicKeyish | null;
  recipientTokenAccountAddress?: PublicKeyish | null;
  tokenProgramId?: PublicKeyish | null;
}): Transaction {
  const authority = toPublicKey(params.authority);
  const tokenProgramId = classicTokenProgramId(params.tokenProgramId);
  return buildProtocolTransactionFromInstruction({
    feePayer: authority,
    recentBlockhash: params.recentBlockhash,
    instructionName: "settle_claim_case",
    args: { amount: params.amount },
    accounts: [
      { pubkey: authority, isSigner: true },
      { pubkey: params.healthPlanAddress },
      {
        pubkey: deriveDomainAssetVaultPda({
          reserveDomain: params.reserveDomainAddress,
          assetMint: params.assetMint,
        }),
        isWritable: true,
      },
      {
        pubkey: deriveDomainAssetLedgerPda({
          reserveDomain: params.reserveDomainAddress,
          assetMint: params.assetMint,
        }),
        isWritable: true,
      },
      { pubkey: params.fundingLineAddress, isWritable: true },
      {
        pubkey: deriveFundingLineLedgerPda({
          fundingLine: params.fundingLineAddress,
          assetMint: params.assetMint,
        }),
        isWritable: true,
      },
      {
        pubkey: derivePlanReserveLedgerPda({
          healthPlan: params.healthPlanAddress,
          assetMint: params.assetMint,
        }),
        isWritable: true,
      },
      { pubkey: params.claimCaseAddress, isWritable: true },
      optionalProtocolAccount(params.obligationAddress, true),
      { pubkey: params.assetMint },
      optionalProtocolAccount(params.vaultTokenAccountAddress, true),
      optionalProtocolAccount(params.recipientTokenAccountAddress, true),
      { pubkey: params.vaultTokenAccountAddress && params.recipientTokenAccountAddress ? tokenProgramId : getProgramId() },
    ],
  });
}


export {
  PROTOCOL_ACCOUNT_DISCRIMINATORS,
  PROTOCOL_INSTRUCTION_ACCOUNTS,
  PROTOCOL_INSTRUCTION_DISCRIMINATORS,
  PROTOCOL_PROGRAM_ID,
};
