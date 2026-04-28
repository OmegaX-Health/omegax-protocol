// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Unit tests for the pure (non-RPC) helpers in frontend/lib/governance.ts.
// Targets the highest-blast-radius functions: proposal classification, hex32
// parsing, program-version normalization, hold-up time normalization, amount
// format/parse round-trip, and description-payload encode/decode round-trip.
// Network-dependent helpers (loadGovernanceDashboard, build*Tx, etc.) are
// covered by integration / e2e suites and intentionally omitted here.

import test from "node:test";
import assert from "node:assert/strict";

import { ProposalState } from "@solana/spl-governance";

import governanceModule from "../frontend/lib/governance.ts";

const {
  buildGovernanceDescriptionLink,
  classifyProposalGroup,
  formatGovernanceAmount,
  normalizeGovernanceInstructionHoldUpTime,
  normalizeGovernanceProgramVersion,
  parseGovernanceAmountInput,
  parseGovernanceDescriptionPayload,
  parseHex32Csv,
  DEFAULT_GOVERNANCE_PROGRAM_ID,
} = governanceModule as typeof import("../frontend/lib/governance.ts");

type GovernanceDescriptionPayload = import("../frontend/lib/governance.ts").GovernanceDescriptionPayload;

// ---------------------------------------------------------------------------
// classifyProposalGroup
// ---------------------------------------------------------------------------

test("classifyProposalGroup: Succeeded/Executing/ExecutingWithErrors → executable", () => {
  assert.equal(classifyProposalGroup(ProposalState.Succeeded), "executable");
  assert.equal(classifyProposalGroup(ProposalState.Executing), "executable");
  assert.equal(classifyProposalGroup(ProposalState.ExecutingWithErrors), "executable");
});

test("classifyProposalGroup: Completed → completed", () => {
  assert.equal(classifyProposalGroup(ProposalState.Completed), "completed");
});

test("classifyProposalGroup: Cancelled/Defeated/Vetoed → failed", () => {
  assert.equal(classifyProposalGroup(ProposalState.Cancelled), "failed");
  assert.equal(classifyProposalGroup(ProposalState.Defeated), "failed");
  assert.equal(classifyProposalGroup(ProposalState.Vetoed), "failed");
});

test("classifyProposalGroup: Draft/SigningOff/Voting fall through to active", () => {
  assert.equal(classifyProposalGroup(ProposalState.Draft), "active");
  assert.equal(classifyProposalGroup(ProposalState.SigningOff), "active");
  assert.equal(classifyProposalGroup(ProposalState.Voting), "active");
});

// ---------------------------------------------------------------------------
// parseHex32Csv
// ---------------------------------------------------------------------------

const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);

test("parseHex32Csv: parses comma-separated 32-byte hex values", () => {
  assert.deepEqual(parseHex32Csv(`${HASH_A},${HASH_B}`), [HASH_A, HASH_B]);
});

test("parseHex32Csv: deduplicates repeated entries", () => {
  assert.deepEqual(parseHex32Csv(`${HASH_A},${HASH_A},${HASH_B}`), [HASH_A, HASH_B]);
});

test("parseHex32Csv: drops empty entries (trailing comma, whitespace)", () => {
  assert.deepEqual(parseHex32Csv(`${HASH_A}, ,${HASH_B},`), [HASH_A, HASH_B]);
});

test("parseHex32Csv: empty input produces empty array", () => {
  assert.deepEqual(parseHex32Csv(""), []);
});

test("parseHex32Csv: lowercases mixed case and strips 0x prefix", () => {
  const upper = "AbCdEf" + "0".repeat(58);
  const expected = upper.toLowerCase();
  assert.deepEqual(parseHex32Csv(`0x${upper}`), [expected]);
});

test("parseHex32Csv: rejects malformed hex", () => {
  assert.throws(() => parseHex32Csv("not-hex"), /Expected 32-byte hex value/);
  assert.throws(() => parseHex32Csv("a".repeat(63)), /Expected 32-byte hex value/);
  assert.throws(() => parseHex32Csv("g".repeat(64)), /Expected 32-byte hex value/);
});

// ---------------------------------------------------------------------------
// normalizeGovernanceProgramVersion
// ---------------------------------------------------------------------------

test("normalizeGovernanceProgramVersion: positive override wins over detected", () => {
  assert.equal(
    normalizeGovernanceProgramVersion({
      detectedVersion: 1,
      overrideVersion: 4,
      programId: DEFAULT_GOVERNANCE_PROGRAM_ID,
    }),
    4,
  );
});

