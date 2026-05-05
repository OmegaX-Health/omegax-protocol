// SPDX-License-Identifier: AGPL-3.0-or-later

import Link from "next/link";

import type { GenesisProtectDisclosurePageContent } from "@/lib/genesis-protect-disclosures";

export function GenesisProtectDisclosurePage({
  content,
}: {
  content: GenesisProtectDisclosurePageContent;
}) {
  const heroFacts = [
    { label: "Route", value: content.path },
    { label: "Status", value: content.statusLabel },
    { label: "Scope", value: "Shared protection metadata" },
  ];

  return (
    <div className="protocol-page genesis-disclosure-page">
      <section className="plans-hero genesis-disclosure-hero heavy-glass">
        <div className="plans-hero-glow" aria-hidden="true" />
        <div className="plans-hero-copy">
          <p className="plans-hero-eyebrow">{content.heroEyebrow}</p>
          <div className="protocol-actions">
            <span className="plans-card-meta">{content.statusLabel}</span>
          </div>
          <h1 className="plans-hero-title">
            {content.heroTitle}
          </h1>
          <p className="plans-hero-subtitle">{content.heroSubtitle}</p>
        </div>
        <aside className="genesis-disclosure-hero-panel" aria-label="Disclosure route record">
          <p className="genesis-disclosure-hero-panel-label">Route record</p>
          <dl className="genesis-disclosure-hero-facts">
            {heroFacts.map((fact) => (
              <div key={fact.label} className="genesis-disclosure-hero-fact">
                <dt>{fact.label}</dt>
                <dd>{fact.value}</dd>
              </div>
            ))}
          </dl>
        </aside>
      </section>

      <section className="protocol-section">
        <div className="protocol-section-head">
          <div>
            <p className="protocol-kicker">Public reference</p>
            <h2 className="protocol-section-title">Current canonical disclosure route</h2>
          </div>
        </div>
        <article className="plans-card genesis-disclosure-route-card heavy-glass">
          <p className="plans-card-body">{content.description}</p>
          <div className="plans-wizard-review-grid">
            <div className="plans-wizard-review-row">
              <span className="plans-wizard-review-label">PATH</span>
              <span className="plans-wizard-review-value">{content.path}</span>
            </div>
            <div className="plans-wizard-review-row">
              <span className="plans-wizard-review-label">CANONICAL_URL</span>
              <span className="plans-wizard-review-value">{content.canonicalUrl}</span>
            </div>
          </div>
        </article>
      </section>

      <div className="genesis-disclosure-grid">
        {content.sections.map((section) => (
          <article key={section.title} className="plans-card heavy-glass">
            <div className="plans-card-head">
              <div>
                <p className="plans-card-eyebrow">{section.eyebrow}</p>
                <h2 className="plans-card-title plans-card-title-display">
                  {section.title}
                </h2>
              </div>
            </div>
            <p className="plans-card-body">{section.copy}</p>
            {section.facts?.length ? (
              <div className="plans-wizard-review-grid">
                {section.facts.map((fact) => (
                  <div key={`${section.title}-${fact.label}`} className="plans-wizard-review-row">
                    <span className="plans-wizard-review-label">{fact.label}</span>
                    <span className="plans-wizard-review-value genesis-disclosure-value">{fact.value}</span>
                  </div>
                ))}
              </div>
            ) : null}
            {section.bullets?.length ? (
              <ul className="genesis-disclosure-list">
                {section.bullets.map((bullet) => (
                  <li key={`${section.title}-${bullet}`}>{bullet}</li>
                ))}
              </ul>
            ) : null}
          </article>
        ))}
      </div>

      <section className="protocol-section">
        <article className="plans-card heavy-glass">
          <div className="plans-card-head">
            <div>
              <p className="plans-card-eyebrow">Genesis pack</p>
              <h2 className="plans-card-title">Continue through the public launch pack</h2>
            </div>
          </div>
          <p className="plans-card-body">
            These disclosure routes exist so the live protection metadata resolves to real public pages. They should stay aligned with the linked Genesis docs pack and protocol metadata, not drift into a separate story.
          </p>
          <div className="protocol-actions">
            <Link href="https://docs.omegax.health/docs/coverage/genesis-protect-acute" className="secondary-button inline-flex">
              Open Genesis product page
            </Link>
            <Link href="https://docs.omegax.health/docs/coverage/genesis-protect-faq" className="secondary-button inline-flex">
              Open Genesis FAQ
            </Link>
          </div>
        </article>
      </section>
    </div>
  );
}
