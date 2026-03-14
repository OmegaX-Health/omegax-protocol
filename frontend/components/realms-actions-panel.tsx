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
                <p className="metric-label">Realms actions</p>
                <p className="field-help">
                    Configure `NEXT_PUBLIC_GOVERNANCE_REALM` to enable inline Realms actions.
                </p>
            </section>
        );
    }

    const clusterParam = encodeURIComponent(cluster);
    const baseUrl = `https://app.realms.today/dao/${realmAddress}`;

    const actions: RealmAction[] = [
        {
            label: "New Proposal",
            description: "Draft and submit a new DAO governance proposal.",
            href: `${baseUrl}/proposal/new?cluster=${clusterParam}`,
            primary: true,
        },
        {
            label: "Proposals & Voting",
            description: "View active proposals, cast votes, and enable batch voting.",
            href: `${baseUrl}?cluster=${clusterParam}`,
        },
        {
            label: "Members",
            description: "See all DAO members and their governance power.",
            href: `${baseUrl}/members?cluster=${clusterParam}`,
        },
        {
            label: "Treasury",
            description: "Inspect DAO wallets, assets, and DeFi balances.",
            href: `${baseUrl}/treasury/v2?cluster=${clusterParam}`,
        },
        {
            label: "DAO Params",
            description: "Review governance parameters, voting thresholds, and rules.",
            href: `${baseUrl}/params?cluster=${clusterParam}`,
        },
    ];

    return (
        <section className="surface-card space-y-4">
            <div className="flex items-center gap-2">
                <Vote className="h-4 w-4 text-[var(--accent)]" />
                <p className="metric-label">Realms actions</p>
                {connected ? (
                    <span className="status-pill status-ok ml-auto">Wallet connected</span>
                ) : (
                    <span className="status-pill status-off ml-auto">Connect wallet to vote</span>
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
                All actions open in the Realms web app in a new tab. Connect your wallet there to cast votes.
            </p>
        </section>
    );
}
