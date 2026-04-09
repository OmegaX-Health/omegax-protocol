// SPDX-License-Identifier: AGPL-3.0-or-later

import { Buffer } from "buffer";

import {
  PublicKey,
  SystemProgram,
  TransactionInstruction,
} from "@solana/web3.js";

import {
  deriveDomainAssetLedgerPda,
  deriveDomainAssetVaultPda,
  deriveFundingLineLedgerPda,
  derivePlanReserveLedgerPda,
  deriveProtocolGovernancePda,
  deriveSeriesReserveLedgerPda,
  getProgramId,
} from "@/lib/protocol";
import type { MembershipMode } from "@/lib/plan-launch";

const TEXT_ENCODER = new TextEncoder();

type CreateHealthPlanInstructionParams = {
  planAdmin: PublicKey;
  reserveDomain: PublicKey;
  healthPlan: PublicKey;
  args: {
    planId: string;
    displayName: string;
    organizationRef: string;
    metadataUri: string;
    sponsor: PublicKey;
    sponsorOperator: PublicKey;
    claimsOperator: PublicKey;
    oracleAuthority: PublicKey;
    membershipMode: MembershipMode;
    allowedRailMask: number;
    defaultFundingPriority: number;
    oraclePolicyHashHex: string;
    schemaBindingHashHex: string;
    complianceBaselineHashHex: string;
    pauseFlags: number;
  };
};

type CreatePolicySeriesInstructionParams = {
  authority: PublicKey;
  healthPlan: PublicKey;
  policySeries: PublicKey;
  seriesReserveLedger: PublicKey;
  args: {
    seriesId: string;
    displayName: string;
    metadataUri: string;
    assetMint: PublicKey;
    mode: number;
    status: number;
    adjudicationMode: number;
    termsHashHex: string;
    pricingHashHex: string;
    payoutHashHex: string;
    reserveModelHashHex: string;
    evidenceRequirementsHashHex: string;
    comparabilityHashHex: string;
    policyOverridesHashHex: string;
    cycleSeconds: bigint;
    termsVersion: number;
  };
};

type OpenFundingLineInstructionParams = {
  authority: PublicKey;
  reserveDomain: PublicKey;
  healthPlan: PublicKey;
  assetMint: PublicKey;
  fundingLine: PublicKey;
  fundingLineLedger: PublicKey;
  planReserveLedger: PublicKey;
  seriesReserveLedger: PublicKey;
  args: {
    lineId: string;
    policySeries: PublicKey;
    lineType: number;
    fundingPriority: number;
    committedAmount: bigint;
    capsHashHex: string;
  };
};

