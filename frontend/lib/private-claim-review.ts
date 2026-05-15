// SPDX-License-Identifier: AGPL-3.0-or-later

import { BorshCoder, type Idl } from "@coral-xyz/anchor";
import { Buffer } from "buffer";
import { PublicKey, type Connection } from "@solana/web3.js";
import privateClaimReviewIdl from "../../idl/omegax_private_claim_review.json";

export const PRIVATE_CLAIM_REVIEW_PROGRAM_ID = new PublicKey(
  privateClaimReviewIdl.address ?? "FADqaRcJHERauzMo3BRzXZVY2qvrpPqg1ie2FGqACCVn",
);
export const SEED_PRIVATE_CLAIM_REVIEW_SESSION = "private_claim_review";
export const MAX_PRIVATE_CLAIM_REVIEW_SESSION_ID_BYTES = 32;

const PRIVATE_CLAIM_REVIEW_IDL = privateClaimReviewIdl as Idl;
const PRIVATE_CLAIM_REVIEW_CODER = new BorshCoder(PRIVATE_CLAIM_REVIEW_IDL);
const PRIVATE_CLAIM_REVIEW_SESSION_ACCOUNT = "PrivateClaimReviewSession";
const TEXT_ENCODER = new TextEncoder();
const ZERO_HASH_HEX = "00".repeat(32);

const PRIVATE_CLAIM_REVIEW_SESSION_DISCRIMINATOR = (() => {
  const account = privateClaimReviewIdl.accounts?.find(
    (entry) => entry.name === PRIVATE_CLAIM_REVIEW_SESSION_ACCOUNT,
  );
  if (!account?.discriminator || account.discriminator.length !== 8) {
    throw new Error("Private claim review session discriminator is missing from the IDL.");
  }
  return Uint8Array.from(account.discriminator);
})();

export type PrivateClaimReviewStatus =
  | "opened"
  | "delegated"
  | "reviewed"
  | "approved"
  | "needs_more_info"
  | "escalated"
  | "failed"
  | "unknown";

export type PrivateClaimReviewReceipt = {
  sessionAddress: string;
  sessionId: string;
  sessionAuthority: string;
  claimCase: string;
  healthPlan: string;
  policySeries: string;
  evidenceRefHash: string;
  decisionSupportHash: string;
  schemaKeyHash: string;
  schemaHash: string;
  reviewOperator: string;
  reviewerAuthority: string;
  paymentAttestor: string;
  reviewResultHash: string;
  reviewArtifactHash: string;
  reviewBinaryHash: string;
  teeAttestationDigest: string;
  operator: string;
  privatePaymentRefHash: string;
  statusCode: number;
  status: PrivateClaimReviewStatus;
  statusLabel: string;
  openedAt: number;
  delegatedAt: number;
  reviewedAt: number;
  paymentRecordedAt: number;
  committedAt: number;
  failedAt: number;
  bump: number;
};

export type PrivateClaimReviewLookupResult =
  | { kind: "found"; receipt: PrivateClaimReviewReceipt }
  | { kind: "invalid-address"; message: string }
  | { kind: "not-found"; address: string; message: string }
  | { kind: "wrong-owner"; address: string; owner: string; expectedOwner: string; message: string }
  | { kind: "wrong-account-type"; address: string; discriminator: string; message: string }
  | { kind: "decode-error"; address: string; message: string }
  | { kind: "rpc-error"; address?: string; message: string };

type DecodedPrivateClaimReviewSession = Record<string, unknown>;

export function describePrivateClaimReviewStatus(status: number): {
  status: PrivateClaimReviewStatus;
  label: string;
} {
  switch (status) {
    case 0:
      return { status: "opened", label: "Opened" };
    case 1:
      return { status: "delegated", label: "Delegated" };
    case 2:
      return { status: "reviewed", label: "Reviewed" };
    case 3:
      return { status: "approved", label: "Approved" };
    case 4:
      return { status: "needs_more_info", label: "Needs more info" };
    case 5:
      return { status: "escalated", label: "Escalated" };
    case 6:
      return { status: "failed", label: "Failed" };
    default:
      return { status: "unknown", label: `Unknown (${status})` };
  }
}