test("normalizeGovernanceProgramVersion: detected v1 on default program quirks up to v3", () => {
  assert.equal(
    normalizeGovernanceProgramVersion({
      detectedVersion: 1,
      overrideVersion: null,
      programId: DEFAULT_GOVERNANCE_PROGRAM_ID,
    }),
    3,
  );
});

test("normalizeGovernanceProgramVersion: detected v1 on a non-default program is preserved", () => {
  assert.equal(
    normalizeGovernanceProgramVersion({
      detectedVersion: 1,
      overrideVersion: null,
      programId: "SomeOtherGovernanceProgram1111111111111111",
    }),
    1,
  );
});

test("normalizeGovernanceProgramVersion: detected v2/v3 are passed through", () => {
  for (const v of [2, 3, 4]) {
    assert.equal(
      normalizeGovernanceProgramVersion({
        detectedVersion: v,
        overrideVersion: null,
        programId: DEFAULT_GOVERNANCE_PROGRAM_ID,
      }),
      v,
    );
  }
});

test("normalizeGovernanceProgramVersion: zero or negative override is ignored", () => {
  assert.equal(
    normalizeGovernanceProgramVersion({
      detectedVersion: 2,
      overrideVersion: 0,
      programId: DEFAULT_GOVERNANCE_PROGRAM_ID,
    }),
    2,
  );
  assert.equal(
    normalizeGovernanceProgramVersion({
      detectedVersion: 2,
      overrideVersion: -1,
      programId: DEFAULT_GOVERNANCE_PROGRAM_ID,
    }),
    2,
  );
});

// ---------------------------------------------------------------------------
// normalizeGovernanceInstructionHoldUpTime
// ---------------------------------------------------------------------------

test("normalizeGovernanceInstructionHoldUpTime: non-finite, negative, or zero → 0", () => {
  assert.equal(normalizeGovernanceInstructionHoldUpTime(Number.NaN), 0);
  assert.equal(normalizeGovernanceInstructionHoldUpTime(Number.POSITIVE_INFINITY), 0);
  assert.equal(normalizeGovernanceInstructionHoldUpTime(-1), 0);
  assert.equal(normalizeGovernanceInstructionHoldUpTime(0), 0);
});

test("normalizeGovernanceInstructionHoldUpTime: floors fractional positives", () => {
  assert.equal(normalizeGovernanceInstructionHoldUpTime(3.7), 3);
  assert.equal(normalizeGovernanceInstructionHoldUpTime(120.999), 120);
});

test("normalizeGovernanceInstructionHoldUpTime: positive integer passthrough", () => {
  assert.equal(normalizeGovernanceInstructionHoldUpTime(60), 60);
});

// ---------------------------------------------------------------------------
// formatGovernanceAmount
// ---------------------------------------------------------------------------

test("formatGovernanceAmount: zero", () => {
  assert.equal(formatGovernanceAmount(0n, 6), "0");
  assert.equal(formatGovernanceAmount(0n, 0), "0");
});

test("formatGovernanceAmount: decimals=0 is the integer rendering", () => {
  assert.equal(formatGovernanceAmount(123n, 0), "123");
  assert.equal(formatGovernanceAmount(-123n, 0), "-123");
});

test("formatGovernanceAmount: 6 decimals — whole and fractional parts", () => {
  assert.equal(formatGovernanceAmount(1_000_000n, 6), "1");
  assert.equal(formatGovernanceAmount(1_500_000n, 6), "1.5");
  assert.equal(formatGovernanceAmount(1_234_567n, 6), "1.234567");
});

test("formatGovernanceAmount: trailing zeros in the fractional part are stripped", () => {
  assert.equal(formatGovernanceAmount(2_500_000n, 6), "2.5");
  assert.equal(formatGovernanceAmount(2_000_001n, 6), "2.000001");
});

test("formatGovernanceAmount: negatives are signed once at the front", () => {
  assert.equal(formatGovernanceAmount(-1_500_000n, 6), "-1.5");
});

// ---------------------------------------------------------------------------
// parseGovernanceAmountInput
// ---------------------------------------------------------------------------

test("parseGovernanceAmountInput: empty / whitespace-only → 0n", () => {
  assert.equal(parseGovernanceAmountInput("", 6), 0n);
  assert.equal(parseGovernanceAmountInput("   ", 6), 0n);
});

