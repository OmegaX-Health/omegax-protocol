// SPDX-License-Identifier: AGPL-3.0-or-later

export default function GovernanceDescriptionTemplatePage({
  params,
}: {
  params: { template: string };
}) {
  return (
    <div className="rounded-[2rem] border border-white/10 bg-slate-950/40 p-8">
      <p className="text-xs uppercase tracking-[0.22em] text-fuchsia-200/70">Governance template</p>
      <h2 className="mt-3 text-3xl font-semibold">{params.template}</h2>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
        Governance descriptions are now scoped to reserve domains, health plans, liquidity pools, capital classes,
        and allocation controls rather than broad catch-all motions.
      </p>
    </div>
  );
}
