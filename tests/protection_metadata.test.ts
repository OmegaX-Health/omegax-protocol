import test from "node:test";
import assert from "node:assert/strict";

import planLaunchModule from "../frontend/lib/plan-launch.ts";
import protectionMetadataModule from "../frontend/lib/protection-metadata.ts";

const { serializeProtectionPosture } = planLaunchModule as typeof import("../frontend/lib/plan-launch.ts");
const { validateProtectionMetadataAgainstPosture } =
  protectionMetadataModule as typeof import("../frontend/lib/protection-metadata.ts");

function createProtectionPosture() {
  return {
    coveragePathway: "defi_native" as const,
    defiSettlementMode: "onchain_programmatic" as const,
    defiTechnicalTermsUri: "https://protocol.omegax.health/coverage/technical-terms",
    defiRiskDisclosureUri: "https://protocol.omegax.health/coverage/risk-disclosures",
    rwaLegalEntityName: "",
    rwaJurisdiction: "",
    rwaPolicyTermsUri: "",
    rwaRegulatoryLicenseRef: "",
    rwaComplianceContact: "",
    protectionMetadataUri: "/metadata/protection/default-defi-v1.json",
  };
}

async function withMockFetch(
  handler: typeof fetch,
  run: () => Promise<void>,
) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = handler;
  try {
    await run();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test("protection metadata validation accepts a matching structured document", async () => {
  const posture = createProtectionPosture();
  const document = serializeProtectionPosture(posture);
  assert(document);

  await withMockFetch(async (input) => {
    assert.equal(String(input), posture.protectionMetadataUri);
    return new Response(JSON.stringify(document), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }, async () => {
    const result = await validateProtectionMetadataAgainstPosture(
      posture.protectionMetadataUri,
      posture,
    );
    assert.equal(result.error, null);
    assert.deepEqual(result.document, document);
  });
});

test("protection metadata validation rejects mismatched posture documents and fetch failures", async () => {
  const posture = createProtectionPosture();
  const mismatched = serializeProtectionPosture({
    ...posture,
    defiSettlementMode: "hybrid_rails",
  });
  assert(mismatched);

  await withMockFetch(async () =>
    new Response(JSON.stringify(mismatched), {
      status: 200,
      headers: { "content-type": "application/json" },
    }), async () => {
    const mismatch = await validateProtectionMetadataAgainstPosture(
      "/metadata/protection/mismatch.json",
      posture,
    );
    assert.equal(mismatch.error?.code, "posture_mismatch");
  });

  await withMockFetch(async () => {
    throw new Error("offline");
  }, async () => {
    const failed = await validateProtectionMetadataAgainstPosture(
      "/metadata/protection/offline.json",
      posture,
    );
    assert.equal(failed.error?.code, "fetch_failed");
  });
});
