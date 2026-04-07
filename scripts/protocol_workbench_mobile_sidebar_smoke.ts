// SPDX-License-Identifier: AGPL-3.0-or-later

import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { setTimeout as delay } from "node:timers/promises";

const SIDEBAR_ID = "protocol-workbench-sidebar";
const VIEWPORT = { width: 390, height: 844 };
const DEV_SERVER_PORT_CANDIDATES = [3001, 3000] as const;

type FocusSnapshot = {
  ariaLabel: string | null;
  insideSidebar: boolean;
  tagName: string | null;
  text: string | null;
};

function usage(): string {
  return [
    "Usage:",
    "  npm run frontend:workbench:mobile-sidebar:smoke",
    "  node --import tsx scripts/protocol_workbench_mobile_sidebar_smoke.ts",
  ].join("\n");
}

async function isPortAvailable(port: number): Promise<boolean> {
  return await new Promise((resolve) => {
    const server = createServer();
    server.once("error", () => resolve(false));
    server.listen(port, "127.0.0.1", () => {
      server.close((error) => {
        if (error) {
          resolve(false);
          return;
        }

        resolve(true);
      });
    });
  });
}

async function findReusablePort(): Promise<number> {
  for (const port of DEV_SERVER_PORT_CANDIDATES) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }

  throw new Error(
    `Unable to start the mobile sidebar smoke because ports ${DEV_SERVER_PORT_CANDIDATES.join(" and ")} are in use.`,
  );
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

