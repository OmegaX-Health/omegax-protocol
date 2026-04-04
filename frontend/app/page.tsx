// SPDX-License-Identifier: AGPL-3.0-or-later

import Link from "next/link";

import { buildCanonicalConsoleState } from "@/lib/console-model";
import { DEVNET_PROTOCOL_FIXTURE_STATE } from "@/lib/devnet-fixtures";

export default function HomePage() {
  const consoleState = buildCanonicalConsoleState();

  return (
    <div className="space-y-8">
      <section className="grid gap-6 lg:grid-cols-[1.4fr,1fr]">
        <div className="rounded-[2.4rem] border border-white/10 bg-white/6 p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-teal-200/80">Canonical model</p>
          <h2 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight text-white">
            One shared reserve kernel. Separate rights for sponsors, members, and capital providers.
          </h2>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">
            OmegaX Health produces attestations and evidence references. Nexus runs sponsor/operator workflows.
            OmegaX Protocol settles rights, liabilities, reserve state, and capital attribution on one auditable
            accounting foundation.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/plans" className="rounded-full bg-teal-400 px-5 py-3 text-sm font-medium text-slate-950 transition hover:bg-teal-300">
              Explore Health Plans
            </Link>
            <Link href="/capital" className="rounded-full border border-white/10 bg-slate-950/40 px-5 py-3 text-sm text-white transition hover:border-sky-300/60">
              Explore Capital Classes
            </Link>
          </div>
        </div>

        <div className="grid gap-4">
          <div className="rounded-[1.8rem] border border-white/10 bg-slate-950/40 p-5">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Reserve domains</p>
            <p className="mt-2 text-3xl font-semibold">{DEVNET_PROTOCOL_FIXTURE_STATE.reserveDomains.length}</p>
          </div>
          <div className="rounded-[1.8rem] border border-white/10 bg-slate-950/40 p-5">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Health plans</p>
            <p className="mt-2 text-3xl font-semibold">{DEVNET_PROTOCOL_FIXTURE_STATE.healthPlans.length}</p>
          </div>
          <div className="rounded-[1.8rem] border border-white/10 bg-slate-950/40 p-5">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Liquidity pools</p>
            <p className="mt-2 text-3xl font-semibold">{DEVNET_PROTOCOL_FIXTURE_STATE.liquidityPools.length}</p>
          </div>
          <div className="rounded-[1.8rem] border border-white/10 bg-slate-950/40 p-5">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Open obligations</p>
            <p className="mt-2 text-3xl font-semibold">{DEVNET_PROTOCOL_FIXTURE_STATE.obligations.length}</p>
          </div>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-3">
        {consoleState.glossary.slice(0, 6).map((item) => (
          <article key={item.noun} className="rounded-[1.8rem] border border-white/10 bg-white/5 p-6">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-400">{item.noun}</p>
            <p className="mt-3 text-sm leading-6 text-slate-300">{item.meaning}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
