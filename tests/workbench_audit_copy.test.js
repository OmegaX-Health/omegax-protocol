import assert from "node:assert/strict";
import test from "node:test";
import workbenchModule from "../frontend/lib/workbench.ts";
const { buildAuditTrail } = workbenchModule;
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
    assert.equal(queueItem.detail, "4 proposal lanes are visible: 1 voting, 1 executing, 1 completed, and 1 cancelled.");
});
test("overview audit trail keeps singular grammar for one approved claim", () => {
    const auditTrail = buildAuditTrail({ section: "overview", persona: "sponsor" });
    assert.equal(auditTrail[0]?.detail, "1 claim lane is approved and waiting for reserve or settlement execution.");
});
