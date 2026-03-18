// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { Keypair, PublicKey } from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { CheckCircle2, RefreshCw, ShieldCheck } from "lucide-react";

import { PoolOraclesPanel as PoolOraclePolicyPanel } from "@/components/pool-oracles-panel";
import { ProtocolDetailDisclosure } from "@/components/protocol-detail-disclosure";
import { usePoolWorkspaceContext } from "@/components/pool-workspace-context";
import { SearchableSelect } from "@/components/searchable-select";
import { executeProtocolTransaction } from "@/lib/protocol-action";
import { deriveOracleSettlementActionDraft } from "@/lib/protocol-workspace-mappers";
import {
  AI_ROLE_ORACLE,
  AUTOMATION_MODE_ADVISORY,
  ZERO_PUBKEY,
  buildFinalizeCohortSettlementRootTx,
  buildFinalizeCycleOutcomeTx,
  buildFinalizeUnstakeTx,
  buildOpenCycleOutcomeDisputeTx,
  buildRequestUnstakeTx,
  buildResolveCycleOutcomeDisputeTx,
  buildSettleCycleCommitmentSolTx,
  buildSettleCycleCommitmentTx,
  buildSlashOracleTx,
  buildStakeOracleTx,
  buildSubmitOutcomeAttestationVoteTx,
  buildUpdateOracleMetadataTx,
  listCohortSettlementRoots,
  listMemberCycles,
  listOracleStakePositions,
  listOraclesWithProfiles,
  listOutcomeAggregates,
  listPoolTerms,
  listProtocolConfig,
  listWalletTokenAccountsForMint,
  type CohortSettlementRootSummary,
  type MemberCycleStateSummary,
  type OracleStakePositionSummary,
  type OracleWithProfileSummary,
  type OutcomeAggregateSummary,
  type PoolTermsSummary,
  type ProtocolConfigSummary,
  type TokenAccountSummary,
} from "@/lib/protocol";
import { formatRpcError } from "@/lib/rpc-errors";
import { parseWorkspacePanel, visibleWorkspacePanels, type PoolWorkspacePanel } from "@/lib/ui-capabilities";

type PoolOraclesConsoleProps = {
  poolAddress: string;
};

const ORACLE_PANELS: ReadonlyArray<{ value: PoolWorkspacePanel; label: string }> = [
  { value: "policy", label: "Policy" },
  { value: "staking", label: "Staking" },
  { value: "attestations", label: "Attestations" },
  { value: "settlements", label: "Settlements" },
  { value: "disputes", label: "Disputes" },
];

