// SPDX-License-Identifier: AGPL-3.0-or-later

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import protocolModule from "../frontend/lib/protocol.ts";

const protocol = protocolModule as typeof import("../frontend/lib/protocol.ts");
const contract = JSON.parse(
  readFileSync(new URL("../shared/protocol_contract.json", import.meta.url), "utf8"),
) as {
  instructions: Array<{ name: string }>;
};

function toBuilderName(instructionName: string): string {
  return `build${instructionName
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join("")}Tx`;
}

test("every protocol contract instruction has an exported transaction builder", () => {
  const builderNames = new Set(
    Object.keys(protocol).filter((name) => /^build[A-Z0-9].*Tx$/.test(name)),
  );
  const missingBuilders = contract.instructions
    .map((instruction) => instruction.name)
    .filter((instructionName) => !builderNames.has(toBuilderName(instructionName)));

  assert.deepEqual(missingBuilders, []);
  assert.equal(builderNames.size, contract.instructions.length);
});
