// SPDX-License-Identifier: AGPL-3.0-or-later

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  ProposalState,
  getProposalsByGovernance,
} from '@solana/spl-governance';
import { Connection, PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';

type InstructionStats = {
  success: number;
  failed: number;
};

type ObservabilityReport = {
  generatedAt: string;
  rpcUrl: string;
  programId: string;
  scannedSignatures: number;
  instructionStats: Record<string, InstructionStats>;
  failureReasons: Record<string, number>;
  governanceProposalStates: Record<string, number>;
};

function parseU32Env(name: string, fallback: number): number {
  const raw = String(process.env[name] ?? '').trim();
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 1000) {
    throw new Error(`Invalid ${name}: expected integer in [1, 1000]`);
  }
  return parsed;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRpcRateLimit(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /\b429\b/.test(message) || /too many requests/i.test(message);
}

async function withRpcRetry<T>(
  label: string,
  fn: () => Promise<T>,
  attempts: number,
  baseDelayMs: number,
): Promise<T> {
  let delayMs = baseDelayMs;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      if (!isRpcRateLimit(error) || attempt === attempts) {
        throw error;
      }
      console.warn(
        `[beta-observability] rpc rate limited during ${label}; retrying in ${delayMs}ms (${attempt}/${attempts})`,
      );
      await sleep(delayMs);
      delayMs *= 2;
    }
  }

  throw new Error(`unreachable retry state for ${label}`);
}

function discriminatorHex(dataBase58: string): string {
  const data = bs58.decode(dataBase58);
  return Buffer.from(data.subarray(0, 8)).toString('hex');
}

function canonicalFailureReason(logMessages: string[] | null | undefined): string {
  if (!logMessages || logMessages.length === 0) {
    return 'unknown';
  }

  for (const line of logMessages) {
    const anchorMatch = line.match(/Error Code: ([A-Za-z0-9_]+)/);
    if (anchorMatch) {
      return anchorMatch[1]!.trim();
    }
  }

  for (const line of logMessages) {
    const customMatch = line.match(/custom program error: (0x[0-9a-fA-F]+)/);
    if (customMatch) {
      return customMatch[1]!.toLowerCase();
    }
  }

  for (const line of logMessages) {
    if (line.includes('Program log:')) {
      const trimmed = line.replace('Program log:', '').trim();
      if (trimmed) return trimmed.slice(0, 160);
    }
  }

  return 'unknown';
}

function loadDiscriminatorMap(contractPath: string): Map<string, string> {
  const raw = JSON.parse(readFileSync(contractPath, 'utf8')) as {
    instructions: Array<{ name: string; discriminator: number[] }>;
  };
  const map = new Map<string, string>();
  for (const instruction of raw.instructions) {
    const hex = Buffer.from(instruction.discriminator).toString('hex');
    map.set(hex, instruction.name);
  }
  return map;
}

function stateName(state: ProposalState): string {
  const entry = Object.entries(ProposalState).find(([, value]) => value === state && typeof value === 'number');
  return entry?.[0] ?? `State_${state}`;
}