function shortAddress(value: string): string {
  if (value.length < 12) return value;
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function formatTimestamp(value: bigint): string {
  if (!value || value <= 0n) return "n/a";
  return new Date(Number(value) * 1000).toLocaleString();
}

export function PoolOraclesConsole({ poolAddress }: PoolOraclesConsoleProps) {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const { capabilities } = usePoolWorkspaceContext();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const requestedPanel = parseWorkspacePanel("oracles", searchParams.get("panel"));
  const [protocolConfig, setProtocolConfig] = useState<ProtocolConfigSummary | null>(null);
  const [poolTerms, setPoolTerms] = useState<PoolTermsSummary | null>(null);
  const [oracles, setOracles] = useState<OracleWithProfileSummary[]>([]);
  const [stakes, setStakes] = useState<OracleStakePositionSummary[]>([]);
  const [aggregates, setAggregates] = useState<OutcomeAggregateSummary[]>([]);
  const [memberCycles, setMemberCycles] = useState<MemberCycleStateSummary[]>([]);
  const [settlementRoots, setSettlementRoots] = useState<CohortSettlementRootSummary[]>([]);
  const [walletStakeAccounts, setWalletStakeAccounts] = useState<TokenAccountSummary[]>([]);
  const [memberPayoutAccounts, setMemberPayoutAccounts] = useState<TokenAccountSummary[]>([]);
  const [selectedOracleAddress, setSelectedOracleAddress] = useState("");
  const [selectedStakeAddress, setSelectedStakeAddress] = useState("");
  const [selectedAggregateAddress, setSelectedAggregateAddress] = useState("");
  const [selectedCycleAddress, setSelectedCycleAddress] = useState("");
  const [selectedRootAddress, setSelectedRootAddress] = useState("");
  const [selectedWalletStakeAccount, setSelectedWalletStakeAccount] = useState("");
  const [selectedMemberPayoutAccount, setSelectedMemberPayoutAccount] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<"ok" | "error" | null>(null);
  const [txUrl, setTxUrl] = useState<string | null>(null);

  const [metadataUriInput, setMetadataUriInput] = useState("");
  const [metadataActiveInput, setMetadataActiveInput] = useState(true);
  const [stakeAmountInput, setStakeAmountInput] = useState("0");
  const [unstakeAmountInput, setUnstakeAmountInput] = useState("0");
  const [unstakeCooldownInput, setUnstakeCooldownInput] = useState("604800");
  const [slashTreasuryTokenAccountInput, setSlashTreasuryTokenAccountInput] = useState("");
  const [slashAmountInput, setSlashAmountInput] = useState("0");
  const [schemaKeyHashInput, setSchemaKeyHashInput] = useState("");
  const [attestationDigestInput, setAttestationDigestInput] = useState("");
  const [observedValueHashInput, setObservedValueHashInput] = useState("");
  const [evidenceHashInput, setEvidenceHashInput] = useState("");
  const [externalAttestationRefInput, setExternalAttestationRefInput] = useState("");
  const [asOfTsInput, setAsOfTsInput] = useState("");
  const [votePassedInput, setVotePassedInput] = useState(true);
  const [settledScoreInput, setSettledScoreInput] = useState("0");
  const [settledPassedInput, setSettledPassedInput] = useState(true);
  const [shieldConsumedInput, setShieldConsumedInput] = useState(false);
  const [disputeReasonHashInput, setDisputeReasonHashInput] = useState("");
  const [sustainOriginalOutcomeInput, setSustainOriginalOutcomeInput] = useState(true);
  const walletAddress = publicKey?.toBase58() ?? "";
  const visiblePanels = useMemo(
    () => visibleWorkspacePanels("oracles", capabilities),
    [capabilities],
  );
  const activePanel = useMemo<PoolWorkspacePanel>(
    () => (requestedPanel && visiblePanels.includes(requestedPanel) ? requestedPanel : visiblePanels[0] ?? "policy"),
    [requestedPanel, visiblePanels],
  );
  const panelLead = useMemo(() => {
    if (activePanel === "policy") return "Start with policy and approval controls, then move into staking or settlement only when needed.";
    if (activePanel === "staking") return "Keep staking and metadata management record-driven from the selected oracle and stake position.";
    if (activePanel === "attestations") return "Select an aggregate first, then submit the attestation fields for that one record.";
    if (activePanel === "settlements") return "Use the selected cycle and settlement root to drive the next settlement action.";
    return "Open or resolve disputes from a selected aggregate instead of working from raw hashes.";
  }, [activePanel]);

  const selectedOracle = useMemo(
    () => oracles.find((row) => row.oracle === selectedOracleAddress) ?? oracles.find((row) => row.oracle === publicKey?.toBase58()) ?? oracles[0] ?? null,
    [oracles, publicKey, selectedOracleAddress],
  );
  const selectedStake = useMemo(
    () => stakes.find((row) => row.address === selectedStakeAddress) ?? stakes.find((row) => row.oracle === selectedOracle?.oracle) ?? null,
    [selectedOracle?.oracle, selectedStakeAddress, stakes],
  );
  const filteredAggregates = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return aggregates;
    return aggregates.filter((row) =>
      [row.member, row.cycleHashHex, row.ruleHashHex, row.address].some((value) => value.toLowerCase().includes(query)),
    );
  }, [aggregates, search]);
  const selectedAggregate = useMemo(
    () => filteredAggregates.find((row) => row.address === selectedAggregateAddress) ?? aggregates.find((row) => row.address === selectedAggregateAddress) ?? null,
    [aggregates, filteredAggregates, selectedAggregateAddress],
  );
  const selectedCycle = useMemo(
    () => memberCycles.find((row) => row.address === selectedCycleAddress) ?? memberCycles[0] ?? null,
    [memberCycles, selectedCycleAddress],
  );
  const selectedRoot = useMemo(
    () => settlementRoots.find((row) => row.address === selectedRootAddress) ?? settlementRoots[0] ?? null,
    [selectedRootAddress, settlementRoots],
  );
  const settlementDraft = useMemo(
    () =>
      deriveOracleSettlementActionDraft({
        memberCycle: selectedCycle,
        aggregate: selectedAggregate,
        poolTerms,
        settlementRootFinalized: selectedRoot?.finalized,
      }),
    [poolTerms, selectedAggregate, selectedCycle, selectedRoot?.finalized],
  );

  const setPanel = useCallback((nextPanel: PoolWorkspacePanel) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("section", "oracles");
    params.set("panel", nextPanel);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [pathname, router, searchParams]);

  useEffect(() => {
    if (requestedPanel === activePanel) return;
    setPanel(activePanel);
  }, [activePanel, requestedPanel, setPanel]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextConfig, nextTerms, nextOracles, nextStakes, nextAggregates, nextCycles, nextRoots] = await Promise.all([
        listProtocolConfig({ connection }),
        listPoolTerms({ connection, poolAddress, search: null }),
        listOraclesWithProfiles({ connection, activeOnly: false }),
        listOracleStakePositions({ connection, search: null }),
        listOutcomeAggregates({ connection, poolAddress, search: null }),
        listMemberCycles({ connection, poolAddress, search: null }),
        listCohortSettlementRoots({ connection, poolAddress, search: null }),
      ]);
      setProtocolConfig(nextConfig[0] ?? null);
      setPoolTerms(nextTerms[0] ?? null);
      setOracles(nextOracles);
      setStakes(nextStakes);
      setAggregates(nextAggregates);
      setMemberCycles(nextCycles);
      setSettlementRoots(nextRoots);
      setSelectedOracleAddress((current) => current && nextOracles.some((row) => row.oracle === current) ? current : nextOracles[0]?.oracle ?? "");
      setSelectedStakeAddress((current) => current && nextStakes.some((row) => row.address === current) ? current : nextStakes[0]?.address ?? "");
      setSelectedAggregateAddress((current) => current && nextAggregates.some((row) => row.address === current) ? current : nextAggregates[0]?.address ?? "");
      setSelectedRootAddress((current) => current && nextRoots.some((row) => row.address === current) ? current : nextRoots[0]?.address ?? "");
    } catch (cause) {
      setError(
        formatRpcError(cause, {
          fallback: "Failed to load oracle workspace data.",
          rpcEndpoint: connection.rpcEndpoint,
        }),
      );
    } finally {
      setLoading(false);
    }
  }, [connection, poolAddress]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (filteredAggregates.length === 0) {
      setSelectedAggregateAddress("");
      return;
    }
    setSelectedAggregateAddress((current) =>
      current && filteredAggregates.some((row) => row.address === current) ? current : filteredAggregates[0]!.address);
  }, [filteredAggregates]);

  useEffect(() => {
    if (!selectedOracle) return;
    setMetadataUriInput(selectedOracle.metadataUri || "");
    setMetadataActiveInput(selectedOracle.active);
  }, [selectedOracle]);

  useEffect(() => {
    const nextCycles = memberCycles.filter((row) => {
      if (!selectedAggregate) return true;
      return row.member === selectedAggregate.member && row.seriesRefHashHex === selectedAggregate.seriesRefHashHex;
    });
    if (nextCycles.length > 0) {
      setSelectedCycleAddress((current) =>
        current && nextCycles.some((row) => row.address === current) ? current : nextCycles[0]!.address);
    } else {
      setSelectedCycleAddress("");
    }
  }, [memberCycles, selectedAggregate]);

  useEffect(() => {
    if (!protocolConfig?.defaultStakeMint || protocolConfig.defaultStakeMint === ZERO_PUBKEY || !publicKey) {
      setWalletStakeAccounts([]);
      setSelectedWalletStakeAccount("");
      return;
    }
    let cancelled = false;
    void listWalletTokenAccountsForMint({
      connection,
      owner: publicKey.toBase58(),
      mint: protocolConfig.defaultStakeMint,
      search: null,
    }).then((rows) => {
      if (cancelled) return;
      setWalletStakeAccounts(rows);
      setSelectedWalletStakeAccount((current) =>
        current && rows.some((row) => row.address === current) ? current : rows[0]?.address ?? "");
    }).catch(() => {
      if (cancelled) return;
      setWalletStakeAccounts([]);
      setSelectedWalletStakeAccount("");
    });
    return () => {
      cancelled = true;
    };
  }, [connection, protocolConfig?.defaultStakeMint, publicKey]);

  useEffect(() => {
    if (!selectedCycle || selectedCycle.paymentMint === ZERO_PUBKEY) {
      setMemberPayoutAccounts([]);
      setSelectedMemberPayoutAccount("");
      return;
    }
    let cancelled = false;
    void listWalletTokenAccountsForMint({
      connection,
      owner: selectedCycle.member,
      mint: selectedCycle.paymentMint,
      search: null,
    }).then((rows) => {
      if (cancelled) return;
      setMemberPayoutAccounts(rows);
      setSelectedMemberPayoutAccount((current) =>
        current && rows.some((row) => row.address === current) ? current : rows[0]?.address ?? "");
    }).catch(() => {
      if (cancelled) return;
      setMemberPayoutAccounts([]);
      setSelectedMemberPayoutAccount("");
    });
    return () => {
      cancelled = true;
    };
  }, [connection, selectedCycle]);

  const oracleOptions = useMemo(
    () =>
      oracles.map((row) => ({
        value: row.oracle,
        label: row.profile?.displayName || shortAddress(row.oracle),
        hint: row.profile?.websiteUrl || row.metadataUri || "Registry entry",
      })),
    [oracles],
  );
  const aggregateOptions = useMemo(
    () =>
      filteredAggregates.map((row) => ({
        value: row.address,
        label: `${shortAddress(row.member)} • ${shortAddress(row.cycleHashHex)}`,
        hint: `${row.finalized ? "Finalized" : "Open"} • ${row.passed ? "Passed" : "Failed/pending"}`,
      })),
    [filteredAggregates],
  );
  const cycleOptions = useMemo(
    () =>
      memberCycles.map((row) => ({
        value: row.address,
        label: `${shortAddress(row.member)} • period ${row.periodIndex.toString()}`,
        hint: `${row.paymentMint === ZERO_PUBKEY ? "SOL" : shortAddress(row.paymentMint)} • ${row.passed ? "Passed" : "Pending/failed"}`,
      })),
    [memberCycles],
  );
  const rootOptions = useMemo(
    () =>
      settlementRoots.map((row) => ({
        value: row.address,
        label: `${shortAddress(row.cohortHashHex)} • ${row.successfulMemberCount} members`,
        hint: row.finalized ? "Finalized" : "Open root",
      })),
    [settlementRoots],
  );

  const metadataGuard = useMemo(() => {
    if (!capabilities.canManageOracleProfile) return "Oracle profile updates require an oracle or governance wallet.";
    if (!walletAddress || !selectedOracle || selectedOracle.oracle !== walletAddress) {
      return "Metadata updates require the selected oracle signer wallet.";
    }
    return "";
  }, [capabilities.canManageOracleProfile, selectedOracle, walletAddress]);
  const stakeGuard = useMemo(() => {
    if (!capabilities.canManageOracleStake) return "Oracle staking requires a registered oracle or governance wallet.";
    if (!selectedOracle || !walletAddress || selectedOracle.oracle !== walletAddress) {
      return "Select the connected oracle signer before staking.";
    }
    if (!selectedWalletStakeAccount) return "Select the stake source token account.";
    return "";
  }, [capabilities.canManageOracleStake, selectedOracle, selectedWalletStakeAccount, walletAddress]);
  const unstakeGuard = useMemo(() => {
    if (!capabilities.canManageOracleStake) return "Unstaking requires a registered oracle or governance wallet.";
    if (!selectedOracle || !walletAddress || selectedOracle.oracle !== walletAddress) {
      return "Select the connected oracle signer before requesting unstake.";
    }
    return "";
  }, [capabilities.canManageOracleStake, selectedOracle, walletAddress]);
  const finalizeUnstakeGuard = useMemo(() => {
    if (unstakeGuard) return unstakeGuard;
    if (!selectedStake) return "Select a stake position first.";
    if (!selectedWalletStakeAccount) return "Select the destination token account for the unstake.";
    return "";
  }, [selectedStake, selectedWalletStakeAccount, unstakeGuard]);
  const slashGuard = useMemo(() => {
    if (!capabilities.canSlashOracle) return "Oracle slashing is limited to governance wallets.";
    if (!selectedStake) return "Select a stake position first.";
    if (!slashTreasuryTokenAccountInput.trim()) return "Slash treasury token account is required.";
    return "";
  }, [capabilities.canSlashOracle, selectedStake, slashTreasuryTokenAccountInput]);
  const voteGuard = useMemo(() => {
    if (!capabilities.canSubmitOracleVotes) return "Outcome attestation votes require a registered oracle wallet.";
    if (!selectedAggregate) return "Select an outcome aggregate first.";
    return "";
  }, [capabilities.canSubmitOracleVotes, selectedAggregate]);
  const settlementGuard = useMemo(() => {
    if (!capabilities.canSettleCycles) return "Cycle settlement requires a registered oracle wallet.";
    if (!selectedCycle) return "Select a member cycle first.";
    if (selectedCycle.paymentMint !== ZERO_PUBKEY && !selectedMemberPayoutAccount) {
      return "Select the member payout token account for SPL settlement.";
    }
    return "";
  }, [capabilities.canSettleCycles, selectedCycle, selectedMemberPayoutAccount]);
  const finalizeOutcomeGuard = useMemo(() => {
    if (!capabilities.canSettleCycles) return "Outcome finalization requires a registered oracle wallet.";
    if (!selectedAggregate) return "Select an outcome aggregate first.";
    return "";
  }, [capabilities.canSettleCycles, selectedAggregate]);
  const finalizeRootGuard = useMemo(() => {
    if (!capabilities.canSettleCycles) return "Settlement root finalization requires a registered oracle wallet.";
    if (!selectedRoot) return "Select a settlement root first.";
    return "";
  }, [capabilities.canSettleCycles, selectedRoot]);
  const openDisputeGuard = useMemo(() => {
    if (!capabilities.canOpenDisputes) return "Opening disputes is limited to operator, guardian, risk, or governance wallets.";
    if (!selectedAggregate) return "Select an aggregate first.";
    return "";
  }, [capabilities.canOpenDisputes, selectedAggregate]);
  const resolveDisputeGuard = useMemo(() => {
    if (!capabilities.canResolveDisputes) return "Dispute resolution is limited to governance wallets.";
    if (!selectedAggregate) return "Select an aggregate first.";
    return "";
  }, [capabilities.canResolveDisputes, selectedAggregate]);

  async function runAction(
    label: string,
    buildTx: (recentBlockhash: string) => ReturnType<typeof buildUpdateOracleMetadataTx>,
    signers?: Keypair[],
  ) {
    if (!sendTransaction) return;
    setBusyAction(label);
    setStatus(null);
    setStatusTone(null);
    setTxUrl(null);
    try {
      const { blockhash } = await connection.getLatestBlockhash("confirmed");
      const tx = buildTx(blockhash);
      const result = await executeProtocolTransaction({
        connection,
        sendTransaction,
        tx,
        signers,
        label,
      });
      if (!result.ok) {
        setStatus(result.error);
        setStatusTone("error");
        return;
      }
      setStatus(result.message);
      setStatusTone("ok");
      setTxUrl(result.explorerUrl);
      await refresh();
    } finally {
      setBusyAction(null);
    }
  }

  async function onUpdateOracleMetadata() {
    if (!publicKey) return;
    await runAction("Update oracle metadata", (recentBlockhash) =>
      buildUpdateOracleMetadataTx({
        oracle: publicKey,
        metadataUri: metadataUriInput,
        active: metadataActiveInput,
        recentBlockhash,
      }));
  }

  async function onStakeOracle() {
    if (!publicKey || !selectedOracle || !protocolConfig?.defaultStakeMint || !selectedWalletStakeAccount) return;
    const stakeVault = Keypair.generate();
    await runAction(
      "Stake oracle",
      (recentBlockhash) =>
        buildStakeOracleTx({
          staker: publicKey,
          oracle: new PublicKey(selectedOracle.oracle),
          stakeMint: new PublicKey(protocolConfig.defaultStakeMint),
          stakeVault: stakeVault.publicKey,
          stakerTokenAccount: new PublicKey(selectedWalletStakeAccount),
          amount: BigInt(stakeAmountInput || "0"),
          recentBlockhash,
        }),
      [stakeVault],
    );
  }

  async function onRequestUnstake() {
    if (!publicKey || !selectedOracle) return;
    await runAction("Request unstake", (recentBlockhash) =>
      buildRequestUnstakeTx({
        staker: publicKey,
        oracle: new PublicKey(selectedOracle.oracle),
        amount: BigInt(unstakeAmountInput || "0"),
        cooldownSeconds: BigInt(unstakeCooldownInput || "0"),
        recentBlockhash,
      }));
  }

  async function onFinalizeUnstake() {
    if (!publicKey || !selectedStake || !selectedWalletStakeAccount) return;
    await runAction("Finalize unstake", (recentBlockhash) =>
      buildFinalizeUnstakeTx({
        staker: publicKey,
        oracle: new PublicKey(selectedStake.oracle),
        stakeVault: new PublicKey(selectedStake.stakeVault),
        destinationTokenAccount: new PublicKey(selectedWalletStakeAccount),
        recentBlockhash,
      }));
  }

  async function onSlashOracle() {
    if (!publicKey || !selectedStake || !slashTreasuryTokenAccountInput.trim()) return;
    await runAction("Slash oracle", (recentBlockhash) =>
      buildSlashOracleTx({
        governanceAuthority: publicKey,
        stakePosition: new PublicKey(selectedStake.address),
        stakeVault: new PublicKey(selectedStake.stakeVault),
        slashTreasuryTokenAccount: new PublicKey(slashTreasuryTokenAccountInput),
        amount: BigInt(slashAmountInput || "0"),
        recentBlockhash,
      }));
  }

  async function onSubmitVote() {
    if (!publicKey || !selectedAggregate || !poolTerms) return;
    await runAction("Submit outcome attestation", (recentBlockhash) =>
      buildSubmitOutcomeAttestationVoteTx({
        oracle: publicKey,
        poolAddress: new PublicKey(poolAddress),
        payoutMint: new PublicKey(poolTerms.payoutAssetMint),
        seriesRefHashHex: selectedAggregate.seriesRefHashHex,
        member: new PublicKey(selectedAggregate.member),
        cycleHashHex: selectedAggregate.cycleHashHex,
        ruleHashHex: selectedAggregate.ruleHashHex,
        schemaKeyHashHex: schemaKeyHashInput,
        attestationDigestHex: attestationDigestInput,
        observedValueHashHex: observedValueHashInput,
        evidenceHashHex: evidenceHashInput || undefined,
        externalAttestationRefHashHex: externalAttestationRefInput || undefined,
        aiRole: AI_ROLE_ORACLE,
        automationMode: AUTOMATION_MODE_ADVISORY,
        asOfTs: BigInt(asOfTsInput || "0"),
        passed: votePassedInput,
        recentBlockhash,
        includePoolAutomationPolicy: true,
      }));
  }

  async function onFinalizeOutcome() {
    if (!publicKey || !selectedAggregate || !poolTerms) return;
    await runAction("Finalize cycle outcome", (recentBlockhash) =>
      buildFinalizeCycleOutcomeTx({
        feePayer: publicKey,
        poolAddress: new PublicKey(poolAddress),
        payoutMint: new PublicKey(poolTerms.payoutAssetMint),
        seriesRefHashHex: selectedAggregate.seriesRefHashHex,
        member: new PublicKey(selectedAggregate.member),
        cycleHashHex: selectedAggregate.cycleHashHex,
        ruleHashHex: selectedAggregate.ruleHashHex,
        recentBlockhash,
      }));
  }

  async function onSettleCycle() {
    if (!publicKey || !selectedCycle) return;
    await runAction("Settle cycle commitment", (recentBlockhash) => {
      if (selectedCycle.paymentMint === ZERO_PUBKEY) {
        return buildSettleCycleCommitmentSolTx({
          oracle: publicKey,
          poolAddress: new PublicKey(poolAddress),
          member: new PublicKey(selectedCycle.member),
          seriesRefHashHex: selectedCycle.seriesRefHashHex,
          periodIndex: selectedCycle.periodIndex,
          passed: settledPassedInput,
          shieldConsumed: shieldConsumedInput,
          settledHealthAlphaScore: Number.parseInt(settledScoreInput, 10) || 0,
          recipientSystemAccount: new PublicKey(selectedCycle.member),
          recentBlockhash,
          cohortHashHex: selectedCycle.cohortHashHex,
        });
      }
      return buildSettleCycleCommitmentTx({
        oracle: publicKey,
        poolAddress: new PublicKey(poolAddress),
        member: new PublicKey(selectedCycle.member),
        seriesRefHashHex: selectedCycle.seriesRefHashHex,
        paymentMint: new PublicKey(selectedCycle.paymentMint),
        periodIndex: selectedCycle.periodIndex,
        passed: settledPassedInput,
        shieldConsumed: shieldConsumedInput,
        settledHealthAlphaScore: Number.parseInt(settledScoreInput, 10) || 0,
        recipientTokenAccount: new PublicKey(selectedMemberPayoutAccount),
        recentBlockhash,
        cohortHashHex: selectedCycle.cohortHashHex,
      });
    });
  }

  async function onFinalizeSettlementRoot() {
    if (!publicKey || !selectedRoot) return;
    await runAction("Finalize cohort settlement root", (recentBlockhash) =>
      buildFinalizeCohortSettlementRootTx({
        oracle: publicKey,
        poolAddress: new PublicKey(poolAddress),
        payoutMint: new PublicKey(selectedRoot.paymentMint),
        seriesRefHashHex: selectedRoot.seriesRefHashHex,
        cohortHashHex: selectedRoot.cohortHashHex,
        recentBlockhash,
      }));
  }

  async function onOpenDispute() {
    if (!publicKey || !selectedAggregate) return;
    await runAction("Open cycle outcome dispute", (recentBlockhash) =>
      buildOpenCycleOutcomeDisputeTx({
        authority: publicKey,
        poolAddress: new PublicKey(poolAddress),
        aggregate: new PublicKey(selectedAggregate.address),
        disputeReasonHashHex: disputeReasonHashInput,
        recentBlockhash,
      }));
  }

  async function onResolveDispute() {
    if (!publicKey || !selectedAggregate || !poolTerms) return;
    await runAction("Resolve cycle outcome dispute", (recentBlockhash) =>
      buildResolveCycleOutcomeDisputeTx({
        governanceAuthority: publicKey,
        poolAddress: new PublicKey(poolAddress),
        payoutMint: new PublicKey(poolTerms.payoutAssetMint),
        aggregate: new PublicKey(selectedAggregate.address),
        sustainOriginalOutcome: sustainOriginalOutcomeInput,
        recentBlockhash,
      }));
  }

  return (
    <section className="space-y-4">
      <section className="surface-card-soft space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[var(--accent-strong)]" />
            <p className="metric-label">Oracle operations</p>
          </div>
          <button
            type="button"
            className="secondary-button inline-flex items-center gap-1.5"
            onClick={() => void refresh()}
            disabled={loading}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
        <p className="field-help">{panelLead}</p>
        <div className="flex flex-wrap gap-2">
          <span className="status-pill status-off">{oracles.length} registry entries</span>
          <span className="status-pill status-off">{stakes.length} stake positions</span>
          <span className="status-pill status-off">{aggregates.length} outcome aggregates</span>
          <span className="status-pill status-off">{settlementRoots.length} settlement roots</span>
        </div>
      </section>

      {visiblePanels.length > 1 ? (
        <section className="surface-card-soft space-y-3">
          <div className="grid gap-2 sm:grid-cols-5">
            {ORACLE_PANELS.filter((panel) => visiblePanels.includes(panel.value)).map((panel) => (
              <button
                key={panel.value}
                type="button"
                className={`segment-button ${activePanel === panel.value ? "segment-button-active" : ""}`}
                onClick={() => setPanel(panel.value)}
              >
                {panel.label}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {activePanel === "policy" ? <PoolOraclePolicyPanel poolAddress={poolAddress} sectionMode="embedded" /> : null}

      {activePanel === "staking" ? (
        <section className="surface-card-soft space-y-4">
          <div className="grid gap-4 xl:grid-cols-2">
            <article className="operator-task-card">
              <div className="operator-task-head">
                <h3 className="operator-task-title">Oracle profile and staking</h3>
                <p className="operator-task-copy">Choose the oracle signer first, then update metadata or add stake from the selected token account.</p>
              </div>
              <SearchableSelect
                label="Oracle signer"
                value={selectedOracleAddress}
                options={oracleOptions}
                onChange={setSelectedOracleAddress}
                searchValue=""
                onSearchChange={() => {}}
                placeholder="Select oracle"
                disabled={!oracleOptions.length}
                disabledHint="No oracle registry entries were indexed."
              />
              {selectedOracle ? (
                <div className="space-y-2">
                  <div className="operator-summary-row">
                    <span>Selected oracle</span>
                    <strong>{selectedOracle.profile?.displayName || shortAddress(selectedOracle.oracle)}</strong>
                  </div>
                  <div className="operator-summary-row">
                    <span>Registry status</span>
                    <strong>{selectedOracle.active ? "Active" : "Inactive"}</strong>
                  </div>
                </div>
              ) : null}
              <label className="space-y-1">
                <span className="metric-label">Metadata URI</span>
                <input className="field-input" value={metadataUriInput} onChange={(event) => setMetadataUriInput(event.target.value)} />
              </label>
              <label className="inline-flex items-center gap-2 text-sm text-[var(--foreground)]">
                <input type="checkbox" checked={metadataActiveInput} onChange={(event) => setMetadataActiveInput(event.target.checked)} />
                Keep registry metadata active
              </label>
              <button type="button" className="secondary-button" onClick={() => void onUpdateOracleMetadata()} disabled={Boolean(busyAction) || Boolean(metadataGuard)}>
                {busyAction === "Update oracle metadata" ? "Saving..." : "Update metadata"}
              </button>

              <label className="space-y-1">
                <span className="metric-label">Stake amount</span>
                <input className="field-input" value={stakeAmountInput} onChange={(event) => setStakeAmountInput(event.target.value)} />
              </label>
              <label className="space-y-1">
                <span className="metric-label">Stake source token account</span>
                <select className="field-input" value={selectedWalletStakeAccount} onChange={(event) => setSelectedWalletStakeAccount(event.target.value)}>
                  <option value="">Select token account</option>
                  {walletStakeAccounts.map((row) => (
                    <option key={row.address} value={row.address}>
                      {shortAddress(row.address)} • balance {row.amount}
                    </option>
                  ))}
                </select>
              </label>
              <button type="button" className="action-button" onClick={() => void onStakeOracle()} disabled={Boolean(busyAction) || Boolean(stakeGuard)}>
                {busyAction === "Stake oracle" ? "Staking..." : "Stake oracle"}
              </button>
              {metadataGuard || stakeGuard ? <p className="field-help">{stakeGuard || metadataGuard}</p> : null}
            </article>

            <article className="operator-task-card">
              <div className="operator-task-head">
                <h3 className="operator-task-title">Unstake and slash</h3>
                <p className="operator-task-copy">Review the selected stake position before requesting an unstake, finalizing it, or opening a slashing action.</p>
              </div>
              {selectedStake ? (
                <div className="grid gap-2 md:grid-cols-2">
                  <div className="monitor-row">
                    <span>Staked</span>
                    <span>{selectedStake.stakedAmount.toString()}</span>
                  </div>
                  <div className="monitor-row">
                    <span>Pending unstake</span>
                    <span>{selectedStake.pendingUnstakeAmount.toString()}</span>
                  </div>
                  <div className="monitor-row">
                    <span>Finalize after</span>
                    <span>{formatTimestamp(selectedStake.canFinalizeUnstakeAt)}</span>
                  </div>
                  <div className="monitor-row">
                    <span>Slash pending</span>
                    <span>{selectedStake.slashPending ? "Yes" : "No"}</span>
                  </div>
                </div>
              ) : (
                <p className="field-help">No stake position is currently selected.</p>
              )}
              <label className="space-y-1">
                <span className="metric-label">Unstake amount</span>
                <input className="field-input" value={unstakeAmountInput} onChange={(event) => setUnstakeAmountInput(event.target.value)} />
              </label>
              <label className="space-y-1">
                <span className="metric-label">Cooldown seconds</span>
                <input className="field-input" value={unstakeCooldownInput} onChange={(event) => setUnstakeCooldownInput(event.target.value)} />
              </label>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="secondary-button" onClick={() => void onRequestUnstake()} disabled={Boolean(busyAction) || Boolean(unstakeGuard)}>
                  {busyAction === "Request unstake" ? "Requesting..." : "Request unstake"}
                </button>
                <button type="button" className="secondary-button" onClick={() => void onFinalizeUnstake()} disabled={Boolean(busyAction) || Boolean(finalizeUnstakeGuard)}>
                  {busyAction === "Finalize unstake" ? "Finalizing..." : "Finalize unstake"}
                </button>
              </div>
              <ProtocolDetailDisclosure title="Slashing details" summary="Keep slashing inputs collapsed until governance actually needs to move stake into treasury.">
                <label className="space-y-1">
                  <span className="metric-label">Slash treasury token account</span>
                  <input className="field-input font-mono" value={slashTreasuryTokenAccountInput} onChange={(event) => setSlashTreasuryTokenAccountInput(event.target.value)} />
                </label>
                <label className="space-y-1">
                  <span className="metric-label">Slash amount</span>
                  <input className="field-input" value={slashAmountInput} onChange={(event) => setSlashAmountInput(event.target.value)} />
                </label>
                <button type="button" className="secondary-button" onClick={() => void onSlashOracle()} disabled={Boolean(busyAction) || Boolean(slashGuard)}>
                  {busyAction === "Slash oracle" ? "Slashing..." : "Slash oracle"}
                </button>
              </ProtocolDetailDisclosure>
              {slashGuard || finalizeUnstakeGuard ? <p className="field-help">{slashGuard || finalizeUnstakeGuard}</p> : null}
            </article>
          </div>
        </section>
      ) : null}

      {activePanel === "attestations" ? (
        <section className="surface-card-soft space-y-4">
          <SearchableSelect
            label="Outcome aggregate"
            value={selectedAggregateAddress}
            options={aggregateOptions}
            onChange={setSelectedAggregateAddress}
            searchValue={search}
            onSearchChange={setSearch}
            loading={loading}
            placeholder="Select aggregate"
            emptyMessage="No outcome aggregates match the current search."
          />
          {selectedAggregate ? (
            <div className="grid gap-3 md:grid-cols-3">
              <article className="operator-summary-card">
                <p className="metric-label">Member</p>
                <p className="text-sm font-semibold text-[var(--foreground)]">{shortAddress(selectedAggregate.member)}</p>
              </article>
              <article className="operator-summary-card">
                <p className="metric-label">Rule hash</p>
                <p className="text-sm font-semibold text-[var(--foreground)] break-all">{selectedAggregate.ruleHashHex}</p>
              </article>
              <article className="operator-summary-card">
                <p className="metric-label">Current outcome</p>
                <p className="text-sm font-semibold text-[var(--foreground)]">{selectedAggregate.passed ? "Passed" : "Pending / failed"}</p>
              </article>
            </div>
          ) : null}
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <label className="space-y-1">
              <span className="metric-label">Schema key hash</span>
              <input className="field-input font-mono" value={schemaKeyHashInput} onChange={(event) => setSchemaKeyHashInput(event.target.value)} />
            </label>
            <label className="space-y-1">
              <span className="metric-label">Attestation digest</span>
              <input className="field-input font-mono" value={attestationDigestInput} onChange={(event) => setAttestationDigestInput(event.target.value)} />
            </label>
            <label className="space-y-1">
              <span className="metric-label">Observed value hash</span>
              <input className="field-input font-mono" value={observedValueHashInput} onChange={(event) => setObservedValueHashInput(event.target.value)} />
            </label>
            <label className="space-y-1">
              <span className="metric-label">As-of unix ts</span>
              <input className="field-input" value={asOfTsInput} onChange={(event) => setAsOfTsInput(event.target.value)} />
            </label>
            <label className="inline-flex items-center gap-2 rounded-2xl border border-[var(--border)]/60 bg-[var(--surface)] px-3 py-2">
              <input type="checkbox" checked={votePassedInput} onChange={(event) => setVotePassedInput(event.target.checked)} />
              <span className="metric-label">Vote passed</span>
            </label>
          </div>
          <button type="button" className="action-button" onClick={() => void onSubmitVote()} disabled={Boolean(busyAction) || Boolean(voteGuard)}>
            {busyAction === "Submit outcome attestation" ? "Submitting..." : "Submit attestation vote"}
          </button>
          <ProtocolDetailDisclosure title="Optional attestation references" summary="Evidence and external references stay available here when the attestation package needs them.">
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1">
                <span className="metric-label">Evidence hash</span>
                <input className="field-input font-mono" value={evidenceHashInput} onChange={(event) => setEvidenceHashInput(event.target.value)} />
              </label>
              <label className="space-y-1">
                <span className="metric-label">External attestation ref</span>
                <input className="field-input font-mono" value={externalAttestationRefInput} onChange={(event) => setExternalAttestationRefInput(event.target.value)} />
              </label>
            </div>
          </ProtocolDetailDisclosure>
          {voteGuard ? <p className="field-help">{voteGuard}</p> : null}
        </section>
      ) : null}

      {activePanel === "settlements" ? (
        <section className="surface-card-soft space-y-4">
          <SearchableSelect
            label="Member cycle"
            value={selectedCycleAddress}
            options={cycleOptions}
            onChange={setSelectedCycleAddress}
            searchValue=""
            onSearchChange={() => {}}
            placeholder="Select member cycle"
            disabled={!cycleOptions.length}
            disabledHint="No member cycles were discovered."
          />
          <SearchableSelect
            label="Settlement root"
            value={selectedRootAddress}
            options={rootOptions}
            onChange={setSelectedRootAddress}
            searchValue=""
            onSearchChange={() => {}}
            placeholder="Select settlement root"
            disabled={!rootOptions.length}
            disabledHint="No cohort settlement roots were indexed yet."
          />
          <div className="grid gap-3 md:grid-cols-2">
            {selectedCycle ? (
              <article className="operator-summary-card">
                <p className="metric-label">Selected cycle</p>
                <ul className="operator-summary-list">
                  <li>Member: {shortAddress(selectedCycle.member)}</li>
                  <li>Period: {selectedCycle.periodIndex.toString()}</li>
                  <li>Payout mint: {selectedCycle.paymentMint === ZERO_PUBKEY ? "SOL" : shortAddress(selectedCycle.paymentMint)}</li>
                </ul>
              </article>
            ) : null}
            {selectedRoot ? (
              <article className="operator-summary-card">
                <p className="metric-label">Selected settlement root</p>
                <ul className="operator-summary-list">
                  <li>Cohort: {shortAddress(selectedRoot.cohortHashHex)}</li>
                  <li>Members: {selectedRoot.successfulMemberCount}</li>
                  <li>Finalized: {selectedRoot.finalized ? "Yes" : "No"}</li>
                </ul>
              </article>
            ) : null}
          </div>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            <div className="monitor-row">
              <span>Recommended step</span>
              <span>{settlementDraft.recommendedAction}</span>
            </div>
            <div className="monitor-row">
              <span>Payout rail</span>
              <span>{settlementDraft.payoutRail.toUpperCase()}</span>
            </div>
            <div className="monitor-row">
              <span>Dispute open</span>
              <span>{settlementDraft.disputeOpen ? "Yes" : "No"}</span>
            </div>
            <div className="monitor-row">
              <span>Root finalized</span>
              <span>{settlementDraft.settlementRootFinalized ? "Yes" : "No"}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="secondary-button" onClick={() => void onFinalizeOutcome()} disabled={Boolean(busyAction) || Boolean(finalizeOutcomeGuard)}>
              {busyAction === "Finalize cycle outcome" ? "Finalizing..." : "Finalize outcome"}
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => void onSettleCycle()}
              disabled={Boolean(busyAction) || Boolean(settlementGuard)}
            >
              {busyAction === "Settle cycle commitment" ? "Settling..." : "Settle cycle"}
            </button>
            <button type="button" className="action-button" onClick={() => void onFinalizeSettlementRoot()} disabled={Boolean(busyAction) || Boolean(finalizeRootGuard)}>
              {busyAction === "Finalize cohort settlement root" ? "Finalizing..." : "Finalize settlement root"}
            </button>
          </div>
          {finalizeOutcomeGuard || settlementGuard || finalizeRootGuard ? (
            <p className="field-help">{settlementGuard || finalizeRootGuard || finalizeOutcomeGuard}</p>
          ) : null}
          <label className="space-y-1">
            <span className="metric-label">Settled health alpha score</span>
            <input className="field-input" value={settledScoreInput} onChange={(event) => setSettledScoreInput(event.target.value)} />
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-[var(--foreground)]">
            <input type="checkbox" checked={settledPassedInput} onChange={(event) => setSettledPassedInput(event.target.checked)} />
            Outcome passed
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-[var(--foreground)]">
            <input type="checkbox" checked={shieldConsumedInput} onChange={(event) => setShieldConsumedInput(event.target.checked)} />
            Shield consumed
          </label>
        </section>
      ) : null}

      {activePanel === "disputes" ? (
        <section className="surface-card-soft space-y-4">
          <SearchableSelect
            label="Dispute aggregate"
            value={selectedAggregateAddress}
            options={aggregateOptions}
            onChange={setSelectedAggregateAddress}
            searchValue={search}
            onSearchChange={setSearch}
            loading={loading}
            placeholder="Select aggregate"
            emptyMessage="No aggregates available for disputes."
          />
          {selectedAggregate ? (
            <div className="grid gap-3 md:grid-cols-2">
              <article className="operator-summary-card">
                <p className="metric-label">Selected aggregate</p>
                <ul className="operator-summary-list">
                  <li>Member: {shortAddress(selectedAggregate.member)}</li>
                  <li>Cycle hash: {shortAddress(selectedAggregate.cycleHashHex)}</li>
                  <li>Rule hash: {shortAddress(selectedAggregate.ruleHashHex)}</li>
                </ul>
              </article>
              <article className="operator-summary-card">
                <p className="metric-label">Current state</p>
                <ul className="operator-summary-list">
                  <li>Finalized: {selectedAggregate.finalized ? "Yes" : "No"}</li>
                  <li>Passed: {selectedAggregate.passed ? "Yes" : "No"}</li>
                </ul>
              </article>
            </div>
          ) : null}
          <label className="space-y-1">
            <span className="metric-label">Dispute reason hash</span>
            <input className="field-input font-mono" value={disputeReasonHashInput} onChange={(event) => setDisputeReasonHashInput(event.target.value)} />
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-[var(--foreground)]">
            <input type="checkbox" checked={sustainOriginalOutcomeInput} onChange={(event) => setSustainOriginalOutcomeInput(event.target.checked)} />
            Sustain original outcome
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="secondary-button" onClick={() => void onOpenDispute()} disabled={Boolean(busyAction) || Boolean(openDisputeGuard)}>
              {busyAction === "Open cycle outcome dispute" ? "Opening..." : "Open dispute"}
            </button>
            <button type="button" className="action-button" onClick={() => void onResolveDispute()} disabled={Boolean(busyAction) || Boolean(resolveDisputeGuard)}>
              {busyAction === "Resolve cycle outcome dispute" ? "Resolving..." : "Resolve dispute"}
            </button>
          </div>
          {openDisputeGuard || resolveDisputeGuard ? (
            <p className="field-help">{resolveDisputeGuard || openDisputeGuard}</p>
          ) : null}
        </section>
      ) : null}

      {error ? <p className="field-error">{error}</p> : null}
      {status ? (
        <section className="surface-card-soft space-y-2">
          <span className={`status-pill ${statusTone === "error" ? "status-error" : "status-ok"}`}>
            {statusTone === "error" ? "Action failed" : "Action confirmed"}
          </span>
          <p className={statusTone === "error" ? "field-error" : "field-help"}>{status}</p>
          {txUrl ? (
            <a className="secondary-button inline-flex w-fit items-center gap-2" href={txUrl} target="_blank" rel="noreferrer">
              <CheckCircle2 className="h-4 w-4" />
              View transaction
            </a>
          ) : null}
        </section>
      ) : null}
    </section>
  );
}
