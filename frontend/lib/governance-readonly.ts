// SPDX-License-Identifier: AGPL-3.0-or-later

import BN from "bn.js";
import {
  Governance,
  InstructionExecutionStatus,
  Proposal,
  ProposalState,
  ProposalTransaction,
  VoteRecord,
  VoteThresholdType,
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
  getTokenOwnerRecordsByOwner,
  getVoteRecordsByVoter,
  tryGetRealmConfig,
} from "@solana/spl-governance";
import {
  getAccount,
  getAssociatedTokenAddress,
  getMint,
} from "@solana/spl-token";
import { Connection, PublicKey } from "@solana/web3.js";

export const DEFAULT_GOVERNANCE_PROGRAM_ID = "GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw";
const DEFAULT_CLUSTER = "devnet";
const ZERO_PUBKEY = "11111111111111111111111111111111";

export type GovernanceProposalGroup = "active" | "executable" | "completed" | "failed";
export type GovernanceVoteChoice = "yes" | "no";

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

function classifyProposalGroup(state: ProposalState): GovernanceProposalGroup {
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

function normalizeGovernanceProgramVersion(params: {
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

async function resolveGovernanceProgramVersion(params: {
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
      })),
    realmAddress: base.realm.pubkey.toBase58(),
    tokenDecimals: base.tokenDecimals,
  };
}
