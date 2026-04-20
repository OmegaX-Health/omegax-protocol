// SPDX-License-Identifier: AGPL-3.0-or-later

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { Keypair } from "@solana/web3.js";

import protocolModule from "../frontend/lib/protocol.ts";
import { loadEnvFile } from "./support/load_env_file.ts";

const { getProgramId } = protocolModule as typeof import("../frontend/lib/protocol.ts");
const DEPLOY_KEYPAIR_PATH = resolve(process.cwd(), "target/deploy/omegax_protocol-keypair.json");
const DEFAULT_UPGRADE_AUTHORITY_PATH = "~/.config/solana/id.json";
const FRONTEND_ENV_PATH = resolve(process.cwd(), "frontend/.env.local");

function run(cmd: string, args: string[]) {
  const result = spawnSync(cmd, args, {
    cwd: resolve(process.cwd()),
    encoding: "utf8",
    env: process.env,
  });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  if (result.status !== 0) {
    throw new Error(`${cmd} ${args.join(" ")} failed:\n${output}`);
  }
  process.stdout.write(output);
}

function deployKeypairAddress(): string {
  const raw = JSON.parse(readFileSync(DEPLOY_KEYPAIR_PATH, "utf8")) as number[];
  return Keypair.fromSecretKey(Uint8Array.from(raw)).publicKey.toBase58();
}

function main() {
  loadEnvFile(FRONTEND_ENV_PATH);

  const canonicalProgramId = getProgramId().toBase58();
  const deployKeypairProgramId = deployKeypairAddress();

  console.log(`[devnet-beta] canonical_program_id=${canonicalProgramId}`);
  console.log("[devnet-beta] running checked build and artifact parity...");
  run("npm", ["run", "anchor:build:checked"]);
  run("npm", ["run", "protocol:contract:check"]);

  console.log("[devnet-beta] generating canonical hard-break bootstrap manifest...");
  run("npm", ["run", "protocol:bootstrap"]);
  run("npm", ["run", "devnet:frontend:bootstrap"]);

  if (deployKeypairProgramId !== canonicalProgramId) {
    console.log(
      `[devnet-beta] deploy_keypair_program_id=${deployKeypairProgramId} (differs from canonical program id)`,
    );
    console.log(
      "[devnet-beta] do not deploy shared devnet by relying on target/deploy/omegax_protocol-keypair.json.",
    );
  }
  console.log("[devnet-beta] onchain deployment is intentionally operator-mediated for the hard-break migration.");
  console.log(
    `[devnet-beta] next step: solana program deploy --program-id ${canonicalProgramId} --upgrade-authority ${DEFAULT_UPGRADE_AUTHORITY_PATH} target/deploy/omegax_protocol.so`,
  );
  console.log("[devnet-beta] then apply the generated manifest under devnet/.");
}

main();