async function main() {
  const repoRoot = resolve(process.cwd());
  const rpcUrl = String(
    process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
  ).trim();
  const programId = new PublicKey(
    String(process.env.PROTOCOL_PROGRAM_ID || 'Bn6eixac1QEEVErGBvBjxAd6pgB9e2q4XHvAkinQ5y1B').trim(),
  );
  const governanceProgramIdRaw = String(process.env.GOVERNANCE_PROGRAM_ID || '').trim();
  const governanceConfigRaw = String(process.env.GOVERNANCE_CONFIG || '').trim();
  const txLimit = parseU32Env('OBSERVABILITY_TX_LIMIT', 150);
  const rpcRetryAttempts = parseU32Env('OBSERVABILITY_RPC_RETRY_ATTEMPTS', 5);
  const rpcRetryBaseDelayMs = parseU32Env('OBSERVABILITY_RPC_RETRY_BASE_DELAY_MS', 500);
  const outputJsonPath = String(process.env.OBSERVABILITY_OUTPUT_JSON || '').trim();

  const discriminatorToInstruction = loadDiscriminatorMap(resolve(repoRoot, 'shared/protocol_contract.json'));

  const connection = new Connection(rpcUrl, 'confirmed');
  const signatures = await withRpcRetry(
    'getSignaturesForAddress',
    () => connection.getSignaturesForAddress(programId, { limit: txLimit }, 'confirmed'),
    rpcRetryAttempts,
    rpcRetryBaseDelayMs,
  );

  const instructionStats: Record<string, InstructionStats> = {};
  const failureReasons: Record<string, number> = {};

  for (const signatureInfo of signatures) {
    const tx = await withRpcRetry(
      `getParsedTransaction:${signatureInfo.signature}`,
      () => connection.getParsedTransaction(signatureInfo.signature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0,
      }),
      rpcRetryAttempts,
      rpcRetryBaseDelayMs,
    );
    if (!tx) continue;

    const logMessages = tx.meta?.logMessages;
    const failed = Boolean(signatureInfo.err);

    for (const instruction of tx.transaction.message.instructions) {
      const anyInstruction = instruction as {
        programId?: PublicKey | string;
        data?: string;
      };
      if (!anyInstruction.programId) {
        continue;
      }
      const instructionProgramId = anyInstruction.programId instanceof PublicKey
        ? anyInstruction.programId
        : new PublicKey(anyInstruction.programId);
      if (!instructionProgramId.equals(programId)) {
        continue;
      }

      let instructionName = 'unknown_instruction';
      if (typeof anyInstruction.data === 'string') {
        const ixDiscriminator = discriminatorHex(anyInstruction.data);
        instructionName = discriminatorToInstruction.get(ixDiscriminator) || 'unknown_instruction';
      }

      if (!instructionStats[instructionName]) {
        instructionStats[instructionName] = { success: 0, failed: 0 };
      }
      if (failed) {
        instructionStats[instructionName].failed += 1;
      } else {
        instructionStats[instructionName].success += 1;
      }
    }

    if (failed) {
      const reason = canonicalFailureReason(logMessages);
      failureReasons[reason] = (failureReasons[reason] || 0) + 1;
    }
  }

  const governanceProposalStates: Record<string, number> = {};
  if (governanceProgramIdRaw && governanceConfigRaw) {
    const governanceProgramId = new PublicKey(governanceProgramIdRaw);
    const governanceConfig = new PublicKey(governanceConfigRaw);
    const proposals = await withRpcRetry(
      'getProposalsByGovernance',
      () => getProposalsByGovernance(connection, governanceProgramId, governanceConfig),
      rpcRetryAttempts,
      rpcRetryBaseDelayMs,
    );
    for (const proposal of proposals) {
      const key = stateName(proposal.account.state);
      governanceProposalStates[key] = (governanceProposalStates[key] || 0) + 1;
    }
  }

  const report: ObservabilityReport = {
    generatedAt: new Date().toISOString(),
    rpcUrl,
    programId: programId.toBase58(),
    scannedSignatures: signatures.length,
    instructionStats,
    failureReasons,
    governanceProposalStates,
  };

  if (outputJsonPath) {
    writeFileSync(resolve(repoRoot, outputJsonPath), `${JSON.stringify(report, null, 2)}\n`);
  }

  console.log('[beta-observability] Complete');
  console.log(`[beta-observability] rpc_url=${report.rpcUrl}`);
  console.log(`[beta-observability] program_id=${report.programId}`);
  console.log(`[beta-observability] scanned_signatures=${report.scannedSignatures}`);

  for (const [name, stats] of Object.entries(report.instructionStats).sort((a, b) => a[0].localeCompare(b[0]))) {
    console.log(`[beta-observability] instruction=${name} success=${stats.success} failed=${stats.failed}`);
  }

  for (const [reason, count] of Object.entries(report.failureReasons).sort((a, b) => b[1] - a[1])) {
    console.log(`[beta-observability] failure_reason=${reason} count=${count}`);
  }

  for (const [state, count] of Object.entries(report.governanceProposalStates).sort((a, b) => a[0].localeCompare(b[0]))) {
    console.log(`[beta-observability] governance_proposal_state=${state} count=${count}`);
  }

  if (outputJsonPath) {
    console.log(`[beta-observability] output_json=${resolve(repoRoot, outputJsonPath)}`);
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[beta-observability] failed: ${message}`);
  process.exit(1);
});
