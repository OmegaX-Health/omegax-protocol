// SPDX-License-Identifier: AGPL-3.0-or-later

import { buildCanonicalConsoleState } from "@/lib/console-model";
import { DEVNET_PROTOCOL_FIXTURE_STATE } from "@/lib/devnet-fixtures";
import { shortenAddress } from "@/lib/protocol";

export default function CapitalPage() {
  const consoleState = buildCanonicalConsoleState();

  return (
    <div className="space-y-8">
      <section className="rounded-[2rem] border border-white/10 bg-slate-950/40 p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-sky-200/80">Capital view</p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight">Liquidity pools and capital classes own investor economics.</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
          NAV, redeemability, restrictions, pending queue pressure, and exposure mix all live at the pool/class
          layer. Sponsor budgets never mint LP rights.
        </p>
      </section>

      {DEVNET_PROTOCOL_FIXTURE_STATE.liquidityPools.map((pool) => {
        const capital = consoleState.capital.find((row) => row.liquidityPoolAddress === pool.address);
        return (
          <section key={pool.address} className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-sky-200/70">LiquidityPool</p>
                <h2 className="mt-2 text-2xl font-semibold">{pool.displayName}</h2>
                <p className="mt-2 text-sm text-slate-400">
                  {pool.poolId} · {shortenAddress(pool.address)}
                </p>
              </div>
              {capital ? (
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-right">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Total NAV</p>
                    <p className="mt-2 text-xl font-semibold">${capital.totalNav.toString()}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-right">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Allocated</p>
                    <p className="mt-2 text-xl font-semibold">${capital.totalAllocated.toString()}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-right">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Pending queue</p>
                    <p className="mt-2 text-xl font-semibold">${capital.totalPendingRedemptions.toString()}</p>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              {capital?.classes.map((capitalClass) => (
                <article key={capitalClass.capitalClass} className="rounded-[1.6rem] border border-white/10 bg-slate-950/35 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{capitalClass.restriction}</p>
                      <h3 className="mt-2 text-xl font-semibold">{capitalClass.classId}</h3>
                    </div>
                    <div className="text-right text-sm text-slate-300">
                      <div>NAV ${capitalClass.nav.toString()}</div>
                      <div>Redeemable ${capitalClass.redeemable.toString()}</div>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4 text-sm text-slate-300">
                      <div>Allocated ${capitalClass.allocated.toString()}</div>
                      <div>Reserved ${capitalClass.reservedLiabilities.toString()}</div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4 text-sm text-slate-300">
                      <div>Realized yield ${capitalClass.realizedYield.toString()}</div>
                      <div>Impairments ${capitalClass.impairments.toString()}</div>
                    </div>
                  </div>
                  <div className="mt-4 space-y-2">
                    {capitalClass.exposureMix.map((exposure) => (
                      <div key={exposure.fundingLine} className="rounded-2xl border border-white/10 px-4 py-3 text-sm text-slate-300">
                        <div className="font-medium text-white">{shortenAddress(exposure.healthPlan)}</div>
                        <div>Funding line {shortenAddress(exposure.fundingLine)}</div>
                        <div>
                          Allocated ${exposure.allocatedAmount.toString()} · Reserved ${exposure.reservedCapacity.toString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
