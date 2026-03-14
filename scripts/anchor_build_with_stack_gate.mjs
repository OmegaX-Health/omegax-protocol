#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later


import { spawn } from 'node:child_process';

const STACK_WARNING_PATTERNS = [
  /Stack offset of \d+ exceeded max offset of \d+/i,
  /overwrites values in the frame/i,
];

// Known verifier false-positive currently emitted from core sort internals in some
// Solana/LLVM toolchain combinations. We only ignore this exact symbol.
const STACK_WARNING_IGNORE_PATTERNS = [
  /method _ZN4core5slice4sort6stable14driftsort_main/i,
];

const KNOWN_CARGO_BUILD_SBF_SYSCALLS = new Set([
  "abort",
  "sol_create_program_address",
  "sol_get_clock_sysvar",
  "sol_get_rent_sysvar",
  "sol_invoke_signed_rust",
  "sol_log_",
  "sol_log_data",
  "sol_log_pubkey",
  "sol_memcmp_",
  "sol_memcpy_",
  "sol_memset_",
  "sol_sha256",
  "sol_try_find_program_address",
]);
const CARGO_BUILD_SBF_UNKNOWN_SYSCALLS_PATTERN = /undefined and not known syscalls \[(.*)\]/i;
const CARGO_BUILD_SBF_FOLLOWUP_PATTERN = /Calling them will trigger a run-time error\./i;

function extractQuotedTokens(value) {
  return Array.from(value.matchAll(/"([^"]+)"/g), (match) => match[1]);
}

function isKnownCargoBuildSbfFalsePositive(line) {
  const match = line.match(CARGO_BUILD_SBF_UNKNOWN_SYSCALLS_PATTERN);
  if (!match) {
    return false;
  }

  const syscalls = extractQuotedTokens(match[1]);
  return syscalls.length > 0 && syscalls.every((syscall) => KNOWN_CARGO_BUILD_SBF_SYSCALLS.has(syscall));
}

function collectActionableStackWarnings(output) {
  const lines = output.split(/\r?\n/);
  const actionable = [];

  for (const line of lines) {
    if (!STACK_WARNING_PATTERNS.some((pattern) => pattern.test(line))) {
      continue;
    }
    if (STACK_WARNING_IGNORE_PATTERNS.some((pattern) => pattern.test(line))) {
      continue;
    }
    actionable.push(line.trim());
  }

  return actionable;
}

const child = spawn('anchor', ['build'], {
  stdio: ['inherit', 'pipe', 'pipe'],
});

let combinedOutput = '';
let ignoredStackWarningCount = 0;
let ignoredCargoBuildSbfWarningCount = 0;

function createStreamHandler(writer) {
  let buffer = '';
  let suppressCargoBuildSbfFollowup = false;
  return (chunk) => {
    const text = chunk.toString();
    combinedOutput += text;

    buffer += text;
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (isKnownCargoBuildSbfFalsePositive(line)) {
        ignoredCargoBuildSbfWarningCount += 1;
        suppressCargoBuildSbfFollowup = true;
        continue;
      }
      if (suppressCargoBuildSbfFollowup && CARGO_BUILD_SBF_FOLLOWUP_PATTERN.test(line)) {
        ignoredCargoBuildSbfWarningCount += 1;
        suppressCargoBuildSbfFollowup = false;
        continue;
      }
      suppressCargoBuildSbfFollowup = false;

      if (STACK_WARNING_IGNORE_PATTERNS.some((pattern) => pattern.test(line))) {
        ignoredStackWarningCount += 1;
        continue;
      }
      writer.write(`${line}\n`);
    }
  };
}

child.stdout.on('data', createStreamHandler(process.stdout));
child.stderr.on('data', createStreamHandler(process.stderr));

child.on('error', (error) => {
  console.error(`[anchor:build:checked] failed to start anchor build: ${error.message}`);
  process.exit(1);
});

child.on('close', (code) => {
  if (code !== 0) {
    process.exit(code ?? 1);
    return;
  }

  const actionableWarnings = collectActionableStackWarnings(combinedOutput);
  if (actionableWarnings.length > 0) {
    console.error('[anchor:build:checked] detected stack frame risk warning in build output');
    for (const warning of actionableWarnings) {
      console.error(`[anchor:build:checked] warning: ${warning}`);
    }
    process.exit(1);
    return;
  }

  if (ignoredStackWarningCount > 0) {
    console.log(
      `[anchor:build:checked] ignored ${ignoredStackWarningCount} known verifier false-positive line(s) for driftsort_main`,
    );
  }
  if (ignoredCargoBuildSbfWarningCount > 0) {
    console.log(
      `[anchor:build:checked] ignored ${ignoredCargoBuildSbfWarningCount} known cargo_build_sbf syscall false-positive line(s)`,
    );
  }
  console.log('[anchor:build:checked] build passed with no stack overflow warnings');
});
