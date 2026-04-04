// SPDX-License-Identifier: AGPL-3.0-or-later

import { buildCanonicalConsoleState } from "@/lib/console-model";
import { shortenAddress } from "@/lib/protocol";

export default function MembersPage() {
  const consoleState = buildCanonicalConsoleState();

  return (
    <div className="space-y-8">
      <section className="rounded-[2rem] border border-white/10 bg-slate-950/40 p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-200/80">Member rights</p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight">Member positions hold plan and series rights, not LP exposure.</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
          Members see claimable rewards, claim lifecycle, delegated rights, and payout history. Capital structure
          sits elsewhere.
        </p>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        {consoleState.members.map((member) => (
          <article key={member.wallet} className="rounded-[1.8rem] border border-white/10 bg-white/5 p-6">
            <p className="text-xs uppercase tracking-[0.22em] text-cyan-200/70">Member</p>
            <h3 className="mt-2 text-xl font-semibold">{shortenAddress(member.wallet, 8)}</h3>
            <div className="mt-5 space-y-3">
              {member.planParticipations.map((participation) => (
                <div key={`${participation.healthPlan}:${participation.policySeries}`} className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="font-medium text-white">{shortenAddress(participation.healthPlan)}</p>
                      <p className="text-sm text-slate-400">{shortenAddress(participation.policySeries)}</p>
                    </div>
                    <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-200">
                      {participation.eligibility}
                    </span>
                  </div>
                  <div className="mt-4 grid gap-2 text-sm text-slate-300 sm:grid-cols-3">
                    <div>Claimable ${participation.claimableRewards.toString()}</div>
                    <div>Payable ${participation.payableClaims.toString()}</div>
                    <div>Paid ${participation.payoutHistory.toString()}</div>
                  </div>
                </div>
              ))}
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
