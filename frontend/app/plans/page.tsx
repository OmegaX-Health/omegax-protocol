// SPDX-License-Identifier: AGPL-3.0-or-later

import { buildCanonicalConsoleState } from "@/lib/console-model";
import { DEVNET_PROTOCOL_FIXTURE_STATE } from "@/lib/devnet-fixtures";
import { shortenAddress } from "@/lib/protocol";

export default function PlansPage() {
  const consoleState = buildCanonicalConsoleState();

  return (
    <div className="space-y-8">
      <section className="rounded-[2rem] border border-white/10 bg-slate-950/40 p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-teal-200/80">Sponsor view</p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight">Health plans are budgets plus rights plus liabilities.</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
          Sponsor programs are modeled as HealthPlans with PolicySeries and FundingLines. LP capital only appears
          when a plan explicitly opts into external liquidity.
        </p>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        {DEVNET_PROTOCOL_FIXTURE_STATE.healthPlans.map((plan) => {
          const sponsor = consoleState.sponsors.find((row) => row.healthPlanAddress === plan.address);
          return (
            <article key={plan.address} className="rounded-[1.8rem] border border-white/10 bg-white/5 p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-teal-200/70">{plan.sponsorLabel}</p>
                  <h3 className="mt-2 text-2xl font-semibold">{plan.displayName}</h3>
                  <p className="mt-2 text-sm text-slate-400">
                    {plan.planId} · {shortenAddress(plan.address)}
                  </p>
                </div>
                <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-200">
                  {plan.active ? "active" : "inactive"}
                </span>
              </div>

              {sponsor ? (
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Funded sponsor budget</p>
                    <p className="mt-2 text-2xl font-semibold">${sponsor.fundedSponsorBudget.toString()}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Remaining sponsor budget</p>
                    <p className="mt-2 text-2xl font-semibold">${sponsor.remainingSponsorBudget.toString()}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Accrued rewards</p>
                    <p className="mt-2 text-2xl font-semibold">${sponsor.accruedRewards.toString()}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Paid rewards</p>
                    <p className="mt-2 text-2xl font-semibold">${sponsor.paidRewards.toString()}</p>
                  </div>
                </div>
              ) : null}

              <div className="mt-6 space-y-3">
                {consoleState.sponsors
                  .find((row) => row.healthPlanAddress === plan.address)
                  ?.perSeriesPerformance.map((series) => (
                    <div key={series.policySeries} className="rounded-2xl border border-white/10 bg-slate-950/30 p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-sm font-medium text-white">{series.seriesId}</p>
                          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{series.mode}</p>
                        </div>
                        <div className="text-right text-sm text-slate-300">
                          <div>Settled ${series.settled.toString()}</div>
                          <div>Reserved ${series.reserved.toString()}</div>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}
