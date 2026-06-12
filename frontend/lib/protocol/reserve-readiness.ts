// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  FUNDING_LINE_STATUS_OPEN,
  OBLIGATION_STATUS_CANCELED,
  OBLIGATION_STATUS_CLAIMABLE_PAYABLE,
  OBLIGATION_STATUS_RECOVERED,
  OBLIGATION_STATUS_RESERVED,
  OBLIGATION_STATUS_SETTLED,
} from "./constants";
import { normalizeAddress } from "./address";
import type {
  BigNumberish,
  ClaimFundingReadiness,
  ClaimFundingReadinessInput,
  ClaimFundingReadinessOtherReserveAsset,
  ClaimFundingReadinessState,
  FundingLineSnapshot,
  MixedReserveWaterfallModel,
  MixedReserveWaterfallRail,
  ObligationSnapshot,
  PartialReserveBalanceSheet,
  ProtocolConsoleSnapshot,
  PublicKeyish,
  ReserveAssetRailSnapshot,
  ReserveBalanceSheet,
} from "./types";

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

function ceilDivBigInt(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= 0n) return 0n;
  return numerator === 0n ? 0n : ((numerator - 1n) / denominator) + 1n;
}

function usd1e8ToAmountRaw(params: {
  usd1e8: bigint;
  rail: ReserveAssetRailSnapshot | null | undefined;
  decimals: number;
  nowTs: number;
}): bigint | null {
  if (!freshRailPrice(params.rail, params.nowTs)) return null;
  const price = toBigIntAmount(params.rail?.lastPriceUsd1e8);
  if (price <= 0n) return null;
  const decimalFactor = 10n ** BigInt(clampDecimals(params.decimals));
  return ceilDivBigInt(params.usd1e8 * decimalFactor, price);
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
        "Non-preferred reserve asset; it can only settle claims when the router selects this asset and the payout rail is enabled with a fresh price.",
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
        selectedForPayout: false,
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
  const eligibleSelectedAsset = shortfallUsd1e8 === null
    ? null
    : otherReserveAssets
      .filter((asset) =>
        asset.payoutEnabled
        && asset.priceFresh
        && asset.haircutAdjustedValueUsd1e8 !== null
        && asset.haircutAdjustedValueUsd1e8 >= shortfallUsd1e8,
      )
      .sort((left, right) => {
        const priorityDelta = left.payoutPriority - right.payoutPriority;
        if (priorityDelta !== 0) return priorityDelta;
        const leftValue = left.haircutAdjustedValueUsd1e8 ?? 0n;
        const rightValue = right.haircutAdjustedValueUsd1e8 ?? 0n;
        return rightValue > leftValue ? 1 : rightValue < leftValue ? -1 : 0;
      })[0] ?? null;
  const estimatedSelectedPayoutAmountRaw = eligibleSelectedAsset && shortfallUsd1e8 !== null
    ? usd1e8ToAmountRaw({
      usd1e8: shortfallUsd1e8,
      rail: railsByMint.get(eligibleSelectedAsset.assetMint) ?? null,
      decimals: clampDecimals(params.assetDecimalsByMint?.[eligibleSelectedAsset.assetMint]),
      nowTs,
    })
    : null;
  const otherReserveAssetsWithSelection = otherReserveAssets.map((asset) => ({
    ...asset,
    selectedForPayout: eligibleSelectedAsset?.assetMint === asset.assetMint,
  }));
  const selectedPayoutAsset = eligibleSelectedAsset
    ? otherReserveAssetsWithSelection.find((asset) => asset.assetMint === eligibleSelectedAsset.assetMint) ?? null
    : null;

  if (shortfallAmount > 0n) {
    warnings.push("Settlement-mint capacity is below the requested amount.");
  }
  if (otherReserveAssets.some((asset) => asset.freeAmountRaw > 0n)) {
    warnings.push("Other reserve assets do not increase preferred settlement-mint capacity; they require selected-asset payout or conversion before use.");
  }
  if (shortfallAmount > 0n && shortfallUsd1e8 === null && otherReserveHaircutValueUsd1e8 > 0n) {
    warnings.push("Settlement-mint shortfall cannot be compared to other assets without a fresh settlement asset price.");
  }
  if (selectedPayoutAsset) {
    warnings.push(`Selected-asset payout candidate: ${selectedPayoutAsset.assetSymbol}. This pays that token directly; it is not a swap or USDC conversion.`);
  }

  let readiness: ClaimFundingReadinessState;
  if (requestedAmount <= immediatelySettleableAmount) {
    readiness = "settle_now";
  } else if (requestedAmount <= immediatelySettleableAmount + availableLpAllocationCapacityAmount) {
    readiness = "reserve_then_settle";
  } else if (selectedPayoutAsset || (otherReserveHaircutValueUsd1e8 > 0n && (shortfallUsd1e8 === null || otherReserveHaircutValueUsd1e8 >= shortfallUsd1e8))) {
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
    otherReserveAssets: otherReserveAssetsWithSelection,
    selectedPayoutAsset,
    estimatedSelectedPayoutAmountRaw,
    readiness,
    warnings,
  };
}
