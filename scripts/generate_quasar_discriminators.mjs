// SPDX-License-Identifier: AGPL-3.0-or-later

import { readFileSync, writeFileSync } from "node:fs";

const IDL_PATH = "idl/omegax_protocol.json";
const OUTPUT_PATH = "programs/omegax_protocol/src/quasar_discriminators.rs";

const idl = JSON.parse(readFileSync(IDL_PATH, "utf8"));

function constName(prefix, name) {
  return `${prefix}_${name
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2")
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .toUpperCase()}`;
}

function formatBytes(bytes) {
  return `[${bytes.join(", ")}]`;
}

const lines = [
  "// SPDX-License-Identifier: AGPL-3.0-or-later",
  "",
  "//! Explicit Quasar discriminators for the public protocol surface.",
  "//!",
  "//! These values are generated from `idl/omegax_protocol.json` so the Quasar",
  "//! migration preserves the existing Anchor instruction/account byte prefixes.",
  "",
  "pub mod instruction {",
];

for (const instruction of idl.instructions ?? []) {
  lines.push(
    `    pub const ${constName("IX", instruction.name)}: [u8; 8] = ${formatBytes(
      instruction.discriminator,
    )};`,
  );
}

lines.push("}", "", "pub mod account {");

for (const account of idl.accounts ?? []) {
  lines.push(
    `    pub const ${constName("ACCOUNT", account.name)}: [u8; 8] = ${formatBytes(
      account.discriminator,
    )};`,
  );
}

lines.push("}", "", "pub mod event {");

for (const event of idl.events ?? []) {
  lines.push(
    `    pub const ${constName("EVENT", event.name)}: [u8; 8] = ${formatBytes(
      event.discriminator,
    )};`,
  );
}

lines.push("}", "");

writeFileSync(OUTPUT_PATH, `${lines.join("\n")}\n`);
console.log(`[quasar:discriminators] wrote ${OUTPUT_PATH}`);
