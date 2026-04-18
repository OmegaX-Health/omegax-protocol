// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  GENESIS_PROTECT_ACUTE_PLAN_METADATA_URI,
  GENESIS_PROTECT_ACUTE_RISK_DISCLOSURE_PATH,
  GENESIS_PROTECT_ACUTE_RISK_DISCLOSURE_URL,
  GENESIS_PROTECT_ACUTE_SKUS,
  GENESIS_PROTECT_ACUTE_TECHNICAL_TERMS_PATH,
  GENESIS_PROTECT_ACUTE_TECHNICAL_TERMS_URL,
} from "@/lib/genesis-protect-acute";

export const GENESIS_PROTECT_DOCS_PACK_URL = "https://docs.omegax.health/docs/coverage/genesis-protect-acute";
export const GENESIS_PROTECT_STATUS_URL = "https://docs.omegax.health/docs/coverage/genesis-protect-status";
export const GENESIS_PROTECT_FAQ_URL = "https://docs.omegax.health/docs/coverage/genesis-protect-faq";
export const GENESIS_PROTECT_TRUST_URL =
  "https://docs.omegax.health/docs/oracle/genesis-claims-trust-and-disputes";
export const GENESIS_PROTECT_RESERVE_URL =
  "https://docs.omegax.health/docs/markets/genesis-reserve-lanes-and-capital-classes";

export type GenesisProtectDisclosureSection = {
  eyebrow: string;
  title: string;
  copy: string;
  bullets?: string[];
  facts?: Array<{
    label: string;
    value: string;
  }>;
};

export type GenesisProtectDisclosurePageContent = {
  path: string;
  canonicalUrl: string;
  title: string;
  description: string;
  heroEyebrow: string;
  heroTitle: string;
  heroSubtitle: string;
  statusLabel: string;
  sections: GenesisProtectDisclosureSection[];
};

const sharedLaunchFacts = [
  {
    label: "Launch posture",
    value: "Bounded end-of-month mainnet target, not broadly live insurance today.",
  },
  {
    label: "Trust phase",
    value: "Phase 0 operator-backed claim review with later AI and decentralized steps framed as roadmap.",
  },
  {
    label: "Retail posture",
    value: "Retail-open and sponsor-configured cohort issuance are both allowed in v1.",
  },
  {
    label: "Metadata anchor",
    value: GENESIS_PROTECT_ACUTE_PLAN_METADATA_URI,
  },
] as const;

