// SPDX-License-Identifier: AGPL-3.0-or-later

import { PublicKey } from "@solana/web3.js";
import { Landmark } from "lucide-react";

import { FaucetPanel } from "@/components/faucet-panel";
import { Hero } from "@/components/hero";
import { RealmsActionsPanel } from "@/components/realms-actions-panel";

const ZERO_PUBKEY = "11111111111111111111111111111111";

function asPubkey(value: string): PublicKey | null {
  try {
    const parsed = new PublicKey(value.trim());
    if (parsed.toBase58() === ZERO_PUBKEY) return null;
    return parsed;
  } catch {
    return null;
  }
}

export default function GovernancePage() {
  const cluster =
    process.env.NEXT_PUBLIC_REALMS_CLUSTER?.trim()
    || process.env.NEXT_PUBLIC_SOLANA_EXPLORER_CLUSTER?.trim()
    || "devnet";
  const realmRaw = process.env.NEXT_PUBLIC_GOVERNANCE_REALM?.trim() || "";
  const governanceConfigRaw = process.env.NEXT_PUBLIC_GOVERNANCE_CONFIG?.trim() || "";
  const realm = asPubkey(realmRaw);
  const governanceConfig = asPubkey(governanceConfigRaw);
  const governanceConfigIsWalletSigner = governanceConfig
    ? PublicKey.isOnCurve(governanceConfig.toBytes())
    : false;

  const governanceConfigReady = Boolean(realm && governanceConfig && !governanceConfigIsWalletSigner);

  return (
    <div className="space-y-5">
      <Hero
        title="Governance"
        subtitle="OmegaX Protocol is governed by the community. Claim devnet DAO tokens below to get voting power, then participate in governance on Realms."
        icon={Landmark}
      />

      <div className="space-y-8">
        <section className="grid grid-cols-[32px,1fr] gap-4">
          <div className="flex flex-col items-center pt-0.5">
            <div className="timeline-step-marker">
              1
            </div>
            <div className="timeline-step-line mt-3 flex-1" />
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">Step 1</p>
                <h2 className="text-base font-semibold">Acquire Voting Power</h2>
                <p className="text-sm text-[var(--muted-foreground)]">Claim devnet DAO tokens and deposit in Realms to vote.</p>
              </div>
              <div className={`status-pill ${governanceConfigReady ? "status-ok" : "status-off"} text-[10px]`}>
                {governanceConfigReady ? `Realms Active (${cluster})` : "Configuration Pending"}
              </div>
            </div>
            <FaucetPanel />
          </div>
        </section>

        <section className="grid grid-cols-[32px,1fr] gap-4">
          <div className="flex flex-col items-center pt-0.5">
            <div className="timeline-step-marker">
              2
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">Step 2</p>
              <h2 className="text-base font-semibold">Participate in Governance</h2>
              <p className="text-sm text-[var(--muted-foreground)]">Create proposals, review treasury actions, and cast votes in Realms.</p>
            </div>
            <RealmsActionsPanel
              realmAddress={realm?.toBase58() ?? null}
              cluster={cluster}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
