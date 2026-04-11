// SPDX-License-Identifier: AGPL-3.0-or-later

import BN from "bn.js";
import {
  AccountMetaData,
  Governance,
  InstructionData,
  InstructionExecutionStatus,
  Proposal,
  ProposalState,
  ProposalTransaction,
  TokenOwnerRecord,
  Vote,
  VoteRecord,
  VoteThresholdType,
  VoteType,
  YesNoVote,
  getAllTokenOwnerRecords,
  getGovernance,
  getGovernanceAccounts,
  getGovernanceProgramVersion,
  getNativeTreasuryAddress,
  getProposal,
  getProposalsByGovernance,
  getRealm,
  getTokenOwnerRecord,
  getTokenOwnerRecordForRealm,
  getTokenOwnerRecordsByOwner,
  getVoteRecordsByVoter,
  tryGetRealmConfig,
  withCastVote,
  withCreateProposal,
  withDepositGoverningTokens,
  withExecuteTransaction,
  withInsertTransaction,
  withRelinquishVote,
  withSignOffProposal,
  withWithdrawGoverningTokens,
} from "@solana/spl-governance";
import {
  createAssociatedTokenAccountInstruction,
  getAccount,
  getAssociatedTokenAddress,
  getMint,
} from "@solana/spl-token";
import { Connection, PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js";

import {
  buildBackfillSchemaDependencyLedgerTx,
  buildCloseOutcomeSchemaTx,
  buildVerifyOutcomeSchemaTx,
  fetchProtocolConfig,
  listPoolRules,
  type ProtocolConfigSummary,
  type RuleSummary,
} from "@/lib/protocol";

export const DEFAULT_GOVERNANCE_PROGRAM_ID = "GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw";
const DEFAULT_CLUSTER = "devnet";
const ZERO_PUBKEY = "11111111111111111111111111111111";

export type GovernanceProposalGroup = "active" | "executable" | "completed" | "failed";
export type GovernanceVoteChoice = "yes" | "no";
export type GovernanceDescriptionTemplate = "protocol-config" | "schema-state";

export type GovernanceRuntimeConfig = {
  cluster: string;
  governanceAddress: string | null;
  governanceTokenMint: string | null;
  programId: string;
  programVersionOverride: number | null;
  realmAddress: string | null;
};

export type GovernanceVoteSummary = {
  address: string;
  choice: GovernanceVoteChoice | null;
  isRelinquished: boolean;
  proposalAddress: string;
  voterWeightRaw: bigint | null;
};

export type GovernanceMemberSummary = {
  address: string;
  delegatedTo: string | null;
  governingTokenMint: string;
  governingTokenOwner: string;
  depositedVotesRaw: bigint;
  outstandingProposalCount: number;
  totalVotesCount: number;
  unrelinquishedVotesCount: number;
};

export type GovernanceProposalOptionSummary = {
  instructionsCount: number;
  instructionsExecutedCount: number;
  instructionsNextIndex: number;
  label: string;
  voteResult: number;
  voteWeightRaw: bigint;
};

export type GovernanceProposalSummary = {
  abstainVoteWeightRaw: bigint | null;
  address: string;
  currentWalletVote: GovernanceVoteSummary | null;
  denyVoteWeightRaw: bigint | null;
  descriptionLink: string;
  group: GovernanceProposalGroup;
  instructionCount: number;
  instructionExecutedCount: number;
  instructionNextIndex: number;
  maxVoteWeightRaw: bigint | null;
  name: string;
  options: GovernanceProposalOptionSummary[];
  ownerRecordAddress: string;
  ownerWalletAddress: string | null;
  proposalState: ProposalState;
  stateLabel: string;
  vetoVoteWeightRaw: bigint;
  voteThresholdPct: number | null;
  votingCompletedAtIso: string | null;
};

export type GovernanceProposalInstructionSummary = {
  accountCount: number;
  dataLength: number;
  programId: string;
};

export type GovernanceProposalTransactionSummary = {
  address: string;
  executedAtIso: string | null;
  executionStatus: InstructionExecutionStatus;
  executionStatusLabel: string;
  holdUpTimeSeconds: number;
  instructionIndex: number;
  instructions: GovernanceProposalInstructionSummary[];
  optionIndex: number;
  rawInstructions: InstructionData[];
};

export type GovernanceProposalDetailSummary = {
  governanceAddress: string;
  nativeTreasuryAddress: string;
  proposal: GovernanceProposalSummary;
  proposalOwnerRecord: GovernanceMemberSummary | null;
  proposalTransactions: GovernanceProposalTransactionSummary[];
  realmAddress: string;
  tokenDecimals: number;
};

export type GovernanceRulesSummary = {
  baseVotingTimeSeconds: number;
  communityVoteThresholdPct: number | null;
  instructionHoldUpTimeSeconds: number;
  minCommunityTokensToCreateGovernanceRaw: bigint;
  minCommunityTokensToCreateProposalRaw: bigint;
  pluginEnabled: boolean;
  votingCoolOffTimeSeconds: number;
};

export type GovernanceWalletSummary = {
  delegatedTo: string | null;
  depositedVotesRaw: bigint;
  governingTokenBalanceRaw: bigint;
  governingTokenMint: string;
  tokenAccountAddress: string;
  tokenOwnerRecordAddress: string | null;
  totalVotesCount: number;
  unrelinquishedVotesCount: number;
};

export type GovernanceDashboardSummary = {
  governanceAddress: string;
  governanceProgramId: string;
  governanceProgramVersion: number;
  governedAccountAddress: string;
  memberCount: number;
  members: GovernanceMemberSummary[];
  nativeTreasuryAddress: string;
  nativeTreasuryLamports: bigint;
  proposalCounts: Record<GovernanceProposalGroup, number>;
  proposals: GovernanceProposalSummary[];
  realmAddress: string;
  realmAuthorityAddress: string | null;
  realmName: string;
  rules: GovernanceRulesSummary;
  tokenDecimals: number;
  tokenMintAddress: string;
  tokenSupplyRaw: bigint;
  wallet: GovernanceWalletSummary | null;
};

export type ProtocolConfigProposalDraft = {
  allowedPayoutMintsHashHex: string;
  defaultStakeMint: string;
  emergencyPaused: boolean;
  minOracleStake: bigint;
  newGovernanceAuthority: string | null;
  protocolFeeBps: number;
};

export type SchemaStateProposalDraft = {
  closeSchemaHashes: string[];
  unverifySchemaHashes: string[];
  verifySchemaHashHex: string | null;
};

export type GovernanceProposalPlan = {
  descriptionLink: string;
  proposalAddress: string;
  proposalName: string;
  steps: Array<{
    label: string;
    tx: Transaction;
  }>;
};

export type GovernanceDescriptionPayload =
  | ({
      template: "protocol-config";
    } & ProtocolConfigProposalDraft)
  | ({
      template: "schema-state";
    } & SchemaStateProposalDraft);

function asBigInt(value: BN | bigint | number | null | undefined): bigint | null {
  if (value == null) return null;
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(value);
  return BigInt(value.toString(10));
}

function isConfigured(value?: string | null): boolean {
  const trimmed = value?.trim();
  return Boolean(trimmed && trimmed !== ZERO_PUBKEY);
}

function toIsoTimestamp(value: BN | null | undefined): string | null {
  if (!value) return null;
  return new Date(Number.parseInt(value.toString(10), 10) * 1000).toISOString();
}

function toProposalStateLabel(state: ProposalState): string {
  switch (state) {
    case ProposalState.Draft:
      return "Draft";
    case ProposalState.SigningOff:
      return "Signing off";
    case ProposalState.Voting:
      return "Voting";
    case ProposalState.Succeeded:
      return "Succeeded";
    case ProposalState.Executing:
      return "Executing";
    case ProposalState.Completed:
      return "Completed";
    case ProposalState.Cancelled:
      return "Cancelled";
    case ProposalState.Defeated:
      return "Defeated";
    case ProposalState.ExecutingWithErrors:
      return "Executing with errors";
    case ProposalState.Vetoed:
      return "Vetoed";
    default:
      return `State ${state}`;
  }
}

function toExecutionStatusLabel(status: InstructionExecutionStatus): string {
  switch (status) {
    case InstructionExecutionStatus.None:
      return "Pending";
    case InstructionExecutionStatus.Success:
      return "Executed";
    case InstructionExecutionStatus.Error:
      return "Error";
    default:
      return `Status ${status}`;
  }
}

export function classifyProposalGroup(state: ProposalState): GovernanceProposalGroup {
  switch (state) {
    case ProposalState.Succeeded:
    case ProposalState.Executing:
    case ProposalState.ExecutingWithErrors:
      return "executable";
    case ProposalState.Completed:
      return "completed";
    case ProposalState.Cancelled:
    case ProposalState.Defeated:
    case ProposalState.Vetoed:
      return "failed";
    default:
      return "active";
  }
}

function toGovernanceVoteChoice(voteRecord: VoteRecord): GovernanceVoteChoice | null {
  const yesNoVote = voteRecord.vote?.toYesNoVote();
  if (yesNoVote === YesNoVote.Yes) return "yes";
  if (yesNoVote === YesNoVote.No) return "no";
  return null;
}

function toProposalSummary(
  proposal: { pubkey: PublicKey; account: Proposal },
  ownerRecordToWallet: Map<string, string>,
  walletVotes: Map<string, GovernanceVoteSummary>,
): GovernanceProposalSummary {
  const communityThreshold =
    proposal.account.voteThreshold?.type === VoteThresholdType.YesVotePercentage
      ? proposal.account.voteThreshold.value ?? null
      : null;

  return {
    abstainVoteWeightRaw: asBigInt(proposal.account.abstainVoteWeight),
    address: proposal.pubkey.toBase58(),
    currentWalletVote: walletVotes.get(proposal.pubkey.toBase58()) ?? null,
    denyVoteWeightRaw: asBigInt(proposal.account.denyVoteWeight),
    descriptionLink: proposal.account.descriptionLink,
    group: classifyProposalGroup(proposal.account.state),
    instructionCount: proposal.account.instructionsCount,
    instructionExecutedCount: proposal.account.instructionsExecutedCount,
    instructionNextIndex: proposal.account.instructionsNextIndex,
    maxVoteWeightRaw: asBigInt(proposal.account.maxVoteWeight),
    name: proposal.account.name,
    options: proposal.account.options.map((option) => ({
      instructionsCount: option.instructionsCount,
      instructionsExecutedCount: option.instructionsExecutedCount,
      instructionsNextIndex: option.instructionsNextIndex,
      label: option.label,
      voteResult: option.voteResult,
      voteWeightRaw: BigInt(option.voteWeight.toString(10)),
    })),
    ownerRecordAddress: proposal.account.tokenOwnerRecord.toBase58(),
    ownerWalletAddress: ownerRecordToWallet.get(proposal.account.tokenOwnerRecord.toBase58()) ?? null,
    proposalState: proposal.account.state,
    stateLabel: toProposalStateLabel(proposal.account.state),
    vetoVoteWeightRaw: BigInt(proposal.account.vetoVoteWeight.toString(10)),
    voteThresholdPct: communityThreshold,
    votingCompletedAtIso: toIsoTimestamp(proposal.account.votingCompletedAt),
  };
}

function toInstructionData(ix: TransactionInstruction): InstructionData {
  return new InstructionData({
    accounts: ix.keys.map((meta) =>
      new AccountMetaData({
        pubkey: meta.pubkey,
        isSigner: meta.isSigner,
        isWritable: meta.isWritable,
      }),
    ),
    data: Uint8Array.from(ix.data),
    programId: ix.programId,
  });
}

function withInstructions(
  feePayer: PublicKey,
  instructions: TransactionInstruction[],
): Transaction {
  return new Transaction({ feePayer }).add(...instructions);
}

function parseOptionalHex32(value: string | null | undefined): string | null {
  const normalized = value?.trim().toLowerCase().replace(/^0x/, "") ?? "";
  if (!normalized) return null;
  if (!/^[0-9a-f]{64}$/.test(normalized)) {
    throw new Error(`Expected 32-byte hex value, received ${value}`);
  }
  return normalized;
}

export function parseHex32Csv(raw: string): string[] {
  return [...new Set(
    raw
      .split(",")
      .map((entry) => parseOptionalHex32(entry))
      .filter((entry): entry is string => Boolean(entry)),
  )];
}

export function getGovernanceRuntimeConfig(): GovernanceRuntimeConfig {
  const cluster =
    process.env.NEXT_PUBLIC_REALMS_CLUSTER?.trim()
    || process.env.NEXT_PUBLIC_SOLANA_EXPLORER_CLUSTER?.trim()
    || DEFAULT_CLUSTER;

  const overrideRaw = process.env.NEXT_PUBLIC_GOVERNANCE_PROGRAM_VERSION?.trim() ?? "";
  const overrideVersion = overrideRaw ? Number.parseInt(overrideRaw, 10) : null;

  return {
    cluster,
    governanceAddress: isConfigured(process.env.NEXT_PUBLIC_GOVERNANCE_CONFIG)
      ? process.env.NEXT_PUBLIC_GOVERNANCE_CONFIG!.trim()
      : null,
    governanceTokenMint: isConfigured(process.env.NEXT_PUBLIC_GOVERNANCE_TOKEN_MINT)
      ? process.env.NEXT_PUBLIC_GOVERNANCE_TOKEN_MINT!.trim()
      : null,
    programId:
      process.env.NEXT_PUBLIC_GOVERNANCE_PROGRAM_ID?.trim()
      || DEFAULT_GOVERNANCE_PROGRAM_ID,
    programVersionOverride:
      overrideVersion != null && Number.isFinite(overrideVersion) && overrideVersion > 0
        ? overrideVersion
        : null,
    realmAddress: isConfigured(process.env.NEXT_PUBLIC_GOVERNANCE_REALM)
      ? process.env.NEXT_PUBLIC_GOVERNANCE_REALM!.trim()
      : null,
  };
}

export function normalizeGovernanceProgramVersion(params: {
  detectedVersion: number;
  overrideVersion?: number | null;
  programId: string;
}): number {
  if (params.overrideVersion != null && params.overrideVersion > 0) {
    return params.overrideVersion;
  }
  if (
    params.detectedVersion === 1
    && params.programId === DEFAULT_GOVERNANCE_PROGRAM_ID
  ) {
    return 3;
  }
  return params.detectedVersion;
}

export function normalizeGovernanceInstructionHoldUpTime(minInstructionHoldUpTime: number): number {
  if (!Number.isFinite(minInstructionHoldUpTime) || minInstructionHoldUpTime <= 0) {
    return 0;
  }
  return Math.floor(minInstructionHoldUpTime);
}

export async function resolveGovernanceProgramVersion(params: {
  cluster: string;
  connection: Connection;
  overrideVersion?: number | null;
  programId: PublicKey;
}): Promise<number> {
  const detectedVersion = await getGovernanceProgramVersion(
    params.connection,
    params.programId,
    params.cluster,
  );

  return normalizeGovernanceProgramVersion({
    detectedVersion,
    overrideVersion: params.overrideVersion ?? null,
    programId: params.programId.toBase58(),
  });
}

export function formatGovernanceAmount(raw: bigint, decimals: number): string {
  const negative = raw < 0n;
  const absolute = negative ? -raw : raw;
  if (decimals === 0) return `${negative ? "-" : ""}${absolute.toString()}`;

  const divisor = 10n ** BigInt(decimals);
  const whole = absolute / divisor;
  const fraction = absolute % divisor;
  const fractionText = fraction.toString().padStart(decimals, "0").replace(/0+$/, "");
  return `${negative ? "-" : ""}${whole.toString()}${fractionText ? `.${fractionText}` : ""}`;
}

export function parseGovernanceAmountInput(value: string, decimals: number): bigint {
  const trimmed = value.trim();
  if (!trimmed) return 0n;
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error("Enter a valid token amount.");
  }

  const [wholePart, fractionPartRaw = ""] = trimmed.split(".");
  if (fractionPartRaw.length > decimals) {
    throw new Error(`Amount supports up to ${decimals} decimal places.`);
  }

  const whole = BigInt(wholePart || "0");
  const fraction = BigInt((fractionPartRaw || "").padEnd(decimals, "0") || "0");
  return whole * 10n ** BigInt(decimals) + fraction;
}

