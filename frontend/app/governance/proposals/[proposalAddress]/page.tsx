// SPDX-License-Identifier: AGPL-3.0-or-later

import Link from "next/link";
import { PublicKey } from "@solana/web3.js";
import { Landmark } from "lucide-react";

import { GovernanceProposalDetailPanel } from "@/components/governance-proposal-detail-panel";
import { Hero } from "@/components/hero";

type GovernanceProposalPageProps = {
  params: { proposalAddress: string };
};

function normalize(value: string): string {
  return decodeURIComponent(value).trim();
}

export default function GovernanceProposalPage({ params }: GovernanceProposalPageProps) {
  const proposalAddress = normalize(params.proposalAddress);

  try {
    new PublicKey(proposalAddress);
  } catch {
    return (
      <div className="space-y-4">
        <section className="surface-card">
          <h1 className="hero-title">Invalid Proposal Address</h1>
          <p className="field-error">`{proposalAddress}` is not a valid Solana public key.</p>
          <Link href="/governance" className="secondary-button mt-3 inline-flex w-fit">
            Back to governance
          </Link>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Hero
        title="Proposal"
        subtitle="Review proposal metadata, inspect inserted transactions, cast a vote, or execute approved governance actions."
        icon={Landmark}
      />

      <GovernanceProposalDetailPanel
        proposalAddress={proposalAddress}
        sectionMode="page"
      />
    </div>
  );
}
