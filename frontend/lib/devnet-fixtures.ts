// SPDX-License-Identifier: AGPL-3.0-or-later

export type DevnetFixtureRole =
  | "observer"
  | "governance_authority"
  | "pool_authority"
  | "pool_operator"
  | "risk_manager"
  | "compliance_authority"
  | "guardian"
  | "oracle_signer"
  | "oracle_admin"
  | "member"
  | "claim_delegate"
  | "capital_provider";

export type DevnetFixtureWallet = {
  role: DevnetFixtureRole;
  label: string;
  address: string;
  envVar?: string;
};

export type DevnetFixturePaymentRail = {
  label: string;
  mint: string;
  envVar?: string;
};

export type DevnetFixturePolicySeries = {
  label: string;
  address: string;
  seriesRefHashHex: string;
  paymentMint: string;
  envVar?: string;
};

export type DevnetFixtureOracleStake = {
  stakeMint: string;
  stakeVault: string;
  stakePosition: string;
  slashTreasuryTokenAccount: string;
};

export type DevnetFixtureCoverageClaimCase = {
  label: string;
  claimAddress: string;
  member: string;
  claimant: string;
  seriesRefHashHex: string;
  intentHashHex: string;
};

export type DevnetFixtureRedemptionCase = {
  label: string;
  requestAddress: string;
  redeemer: string;
  payoutMint: string;
};

export type DevnetRoleActionRow = {
  role: DevnetFixtureRole;
  actions: string[];
};

export type DevnetFixtureConfig = {
  network: "devnet";
  governanceRealm: string;
  governanceConfig: string;
  rewardPayoutMint: string;
  insurancePayoutMint: string;
  tokenGateMint: string;
  defaultPoolAddress: string;
  requiredOracleAddress: string;
  wallets: DevnetFixtureWallet[];
  paymentRails: DevnetFixturePaymentRail[];
  policySeries: DevnetFixturePolicySeries[];
  oracleStake: DevnetFixtureOracleStake;
  claimCases: DevnetFixtureCoverageClaimCase[];
  redemptionCases: DevnetFixtureRedemptionCase[];
  roleMatrix: DevnetRoleActionRow[];
};

const UNSET = "11111111111111111111111111111111";
export const DEVNET_NATIVE_SOL_RAIL = "SOL";

function env(name: string): string {
  return process.env[name]?.trim() || UNSET;
}

