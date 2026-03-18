// SPDX-License-Identifier: AGPL-3.0-or-later

import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { setTimeout as delay } from "node:timers/promises";

import { Connection, PublicKey } from "@solana/web3.js";

import {
  applyGovernanceSmokeFrontendEnv,
  readGovernanceUiReadonlyConfig,
} from "./devnet_governance_smoke_helpers.ts";

import governanceModule from "../frontend/lib/governance.ts";

const governance = governanceModule as typeof import("../frontend/lib/governance.ts");

function usage(): string {
  return [
    "Usage:",
    "  node --import tsx scripts/devnet_governance_ui_readonly.ts",
    "",
    "Required env:",
    "  SOLANA_RPC_URL",
    "  GOVERNANCE_REALM",
    "  GOVERNANCE_CONFIG",
    "  GOVERNANCE_TOKEN_MINT",
    "  GOVERNANCE_SMOKE_PROPOSAL_ADDRESS",
  ].join("\n");
}

async function findOpenPort(): Promise<number> {
  return await new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("Failed to allocate a local port for frontend smoke.")));
        return;
      }
      const { port } = address;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(port);
      });
    });
  });
}

async function waitForHttpReady(url: string, timeoutMs = 120_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError: string | null = null;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { redirect: "manual" });
      if (response.ok || response.status === 307 || response.status === 308) {
        return;
      }
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await delay(1_000);
  }

  throw new Error(`Frontend server did not become ready at ${url} (${lastError ?? "unknown error"}).`);
}

function collectProcessOutput(child: ChildProcessWithoutNullStreams): {
  logs: string[];
} {
  const logs: string[] = [];

  function push(chunk: Buffer): void {
    for (const line of chunk.toString("utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      logs.push(trimmed);
      if (logs.length > 120) {
        logs.shift();
      }
    }
  }

  child.stdout.on("data", push);
  child.stderr.on("data", push);
  return { logs };
}

async function waitForBodyIncludes(
  page: { locator(selector: string): { innerText(): Promise<string> } },
  fragments: string[],
  timeoutMs = 90_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  const normalizedFragments = fragments.map((fragment) => fragment.trim().toLowerCase()).filter(Boolean);

  while (Date.now() < deadline) {
    const bodyText = (await page.locator("body").innerText()).toLowerCase();
    if (normalizedFragments.every((fragment) => bodyText.includes(fragment))) {
      return;
    }
    await delay(1_000);
  }

  throw new Error(`Timed out waiting for page body to include: ${fragments.join(", ")}`);
}

async function waitForBodyIncludesWithRetry(
  page: {
    locator(selector: string): { innerText(): Promise<string> };
    reload(options?: { waitUntil?: "domcontentloaded" }): Promise<unknown>;
  },
  fragments: string[],
  timeoutMs = 90_000,
  maxAttempts = 2,
): Promise<void> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await waitForBodyIncludes(page, fragments, timeoutMs);
      return;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt >= maxAttempts) break;
      await page.reload({ waitUntil: "domcontentloaded" });
    }
  }

  throw lastError ?? new Error(`Timed out waiting for page body to include: ${fragments.join(", ")}`);
}

async function startFrontendDevServer(env: NodeJS.ProcessEnv, port: number): Promise<{
  baseUrl: string;
  child: ChildProcessWithoutNullStreams;
  logs: string[];
  stop: () => Promise<void>;
}> {
  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
  const child = spawn(
    npmCommand,
    ["--prefix", "frontend", "run", "dev", "--", "--hostname", "127.0.0.1", "--port", String(port)],
    {
      cwd: process.cwd(),
      env,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  const { logs } = collectProcessOutput(child);

  const baseUrl = `http://127.0.0.1:${port}`;
  try {
    await waitForHttpReady(`${baseUrl}/governance`);
  } catch (error) {
    child.kill("SIGTERM");
    throw new Error(
      `${error instanceof Error ? error.message : String(error)}\nRecent frontend output:\n${logs.join("\n")}`,
    );
  }

  async function stop(): Promise<void> {
    if (child.exitCode != null || child.signalCode != null) {
      return;
    }
    child.kill("SIGTERM");
    await Promise.race([
      once(child, "exit").then(() => undefined),
      delay(5_000).then(() => {
        if (child.exitCode == null && child.signalCode == null) {
          child.kill("SIGKILL");
        }
      }),
    ]);
  }

  return { baseUrl, child, logs, stop };
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log(usage());
    return;
  }

  const config = readGovernanceUiReadonlyConfig();
  applyGovernanceSmokeFrontendEnv(process.env, config);

  const connection = new Connection(config.rpcUrl, "confirmed");
  const proposalAddress = new PublicKey(config.proposalAddress);
  const detail = await governance.loadGovernanceProposalDetail({
    connection,
    proposalAddress,
    walletAddress: null,
  });
  if (!detail) {
    throw new Error(
      `Proposal ${config.proposalAddress} could not be loaded through the native governance detail helper.`,
    );
  }

  const port = await findOpenPort();
  const childEnv = { ...process.env };
  applyGovernanceSmokeFrontendEnv(childEnv, config);
  const server = await startFrontendDevServer(childEnv, port);

  let browser;
  try {
    const { chromium } = await import("playwright");
    browser = await chromium.launch({ headless: true });
  } catch (error) {
    await server.stop();
    throw new Error(
      `Playwright Chromium is not available. Install it with \`npx playwright install chromium\`.\n${error instanceof Error ? error.message : String(error)}`,
    );
  }

  try {
    const page = await browser.newPage();

    await page.goto(`${server.baseUrl}/governance`, { waitUntil: "domcontentloaded" });
    await waitForBodyIncludesWithRetry(page, [
      "Native Governance Console",
      "Governance rules",
      "DAO activity",
      "Members snapshot",
    ]);
    const proposalLink = page.locator(`a[href="/governance/proposals/${config.proposalAddress}"]`).first();
    await proposalLink.waitFor({
      state: "visible",
      timeout: 90_000,
    });
    await Promise.all([
      page.waitForURL(`${server.baseUrl}/governance/proposals/${config.proposalAddress}`, { timeout: 90_000 }),
      proposalLink.click(),
    ]);
    await waitForBodyIncludesWithRetry(page, [
      "Proposal detail",
      detail.proposal.name,
      "Proposal transactions",
      detail.proposal.stateLabel,
    ]);

    console.log(`[governance-ui-readonly] base_url=${server.baseUrl}`);
    console.log(`[governance-ui-readonly] proposal_address=${config.proposalAddress}`);
    console.log(`[governance-ui-readonly] proposal_name=${detail.proposal.name}`);
    console.log(`[governance-ui-readonly] proposal_state=${detail.proposal.stateLabel}`);
  } catch (error) {
    throw new Error(
      `${error instanceof Error ? error.message : String(error)}\nRecent frontend output:\n${server.logs.join("\n")}`,
    );
  } finally {
    await browser.close();
    await server.stop();
  }
}

void main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[governance-ui-readonly] failed: ${message}`);
  process.exitCode = 1;
});
