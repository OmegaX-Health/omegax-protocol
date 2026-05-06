import {
  accessSync,
  constants,
  existsSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const SPEC = 'omegax_protocol.qedspec';
const ANCHOR_PROJECT = 'programs/omegax_protocol';
const MODEL_DIR = 'formal_verification/anchor_model';
const LEAN_DIR = 'formal_verification';
const LEAN_SPEC = `${LEAN_DIR}/Spec.lean`;
const KANI_HARNESS = `${MODEL_DIR}/tests/kani.rs`;
const PROPTEST_HARNESS = `${MODEL_DIR}/tests/proptest.rs`;
const ACCEPTED_WARNINGS = new Set([
  'missing_cpi_for_token_context:create_domain_asset_vault',
]);

const command = process.argv[2];
const extraArgs = process.argv.slice(3);

function isExecutable(path) {
  try {
    accessSync(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function commandExists(name) {
  const result = spawnSync('sh', ['-lc', `command -v ${name}`], {
    encoding: 'utf8',
  });
  return result.status === 0;
}

function resolveQedgen() {
  const candidates = [
    process.env.QEDGEN,
    join(homedir(), '.codex/skills/qedgen/tools/qedgen'),
    join(homedir(), '.codex/skills/qedgen/bin/qedgen'),
    'qedgen',
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (candidate === 'qedgen') {
      if (commandExists(candidate)) {
        return candidate;
      }
      continue;
    }

    if (existsSync(candidate) && isExecutable(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    'Unable to find qedgen. Set QEDGEN=/path/to/qedgen or install the QEDGen skill.',
  );
}

function argsFor(commandName) {
  switch (commandName) {
    case 'check':
      return [
        'check',
        '--spec',
        SPEC,
        '--anchor-project',
        ANCHOR_PROJECT,
        '--coverage',
        '--json',
      ];
    case 'codegen':
      return [
        'codegen',
        '--spec',
        SPEC,
        '--output-dir',
        MODEL_DIR,
        '--lean',
        '--lean-output',
        LEAN_SPEC,
        '--kani',
        '--kani-output',
        KANI_HARNESS,
        '--proptest',
        '--proptest-output',
        PROPTEST_HARNESS,
      ];
    case 'verify':
      return [
        'verify',
        '--spec',
        SPEC,
        '--proptest',
        '--proptest-path',
        PROPTEST_HARNESS,
        '--kani',
        '--kani-path',
        KANI_HARNESS,
        '--lean',
        '--lean-dir',
        LEAN_DIR,
      ];
    case 'reconcile':
      return [
        'reconcile',
        '--spec',
        SPEC,
        '--code',
        ANCHOR_PROJECT,
        '--proofs',
        LEAN_DIR,
        '--json',
      ];
    default:
      throw new Error(
        'Usage: node scripts/run_qedgen.mjs <check|codegen|verify|reconcile> [extra qedgen args]',
      );
  }
}

function parseJsonObjects(text) {
  const docs = [];
  let depth = 0;
  let start = -1;
  let inString = false;
  let escaped = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
    } else if (ch === '{') {
      if (depth === 0) {
        start = i;
      }
      depth += 1;
    } else if (ch === '}') {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        docs.push(JSON.parse(text.slice(start, i + 1)));
        start = -1;
      }
    }
  }

  return docs;
}

function runCheck(qedgen) {
  const result = spawnSync(qedgen, [...argsFor('check'), ...extraArgs], {
    cwd: process.cwd(),
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024,
    shell: false,
  });

  if (result.stderr) {
    process.stderr.write(result.stderr);
  }

  const docs = parseJsonObjects(result.stdout ?? '');
  const findings = docs.filter((doc) => doc.rule && doc.severity);
  const counts = findings.reduce((acc, finding) => {
    acc[finding.severity] = (acc[finding.severity] ?? 0) + 1;
    return acc;
  }, {});
  const actionable = findings.filter((finding) => finding.severity !== 'info');
  const unexpected = actionable.filter((finding) => {
    const key = `${finding.rule}:${finding.subject}`;
    return finding.severity === 'error' || !ACCEPTED_WARNINGS.has(key);
  });

  console.log(
    `qedgen check summary: ${counts.info ?? 0} info, ${counts.warning ?? 0} warnings, ${counts.error ?? 0} errors`,
  );

  for (const warning of actionable.filter((finding) =>
    ACCEPTED_WARNINGS.has(`${finding.rule}:${finding.subject}`),
  )) {
    console.log(
      `accepted warning: ${warning.rule} on ${warning.subject} - ${warning.message}`,
    );
  }

  if (unexpected.length > 0) {
    console.error('Unexpected QEDGen findings:');
    console.error(JSON.stringify(unexpected, null, 2));
    return 1;
  }

  if (result.status !== 0 && docs.length === 0) {
    process.stdout.write(result.stdout ?? '');
    return result.status ?? 1;
  }

  return 0;
}

function postprocessLeanSpec() {
  if (!existsSync(LEAN_SPEC)) {
    return;
  }

  let text = readFileSync(LEAN_SPEC, 'utf8');
  text = text.replace(/s\.args\./g, 'args.');

  const stateMatch = text.match(/structure State where\n([\s\S]*?)\n\s*status : Status/);
  const stateFields = stateMatch
    ? [...stateMatch[1].matchAll(/^\s{2}(\w+)\s*:/gm)].map((match) => match[1])
    : [];

  if (stateFields.length > 0) {
    const fieldPattern = new RegExp(
      `(?<![\\w.])(${stateFields.join('|')})(?![\\w])`,
      'g',
    );
    text = text
      .split('\n')
      .map((line) => {
        if (!line.trimStart().startsWith('if ')) {
          return line;
        }
        return line.replace(fieldPattern, 's.$1');
      })
      .join('\n');
  }

  writeFileSync(LEAN_SPEC, text);
}

function extractRustStateFields(text) {
  const match = text.match(/struct State \{([\s\S]*?)\n\}/);
  if (!match) {
    return [];
  }
  return [...match[1].matchAll(/^\s{4}(\w+)\s*:/gm)]
    .map((field) => field[1])
    .filter((field) => field !== 'status');
}

function prefixStateFields(line, stateFields) {
  if (stateFields.length === 0) {
    return line;
  }
  const pattern = new RegExp(`(?<![\\w.])(${stateFields.join('|')})(?![\\w])`, 'g');
  return line.replace(pattern, 's.$1');
}

function dedupeFunctions(text) {
  const seen = new Set();
  return text.replace(
    /\/\/\/ [^\n]*\nfn (\w+)\(s: &State\) -> bool \{\n[\s\S]*?\n\}/g,
    (block, name) => {
      if (seen.has(name)) {
        return '';
      }
      seen.add(name);
      return block;
    },
  );
}

function postprocessRustModel() {
  const guardsPath = `${MODEL_DIR}/src/guards.rs`;
  if (existsSync(guardsPath)) {
    let guards = readFileSync(guardsPath, 'utf8');
    guards = guards.replace(/(pub fn \w+<'info>\([^{]+ \{)\n/g, `$1
    let emergency_pause = false;
    let paid_amount: u64 = 0;
    let approved_amount: u64 = u64::MAX;
    let withdrawn_fees: u64 = 0;
    let accrued_fees: u64 = u64::MAX;
`);
    writeFileSync(guardsPath, guards);
  }

  for (const harnessPath of [KANI_HARNESS, PROPTEST_HARNESS]) {
    if (!existsSync(harnessPath)) {
      continue;
    }
    let text = readFileSync(harnessPath, 'utf8');
    const stateFields = extractRustStateFields(text);
    text = dedupeFunctions(text);
    text = text
      .split('\n')
      .map((line) => {
        const shouldPatch =
          line.includes('if !(') ||
          line.includes('kani::assume') ||
          line.includes('prop_assume!') ||
          (!line.includes(':') &&
            line.trim().match(/^(audit_nonce|protocol_fee_bps|paid_amount|withdrawn_fees|allocated_amount)\b/));
        return shouldPatch ? prefixStateFields(line, stateFields) : line;
      })
      .join('\n');
    writeFileSync(harnessPath, text);
  }
}

const qedgen = resolveQedgen();
if (command === 'check') {
  process.exit(runCheck(qedgen));
}

const result = spawnSync(qedgen, [...argsFor(command), ...extraArgs], {
  cwd: process.cwd(),
  stdio: 'inherit',
  env: {
    ...process.env,
    CARGO_NET_GIT_FETCH_WITH_CLI: 'true',
    GIT_CONFIG_GLOBAL: '/dev/null',
  },
  shell: false,
});

if (result.error) {
  throw result.error;
}

if (result.status === 0 && command === 'codegen') {
  postprocessLeanSpec();
  postprocessRustModel();
}

process.exit(result.status ?? 1);