async function loadWalletGovernanceState(params: {
  connection: Connection;
  governanceTokenMint: PublicKey;
  programId: PublicKey;
  proposalAddresses: Set<string>;
  realmAddress: PublicKey;
  walletAddress: PublicKey;
}): Promise<{
  voteMap: Map<string, GovernanceVoteSummary>;
  wallet: GovernanceWalletSummary;
} | null> {
  const recordsByOwner = await getTokenOwnerRecordsByOwner(
    params.connection,
    params.programId,
    params.walletAddress,
  ).catch(() => []);

  const matchingRecord = recordsByOwner.find(
    (record) =>
      record.account.realm.equals(params.realmAddress)
      && record.account.governingTokenMint.equals(params.governanceTokenMint),
  ) ?? null;

  const tokenAccountAddress = await getAssociatedTokenAddress(
    params.governanceTokenMint,
    params.walletAddress,
  );
  const tokenAccount = await getAccount(params.connection, tokenAccountAddress).catch(() => null);

  const voteRecords = await getVoteRecordsByVoter(
    params.connection,
    params.programId,
    params.walletAddress,
  ).catch(() => []);

  const voteMap = new Map<string, GovernanceVoteSummary>();
  for (const record of voteRecords) {
    const proposalAddress = record.account.proposal.toBase58();
    if (!params.proposalAddresses.has(proposalAddress)) continue;
    voteMap.set(proposalAddress, {
      address: record.pubkey.toBase58(),
      choice: toGovernanceVoteChoice(record.account),
      isRelinquished: record.account.isRelinquished,
      proposalAddress,
      voterWeightRaw: asBigInt(record.account.voterWeight),
    });
  }

  return {
    voteMap,
    wallet: {
      delegatedTo: matchingRecord?.account.governanceDelegate?.toBase58() ?? null,
      depositedVotesRaw: matchingRecord
        ? BigInt(matchingRecord.account.governingTokenDepositAmount.toString(10))
        : 0n,
      governingTokenBalanceRaw: tokenAccount
        ? BigInt(tokenAccount.amount.toString())
        : 0n,
      governingTokenMint: params.governanceTokenMint.toBase58(),
      tokenAccountAddress: tokenAccountAddress.toBase58(),
      tokenOwnerRecordAddress: matchingRecord?.pubkey.toBase58() ?? null,
      totalVotesCount: matchingRecord?.account.totalVotesCount ?? 0,
      unrelinquishedVotesCount: matchingRecord?.account.unrelinquishedVotesCount ?? 0,
    },
  };
}