export const DEVNET_FIXTURES: DevnetFixtureConfig = {
  network: "devnet",
  governanceRealm: env("NEXT_PUBLIC_GOVERNANCE_REALM"),
  governanceConfig: env("NEXT_PUBLIC_GOVERNANCE_CONFIG"),
  rewardPayoutMint: env("NEXT_PUBLIC_DEFAULT_REWARD_PAYOUT_MINT"),
  insurancePayoutMint: env("NEXT_PUBLIC_DEFAULT_INSURANCE_PAYOUT_MINT"),
  tokenGateMint: env("NEXT_PUBLIC_DEFAULT_TOKEN_GATE_MINT"),
  defaultPoolAddress: env("NEXT_PUBLIC_DEFAULT_POOL_ADDRESS"),
  requiredOracleAddress: env("NEXT_PUBLIC_REQUIRED_ORACLE_ADDRESS") !== UNSET
    ? env("NEXT_PUBLIC_REQUIRED_ORACLE_ADDRESS")
    : env("NEXT_PUBLIC_REQUIRED_BUSINESS_ORACLE_ADDRESS") !== UNSET
      ? env("NEXT_PUBLIC_REQUIRED_BUSINESS_ORACLE_ADDRESS")
      : env("NEXT_PUBLIC_DEFAULT_ORACLE_ADDRESS"),
  wallets: [
    { role: "observer", label: "Observer wallet", address: env("NEXT_PUBLIC_DEVNET_OBSERVER_WALLET"), envVar: "NEXT_PUBLIC_DEVNET_OBSERVER_WALLET" },
    { role: "governance_authority", label: "Governance authority", address: env("NEXT_PUBLIC_DEVNET_GOVERNANCE_WALLET"), envVar: "NEXT_PUBLIC_DEVNET_GOVERNANCE_WALLET" },
    { role: "pool_authority", label: "Pool authority", address: env("NEXT_PUBLIC_DEVNET_POOL_AUTHORITY_WALLET"), envVar: "NEXT_PUBLIC_DEVNET_POOL_AUTHORITY_WALLET" },
    { role: "pool_operator", label: "Pool operator", address: env("NEXT_PUBLIC_DEVNET_POOL_OPERATOR_WALLET"), envVar: "NEXT_PUBLIC_DEVNET_POOL_OPERATOR_WALLET" },
    { role: "risk_manager", label: "Risk manager", address: env("NEXT_PUBLIC_DEVNET_RISK_MANAGER_WALLET"), envVar: "NEXT_PUBLIC_DEVNET_RISK_MANAGER_WALLET" },
    { role: "compliance_authority", label: "Compliance authority", address: env("NEXT_PUBLIC_DEVNET_COMPLIANCE_WALLET"), envVar: "NEXT_PUBLIC_DEVNET_COMPLIANCE_WALLET" },
    { role: "guardian", label: "Guardian", address: env("NEXT_PUBLIC_DEVNET_GUARDIAN_WALLET"), envVar: "NEXT_PUBLIC_DEVNET_GUARDIAN_WALLET" },
    { role: "oracle_signer", label: "Oracle signer", address: env("NEXT_PUBLIC_DEVNET_ORACLE_SIGNER_WALLET"), envVar: "NEXT_PUBLIC_DEVNET_ORACLE_SIGNER_WALLET" },
    { role: "oracle_admin", label: "Oracle admin", address: env("NEXT_PUBLIC_DEVNET_ORACLE_ADMIN_WALLET"), envVar: "NEXT_PUBLIC_DEVNET_ORACLE_ADMIN_WALLET" },
    { role: "member", label: "Member wallet", address: env("NEXT_PUBLIC_DEVNET_MEMBER_WALLET"), envVar: "NEXT_PUBLIC_DEVNET_MEMBER_WALLET" },
    { role: "claim_delegate", label: "Claim delegate", address: env("NEXT_PUBLIC_DEVNET_CLAIM_DELEGATE_WALLET"), envVar: "NEXT_PUBLIC_DEVNET_CLAIM_DELEGATE_WALLET" },
    { role: "capital_provider", label: "Capital provider", address: env("NEXT_PUBLIC_DEVNET_CAPITAL_PROVIDER_WALLET"), envVar: "NEXT_PUBLIC_DEVNET_CAPITAL_PROVIDER_WALLET" },
  ],
  paymentRails: [
    {
      label: "SOL premium rail",
      mint: env("NEXT_PUBLIC_DEVNET_PAYMENT_RAIL_SOL"),
      envVar: "NEXT_PUBLIC_DEVNET_PAYMENT_RAIL_SOL",
    },
    { label: "Reward SPL rail", mint: env("NEXT_PUBLIC_DEVNET_PAYMENT_RAIL_REWARD_SPL"), envVar: "NEXT_PUBLIC_DEVNET_PAYMENT_RAIL_REWARD_SPL" },
    { label: "Coverage SPL rail", mint: env("NEXT_PUBLIC_DEVNET_PAYMENT_RAIL_COVERAGE_SPL"), envVar: "NEXT_PUBLIC_DEVNET_PAYMENT_RAIL_COVERAGE_SPL" },
  ],
  policySeries: [
    {
      label: "Primary coverage series",
      address: env("NEXT_PUBLIC_DEVNET_POLICY_SERIES_PRIMARY"),
      seriesRefHashHex: env("NEXT_PUBLIC_DEVNET_POLICY_SERIES_PRIMARY_REF_HASH"),
      paymentMint: env("NEXT_PUBLIC_DEVNET_PAYMENT_RAIL_COVERAGE_SPL"),
      envVar: "NEXT_PUBLIC_DEVNET_POLICY_SERIES_PRIMARY",
    },
    {
      label: "Member rewards series",
      address: env("NEXT_PUBLIC_DEVNET_POLICY_SERIES_REWARDS"),
      seriesRefHashHex: env("NEXT_PUBLIC_DEVNET_POLICY_SERIES_REWARDS_REF_HASH"),
      paymentMint: env("NEXT_PUBLIC_DEVNET_PAYMENT_RAIL_REWARD_SPL"),
      envVar: "NEXT_PUBLIC_DEVNET_POLICY_SERIES_REWARDS",
    },
  ],
  oracleStake: {
    stakeMint: env("NEXT_PUBLIC_DEVNET_STAKE_MINT"),
    stakeVault: env("NEXT_PUBLIC_DEVNET_STAKE_VAULT"),
    stakePosition: env("NEXT_PUBLIC_DEVNET_STAKE_POSITION"),
    slashTreasuryTokenAccount: env("NEXT_PUBLIC_DEVNET_SLASH_TREASURY_TOKEN_ACCOUNT"),
  },
  claimCases: [
    {
      label: "Primary claim case",
      claimAddress: env("NEXT_PUBLIC_DEVNET_CLAIM_CASE_PRIMARY"),
      member: env("NEXT_PUBLIC_DEVNET_MEMBER_WALLET"),
      claimant: env("NEXT_PUBLIC_DEVNET_CLAIM_DELEGATE_WALLET"),
      seriesRefHashHex: env("NEXT_PUBLIC_DEVNET_POLICY_SERIES_PRIMARY_REF_HASH"),
      intentHashHex: env("NEXT_PUBLIC_DEVNET_CLAIM_CASE_PRIMARY_INTENT_HASH"),
    },
  ],
  redemptionCases: [
    {
      label: "Primary redemption request",
      requestAddress: env("NEXT_PUBLIC_DEVNET_REDEMPTION_REQUEST_PRIMARY"),
      redeemer: env("NEXT_PUBLIC_DEVNET_CAPITAL_PROVIDER_WALLET"),
      payoutMint: env("NEXT_PUBLIC_DEVNET_PAYMENT_RAIL_COVERAGE_SPL"),
    },
  ],
  roleMatrix: [
    { role: "observer", actions: ["view workspace state"] },
    { role: "governance_authority", actions: ["governance params", "slash oracle", "resolve disputes", "withdraw fees"] },
    { role: "pool_authority", actions: ["pool controls", "liquidity queue", "coverage claims", "oracle approvals"] },
    { role: "pool_operator", actions: ["issue positions", "review claims", "schedule redemptions"] },
    { role: "risk_manager", actions: ["adjudicate claims", "risk controls", "queue failures"] },
    { role: "compliance_authority", actions: ["compliance policy", "claim review"] },
    { role: "guardian", actions: ["claim review", "dispute open"] },
    { role: "oracle_signer", actions: ["stake", "vote", "settle cycles"] },
    { role: "oracle_admin", actions: ["metadata update", "profile maintenance"] },
    { role: "member", actions: ["subscribe", "pay premium", "submit claims"] },
    { role: "claim_delegate", actions: ["submit claims", "activate cycles"] },
    { role: "capital_provider", actions: ["deposit", "request redemption", "view queue"] },
  ],
};