export function derivePrivateClaimReviewSessionPda(params: {
  sessionAuthority: string | PublicKey;
  claimCase: string | PublicKey;
  sessionId: string;
  programId?: string | PublicKey;
}): PublicKey {
  const canonicalSessionId = params.sessionId.trim();
  if (canonicalSessionId !== params.sessionId) {
    throw new Error("Session ID must not have leading or trailing whitespace.");
  }
  const sessionIdBytes = TEXT_ENCODER.encode(canonicalSessionId);
  if (sessionIdBytes.length === 0) {
    throw new Error("Session ID is required.");
  }
  if (sessionIdBytes.length > MAX_PRIVATE_CLAIM_REVIEW_SESSION_ID_BYTES) {
    throw new Error(`Session ID must be ${MAX_PRIVATE_CLAIM_REVIEW_SESSION_ID_BYTES} bytes or fewer.`);
  }

  const sessionAuthority = toPublicKey(params.sessionAuthority);
  const claimCase = toPublicKey(params.claimCase);
  const programId = toPublicKey(params.programId ?? PRIVATE_CLAIM_REVIEW_PROGRAM_ID);

  return PublicKey.findProgramAddressSync(
    [
      TEXT_ENCODER.encode(SEED_PRIVATE_CLAIM_REVIEW_SESSION),
      sessionAuthority.toBuffer(),
      claimCase.toBuffer(),
      sessionIdBytes,
    ],
    programId,
  )[0];
}

export async function loadPrivateClaimReviewReceipt(
  connection: Connection,
  sessionAddress: string | PublicKey,
): Promise<PrivateClaimReviewLookupResult> {
  let sessionKey: PublicKey;
  try {
    sessionKey = toPublicKey(sessionAddress);
  } catch {
    return {
      kind: "invalid-address",
      message: "Enter a valid Solana review-session PDA.",
    };
  }

  const address = sessionKey.toBase58();
  let accountInfo: Awaited<ReturnType<Connection["getAccountInfo"]>>;
  try {
    accountInfo = await connection.getAccountInfo(sessionKey, "confirmed");
  } catch (cause) {
    return {
      kind: "rpc-error",
      address,
      message: cause instanceof Error && cause.message
        ? cause.message
        : "The selected RPC endpoint could not load the review session.",
    };
  }

  if (!accountInfo) {
    return {
      kind: "not-found",
      address,
      message: "No MagicBlock private-review session account exists at this address on the selected network.",
    };
  }

  const owner = accountInfo.owner.toBase58();
  const expectedOwner = PRIVATE_CLAIM_REVIEW_PROGRAM_ID.toBase58();
  if (owner !== expectedOwner) {
    return {
      kind: "wrong-owner",
      address,
      owner,
      expectedOwner,
      message: "This account is not owned by the MagicBlock private-review adjunct program.",
    };
  }

  const data = Buffer.from(accountInfo.data);
  if (!hasPrivateClaimReviewSessionDiscriminator(data)) {
    return {
      kind: "wrong-account-type",
      address,
      discriminator: bytesToHex(data.subarray(0, 8)),
      message: "This account is owned by the adjunct program, but it is not a PrivateClaimReviewSession receipt.",
    };
  }

  try {
    const decoded = PRIVATE_CLAIM_REVIEW_CODER.accounts.decode(
      PRIVATE_CLAIM_REVIEW_SESSION_ACCOUNT,
      data,
    ) as DecodedPrivateClaimReviewSession;
    return {
      kind: "found",
      receipt: decodePrivateClaimReviewReceipt(address, decoded),
    };
  } catch (cause) {
    return {
      kind: "decode-error",
      address,
      message: cause instanceof Error && cause.message
        ? cause.message
        : "The account exists but could not be decoded as a review receipt.",
    };
  }
}

export function hasPrivateClaimReviewSessionDiscriminator(data: Uint8Array): boolean {
  if (data.length < PRIVATE_CLAIM_REVIEW_SESSION_DISCRIMINATOR.length) return false;
  return PRIVATE_CLAIM_REVIEW_SESSION_DISCRIMINATOR.every((byte, index) => data[index] === byte);
}

