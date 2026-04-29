#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later


import { spawnSync } from 'node:child_process';

const failures = [];
const warnings = [];

function logResult(status, label, detail) {
  const message = `[doctor] ${status} ${label}${detail ? `: ${detail}` : ''}`;
  if (status === 'FAIL') {
    failures.push(message);
  } else if (status === 'WARN') {
    warnings.push(message);
  }
  console.log(message);
}

function run(cmd, args) {
  return spawnSync(cmd, args, { encoding: 'utf8' });
}

const nodeMajor = Number(process.versions.node.split('.')[0]);
if (Number.isFinite(nodeMajor) && nodeMajor >= 20) {
  logResult('PASS', 'Node.js', process.version);
} else {
  logResult('FAIL', 'Node.js', `detected ${process.version}; require >= 20`);
}

const npm = run('npm', ['--version']);
if (npm.status === 0) {
  logResult('PASS', 'npm', npm.stdout.trim());
} else {
  logResult('FAIL', 'npm', 'not found in PATH');
}

const anchor = run('anchor', ['--version']);
if (anchor.status === 0) {
  logResult('PASS', 'Anchor', anchor.stdout.trim() || anchor.stderr.trim());
} else {
  logResult('FAIL', 'Anchor', 'not found in PATH');
}

const cargo = run('cargo', ['--version']);
if (cargo.status === 0) {
  logResult('PASS', 'Cargo', cargo.stdout.trim());
} else {
  logResult('FAIL', 'Cargo', 'not found in PATH');
}

if (failures.length > 0) {
  console.error(`[doctor] environment check failed with ${failures.length} blocking issue(s).`);
  process.exit(1);
}

console.log(
  warnings.length > 0
    ? `[doctor] completed with ${warnings.length} warning(s).`
    : '[doctor] all checks passed.',
);
