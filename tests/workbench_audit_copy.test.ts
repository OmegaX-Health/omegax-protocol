import assert from "node:assert/strict";
import test from "node:test";

import overviewMetricsModule from "../frontend/lib/overview-metrics.ts";
import workbenchModule from "../frontend/lib/workbench.ts";

const { EMPTY_OVERVIEW_STATS_SOURCE } =
  overviewMetricsModule as typeof import("../frontend/lib/overview-metrics.ts");
const { buildAuditTrail } = workbenchModule as typeof import("../frontend/lib/workbench.ts");

test("governance audit trail enumerates every visible queue state", () => {
  const auditTrail = buildAuditTrail({
    section: "governance",
    queue: [
      { proposal: "proposal-1", title: "Vote A", template: "Template A", authority: "Authority A", status: "Voting", stage: "Review" },
      { proposal: "proposal-2", title: "Exec B", template: "Template B", authority: "Authority B", status: "Executing", stage: "Execution" },
      { proposal: "proposal-3", title: "Done C", template: "Template C", authority: "Authority C", status: "Completed", stage: "Audit" },
      { proposal: "proposal-4", title: "Held D", template: "Template D", authority: "Authority D", status: "Cancelled", stage: "Review" },
    ],
  });

  const queueItem = auditTrail.find((item) => item.label === "Queue live");
  assert(queueItem, "expected queue summary audit item");
  assert.equal(
    queueItem.detail,
    "4 proposals are visible: 1 voting, 1 executing, 1 completed, and 1 cancelled.",
  );
});

test("overview audit trail keeps singular grammar for one approved claim", () => {
  const auditTrail = buildAuditTrail({ section: "overview", persona: "sponsor" });

  assert.equal(
    auditTrail[0]?.detail,
    "1 claim case is approved and waiting for reserve or settlement execution.",
  );
});

test("overview audit trail uses live source when supplied instead of fixture fallback", () => {
  const auditTrail = buildAuditTrail({
    section: "overview",
    persona: "sponsor",
    source: EMPTY_OVERVIEW_STATS_SOURCE,
    demo: false,
  });

  assert.equal(
    auditTrail[0]?.detail,
    "0 claim cases are approved and waiting for reserve or settlement execution.",
  );
  assert.equal(auditTrail.some((item) => item.detail.includes("fixture set")), false);
});

test("capital audit trail names pending redemption ledger units consistently", () => {
  const auditTrail = buildAuditTrail({ section: "capital" });
  const queueItem = auditTrail.find((item) => item.label === "Queue watch");

  assert(queueItem, "expected capital queue audit item");
  assert.match(queueItem.detail, /settlement units pending in the redemption queue/);
  assert.doesNotMatch(queueItem.detail, /shares waiting in the redemption queue/);
});

test("overview audit trail names class-ledger queue state as redemption sources", () => {
  const auditTrail = buildAuditTrail({
    section: "overview",
    persona: "capital",
    source: {
      ...EMPTY_OVERVIEW_STATS_SOURCE,
      liquidityPools: [{
        address: "pool-1",
        poolId: "pool-1",
        displayName: "Pool 1",
        depositAssetMint: "asset-1",
        strategyThesis: "Queue test",
        redemptionPolicy: 1,
        totalValueLocked: 100_000n,
        totalAllocated: 25_000n,
        totalPendingRedemptions: 0n,
        active: true,
      }],
      capitalClasses: [{
        address: "class-1",
        liquidityPool: "pool-1",
        classId: "senior",
        displayName: "Senior",
        priority: 1,
        restrictionMode: 0,
        totalShares: 100_000n,
        navAssets: 100_000n,
        allocatedAssets: 25_000n,
        pendingRedemptions: 25_000n,
        active: true,
      }],
      lpPositions: [],
    },
    demo: false,
  });
  const queueItem = auditTrail.find((item) => item.label === "Queue watch");

  assert(queueItem, "expected overview queue audit item");
  assert.equal(queueItem.detail, "1 redemption source remains across 1 pool using queued redemptions.");
  assert.doesNotMatch(queueItem.detail, /LP queue record/);
});
