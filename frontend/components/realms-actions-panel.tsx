// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { ExternalLink, Vote } from "lucide-react";

type Props = {
    realmAddress: string | null;
    cluster: string;
};

type RealmAction = {
    label: string;
    description: string;
    href: string;
    primary?: boolean;
};

export function RealmsActionsPanel({ realmAddress, cluster }: Props) {
    const { connected } = useWallet();

    if (!realmAddress) {
        return (
            <section className="surface-card space-y-3">
                <p className="metric-label">Realms fallback</p>
                <p className="field-help">
                    Configure `NEXT_PUBLIC_GOVERNANCE_REALM` to enable fallback links to the hosted Realms app.
                </p>
            </section>
        );
    }

    const clusterParam = encodeURIComponent(cluster);
    const baseUrl = `https://app.realms.today/dao/${realmAddress}`;

    const actions: RealmAction[] = [
        {
            label: "Generic Proposal",
            description: "Open Realms for arbitrary proposal composition beyond the structured OmegaX composers.",
            href: `${baseUrl}/proposal/new?cluster=${clusterParam}`,
            primary: true,
        },
        {
            label: "Proposals & Voting",
            description: "Use the hosted Realms workflow for edge-case voting or unsupported proposal flows.",
            href: `${baseUrl}?cluster=${clusterParam}`,
        },
        {
            label: "Members",
            description: "Inspect DAO members and governance power in the canonical hosted Realms interface.",
            href: `${baseUrl}/members?cluster=${clusterParam}`,
        },
        {
            label: "Treasury",
            description: "Use Realms for advanced treasury views and unsupported treasury actions.",
            href: `${baseUrl}/treasury/v2?cluster=${clusterParam}`,
        },
        {
            label: "DAO Params",
            description: "Open the full DAO parameter surface in Realms.",
            href: `${baseUrl}/params?cluster=${clusterParam}`,
        },
    ];

    return (
        <section className="surface-card space-y-4">
            <div className="flex items-center gap-2">
                <Vote className="h-4 w-4 text-[var(--accent)]" />
                <p className="metric-label">Realms fallback</p>
                {connected ? (
                    <span className="status-pill status-ok ml-auto">Wallet connected</span>
                ) : (
                    <span className="status-pill status-off ml-auto">Connect wallet for fallback actions</span>
                )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {actions.map((action) => (
                    <a
                        key={action.label}
                        href={action.href}
                        target="_blank"
                        rel="noreferrer"
                        className={`realms-action-card group ${action.primary ? "realms-action-card-primary" : ""}`}
                    >
                        <div className="flex items-center justify-between">
                            <span
                                className={`text-sm font-semibold ${action.primary ? "text-[var(--accent)]" : "text-[var(--foreground)]"}`}
                            >
                                {action.label}
                            </span>
                            <ExternalLink className="h-3.5 w-3.5 shrink-0 text-[var(--muted-foreground)] transition-colors group-hover:text-[var(--accent)]" />
                        </div>
                        <p className="text-xs text-[var(--muted-foreground)]">{action.description}</p>
                    </a>
                ))}
            </div>

            <p className="mt-4 flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
                <ExternalLink className="h-4 w-4" />
                These links stay available for unsupported or future Realms flows. Core OmegaX governance actions now happen natively in this console.
            </p>
        </section>
    );
}
