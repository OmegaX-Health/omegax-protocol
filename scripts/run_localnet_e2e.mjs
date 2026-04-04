// SPDX-License-Identifier: AGPL-3.0-or-later

import { spawn } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync, rmSync } from "node:fs";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Keypair } from "@solana/web3.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const programId = "Bn6eixac1QEEVErGBvBjxAd6pgB9e2q4XHvAkinQ5y1B";
const programSoPath = resolve(repoRoot, "target/deploy/omegax_protocol.so");
const keepArtifacts = process.env.OMEGAX_E2E_KEEP_ARTIFACTS === "1";
const skipBuild = process.env.OMEGAX_E2E_SKIP_BUILD === "1";

function nowStamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

async function reservePort(port) {
  const net = await import("node:net");
  return new Promise((resolvePort, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(port, "127.0.0.1", () => resolvePort(server));
  });
}

async function closeReservedPorts(servers) {
  await Promise.all(
    servers.map(
      (server) =>
        new Promise((resolveClose) => {
          server.close(() => resolveClose());
        }),
    ),
  );
}

async function allocatePortCandidate() {
  const net = await import("node:net");
  return new Promise((resolvePort, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("Unable to allocate free port")));
        return;
      }
      const { port } = address;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolvePort(port);
      });
    });
  });
}

async function getFreePort(excludedPorts = new Set()) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const port = await allocatePortCandidate();
    if (!excludedPorts.has(port)) {
      return port;
    }
  }
  throw new Error("Unable to allocate a free port outside the reserved set");
}

async function getFreeConsecutivePortRange(length, excludedPorts = new Set()) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const first = await getFreePort(excludedPorts);
    const last = first + length - 1;
    if (last > 65535) {
      continue;
    }

    const ports = Array.from({ length }, (_, index) => first + index);
    if (ports.some((port) => excludedPorts.has(port))) {
      continue;
    }

    const reservedServers = [];
    try {
      for (const port of ports) {
        const server = await reservePort(port);
        reservedServers.push(server);
      }
      await closeReservedPorts(reservedServers);
      return first;
    } catch {
      await closeReservedPorts(reservedServers);
    }
  }
  throw new Error(`Unable to allocate ${length} consecutive free ports`);
}

function runCommand(cmd, args, options = {}) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(cmd, args, {
      cwd: repoRoot,
      env: process.env,
      stdio: "inherit",
      ...options,
    });
    child.on("error", rejectRun);
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolveRun();
        return;
      }
      rejectRun(new Error(`${cmd} ${args.join(" ")} failed with code=${code ?? "null"} signal=${signal ?? "null"}`));
    });
  });
}

async function waitForRpc(rpcUrl, timeoutMs) {
  const startedAt = Date.now();
  let lastError = "validator did not answer";
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(rpcUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "getLatestBlockhash",
          params: [{ commitment: "confirmed" }],
        }),
      });
      const payload = await response.json();
      if (payload?.result?.value?.blockhash) {
        return;
      }
      lastError = JSON.stringify(payload);
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolveSleep) => setTimeout(resolveSleep, 500));
  }
  throw new Error(`Timed out waiting for validator RPC at ${rpcUrl}: ${lastError}`);
}

