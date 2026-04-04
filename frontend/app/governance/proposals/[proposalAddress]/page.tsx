// SPDX-License-Identifier: AGPL-3.0-or-later

import { shortenAddress } from "@/lib/protocol";

export default function GovernanceProposalPage({
  params,
}: {
  params: { proposalAddress: string };
}) {
  return (
    <div className="rounded-[2rem] border border-white/10 bg-slate-950/40 p-8">
      <p className="text-xs uppercase tracking-[0.22em] text-fuchsia-200/70">Proposal detail</p>
      <h2 className="mt-3 text-3xl font-semibold">{shortenAddress(params.proposalAddress, 8)}</h2>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
        Proposal detail pages remain available for governance integrations, but proposals should now map to scoped
        controls rather than broad undifferentiated mutability.
      </p>
    </div>
  );
}
