// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Single source of truth for canonical-noun definitions used across the
 * console. The `<Term>` primitive in `components/term.tsx` reads from here.
 *
 * Each entry's `learnMoreHref` should point at richer disclosure content so
 * the tooltip stays short while users still have a one-click path to depth.
 * The current public disclosure routes are `/coverage/technical-terms` and
 * `/coverage/risk-disclosures`; reuse them rather than introducing parallel
 * definitions in component copy.
 */

export type GlossaryEntry = {
  /** Stable lookup key. PascalCase mirrors the protocol noun. */
  key: GlossaryKey;
  /** User-visible noun phrase as it appears in body copy. */
  label: string;
  /** Single-sentence definition shown in the tooltip head. */
  shortDefinition: string;
  /** Optional richer paragraph for the tooltip body. */
  longDefinition?: string;
  /** Optional path/URL pointing at fuller disclosure context. */
  learnMoreHref?: string;
};

export type GlossaryKey =
  | "ReserveDomain"
  | "DomainAssetVault"
  | "HealthPlan"
  | "PolicySeries"
  | "FundingLine"
  | "ClaimCase"
  | "Obligation"
  | "LiquidityPool"
  | "CapitalClass"
  | "AllocationPosition"
  | "Oracle"
  | "Reserve";

const TECHNICAL_TERMS_HREF = "/coverage/technical-terms";

const ENTRIES: Record<GlossaryKey, GlossaryEntry> = {
  ReserveDomain: {
    key: "ReserveDomain",
    label: "reserve domain",
    shortDefinition:
      "A hard custody and legal-segregation boundary. Capital inside one domain cannot be used to settle obligations in another.",
    learnMoreHref: TECHNICAL_TERMS_HREF,
  },
  DomainAssetVault: {
    key: "DomainAssetVault",
    label: "domain asset vault",
    shortDefinition:
      "Token custody account scoped to a single reserve domain and asset mint. The on-chain home for posted premiums, sponsor funds, and LP capital.",
    learnMoreHref: TECHNICAL_TERMS_HREF,
  },
  HealthPlan: {
    key: "HealthPlan",
    label: "health plan",
    shortDefinition:
      "The sponsor-side root that owns members, liabilities, and claims administration for one coverage program.",
    learnMoreHref: TECHNICAL_TERMS_HREF,
  },
  PolicySeries: {
    key: "PolicySeries",
    label: "policy series",
    shortDefinition:
      "A versioned product lane under a health plan — one set of terms, premiums, and reserve lanes that members can buy into.",
    learnMoreHref: TECHNICAL_TERMS_HREF,
  },
  FundingLine: {
    key: "FundingLine",
    label: "funding line",
    shortDefinition:
      "A plan-side funding source. Sponsor budgets, posted premiums, LP allocations, and backstops are kept as separate funding lines, not pooled.",
    learnMoreHref: TECHNICAL_TERMS_HREF,
  },
  ClaimCase: {
    key: "ClaimCase",
    label: "claim case",
    shortDefinition:
      "An explicit on-chain adjudication lifecycle for a material claim — intake, evidence, attestation, settlement, and any dispute or impairment.",
    learnMoreHref: TECHNICAL_TERMS_HREF,
  },
  Obligation: {
    key: "Obligation",
    label: "obligation",
    shortDefinition:
      "The canonical liability unit. One reserved or settled commitment against the reserve, attributed to a plan, series, and funding line.",
    learnMoreHref: TECHNICAL_TERMS_HREF,
  },
  LiquidityPool: {
    key: "LiquidityPool",
    label: "liquidity pool",
    shortDefinition:
      "An LP-facing capital sleeve. Holds investor capital that can be allocated into health-plan funding lines under controlled redemption rules.",
    learnMoreHref: TECHNICAL_TERMS_HREF,
  },
  CapitalClass: {
    key: "CapitalClass",
    label: "capital class",
    shortDefinition:
      "An investor instrument inside a liquidity pool. Defines deposit eligibility, redemption rights, yield posture, and impairment order for one sleeve of capital.",
    learnMoreHref: TECHNICAL_TERMS_HREF,
  },
  AllocationPosition: {
    key: "AllocationPosition",
    label: "allocation position",
    shortDefinition:
      "The explicit bridge between a capital sleeve and a plan-side funding line. Tracks how much pool capital is committed to a specific liability, with attribution preserved.",
    learnMoreHref: TECHNICAL_TERMS_HREF,
  },
  Oracle: {
    key: "Oracle",
    label: "oracle",
    shortDefinition:
      "An external attester that produces normalized outcome events the protocol consumes. Genesis Protect's Phase 0 oracle is operator-mediated; future series may add additional attesters.",
    learnMoreHref: TECHNICAL_TERMS_HREF,
  },
  Reserve: {
    key: "Reserve",
    label: "reserve",
    shortDefinition:
      "Posted, claims-paying capital. Only posted premiums, posted sponsor or backstop funds, and posted LP capital count as reserve — prediction-market or off-chain numbers do not.",
    learnMoreHref: TECHNICAL_TERMS_HREF,
  },
};

export function getGlossaryEntry(key: GlossaryKey): GlossaryEntry {
  return ENTRIES[key];
}

export function listGlossaryEntries(): GlossaryEntry[] {
  return Object.values(ENTRIES);
}
