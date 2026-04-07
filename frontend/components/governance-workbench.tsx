// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import { useCallback, useEffect, useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { WorkbenchRailCard, WorkbenchTabs } from "@/components/workbench-ui";
import { buildAuditTrail, buildGovernanceQueue, defaultTabForPersona, GOVERNANCE_TABS, GOVERNANCE_TEMPLATE_ROWS, type GovernanceTabId } from "@/lib/workbench";
import { DEVNET_PROTOCOL_FIXTURE_STATE } from "@/lib/devnet-fixtures";
import { useWorkspacePersona } from "@/components/workspace-persona";
import { shortenAddress } from "@/lib/protocol";

export function GovernanceWorkbench() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { effectivePersona } = useWorkspacePersona();
  const auditTrail = useMemo(() => buildAuditTrail(), []);
  const queue = useMemo(() => buildGovernanceQueue(), []);

  const requestedTab = searchParams.get("tab");
  const activeTab = (GOVERNANCE_TABS.find((tab) => tab.id === requestedTab)?.id
    ?? defaultTabForPersona("governance", effectivePersona)) as GovernanceTabId;
  const queryProposal = searchParams.get("proposal")?.trim() ?? "";
  const selectedProposal = queue.find((proposal) => proposal.proposal === queryProposal) ?? queue[0] ?? null;

  const updateParams = useCallback(
    (updates: Record<string, string | null | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value) params.set(key, value);
        else params.delete(key);
      }
      router.replace(params.toString() ? `${pathname}?${params.toString()}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  useEffect(() => {
    const nextUpdates: Record<string, string> = {};
    if (requestedTab !== activeTab) nextUpdates.tab = activeTab;
    if (selectedProposal && queryProposal !== selectedProposal.proposal) nextUpdates.proposal = selectedProposal.proposal;
    if (Object.keys(nextUpdates).length > 0) updateParams(nextUpdates);
  }, [activeTab, queryProposal, requestedTab, selectedProposal, updateParams]);

  const authorities = DEVNET_PROTOCOL_FIXTURE_STATE.roleMatrix;
  const wallets = DEVNET_PROTOCOL_FIXTURE_STATE.wallets;

  return (
    <div className="workbench-page">
      <section className="workbench-main-column">
        <section className="workbench-panel ceramic-panel workbench-primary-surface">
          <div className="workbench-panel-head">
            <div>
              <p className="workbench-panel-eyebrow">Governance lane</p>
              <h2 className="workbench-panel-title">{selectedProposal?.title ?? "Proposal queue"}</h2>
              <p className="workbench-body-copy">Sequence scoped changes through review, timelock, execution, and audit without turning governance into a generic admin room.</p>
            </div>
            {selectedProposal ? <span className="workbench-card-meta">{selectedProposal.status}</span> : null}
          </div>

          <div className="workbench-summary-strip">
            <div className="workbench-summary-metric">
              <span>Proposal queue</span>
              <strong>{queue.length}</strong>
            </div>
            <div className="workbench-summary-metric">
              <span>Authority roles</span>
              <strong>{authorities.length}</strong>
            </div>
            <div className="workbench-summary-metric">
              <span>Templates</span>
              <strong>{GOVERNANCE_TEMPLATE_ROWS.length}</strong>
            </div>
            <div className="workbench-summary-metric">
              <span>Operator wallets</span>
              <strong>{wallets.length}</strong>
            </div>
          </div>

          <WorkbenchTabs tabs={GOVERNANCE_TABS} active={activeTab} onChange={(tab) => updateParams({ tab })} />

          {activeTab === "overview" ? (
            <div className="workbench-content-split">
              <div className="workbench-content-pane">
                <div className="workbench-content-pane-head">
                  <div>
                    <p className="workbench-panel-eyebrow">Lead proposal</p>
                    <h2 className="workbench-panel-title">{selectedProposal?.title ?? "Awaiting proposal selection"}</h2>
                  </div>
                  {selectedProposal ? <span className="workbench-card-meta">{selectedProposal.status}</span> : null}
                </div>
                <p className="workbench-body-copy">
                  Governance should sequence scoped changes without silently mutating sponsor budgets, claim history, or class economics.
                </p>
                {selectedProposal ? (
                  <Link href={`/governance/proposals/${encodeURIComponent(selectedProposal.proposal)}`} className="workbench-inline-link">
                    Open proposal detail
                  </Link>
                ) : null}
              </div>

              <div className="workbench-content-pane">
                <div className="workbench-content-pane-head">
                  <div>
                    <p className="workbench-panel-eyebrow">Queue register</p>
                    <h2 className="workbench-panel-title">Review, timelock, and execution stay visible in one lane.</h2>
                  </div>
                </div>
                <div className="workbench-list">
                  {queue.map((proposal) => (
                    <button
                      key={proposal.proposal}
                      type="button"
                      className={`workbench-list-row ${selectedProposal?.proposal === proposal.proposal ? "workbench-list-row-active" : ""}`}
                      onClick={() => updateParams({ proposal: proposal.proposal, tab: "queue" })}
                    >
                      <div>
                        <strong>{proposal.title}</strong>
                        <p>{proposal.stage}</p>
                      </div>
                      <div className="workbench-list-row-meta">
                        <span>{proposal.status}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {activeTab === "queue" ? (
            <div className="workbench-table-card">
              <table className="workbench-table">
                <thead>
                  <tr>
                    <th>Proposal</th>
                    <th>Template</th>
                    <th>Authority</th>
                    <th>Status</th>
                    <th>Open</th>
                  </tr>
                </thead>
                <tbody>
                  {queue.map((proposal) => (
                    <tr key={proposal.proposal}>
                      <td>
                        <button type="button" className="workbench-inline-button" onClick={() => updateParams({ proposal: proposal.proposal })}>
                          {proposal.title}
                        </button>
                      </td>
                      <td>{proposal.template}</td>
                      <td>{proposal.authority}</td>
                      <td>{proposal.status}</td>
                      <td>
                        <Link href={`/governance/proposals/${encodeURIComponent(proposal.proposal)}`} className="workbench-inline-link">
                          Detail
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {activeTab === "authorities" ? (
            <div className="workbench-table-card">
              <table className="workbench-table">
                <thead>
                  <tr>
                    <th>Role</th>
                    <th>Wallet</th>
                    <th>Address</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {wallets.map((wallet) => {
                    const actions = authorities.find((row) => row.role === wallet.role)?.actions ?? [];
                    return (
                      <tr key={wallet.address}>
                        <td>{wallet.role}</td>
                        <td>{wallet.label}</td>
                        <td>{shortenAddress(wallet.address, 8)}</td>
                        <td>{actions.join(", ") || "None"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}

          {activeTab === "templates" ? (
            <div className="workbench-table-card">
              <table className="workbench-table">
                <thead>
                  <tr>
                    <th>Template</th>
                    <th>Authority</th>
                    <th>Blast radius</th>
                    <th>Open</th>
                  </tr>
                </thead>
                <tbody>
                  {GOVERNANCE_TEMPLATE_ROWS.map((template) => (
                    <tr key={template.id}>
                      <td>{template.label}</td>
                      <td>{template.authority}</td>
                      <td>{template.blastRadius}</td>
                      <td>
                        <Link href={`/governance/descriptions/${template.id}`} className="workbench-inline-link">
                          Template detail
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {activeTab === "dao-ops" ? (
            <div className="workbench-content-split">
              <div className="workbench-content-pane">
                <div className="workbench-content-pane-head">
                  <div>
                    <p className="workbench-panel-eyebrow">Execution discipline</p>
                    <h2 className="workbench-panel-title">Review, timelock, execution, and audit stay in one visible lane.</h2>
                  </div>
                </div>
                <p className="workbench-body-copy">
                  Proposal routes remain shareable, but queueing and authority posture stay in the main governance workbench.
                </p>
              </div>
              <div className="workbench-content-pane">
                <div className="workbench-content-pane-head">
                  <div>
                    <p className="workbench-panel-eyebrow">Scope discipline</p>
                    <h2 className="workbench-panel-title">Templates constrain the change surface before an instruction is signed.</h2>
                  </div>
                </div>
                <p className="workbench-body-copy">
                  Keep reserve, plan, and capital controls auditable without inventing a catch-all governance room.
                </p>
              </div>
            </div>
          ) : null}
        </section>
      </section>

      <aside className="workbench-rail">
        <WorkbenchRailCard title="Selected proposal" meta="QUEUE">
          {selectedProposal ? (
            <div className="workbench-stack">
              <strong>{selectedProposal.title}</strong>
              <p>{selectedProposal.stage}</p>
              <div className="workbench-mini-stat">
                <span>Authority</span>
                <strong>{selectedProposal.authority}</strong>
              </div>
              <div className="workbench-mini-stat">
                <span>Template</span>
                <strong>{selectedProposal.template}</strong>
              </div>
              <Link href={`/governance/proposals/${encodeURIComponent(selectedProposal.proposal)}`} className="workbench-inline-link">
                Open standalone detail
              </Link>
            </div>
          ) : null}
        </WorkbenchRailCard>

        <WorkbenchRailCard title="Authority alerts" meta="CONTROL">
          <div className="workbench-stack">
            <div className="workbench-mini-stat">
              <span>Protocol governance</span>
              <strong>Timelock review</strong>
            </div>
            <div className="workbench-mini-stat">
              <span>Pool sentinel</span>
              <strong>Queue-only posture live</strong>
            </div>
            <div className="workbench-mini-stat">
              <span>Plan admin</span>
              <strong>Series controls monitored</strong>
            </div>
          </div>
        </WorkbenchRailCard>

        <WorkbenchRailCard title="Audit trail" meta="AUDIT">
          <div className="workbench-timeline">
            {auditTrail.map((item) => (
              <article key={item.id} className={`workbench-timeline-item workbench-timeline-item-${item.tone}`}>
                <div className="workbench-timeline-head">
                  <strong>{item.label}</strong>
                  <span>{item.timestamp}</span>
                </div>
                <p>{item.detail}</p>
              </article>
            ))}
          </div>
        </WorkbenchRailCard>
      </aside>
    </div>
  );
}
