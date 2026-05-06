#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const requiredFiles = [
  'formal_verification/certora/configs/sanity.conf',
  'formal_verification/certora/summaries/omegax_solana_inlining.txt',
  'formal_verification/certora/summaries/omegax_solana_summaries.txt',
];

const failures = [];

function run(cmd, args) {
  return spawnSync(cmd, args, { encoding: 'utf8' });
}

function commandExists(name) {
  const result = spawnSync('sh', ['-lc', `command -v ${name}`], {
    encoding: 'utf8',
  });
  return result.status === 0;
}

function log(status, label, detail) {
  console.log(`[certora:solana:check] ${status} ${label}${detail ? `: ${detail}` : ''}`);
}

function fail(label, detail) {
  failures.push({ label, detail });
  log('FAIL', label, detail);
}

function pass(label, detail) {
  log('PASS', label, detail);
}

const python = run('python3', ['--version']);
if (python.status === 0) {
  const version = (python.stdout || python.stderr).trim();
  const match = version.match(/Python\s+(\d+)\.(\d+)/);
  const major = Number(match?.[1]);
  const minor = Number(match?.[2]);
  if (major > 3 || (major === 3 && minor >= 9)) {
    pass('Python', version);
  } else {
    fail('Python', `${version || 'unknown'} detected; Certora requires Python >= 3.9`);
  }
} else {
  fail('Python', 'python3 not found in PATH');
}

const java = run('java', ['-version']);
if (java.status === 0) {
  const version = (java.stdout || java.stderr).trim().split('\n')[0] ?? '';
  const match = version.match(/version "(?:(\d+)\.)?(\d+)/);
  const major = Number(match?.[1] ?? match?.[2]);
  if (Number.isFinite(major) && major >= 21) {
    pass('Java', version);
  } else {
    fail('Java', `${version || 'unknown'} detected; Certora requires JDK >= 21`);
  }
} else {
  fail('Java', 'java not found in PATH');
}

const cargo = run('cargo', ['--version']);
if (cargo.status === 0) {
  pass('Cargo', cargo.stdout.trim());
} else {
  fail('Cargo', 'cargo not found in PATH');
}

if (commandExists('certoraSolanaProver')) {
  pass('certoraSolanaProver', 'found in PATH');
} else {
  fail('certoraSolanaProver', 'install certora-cli with `pip3 install certora-cli`');
}

const certoraSbf = run('cargo', ['certora-sbf', '--help']);
if (certoraSbf.status === 0) {
  pass('cargo certora-sbf', 'subcommand available');
} else {
  fail('cargo certora-sbf', 'install with `cargo install cargo-certora-sbf` before submitting Solana proofs');
}

if (process.env.CERTORAKEY) {
  pass('CERTORAKEY', 'set');
} else {
  fail('CERTORAKEY', 'not set; register for a free personal access key and export CERTORAKEY');
}

for (const file of requiredFiles) {
  if (existsSync(file)) {
    pass('lane file', file);
  } else {
    fail('lane file', `${file} missing`);
  }
}

if (failures.length > 0) {
  console.error(
    `[certora:solana:check] ${failures.length} blocking prerequisite(s) missing. This check does not submit a Certora job.`,
  );
  process.exit(1);
}

console.log('[certora:solana:check] all local prerequisites are present; no remote job was submitted.');
