#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later


import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const repoRoot = process.cwd();
const androidNativeDir = resolve(repoRoot, 'android-native');
const androidLocalPropertiesPath = resolve(androidNativeDir, 'local.properties');

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

function parseJavaMajorFromVersionText(text) {
  const quoted = text.match(/version "([^"]+)"/);
  if (!quoted) {
    return null;
  }
  const raw = quoted[1];
  if (raw.startsWith('1.')) {
    const major = Number(raw.split('.')[1]);
    return Number.isFinite(major) ? major : null;
  }
  const major = Number(raw.split('.')[0]);
  return Number.isFinite(major) ? major : null;
}

function parseSdkDirFromLocalProperties(path) {
  if (!existsSync(path)) {
    return null;
  }
  const content = readFileSync(path, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.startsWith('#') || trimmed.length === 0) {
      continue;
    }
    if (!trimmed.startsWith('sdk.dir=')) {
      continue;
    }
    const value = trimmed.slice('sdk.dir='.length).trim();
    if (value.length === 0) {
      return null;
    }
    return value.replace(/\\:/g, ':').replace(/\\\\/g, '\\');
  }
  return null;
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

const java = run('java', ['-version']);
if (java.status !== 0) {
  logResult('WARN', 'Java', 'not found in PATH (Android tasks will fail)');
} else {
  const javaVersionText = `${java.stdout}${java.stderr}`.trim();
  const javaMajor = parseJavaMajorFromVersionText(javaVersionText);
  if (javaMajor === null) {
    logResult('WARN', 'Java', 'installed but version could not be parsed');
  } else if (javaMajor < 17 || javaMajor > 21) {
    let hint = 'Android build expects JDK 17-21.';
    if (
      process.platform === 'darwin' &&
      existsSync('/Library/Java/JavaVirtualMachines/temurin-17.jdk/Contents/Home')
    ) {
      hint +=
        ' On macOS you can use: JAVA_HOME=/Library/Java/JavaVirtualMachines/temurin-17.jdk/Contents/Home';
    }
    logResult('WARN', 'Java', `detected ${javaMajor}. ${hint}`);
  } else {
    logResult('PASS', 'Java', `major ${javaMajor}`);
  }
}

const sdkDirCandidates = [
  process.env.ANDROID_HOME,
  process.env.ANDROID_SDK_ROOT,
  parseSdkDirFromLocalProperties(androidLocalPropertiesPath),
].filter(Boolean);

const sdkDir = sdkDirCandidates.find((candidate) => existsSync(candidate));
if (sdkDir) {
  logResult('PASS', 'Android SDK', sdkDir);
} else {
  logResult(
    'WARN',
    'Android SDK',
    'not configured. Set ANDROID_HOME / ANDROID_SDK_ROOT or android-native/local.properties (sdk.dir=...)',
  );
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
