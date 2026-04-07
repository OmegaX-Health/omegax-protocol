// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import { useCallback, useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";

import { walletFixtureFor } from "@/lib/canonical-ui";
import { DEVNET_PROTOCOL_FIXTURE_STATE } from "@/lib/devnet-fixtures";
import { shortenAddress } from "@/lib/protocol";

const GOVERNANCE_PANELS = [
  { id: "controls", label: "Scoped controls" },
  { id: "authority", label: "Authorities" },
  { id: "templates", label: "Templates" },
] as const;

type GovernancePanel = (typeof GOVERNANCE_PANELS)[number]["id"];

const CONTROL_ROWS = [
  {
    label: "Protocol emergency",
    copy: "Freeze broad state transitions only when the whole reserve fabric is at risk.",
    authority: "protocol_governance",
    template: "allocation-freeze",
    boundary: "Network-wide halt",
  },
  {
    label: "Reserve-domain rails",
    copy: "Keep hard custody and wrapper constraints scoped to a single reserve domain.",
    authority: "domain_admin",
    template: "reserve-domain-controls",
    boundary: "Reserve-only controls",
  },
  {
    label: "Plan operations",
    copy: "Version program controls without changing who owns sponsor budgets or member rights.",
    authority: "plan_admin",
    template: "health-plan-controls",
    boundary: "Plan and series lane",
  },
  {
    label: "Capital subscriptions",
    copy: "Force queue-only or pause redemptions without rewriting historical NAV and obligations.",
    authority: "pool_sentinel",
    template: "capital-class-controls",
    boundary: "Capital-class posture",
  },
];

const TEMPLATE_ROWS = [
  { id: "reserve-domain-controls", label: "Reserve domain controls" },
  { id: "health-plan-controls", label: "Health plan controls" },
  { id: "capital-class-controls", label: "Capital class controls" },
  { id: "allocation-freeze", label: "Allocation freeze" },
] as const;

export function CanonicalGovernanceSurface() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { publicKey, connected } = useWallet();
  const walletFixture = walletFixtureFor(publicKey?.toBase58());

  const activePanel = useMemo<GovernancePanel>(() => {
    const candidate = searchParams.get("panel");
    return candidate === "authority" || candidate === "templates" ? candidate : "controls";
  }, [searchParams]);
  const proposalRouteTarget = publicKey?.toBase58() ?? DEVNET_PROTOCOL_FIXTURE_STATE.wallets[0]?.address ?? "protocol";

  const updatePanel = useCallback(
    (panel: GovernancePanel) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("panel", panel);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  return (
    <section className="protocol-section">
      <div className="protocol-section-head">
        <div>
          <p className="protocol-kicker">Canonical governance surface</p>
          <h2 className="protocol-section-title">Governance should coordinate scoped controls without collapsing into one catch-all route.</h2>
        </div>
        <span className={`status-pill ${connected ? "status-ok" : "status-off"}`}>
          {walletFixture?.label ?? (connected ? "Connected wallet" : "Observer mode")}
        </span>
      </div>

      <div className="protocol-workspace-panel space-y-4">
        <div className="protocol-route-tabs">
          {GOVERNANCE_PANELS.map((panel) => (
            <button
              key={panel.id}
              type="button"
              className={`segment-button ${activePanel === panel.id ? "segment-button-active" : ""}`}
              onClick={() => updatePanel(panel.id)}
            >
              {panel.label}
            </button>
          ))}
        </div>

        {activePanel === "controls" ? (
          <div className="protocol-grid-2">
            <div className="protocol-data-list">
              {CONTROL_ROWS.map((row) => {
                const roleRow = DEVNET_PROTOCOL_FIXTURE_STATE.roleMatrix.find((entry) => entry.role === row.authority);

                return (
                  <article key={row.label} className="protocol-register-row">
                    <div>
                      <p className="protocol-metric-label">{row.label}</p>
                      <p className="protocol-section-copy">{row.copy}</p>
                    </div>
                    <div className="protocol-register-metrics">
                      <span>{row.boundary}</span>
                      <span>{row.authority}</span>
                      <span>{roleRow?.actions[0] ?? "Scoped authority"}</span>
                    </div>
                  </article>
                );
              })}
            </div>

            <div className="protocol-rail-stack">
              <article className="protocol-data-card">
                <p className="protocol-metric-label">Review grid</p>
                <div className="protocol-data-list">
                  <div className="protocol-data-row">
                    <span>Authority families</span>
                    <strong>{DEVNET_PROTOCOL_FIXTURE_STATE.roleMatrix.length}</strong>
                  </div>
                  <div className="protocol-data-row">
                    <span>Governance templates</span>
                    <strong>{TEMPLATE_ROWS.length}</strong>
                  </div>
                  <div className="protocol-data-row">
                    <span>Observer posture</span>
                    <span className="protocol-meta">{walletFixture?.label ?? "Unprivileged by default"}</span>
                  </div>
                </div>
              </article>

              <article className="protocol-data-card">
                <p className="protocol-metric-label">Linked records</p>
                <div className="protocol-data-list">
                  {TEMPLATE_ROWS.slice(0, 3).map((template) => (
                    <div key={template.id} className="protocol-data-row">
                      <div>
                        <strong>{template.label}</strong>
                        <p className="protocol-section-copy">Scoped template record</p>
                      </div>
                      <Link className="secondary-button inline-flex w-fit" href={`/governance/descriptions/${template.id}`}>
                        Open
                      </Link>
                    </div>
                  ))}
                  <div className="protocol-data-row">
                    <div>
                      <strong>Proposal route</strong>
                      <p className="protocol-section-copy">Inspect the current route-level governance record.</p>
                    </div>
                    <Link
                      className="secondary-button inline-flex w-fit"
                      href={`/governance/proposals/${encodeURIComponent(proposalRouteTarget)}`}
                    >
                      Inspect
                    </Link>
                  </div>
                </div>
              </article>
            </div>
          </div>
        ) : null}

        {activePanel === "authority" ? (
          <div className="protocol-data-list">
            {DEVNET_PROTOCOL_FIXTURE_STATE.wallets.map((wallet) => (
              <article key={wallet.address} className="protocol-data-card">
                <div className="protocol-data-row">
                  <div>
                    <p className="protocol-metric-label">{wallet.role}</p>
                    <h3 className="text-xl font-semibold">{wallet.label}</h3>
                    <p className="protocol-address">{shortenAddress(wallet.address, 8)}</p>
                  </div>
                  <span className={`status-pill ${publicKey?.toBase58() === wallet.address ? "status-ok" : "status-off"}`}>
                    {publicKey?.toBase58() === wallet.address ? "connected" : "devnet"}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(DEVNET_PROTOCOL_FIXTURE_STATE.roleMatrix.find((row) => row.role === wallet.role)?.actions ?? []).map((action) => (
                    <span key={action} className="status-pill status-off">{action}</span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        ) : null}

        {activePanel === "templates" ? (
          <div className="protocol-data-list">
            {TEMPLATE_ROWS.map((template) => (
              <article key={template.id} className="protocol-register-row">
                <div>
                  <p className="protocol-metric-label">Governance template</p>
                  <strong>{template.label}</strong>
                  <p className="protocol-section-copy">
                    Draft text should stay narrow and aligned with the control scope it touches.
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <Link className="secondary-button inline-flex w-fit" href={`/governance/descriptions/${template.id}`}>
                    Template
                  </Link>
                  <Link
                    className="secondary-button inline-flex w-fit"
                    href={`/governance/proposals/${encodeURIComponent(proposalRouteTarget)}`}
                  >
                    Proposal
                  </Link>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