test("parseGovernanceAmountInput: whole and fractional inputs", () => {
  assert.equal(parseGovernanceAmountInput("1", 6), 1_000_000n);
  assert.equal(parseGovernanceAmountInput("1.5", 6), 1_500_000n);
  assert.equal(parseGovernanceAmountInput("0.000001", 6), 1n);
});

test("parseGovernanceAmountInput: rejects non-numeric / sign / hex input", () => {
  assert.throws(() => parseGovernanceAmountInput("abc", 6), /valid token amount/);
  assert.throws(() => parseGovernanceAmountInput("-1", 6), /valid token amount/);
  assert.throws(() => parseGovernanceAmountInput("1e5", 6), /valid token amount/);
});

test("parseGovernanceAmountInput: rejects more decimals than the mint supports", () => {
  assert.throws(
    () => parseGovernanceAmountInput("1.1234567", 6),
    /up to 6 decimal places/,
  );
});

test("format/parse round-trip preserves arbitrary positive amounts at the mint precision", () => {
  for (const sample of [0n, 1n, 999n, 1_000_000n, 1_234_567n, 9_999_999_999n]) {
    const decimals = 6;
    const formatted = formatGovernanceAmount(sample, decimals);
    const reparsed = parseGovernanceAmountInput(formatted, decimals);
    assert.equal(reparsed, sample, `round-trip failed for ${sample}`);
  }
});

// ---------------------------------------------------------------------------
// buildGovernanceDescriptionLink + parseGovernanceDescriptionPayload
// ---------------------------------------------------------------------------

const ORIGIN = "https://example.invalid";

test("description payload round-trip: protocol-config (full payload)", () => {
  const payload: GovernanceDescriptionPayload = {
    allowedPayoutMintsHashHex: HASH_A,
    defaultStakeMint: "11111111111111111111111111111111",
    emergencyPaused: true,
    minOracleStake: 1_500_000_000n,
    newGovernanceAuthority: "GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw",
    protocolFeeBps: 250,
    template: "protocol-config",
  };

  const link = buildGovernanceDescriptionLink({ origin: ORIGIN, payload });
  const url = new URL(link);
  const params: Record<string, string> = {};
  url.searchParams.forEach((v, k) => { params[k] = v; });

  const parsed = parseGovernanceDescriptionPayload({
    searchParams: params,
    template: "protocol-config",
  });

  assert.deepEqual(parsed, payload);
});

test("description payload round-trip: protocol-config without optional newGovernanceAuthority", () => {
  const payload: GovernanceDescriptionPayload = {
    allowedPayoutMintsHashHex: HASH_B,
    defaultStakeMint: "11111111111111111111111111111111",
    emergencyPaused: false,
    minOracleStake: 0n,
    newGovernanceAuthority: null,
    protocolFeeBps: 0,
    template: "protocol-config",
  };

  const link = buildGovernanceDescriptionLink({ origin: ORIGIN, payload });
  const url = new URL(link);
  // Optional field must NOT be encoded when null.
  assert.equal(url.searchParams.has("newGovernanceAuthority"), false);

  const params: Record<string, string> = {};
  url.searchParams.forEach((v, k) => { params[k] = v; });
  const parsed = parseGovernanceDescriptionPayload({
    searchParams: params,
    template: "protocol-config",
  });
  assert.deepEqual(parsed, payload);
});

test("description payload round-trip: schema-state (verify + unverify + close)", () => {
  const payload: GovernanceDescriptionPayload = {
    closeSchemaHashes: [HASH_A],
    template: "schema-state",
    unverifySchemaHashes: [HASH_A, HASH_B],
    verifySchemaHashHex: HASH_A,
  };

  const link = buildGovernanceDescriptionLink({ origin: ORIGIN, payload });
  const url = new URL(link);
  const params: Record<string, string> = {};
  url.searchParams.forEach((v, k) => { params[k] = v; });

  const parsed = parseGovernanceDescriptionPayload({
    searchParams: params,
    template: "schema-state",
  });

  assert.deepEqual(parsed, payload);
});

test("description payload round-trip: schema-state with all-empty arrays and null verify hash", () => {
  const payload: GovernanceDescriptionPayload = {
    closeSchemaHashes: [],
    template: "schema-state",
    unverifySchemaHashes: [],
    verifySchemaHashHex: null,
  };

  const link = buildGovernanceDescriptionLink({ origin: ORIGIN, payload });
  const url = new URL(link);
  // No search params should be set when every field is empty.
  assert.equal(url.search, "");

  const parsed = parseGovernanceDescriptionPayload({
    searchParams: {},
    template: "schema-state",
  });
  assert.deepEqual(parsed, payload);
});