async function loadGovernanceBase(params: {
  connection: Connection;
  includeMembers?: boolean;
}): Promise<{
  governance: { pubkey: PublicKey; account: Governance };
  governanceAddress: PublicKey;
  governanceProgramId: PublicKey;
  governanceProgramVersion: number;
  governanceTokenMint: PublicKey;
  members: GovernanceMemberSummary[];
  nativeTreasuryAddress: PublicKey;
  nativeTreasuryLamports: bigint;
  ownerRecordToWallet: Map<string, string>;
  realm: Awaited<ReturnType<typeof getRealm>>;
  runtime: GovernanceRuntimeConfig;
  tokenDecimals: number;
  tokenSupplyRaw: bigint;
} | null> {
  const runtime = getGovernanceRuntimeConfig();
  if (!runtime.realmAddress || !runtime.governanceAddress || !runtime.governanceTokenMint) {
    return null;
  }

  const governanceProgramId = new PublicKey(runtime.programId);
  const governanceAddress = new PublicKey(runtime.governanceAddress);
  const governanceTokenMint = new PublicKey(runtime.governanceTokenMint);
  const realmAddress = new PublicKey(runtime.realmAddress);
  const governanceProgramVersion = await resolveGovernanceProgramVersion({
    cluster: runtime.cluster,
    connection: params.connection,
    overrideVersion: runtime.programVersionOverride,
    programId: governanceProgramId,
  });

  const [realm, governance, nativeTreasuryAddress, nativeTreasuryLamports, mint, memberAccounts] = await Promise.all([
    getRealm(params.connection, realmAddress),
    getGovernance(params.connection, governanceAddress),
    getNativeTreasuryAddress(governanceProgramId, governanceAddress),
    getNativeTreasuryAddress(governanceProgramId, governanceAddress).then((address) =>
      params.connection.getBalance(address, "confirmed").then((lamports) => BigInt(lamports)),
    ),
    getMint(params.connection, governanceTokenMint),
    params.includeMembers === false
      ? Promise.resolve([])
      : getAllTokenOwnerRecords(params.connection, governanceProgramId, realmAddress),
  ]);

  const ownerRecordToWallet = new Map<string, string>();
  const members = memberAccounts
    .filter((record) => record.account.governingTokenMint.equals(governanceTokenMint))
    .map((record) => {
      ownerRecordToWallet.set(record.pubkey.toBase58(), record.account.governingTokenOwner.toBase58());
      return {
        address: record.pubkey.toBase58(),
        delegatedTo: record.account.governanceDelegate?.toBase58() ?? null,
        governingTokenMint: record.account.governingTokenMint.toBase58(),
        governingTokenOwner: record.account.governingTokenOwner.toBase58(),
        depositedVotesRaw: BigInt(record.account.governingTokenDepositAmount.toString(10)),
        outstandingProposalCount: record.account.outstandingProposalCount,
        totalVotesCount: record.account.totalVotesCount,
        unrelinquishedVotesCount: record.account.unrelinquishedVotesCount,
      };
    })
    .sort((left, right) => {
      if (left.depositedVotesRaw === right.depositedVotesRaw) {
        return left.governingTokenOwner.localeCompare(right.governingTokenOwner);
      }
      return left.depositedVotesRaw > right.depositedVotesRaw ? -1 : 1;
    });

  return {
    governance,
    governanceAddress,
    governanceProgramId,
    governanceProgramVersion,
    governanceTokenMint,
    members,
    nativeTreasuryAddress,
    nativeTreasuryLamports,
    ownerRecordToWallet,
    realm,
    runtime,
    tokenDecimals: mint.decimals,
    tokenSupplyRaw: BigInt(mint.supply.toString()),
  };
}

