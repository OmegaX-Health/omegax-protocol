import assert from "node:assert/strict";
import test from "node:test";

import disclosureModule from "../frontend/lib/genesis-protect-disclosures.ts";
import genesisCatalogModule from "../frontend/lib/genesis-protect-acute.ts";

const { GENESIS_PROTECT_DISCLOSURE_PAGES } =
  disclosureModule as typeof import("../frontend/lib/genesis-protect-disclosures.ts");
const {
  GENESIS_PROTECT_ACUTE_RISK_DISCLOSURE_PATH,
  GENESIS_PROTECT_ACUTE_RISK_DISCLOSURE_URL,
  GENESIS_PROTECT_ACUTE_TECHNICAL_TERMS_PATH,
  GENESIS_PROTECT_ACUTE_TECHNICAL_TERMS_URL,
} = genesisCatalogModule as typeof import("../frontend/lib/genesis-protect-acute.ts");

function flattenPageText(page: (typeof GENESIS_PROTECT_DISCLOSURE_PAGES)[keyof typeof GENESIS_PROTECT_DISCLOSURE_PAGES]) {
  const values = [
    page.title,
    page.description,
    page.heroEyebrow,
    page.heroTitle,
    page.heroSubtitle,
    page.statusLabel,
  ];

  for (const section of page.sections) {
    values.push(section.eyebrow, section.title, section.copy);
    values.push(...(section.bullets ?? []));
    values.push(...(section.facts ?? []).flatMap((fact) => [fact.label, fact.value]));
  }

  return values.join("\n");
}

test("Genesis Protect disclosure pages keep canonical URLs and launch-truth language aligned", () => {
  const technicalTerms = GENESIS_PROTECT_DISCLOSURE_PAGES.technicalTerms;
  const riskDisclosures = GENESIS_PROTECT_DISCLOSURE_PAGES.riskDisclosures;
  const technicalTermsText = flattenPageText(technicalTerms);
  const riskDisclosuresText = flattenPageText(riskDisclosures);

  assert.equal(technicalTerms.path, GENESIS_PROTECT_ACUTE_TECHNICAL_TERMS_PATH);
  assert.equal(technicalTerms.canonicalUrl, GENESIS_PROTECT_ACUTE_TECHNICAL_TERMS_URL);
  assert.equal(riskDisclosures.path, GENESIS_PROTECT_ACUTE_RISK_DISCLOSURE_PATH);
  assert.equal(riskDisclosures.canonicalUrl, GENESIS_PROTECT_ACUTE_RISK_DISCLOSURE_URL);

  assert.match(technicalTermsText, /shared public metadata route used by DeFi-native protection series/i);
  assert.match(riskDisclosuresText, /can be referenced by generic DeFi-native protection metadata/i);
  assert.match(technicalTermsText, /Travel 30 is the primary launch SKU/i);
  assert.match(technicalTermsText, /Event 7 is the fast demo SKU/i);
  assert.match(technicalTermsText, /Retail-open and sponsor-configured cohort issuance are both allowed in v1/i);
  assert.match(technicalTermsText, /Phase 0 AI-assisted review under operator oversight/i);
  assert.match(riskDisclosuresText, /membership remains commercially separate from Genesis Protect premiums/i);
  assert.match(riskDisclosuresText, /do not read roadmap language about AI or decentralized review as current live fact/i);

  assert.doesNotMatch(technicalTermsText, /AI-led review/i);
  assert.doesNotMatch(riskDisclosuresText, /AI-led review/i);
});