export const GENESIS_PROTECT_DISCLOSURE_PAGES: Record<"technicalTerms" | "riskDisclosures", GenesisProtectDisclosurePageContent> = {
  technicalTerms: {
    path: GENESIS_PROTECT_ACUTE_TECHNICAL_TERMS_PATH,
    canonicalUrl: GENESIS_PROTECT_ACUTE_TECHNICAL_TERMS_URL,
    title: "Genesis Protect Acute Technical Terms",
    description:
      "Public technical terms for the bounded Genesis Protect Acute launch, including Travel 30, Event 7, reserve lanes, trust phase, and commercial-layer separation.",
    heroEyebrow: "Genesis Protect Acute",
    heroTitle: "Technical terms for the bounded launch surface",
    heroSubtitle:
      "These terms back the public metadata used by the current Genesis Protect Acute protection series. They describe the live public posture without implying broader already-live insurance or fully decentralized review.",
    statusLabel: "Phase 0 public terms",
    sections: [
      {
        eyebrow: "Launch posture",
        title: "One launch story",
        copy:
          "Genesis Protect Acute remains a bounded acute emergency travel protection launch. Travel 30 is the primary launch SKU, Event 7 is the fast demo SKU, and both series stay inside the same end-of-month mainnet target rather than a broad always-live insurance claim.",
        facts: [...sharedLaunchFacts],
      },
      {
        eyebrow: "Series posture",
        title: "Current live-series declarations",
        copy:
          "Every live Genesis series should stay readable from public metadata alone: whether it is retail-open or sponsor-configured, whether it is fixed-only or hybrid fixed plus top-up, what trust phase is live, and which reserve lanes are intended to support claims.",
        facts: [
          {
            label: GENESIS_PROTECT_ACUTE_SKUS.travel30.displayName,
            value: "30-day cover window, hybrid fixed plus reimbursement top-up, premium plus liquidity reserve lanes.",
          },
          {
            label: GENESIS_PROTECT_ACUTE_SKUS.event7.displayName,
            value: "7-day cover window, fixed-benefit-only, premium plus sponsor plus liquidity reserve lanes.",
          },
          {
            label: "Retail and sponsor posture",
            value: "Retail-open remains allowed in v1. Sponsor-configured cohorts can also issue when the published terms allow it.",
          },
        ],
      },
      {
        eyebrow: "Commercial layers",
        title: "Membership and protection are separate",
        copy:
          "OmegaX Health app membership and Genesis Protect premiums remain two separate economic layers. Membership pays for the app experience and AI health support. The protection premium is the per-window charge that activates Travel 30 or Event 7 eligibility in the protocol.",
        bullets: [
          "Membership does not itself activate coverage.",
          "Protection premiums contribute to reserve economics; app membership does not.",
          "Sponsor funding can support protection without collapsing the distinction between membership and protection premium.",
        ],
      },
      {
        eyebrow: "Claims trust",
        title: "How claims are checked today",
        copy:
          "The launch trust model is intentionally explicit. Phase 0 claim review is operator-backed through OmegaX Health. Evidence packets, review artifacts, attestation, and dispute state can exist without pretending that Phase 1 AI recommendation or later decentralized review is already the current live truth.",
        bullets: [
          "Raw medical evidence remains offchain.",
          "Structured claim review and attestation write into the protocol path.",
          "Low-confidence or incomplete evidence can be held for operator review before final approval or denial.",
        ],
      },
      {
        eyebrow: "Reserve lanes",
        title: "What counts as claims-paying reserve",
        copy:
          "Genesis Protect Acute does not use a black-box pooled solvency story. Only posted premiums, posted sponsor or backstop funds, and posted LP capital count as claims-paying reserve for the current public launch wording.",
        bullets: [
          "Travel 30 keeps premium and liquidity lanes only.",
          "Event 7 keeps premium, sponsor, and liquidity lanes.",
          "Queue pressure, impairment order, and issuance pauses remain part of the public explanation when reserve posture is stressed.",
        ],
      },
      {
        eyebrow: "Linked references",
        title: "Reference pack",
        copy:
          "These technical terms are one entry point, not the whole Genesis pack. Use the linked docs pages for the full product, status, trust, reserve, and FAQ context.",
        facts: [
          { label: "Product page", value: GENESIS_PROTECT_DOCS_PACK_URL },
          { label: "Status page", value: GENESIS_PROTECT_STATUS_URL },
          { label: "Trust explainer", value: GENESIS_PROTECT_TRUST_URL },
          { label: "Reserve explainer", value: GENESIS_PROTECT_RESERVE_URL },
          { label: "FAQ", value: GENESIS_PROTECT_FAQ_URL },
        ],
      },
    ],
  },
  riskDisclosures: {
    path: GENESIS_PROTECT_ACUTE_RISK_DISCLOSURE_PATH,
    canonicalUrl: GENESIS_PROTECT_ACUTE_RISK_DISCLOSURE_URL,
    title: "Genesis Protect Acute Risk Disclosures",
    description:
      "Public Genesis Protect Acute risk disclosures for the current bounded launch, including reserve, claim review, waiting period, payout, and queue-stress caveats.",
    heroEyebrow: "Genesis Protect Acute",
    heroTitle: "Risk disclosures for the current public launch",
    heroSubtitle:
      "These disclosures are intentionally narrower than a full legal policy pack. They exist to keep the current public metadata and launch copy honest about what is live, what is bounded, and what can still pause, hold, or fail under stress.",
    statusLabel: "Launch-risk disclosure",
    sections: [
      {
        eyebrow: "Launch boundary",
        title: "Bounded, not broad",
        copy:
          "Genesis Protect Acute is not described here as broadly live insurance today. The launch remains bounded to the current Event 7 and Travel 30 acute emergency travel products, with public messaging tied to the current end-of-month mainnet target and Phase 0 operator-backed review.",
        bullets: [
          "Do not read this launch as a promise of broad always-open global insurance availability.",
          "Do not read roadmap language about AI or decentralized review as current live fact.",
          "Retail-open issuance and sponsor-configured cohorts can both exist, but each live series still needs explicit public posture and reserve support.",
        ],
      },
      {
        eyebrow: "Claim review risk",
        title: "Claims can be held, challenged, or denied",
        copy:
          "Claims are not guaranteed to auto-pay. Genesis Protect Phase 0 can hold or dispute a claim when evidence is incomplete, confidence is low, waiting-period rules are not met, exclusions apply, or reserve/control posture requires additional operator review.",
        bullets: [
          "A hold is not the same thing as final denial.",
          "Disputes and appeals can remain operational and partially offchain during the current launch phase.",
          "Only structured attestation and adjudication outcomes write into the onchain claim path.",
        ],
      },
      {
        eyebrow: "Coverage boundary risk",
        title: "Waiting periods and exclusions still matter",
        copy:
          "Buying coverage does not remove waiting periods, exclusions, or evidence requirements. Event 7 and Travel 30 both keep a 7-day illness wait and 24-hour accident activation rule in the current launch truth, with sponsor-configured waiver behavior only where the published cohort terms explicitly allow it.",
        bullets: [
          "Event 7 remains fixed-benefit-only.",
          "Travel 30 can add a reimbursement top-up only inside the published aggregate cap.",
          "Pre-existing, chronic, routine, elective, sanctions-excluded, fraudulent, and non-acute scenarios remain outside the marketed coverage boundary.",
        ],
      },
      {
        eyebrow: "Reserve and issuance risk",
        title: "Reserve support can tighten or pause issuance",
        copy:
          "Claims-paying reserve is limited to posted premiums, posted sponsor or backstop funds, and posted LP capital. If reserve posture, pending obligations, impairment, or queue pressure moves outside the published range, Genesis Protect can pause or restrict issuance rather than silently pretending infinite depth.",
        bullets: [
          "Travel 30 uses premium and liquidity lanes.",
          "Event 7 uses premium, sponsor, and liquidity lanes.",
          "Queue-only redemption or other stressed-capital posture can coexist with live liabilities and must stay visible to operators and public-safe surfaces.",
        ],
      },
      {
        eyebrow: "Economic separation",
        title: "Membership fees are not reserve",
        copy:
          "OmegaX Health app membership remains commercially separate from Genesis Protect premiums. Membership fees should not be interpreted as claims-paying reserve, and sponsor support should not be described as making app membership itself into protection capital.",
        bullets: [
          "App membership supports the app experience and AI health support.",
          "Protection premiums activate the per-window protection lane.",
          "Sponsor-funded cohorts can fund protection while still preserving that separation.",
        ],
      },
      {
        eyebrow: "Reference pack",
        title: "Read the full public context",
        copy:
          "Use the linked Genesis pages for the fuller public explanation of terms, status, trust, reserve, and FAQ context. These disclosures are meant to stay short, public-safe, and directly compatible with the current metadata links.",
        facts: [
          { label: "Technical terms", value: GENESIS_PROTECT_ACUTE_TECHNICAL_TERMS_URL },
          { label: "Product page", value: GENESIS_PROTECT_DOCS_PACK_URL },
          { label: "Status page", value: GENESIS_PROTECT_STATUS_URL },
          { label: "Trust explainer", value: GENESIS_PROTECT_TRUST_URL },
          { label: "Reserve explainer", value: GENESIS_PROTECT_RESERVE_URL },
        ],
      },
    ],
  },
};
