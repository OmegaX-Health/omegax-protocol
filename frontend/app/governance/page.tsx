// SPDX-License-Identifier: AGPL-3.0-or-later

import { DEVNET_PROTOCOL_FIXTURE_STATE } from "@/lib/devnet-fixtures";

export default function GovernancePage() {
  return (
    <div className="space-y-8">
      <section className="rounded-[2rem] border border-white/10 bg-slate-950/40 p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-fuchsia-200/80">Governance doctrine</p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight">Governance coordinates the network. It does not rewrite economic history.</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
          Emergency pause, domain rails, plan operations, capital subscriptions, queue-only redemptions, and
          allocation freeze all exist as scoped controls with explicit authorities and audit paths.
        </p>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {DEVNET_PROTOCOL_FIXTURE_STATE.roleMatrix.map((role) => (
          <article key={role.role} className="rounded-[1.8rem] border border-white/10 bg-white/5 p-5">
            <p className="text-xs uppercase tracking-[0.22em] text-fuchsia-200/70">{role.role}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {role.actions.map((action) => (
                <span key={action} className="rounded-full border border-white/10 bg-slate-950/40 px-3 py-1 text-xs text-slate-300">
                  {action}
                </span>
              ))}
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