async function main() {
  if (!existsSync(programSoPath)) {
    throw new Error(`Compiled program is missing: ${programSoPath}`);
  }

  if (!skipBuild) {
    await runCommand("npm", ["run", "anchor:build:checked"]);
  }

  const artifactsRoot = resolve(repoRoot, "artifacts");
  mkdirSync(artifactsRoot, { recursive: true });

  const rpcPort = await getFreeConsecutivePortRange(2);
  const wsPort = rpcPort + 1;
  const reservedPorts = new Set([rpcPort, wsPort]);
  const faucetPort = await getFreePort(reservedPorts);
  reservedPorts.add(faucetPort);
  const dynamicPortStart = await getFreeConsecutivePortRange(33, reservedPorts);
  const dynamicPortEnd = dynamicPortStart + 32;
  const rpcUrl = `http://127.0.0.1:${rpcPort}`;
  const tempRoot = await mkdtemp(join(tmpdir(), "omegax-localnet-e2e-"));
  const ledgerDir = join(tempRoot, "ledger");
  const logPath = join(tempRoot, "validator.log");
  const summaryPath = join(artifactsRoot, `localnet-e2e-summary-${nowStamp()}.json`);
  await mkdir(ledgerDir, { recursive: true });
  const programUpgradeAuthority = Keypair.generate();
  const programUpgradeAuthorityPath = join(tempRoot, "program-upgrade-authority.json");
  await writeFile(
    programUpgradeAuthorityPath,
    JSON.stringify(Array.from(programUpgradeAuthority.secretKey)),
    "utf8",
  );

  const validatorArgs = [
    "--reset",
    "--ledger",
    ledgerDir,
    "--bind-address",
    "127.0.0.1",
    "--rpc-port",
    String(rpcPort),
    "--faucet-port",
    String(faucetPort),
    "--dynamic-port-range",
    `${dynamicPortStart}-${dynamicPortEnd}`,
    "--upgradeable-program",
    programId,
    programSoPath,
    programUpgradeAuthorityPath,
  ];

  const logStream = createWriteStream(logPath, { flags: "a" });
  const validator = spawn("solana-test-validator", validatorArgs, {
    cwd: repoRoot,
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  validator.stdout.pipe(logStream);
  validator.stderr.pipe(logStream);

  const terminateValidator = async () => {
    if (validator.killed) {
      return;
    }
    validator.kill("SIGTERM");
    await new Promise((resolveExit) => {
      const timeout = setTimeout(() => {
        validator.kill("SIGKILL");
      }, 5_000);
      validator.once("exit", () => {
        clearTimeout(timeout);
        resolveExit();
      });
    });
  };

  const cleanupTemp = async () => {
    if (keepArtifacts) {
      const preserveRoot = resolve(artifactsRoot, `localnet-e2e-${nowStamp()}`);
      await mkdir(preserveRoot, { recursive: true });
      const launcherLog = await readFile(logPath, "utf8").catch(() => "");
      const validatorLedgerLog = await readFile(join(ledgerDir, "validator.log"), "utf8").catch(() => "");
      await writeFile(resolve(preserveRoot, "launcher.log"), launcherLog, "utf8");
      await writeFile(resolve(preserveRoot, "validator.log"), validatorLedgerLog, "utf8");
      return;
    }
    await rm(tempRoot, { recursive: true, force: true });
  };

  process.on("exit", () => {
    try {
      validator.kill("SIGKILL");
    } catch {
      // ignore best-effort cleanup
    }
  });

  try {
    await waitForRpc(rpcUrl, 30_000);

    const testEnv = {
      ...process.env,
      SOLANA_RPC_URL: rpcUrl,
      NEXT_PUBLIC_PROTOCOL_PROGRAM_ID: programId,
      PROTOCOL_PROGRAM_ID: programId,
      OMEGAX_E2E_SUMMARY_PATH: summaryPath,
      OMEGAX_E2E_VALIDATOR_LOG: logPath,
      OMEGAX_E2E_RPC_PORT: String(rpcPort),
      OMEGAX_E2E_WS_PORT: String(wsPort),
      OMEGAX_E2E_WS_URL: `ws://127.0.0.1:${wsPort}`,
      OMEGAX_E2E_FAUCET_PORT: String(faucetPort),
      OMEGAX_E2E_DYNAMIC_PORT_RANGE: `${dynamicPortStart}-${dynamicPortEnd}`,
      OMEGAX_E2E_ORIGINAL_GOVERNANCE_SECRET_KEY_JSON: JSON.stringify(
        Array.from(programUpgradeAuthority.secretKey),
      ),
    };

    await new Promise((resolveRun, rejectRun) => {
      const testChild = spawn(
        "node",
        [
          "--import",
          "tsx",
          "--test",
          "--test-concurrency=1",
          "e2e/localnet_protocol_surface.test.ts",
        ],
        {
          cwd: repoRoot,
          env: testEnv,
          stdio: "inherit",
        },
      );
      testChild.on("error", rejectRun);
      testChild.on("exit", (code, signal) => {
        if (code === 0) {
          resolveRun();
          return;
        }
        rejectRun(
          new Error(
            `localnet protocol surface suite failed with code=${code ?? "null"} signal=${signal ?? "null"}`,
          ),
        );
      });
    });
  } finally {
    await terminateValidator().catch(() => undefined);
    await cleanupTemp().catch(() => undefined);
    logStream.end();
  }
}

main().catch(async (error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
