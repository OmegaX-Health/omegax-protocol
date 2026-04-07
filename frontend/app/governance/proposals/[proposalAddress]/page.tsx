// SPDX-License-Identifier: AGPL-3.0-or-later

import Link from "next/link";
import { notFound } from "next/navigation";
import { PublicKey } from "@solana/web3.js";

import { GovernanceProposalReadonlyPanel } from "@/components/governance-proposal-readonly-panel";
import { shortenAddress } from "@/lib/protocol";

function isValidProposalAddress(value: string): boolean {
  try {
    void new PublicKey(value);
    return true;
  } catch {
    return false;
  }
}

export default function GovernanceProposalPage({
  params,
}: {
  params: { proposalAddress: string };
}) {
  if (!isValidProposalAddress(params.proposalAddress)) {
    notFound();
  }

  return (
    <div className="protocol-page">
      <section className="protocol-hero protocol-hero-bleed">
        <div className="protocol-hero-grid">
          <div className="protocol-hero-copy">
            <p className="protocol-kicker">Governance proposal</p>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-4">
                <h1 className="protocol-title text-[clamp(1.96rem,4.3vw,3.08rem)]">
                  {shortenAddress(params.proposalAddress, 8)}
                </h1>
                <p className="protocol-lead">
                  Review the live SPL Governance proposal record, vote state, and execution queue for this proposal account.
                </p>
              </div>
            </div>
            <div className="protocol-actions">
              <Link href="/governance" className="secondary-button inline-flex">
                Back to governance
              </Link>
              <Link href="/governance?tab=queue" className="action-button inline-flex">
                Open live queue
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="protocol-section">
        <GovernanceProposalReadonlyPanel proposalAddress={params.proposalAddress} />
      </section>
    </div>
  );
}
