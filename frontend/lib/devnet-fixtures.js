// SPDX-License-Identifier: AGPL-3.0-or-later
import { CAPITAL_CLASS_RESTRICTION_OPEN, CAPITAL_CLASS_RESTRICTION_WRAPPER_ONLY, CLAIM_INTAKE_APPROVED, CLAIM_INTAKE_SETTLED, ELIGIBILITY_ELIGIBLE, FUNDING_LINE_STATUS_OPEN, FUNDING_LINE_TYPE_LIQUIDITY_POOL_ALLOCATION, FUNDING_LINE_TYPE_PREMIUM_INCOME, FUNDING_LINE_TYPE_SPONSOR_BUDGET, LP_QUEUE_STATUS_NONE, OBLIGATION_DELIVERY_MODE_CLAIMABLE, OBLIGATION_DELIVERY_MODE_PAYABLE, OBLIGATION_STATUS_CLAIMABLE_PAYABLE, OBLIGATION_STATUS_RESERVED, OBLIGATION_STATUS_SETTLED, REDEMPTION_POLICY_QUEUE_ONLY, SERIES_MODE_PROTECTION, SERIES_MODE_REWARD, SERIES_STATUS_ACTIVE, ZERO_PUBKEY, deriveAllocationLedgerPda, deriveAllocationPositionPda, deriveCapitalClassPda, deriveClaimCasePda, deriveDomainAssetLedgerPda, deriveDomainAssetVaultPda, deriveFundingLineLedgerPda, deriveFundingLinePda, deriveHealthPlanPda, deriveLiquidityPoolPda, deriveLpPositionPda, deriveMemberPositionPda, deriveObligationPda, derivePlanReserveLedgerPda, derivePolicySeriesPda, derivePoolClassLedgerPda, deriveReserveDomainPda, deriveSeriesReserveLedgerPda, } from "./protocol";
const UNSET = ZERO_PUBKEY;
function env(name, fallback = UNSET) {
    return String(process.env[name] ?? fallback).trim() || fallback;
}
function envPreferred(name, aliases, fallback = UNSET) {
    for (const candidate of [name, ...aliases]) {
        const value = String(process.env[candidate] ?? "").trim();
        if (value)
            return value;
    }
    return fallback;
}
const settlementMint = env("NEXT_PUBLIC_DEVNET_SETTLEMENT_MINT");
const rewardMint = env("NEXT_PUBLIC_DEVNET_REWARD_MINT", settlementMint);
const wrapperSettlementMint = env("NEXT_PUBLIC_DEVNET_WRAPPER_SETTLEMENT_MINT", settlementMint);
const openDomainId = "open-health-usdc";
const wrapperDomainId = "wrapper-health-rwa";
const openReserveDomain = deriveReserveDomainPda({ domainId: openDomainId }).toBase58();
const wrapperReserveDomain = deriveReserveDomainPda({ domainId: wrapperDomainId }).toBase58();
const openDomainAssetVault = deriveDomainAssetVaultPda({
    reserveDomain: openReserveDomain,
    assetMint: settlementMint,
}).toBase58();
const openDomainAssetLedger = deriveDomainAssetLedgerPda({
    reserveDomain: openReserveDomain,
    assetMint: settlementMint,
}).toBase58();
const wrapperDomainAssetVault = deriveDomainAssetVaultPda({
    reserveDomain: wrapperReserveDomain,
    assetMint: wrapperSettlementMint,
}).toBase58();
const wrapperDomainAssetLedger = deriveDomainAssetLedgerPda({
    reserveDomain: wrapperReserveDomain,
    assetMint: wrapperSettlementMint,
}).toBase58();
const seekerPlanId = "nexus-seeker-rewards";
const blendedPlanId = "nexus-protect-plus";
const seekerPlanAddress = deriveHealthPlanPda({
    reserveDomain: openReserveDomain,
    planId: seekerPlanId,
}).toBase58();
const blendedPlanAddress = deriveHealthPlanPda({
    reserveDomain: openReserveDomain,
    planId: blendedPlanId,
}).toBase58();
const seekerRewardSeriesAddress = derivePolicySeriesPda({
    healthPlan: seekerPlanAddress,
    seriesId: "daily-activity-rewards",
}).toBase58();
const blendedRewardSeriesAddress = derivePolicySeriesPda({
    healthPlan: blendedPlanAddress,
    seriesId: "preventive-adherence-rewards",
}).toBase58();
const blendedProtectionSeriesAddress = derivePolicySeriesPda({
    healthPlan: blendedPlanAddress,
    seriesId: "catastrophic-protection-2026",
}).toBase58();
const seekerSponsorLineAddress = deriveFundingLinePda({
    healthPlan: seekerPlanAddress,
    lineId: "seeker-sponsor-budget",
}).toBase58();
const blendedSponsorLineAddress = deriveFundingLinePda({
    healthPlan: blendedPlanAddress,
    lineId: "blended-sponsor-budget",
}).toBase58();
const blendedPremiumLineAddress = deriveFundingLinePda({
    healthPlan: blendedPlanAddress,
    lineId: "blended-member-premiums",
}).toBase58();
const blendedProtectionLiquidityLineAddress = deriveFundingLinePda({
    healthPlan: blendedPlanAddress,
    lineId: "blended-protection-liquidity",
}).toBase58();
const blendedRewardLiquidityLineAddress = deriveFundingLinePda({
    healthPlan: blendedPlanAddress,
    lineId: "blended-reward-liquidity",
}).toBase58();
const incomePoolAddress = deriveLiquidityPoolPda({
    reserveDomain: openReserveDomain,
    poolId: "omega-health-income",
}).toBase58();
const openClassAddress = deriveCapitalClassPda({
    liquidityPool: incomePoolAddress,
    classId: "open-usdc-class",
}).toBase58();
const wrapperClassAddress = deriveCapitalClassPda({
    liquidityPool: incomePoolAddress,
    classId: "wrapper-usdc-class",
}).toBase58();
const allocationRewardOpenAddress = deriveAllocationPositionPda({
    capitalClass: openClassAddress,
    fundingLine: blendedRewardLiquidityLineAddress,
}).toBase58();
const allocationProtectionOpenAddress = deriveAllocationPositionPda({
    capitalClass: openClassAddress,
    fundingLine: blendedProtectionLiquidityLineAddress,
}).toBase58();
const allocationProtectionWrapperAddress = deriveAllocationPositionPda({
    capitalClass: wrapperClassAddress,
    fundingLine: blendedProtectionLiquidityLineAddress,
}).toBase58();
// Legacy local env files from the older pool-first console used different wallet names.
// Keep those aliases readable here so stale local `.env.local` files still populate fixtures.
const observerWallet = env("NEXT_PUBLIC_DEVNET_OBSERVER_WALLET");
const protocolGovernanceWallet = envPreferred("NEXT_PUBLIC_DEVNET_PROTOCOL_GOVERNANCE_WALLET", ["NEXT_PUBLIC_DEVNET_GOVERNANCE_WALLET"]);
const domainAdminWallet = envPreferred("NEXT_PUBLIC_DEVNET_DOMAIN_ADMIN_WALLET", ["NEXT_PUBLIC_DEVNET_POOL_AUTHORITY_WALLET"]);
const planAdminWallet = envPreferred("NEXT_PUBLIC_DEVNET_PLAN_ADMIN_WALLET", ["NEXT_PUBLIC_DEVNET_POOL_OPERATOR_WALLET"]);
const sponsorOperatorWallet = envPreferred("NEXT_PUBLIC_DEVNET_SPONSOR_OPERATOR_WALLET", ["NEXT_PUBLIC_DEVNET_POOL_OPERATOR_WALLET"]);
const claimsOperatorWallet = envPreferred("NEXT_PUBLIC_DEVNET_CLAIMS_OPERATOR_WALLET", ["NEXT_PUBLIC_DEVNET_ORACLE_ADMIN_WALLET", "NEXT_PUBLIC_DEVNET_COMPLIANCE_WALLET"]);
const oracleOperatorWallet = envPreferred("NEXT_PUBLIC_DEVNET_ORACLE_OPERATOR_WALLET", ["NEXT_PUBLIC_DEVNET_ORACLE_SIGNER_WALLET"]);
const poolCuratorWallet = envPreferred("NEXT_PUBLIC_DEVNET_POOL_CURATOR_WALLET", ["NEXT_PUBLIC_DEVNET_COMPLIANCE_WALLET"]);
const poolAllocatorWallet = envPreferred("NEXT_PUBLIC_DEVNET_POOL_ALLOCATOR_WALLET", ["NEXT_PUBLIC_DEVNET_RISK_MANAGER_WALLET"]);
const poolSentinelWallet = envPreferred("NEXT_PUBLIC_DEVNET_POOL_SENTINEL_WALLET", ["NEXT_PUBLIC_DEVNET_GUARDIAN_WALLET"]);
const memberWallet = env("NEXT_PUBLIC_DEVNET_MEMBER_WALLET");
const memberDelegateWallet = envPreferred("NEXT_PUBLIC_DEVNET_MEMBER_DELEGATE_WALLET", ["NEXT_PUBLIC_DEVNET_CLAIM_DELEGATE_WALLET"]);
const secondMemberWallet = envPreferred("NEXT_PUBLIC_DEVNET_SECOND_MEMBER_WALLET", ["NEXT_PUBLIC_DEVNET_MEMBER_DELEGATE_WALLET", "NEXT_PUBLIC_DEVNET_CLAIM_DELEGATE_WALLET"], memberDelegateWallet);
const lpProviderWallet = envPreferred("NEXT_PUBLIC_DEVNET_LP_PROVIDER_WALLET", ["NEXT_PUBLIC_DEVNET_CAPITAL_PROVIDER_WALLET"]);
const wrapperProviderWallet = envPreferred("NEXT_PUBLIC_DEVNET_WRAPPER_PROVIDER_WALLET", ["NEXT_PUBLIC_DEVNET_CAPITAL_PROVIDER_WALLET"]);
const seekerMemberPosition = deriveMemberPositionPda({
    healthPlan: seekerPlanAddress,
    wallet: memberWallet,
    seriesScope: seekerRewardSeriesAddress,
}).toBase58();
const blendedRewardMemberPosition = deriveMemberPositionPda({
    healthPlan: blendedPlanAddress,
    wallet: memberWallet,
    seriesScope: blendedRewardSeriesAddress,
}).toBase58();
const blendedProtectionMemberPosition = deriveMemberPositionPda({
    healthPlan: blendedPlanAddress,
    wallet: secondMemberWallet,
    seriesScope: blendedProtectionSeriesAddress,
}).toBase58();
const claimCaseReserveAddress = deriveClaimCasePda({
    healthPlan: blendedPlanAddress,
    claimId: "claim-protect-001",
}).toBase58();
const claimCaseSettledAddress = deriveClaimCasePda({
    healthPlan: blendedPlanAddress,
    claimId: "claim-protect-002",
}).toBase58();
const seekerSettledObligation = deriveObligationPda({
    fundingLine: seekerSponsorLineAddress,
    obligationId: "reward-obligation-001",
}).toBase58();
const seekerClaimableObligation = deriveObligationPda({
    fundingLine: seekerSponsorLineAddress,
    obligationId: "reward-obligation-002",
}).toBase58();
const blendedRewardReservedObligation = deriveObligationPda({
    fundingLine: blendedSponsorLineAddress,
    obligationId: "blended-reward-obligation-001",
}).toBase58();
const blendedProtectionReservedObligation = deriveObligationPda({
    fundingLine: blendedProtectionLiquidityLineAddress,
    obligationId: "protection-obligation-001",
}).toBase58();
const blendedProtectionSettledObligation = deriveObligationPda({
    fundingLine: blendedProtectionLiquidityLineAddress,
    obligationId: "protection-obligation-002",
}).toBase58();
export const DEVNET_PROTOCOL_FIXTURE_STATE = {
    network: "devnet",
    settlementMint,
    rewardMint,
    wrapperSettlementMint,
    reserveDomains: [
        {
            address: openReserveDomain,
            domainId: openDomainId,
            displayName: "Open onchain reserve domain",
            settlementMode: 0,
            active: true,
            pauseFlags: 0,
        },
        {
            address: wrapperReserveDomain,
            domainId: wrapperDomainId,
            displayName: "Wrapper-mediated reserve domain",
            settlementMode: 1,
            active: true,
            pauseFlags: 0,
        },
    ],
    domainAssetVaults: [
        {
            address: openDomainAssetVault,
            reserveDomain: openReserveDomain,
            assetMint: settlementMint,
            sheet: { funded: 2050000n },
        },
        {
            address: wrapperDomainAssetVault,
            reserveDomain: wrapperReserveDomain,
            assetMint: wrapperSettlementMint,
            sheet: { funded: 400000n, restricted: 400000n },
        },
    ],
    domainAssetLedgers: [
        {
            address: openDomainAssetLedger,
            reserveDomain: openReserveDomain,
            assetMint: settlementMint,
            sheet: {
                funded: 2050000n,
                allocated: 1150000n,
                reserved: 230000n,
                claimable: 8000n,
                payable: 50000n,
                settled: 72000n,
            },
        },
        {
            address: wrapperDomainAssetLedger,
            reserveDomain: wrapperReserveDomain,
            assetMint: wrapperSettlementMint,
            sheet: {
                funded: 400000n,
                reserved: 60000n,
                restricted: 400000n,
            },
        },
    ],
    healthPlans: [
        {
            address: seekerPlanAddress,
            reserveDomain: openReserveDomain,
            planId: seekerPlanId,
            displayName: "Nexus Seeker Rewards",
            sponsorLabel: "Seeker Sponsor",
            planAdmin: planAdminWallet,
            sponsorOperator: sponsorOperatorWallet,
            claimsOperator: claimsOperatorWallet,
            membershipModel: "sponsor-invite",
            pauseFlags: 0,
            active: true,
        },
        {
            address: blendedPlanAddress,
            reserveDomain: openReserveDomain,
            planId: blendedPlanId,
            displayName: "Nexus Protect Plus",
            sponsorLabel: "Protect Plus Sponsor",
            planAdmin: planAdminWallet,
            sponsorOperator: sponsorOperatorWallet,
            claimsOperator: claimsOperatorWallet,
            membershipModel: "open-with-claims-operator",
            pauseFlags: 0,
            active: true,
        },
    ],
    policySeries: [
        {
            address: seekerRewardSeriesAddress,
            healthPlan: seekerPlanAddress,
            seriesId: "daily-activity-rewards",
            displayName: "Daily Activity Rewards",
            mode: SERIES_MODE_REWARD,
            status: SERIES_STATUS_ACTIVE,
            assetMint: rewardMint,
            termsVersion: "v2026.1",
            comparabilityKey: "activity-rewards-core",
        },
        {
            address: blendedRewardSeriesAddress,
            healthPlan: blendedPlanAddress,
            seriesId: "preventive-adherence-rewards",
            displayName: "Preventive Adherence Rewards",
            mode: SERIES_MODE_REWARD,
            status: SERIES_STATUS_ACTIVE,
            assetMint: rewardMint,
            termsVersion: "v2026.1",
            comparabilityKey: "preventive-adherence",
        },
        {
            address: blendedProtectionSeriesAddress,
            healthPlan: blendedPlanAddress,
            seriesId: "catastrophic-protection-2026",
            displayName: "Catastrophic Protection",
            mode: SERIES_MODE_PROTECTION,
            status: SERIES_STATUS_ACTIVE,
            assetMint: settlementMint,
            termsVersion: "v2026.1",
            comparabilityKey: "catastrophic-protection",
        },
    ],
    memberPositions: [
        {
            address: seekerMemberPosition,
            wallet: memberWallet,
            healthPlan: seekerPlanAddress,
            policySeries: seekerRewardSeriesAddress,
            eligibilityStatus: ELIGIBILITY_ELIGIBLE,
            delegatedRights: ["claim_reward", "view_payout_history"],
            active: true,
        },
        {
            address: blendedRewardMemberPosition,
            wallet: memberWallet,
            healthPlan: blendedPlanAddress,
            policySeries: blendedRewardSeriesAddress,
            eligibilityStatus: ELIGIBILITY_ELIGIBLE,
            delegatedRights: ["claim_reward"],
            active: true,
        },
        {
            address: blendedProtectionMemberPosition,
            wallet: secondMemberWallet,
            healthPlan: blendedPlanAddress,
            policySeries: blendedProtectionSeriesAddress,
            eligibilityStatus: ELIGIBILITY_ELIGIBLE,
            delegatedRights: ["submit_claim", "appoint_delegate"],
            active: true,
        },
    ],
    fundingLines: [
        {
            address: seekerSponsorLineAddress,
            reserveDomain: openReserveDomain,
            healthPlan: seekerPlanAddress,
            policySeries: seekerRewardSeriesAddress,
            assetMint: rewardMint,
            lineId: "seeker-sponsor-budget",
            displayName: "Seeker sponsor budget",
            lineType: FUNDING_LINE_TYPE_SPONSOR_BUDGET,
            fundingPriority: 0,
            fundedAmount: 250000n,
            reservedAmount: 14000n,
            spentAmount: 28000n,
            releasedAmount: 0n,
            returnedAmount: 0n,
            status: FUNDING_LINE_STATUS_OPEN,
            sheet: { funded: 250000n, reserved: 14000n, claimable: 8000n, settled: 20000n, owed: 22000n },
        },
        {
            address: blendedSponsorLineAddress,
            reserveDomain: openReserveDomain,
            healthPlan: blendedPlanAddress,
            policySeries: blendedRewardSeriesAddress,
            assetMint: rewardMint,
            lineId: "blended-sponsor-budget",
            displayName: "Blended sponsor budget",
            lineType: FUNDING_LINE_TYPE_SPONSOR_BUDGET,
            fundingPriority: 0,
            fundedAmount: 120000n,
            reservedAmount: 6000n,
            spentAmount: 12000n,
            releasedAmount: 0n,
            returnedAmount: 0n,
            status: FUNDING_LINE_STATUS_OPEN,
            sheet: { funded: 120000n, reserved: 6000n, settled: 12000n, owed: 6000n },
        },
        {
            address: blendedPremiumLineAddress,
            reserveDomain: openReserveDomain,
            healthPlan: blendedPlanAddress,
            policySeries: blendedProtectionSeriesAddress,
            assetMint: settlementMint,
            lineId: "blended-member-premiums",
            displayName: "Blended member premiums",
            lineType: FUNDING_LINE_TYPE_PREMIUM_INCOME,
            fundingPriority: 1,
            fundedAmount: 480000n,
            reservedAmount: 35000n,
            spentAmount: 25000n,
            releasedAmount: 0n,
            returnedAmount: 0n,
            status: FUNDING_LINE_STATUS_OPEN,
            sheet: { funded: 480000n, reserved: 35000n, settled: 25000n, owed: 35000n },
        },
        {
            address: blendedProtectionLiquidityLineAddress,
            reserveDomain: openReserveDomain,
            healthPlan: blendedPlanAddress,
            policySeries: blendedProtectionSeriesAddress,
            assetMint: settlementMint,
            lineId: "blended-protection-liquidity",
            displayName: "Protection liquidity line",
            lineType: FUNDING_LINE_TYPE_LIQUIDITY_POOL_ALLOCATION,
            fundingPriority: 2,
            fundedAmount: 1000000n,
            reservedAmount: 210000n,
            spentAmount: 40000n,
            releasedAmount: 0n,
            returnedAmount: 0n,
            status: FUNDING_LINE_STATUS_OPEN,
            sheet: { funded: 1000000n, allocated: 1000000n, reserved: 210000n, payable: 50000n, settled: 40000n, owed: 260000n },
        },
        {
            address: blendedRewardLiquidityLineAddress,
            reserveDomain: openReserveDomain,
            healthPlan: blendedPlanAddress,
            policySeries: blendedRewardSeriesAddress,
            assetMint: rewardMint,
            lineId: "blended-reward-liquidity",
            displayName: "Reward liquidity line",
            lineType: FUNDING_LINE_TYPE_LIQUIDITY_POOL_ALLOCATION,
            fundingPriority: 3,
            fundedAmount: 150000n,
            reservedAmount: 20000n,
            spentAmount: 0n,
            releasedAmount: 0n,
            returnedAmount: 0n,
            status: FUNDING_LINE_STATUS_OPEN,
            sheet: { funded: 150000n, allocated: 150000n, reserved: 20000n, owed: 20000n },
        },
    ],
    planReserveLedgers: [
        {
            address: derivePlanReserveLedgerPda({ healthPlan: seekerPlanAddress, assetMint: rewardMint }).toBase58(),
            reserveDomain: openReserveDomain,
            assetMint: rewardMint,
            sheet: { funded: 250000n, reserved: 14000n, claimable: 8000n, settled: 20000n, owed: 22000n },
        },
        {
            address: derivePlanReserveLedgerPda({ healthPlan: blendedPlanAddress, assetMint: settlementMint }).toBase58(),
            reserveDomain: openReserveDomain,
            assetMint: settlementMint,
            sheet: { funded: 1480000n, allocated: 1000000n, reserved: 245000n, payable: 50000n, settled: 65000n, owed: 295000n },
        },
    ],
    seriesReserveLedgers: [
        {
            address: deriveSeriesReserveLedgerPda({ policySeries: seekerRewardSeriesAddress, assetMint: rewardMint }).toBase58(),
            reserveDomain: openReserveDomain,
            assetMint: rewardMint,
            sheet: { funded: 250000n, reserved: 14000n, claimable: 8000n, settled: 20000n, owed: 22000n },
        },
        {
            address: deriveSeriesReserveLedgerPda({ policySeries: blendedRewardSeriesAddress, assetMint: rewardMint }).toBase58(),
            reserveDomain: openReserveDomain,
            assetMint: rewardMint,
            sheet: { funded: 270000n, allocated: 150000n, reserved: 26000n, settled: 12000n, owed: 26000n },
        },
        {
            address: deriveSeriesReserveLedgerPda({ policySeries: blendedProtectionSeriesAddress, assetMint: settlementMint }).toBase58(),
            reserveDomain: openReserveDomain,
            assetMint: settlementMint,
            sheet: { funded: 1480000n, allocated: 1000000n, reserved: 245000n, payable: 50000n, settled: 65000n, owed: 295000n },
        },
    ],
    fundingLineLedgers: [
        {
            address: deriveFundingLineLedgerPda({ fundingLine: seekerSponsorLineAddress, assetMint: rewardMint }).toBase58(),
            reserveDomain: openReserveDomain,
            assetMint: rewardMint,
            sheet: { funded: 250000n, reserved: 14000n, claimable: 8000n, settled: 20000n, owed: 22000n },
        },
        {
            address: deriveFundingLineLedgerPda({ fundingLine: blendedSponsorLineAddress, assetMint: rewardMint }).toBase58(),
            reserveDomain: openReserveDomain,
            assetMint: rewardMint,
            sheet: { funded: 120000n, reserved: 6000n, settled: 12000n, owed: 6000n },
        },
        {
            address: deriveFundingLineLedgerPda({ fundingLine: blendedPremiumLineAddress, assetMint: settlementMint }).toBase58(),
            reserveDomain: openReserveDomain,
            assetMint: settlementMint,
            sheet: { funded: 480000n, reserved: 35000n, settled: 25000n, owed: 35000n },
        },
        {
            address: deriveFundingLineLedgerPda({ fundingLine: blendedProtectionLiquidityLineAddress, assetMint: settlementMint }).toBase58(),
            reserveDomain: openReserveDomain,
            assetMint: settlementMint,
            sheet: { funded: 1000000n, allocated: 1000000n, reserved: 210000n, payable: 50000n, settled: 40000n, owed: 260000n },
        },
        {
            address: deriveFundingLineLedgerPda({ fundingLine: blendedRewardLiquidityLineAddress, assetMint: rewardMint }).toBase58(),
            reserveDomain: openReserveDomain,
            assetMint: rewardMint,
            sheet: { funded: 150000n, allocated: 150000n, reserved: 20000n, owed: 20000n },
        },
    ],
    claimCases: [
        {
            address: claimCaseReserveAddress,
            reserveDomain: openReserveDomain,
            healthPlan: blendedPlanAddress,
            policySeries: blendedProtectionSeriesAddress,
            fundingLine: blendedProtectionLiquidityLineAddress,
            memberPosition: blendedProtectionMemberPosition,
            claimant: secondMemberWallet,
            claimId: "claim-protect-001",
            intakeStatus: CLAIM_INTAKE_APPROVED,
            approvedAmount: 90000n,
            deniedAmount: 0n,
            paidAmount: 40000n,
            reservedAmount: 50000n,
            linkedObligation: blendedProtectionReservedObligation,
        },
        {
            address: claimCaseSettledAddress,
            reserveDomain: openReserveDomain,
            healthPlan: blendedPlanAddress,
            policySeries: blendedProtectionSeriesAddress,
            fundingLine: blendedProtectionLiquidityLineAddress,
            memberPosition: blendedProtectionMemberPosition,
            claimant: secondMemberWallet,
            claimId: "claim-protect-002",
            intakeStatus: CLAIM_INTAKE_SETTLED,
            approvedAmount: 25000n,
            deniedAmount: 0n,
            paidAmount: 25000n,
            reservedAmount: 0n,
            linkedObligation: blendedProtectionSettledObligation,
        },
    ],
    obligations: [
        {
            address: seekerSettledObligation,
            reserveDomain: openReserveDomain,
            assetMint: rewardMint,
            healthPlan: seekerPlanAddress,
            policySeries: seekerRewardSeriesAddress,
            memberWallet,
            beneficiary: memberWallet,
            fundingLine: seekerSponsorLineAddress,
            obligationId: "reward-obligation-001",
            status: OBLIGATION_STATUS_SETTLED,
            deliveryMode: OBLIGATION_DELIVERY_MODE_CLAIMABLE,
            principalAmount: 20000n,
            outstandingAmount: 0n,
            reservedAmount: 0n,
            claimableAmount: 0n,
            payableAmount: 0n,
            settledAmount: 20000n,
            impairedAmount: 0n,
            recoveredAmount: 0n,
        },
        {
            address: seekerClaimableObligation,
            reserveDomain: openReserveDomain,
            assetMint: rewardMint,
            healthPlan: seekerPlanAddress,
            policySeries: seekerRewardSeriesAddress,
            memberWallet,
            beneficiary: memberWallet,
            fundingLine: seekerSponsorLineAddress,
            obligationId: "reward-obligation-002",
            status: OBLIGATION_STATUS_CLAIMABLE_PAYABLE,
            deliveryMode: OBLIGATION_DELIVERY_MODE_CLAIMABLE,
            principalAmount: 8000n,
            outstandingAmount: 8000n,
            reservedAmount: 0n,
            claimableAmount: 8000n,
            payableAmount: 0n,
            settledAmount: 0n,
            impairedAmount: 0n,
            recoveredAmount: 0n,
        },
        {
            address: blendedRewardReservedObligation,
            reserveDomain: openReserveDomain,
            assetMint: rewardMint,
            healthPlan: blendedPlanAddress,
            policySeries: blendedRewardSeriesAddress,
            memberWallet,
            beneficiary: memberWallet,
            fundingLine: blendedSponsorLineAddress,
            obligationId: "blended-reward-obligation-001",
            status: OBLIGATION_STATUS_RESERVED,
            deliveryMode: OBLIGATION_DELIVERY_MODE_CLAIMABLE,
            principalAmount: 6000n,
            outstandingAmount: 6000n,
            reservedAmount: 6000n,
            claimableAmount: 0n,
            payableAmount: 0n,
            settledAmount: 0n,
            impairedAmount: 0n,
            recoveredAmount: 0n,
        },
        {
            address: blendedProtectionReservedObligation,
            reserveDomain: openReserveDomain,
            assetMint: settlementMint,
            healthPlan: blendedPlanAddress,
            policySeries: blendedProtectionSeriesAddress,
            memberWallet: secondMemberWallet,
            beneficiary: secondMemberWallet,
            fundingLine: blendedProtectionLiquidityLineAddress,
            claimCase: claimCaseReserveAddress,
            liquidityPool: incomePoolAddress,
            capitalClass: openClassAddress,
            allocationPosition: allocationProtectionOpenAddress,
            obligationId: "protection-obligation-001",
            status: OBLIGATION_STATUS_CLAIMABLE_PAYABLE,
            deliveryMode: OBLIGATION_DELIVERY_MODE_PAYABLE,
            principalAmount: 90000n,
            outstandingAmount: 50000n,
            reservedAmount: 0n,
            claimableAmount: 0n,
            payableAmount: 50000n,
            settledAmount: 40000n,
            impairedAmount: 0n,
            recoveredAmount: 0n,
        },
        {
            address: blendedProtectionSettledObligation,
            reserveDomain: openReserveDomain,
            assetMint: settlementMint,
            healthPlan: blendedPlanAddress,
            policySeries: blendedProtectionSeriesAddress,
            memberWallet: secondMemberWallet,
            beneficiary: secondMemberWallet,
            fundingLine: blendedProtectionLiquidityLineAddress,
            claimCase: claimCaseSettledAddress,
            liquidityPool: incomePoolAddress,
            capitalClass: wrapperClassAddress,
            allocationPosition: allocationProtectionWrapperAddress,
            obligationId: "protection-obligation-002",
            status: OBLIGATION_STATUS_SETTLED,
            deliveryMode: OBLIGATION_DELIVERY_MODE_PAYABLE,
            principalAmount: 25000n,
            outstandingAmount: 0n,
            reservedAmount: 0n,
            claimableAmount: 0n,
            payableAmount: 0n,
            settledAmount: 25000n,
            impairedAmount: 0n,
            recoveredAmount: 0n,
        },
    ],
    liquidityPools: [
        {
            address: incomePoolAddress,
            reserveDomain: openReserveDomain,
            poolId: "omega-health-income",
            displayName: "Omega Health Income Pool",
            depositAssetMint: settlementMint,
            strategyThesis: "Diversified health liability sleeve across sponsor-supported rewards and protection reserves.",
            redemptionPolicy: REDEMPTION_POLICY_QUEUE_ONLY,
            totalValueLocked: 1900000n,
            totalAllocated: 1150000n,
            totalPendingRedemptions: 120000n,
            active: true,
        },
    ],
    capitalClasses: [
        {
            address: openClassAddress,
            liquidityPool: incomePoolAddress,
            classId: "open-usdc-class",
            displayName: "Open USDC Class",
            priority: 0,
            restrictionMode: CAPITAL_CLASS_RESTRICTION_OPEN,
            totalShares: 1500000n,
            navAssets: 1500000n,
            allocatedAssets: 900000n,
            pendingRedemptions: 120000n,
            minLockupSeconds: 604_800,
            queueOnlyRedemptions: true,
            active: true,
        },
        {
            address: wrapperClassAddress,
            liquidityPool: incomePoolAddress,
            classId: "wrapper-usdc-class",
            displayName: "Wrapper-mediated USDC Class",
            priority: 1,
            restrictionMode: CAPITAL_CLASS_RESTRICTION_WRAPPER_ONLY,
            totalShares: 400000n,
            navAssets: 400000n,
            allocatedAssets: 250000n,
            pendingRedemptions: 0n,
            minLockupSeconds: 2_592_000,
            queueOnlyRedemptions: true,
            active: true,
        },
    ],
    poolClassLedgers: [
        {
            address: derivePoolClassLedgerPda({ capitalClass: openClassAddress, assetMint: settlementMint }).toBase58(),
            capitalClass: openClassAddress,
            assetMint: settlementMint,
            sheet: {
                funded: 1500000n,
                allocated: 900000n,
                reserved: 180000n,
                pendingRedemption: 120000n,
            },
            totalShares: 1500000n,
            realizedYieldAmount: 36000n,
            realizedLossAmount: 8000n,
        },
        {
            address: derivePoolClassLedgerPda({ capitalClass: wrapperClassAddress, assetMint: settlementMint }).toBase58(),
            capitalClass: wrapperClassAddress,
            assetMint: settlementMint,
            sheet: {
                funded: 400000n,
                allocated: 250000n,
                reserved: 60000n,
                restricted: 400000n,
            },
            totalShares: 400000n,
            realizedYieldAmount: 14000n,
            realizedLossAmount: 0n,
        },
    ],
    lpPositions: [
        {
            address: deriveLpPositionPda({ capitalClass: openClassAddress, owner: lpProviderWallet }).toBase58(),
            owner: lpProviderWallet,
            capitalClass: openClassAddress,
            shares: 1500000n,
            subscriptionBasis: 1500000n,
            pendingRedemptionShares: 120000n,
            realizedDistributions: 22000n,
            impairedPrincipal: 8000n,
            credentialed: true,
            queueStatus: LP_QUEUE_STATUS_NONE,
        },
        {
            address: deriveLpPositionPda({ capitalClass: wrapperClassAddress, owner: wrapperProviderWallet }).toBase58(),
            owner: wrapperProviderWallet,
            capitalClass: wrapperClassAddress,
            shares: 400000n,
            subscriptionBasis: 400000n,
            pendingRedemptionShares: 0n,
            realizedDistributions: 10000n,
            impairedPrincipal: 0n,
            credentialed: true,
            queueStatus: LP_QUEUE_STATUS_NONE,
        },
    ],
    allocationPositions: [
        {
            address: allocationRewardOpenAddress,
            reserveDomain: openReserveDomain,
            liquidityPool: incomePoolAddress,
            capitalClass: openClassAddress,
            healthPlan: blendedPlanAddress,
            policySeries: blendedRewardSeriesAddress,
            fundingLine: blendedRewardLiquidityLineAddress,
            capAmount: 200000n,
            weightBps: 1_500,
            allocatedAmount: 150000n,
            utilizedAmount: 20000n,
            reservedCapacity: 20000n,
            realizedPnl: 6000n,
            impairedAmount: 0n,
            deallocationOnly: false,
            active: true,
        },
        {
            address: allocationProtectionOpenAddress,
            reserveDomain: openReserveDomain,
            liquidityPool: incomePoolAddress,
            capitalClass: openClassAddress,
            healthPlan: blendedPlanAddress,
            policySeries: blendedProtectionSeriesAddress,
            fundingLine: blendedProtectionLiquidityLineAddress,
            capAmount: 900000n,
            weightBps: 7_500,
            allocatedAmount: 750000n,
            utilizedAmount: 160000n,
            reservedCapacity: 160000n,
            realizedPnl: 18000n,
            impairedAmount: 8000n,
            deallocationOnly: false,
            active: true,
        },
        {
            address: allocationProtectionWrapperAddress,
            reserveDomain: openReserveDomain,
            liquidityPool: incomePoolAddress,
            capitalClass: wrapperClassAddress,
            healthPlan: blendedPlanAddress,
            policySeries: blendedProtectionSeriesAddress,
            fundingLine: blendedProtectionLiquidityLineAddress,
            capAmount: 300000n,
            weightBps: 2_500,
            allocatedAmount: 250000n,
            utilizedAmount: 60000n,
            reservedCapacity: 60000n,
            realizedPnl: 14000n,
            impairedAmount: 0n,
            deallocationOnly: false,
            active: true,
        },
    ],
    allocationLedgers: [
        {
            address: deriveAllocationLedgerPda({ allocationPosition: allocationRewardOpenAddress, assetMint: rewardMint }).toBase58(),
            allocationPosition: allocationRewardOpenAddress,
            assetMint: rewardMint,
            sheet: { funded: 150000n, allocated: 150000n, reserved: 20000n, owed: 20000n },
            realizedPnl: 6000n,
        },
        {
            address: deriveAllocationLedgerPda({ allocationPosition: allocationProtectionOpenAddress, assetMint: settlementMint }).toBase58(),
            allocationPosition: allocationProtectionOpenAddress,
            assetMint: settlementMint,
            sheet: { funded: 750000n, allocated: 750000n, reserved: 160000n, payable: 40000n, impaired: 8000n },
            realizedPnl: 18000n,
        },
        {
            address: deriveAllocationLedgerPda({ allocationPosition: allocationProtectionWrapperAddress, assetMint: settlementMint }).toBase58(),
            allocationPosition: allocationProtectionWrapperAddress,
            assetMint: settlementMint,
            sheet: { funded: 250000n, allocated: 250000n, reserved: 60000n, payable: 10000n, restricted: 250000n },
            realizedPnl: 14000n,
        },
    ],
    outcomesBySeries: {
        [seekerRewardSeriesAddress]: 1250n,
        [blendedRewardSeriesAddress]: 420n,
        [blendedProtectionSeriesAddress]: 7n,
    },
    wallets: [
        { role: "observer", label: "Observer wallet", address: observerWallet, envVar: "NEXT_PUBLIC_DEVNET_OBSERVER_WALLET" },
        { role: "protocol_governance", label: "Protocol governance", address: protocolGovernanceWallet, envVar: "NEXT_PUBLIC_DEVNET_PROTOCOL_GOVERNANCE_WALLET" },
        { role: "domain_admin", label: "Reserve domain admin", address: domainAdminWallet, envVar: "NEXT_PUBLIC_DEVNET_DOMAIN_ADMIN_WALLET" },
        { role: "plan_admin", label: "Plan admin", address: planAdminWallet, envVar: "NEXT_PUBLIC_DEVNET_PLAN_ADMIN_WALLET" },
        { role: "sponsor_operator", label: "Sponsor operator", address: sponsorOperatorWallet, envVar: "NEXT_PUBLIC_DEVNET_SPONSOR_OPERATOR_WALLET" },
        { role: "claims_operator", label: "Claims operator", address: claimsOperatorWallet, envVar: "NEXT_PUBLIC_DEVNET_CLAIMS_OPERATOR_WALLET" },
        { role: "oracle_operator", label: "Oracle operator", address: oracleOperatorWallet, envVar: "NEXT_PUBLIC_DEVNET_ORACLE_OPERATOR_WALLET" },
        { role: "pool_curator", label: "Pool curator", address: poolCuratorWallet, envVar: "NEXT_PUBLIC_DEVNET_POOL_CURATOR_WALLET" },
        { role: "pool_allocator", label: "Pool allocator", address: poolAllocatorWallet, envVar: "NEXT_PUBLIC_DEVNET_POOL_ALLOCATOR_WALLET" },
        { role: "pool_sentinel", label: "Pool sentinel", address: poolSentinelWallet, envVar: "NEXT_PUBLIC_DEVNET_POOL_SENTINEL_WALLET" },
        { role: "member", label: "Member wallet", address: memberWallet, envVar: "NEXT_PUBLIC_DEVNET_MEMBER_WALLET" },
        { role: "member_delegate", label: "Member delegate", address: secondMemberWallet, envVar: "NEXT_PUBLIC_DEVNET_MEMBER_DELEGATE_WALLET" },
        { role: "lp_provider", label: "Open LP provider", address: lpProviderWallet, envVar: "NEXT_PUBLIC_DEVNET_LP_PROVIDER_WALLET" },
        { role: "wrapper_provider", label: "Wrapper LP provider", address: wrapperProviderWallet, envVar: "NEXT_PUBLIC_DEVNET_WRAPPER_PROVIDER_WALLET" },
    ],
    paymentRails: [
        { label: "Open settlement mint", mint: settlementMint, envVar: "NEXT_PUBLIC_DEVNET_SETTLEMENT_MINT" },
        { label: "Reward settlement mint", mint: rewardMint, envVar: "NEXT_PUBLIC_DEVNET_REWARD_MINT" },
        { label: "Wrapper settlement mint", mint: wrapperSettlementMint, envVar: "NEXT_PUBLIC_DEVNET_WRAPPER_SETTLEMENT_MINT" },
    ],
    roleMatrix: [
        { role: "observer", actions: ["view reserve truth", "inspect obligations", "review pool-class NAV"] },
        { role: "protocol_governance", actions: ["protocol emergency pause", "protocol fee policy", "upgrade coordination"] },
        { role: "domain_admin", actions: ["domain rails", "wrapper controls", "hard custody segregation"] },
        { role: "plan_admin", actions: ["create plans", "version policy series", "set plan controls"] },
        { role: "sponsor_operator", actions: ["fund sponsor budgets", "record premiums", "review outcome spend"] },
        { role: "claims_operator", actions: ["open claims", "attach evidence refs", "adjudicate and settle claims"] },
        { role: "oracle_operator", actions: ["publish attestations", "supply evidence refs", "hold finality when needed"] },
        { role: "pool_curator", actions: ["define exposure thesis", "create capital classes", "set redemption policy"] },
        { role: "pool_allocator", actions: ["allocate capital", "deallocate capital", "update allocation caps"] },
        { role: "pool_sentinel", actions: ["queue-only mode", "allocation freeze", "impairment escalation"] },
        { role: "member", actions: ["hold plan rights", "claim rewards", "review payout history"] },
        { role: "member_delegate", actions: ["submit claims", "receive delegated rights", "coordinate appeals"] },
        { role: "lp_provider", actions: ["deposit capital", "request redemption", "monitor exposure mix"] },
        { role: "wrapper_provider", actions: ["hold restricted class", "follow wrapper redemption rules", "monitor ring-fenced exposure"] },
    ],
    legacyArtifactsRetired: [
        "legacy pool accounts are no longer the sponsor/member/liability root",
        "pool_type fixtures are retired in favor of HealthPlan + PolicySeries + FundingLine",
        "old redemption request fixtures remain ignored for the hard-break devnet migration",
    ],
};
export const DEVNET_FIXTURES = DEVNET_PROTOCOL_FIXTURE_STATE;
export const DEFAULT_HEALTH_PLAN_ADDRESS = seekerPlanAddress;
export const DEFAULT_LIQUIDITY_POOL_ADDRESS = incomePoolAddress;
export function configuredDevnetWallets() {
    return DEVNET_PROTOCOL_FIXTURE_STATE.wallets.filter((wallet) => wallet.address !== UNSET);
}
export function devnetFixtureWalletKey(wallet) {
    const source = wallet.envVar?.trim() || wallet.role;
    return `${source}:${wallet.address}`;
}
export function configuredDevnetPaymentRails() {
    return DEVNET_PROTOCOL_FIXTURE_STATE.paymentRails.filter((rail) => rail.mint !== UNSET);
}
export function configuredDevnetHealthPlans() {
    return [...DEVNET_PROTOCOL_FIXTURE_STATE.healthPlans];
}
export function configuredDevnetPolicySeries() {
    return [...DEVNET_PROTOCOL_FIXTURE_STATE.policySeries];
}
export function configuredDevnetLiquidityPools() {
    return [...DEVNET_PROTOCOL_FIXTURE_STATE.liquidityPools];
}
export function configuredDevnetCapitalClasses() {
    return [...DEVNET_PROTOCOL_FIXTURE_STATE.capitalClasses];
}
export function configuredDevnetClaimCases() {
    return [...DEVNET_PROTOCOL_FIXTURE_STATE.claimCases];
}
export function configuredDevnetObligations() {
    return [...DEVNET_PROTOCOL_FIXTURE_STATE.obligations];
}
export function isFixtureConfigured(value) {
    return Boolean(value && value.trim() && value !== UNSET);
}
