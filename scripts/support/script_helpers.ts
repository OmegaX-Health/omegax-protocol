// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Shared helpers for operator/bootstrap scripts in `scripts/`.
// Extracted from duplicated implementations in bootstrap_devnet_live_protocol.ts,
// bootstrap_genesis_live_protocol.ts, and devnet_operator_drawer_sim.ts.

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

import { Keypair, PublicKey } from "@solana/web3.js";

export function sha256Bytes(label: string): number[] {
  return [...createHash("sha256").update(label).digest()];
}

export function keypairFromFile(path: string): Keypair {
  if (!existsSync(path)) {
    throw new Error(`Missing keypair file: ${path}`);
  }
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(path, "utf8"))));
}

export function requiredPublicKeyEnv(name: string): PublicKey {
  const value = (process.env[name] ?? "").trim();
  if (!value) {
    throw new Error(`${name} must be set to a real SPL token account for live treasury custody.`);
  }
  return new PublicKey(value);
}