export async function loadGovernanceDashboard(params: {
  connection: Connection;
  walletAddress?: PublicKey | null;
}): Promise<GovernanceDashboardSummary | null> {
  const base = await loadGovernanceBase({ connection: params.connection, includeMembers: true });
  if (!base) return null;

  const [realmConfig, proposals] = await Promise.all([
    tryGetRealmConfig(params.connection, base.governanceProgramId, base.realm.pubkey),
    getProposalsByGovernance(params.connection, base.governanceProgramId, base.governanceAddress),
  ]);

  const proposalAddresses = new Set(proposals.map((proposal) => proposal.pubkey.toBase58()));
  const walletState = params.walletAddress
    ? await loadWalletGovernanceState({
        connection: params.connection,
        governanceTokenMint: base.governanceTokenMint,
        programId: base.governanceProgramId,
        proposalAddresses,
        realmAddress: base.realm.pubkey,
        walletAddress: params.walletAddress,
      })
    : null;

  const walletVotes = walletState?.voteMap ?? new Map<string, GovernanceVoteSummary>();
  const normalizedProposals = proposals
    .map((proposal) => toProposalSummary(proposal, base.ownerRecordToWallet, walletVotes))
    .sort((left, right) => right.address.localeCompare(left.address));

  const proposalCounts = normalizedProposals.reduce<Record<GovernanceProposalGroup, number>>(
    (counts, proposal) => ({
      ...counts,
      [proposal.group]: counts[proposal.group] + 1,
    }),
    { active: 0, executable: 0, completed: 0, failed: 0 },
  );

  return {
    governanceAddress: base.governanceAddress.toBase58(),
    governanceProgramId: base.governanceProgramId.toBase58(),
    governanceProgramVersion: base.governanceProgramVersion,
    governedAccountAddress: base.governance.account.governedAccount.toBase58(),
    memberCount: base.members.length,
    members: base.members,
    nativeTreasuryAddress: base.nativeTreasuryAddress.toBase58(),
    nativeTreasuryLamports: base.nativeTreasuryLamports,
    proposalCounts,
    proposals: normalizedProposals,
    realmAddress: base.realm.pubkey.toBase58(),
    realmAuthorityAddress: base.realm.account.authority?.toBase58() ?? null,
    realmName: base.realm.account.name,
    rules: {
      baseVotingTimeSeconds: base.governance.account.config.baseVotingTime,
      communityVoteThresholdPct:
        base.governance.account.config.communityVoteThreshold.type === VoteThresholdType.YesVotePercentage
          ? base.governance.account.config.communityVoteThreshold.value ?? null
          : null,
      instructionHoldUpTimeSeconds: base.governance.account.config.minInstructionHoldUpTime,
      minCommunityTokensToCreateGovernanceRaw: BigInt(
        base.realm.account.config.minCommunityTokensToCreateGovernance.toString(10),
      ),
      minCommunityTokensToCreateProposalRaw: BigInt(
        base.governance.account.config.minCommunityTokensToCreateProposal.toString(10),
      ),
      pluginEnabled:
        base.realm.account.config.useCommunityVoterWeightAddin
        || base.realm.account.config.useMaxCommunityVoterWeightAddin
        || Boolean(realmConfig?.account.communityTokenConfig.voterWeightAddin)
        || Boolean(realmConfig?.account.communityTokenConfig.maxVoterWeightAddin),
      votingCoolOffTimeSeconds: base.governance.account.config.votingCoolOffTime,
    },
    tokenDecimals: base.tokenDecimals,
    tokenMintAddress: base.governanceTokenMint.toBase58(),
    tokenSupplyRaw: base.tokenSupplyRaw,
    wallet: walletState?.wallet ?? null,
  };
}