function collectProcessOutput(child: ChildProcessWithoutNullStreams): { logs: string[] } {
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

async function startFrontendDevServer(port: number): Promise<{
  baseUrl: string;
  logs: string[];
  stop: () => Promise<void>;
}> {
  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
  const child = spawn(
    npmCommand,
    ["--prefix", "frontend", "run", "dev", "--", "--hostname", "127.0.0.1", "--port", String(port)],
    {
      cwd: process.cwd(),
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  const { logs } = collectProcessOutput(child);
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    await waitForHttpReady(`${baseUrl}/overview`);
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

  return { baseUrl, logs, stop };
}

async function waitForWorkbenchReady(
  page: {
    goto(url: string, options?: { waitUntil?: "domcontentloaded" }): Promise<unknown>;
    locator(selector: string): {
      waitFor(options?: { state?: "attached" | "visible"; timeout?: number }): Promise<void>;
      innerText(): Promise<string>;
    };
  },
  baseUrl: string,
): Promise<void> {
  await page.goto(`${baseUrl}/overview`, { waitUntil: "domcontentloaded" });
  await page.locator(`#${SIDEBAR_ID}`).waitFor({ state: "attached", timeout: 90_000 });
  await page.locator(`button[aria-controls="${SIDEBAR_ID}"]`).waitFor({ state: "visible", timeout: 90_000 });

  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    const bodyText = (await page.locator("body").innerText()).toLowerCase();
    if (bodyText.includes("overview") && bodyText.includes("omegax")) {
      return;
    }

    await delay(1_000);
  }

  throw new Error("Timed out waiting for the workbench overview to render.");
}

async function readFocusSnapshot(
  page: {
    evaluate<Result, Arg>(pageFunction: (arg: Arg) => Result, arg: Arg): Promise<Result>;
  },
): Promise<FocusSnapshot> {
  return await page.evaluate((sidebarId) => {
    const sidebar = document.getElementById(sidebarId);
    const activeElement = document.activeElement as HTMLElement | null;
    return {
      ariaLabel: activeElement?.getAttribute("aria-label") ?? null,
      insideSidebar: Boolean(activeElement && sidebar?.contains(activeElement)),
      tagName: activeElement?.tagName ?? null,
      text: activeElement?.textContent?.trim().slice(0, 80) ?? null,
    };
  }, SIDEBAR_ID);
}

async function readSidebarState(
  page: {
    evaluate<Result, Arg>(pageFunction: (arg: Arg) => Result, arg: Arg): Promise<Result>;
  },
): Promise<{ ariaHidden: string | null; dataMobileHidden: string | null; inert: boolean }> {
  return await page.evaluate((sidebarId) => {
    const sidebar = document.getElementById(sidebarId) as (HTMLElement & { inert?: boolean }) | null;
    return {
      ariaHidden: sidebar?.getAttribute("aria-hidden") ?? null,
      dataMobileHidden: sidebar?.getAttribute("data-mobile-hidden") ?? null,
      inert: Boolean(sidebar?.inert),
    };
  }, SIDEBAR_ID);
}

async function tabFromDocumentStart(page: {
  evaluate<Result>(pageFunction: () => Result): Promise<Result>;
  keyboard: { press(key: string): Promise<void> };
}): Promise<FocusSnapshot> {
  await page.evaluate(() => {
    const activeElement = document.activeElement as HTMLElement | null;
    activeElement?.blur();
  });
  await page.keyboard.press("Tab");
  return await readFocusSnapshot(page);
}

async function reverseTabIntoSidebar(
  page: {
    keyboard: { press(key: string): Promise<void> };
  },
  toggle: {
    focus(): Promise<void>;
  },
): Promise<FocusSnapshot> {
  await toggle.focus();

  let focus = await readFocusSnapshot(page);
  for (let step = 0; step < 3; step += 1) {
    await page.keyboard.press("Shift+Tab");
    focus = await readFocusSnapshot(page);
    if (focus.insideSidebar) {
      return focus;
    }
  }

  return focus;
}

function assertSidebarState(
  state: { ariaHidden: string | null; dataMobileHidden: string | null; inert: boolean },
  expectedHidden: boolean,
): void {
  const expectedAriaHidden = expectedHidden ? "true" : "false";
  const expectedDataHidden = expectedHidden ? "true" : "false";
  if (state.ariaHidden !== expectedAriaHidden || state.dataMobileHidden !== expectedDataHidden || state.inert !== expectedHidden) {
    throw new Error(
      `Unexpected sidebar state. expected_hidden=${expectedHidden} actual=${JSON.stringify(state)}`,
    );
  }
}

function assertFocusLocation(focus: FocusSnapshot, shouldBeInsideSidebar: boolean, message: string): void {
  if (focus.insideSidebar !== shouldBeInsideSidebar) {
    throw new Error(`${message}. focus=${JSON.stringify(focus)}`);
  }
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log(usage());
    return;
  }

  const port = await findReusablePort();
  const server = await startFrontendDevServer(port);

  let browser: import("playwright").Browser | null = null;
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
    const context = await browser.newContext({ viewport: VIEWPORT });
    const page = await context.newPage();

    await waitForWorkbenchReady(page, server.baseUrl);

    const toggle = page.locator(`button[aria-controls="${SIDEBAR_ID}"]`);

    await page.waitForFunction((sidebarId) => {
      const sidebar = document.getElementById(sidebarId) as (HTMLElement & { inert?: boolean }) | null;
      return (
        sidebar?.getAttribute("aria-hidden") === "true"
        && sidebar?.getAttribute("data-mobile-hidden") === "true"
        && sidebar?.inert === true
      );
    }, SIDEBAR_ID);

    const hiddenState = await readSidebarState(page);
    assertSidebarState(hiddenState, true);

    const closedFocus = await tabFromDocumentStart(page);
    assertFocusLocation(closedFocus, false, "Closed mobile drawer remained tabbable");

    if ((await toggle.getAttribute("aria-expanded")) !== "false") {
      throw new Error("Expected the mobile drawer toggle to report aria-expanded=false before opening.");
    }

    await toggle.focus();
    await page.keyboard.press("Space");
    await page.waitForFunction((sidebarId) => {
      const sidebar = document.getElementById(sidebarId) as (HTMLElement & { inert?: boolean }) | null;
      return (
        sidebar?.getAttribute("aria-hidden") === "false"
        && sidebar?.getAttribute("data-mobile-hidden") === "false"
        && sidebar?.inert === false
      );
    }, SIDEBAR_ID);

    if ((await toggle.getAttribute("aria-expanded")) !== "true") {
      throw new Error("Expected the mobile drawer toggle to report aria-expanded=true after opening.");
    }

    const openFocus = await reverseTabIntoSidebar(page, toggle);
    assertFocusLocation(openFocus, true, "Opened mobile drawer did not restore sidebar tab order");

    await toggle.focus();
    await page.keyboard.press("Space");
    await page.waitForFunction((sidebarId) => {
      const sidebar = document.getElementById(sidebarId) as (HTMLElement & { inert?: boolean }) | null;
      return (
        sidebar?.getAttribute("aria-hidden") === "true"
        && sidebar?.getAttribute("data-mobile-hidden") === "true"
        && sidebar?.inert === true
      );
    }, SIDEBAR_ID);

    const rehiddenState = await readSidebarState(page);
    assertSidebarState(rehiddenState, true);

    const reopenedFocus = await tabFromDocumentStart(page);
    assertFocusLocation(reopenedFocus, false, "Closed mobile drawer re-entered tab order after being reopened");

    console.log(`[workbench-mobile-sidebar-smoke] base_url=${server.baseUrl}`);
    console.log(`[workbench-mobile-sidebar-smoke] viewport=${VIEWPORT.width}x${VIEWPORT.height}`);
    console.log(`[workbench-mobile-sidebar-smoke] closed_focus=${JSON.stringify(closedFocus)}`);
    console.log(`[workbench-mobile-sidebar-smoke] open_focus=${JSON.stringify(openFocus)}`);
    console.log(`[workbench-mobile-sidebar-smoke] status=passed`);

    await context.close();
    await server.stop();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${message}\nRecent frontend output:\n${server.logs.join("\n")}`);
  } finally {
    await browser?.close();
    await server.stop();
  }
}

void main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[workbench-mobile-sidebar-smoke] failed: ${message}`);
  process.exitCode = 1;
});
