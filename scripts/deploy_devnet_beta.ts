// SPDX-License-Identifier: AGPL-3.0-or-later

import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

import protocolModule from "../frontend/lib/protocol.ts";

const { getProgramId } = protocolModule as typeof import("../frontend/lib/protocol.ts");

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

function main() {
  console.log(`[devnet-beta] canonical_program_id=${getProgramId().toBase58()}`);
  console.log("[devnet-beta] running checked build and artifact parity...");
  run("npm", ["run", "anchor:build:checked"]);
  run("npm", ["run", "protocol:contract:check"]);

  console.log("[devnet-beta] generating canonical hard-break bootstrap manifest...");
  run("npm", ["run", "protocol:bootstrap"]);
  run("npm", ["run", "devnet:frontend:bootstrap"]);

  console.log("[devnet-beta] onchain deployment is intentionally operator-mediated for the hard-break migration.");
  console.log(
    "[devnet-beta] next step: deploy target/deploy/omegax_protocol.so with the canonical program id, then apply the generated manifest under devnet/.",
  );
}

main();