export async function loadGovernanceProposalDetail(params: {
  connection: Connection;
  proposalAddress: PublicKey;
  walletAddress?: PublicKey | null;
}): Promise<GovernanceProposalDetailSummary | null> {
  const base = await loadGovernanceBase({ connection: params.connection, includeMembers: false });
  if (!base) return null;

  const proposal = await getProposal(params.connection, params.proposalAddress);
  const walletState = params.walletAddress
    ? await loadWalletGovernanceState({
        connection: params.connection,
        governanceTokenMint: base.governanceTokenMint,
        programId: base.governanceProgramId,
        proposalAddresses: new Set([params.proposalAddress.toBase58()]),
        realmAddress: base.realm.pubkey,
        walletAddress: params.walletAddress,
      })
    : null;

  const proposalTransactions = (await getGovernanceAccounts(
    params.connection,
    base.governanceProgramId,
    ProposalTransaction,
  )).filter((row) => row.account.proposal.equals(params.proposalAddress));

  const proposalOwnerRecord = await getTokenOwnerRecord(
    params.connection,
    proposal.account.tokenOwnerRecord,
  ).catch(() => null);
  const ownerRecordToWallet = new Map<string, string>();
  if (proposalOwnerRecord) {
    ownerRecordToWallet.set(
      proposalOwnerRecord.pubkey.toBase58(),
      proposalOwnerRecord.account.governingTokenOwner.toBase58(),
    );
  }
  const currentWalletVoteMap = walletState?.voteMap ?? new Map<string, GovernanceVoteSummary>();
  const proposalSummary = toProposalSummary(proposal, ownerRecordToWallet, currentWalletVoteMap);

  return {
    governanceAddress: base.governanceAddress.toBase58(),
    nativeTreasuryAddress: base.nativeTreasuryAddress.toBase58(),
    proposal: proposalSummary,
    proposalOwnerRecord: proposalOwnerRecord
      ? {
          address: proposalOwnerRecord.pubkey.toBase58(),
          delegatedTo: proposalOwnerRecord.account.governanceDelegate?.toBase58() ?? null,
          governingTokenMint: proposalOwnerRecord.account.governingTokenMint.toBase58(),
          governingTokenOwner: proposalOwnerRecord.account.governingTokenOwner.toBase58(),
          depositedVotesRaw: BigInt(proposalOwnerRecord.account.governingTokenDepositAmount.toString(10)),
          outstandingProposalCount: proposalOwnerRecord.account.outstandingProposalCount,
          totalVotesCount: proposalOwnerRecord.account.totalVotesCount,
          unrelinquishedVotesCount: proposalOwnerRecord.account.unrelinquishedVotesCount,
        }
      : null,
    proposalTransactions: proposalTransactions
      .sort((left, right) => {
        if (left.account.optionIndex === right.account.optionIndex) {
          return left.account.instructionIndex - right.account.instructionIndex;
        }
        return left.account.optionIndex - right.account.optionIndex;
      })
      .map((row) => ({
        address: row.pubkey.toBase58(),
        executedAtIso: toIsoTimestamp(row.account.executedAt),
        executionStatus: row.account.executionStatus,
        executionStatusLabel: toExecutionStatusLabel(row.account.executionStatus),
        holdUpTimeSeconds: row.account.holdUpTime,
        instructionIndex: row.account.instructionIndex,
        instructions: row.account.getAllInstructions().map((instruction) => ({
          accountCount: instruction.accounts.length,
          dataLength: instruction.data.length,
          programId: instruction.programId.toBase58(),
        })),
        optionIndex: row.account.optionIndex,
        rawInstructions: row.account.getAllInstructions(),
      })),
    realmAddress: base.realm.pubkey.toBase58(),
    tokenDecimals: base.tokenDecimals,
  };
}

export async function buildDepositGoverningTokensTx(params: {
  amountRaw: bigint;
  connection: Connection;
  owner: PublicKey;
}): Promise<Transaction> {
  const runtime = getGovernanceRuntimeConfig();
  if (!runtime.realmAddress || !runtime.governanceTokenMint) {
    throw new Error("Governance configuration is not available.");
  }

  const governanceTokenMint = new PublicKey(runtime.governanceTokenMint);
  const realmAddress = new PublicKey(runtime.realmAddress);
  const governanceProgramId = new PublicKey(runtime.programId);
  const governanceProgramVersion = await resolveGovernanceProgramVersion({
    cluster: runtime.cluster,
    connection: params.connection,
    overrideVersion: runtime.programVersionOverride,
    programId: governanceProgramId,
  });
  const sourceTokenAccount = await getAssociatedTokenAddress(governanceTokenMint, params.owner);
  const tokenAccountInfo = await params.connection.getAccountInfo(sourceTokenAccount, "confirmed");
  if (!tokenAccountInfo) {
    throw new Error("Governance token account was not found for the connected wallet.");
  }

  const instructions: TransactionInstruction[] = [];
  await withDepositGoverningTokens(
    instructions,
    governanceProgramId,
    governanceProgramVersion,
    realmAddress,
    sourceTokenAccount,
    governanceTokenMint,
    params.owner,
    params.owner,
    params.owner,
    new BN(params.amountRaw.toString(10)),
  );

  return withInstructions(params.owner, instructions);
}

export async function buildWithdrawGoverningTokensTx(params: {
  connection: Connection;
  owner: PublicKey;
}): Promise<Transaction> {
  const runtime = getGovernanceRuntimeConfig();
  if (!runtime.realmAddress || !runtime.governanceTokenMint) {
    throw new Error("Governance configuration is not available.");
  }

  const governanceTokenMint = new PublicKey(runtime.governanceTokenMint);
  const realmAddress = new PublicKey(runtime.realmAddress);
  const governanceProgramId = new PublicKey(runtime.programId);
  const governanceProgramVersion = await resolveGovernanceProgramVersion({
    cluster: runtime.cluster,
    connection: params.connection,
    overrideVersion: runtime.programVersionOverride,
    programId: governanceProgramId,
  });
  const destinationTokenAccount = await getAssociatedTokenAddress(governanceTokenMint, params.owner);

  const instructions: TransactionInstruction[] = [];
  const destinationInfo = await params.connection.getAccountInfo(destinationTokenAccount, "confirmed");
  if (!destinationInfo) {
    instructions.push(
      createAssociatedTokenAccountInstruction(
        params.owner,
        destinationTokenAccount,
        params.owner,
        governanceTokenMint,
      ),
    );
  }

  await withWithdrawGoverningTokens(
    instructions,
    governanceProgramId,
    governanceProgramVersion,
    realmAddress,
    destinationTokenAccount,
    governanceTokenMint,
    params.owner,
  );

  return withInstructions(params.owner, instructions);
}

