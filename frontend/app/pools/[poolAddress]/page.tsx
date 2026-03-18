// SPDX-License-Identifier: AGPL-3.0-or-later

import Link from "next/link";
import { PublicKey } from "@solana/web3.js";

import { MemberActionsPanel } from "@/components/member-actions-panel";
import { PoolClaimsPanel } from "@/components/pool-claims-panel";
import { PoolCoveragePanel } from "@/components/pool-coverage-panel";
import { PoolGovernancePanel } from "@/components/pool-governance-panel";
import { PoolLiquidityConsole } from "@/components/pool-liquidity-console";
import { PoolOraclesConsole } from "@/components/pool-oracles-console";
import { PoolSchemasPanel } from "@/components/pool-schemas-panel";
import { PoolSettingsPanel } from "@/components/pool-settings-panel";
import { PoolTreasuryPanel } from "@/components/pool-treasury-panel";
import { PoolWorkspaceShell } from "@/components/pool-workspace-shell";

function normalize(value: string): string {
  return decodeURIComponent(value).trim();
}

type PoolWorkspacePageProps = {
  params: { poolAddress: string };
};

export default function PoolWorkspacePage({ params }: PoolWorkspacePageProps) {
  const poolAddress = normalize(params.poolAddress);

  let poolIsValid = true;
  try {
    new PublicKey(poolAddress);
  } catch {
    poolIsValid = false;
  }

  if (!poolIsValid) {
    return (
      <div className="space-y-4">
        <section className="surface-card">
          <h1 className="hero-title">Invalid Health Plan Address</h1>
          <p className="field-error">`{poolAddress}` is not a valid Solana public key.</p>
          <Link href="/pools" className="secondary-button mt-3 inline-flex w-fit">
            Back to pools
          </Link>
        </section>
      </div>
    );
  }

  return (
    <PoolWorkspaceShell
      poolAddress={poolAddress}
      sections={{
        members: (
          <MemberActionsPanel
            initialPoolAddress={poolAddress}
            lockPoolSelection
            sectionMode="embedded"
          />
        ),
        claims: (
          <PoolClaimsPanel poolAddress={poolAddress} />
        ),
        coverage: (
          <PoolCoveragePanel poolAddress={poolAddress} />
        ),
        liquidity: (
          <PoolLiquidityConsole poolAddress={poolAddress} />
        ),
        oracles: (
          <PoolOraclesConsole poolAddress={poolAddress} />
        ),
        schemas: (
          <PoolSchemasPanel poolAddress={poolAddress} />
        ),
        treasury: (
          <PoolTreasuryPanel poolAddress={poolAddress} />
        ),
        governance: (
          <PoolGovernancePanel />
        ),
        settings: (
          <PoolSettingsPanel poolAddress={poolAddress} sectionMode="embedded" />
        ),
      }}
    />
  );
}
