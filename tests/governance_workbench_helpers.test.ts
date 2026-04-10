import assert from "node:assert/strict";
import test from "node:test";

import workbenchModule from "../frontend/lib/workbench.ts";

const {
  canonicalizeGovernanceWorkbenchParams,
  governanceStatusVariant,
  resolveGovernanceProposalSelection,
} = workbenchModule as typeof import("../frontend/lib/workbench.ts");

const queue = [
  {
    proposal: "proposal-1",
    title: "Proposal One",
    template: "Template A",
    authority: "Authority A",
    status: "Voting",
    stage: "Review",
  },
  {
    proposal: "proposal-2",
    title: "Proposal Two",
    template: "Template B",
    authority: "Authority B",
    status: "Executing with errors",
    stage: "Execution",
  },
];

test("governance proposal selection stays canonical across non-queue tabs", () => {
  const selectedProposal = resolveGovernanceProposalSelection(queue, "proposal-2");
  assert.equal(selectedProposal?.proposal, "proposal-2");

  for (const activeTab of ["authorities", "templates"] as const) {
    const nextUpdates = canonicalizeGovernanceWorkbenchParams({
      activeTab,
      loaded: true,
      queryProposal: "proposal-2",
      requestedTab: "overview",
      selectedProposal,
    });

    assert.deepEqual(nextUpdates, { tab: activeTab });
  }
});

test("invalid governance proposal query canonicalizes to the resolved live proposal", () => {
  const selectedProposal = resolveGovernanceProposalSelection(queue, "bogus-proposal");
  assert.equal(selectedProposal?.proposal, "proposal-1");

  const nextUpdates = canonicalizeGovernanceWorkbenchParams({
    activeTab: "authorities",
    loaded: true,
    queryProposal: "bogus-proposal",
    requestedTab: "authorities",
    selectedProposal,
  });

  assert.deepEqual(nextUpdates, { proposal: "proposal-1" });
});

test("empty loaded governance queues clear stale proposal params", () => {
  const selectedProposal = resolveGovernanceProposalSelection([], "bogus-proposal");
  assert.equal(selectedProposal, null);

  const nextUpdates = canonicalizeGovernanceWorkbenchParams({
    activeTab: "queue",
    loaded: true,
    queryProposal: "bogus-proposal",
    requestedTab: "queue",
    selectedProposal,
  });

  assert.deepEqual(nextUpdates, { proposal: null });
});

test("loading governance queues keep the proposal param until the queue resolves", () => {
  const nextUpdates = canonicalizeGovernanceWorkbenchParams({
    activeTab: "queue",
    loaded: false,
    queryProposal: "proposal-2",
    requestedTab: "queue",
    selectedProposal: null,
  });

  assert.deepEqual(nextUpdates, {});
});

test("governance status variants classify execution errors as danger", () => {
  assert.equal(governanceStatusVariant("Executing with errors"), "danger");
  assert.equal(governanceStatusVariant("Executing"), "info");
});