export async function buildCastGovernanceVoteTx(params: {
  approve: boolean;
  connection: Connection;
  owner: PublicKey;
  proposalAddress: PublicKey;
}): Promise<Transaction> {
  const runtime = getGovernanceRuntimeConfig();
  if (!runtime.realmAddress || !runtime.governanceAddress || !runtime.governanceTokenMint) {
    throw new Error("Governance configuration is not available.");
  }

  const governanceProgramId = new PublicKey(runtime.programId);
  const governanceProgramVersion = await resolveGovernanceProgramVersion({
    cluster: runtime.cluster,
    connection: params.connection,
    overrideVersion: runtime.programVersionOverride,
    programId: governanceProgramId,
  });
  const realmAddress = new PublicKey(runtime.realmAddress);
  const governanceAddress = new PublicKey(runtime.governanceAddress);
  const governanceTokenMint = new PublicKey(runtime.governanceTokenMint);
  const proposal = await getProposal(params.connection, params.proposalAddress);
  const tokenOwnerRecord = await getTokenOwnerRecordForRealm(
    params.connection,
    governanceProgramId,
    realmAddress,
    governanceTokenMint,
    params.owner,
  );

  const instructions: TransactionInstruction[] = [];
  await withCastVote(
    instructions,
    governanceProgramId,
    governanceProgramVersion,
    realmAddress,
    governanceAddress,
    params.proposalAddress,
    proposal.account.tokenOwnerRecord,
    tokenOwnerRecord.pubkey,
    params.owner,
    governanceTokenMint,
    Vote.fromYesNoVote(params.approve ? YesNoVote.Yes : YesNoVote.No),
    params.owner,
  );

  return withInstructions(params.owner, instructions);
}

export async function buildRelinquishGovernanceVoteTx(params: {
  connection: Connection;
  owner: PublicKey;
  proposalAddress: PublicKey;
}): Promise<Transaction> {
  const runtime = getGovernanceRuntimeConfig();
  if (!runtime.realmAddress || !runtime.governanceAddress || !runtime.governanceTokenMint) {
    throw new Error("Governance configuration is not available.");
  }

  const governanceProgramId = new PublicKey(runtime.programId);
  const governanceProgramVersion = await resolveGovernanceProgramVersion({
    cluster: runtime.cluster,
    connection: params.connection,
    overrideVersion: runtime.programVersionOverride,
    programId: governanceProgramId,
  });
  const realmAddress = new PublicKey(runtime.realmAddress);
  const governanceAddress = new PublicKey(runtime.governanceAddress);
  const governanceTokenMint = new PublicKey(runtime.governanceTokenMint);
  const tokenOwnerRecord = await getTokenOwnerRecordForRealm(
    params.connection,
    governanceProgramId,
    realmAddress,
    governanceTokenMint,
    params.owner,
  );

  const voteRecords = await getVoteRecordsByVoter(
    params.connection,
    governanceProgramId,
    params.owner,
  );
  const voteRecord = voteRecords.find((record) => record.account.proposal.equals(params.proposalAddress));
  if (!voteRecord) {
    throw new Error("No vote record exists for the connected wallet on this proposal.");
  }

  const instructions: TransactionInstruction[] = [];
  await withRelinquishVote(
    instructions,
    governanceProgramId,
    governanceProgramVersion,
    realmAddress,
    governanceAddress,
    params.proposalAddress,
    tokenOwnerRecord.pubkey,
    governanceTokenMint,
    voteRecord.pubkey,
    params.owner,
    params.owner,
  );

  return withInstructions(params.owner, instructions);
}

export async function buildExecuteGovernanceTransactionTx(params: {
  connection: Connection;
  proposalAddress: PublicKey;
  proposalTransactionAddress: PublicKey;
  rawInstructions: InstructionData[];
  walletAddress: PublicKey;
}): Promise<Transaction> {
  const runtime = getGovernanceRuntimeConfig();
  if (!runtime.governanceAddress) {
    throw new Error("Governance configuration is not available.");
  }

  const governanceProgramId = new PublicKey(runtime.programId);
  const governanceProgramVersion = await resolveGovernanceProgramVersion({
    cluster: runtime.cluster,
    connection: params.connection,
    overrideVersion: runtime.programVersionOverride,
    programId: governanceProgramId,
  });
  const governanceAddress = new PublicKey(runtime.governanceAddress);

  const instructions: TransactionInstruction[] = [];
  await withExecuteTransaction(
    instructions,
    governanceProgramId,
    governanceProgramVersion,
    governanceAddress,
    params.proposalAddress,
    params.proposalTransactionAddress,
    params.rawInstructions,
  );

  return withInstructions(params.walletAddress, instructions);
}

function toSchemaInstructionSet(params: {
  closeSchemaHashes: string[];
  governanceAuthority: PublicKey;
  recentBlockhash: string;
  unverifySchemaHashes: string[];
  verifySchemaHashHex: string | null;
  enabledRulesBySchemaHash: Map<string, RuleSummary[]>;
}): TransactionInstruction[] {
  const instructions: TransactionInstruction[] = [];
  if (params.verifySchemaHashHex) {
    const verifyInstruction = buildVerifyOutcomeSchemaTx({
      governanceAuthority: params.governanceAuthority,
      recentBlockhash: params.recentBlockhash,
      schemaKeyHashHex: params.verifySchemaHashHex,
      verified: true,
    }).instructions[0];
    if (!verifyInstruction) {
      throw new Error("Failed to build verify_outcome_schema instruction.");
    }
    instructions.push(verifyInstruction);
  }

  for (const schemaKeyHashHex of params.unverifySchemaHashes) {
    const unverifyInstruction = buildVerifyOutcomeSchemaTx({
      governanceAuthority: params.governanceAuthority,
      recentBlockhash: params.recentBlockhash,
      schemaKeyHashHex,
      verified: false,
    }).instructions[0];
    if (!unverifyInstruction) {
      throw new Error(`Failed to build unverify instruction for ${schemaKeyHashHex}.`);
    }
    instructions.push(unverifyInstruction);
  }

  const effectiveBackfillHashes = [...new Set([
    ...params.unverifySchemaHashes,
    ...params.closeSchemaHashes,
  ])];

  for (const schemaKeyHashHex of effectiveBackfillHashes) {
    const enabledRules = params.enabledRulesBySchemaHash.get(schemaKeyHashHex) ?? [];
    if (params.closeSchemaHashes.includes(schemaKeyHashHex) && enabledRules.length > 0) {
      throw new Error(
        `Cannot close schema ${schemaKeyHashHex}: ${enabledRules.length} enabled pool rule(s) still reference it.`,
      );
    }
    const backfillInstruction = buildBackfillSchemaDependencyLedgerTx({
      governanceAuthority: params.governanceAuthority,
      recentBlockhash: params.recentBlockhash,
      schemaKeyHashHex,
      poolRuleAddresses: enabledRules.map((row) => new PublicKey(row.address)),
    }).instructions[0];
    if (!backfillInstruction) {
      throw new Error(`Failed to build backfill instruction for ${schemaKeyHashHex}.`);
    }
    instructions.push(backfillInstruction);
  }

  for (const schemaKeyHashHex of params.closeSchemaHashes) {
    const closeInstruction = buildCloseOutcomeSchemaTx({
      governanceAuthority: params.governanceAuthority,
      recipientSystemAccount: params.governanceAuthority,
      recentBlockhash: params.recentBlockhash,
      schemaKeyHashHex,
    }).instructions[0];
    if (!closeInstruction) {
      throw new Error(`Failed to build close instruction for ${schemaKeyHashHex}.`);
    }
    instructions.push(closeInstruction);
  }

  return instructions;
}