export function configuredDevnetWallets(): DevnetFixtureWallet[] {
  return DEVNET_FIXTURES.wallets.filter((wallet) => wallet.address !== UNSET);
}

export function configuredDevnetPaymentRails(): DevnetFixturePaymentRail[] {
  return DEVNET_FIXTURES.paymentRails.filter((rail) => isFixtureConfigured(rail.mint));
}

export function configuredDevnetPolicySeries(): DevnetFixturePolicySeries[] {
  return DEVNET_FIXTURES.policySeries.filter((series) => series.address !== UNSET && series.seriesRefHashHex !== UNSET);
}

export function configuredDevnetClaimCases(): DevnetFixtureCoverageClaimCase[] {
  return DEVNET_FIXTURES.claimCases.filter((claimCase) => claimCase.claimAddress !== UNSET);
}

export function configuredDevnetRedemptionCases(): DevnetFixtureRedemptionCase[] {
  return DEVNET_FIXTURES.redemptionCases.filter((redemptionCase) => redemptionCase.requestAddress !== UNSET);
}

export function isFixtureConfigured(value: string | null | undefined): boolean {
  const normalized = value?.trim() || "";
  if (!normalized || normalized === UNSET) {
    return false;
  }
  return normalized.toUpperCase() === DEVNET_NATIVE_SOL_RAIL || normalized.length > 0;
}
