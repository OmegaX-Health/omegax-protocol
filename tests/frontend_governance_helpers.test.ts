// SPDX-License-Identifier: AGPL-3.0-or-later

import assert from "node:assert/strict";
import test from "node:test";

import { ProposalState } from "@solana/spl-governance";
import { PublicKey } from "@solana/web3.js";

import governanceModule from "../frontend/lib/governance.ts";

const governance = governanceModule as typeof import("../frontend/lib/governance.ts");

const HEX_A = "aa".repeat(32);
const HEX_B = "bb".repeat(32);

test("getGovernanceRuntimeConfig reads explicit env values and preserves optional override", () => {
  const previous = new Map([
    ["NEXT_PUBLIC_REALMS_CLUSTER", process.env.NEXT_PUBLIC_REALMS_CLUSTER],
    ["NEXT_PUBLIC_SOLANA_EXPLORER_CLUSTER", process.env.NEXT_PUBLIC_SOLANA_EXPLORER_CLUSTER],
    ["NEXT_PUBLIC_GOVERNANCE_REALM", process.env.NEXT_PUBLIC_GOVERNANCE_REALM],
    ["NEXT_PUBLIC_GOVERNANCE_CONFIG", process.env.NEXT_PUBLIC_GOVERNANCE_CONFIG],
    ["NEXT_PUBLIC_GOVERNANCE_TOKEN_MINT", process.env.NEXT_PUBLIC_GOVERNANCE_TOKEN_MINT],
    ["NEXT_PUBLIC_GOVERNANCE_PROGRAM_ID", process.env.NEXT_PUBLIC_GOVERNANCE_PROGRAM_ID],
    ["NEXT_PUBLIC_GOVERNANCE_PROGRAM_VERSION", process.env.NEXT_PUBLIC_GOVERNANCE_PROGRAM_VERSION],
  ]);

  try {
    process.env.NEXT_PUBLIC_REALMS_CLUSTER = "devnet";
    process.env.NEXT_PUBLIC_SOLANA_EXPLORER_CLUSTER = "mainnet-beta";
    process.env.NEXT_PUBLIC_GOVERNANCE_REALM = "4ESvrUJ9bjyykG6gkR51qUDPQREJKJMmZ7gkv1E7q6QA";
    process.env.NEXT_PUBLIC_GOVERNANCE_CONFIG = "27AFKaBMMPYzSBxBR24hyVDZE7GDYBFE7ae1hrYWBPFP";
    process.env.NEXT_PUBLIC_GOVERNANCE_TOKEN_MINT = "8sz6kowsPjiLtCrdgcva8mS1CMZdZ9ZBFNzgEfpLoJxf";
    process.env.NEXT_PUBLIC_GOVERNANCE_PROGRAM_ID = "GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw";
    process.env.NEXT_PUBLIC_GOVERNANCE_PROGRAM_VERSION = "7";

    const config = governance.getGovernanceRuntimeConfig();

    assert.equal(config.cluster, "devnet");
    assert.equal(config.realmAddress, process.env.NEXT_PUBLIC_GOVERNANCE_REALM);
    assert.equal(config.governanceAddress, process.env.NEXT_PUBLIC_GOVERNANCE_CONFIG);
    assert.equal(config.governanceTokenMint, process.env.NEXT_PUBLIC_GOVERNANCE_TOKEN_MINT);
    assert.equal(config.programId, process.env.NEXT_PUBLIC_GOVERNANCE_PROGRAM_ID);
    assert.equal(config.programVersionOverride, 7);
  } finally {
    for (const [key, value] of previous) {
      if (value == null) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
});

test("normalizeGovernanceProgramVersion falls back canonical GovER version 1 to 3", () => {
  assert.equal(
    governance.normalizeGovernanceProgramVersion({
      detectedVersion: 1,
      programId: "GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw",
    }),
    3,
  );
  assert.equal(
    governance.normalizeGovernanceProgramVersion({
      detectedVersion: 1,
      overrideVersion: 5,
      programId: "GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw",
    }),
    5,
  );
  assert.equal(
    governance.normalizeGovernanceProgramVersion({
      detectedVersion: 2,
      programId: "Custom1111111111111111111111111111111111111",
    }),
    2,
  );
});

test("normalizeGovernanceInstructionHoldUpTime preserves DAO minimum hold-up", () => {
  assert.equal(governance.normalizeGovernanceInstructionHoldUpTime(900), 900);
  assert.equal(governance.normalizeGovernanceInstructionHoldUpTime(0), 0);
  assert.equal(governance.normalizeGovernanceInstructionHoldUpTime(Number.NaN), 0);
});

test("parseGovernanceAmountInput and formatGovernanceAmount round-trip decimal token values", () => {
  const raw = governance.parseGovernanceAmountInput("42.125", 3);
  assert.equal(raw, 42125n);
  assert.equal(governance.formatGovernanceAmount(raw, 3), "42.125");
  assert.equal(governance.formatGovernanceAmount(10n, 0), "10");
});

test("parseHex32Csv trims, lowercases, dedupes, and validates", () => {
  assert.deepEqual(governance.parseHex32Csv(` 0x${HEX_A}, ${HEX_B}, ${HEX_A} `), [HEX_A, HEX_B]);
  assert.throws(() => governance.parseHex32Csv("not-hex"));
});

test("classifyProposalGroup maps proposal states into native console buckets", () => {
  assert.equal(governance.classifyProposalGroup(ProposalState.Voting), "active");
  assert.equal(governance.classifyProposalGroup(ProposalState.Succeeded), "executable");
  assert.equal(governance.classifyProposalGroup(ProposalState.Completed), "completed");
  assert.equal(governance.classifyProposalGroup(ProposalState.Defeated), "failed");
});

test("buildProtocolConfigProposalInstructions emits protocol params update and optional rotation", () => {
  const governanceAuthority = new PublicKey("27AFKaBMMPYzSBxBR24hyVDZE7GDYBFE7ae1hrYWBPFP");
  const newAuthority = new PublicKey("4ESvrUJ9bjyykG6gkR51qUDPQREJKJMmZ7gkv1E7q6QA");
  const defaultStakeMint = new PublicKey("8sz6kowsPjiLtCrdgcva8mS1CMZdZ9ZBFNzgEfpLoJxf");
  const instructions = governance.buildProtocolConfigProposalInstructions({
    draft: {
      allowedPayoutMintsHashHex: HEX_A,
      defaultStakeMint: defaultStakeMint.toBase58(),
      emergencyPaused: true,
      minOracleStake: 25n,
      newGovernanceAuthority: newAuthority.toBase58(),
      protocolFeeBps: 175,
    },
    governanceAuthority,
    recentBlockhash: "11111111111111111111111111111111",
  });

  assert.equal(instructions.length, 2);
  assert.equal(instructions[0]?.programId.toBase58(), process.env.NEXT_PUBLIC_PROTOCOL_PROGRAM_ID ?? "Bn6eixac1QEEVErGBvBjxAd6pgB9e2q4XHvAkinQ5y1B");
  assert.equal(instructions[0]?.keys[0]?.pubkey.toBase58(), governanceAuthority.toBase58());
  assert.equal(instructions[0]?.keys[0]?.isSigner, true);
  assert.equal(instructions[1]?.keys[0]?.pubkey.toBase58(), governanceAuthority.toBase58());
});

test("description helpers round-trip protocol and schema proposal payloads", () => {
  const defaultStakeMint = "8sz6kowsPjiLtCrdgcva8mS1CMZdZ9ZBFNzgEfpLoJxf";
  const protocolUrl = governance.buildGovernanceDescriptionLink({
    origin: "https://protocol.omegax.health",
    payload: {
      allowedPayoutMintsHashHex: HEX_A,
      defaultStakeMint,
      emergencyPaused: false,
      minOracleStake: 123n,
      newGovernanceAuthority: null,
      protocolFeeBps: 140,
      template: "protocol-config",
    },
  });
  const protocolParsed = new URL(protocolUrl);
  const protocolPayload = governance.parseGovernanceDescriptionPayload({
    searchParams: Object.fromEntries(protocolParsed.searchParams.entries()),
    template: "protocol-config",
  });
  assert.equal(protocolPayload.template, "protocol-config");
  assert.equal(protocolPayload.protocolFeeBps, 140);
  assert.equal(protocolPayload.defaultStakeMint, defaultStakeMint);
  assert.equal(protocolPayload.minOracleStake, 123n);
  assert.equal(protocolPayload.allowedPayoutMintsHashHex, HEX_A);

  const schemaUrl = governance.buildGovernanceDescriptionLink({
    origin: "https://protocol.omegax.health",
    payload: {
      closeSchemaHashes: [HEX_B],
      template: "schema-state",
      unverifySchemaHashes: [HEX_A],
      verifySchemaHashHex: HEX_B,
    },
  });
  const schemaParsed = new URL(schemaUrl);
  const schemaPayload = governance.parseGovernanceDescriptionPayload({
    searchParams: Object.fromEntries(schemaParsed.searchParams.entries()),
    template: "schema-state",
  });
  assert.equal(schemaPayload.template, "schema-state");
  assert.deepEqual(schemaPayload.unverifySchemaHashes, [HEX_A]);
  assert.deepEqual(schemaPayload.closeSchemaHashes, [HEX_B]);
  assert.equal(schemaPayload.verifySchemaHashHex, HEX_B);
});
