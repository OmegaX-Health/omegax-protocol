// SPDX-License-Identifier: AGPL-3.0-or-later

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function readText(path: string): string {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

test("firebase.json targets the shared protocol App Hosting backend", () => {
  const parsed = JSON.parse(readText("../firebase.json")) as {
    apphosting?: Array<{ backendId?: string; rootDir?: string }>;
  };

  assert.ok(Array.isArray(parsed.apphosting));
  const protocolBackend = parsed.apphosting.find((entry) => entry.backendId === "omegax-health-protocol");
  assert.ok(protocolBackend);
  assert.equal(protocolBackend?.rootDir, "frontend");
});

test("public frontend deployment config omits faucet and captcha variables", () => {
  const appHostingConfig = readText("../frontend/apphosting.yaml");
  const envExample = readText("../frontend/.env.example");

  for (const key of [
    "NEXT_PUBLIC_FAUCET_ENABLED",
    "NEXT_PUBLIC_FAUCET_MINT",
    "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
    "FAUCET_SKIP_CAPTCHA",
    "FAUCET_INTERNAL_BASE_URL",
    "FAUCET_INTERNAL_API_TOKEN",
    "FAUCET_CHALLENGE_SECRET",
    "TURNSTILE_SECRET_KEY",
  ]) {
    assert.doesNotMatch(appHostingConfig, new RegExp(`\\b${key}\\b`));
    assert.doesNotMatch(envExample, new RegExp(`^${key}=`, "m"));
  }

  assert.match(appHostingConfig, /\bNEXT_PUBLIC_SOURCE_REPO_URL\b/);
  assert.match(envExample, /^NEXT_PUBLIC_SOURCE_REPO_URL=/m);
});

test("firebase project bindings stay local-only", () => {
  const gitignore = readText("../.gitignore");
  const hygieneCheck = readText("../scripts/check_public_repo_hygiene.mjs");

  assert.match(gitignore, /^\.firebaserc$/m);
  assert.match(gitignore, /^\.firebase\/$/m);
  assert.match(hygieneCheck, /Firebase project aliases must stay local in the public repo/);
  assert.match(hygieneCheck, /Firebase local state must not be published/);
});