export function buildProtocolConfigProposalInstructions(params: {
  governanceAuthority: PublicKey;
  draft: ProtocolConfigProposalDraft;
  recentBlockhash: string;
}): TransactionInstruction[] {
  void params;
  throw new Error(
    "Protocol config proposals are not supported by the current public program surface. Use scoped live controls or schema-state governance proposals instead.",
  );
}

export async function buildSchemaStateProposalInstructions(params: {
  closeSchemaHashes: string[];
  connection: Connection;
  governanceAuthority: PublicKey;
  recentBlockhash: string;
  unverifySchemaHashes: string[];
  verifySchemaHashHex: string | null;
}): Promise<TransactionInstruction[]> {
  const normalizedVerify = parseOptionalHex32(params.verifySchemaHashHex);
  const normalizedUnverify = [...new Set(params.unverifySchemaHashes.map((value) => parseOptionalHex32(value)).filter(
    (value): value is string => Boolean(value),
  ))];
  const normalizedClose = [...new Set(params.closeSchemaHashes.map((value) => parseOptionalHex32(value)).filter(
    (value): value is string => Boolean(value),
  ))];

  if (!normalizedVerify && normalizedUnverify.length === 0 && normalizedClose.length === 0) {
    throw new Error("Choose at least one schema action to propose.");
  }

  const enabledRulesBySchemaHash = new Map<string, RuleSummary[]>();
  for (const schemaKeyHashHex of [...new Set([...normalizedUnverify, ...normalizedClose])]) {
    enabledRulesBySchemaHash.set(
      schemaKeyHashHex,
      await listPoolRules({
        connection: params.connection,
        enabledOnly: true,
        schemaKeyHashHex,
      }),
    );
  }

  return toSchemaInstructionSet({
    closeSchemaHashes: normalizedClose,
    enabledRulesBySchemaHash,
    governanceAuthority: params.governanceAuthority,
    recentBlockhash: params.recentBlockhash,
    unverifySchemaHashes: normalizedUnverify,
    verifySchemaHashHex: normalizedVerify,
  });
}

function proposalNameForTemplate(template: GovernanceDescriptionTemplate): string {
  const stamp = new Date().toISOString().slice(0, 10);
  if (template === "schema-state") {
    return `Schema state update ${stamp}`;
  }
  return `Protocol config update ${stamp}`;
}

export function buildGovernanceDescriptionLink(params: {
  origin: string;
  payload: GovernanceDescriptionPayload;
}): string {
  const url = new URL(`/governance/descriptions/${params.payload.template}`, params.origin);
  if (params.payload.template === "protocol-config") {
    url.searchParams.set("protocolFeeBps", String(params.payload.protocolFeeBps));
    url.searchParams.set("defaultStakeMint", params.payload.defaultStakeMint);
    url.searchParams.set("minOracleStake", params.payload.minOracleStake.toString());
    url.searchParams.set("emergencyPaused", params.payload.emergencyPaused ? "true" : "false");
    url.searchParams.set("allowedPayoutMintsHashHex", params.payload.allowedPayoutMintsHashHex);
    if (params.payload.newGovernanceAuthority) {
      url.searchParams.set("newGovernanceAuthority", params.payload.newGovernanceAuthority);
    }
    return url.toString();
  }

  if (params.payload.verifySchemaHashHex) {
    url.searchParams.set("verifySchemaHashHex", params.payload.verifySchemaHashHex);
  }
  if (params.payload.unverifySchemaHashes.length > 0) {
    url.searchParams.set("unverifySchemaHashes", params.payload.unverifySchemaHashes.join(","));
  }
  if (params.payload.closeSchemaHashes.length > 0) {
    url.searchParams.set("closeSchemaHashes", params.payload.closeSchemaHashes.join(","));
  }
  return url.toString();
}

export function parseGovernanceDescriptionPayload(params: {
  searchParams: Record<string, string | string[] | undefined>;
  template: GovernanceDescriptionTemplate;
}): GovernanceDescriptionPayload {
  if (params.template === "protocol-config") {
    const protocolFeeBps = Number.parseInt(
      Array.isArray(params.searchParams.protocolFeeBps)
        ? params.searchParams.protocolFeeBps[0] ?? "0"
        : params.searchParams.protocolFeeBps ?? "0",
      10,
    );
    const minOracleStakeRaw = Array.isArray(params.searchParams.minOracleStake)
      ? params.searchParams.minOracleStake[0] ?? "0"
      : params.searchParams.minOracleStake ?? "0";
    const defaultStakeMint = Array.isArray(params.searchParams.defaultStakeMint)
      ? params.searchParams.defaultStakeMint[0] ?? ZERO_PUBKEY
      : params.searchParams.defaultStakeMint ?? ZERO_PUBKEY;

    return {
      allowedPayoutMintsHashHex:
        parseOptionalHex32(Array.isArray(params.searchParams.allowedPayoutMintsHashHex)
          ? params.searchParams.allowedPayoutMintsHashHex[0]
          : params.searchParams.allowedPayoutMintsHashHex) ?? "00".repeat(32),
      defaultStakeMint,
      emergencyPaused:
        (Array.isArray(params.searchParams.emergencyPaused)
          ? params.searchParams.emergencyPaused[0]
          : params.searchParams.emergencyPaused) === "true",
      minOracleStake: BigInt(minOracleStakeRaw || "0"),
      newGovernanceAuthority:
        Array.isArray(params.searchParams.newGovernanceAuthority)
          ? params.searchParams.newGovernanceAuthority[0] ?? null
          : params.searchParams.newGovernanceAuthority ?? null,
      protocolFeeBps: Number.isFinite(protocolFeeBps) ? protocolFeeBps : 0,
      template: "protocol-config",
    };
  }

  return {
    closeSchemaHashes: parseHex32Csv(
      Array.isArray(params.searchParams.closeSchemaHashes)
        ? params.searchParams.closeSchemaHashes[0] ?? ""
        : params.searchParams.closeSchemaHashes ?? "",
    ),
    template: "schema-state",
    unverifySchemaHashes: parseHex32Csv(
      Array.isArray(params.searchParams.unverifySchemaHashes)
        ? params.searchParams.unverifySchemaHashes[0] ?? ""
        : params.searchParams.unverifySchemaHashes ?? "",
    ),
    verifySchemaHashHex: parseOptionalHex32(
      Array.isArray(params.searchParams.verifySchemaHashHex)
        ? params.searchParams.verifySchemaHashHex[0]
        : params.searchParams.verifySchemaHashHex,
    ),
  };
}

