// SPDX-License-Identifier: AGPL-3.0-or-later

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const repoRoot = process.cwd();

const forbiddenPathMatchers = [
  { matcher: /^\.anchor(?:\/|$)/, reason: 'Anchor local state must not be published.' },
  { matcher: /^test-ledger(?:\/|$)/, reason: 'Local ledger artifacts must not be published.' },
  { matcher: /^tmp(?:\/|$)/, reason: 'Temporary local files must not be published.' },
  { matcher: /^output(?:\/|$)/, reason: 'Generated local output must not be published.' },
  { matcher: /^frontend\/\.next(?:\/|$)/, reason: 'Next build artifacts must not be published.' },
  { matcher: /^frontend\/\.next-dev-/, reason: 'Next dev caches must not be published.' },
  { matcher: /^frontend\/tsconfig\.tsbuildinfo$/, reason: 'TypeScript build info must not be published.' },
  { matcher: /^frontend\/apphosting(?:\.[^.]+)*\.local\.ya?ml$/, reason: 'Local App Hosting overrides must stay out of git.' },
  { matcher: /^frontend\/\.env\.local$/, reason: 'Local frontend env files must stay out of git.' },
  { matcher: /^\.keys(?:\/|$)/, reason: 'Local key material must stay out of git.' },
  { matcher: /\.(?:pem|key|crt|p12)$/i, reason: 'Certificate and key files must stay out of git.' },
  { matcher: /\.log$/i, reason: 'Log files must stay out of git.' },
];

const forbiddenContentMatchers = [
  {
    matcher: /babita-j7o2oc-fast-devnet\.helius-rpc\.com/g,
    reason: 'Private devnet RPC endpoint found.',
  },
  {
    matcher: /liza-evdqtg-fast-mainnet\.helius-rpc\.com/g,
    reason: 'Private mainnet RPC endpoint found.',
  },
  {
    matcher: /omegaxhealth_services/g,
    reason: 'Private sibling service reference found.',
  },
  {
    matcher: /\.\.\/omegax-sdk/g,
    reason: 'Protocol snapshot must not depend on a sibling SDK checkout.',
  },
  {
    matcher: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g,
    reason: 'Private key material found.',
  },
  {
    matcher: /\bAKIA[0-9A-Z]{16}\b/g,
    reason: 'AWS access key pattern found.',
  },
  {
    matcher: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}\b/g,
    reason: 'GitHub token pattern found.',
  },
  {
    matcher: /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g,
    reason: 'GitHub fine-grained token pattern found.',
  },
  {
    matcher: /\bsk-[A-Za-z0-9]{20,}\b/g,
    reason: 'OpenAI-style secret token pattern found.',
  },
];

const sensitiveEnvKeys = new Set([
  'FAUCET_INTERNAL_API_TOKEN',
  'FAUCET_INTERNAL_API_TOKEN_V2',
  'FAUCET_CHALLENGE_SECRET',
  'TURNSTILE_SECRET_KEY',
]);

const appHostingSecretKeys = new Set([
  'FAUCET_INTERNAL_BASE_URL',
  'FAUCET_INTERNAL_BASE_URL_V2',
  'FAUCET_INTERNAL_API_TOKEN',
  'FAUCET_INTERNAL_API_TOKEN_V2',
  'FAUCET_CHALLENGE_SECRET',
  'TURNSTILE_SECRET_KEY',
]);

const allowedSensitiveValues = new Set([
  '',
  'REPLACE_IN_SECRET_STORE',
]);

// Maintainer-only workspace sync intentionally references sibling repositories and
// is therefore excluded from the public-repo content scan.
const selfScanningExclusions = new Set([
  'scripts/check_public_repo_hygiene.mjs',
  'scripts/check_workspace_sync.mjs',
]);

function listRepoFiles() {
  const output = execFileSync(
    'git',
    ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
    { cwd: repoRoot },
  );

  return output
    .toString('utf8')
    .split('\0')
    .filter(Boolean)
    .sort();
}

