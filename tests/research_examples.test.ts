import assert from "node:assert/strict";
import test from "node:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const EXAMPLE_DIR = join(
  process.cwd(),
  "examples",
  "research-products",
  "italian-rehab-and-fullcover",
);

function readJson<T>(filename: string): T {
  return JSON.parse(readFileSync(join(EXAMPLE_DIR, filename), "utf8")) as T;
}

test("research example JSON files parse", () => {
  const jsonFiles = readdirSync(EXAMPLE_DIR).filter((entry) => entry.endsWith(".json"));
  assert.ok(jsonFiles.length >= 6);

  for (const file of jsonFiles) {
    const parsed = JSON.parse(readFileSync(join(EXAMPLE_DIR, file), "utf8"));
    assert.ok(parsed);
  }
});

test("full-cover tier module lists stay aligned with module tier declarations", () => {
  const model = readJson<any>("fullcover-working-adults-model.json");

  for (const tier of Object.keys(model.tiers)) {
    const expectedModules = Object.entries<any>(model.coverageModules)
      .filter(([, definition]) => definition.includedInTiers.includes(tier))
      .map(([name]) => name)
      .sort();
    const actualModules = [...model.tiers[tier].includedModules].sort();
    assert.deepEqual(actualModules, expectedModules, `expected ${tier} modules to stay aligned`);
  }
});

test("full-cover cap wording distinguishes per-event from annual Gold exposure", () => {
  const model = readJson<any>("fullcover-working-adults-model.json");
  const capComparison = model.comparisonWithRehabPlans.differences.find(
    (entry: { dimension: string }) => entry.dimension === "Max event / annual cap",
  );

  assert.equal(model.coverageModules["oncology-catastrophic"].perEventCapUSD, 100000);
  assert.equal(model.coverageModules["oncology-catastrophic"].annualCapUSD, 200000);
  assert.equal(
    capComparison?.fullCover,
    "$100,000 per catastrophic event; $200,000 annual Gold cap",
  );
  assert.match(
    model.actuarialModel.lpBackstop.rationale,
    /annual Gold cap/i,
  );
});