function decodePrivateClaimReviewReceipt(
  sessionAddress: string,
  decoded: DecodedPrivateClaimReviewSession,
): PrivateClaimReviewReceipt {
  const statusCode = numberFromAnchorValue(decodedField(decoded, "status"));
  const describedStatus = describePrivateClaimReviewStatus(statusCode);

  return {
    sessionAddress,
    sessionId: stringFromAnchorValue(decodedField(decoded, "sessionId")),
    sessionAuthority: asAddress(decodedField(decoded, "sessionAuthority")),
    claimCase: asAddress(decodedField(decoded, "claimCase")),
    healthPlan: asAddress(decodedField(decoded, "healthPlan")),
    policySeries: asAddress(decodedField(decoded, "policySeries")),
    evidenceRefHash: bytesToHex(decodedField(decoded, "evidenceRefHash")),
    decisionSupportHash: bytesToHex(decodedField(decoded, "decisionSupportHash")),
    schemaKeyHash: bytesToHex(decodedField(decoded, "schemaKeyHash")),
    schemaHash: bytesToHex(decodedField(decoded, "schemaHash")),
    reviewOperator: asAddress(decodedField(decoded, "reviewOperator")),
    reviewerAuthority: asAddress(decodedField(decoded, "reviewerAuthority")),
    paymentAttestor: asAddress(decodedField(decoded, "paymentAttestor")),
    reviewResultHash: bytesToHex(decodedField(decoded, "reviewResultHash")),
    reviewArtifactHash: bytesToHex(decodedField(decoded, "reviewArtifactHash")),
    reviewBinaryHash: bytesToHex(decodedField(decoded, "reviewBinaryHash")),
    teeAttestationDigest: bytesToHex(decodedField(decoded, "teeAttestationDigest")),
    operator: asAddress(decodedField(decoded, "operator")),
    privatePaymentRefHash: bytesToHex(decodedField(decoded, "privatePaymentRefHash")),
    statusCode,
    status: describedStatus.status,
    statusLabel: describedStatus.label,
    openedAt: numberFromAnchorValue(decodedField(decoded, "openedAt")),
    delegatedAt: numberFromAnchorValue(decodedField(decoded, "delegatedAt")),
    reviewedAt: numberFromAnchorValue(decodedField(decoded, "reviewedAt")),
    paymentRecordedAt: numberFromAnchorValue(decodedField(decoded, "paymentRecordedAt")),
    committedAt: numberFromAnchorValue(decodedField(decoded, "committedAt")),
    failedAt: numberFromAnchorValue(decodedField(decoded, "failedAt")),
    bump: numberFromAnchorValue(decodedField(decoded, "bump")),
  };
}

function toPublicKey(value: unknown): PublicKey {
  if (value instanceof PublicKey) return value;
  if (typeof value === "string") return new PublicKey(value.trim());
  if (value && typeof value === "object" && "toBase58" in value && typeof value.toBase58 === "function") {
    return new PublicKey(value.toBase58());
  }
  throw new Error("Invalid public key value.");
}

function snakeCaseKey(value: string): string {
  return value.replace(/[A-Z]/g, (match) => `_${match.toLowerCase()}`);
}

function decodedField<T = unknown>(
  decoded: Record<string, unknown>,
  key: string,
  alternateKey?: string,
): T | undefined {
  const snakeKey = alternateKey ?? snakeCaseKey(key);
  return (decoded[key] ?? decoded[snakeKey]) as T | undefined;
}

function asPublicKey(value: unknown): PublicKey {
  if (value instanceof PublicKey) return value;
  if (typeof value === "string") return new PublicKey(value);
  if (value instanceof Uint8Array || Array.isArray(value)) return new PublicKey(value);
  if (value && typeof value === "object" && "toBase58" in value && typeof value.toBase58 === "function") {
    return new PublicKey(value.toBase58());
  }
  throw new Error("Invalid public key value.");
}

function asAddress(value: unknown): string {
  return asPublicKey(value).toBase58();
}

function bytesToHex(value: unknown): string {
  if (value instanceof Uint8Array) {
    return Array.from(value, (byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  if (Array.isArray(value)) {
    return Array.from(value, (byte) => Number(byte).toString(16).padStart(2, "0")).join("");
  }
  return ZERO_HASH_HEX;
}

function numberFromAnchorValue(value: unknown): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string") return Number(value);
  if (value && typeof value === "object" && "toString" in value && typeof value.toString === "function") {
    return Number(value.toString());
  }
  return 0;
}

function stringFromAnchorValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "toString" in value && typeof value.toString === "function") {
    return value.toString();
  }
  return "";
}