function normalizeHex32(value: string): string {
  return value.trim().toLowerCase().replace(/^0x/, "");
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const totalLength = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(totalLength);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function encodeU8(value: number): Uint8Array {
  return Uint8Array.from([value & 0xff]);
}

function encodeU16(value: number): Uint8Array {
  const view = new DataView(new ArrayBuffer(2));
  view.setUint16(0, value, true);
  return new Uint8Array(view.buffer);
}

function encodeU32(value: number): Uint8Array {
  const view = new DataView(new ArrayBuffer(4));
  view.setUint32(0, value, true);
  return new Uint8Array(view.buffer);
}

function encodeU64(value: bigint): Uint8Array {
  const view = new DataView(new ArrayBuffer(8));
  view.setBigUint64(0, value, true);
  return new Uint8Array(view.buffer);
}

function encodeI64(value: bigint): Uint8Array {
  const view = new DataView(new ArrayBuffer(8));
  view.setBigInt64(0, value, true);
  return new Uint8Array(view.buffer);
}

function encodeString(value: string): Uint8Array {
  const bytes = TEXT_ENCODER.encode(value);
  return concatBytes([encodeU32(bytes.length), bytes]);
}

function encodePubkey(value: PublicKey): Uint8Array {
  return value.toBytes();
}

function encodeHex32(value: string): Uint8Array {
  const normalized = normalizeHex32(value);
  if (!/^[0-9a-f]{64}$/i.test(normalized)) {
    throw new Error(`Expected 32-byte hex, received ${value}`);
  }
  return Uint8Array.from(Buffer.from(normalized, "hex"));
}

function buildInstructionData(discriminator: Uint8Array, fields: Uint8Array[]): Buffer {
  return Buffer.from(concatBytes([discriminator, ...fields]));
}

function membershipModeValue(mode: MembershipMode): number {
  if (mode === "open") return 0;
  if (mode === "token_gate") return 1;
  return 2;
}

export function buildCreateHealthPlanInstruction(params: CreateHealthPlanInstructionParams): TransactionInstruction {
  const programId = getProgramId();
  const protocolGovernance = deriveProtocolGovernancePda();
  const data = buildInstructionData(
    Uint8Array.from([136, 7, 197, 134, 241, 206, 83, 171]),
    [
      encodeString(params.args.planId),
      encodeString(params.args.displayName),
      encodeString(params.args.organizationRef),
      encodeString(params.args.metadataUri),
      encodePubkey(params.args.sponsor),
      encodePubkey(params.args.sponsorOperator),
      encodePubkey(params.args.claimsOperator),
      encodePubkey(params.args.oracleAuthority),
      encodeU8(membershipModeValue(params.args.membershipMode)),
      encodeU16(params.args.allowedRailMask),
      encodeU8(params.args.defaultFundingPriority),
      encodeHex32(params.args.oraclePolicyHashHex),
      encodeHex32(params.args.schemaBindingHashHex),
      encodeHex32(params.args.complianceBaselineHashHex),
      encodeU32(params.args.pauseFlags),
    ],
  );

  return new TransactionInstruction({
    programId,
    data,
    keys: [
      { pubkey: params.planAdmin, isSigner: true, isWritable: true },
      { pubkey: protocolGovernance, isSigner: false, isWritable: false },
      { pubkey: params.reserveDomain, isSigner: false, isWritable: false },
      { pubkey: params.healthPlan, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
  });
}

export function buildCreatePolicySeriesInstruction(params: CreatePolicySeriesInstructionParams): TransactionInstruction {
  const programId = getProgramId();
  const protocolGovernance = deriveProtocolGovernancePda();
  const data = buildInstructionData(
    Uint8Array.from([70, 162, 231, 218, 211, 136, 110, 176]),
    [
      encodeString(params.args.seriesId),
      encodeString(params.args.displayName),
      encodeString(params.args.metadataUri),
      encodePubkey(params.args.assetMint),
      encodeU8(params.args.mode),
      encodeU8(params.args.status),
      encodeU8(params.args.adjudicationMode),
      encodeHex32(params.args.termsHashHex),
      encodeHex32(params.args.pricingHashHex),
      encodeHex32(params.args.payoutHashHex),
      encodeHex32(params.args.reserveModelHashHex),
      encodeHex32(params.args.evidenceRequirementsHashHex),
      encodeHex32(params.args.comparabilityHashHex),
      encodeHex32(params.args.policyOverridesHashHex),
      encodeI64(params.args.cycleSeconds),
      encodeU16(params.args.termsVersion),
    ],
  );

  return new TransactionInstruction({
    programId,
    data,
    keys: [
      { pubkey: params.authority, isSigner: true, isWritable: true },
      { pubkey: protocolGovernance, isSigner: false, isWritable: false },
      { pubkey: params.healthPlan, isSigner: false, isWritable: false },
      { pubkey: params.policySeries, isSigner: false, isWritable: true },
      { pubkey: params.seriesReserveLedger, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
  });
}

export function buildOpenFundingLineInstruction(params: OpenFundingLineInstructionParams): TransactionInstruction {
  const programId = getProgramId();
  const protocolGovernance = deriveProtocolGovernancePda();
  const domainAssetVault = deriveDomainAssetVaultPda({
    reserveDomain: params.reserveDomain,
    assetMint: params.assetMint,
  });
  const domainAssetLedger = deriveDomainAssetLedgerPda({
    reserveDomain: params.reserveDomain,
    assetMint: params.assetMint,
  });
  const data = buildInstructionData(
    Uint8Array.from([231, 140, 66, 127, 163, 1, 197, 9]),
    [
      encodeString(params.args.lineId),
      encodePubkey(params.args.policySeries),
      encodePubkey(params.assetMint),
      encodeU8(params.args.lineType),
      encodeU8(params.args.fundingPriority),
      encodeU64(params.args.committedAmount),
      encodeHex32(params.args.capsHashHex),
    ],
  );

  return new TransactionInstruction({
    programId,
    data,
    keys: [
      { pubkey: params.authority, isSigner: true, isWritable: true },
      { pubkey: protocolGovernance, isSigner: false, isWritable: false },
      { pubkey: params.healthPlan, isSigner: false, isWritable: false },
      { pubkey: domainAssetVault, isSigner: false, isWritable: false },
      { pubkey: domainAssetLedger, isSigner: false, isWritable: true },
      { pubkey: params.fundingLine, isSigner: false, isWritable: true },
      { pubkey: params.fundingLineLedger, isSigner: false, isWritable: true },
      { pubkey: params.planReserveLedger, isSigner: false, isWritable: true },
      { pubkey: params.seriesReserveLedger, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
  });
}

export function deriveLaunchLedgerAddresses(params: {
  reserveDomain: PublicKey;
  healthPlan: PublicKey;
  assetMint: PublicKey;
  policySeries: PublicKey;
  fundingLine: PublicKey;
}) {
  return {
    domainAssetVault: deriveDomainAssetVaultPda({
      reserveDomain: params.reserveDomain,
      assetMint: params.assetMint,
    }),
    domainAssetLedger: deriveDomainAssetLedgerPda({
      reserveDomain: params.reserveDomain,
      assetMint: params.assetMint,
    }),
    planReserveLedger: derivePlanReserveLedgerPda({
      healthPlan: params.healthPlan,
      assetMint: params.assetMint,
    }),
    seriesReserveLedger: deriveSeriesReserveLedgerPda({
      policySeries: params.policySeries,
      assetMint: params.assetMint,
    }),
    fundingLineLedger: deriveFundingLineLedgerPda({
      fundingLine: params.fundingLine,
      assetMint: params.assetMint,
    }),
  };
}
