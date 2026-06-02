import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

type IdlDiscriminatorItem = {
  name: string;
  discriminator: number[];
};

type ProtocolIdl = {
  instructions?: IdlDiscriminatorItem[];
  accounts?: IdlDiscriminatorItem[];
  events?: IdlDiscriminatorItem[];
};

const idl = JSON.parse(readFileSync("idl/omegax_protocol.json", "utf8")) as ProtocolIdl;
const source = readFileSync("programs/omegax_protocol/src/quasar_discriminators.rs", "utf8");

function constName(prefix: string, name: string): string {
  return `${prefix}_${name
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2")
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .toUpperCase()}`;
}

function parseConstants(moduleName: "instruction" | "account" | "event"): Map<string, number[]> {
  const moduleMatch = source.match(new RegExp(`pub mod ${moduleName} \\{([\\s\\S]*?)\\n\\}`, "m"));
  assert.ok(moduleMatch, `missing ${moduleName} discriminator module`);

  const constants = new Map<string, number[]>();
  const pattern = /pub const ([A-Z0-9_]+):\s*\[u8;\s*8\]\s*=\s*\[([0-9,\s]+)\];/g;
  for (const match of moduleMatch[1].matchAll(pattern)) {
    constants.set(
      match[1],
      match[2].split(",").map((part) => Number.parseInt(part.trim(), 10)),
    );
  }
  return constants;
}

test("Quasar instruction discriminators match the checked-in protocol IDL", () => {
  const constants = parseConstants("instruction");
  const instructions = idl.instructions ?? [];
  assert.equal(constants.size, instructions.length);

  for (const instruction of instructions) {
    assert.deepEqual(
      constants.get(constName("IX", instruction.name)),
      instruction.discriminator,
      instruction.name,
    );
  }
});

test("Quasar account discriminators match the checked-in protocol IDL", () => {
  const constants = parseConstants("account");
  const accounts = idl.accounts ?? [];
  assert.equal(constants.size, accounts.length);

  for (const account of accounts) {
    assert.deepEqual(
      constants.get(constName("ACCOUNT", account.name)),
      account.discriminator,
      account.name,
    );
  }
});

test("Quasar event discriminators match the checked-in protocol IDL", () => {
  const constants = parseConstants("event");
  const events = idl.events ?? [];
  assert.equal(constants.size, events.length);

  for (const event of events) {
    assert.deepEqual(
      constants.get(constName("EVENT", event.name)),
      event.discriminator,
      event.name,
    );
  }
});
