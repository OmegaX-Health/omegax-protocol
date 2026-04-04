// SPDX-License-Identifier: AGPL-3.0-or-later

import { buildCanonicalConsoleState } from "@/lib/console-model";
import { DEVNET_PROTOCOL_FIXTURE_STATE } from "@/lib/devnet-fixtures";
import { describeClaimStatus, describeObligationStatus, shortenAddress } from "@/lib/protocol";

export default function ClaimsPage() {
  const consoleState = buildCanonicalConsoleState();

  return (
    <div className="space-y-8">
      <section className="rounded-[2rem] border border-white/10 bg-slate-950/40 p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-200/80">Claims and obligations</p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight">Economically material claims stay visible onchain.</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
          Raw medical payloads stay offchain. ClaimCase and Obligation accounts preserve the liability lifecycle,
          reserve booking, payout state, and impairment consequences.
        </p>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        {consoleState.activeClaims.map((claim) => (
          <article key={claim.address} className="rounded-[1.8rem] border border-white/10 bg-white/5 p-6">
            <p className="text-xs uppercase tracking-[0.22em] text-amber-200/70">{describeClaimStatus(claim.intakeStatus)}</p>
            <h3 className="mt-2 text-xl font-semibold">{claim.claimId}</h3>
            <p className="mt-2 text-sm text-slate-400">
              {shortenAddress(claim.healthPlan)} · {shortenAddress(claim.policySeries ?? "")}
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4 text-sm">
                Approved ${claim.approvedAmount.toString()}
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4 text-sm">
                Paid ${claim.paidAmount?.toString() ?? "0"}
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4 text-sm">
                Reserved ${claim.reservedAmount?.toString() ?? "0"}
              </div>
            </div>
          </article>
        ))}
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
        <h3 className="text-xl font-semibold">Obligation register</h3>
        <div className="mt-4 space-y-3">
          {DEVNET_PROTOCOL_FIXTURE_STATE.obligations.map((obligation) => (
            <div key={obligation.address} className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-medium text-white">{obligation.obligationId}</p>
                  <p className="text-sm text-slate-400">{describeObligationStatus(obligation.status)}</p>
                </div>
                <div className="text-sm text-slate-300">
                  Principal ${obligation.principalAmount.toString()} · Settled ${obligation.settledAmount?.toString() ?? "0"}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