function isTextFile(path) {
  try {
    const buffer = readFileSync(path);
    return !buffer.includes(0);
  } catch {
    return false;
  }
}

function normalizeEnvValue(value) {
  const trimmed = value.trim().replace(/^['"]|['"]$/g, '');
  return trimmed;
}

function collectSensitiveAssignmentIssues(path, content) {
  const issues = [];

  for (const [index, rawLine] of content.split('\n').entries()) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const envMatch = rawLine.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!envMatch) {
      continue;
    }

    const key = envMatch[1];
    const value = normalizeEnvValue(envMatch[2] ?? '');
    if (!key || !sensitiveEnvKeys.has(key)) {
      continue;
    }

    if (!allowedSensitiveValues.has(value)) {
      issues.push(`${path}:${index + 1} sensitive variable ${key} must be blank or use REPLACE_IN_SECRET_STORE.`);
    }
  }

  return issues;
}

function collectAppHostingIssues(path, content) {
  if (!/^frontend\/apphosting(?:\.[^.]+)?\.ya?ml$/.test(path)) {
    return [];
  }

  const issues = [];
  const lines = content.split('\n');
  let currentKey = null;
  let currentSecret = null;
  let currentValue = null;
  let currentLine = 0;

  function flushCurrent() {
    if (!currentKey || !appHostingSecretKeys.has(currentKey)) {
      currentKey = null;
      currentSecret = null;
      currentValue = null;
      currentLine = 0;
      return;
    }

    const normalizedValue =
      currentValue == null ? null : normalizeEnvValue(String(currentValue));
    const normalizedSecret =
      currentSecret == null ? null : normalizeEnvValue(String(currentSecret));

    if (!normalizedSecret) {
      issues.push(
        `${path}:${currentLine} ${currentKey} must use a Secret Manager reference via secret:.`,
      );
    }

    if (normalizedValue && normalizedValue !== 'REPLACE_IN_SECRET_STORE') {
      issues.push(
        `${path}:${currentLine} ${currentKey} must not use a plaintext value in tracked App Hosting config.`,
      );
    }

    currentKey = null;
    currentSecret = null;
    currentValue = null;
    currentLine = 0;
  }

  for (const [index, rawLine] of lines.entries()) {
    const variableMatch = rawLine.match(/^\s*-\s*variable:\s*([A-Z0-9_]+)\s*$/);
    if (variableMatch) {
      flushCurrent();
      currentKey = variableMatch[1] ?? null;
      currentLine = index + 1;
      continue;
    }

    if (!currentKey) {
      continue;
    }

    const secretMatch = rawLine.match(/^\s*secret:\s*(.+?)\s*$/);
    if (secretMatch) {
      currentSecret = secretMatch[1] ?? '';
      continue;
    }

    const valueMatch = rawLine.match(/^\s*value:\s*(.+?)\s*$/);
    if (valueMatch) {
      currentValue = valueMatch[1] ?? '';
    }
  }

  flushCurrent();
  return issues;
}

const files = listRepoFiles();
const issues = [];

for (const file of files) {
  for (const rule of forbiddenPathMatchers) {
    if (rule.matcher.test(file)) {
      issues.push(`${file} ${rule.reason}`);
    }
  }

  if (!isTextFile(file)) {
    continue;
  }

  const content = readFileSync(file, 'utf8');

  if (!selfScanningExclusions.has(file)) {
    for (const rule of forbiddenContentMatchers) {
      if (rule.matcher.test(content)) {
        issues.push(`${file} ${rule.reason}`);
      }
    }
  }

  for (const issue of collectSensitiveAssignmentIssues(file, content)) {
    issues.push(issue);
  }

  for (const issue of collectAppHostingIssues(file, content)) {
    issues.push(issue);
  }
}

if (issues.length > 0) {
  process.stderr.write('[public:hygiene:check] publish blockers detected:\n');
  for (const issue of issues) {
    process.stderr.write(`- ${issue}\n`);
  }
  process.exit(1);
}

process.stdout.write('[public:hygiene:check] no publish blockers detected in the working tree.\n');
