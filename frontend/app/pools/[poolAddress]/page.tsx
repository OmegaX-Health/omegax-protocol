// SPDX-License-Identifier: AGPL-3.0-or-later

import Link from "next/link";
import { PublicKey } from "@solana/web3.js";

import { MemberActionsPanel } from "@/components/member-actions-panel";
import { MemberClaimsPanel } from "@/components/member-claims-panel";
import { PoolLiquidityPanel } from "@/components/pool-liquidity-panel";
import { PoolOraclesPanel } from "@/components/pool-oracles-panel";
import { PoolSettingsPanel } from "@/components/pool-settings-panel";
import { PoolWorkspaceShell } from "@/components/pool-workspace-shell";
import { CoverageMint } from "./coverage-mint";

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
          <MemberClaimsPanel
            initialPoolAddress={poolAddress}
            lockPoolSelection
            sectionMode="embedded"
          />
        ),
        coverage: (
          <CoverageMint poolAddress={poolAddress} />
        ),
        liquidity: (
          <PoolLiquidityPanel poolAddress={poolAddress} sectionMode="embedded" />
        ),
        oracle: (
          <PoolOraclesPanel poolAddress={poolAddress} sectionMode="embedded" />
        ),
        settings: (
          <PoolSettingsPanel poolAddress={poolAddress} sectionMode="embedded" />
        ),
      }}
    />
  );
}
