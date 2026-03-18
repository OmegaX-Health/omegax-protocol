// SPDX-License-Identifier: AGPL-3.0-or-later

import Link from "next/link";
import { FileText } from "lucide-react";

import { Hero } from "@/components/hero";
import {
  parseGovernanceDescriptionPayload,
  type GovernanceDescriptionTemplate,
} from "@/lib/governance";

type GovernanceDescriptionPageProps = {
  params: { template: string };
  searchParams: Record<string, string | string[] | undefined>;
};

function isTemplate(value: string): value is GovernanceDescriptionTemplate {
  return value === "protocol-config" || value === "schema-state";
}

export default function GovernanceDescriptionPage({
  params,
  searchParams,
}: GovernanceDescriptionPageProps) {
  const template = decodeURIComponent(params.template).trim();
  if (!isTemplate(template)) {
    return (
      <div className="space-y-4">
        <section className="surface-card">
          <h1 className="hero-title">Unknown Proposal Template</h1>
          <p className="field-error">`{template}` is not a supported governance description template.</p>
          <Link href="/governance" className="secondary-button mt-3 inline-flex w-fit">
            Back to governance
          </Link>
        </section>
      </div>
    );
  }

  const payload = parseGovernanceDescriptionPayload({
    searchParams,
    template,
  });

  return (
    <div className="space-y-5">
      <Hero
        title="Proposal Description"
        subtitle="Public-safe structured metadata for an OmegaX governance proposal."
        icon={FileText}
      />

      <section className="surface-card space-y-4">
        <div>
          <p className="metric-label">Template</p>
          <h2 className="mt-1 text-lg font-semibold text-[var(--foreground)]">
            {template === "protocol-config" ? "Protocol config update" : "Schema state update"}
          </h2>
        </div>

        {payload.template === "protocol-config" ? (
          <div className="grid gap-3 md:grid-cols-2">
            <article className="rounded-2xl border border-[var(--border)]/60 bg-[var(--surface)] p-3">
              <p className="metric-label">Protocol fee bps</p>
              <p className="mt-2 text-lg font-semibold">{payload.protocolFeeBps}</p>
            </article>
            <article className="rounded-2xl border border-[var(--border)]/60 bg-[var(--surface)] p-3">
              <p className="metric-label">Min oracle stake</p>
              <p className="mt-2 text-lg font-semibold">{payload.minOracleStake.toString()}</p>
            </article>
            <article className="rounded-2xl border border-[var(--border)]/60 bg-[var(--surface)] p-3 md:col-span-2">
              <p className="metric-label">Default stake mint</p>
              <p className="mt-2 break-all font-mono text-sm text-[var(--foreground)]">{payload.defaultStakeMint}</p>
            </article>
            <article className="rounded-2xl border border-[var(--border)]/60 bg-[var(--surface)] p-3 md:col-span-2">
              <p className="metric-label">Allowed payout mints hash</p>
              <p className="mt-2 break-all font-mono text-sm text-[var(--foreground)]">{payload.allowedPayoutMintsHashHex}</p>
            </article>
            <article className="rounded-2xl border border-[var(--border)]/60 bg-[var(--surface)] p-3">
              <p className="metric-label">Emergency pause</p>
              <p className="mt-2 text-lg font-semibold">{payload.emergencyPaused ? "Enabled" : "Disabled"}</p>
            </article>
            <article className="rounded-2xl border border-[var(--border)]/60 bg-[var(--surface)] p-3">
              <p className="metric-label">Rotate governance authority</p>
              <p className="mt-2 break-all font-mono text-sm text-[var(--foreground)]">
                {payload.newGovernanceAuthority ?? "No rotation in this proposal"}
              </p>
            </article>
          </div>
        ) : (
          <div className="grid gap-3">
            <article className="rounded-2xl border border-[var(--border)]/60 bg-[var(--surface)] p-3">
              <p className="metric-label">Verify schema hash</p>
              <p className="mt-2 break-all font-mono text-sm text-[var(--foreground)]">
                {payload.verifySchemaHashHex ?? "No verify action included"}
              </p>
            </article>
            <article className="rounded-2xl border border-[var(--border)]/60 bg-[var(--surface)] p-3">
              <p className="metric-label">Unverify schema hashes</p>
              {payload.unverifySchemaHashes.length > 0 ? (
                <ul className="mt-2 space-y-2 text-sm text-[var(--foreground)]">
                  {payload.unverifySchemaHashes.map((hash) => (
                    <li key={hash} className="break-all font-mono">{hash}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-[var(--muted-foreground)]">No unverify actions included.</p>
              )}
            </article>
            <article className="rounded-2xl border border-[var(--border)]/60 bg-[var(--surface)] p-3">
              <p className="metric-label">Close schema hashes</p>
              {payload.closeSchemaHashes.length > 0 ? (
                <ul className="mt-2 space-y-2 text-sm text-[var(--foreground)]">
                  {payload.closeSchemaHashes.map((hash) => (
                    <li key={hash} className="break-all font-mono">{hash}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-[var(--muted-foreground)]">No close actions included.</p>
              )}
            </article>
          </div>
        )}
      </section>
    </div>
  );
}