export async function buildGovernanceProposalPlan(params: {
  connection: Connection;
  descriptionLink: string;
  instructions: TransactionInstruction[];
  proposalName: string;
  template: GovernanceDescriptionTemplate;
  walletAddress: PublicKey;
}): Promise<GovernanceProposalPlan> {
  const runtime = getGovernanceRuntimeConfig();
  if (!runtime.realmAddress || !runtime.governanceAddress || !runtime.governanceTokenMint) {
    throw new Error("Governance configuration is not available.");
  }

  const governanceProgramId = new PublicKey(runtime.programId);
  const governanceProgramVersion = await resolveGovernanceProgramVersion({
    cluster: runtime.cluster,
    connection: params.connection,
    overrideVersion: runtime.programVersionOverride,
    programId: governanceProgramId,
  });
  const realmAddress = new PublicKey(runtime.realmAddress);
  const governanceAddress = new PublicKey(runtime.governanceAddress);
  const governanceTokenMint = new PublicKey(runtime.governanceTokenMint);
  const [tokenOwnerRecord, governanceAccount] = await Promise.all([
    getTokenOwnerRecordForRealm(
      params.connection,
      governanceProgramId,
      realmAddress,
      governanceTokenMint,
      params.walletAddress,
    ),
    getGovernance(params.connection, governanceAddress),
  ]);
  const instructionHoldUpTime = normalizeGovernanceInstructionHoldUpTime(
    governanceAccount.account.config.minInstructionHoldUpTime,
  );

  if (BigInt(tokenOwnerRecord.account.governingTokenDepositAmount.toString(10)) === 0n) {
    throw new Error("Deposit governance tokens before creating a proposal.");
  }

  const createProposalInstructions: TransactionInstruction[] = [];
  const proposalAddress = await withCreateProposal(
    createProposalInstructions,
    governanceProgramId,
    governanceProgramVersion,
    realmAddress,
    governanceAddress,
    tokenOwnerRecord.pubkey,
    params.proposalName || proposalNameForTemplate(params.template),
    params.descriptionLink,
    governanceTokenMint,
    params.walletAddress,
    undefined,
    VoteType.SINGLE_CHOICE,
    ["Approve"],
    true,
    params.walletAddress,
  );

  const steps: GovernanceProposalPlan["steps"] = [
    {
      label: "Create proposal",
      tx: withInstructions(params.walletAddress, createProposalInstructions),
    },
  ];

  for (let index = 0; index < params.instructions.length; index += 1) {
    const instruction = params.instructions[index]!;
    const insertInstructions: TransactionInstruction[] = [];
    await withInsertTransaction(
      insertInstructions,
      governanceProgramId,
      governanceProgramVersion,
      governanceAddress,
      proposalAddress,
      tokenOwnerRecord.pubkey,
      params.walletAddress,
      index,
      0,
      instructionHoldUpTime,
      [toInstructionData(instruction)],
      params.walletAddress,
    );
    steps.push({
      label: `Insert instruction ${index + 1}`,
      tx: withInstructions(params.walletAddress, insertInstructions),
    });
  }

  const signOffInstructions: TransactionInstruction[] = [];
  withSignOffProposal(
    signOffInstructions,
    governanceProgramId,
    governanceProgramVersion,
    realmAddress,
    governanceAddress,
    proposalAddress,
    params.walletAddress,
    undefined,
    tokenOwnerRecord.pubkey,
  );
  steps.push({
    label: "Sign off proposal",
    tx: withInstructions(params.walletAddress, signOffInstructions),
  });

  return {
    descriptionLink: params.descriptionLink,
    proposalAddress: proposalAddress.toBase58(),
    proposalName: params.proposalName,
    steps,
  };
}

export async function buildProtocolConfigProposalPlan(params: {
  connection: Connection;
  draft: ProtocolConfigProposalDraft;
  origin: string;
  walletAddress: PublicKey;
}): Promise<GovernanceProposalPlan> {
  void params;
  throw new Error(
    "Protocol config proposals are not supported by the current public program surface. Use scoped live controls or schema-state governance proposals instead.",
  );
}

export async function buildSchemaStateProposalPlan(params: {
  connection: Connection;
  draft: SchemaStateProposalDraft;
  origin: string;
  walletAddress: PublicKey;
}): Promise<GovernanceProposalPlan> {
  const runtime = getGovernanceRuntimeConfig();
  if (!runtime.governanceAddress) {
    throw new Error("Governance configuration is not available.");
  }

  const recentBlockhash = (await params.connection.getLatestBlockhash("confirmed")).blockhash;
  const instructions = await buildSchemaStateProposalInstructions({
    closeSchemaHashes: params.draft.closeSchemaHashes,
    connection: params.connection,
    governanceAuthority: new PublicKey(runtime.governanceAddress),
    recentBlockhash,
    unverifySchemaHashes: params.draft.unverifySchemaHashes,
    verifySchemaHashHex: params.draft.verifySchemaHashHex,
  });
  const descriptionLink = buildGovernanceDescriptionLink({
    origin: params.origin,
    payload: {
      closeSchemaHashes: params.draft.closeSchemaHashes,
      template: "schema-state",
      unverifySchemaHashes: params.draft.unverifySchemaHashes,
      verifySchemaHashHex: params.draft.verifySchemaHashHex,
    },
  });

  return buildGovernanceProposalPlan({
    connection: params.connection,
    descriptionLink,
    instructions,
    proposalName: proposalNameForTemplate("schema-state"),
    template: "schema-state",
    walletAddress: params.walletAddress,
  });
}

export async function loadDefaultProtocolConfig(connection: Connection): Promise<ProtocolConfigSummary | null> {
  return fetchProtocolConfig({ connection });
}
