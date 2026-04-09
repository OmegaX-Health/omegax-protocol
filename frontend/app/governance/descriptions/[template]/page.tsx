// SPDX-License-Identifier: AGPL-3.0-or-later

import Link from "next/link";

import { DEVNET_PROTOCOL_FIXTURE_STATE } from "@/lib/devnet-fixtures";
import { getGovernanceTemplateEntry } from "@/lib/governance-template-library";
import { shortenAddress } from "@/lib/protocol";

function humanizeRole(role: string): string {
  return role
    .split("_")
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");
}

export default function GovernanceDescriptionTemplatePage({
  params,
}: {
  params: { template: string };
}) {
  const template = getGovernanceTemplateEntry(params.template);
  const ownerWallet =
    DEVNET_PROTOCOL_FIXTURE_STATE.wallets.find((wallet) => wallet.role === template.ownerRole) ??
    DEVNET_PROTOCOL_FIXTURE_STATE.wallets[0];
  const roleRow =
    DEVNET_PROTOCOL_FIXTURE_STATE.roleMatrix.find((row) => row.role === template.ownerRole) ??
    DEVNET_PROTOCOL_FIXTURE_STATE.roleMatrix[0];

  return (
    <div className="plans-shell gov-template-detail-shell">
      <div className="plans-scroll">
        <header className="plans-hero gov-template-detail-hero">
          <div className="plans-hero-glow" aria-hidden="true" />
          <div className="plans-hero-head">
            <div className="plans-hero-copy">
              <span className="plans-hero-eyebrow">{template.protocolTag.toUpperCase()}</span>
              <h1 className="plans-hero-title">
                {template.label} <em>record.</em>
              </h1>
              <p className="plans-hero-subtitle">{template.lead}</p>
            </div>
            <div className="plans-hero-actions">
              <Link href="/governance?tab=templates" className="plans-secondary-cta">
                Back to library
              </Link>
            </div>
          </div>
        </header>

        <div className="plans-context-bar">
          <div className="plans-context-selectors liquid-glass gov-template-context">
            <div className="gov-template-context-cell">
              <span className="plans-hero-select-eyebrow">TEMPLATE_ID</span>
              <span className="gov-template-context-value">{template.id}</span>
              <span className="gov-template-context-meta">Route-safe governance record key</span>
            </div>
            <div className="plans-context-divider" aria-hidden="true" />
            <div className="gov-template-context-cell">
              <span className="plans-hero-select-eyebrow">REVIEW_LANE</span>
              <span className="gov-template-context-value">{template.reviewLane}</span>
              <span className="gov-template-context-meta">{humanizeRole(template.ownerRole)}</span>
            </div>
          </div>
        </div>

        <section className="plans-kpi-strip" aria-label="Template telemetry">
          <div className="plans-kpi-metric">
            <span className="plans-kpi-label">BLAST_RADIUS</span>
            <span className="plans-kpi-value">{template.blastRadius}</span>
            <span className="plans-kpi-meta">{template.category}</span>
          </div>
          <div className="plans-kpi-metric">
            <span className="plans-kpi-label">REQUIRED_FIELDS</span>
            <span className="plans-kpi-value">{template.sections.length}</span>
            <span className="plans-kpi-meta">Draft inputs</span>
          </div>
          <div className="plans-kpi-metric">
            <span className="plans-kpi-label">GUARDRAILS</span>
            <span className="plans-kpi-value">{template.guardrails.length}</span>
            <span className="plans-kpi-meta">Protected surfaces</span>
          </div>
          <div className="plans-kpi-metric">
            <span className="plans-kpi-label">VERSION</span>
            <span className="plans-kpi-value">{template.version}</span>
            <span className="plans-kpi-meta">Published record</span>
          </div>
        </section>

        <div className="plans-body gov-template-detail-body">
          <section className="plans-main">
            <article className="plans-card heavy-glass">
              <div className="plans-card-head">
                <div>
                  <p className="plans-card-eyebrow">TEMPLATE_PURPOSE</p>
                  <h2 className="plans-card-title plans-card-title-display">
                    Bounded <em>intent</em>
                  </h2>
                </div>
                <span className="plans-card-meta">{template.recordClass}</span>
              </div>
              <p className="plans-card-body gov-template-detail-purpose">{template.purpose}</p>
              <div className="gov-template-detail-summary">
                <div className="gov-template-feature-cell">
                  <span className="gov-template-feature-label">Control family</span>
                  <strong>{template.recordClass}</strong>
                </div>
                <div className="gov-template-feature-cell">
                  <span className="gov-template-feature-label">Owner lane</span>
                  <strong>{ownerWallet.label}</strong>
                </div>
                <div className="gov-template-feature-cell">
                  <span className="gov-template-feature-label">Primary review path</span>
                  <strong>{template.reviewLane}</strong>
                </div>
                <div className="gov-template-feature-cell">
                  <span className="gov-template-feature-label">Owner wallet</span>
                  <strong>{shortenAddress(ownerWallet.address, 6)}</strong>
                </div>
              </div>
            </article>

            <article className="plans-card heavy-glass">
              <div className="plans-card-head">
                <div>
                  <p className="plans-card-eyebrow">REQUIRED_INPUTS</p>
                  <h2 className="plans-card-title plans-card-title-display">
                    Draft the <em>right</em> fields
                  </h2>
                </div>
                <span className="plans-card-meta">{template.sections.length} items</span>
              </div>
              <div className="gov-template-detail-grid">
                {template.sections.map((section, index) => (
                  <article key={section.label} className="gov-template-detail-card milled-ceramic">
                    <div className="gov-template-detail-card-head">
                      <span className="gov-template-detail-step">{String(index + 1).padStart(2, "0")}</span>
                      <span className="gov-template-detail-pill">{section.requirement}</span>
                    </div>
                    <h3 className="gov-template-detail-card-title">{section.label}</h3>
                    <p className="gov-template-detail-card-copy">{section.copy}</p>
                  </article>
                ))}
              </div>
            </article>

            <article className="plans-card heavy-glass">
              <div className="plans-card-head">
                <div>
                  <p className="plans-card-eyebrow">GUARDRAIL_LANGUAGE</p>
                  <h2 className="plans-card-title plans-card-title-display">
                    Keep the protected <em>surface</em> obvious
                  </h2>
                </div>
                <span className="plans-card-meta">Scoped only</span>
              </div>
              <div className="gov-template-guardrail-list">
                {template.guardrails.map((guardrail) => (
                  <article key={guardrail.title} className="gov-template-guardrail-item">
                    <div className="gov-template-guardrail-dot" aria-hidden="true" />
                    <div>
                      <h3 className="gov-template-guardrail-title">{guardrail.title}</h3>
                      <p className="gov-template-guardrail-copy">{guardrail.copy}</p>
                    </div>
                  </article>
                ))}
              </div>
            </article>
          </section>

          <aside className="plans-rail">
            <section className="plans-rail-card heavy-glass">
              <div className="plans-rail-head">
                <span className="plans-rail-tag">ACTION_RAIL</span>
                <span className="plans-rail-subtag">{template.version}</span>
              </div>
              <div className="plans-rail-hero">
                <span className="plans-rail-hero-val">{template.label}</span>
                <span className="plans-rail-hero-sub">{template.category}</span>
              </div>
              <p className="gov-template-rail-copy">
                Review the record, confirm the scoped lane, then step back into governance only when you need a live proposal context.
              </p>
              <Link href="/governance?tab=templates" className="plans-primary-cta">
                Review library
                <span className="material-symbols-outlined" aria-hidden="true">arrow_back</span>
              </Link>
              <Link href="/governance?tab=queue" className="plans-inline-action">
                Review live queue
                <span className="material-symbols-outlined" aria-hidden="true">north_east</span>
              </Link>
            </section>

            <section className="plans-rail-card heavy-glass">
              <div className="plans-rail-head">
                <span className="plans-rail-tag">AUTHORITY_MAP</span>
                <span className="plans-rail-subtag">{humanizeRole(template.ownerRole)}</span>
              </div>
              <div className="plans-rail-row">
                <span>Owner wallet</span>
                <strong>{ownerWallet.label}</strong>
              </div>
              <div className="plans-rail-row">
                <span>Address</span>
                <strong>{shortenAddress(ownerWallet.address, 6)}</strong>
              </div>
              <div className="plans-rail-row">
                <span>Review lane</span>
                <strong>{template.reviewLane}</strong>
              </div>
              <div className="gov-template-role-list">
                {(roleRow.actions ?? []).map((action) => (
                  <div key={action} className="gov-template-role-item">
                    <span>{action}</span>
                    <span>{roleRow.role}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="plans-rail-card heavy-glass">
              <div className="plans-rail-head">
                <span className="plans-rail-tag">RECORD_POSTURE</span>
                <span className="plans-rail-subtag">CONTROL</span>
              </div>
              <div className="plans-rail-row">
                <span>Blast radius</span>
                <strong>{template.blastRadius}</strong>
              </div>
              <div className="plans-rail-row">
                <span>Control family</span>
                <strong>{template.recordClass}</strong>
              </div>
              <div className="plans-rail-row">
                <span>Protected scope</span>
                <strong>{template.guardrails.length} guardrails</strong>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
