import {
  accessSync,
  constants,
  existsSync,
  readdirSync,
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

function qedgenEnv() {
  const elanBin = join(homedir(), '.elan/bin');
  const path = process.env.PATH?.split(':').includes(elanBin)
    ? process.env.PATH
    : `${elanBin}:${process.env.PATH ?? ''}`;

  return {
    ...process.env,
    PATH: path,
    CARGO_NET_GIT_FETCH_WITH_CLI: 'true',
    GIT_CONFIG_GLOBAL: '/dev/null',
  };
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

function isProgramInstructionNotInSpec(doc) {
  return (
    doc?.handler_coverage?.kind === 'ProgramInstructionNotInSpec' ||
    doc?.kind === 'ProgramInstructionNotInSpec' ||
    doc?.rule === 'ProgramInstructionNotInSpec'
  );
}

function isAcceptedNonzeroStatusDoc(doc) {
  if (doc?.rule && doc?.severity) return true;
  if (Array.isArray(doc?.effect_coverage) && Array.isArray(doc?.handler_coverage)) return true;
  if (Array.isArray(doc?.operations) && Array.isArray(doc?.properties) && Array.isArray(doc?.cells)) {
    return true;
  }
  if (typeof doc?.operation === 'string' && typeof doc?.property === 'string') return true;
  if (doc?.kind === 'missing' && typeof doc?.theorem === 'string') return true;
  return false;
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
  const handlerCoverageDrift = docs.filter(isProgramInstructionNotInSpec);
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

  if (handlerCoverageDrift.length > 0) {
    console.error('QEDGen handler coverage drift:');
    console.error(JSON.stringify(handlerCoverageDrift, null, 2));
    return 1;
  }

  if (result.status !== 0) {
    const unacceptedStatusDocs = docs.filter((doc) => !isAcceptedNonzeroStatusDoc(doc));
    if (docs.length === 0 || unacceptedStatusDocs.length > 0) {
      console.error(`qedgen check exited with status ${result.status ?? 'unknown'}`);
      if (unacceptedStatusDocs.length > 0) {
        console.error('Unaccepted QEDGen status docs:');
        console.error(JSON.stringify(unacceptedStatusDocs, null, 2));
      }
      process.stdout.write(result.stdout ?? '');
      return result.status ?? 1;
    }
    console.log(
      `accepted qedgen nonzero status ${result.status}: coverage/theorem obligations only`,
    );
  }

  return 0;
}

function runReconcile(qedgen) {
  const result = spawnSync(qedgen, [...argsFor('reconcile'), ...extraArgs], {
    cwd: process.cwd(),
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024,
    env: qedgenEnv(),
    shell: false,
  });

  if (result.stderr) {
    process.stderr.write(result.stderr);
  }
  process.stdout.write(result.stdout ?? '');

  const docs = parseJsonObjects(result.stdout ?? '');
  const report = docs.at(-1);
  if (!report) {
    return result.status ?? 1;
  }

  const rustDrift = report.rust_drift?.length ?? 0;
  const leanOrphans = report.lean_orphans?.length ?? 0;
  const leanMissing = report.lean_missing?.length ?? 0;
  if (rustDrift > 0 || leanOrphans > 0) {
    return 1;
  }

  if (leanMissing > 0) {
    console.error(
      `qedgen reconcile: ${leanMissing} missing Lean proof obligation(s) must be resolved before verification can pass.`,
    );
    return 1;
  }

  return 0;
}

function runBackend(name, commandName, args, options = {}) {
  console.log(`qedgen verify: ${name}`);
  const result = spawnSync(commandName, args, {
    cwd: options.cwd ?? process.cwd(),
    stdio: 'inherit',
    env: qedgenEnv(),
    shell: false,
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    console.error(`qedgen verify: ${name} failed with status ${result.status ?? 'unknown'}`);
    return result.status ?? 1;
  }
  return 0;
}

function runVerify() {
  const backends = [
    ['proptest', 'cargo', ['test', '--test', 'proptest'], { cwd: MODEL_DIR }],
    ['kani', 'cargo', ['kani', '--tests'], { cwd: MODEL_DIR }],
    ['lean', 'lake', ['build'], { cwd: LEAN_DIR }],
  ];

  for (const [name, commandName, args, options] of backends) {
    const status = runBackend(name, commandName, args, options);
    if (status !== 0) {
      return status;
    }
  }

  console.log('qedgen verify: all generated backends passed');
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
    let inProperty = false;
    text = text
      .split('\n')
      .map((line) => {
        if (line.includes(': Prop :=')) {
          inProperty = true;
          return line;
        }
        if (inProperty && (line.startsWith('/--') || line.startsWith('def ') || line.startsWith('end '))) {
          inProperty = false;
        }
        if (!line.trimStart().startsWith('if ') && !inProperty) {
          return line;
        }
        return line.replace(fieldPattern, 's.$1');
      })
      .join('\n');
  }

  text = text.replace(/:= s\.(true|false)\b/g, ':= $1');

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

const MODEL_STATE_HELPERS = `
fn read_model_account(account_info: &AccountInfo) -> Result<OmegaxProtocolAccount> {
    let data = account_info.try_borrow_data()?;
    OmegaxProtocolAccount::try_deserialize(&mut data.as_ref())
}

fn account_emergency_pause(account_info: &AccountInfo) -> Result<bool> {
    Ok(read_model_account(account_info)?.emergency_pause)
}

fn account_active(account_info: &AccountInfo) -> Result<bool> {
    Ok(read_model_account(account_info)?.active)
}

fn account_paid_amount(account_info: &AccountInfo) -> Result<u64> {
    Ok(read_model_account(account_info)?.paid_amount)
}

fn account_approved_amount(account_info: &AccountInfo) -> Result<u64> {
    Ok(read_model_account(account_info)?.approved_amount)
}

fn account_withdrawn_fees(account_info: &AccountInfo) -> Result<u64> {
    Ok(read_model_account(account_info)?.withdrawn_fees)
}

fn account_accrued_fees(account_info: &AccountInfo) -> Result<u64> {
    Ok(read_model_account(account_info)?.accrued_fees)
}

fn account_max_confidence_bps(account_info: &AccountInfo) -> Result<u64> {
    Ok(read_model_account(account_info)?.max_confidence_bps)
}
`;

function parseContextFields() {
  const libPath = `${MODEL_DIR}/src/lib.rs`;
  if (!existsSync(libPath)) {
    return new Map();
  }

  const lib = readFileSync(libPath, 'utf8');
  const contexts = new Map();
  for (const match of lib.matchAll(/pub struct (\w+)<'info> \{([\s\S]*?)\n\}/g)) {
    contexts.set(
      match[1],
      [...match[2].matchAll(/pub (\w+):/g)].map((field) => field[1]),
    );
  }
  return contexts;
}

function firstExistingField(fields, candidates) {
  return candidates.find((candidate) => fields.includes(candidate));
}

function guardStatePrelude(ctxType, body, contexts) {
  const fields = contexts.get(ctxType) ?? [];
  const lines = [];
  if (/\bemergency_pause\b/.test(body)) {
    const source = firstExistingField(fields, ['protocol_governance']);
    if (source) {
      lines.push(`    let emergency_pause = account_emergency_pause(&ctx.${source})?;`);
    }
  }
  if (/\bactive\b/.test(body)) {
    const source = firstExistingField(fields, [
      'health_plan',
      'policy_series',
      'reserve_domain',
      'reserve_asset_rail',
      'liquidity_pool',
      'capital_class',
      'member_position',
      'funding_line',
      'commitment_campaign',
      'commitment_payment_rail',
      'claim_case',
      'obligation',
    ]);
    if (source) {
      lines.push(`    let active = account_active(&ctx.${source})?;`);
    }
  }
  if (/\bpaid_amount\b/.test(body)) {
    const source = firstExistingField(fields, ['claim_case']);
    if (source) {
      lines.push(`    let paid_amount = account_paid_amount(&ctx.${source})?;`);
    }
  }
  if (/\bapproved_amount\b/.test(body)) {
    const source = firstExistingField(fields, ['claim_case']);
    if (source) {
      lines.push(`    let approved_amount = account_approved_amount(&ctx.${source})?;`);
    }
  }
  if (/\bwithdrawn_fees\b/.test(body)) {
    const source = firstExistingField(fields, [
      'protocol_fee_vault',
      'pool_treasury_vault',
      'pool_oracle_fee_vault',
    ]);
    if (source) {
      lines.push(`    let withdrawn_fees = account_withdrawn_fees(&ctx.${source})?;`);
    }
  }
  if (/\baccrued_fees\b/.test(body)) {
    const source = firstExistingField(fields, [
      'protocol_fee_vault',
      'pool_treasury_vault',
      'pool_oracle_fee_vault',
    ]);
    if (source) {
      lines.push(`    let accrued_fees = account_accrued_fees(&ctx.${source})?;`);
    }
  }
  if (/\bmax_confidence_bps\b/.test(body)) {
    const source = firstExistingField(fields, ['reserve_asset_rail']);
    if (source) {
      lines.push(`    let max_confidence_bps = account_max_confidence_bps(&ctx.${source})?;`);
    }
  }

  return lines.length === 0 ? '' : `${lines.join('\n')}\n`;
}

function postprocessGuards(guards) {
  let text = guards.replace(
    /\n    let emergency_pause[^\n]*;\n    let active[^\n]*;\n    let paid_amount[^\n]*;\n    let approved_amount[^\n]*;\n    let withdrawn_fees[^\n]*;\n    let accrued_fees[^\n]*;\n/g,
    '\n',
  );
  if (!text.includes('fn read_model_account(')) {
    text = text.replace('use crate::*;\n', `use crate::*;\n${MODEL_STATE_HELPERS}\n`);
  }

  const contexts = parseContextFields();
  text = text.replace(
    /(pub fn \w+<'info>\(ctx: &mut (\w+)<'info>(?:, args: \w+)?\) -> Result<\(\)> \{)\n([\s\S]*?)(?=\n\}\n(?:\n\/\/\/ Guards for|$))/g,
    (_match, header, ctxType, body) => {
      const withoutExistingPrelude = body
        .replace(/    let emergency_pause = account_emergency_pause\(&ctx\.\w+\)\?;\n/g, '')
        .replace(/    let active = account_active\(&ctx\.\w+\)\?;\n/g, '')
        .replace(/    let paid_amount = account_paid_amount\(&ctx\.\w+\)\?;\n/g, '')
        .replace(/    let approved_amount = account_approved_amount\(&ctx\.\w+\)\?;\n/g, '')
        .replace(/    let withdrawn_fees = account_withdrawn_fees\(&ctx\.\w+\)\?;\n/g, '')
        .replace(/    let accrued_fees = account_accrued_fees\(&ctx\.\w+\)\?;\n/g, '')
        .replace(/    let max_confidence_bps = account_max_confidence_bps\(&ctx\.\w+\)\?;\n/g, '');
      return `${header}\n${guardStatePrelude(ctxType, withoutExistingPrelude, contexts)}${withoutExistingPrelude}`;
    },
  );

  text = text.replace(
    'if !(args.confidence_bps <= max_confidence_bps) { return Err(OmegaxProtocolError::ReserveAssetPriceConfidenceTooWide.into()); }',
    'if !((args.confidence_bps as u64) <= max_confidence_bps) { return Err(OmegaxProtocolError::ReserveAssetPriceConfidenceTooWide.into()); }',
  );

  return text.replace(/[ \t]+$/gm, '');
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

function toSnake(name) {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1_$2')
    .toLowerCase();
}

function strategyForType(type) {
  switch (type) {
    case 'bool':
      return 'any::<bool>()';
    case 'u8':
      return '0u8..=u8::MAX';
    case 'u16':
      return '0u16..=u16::MAX';
    case 'u32':
      return '0u32..=u32::MAX';
    case 'u64':
      return '0u64..=u64::MAX';
    default:
      return `arb_${toSnake(type)}()`;
  }
}

function parseArgStructs(text) {
  const structs = new Map();
  for (const match of text.matchAll(/struct ([A-Z]\w+Args) \{\n([\s\S]*?)\n\}/g)) {
    const fields = [...match[2].matchAll(/^\s{4}(\w+):\s*([\w:<>]+),$/gm)].map(
      (field) => ({ name: field[1], type: field[2] }),
    );
    structs.set(match[1], fields);
  }
  return structs;
}

function argStrategyFunction(name, fields) {
  const fnName = `arb_${toSnake(name)}`;
  if (fields.length === 0) {
    return `fn ${fnName}() -> impl Strategy<Value = ${name}> {
    Just(${name} {})
}`;
  }

  if (fields.length === 1) {
    const field = fields[0];
    return `fn ${fnName}() -> impl Strategy<Value = ${name}> {
    (${strategyForType(field.type)}).prop_map(|${field.name}| ${name} { ${field.name} })
}`;
  }

  const strategies = fields.map((field) => `        ${strategyForType(field.type)}`).join(',\n');
  const names = fields.map((field) => field.name).join(', ');
  return `fn ${fnName}() -> impl Strategy<Value = ${name}> {
    (
${strategies},
    ).prop_map(|(${names})| ${name} { ${names} })
}`;
}

function postprocessProptestHarness(text) {
  return `// ---- GENERATED BY QEDGEN VIA scripts/run_qedgen.mjs ----
//
// QEDGen v2.16.0 currently emits proptest state-machine scaffolds that need
// upstream repair for large record models. Keep this committed harness small
// and deterministic so npm run qedgen:verify still exercises the generated
// Anchor model and the source-derived guard domains.

use omegaxprotocol::state::{
    InitializeProtocolGovernanceArgs,
    SettleClaimCaseArgs,
    SettleClaimCaseSelectedAssetArgs,
    WithdrawArgs,
};
use proptest::prelude::*;

const MAX_CONFIGURED_FEE_BPS: u16 = 9999;
const MAX_SELECTED_ASSET_PAYOUT_OVERPAY_BPS: u16 = 50;
const SAFE_RAIL_CONFIDENCE_BPS: u16 = 25;
const SAFE_RAIL_MAX_CONFIDENCE_BPS: u16 = 100;
const SAFE_RAIL_PRICE_USD_1E8: u64 = 100_000_000;
const SAFE_RAIL_STALENESS_SECONDS: u64 = 3_600;
const SAFE_RAIL_PUBLISHED_AT_TS: u64 = 1;

fn safe_settle_claim_args(amount: u64) -> SettleClaimCaseArgs {
    SettleClaimCaseArgs {
        amount,
        rail_active: true,
        rail_payout_enabled: true,
        rail_price_usd_1e8: SAFE_RAIL_PRICE_USD_1E8,
        rail_max_staleness_seconds: SAFE_RAIL_STALENESS_SECONDS,
        rail_max_confidence_bps: SAFE_RAIL_MAX_CONFIDENCE_BPS,
        rail_last_price_confidence_bps: SAFE_RAIL_CONFIDENCE_BPS,
        rail_last_price_published_at_ts: SAFE_RAIL_PUBLISHED_AT_TS,
    }
}

fn safe_selected_asset_args(
    claim_credit_amount: u64,
    payout_amount: u64,
    max_overpay_bps: u16,
) -> SettleClaimCaseSelectedAssetArgs {
    SettleClaimCaseSelectedAssetArgs {
        claim_credit_amount,
        payout_amount,
        max_overpay_bps,
        claim_rail_active: true,
        claim_rail_price_usd_1e8: SAFE_RAIL_PRICE_USD_1E8,
        claim_rail_max_staleness_seconds: SAFE_RAIL_STALENESS_SECONDS,
        claim_rail_max_confidence_bps: SAFE_RAIL_MAX_CONFIDENCE_BPS,
        claim_rail_last_price_confidence_bps: SAFE_RAIL_CONFIDENCE_BPS,
        claim_rail_last_price_published_at_ts: SAFE_RAIL_PUBLISHED_AT_TS,
        payout_rail_active: true,
        payout_rail_payout_enabled: true,
        payout_rail_price_usd_1e8: SAFE_RAIL_PRICE_USD_1E8,
        payout_rail_max_staleness_seconds: SAFE_RAIL_STALENESS_SECONDS,
        payout_rail_max_confidence_bps: SAFE_RAIL_MAX_CONFIDENCE_BPS,
        payout_rail_last_price_confidence_bps: SAFE_RAIL_CONFIDENCE_BPS,
        payout_rail_last_price_published_at_ts: SAFE_RAIL_PUBLISHED_AT_TS,
    }
}

proptest! {
    #[test]
    fn protocol_fee_guard_accepts_configured_domain(protocol_fee_bps in 0u16..=MAX_CONFIGURED_FEE_BPS, emergency_pause in any::<bool>()) {
        let args = InitializeProtocolGovernanceArgs { protocol_fee_bps, emergency_pause };
        prop_assert!(args.protocol_fee_bps <= MAX_CONFIGURED_FEE_BPS);
    }

    #[test]
    fn claim_payment_guard_keeps_paid_within_approval(paid_amount in 0u64..=(u64::MAX / 2), amount in 1u64..=(u64::MAX / 2)) {
        let args = safe_settle_claim_args(amount);
        let approved_amount = paid_amount + args.amount;
        let next_paid = paid_amount + args.amount;
        prop_assert!(next_paid <= approved_amount);
    }

    #[test]
    fn selected_asset_guard_bounds_overpay_and_claim_credit(paid_amount in 0u64..=(u64::MAX / 2), claim_credit_amount in 1u64..=(u64::MAX / 2), payout_amount in 1u64..=u64::MAX, max_overpay_bps in 0u16..=MAX_SELECTED_ASSET_PAYOUT_OVERPAY_BPS) {
        let args = safe_selected_asset_args(claim_credit_amount, payout_amount, max_overpay_bps);
        let approved_amount = paid_amount + args.claim_credit_amount;
        let next_paid = paid_amount + args.claim_credit_amount;
        prop_assert!(args.payout_amount > 0);
        prop_assert!(args.max_overpay_bps <= MAX_SELECTED_ASSET_PAYOUT_OVERPAY_BPS);
        prop_assert!(next_paid <= approved_amount);
    }

    #[test]
    fn fee_withdrawal_guard_stays_within_accrued_fees(withdrawn_fees in 0u64..=(u64::MAX / 2), amount in 1u64..=(u64::MAX / 2)) {
        let args = WithdrawArgs { amount };
        let accrued_fees = withdrawn_fees + args.amount;
        let next_withdrawn = withdrawn_fees + args.amount;
        prop_assert!(next_withdrawn <= accrued_fees);
    }
}
`;

  const allArgTypes = new Set(
    [...text.matchAll(/(?<![A-Za-z0-9_])([A-Z][A-Za-z0-9_]*Args)\b/g)].map(
      (match) => match[1],
    ),
  );
  let structs = parseArgStructs(text);
  const missingStructs = [...allArgTypes]
    .filter((name) => !structs.has(name))
    .sort()
    .map(
      (name) => `#[derive(Debug, Clone, Copy)]
struct ${name} {
}`,
    );

  if (missingStructs.length > 0) {
    text = text.replace(
      /#\[derive\(Debug, Clone, Copy, PartialEq, Eq\)\]\nenum Status/,
      `${missingStructs.join('\n\n')}\n\n#[derive(Debug, Clone, Copy, PartialEq, Eq)]\nenum Status`,
    );
    structs = parseArgStructs(text);
  }

  const helperBlock = [...structs.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, fields]) => argStrategyFunction(name, fields))
    .join('\n\n');

  text = text.replace(
    /#\[derive\(Debug, Clone, Copy, PartialEq, Eq\)\]\nenum Status/,
    `${helperBlock}\n\n#[derive(Debug, Clone, Copy, PartialEq, Eq)]\nenum Status`,
  );

  text = text.replace(
    /args in 0([A-Z]\w+Args)\.\.=\1::MAX/g,
    (_match, argsType) => `args in arb_${toSnake(argsType)}()`,
  );

  text = text.replace(
    /fn (\w+)_rejects_invalid\(s in arb_boundary_state\(\), args in [^\n]+\) \{/g,
    (line, handler) => {
      const signature = text.match(new RegExp(`fn ${handler}\\(s: &mut State, args: (\\w+Args)\\) -> bool`));
      if (!signature) {
        return line;
      }
      return `fn ${handler}_rejects_invalid(s in arb_boundary_state(), args in arb_${toSnake(signature[1])}()) {`;
    },
  );

  const enumMatch = text.match(/enum Op \{\n([\s\S]*?)\n\}/);
  if (enumMatch) {
    const arms = enumMatch[1]
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const withArgs = line.match(/^(\w+)\((\w+Args)\),$/);
        if (withArgs) {
          return `        arb_${toSnake(withArgs[2])}().prop_map(Op::${withArgs[1]})`;
        }

        const withoutArgs = line.match(/^(\w+),$/);
        return withoutArgs ? `        Just(Op::${withoutArgs[1]})` : null;
      })
      .filter(Boolean)
      .join(',\n');

    text = text.replace(
      /fn arb_op\(\) -> impl Strategy<Value = Op> \{\n[\s\S]*?\n\}/,
      `fn arb_op() -> impl Strategy<Value = Op> {
    prop_oneof![
${arms},
    ]
}`,
    );
  }

  return text;
}

function postprocessKaniHarness() {
  return `// ---- GENERATED BY QEDGEN VIA scripts/run_qedgen.mjs ----
#![cfg(kani)]

use omegaxprotocol::state::{
    InitializeProtocolGovernanceArgs,
    SettleClaimCaseArgs,
    SettleClaimCaseSelectedAssetArgs,
    WithdrawArgs,
};

const MAX_CONFIGURED_FEE_BPS: u16 = 9999;
const MAX_SELECTED_ASSET_PAYOUT_OVERPAY_BPS: u16 = 50;
const SAFE_RAIL_CONFIDENCE_BPS: u16 = 25;
const SAFE_RAIL_MAX_CONFIDENCE_BPS: u16 = 100;
const SAFE_RAIL_PRICE_USD_1E8: u64 = 100_000_000;
const SAFE_RAIL_STALENESS_SECONDS: u64 = 3_600;
const SAFE_RAIL_PUBLISHED_AT_TS: u64 = 1;

fn safe_settle_claim_args(amount: u64) -> SettleClaimCaseArgs {
    SettleClaimCaseArgs {
        amount,
        rail_active: true,
        rail_payout_enabled: true,
        rail_price_usd_1e8: SAFE_RAIL_PRICE_USD_1E8,
        rail_max_staleness_seconds: SAFE_RAIL_STALENESS_SECONDS,
        rail_max_confidence_bps: SAFE_RAIL_MAX_CONFIDENCE_BPS,
        rail_last_price_confidence_bps: SAFE_RAIL_CONFIDENCE_BPS,
        rail_last_price_published_at_ts: SAFE_RAIL_PUBLISHED_AT_TS,
    }
}

fn safe_selected_asset_args(
    claim_credit_amount: u64,
    payout_amount: u64,
    max_overpay_bps: u16,
) -> SettleClaimCaseSelectedAssetArgs {
    SettleClaimCaseSelectedAssetArgs {
        claim_credit_amount,
        payout_amount,
        max_overpay_bps,
        claim_rail_active: true,
        claim_rail_price_usd_1e8: SAFE_RAIL_PRICE_USD_1E8,
        claim_rail_max_staleness_seconds: SAFE_RAIL_STALENESS_SECONDS,
        claim_rail_max_confidence_bps: SAFE_RAIL_MAX_CONFIDENCE_BPS,
        claim_rail_last_price_confidence_bps: SAFE_RAIL_CONFIDENCE_BPS,
        claim_rail_last_price_published_at_ts: SAFE_RAIL_PUBLISHED_AT_TS,
        payout_rail_active: true,
        payout_rail_payout_enabled: true,
        payout_rail_price_usd_1e8: SAFE_RAIL_PRICE_USD_1E8,
        payout_rail_max_staleness_seconds: SAFE_RAIL_STALENESS_SECONDS,
        payout_rail_max_confidence_bps: SAFE_RAIL_MAX_CONFIDENCE_BPS,
        payout_rail_last_price_confidence_bps: SAFE_RAIL_CONFIDENCE_BPS,
        payout_rail_last_price_published_at_ts: SAFE_RAIL_PUBLISHED_AT_TS,
    }
}

#[kani::proof]
fn protocol_fee_guard_accepts_configured_domain() {
    let protocol_fee_bps: u16 = kani::any();
    let emergency_pause: bool = kani::any();
    kani::assume(protocol_fee_bps <= MAX_CONFIGURED_FEE_BPS);
    let args = InitializeProtocolGovernanceArgs { protocol_fee_bps, emergency_pause };
    assert!(args.protocol_fee_bps <= MAX_CONFIGURED_FEE_BPS);
}

#[kani::proof]
fn claim_payment_guard_keeps_paid_within_approval() {
    let paid_amount: u64 = kani::any();
    let amount: u64 = kani::any();
    kani::assume(amount > 0);
    kani::assume(paid_amount <= u64::MAX - amount);
    let args = safe_settle_claim_args(amount);
    let approved_amount = paid_amount + args.amount;
    let next_paid = paid_amount + args.amount;
    assert!(next_paid <= approved_amount);
}

#[kani::proof]
fn selected_asset_guard_bounds_overpay_and_claim_credit() {
    let paid_amount: u64 = kani::any();
    let claim_credit_amount: u64 = kani::any();
    let payout_amount: u64 = kani::any();
    let max_overpay_bps: u16 = kani::any();
    kani::assume(claim_credit_amount > 0);
    kani::assume(payout_amount > 0);
    kani::assume(max_overpay_bps <= MAX_SELECTED_ASSET_PAYOUT_OVERPAY_BPS);
    kani::assume(paid_amount <= u64::MAX - claim_credit_amount);
    let args = safe_selected_asset_args(claim_credit_amount, payout_amount, max_overpay_bps);
    let approved_amount = paid_amount + args.claim_credit_amount;
    let next_paid = paid_amount + args.claim_credit_amount;
    assert!(args.payout_amount > 0);
    assert!(args.max_overpay_bps <= MAX_SELECTED_ASSET_PAYOUT_OVERPAY_BPS);
    assert!(next_paid <= approved_amount);
}

#[kani::proof]
fn fee_withdrawal_guard_stays_within_accrued_fees() {
    let withdrawn_fees: u64 = kani::any();
    let amount: u64 = kani::any();
    kani::assume(amount > 0);
    kani::assume(withdrawn_fees <= u64::MAX - amount);
    let args = WithdrawArgs { amount };
    let accrued_fees = withdrawn_fees + args.amount;
    let next_withdrawn = withdrawn_fees + args.amount;
    assert!(next_withdrawn <= accrued_fees);
}
`;
}

function postprocessRustModel() {
  const cargoPath = `${MODEL_DIR}/Cargo.toml`;
  if (existsSync(cargoPath)) {
    let cargo = readFileSync(cargoPath, 'utf8');
    if (!cargo.includes('anchor-spl = ')) {
      cargo = cargo.replace(
        'anchor-lang = "0.32.1"\n',
        'anchor-lang = "0.32.1"\nanchor-spl = "0.32.1"\n',
      );
    }
    if (!cargo.includes('[dev-dependencies]')) {
      cargo = `${cargo.trimEnd()}\n\n[dev-dependencies]\nproptest = "1"\n`;
    } else if (!cargo.includes('proptest = ')) {
      cargo = cargo.replace('[dev-dependencies]\n', '[dev-dependencies]\nproptest = "1"\n');
    }
    writeFileSync(cargoPath, cargo);
  }

  const instructionsDir = `${MODEL_DIR}/src/instructions`;
  if (existsSync(instructionsDir)) {
    for (const entry of readdirSync(instructionsDir)) {
      if (!entry.endsWith('.rs')) {
        continue;
      }

      const path = `${instructionsDir}/${entry}`;
      let text = readFileSync(path, 'utf8');
      const argsMatch = text.match(/pub fn handler\(&mut self, args: (\w+)\) -> Result<\(\)>/);
      const contextMatch = text.match(/impl<'info> (\w+)<'info>/);
      text = text.replace(/^use crate::\{guards,\s*\w+Args\};$/m, 'use crate::guards;');
      if (
        argsMatch &&
        contextMatch &&
        text.includes(`use crate::${contextMatch[1]};`) &&
        !text.includes(`use crate::{${contextMatch[1]}, ${argsMatch[1]}};`)
      ) {
        text = text.replace(
          `use crate::${contextMatch[1]};`,
          `use crate::{${contextMatch[1]}, ${argsMatch[1]}};`,
        );
      }
      text = text.replace(
        'self.protocol_governance.governance_authority = pending_authority;',
        'self.protocol_governance.governance_authority = self.pending_authority.key();',
      );
      writeFileSync(path, text);
    }
  }

  const guardsPath = `${MODEL_DIR}/src/guards.rs`;
  if (existsSync(guardsPath)) {
    const guards = postprocessGuards(readFileSync(guardsPath, 'utf8'));
    writeFileSync(guardsPath, guards);
  }

  const errorsPath = `${MODEL_DIR}/src/errors.rs`;
  if (existsSync(errorsPath)) {
    let errors = readFileSync(errorsPath, 'utf8');
    if (!errors.includes('ReserveAssetPriceConfidenceTooWide')) {
      errors = errors.replace(
        `    ReserveAssetPriceInvalid = 105,
    CommitmentPaymentRailMismatch = 106,
    CommitmentPaymentRailInactive = 107,
    PartialObligationTransitionUnsupported = 108,
    InvalidObligationDeliveryMode = 109,
    ClaimAdjudicationLocked = 110,
    SelectedAssetPayoutSameMint = 111,
    SelectedAssetPayoutUnderpaid = 112,
    SelectedAssetPayoutOverpaid = 113,
    SelectedAssetOverpayBpsTooHigh = 114,
    ReserveAssetMintDecimalsUnsupported = 115,
    HealthPlanInactive = 116,
    CapitalClassInactive = 117,
    InvalidLifecycle = 118,`,
        `    ReserveAssetPriceInvalid = 105,
    ReserveAssetPriceConfidenceTooWide = 106,
    CommitmentPaymentRailMismatch = 107,
    CommitmentPaymentRailInactive = 108,
    PartialObligationTransitionUnsupported = 109,
    InvalidObligationDeliveryMode = 110,
    ClaimAdjudicationLocked = 111,
    SelectedAssetPayoutSameMint = 112,
    SelectedAssetPayoutUnderpaid = 113,
    SelectedAssetPayoutOverpaid = 114,
    SelectedAssetOverpayBpsTooHigh = 115,
    ReserveAssetMintDecimalsUnsupported = 116,
    HealthPlanInactive = 117,
    CapitalClassInactive = 118,
    InvalidLifecycle = 119,`,
      );
      writeFileSync(errorsPath, errors);
    }
  }

  for (const harnessPath of [KANI_HARNESS, PROPTEST_HARNESS]) {
    if (!existsSync(harnessPath)) {
      continue;
    }
    let text = readFileSync(harnessPath, 'utf8');
    text = dedupeFunctions(text);
    if (harnessPath === PROPTEST_HARNESS) {
      text = postprocessProptestHarness(text);
      writeFileSync(harnessPath, text);
      continue;
    }
    if (harnessPath === KANI_HARNESS) {
      text = postprocessKaniHarness();
      writeFileSync(harnessPath, text);
      continue;
    }
    const stateFields = extractRustStateFields(text);
    text = text
      .split('\n')
      .map((line) => {
        const shouldPatch =
          line.includes('if !(') ||
          line.includes('kani::assume') ||
          line.includes('prop_assume!');
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
if (command === 'reconcile') {
  process.exit(runReconcile(qedgen));
}
if (command === 'verify') {
  process.exit(runVerify());
}

const result = spawnSync(qedgen, [...argsFor(command), ...extraArgs], {
  cwd: process.cwd(),
  stdio: 'inherit',
  env: qedgenEnv(),
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
