// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { CheckCircle2, Layers3, RefreshCw, ShieldPlus, WalletCards } from "lucide-react";

import { AdvancedOverride } from "@/components/advanced-override";
import { usePoolWorkspaceContext } from "@/components/pool-workspace-context";
import { SearchableSelect } from "@/components/searchable-select";
import { parseCycleQuotePayload, quoteUsesSolRail } from "@/lib/cycle-quote";
import { executeProtocolTransaction } from "@/lib/protocol-action";
import {
  PLAN_MODE_PROTECTION,
  POLICY_SERIES_STATUS_ACTIVE,
  POLICY_SERIES_STATUS_PAUSED,
  SPONSOR_MODE_DIRECT,
  ZERO_PUBKEY,
  buildActivateCycleWithQuoteSolTx,
  buildActivateCycleWithQuoteSplTx,
  buildAttestPremiumPaidOffchainTx,
  buildCreatePolicySeriesTx,
  buildIssuePolicyPositionTx,
  buildMintPolicyNftTx,
  buildPayPremiumSolTx,
  buildPayPremiumSplTx,
  buildSubscribePolicySeriesTx,
  buildUpdatePolicySeriesTx,
  buildUpsertPolicySeriesPaymentOptionTx,
  hashStringTo32Hex,
  listMemberships,
  listMemberCycles,
  listPolicyPositionNfts,
  listPolicyPositions,
  listPolicySeries,
  listPolicySeriesPaymentOptions,
  listPoolAssetVaults,
  listPoolTerms,
  listWalletTokenAccountsForMint,
  toExplorerLink,
  type MemberCycleStateSummary,
  type MembershipSummary,
  type PolicyPositionNftSummary,
  type PolicyPositionSummary,
  type PolicySeriesPaymentOptionSummary,
  type PolicySeriesSummary,
  type PoolAssetVaultSummary,
  type PoolTermsSummary,
  type TokenAccountSummary,
} from "@/lib/protocol";
import { formatRpcError } from "@/lib/rpc-errors";
import { parseWorkspacePanel, visibleWorkspacePanels, type PoolWorkspacePanel } from "@/lib/ui-capabilities";

type PoolCoveragePanelProps = {
  poolAddress: string;
};

function normalize(value: string): string {
  return value.trim();
}

function shortAddress(value: string): string {
  if (value.length < 12) return value;
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function todayDateInput(): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateInputToUnixTs(date: string): bigint {
  if (!date.trim()) return 0n;
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return 0n;
  return BigInt(Math.floor(parsed.getTime() / 1000));
}

function dateTimeInputToUnixTs(value: string): bigint {
  if (!value.trim()) return 0n;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 0n;
  return BigInt(Math.floor(parsed.getTime() / 1000));
}

function parseDaysToSeconds(value: string): bigint {
  const parsed = Number.parseFloat(normalize(value));
  if (!Number.isFinite(parsed) || parsed <= 0) return 0n;
  return BigInt(Math.round(parsed * 86_400));
}

function parseMonthsToSeconds(value: string): bigint {
  const parsed = Number.parseFloat(normalize(value));
  if (!Number.isFinite(parsed) || parsed <= 0) return 0n;
  return BigInt(Math.round(parsed * 30 * 86_400));
}

function formatTimestamp(value: bigint): string {
  if (!value || value <= 0n) return "n/a";
  return new Date(Number(value) * 1000).toLocaleString();
}

function formatRail(mint: string): string {
  return mint === ZERO_PUBKEY ? "SOL" : `SPL ${shortAddress(mint)}`;
}

const COVERAGE_PANELS: ReadonlyArray<{ value: PoolWorkspacePanel; label: string }> = [
  { value: "series", label: "Series" },
  { value: "positions", label: "Positions" },
  { value: "payments", label: "Payments" },
  { value: "activation", label: "Activation" },
];

export function PoolCoveragePanel({ poolAddress }: PoolCoveragePanelProps) {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const { capabilities } = usePoolWorkspaceContext();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const walletAddress = publicKey?.toBase58() ?? "";
  const requestedPanel = parseWorkspacePanel("coverage", searchParams.get("panel") ?? searchParams.get("mode"));
  const [series, setSeries] = useState<PolicySeriesSummary[]>([]);
  const [paymentOptions, setPaymentOptions] = useState<PolicySeriesPaymentOptionSummary[]>([]);
  const [positions, setPositions] = useState<PolicyPositionSummary[]>([]);
  const [positionNfts, setPositionNfts] = useState<PolicyPositionNftSummary[]>([]);
  const [memberCycles, setMemberCycles] = useState<MemberCycleStateSummary[]>([]);
  const [memberships, setMemberships] = useState<MembershipSummary[]>([]);
  const [poolTerms, setPoolTerms] = useState<PoolTermsSummary | null>(null);
  const [poolAssetVaults, setPoolAssetVaults] = useState<PoolAssetVaultSummary[]>([]);
  const [walletPaymentAccounts, setWalletPaymentAccounts] = useState<TokenAccountSummary[]>([]);
  const [selectedSeriesAddress, setSelectedSeriesAddress] = useState("");
  const [selectedPaymentOptionAddress, setSelectedPaymentOptionAddress] = useState("");
  const [selectedPositionAddress, setSelectedPositionAddress] = useState("");
  const [selectedMemberAddress, setSelectedMemberAddress] = useState("");
  const [selectedWalletPaymentAccount, setSelectedWalletPaymentAccount] = useState("");
  const [seriesSearch, setSeriesSearch] = useState("");
  const [memberSearch, setMemberSearch] = useState("");
  const [paymentSearch, setPaymentSearch] = useState("");
  const [expertOpen, setExpertOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<"ok" | "error" | null>(null);
  const [txUrl, setTxUrl] = useState<string | null>(null);

  const [productIdSeed, setProductIdSeed] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [metadataUri, setMetadataUri] = useState("https://protocol.omegax.health/coverage/template");
  const [termsHashOverride, setTermsHashOverride] = useState("");
  const [durationMonths, setDurationMonths] = useState("12");
  const [premiumCadenceDays, setPremiumCadenceDays] = useState("30");
  const [premiumGraceDays, setPremiumGraceDays] = useState("14");
  const [premiumAmountBaseUnits, setPremiumAmountBaseUnits] = useState("1000000");
  const [productActive, setProductActive] = useState(true);
  const [paymentMintInput, setPaymentMintInput] = useState(ZERO_PUBKEY);
  const [paymentAmountInput, setPaymentAmountInput] = useState("1000000");
  const [paymentOptionActive, setPaymentOptionActive] = useState(true);
  const [subscribeStartDate, setSubscribeStartDate] = useState(todayDateInput());
  const [issueStartDate, setIssueStartDate] = useState(todayDateInput());
  const [nftMintInput, setNftMintInput] = useState("");
  const [nftMetadataUriInput, setNftMetadataUriInput] = useState("https://protocol.omegax.health/coverage/nft");
  const [premiumPeriodIndex, setPremiumPeriodIndex] = useState("0");
  const [offchainReplayHash, setOffchainReplayHash] = useState("");
  const [offchainPaidAt, setOffchainPaidAt] = useState("");
  const [quoteInput, setQuoteInput] = useState("");

  const visiblePanels = useMemo(
    () => visibleWorkspacePanels("coverage", capabilities),
    [capabilities],
  );
  const activePanel = useMemo<PoolWorkspacePanel>(
    () => (requestedPanel && visiblePanels.includes(requestedPanel) ? requestedPanel : visiblePanels[0] ?? "series"),
    [requestedPanel, visiblePanels],
  );
  const panelLead = useMemo(() => {
    if (activePanel === "series") return "Create or update reusable coverage products, then attach payment rails.";
    if (activePanel === "positions") return "Work from a selected series and member to review or issue coverage positions.";
    if (activePanel === "payments") return "Collect premiums from the selected rail without exposing raw hashes by default.";
    return "Paste a signed quote payload and activate the next member cycle from one guided form.";
  }, [activePanel]);
  const showMemberSelector = activePanel !== "series";
  const showPaymentSelector = activePanel === "payments" || activePanel === "activation";

  const selectedSeries = useMemo(
    () => series.find((row) => row.address === selectedSeriesAddress) ?? null,
    [selectedSeriesAddress, series],
  );
  const filteredPaymentOptions = useMemo(
    () => paymentOptions.filter((row) => (selectedSeries ? row.seriesRefHashHex === selectedSeries.seriesRefHashHex : true)),
    [paymentOptions, selectedSeries],
  );
  const filteredPositions = useMemo(
    () => positions.filter((row) => (selectedSeries ? row.seriesRefHashHex === selectedSeries.seriesRefHashHex : true)),
    [positions, selectedSeries],
  );
  const selectedPaymentOption = useMemo(
    () => filteredPaymentOptions.find((row) => row.address === selectedPaymentOptionAddress) ?? filteredPaymentOptions[0] ?? null,
    [filteredPaymentOptions, selectedPaymentOptionAddress],
  );
  const selectedPosition = useMemo(
    () => filteredPositions.find((row) => row.address === selectedPositionAddress) ?? filteredPositions[0] ?? null,
    [filteredPositions, selectedPositionAddress],
  );
  const selectedMember = useMemo(
    () =>
      memberships.find((row) => row.member === selectedMemberAddress)
      ?? memberships.find((row) => row.member === walletAddress)
      ?? memberships[0]
      ?? null,
    [memberships, selectedMemberAddress, walletAddress],
  );
  const filteredCycles = useMemo(
    () =>
      memberCycles.filter((row) => (selectedSeries ? row.seriesRefHashHex === selectedSeries.seriesRefHashHex : true)),
    [memberCycles, selectedSeries],
  );
  const parsedQuote = useMemo(() => {
    if (!quoteInput.trim()) return null;
    try {
      return parseCycleQuotePayload(quoteInput);
    } catch {
      return null;
    }
  }, [quoteInput]);
  const quoteError = useMemo(() => {
    if (!quoteInput.trim()) return "";
    try {
      parseCycleQuotePayload(quoteInput);
      return "";
    } catch (cause) {
      return cause instanceof Error ? cause.message : "Quote payload is invalid.";
    }
  }, [quoteInput]);

  const setPanel = useCallback((nextPanel: PoolWorkspacePanel) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("section", "coverage");
    params.set("panel", nextPanel);
    params.delete("mode");
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
      const [
        nextSeries,
        nextPaymentOptions,
        nextPositions,
        nextPositionNfts,
        nextMemberCycles,
        nextMemberships,
        nextPoolTerms,
        nextAssetVaults,
      ] = await Promise.all([
        listPolicySeries({ connection, poolAddress, activeOnly: false, search: seriesSearch || null }),
        listPolicySeriesPaymentOptions({ connection, poolAddress, activeOnly: false, search: paymentSearch || null }),
        listPolicyPositions({ connection, poolAddress, search: null }),
        listPolicyPositionNfts({ connection, poolAddress, search: null }),
        listMemberCycles({ connection, poolAddress, search: null }),
        listMemberships({ connection, poolAddress, activeOnly: true, search: memberSearch || null }),
        listPoolTerms({ connection, poolAddress, search: null }),
        listPoolAssetVaults({ connection, poolAddress, search: null }),
      ]);

      setSeries(nextSeries);
      setPaymentOptions(nextPaymentOptions);
      setPositions(nextPositions);
      setPositionNfts(nextPositionNfts);
      setMemberCycles(nextMemberCycles);
      setMemberships(nextMemberships);
      setPoolTerms(nextPoolTerms[0] ?? null);
      setPoolAssetVaults(nextAssetVaults);
      setSelectedSeriesAddress((current) => current && nextSeries.some((row) => row.address === current)
        ? current
        : nextSeries[0]?.address ?? "");
      setSelectedMemberAddress((current) => current && nextMemberships.some((row) => row.member === current)
        ? current
        : walletAddress && nextMemberships.some((row) => row.member === walletAddress)
          ? walletAddress
          : nextMemberships[0]?.member ?? "");
      setSelectedPositionAddress((current) => current && nextPositions.some((row) => row.address === current)
        ? current
        : nextPositions[0]?.address ?? "");
      setSelectedPaymentOptionAddress((current) => current && nextPaymentOptions.some((row) => row.address === current)
        ? current
        : nextPaymentOptions[0]?.address ?? "");
    } catch (cause) {
      setError(
        formatRpcError(cause, {
          fallback: "Failed to load coverage workspace data.",
          rpcEndpoint: connection.rpcEndpoint,
        }),
      );
    } finally {
      setLoading(false);
    }
  }, [connection, memberSearch, paymentSearch, poolAddress, seriesSearch, walletAddress]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!selectedSeries) return;
    setDisplayName(selectedSeries.displayName);
    setMetadataUri(selectedSeries.metadataUri || "https://protocol.omegax.health/coverage/template");
    setDurationMonths((Number(selectedSeries.durationSecs) / (30 * 86_400)).toFixed(2));
    setPremiumCadenceDays((Number(selectedSeries.premiumDueEverySecs) / 86_400).toFixed(2));
    setPremiumGraceDays((Number(selectedSeries.premiumGraceSecs) / 86_400).toFixed(2));
    setPremiumAmountBaseUnits(selectedSeries.premiumAmount.toString());
    setProductActive(selectedSeries.status === POLICY_SERIES_STATUS_ACTIVE);
  }, [selectedSeries]);

  useEffect(() => {
    if (filteredPaymentOptions.length === 0) {
      setSelectedPaymentOptionAddress("");
      return;
    }
    setSelectedPaymentOptionAddress((current) =>
      current && filteredPaymentOptions.some((row) => row.address === current) ? current : filteredPaymentOptions[0]!.address);
  }, [filteredPaymentOptions]);

  useEffect(() => {
    if (filteredPositions.length === 0) {
      setSelectedPositionAddress("");
      return;
    }
    setSelectedPositionAddress((current) =>
      current && filteredPositions.some((row) => row.address === current) ? current : filteredPositions[0]!.address);
  }, [filteredPositions]);

  useEffect(() => {
    const nextOption =
      paymentOptions.find((row) => row.address === selectedPaymentOptionAddress)
      ?? paymentOptions.find((row) => selectedSeries && row.seriesRefHashHex === selectedSeries.seriesRefHashHex)
      ?? null;
    if (nextOption) {
      setPaymentMintInput(nextOption.paymentMint);
      setPaymentAmountInput(nextOption.paymentAmount.toString());
      setPaymentOptionActive(nextOption.active);
    } else if (selectedSeries) {
      setPaymentMintInput(poolTerms?.payoutAssetMint ?? ZERO_PUBKEY);
      setPaymentAmountInput(selectedSeries.premiumAmount.toString());
      setPaymentOptionActive(true);
    }
  }, [paymentOptions, poolTerms?.payoutAssetMint, selectedPaymentOptionAddress, selectedSeries]);

  const activePaymentMint = useMemo(
    () =>
      activePanel === "activation" && parsedQuote
        ? parsedQuote.paymentMint
        : selectedPaymentOption?.paymentMint ?? paymentMintInput,
    [activePanel, parsedQuote, paymentMintInput, selectedPaymentOption?.paymentMint],
  );

  useEffect(() => {
    if (!walletAddress || !activePaymentMint || activePaymentMint === ZERO_PUBKEY) {
      setWalletPaymentAccounts([]);
      setSelectedWalletPaymentAccount("");
      return;
    }
    let cancelled = false;
    void listWalletTokenAccountsForMint({
      connection,
      owner: walletAddress,
      mint: activePaymentMint,
      search: null,
    }).then((rows) => {
      if (cancelled) return;
      setWalletPaymentAccounts(rows);
      setSelectedWalletPaymentAccount((current) =>
        current && rows.some((row) => row.address === current) ? current : rows[0]?.address ?? "");
    }).catch(() => {
      if (cancelled) return;
      setWalletPaymentAccounts([]);
      setSelectedWalletPaymentAccount("");
    });
    return () => {
      cancelled = true;
    };
  }, [activePaymentMint, connection, walletAddress]);

  const selectedSeriesOptions = useMemo(
    () =>
      series.map((row) => ({
        value: row.address,
        label: row.displayName || shortAddress(row.address),
        hint: `${row.status === POLICY_SERIES_STATUS_ACTIVE ? "Active" : "Inactive"} • ${shortAddress(row.seriesRefHashHex)}`,
      })),
    [series],
  );
  const memberOptions = useMemo(
    () =>
      memberships.map((row) => ({
        value: row.member,
        label: shortAddress(row.member),
        hint: `Membership ${row.address}`,
      })),
    [memberships],
  );
  const paymentOptionOptions = useMemo(
    () =>
      filteredPaymentOptions
        .map((row) => ({
          value: row.address,
          label: `${formatRail(row.paymentMint)} • ${row.paymentAmount.toString()}`,
          hint: `${row.active ? "Active" : "Inactive"} payment option`,
        })),
    [filteredPaymentOptions],
  );
  const positionOptions = useMemo(
    () =>
      filteredPositions.map((row) => ({
        value: row.address,
        label: `${shortAddress(row.member)} • ${shortAddress(row.address)}`,
        hint: `Due ${formatTimestamp(row.nextDueAt)} • NFT ${shortAddress(row.nftMint)}`,
      })),
    [filteredPositions],
  );

  const canManageSeries = capabilities.canManagePolicySeries;
  const canManagePaymentRails = capabilities.canManagePaymentOptions;
  const canIssuePositions = capabilities.isPoolAuthority || capabilities.isPoolOperator || capabilities.canManagePolicySeries;
  const canPayPremium = capabilities.isRegisteredMember || capabilities.isClaimDelegate || capabilities.isPoolAuthority || capabilities.isPoolOperator;
  const canAttestOffchainPremium = capabilities.isRegisteredOracle;

  const createGuard = useMemo(() => {
    if (!canManageSeries) return "Policy series management is limited to operator or governance wallets.";
    if (!publicKey || !sendTransaction) return "Connect an operator wallet to manage policy series.";
    if (!normalize(productIdSeed)) return "Series seed is required.";
    if (!normalize(displayName)) return "Series display name is required.";
    if (parseMonthsToSeconds(durationMonths) <= 0n) return "Duration must be greater than zero.";
    if (parseDaysToSeconds(premiumCadenceDays) <= 0n) return "Premium cadence must be greater than zero.";
    if (parseDaysToSeconds(premiumGraceDays) < 0n) return "Premium grace must be zero or greater.";
    try {
      if (BigInt(normalize(premiumAmountBaseUnits)) <= 0n) return "Premium amount must be greater than zero.";
    } catch {
      return "Premium amount must be an integer in base units.";
    }
    return "";
  }, [canManageSeries, displayName, durationMonths, premiumAmountBaseUnits, premiumCadenceDays, premiumGraceDays, productIdSeed, publicKey, sendTransaction]);

  const updateGuard = useMemo(() => {
    if (createGuard) return createGuard;
    if (!selectedSeries) return "Select a policy series to update it.";
    return "";
  }, [createGuard, selectedSeries]);

  const paymentOptionGuard = useMemo(() => {
    if (!canManagePaymentRails) return "Payment rail management is limited to operator or governance wallets.";
    if (!publicKey || !sendTransaction) return "Connect an operator wallet to manage payment rails.";
    if (!selectedSeries) return "Select a policy series first.";
    try {
      new PublicKey(paymentMintInput);
    } catch {
      return "Payment mint must be a valid mint address or the zero SOL mint.";
    }
    try {
      if (BigInt(normalize(paymentAmountInput)) <= 0n) return "Payment amount must be greater than zero.";
    } catch {
      return "Payment amount must be an integer in base units.";
    }
    return "";
  }, [canManagePaymentRails, paymentAmountInput, paymentMintInput, publicKey, selectedSeries, sendTransaction]);

  const subscribeGuard = useMemo(() => {
    if (!capabilities.isRegisteredMember) return "Only an enrolled member wallet can subscribe directly.";
    if (!publicKey || !sendTransaction) return "Connect a member wallet to subscribe.";
    if (!selectedSeries) return "Select a policy series first.";
    return "";
  }, [capabilities.isRegisteredMember, publicKey, selectedSeries, sendTransaction]);

  const issueGuard = useMemo(() => {
    if (!canIssuePositions) return "Position issuance is limited to operator or governance wallets.";
    if (!publicKey || !sendTransaction) return "Connect an operator wallet to issue a position.";
    if (!selectedSeries) return "Select a policy series first.";
    if (!selectedMember?.member) return "Select an enrolled member first.";
    return "";
  }, [canIssuePositions, publicKey, selectedMember?.member, selectedSeries, sendTransaction]);

  const mintNftGuard = useMemo(() => {
    if (!canIssuePositions) return "Policy NFT minting is limited to operator or governance wallets.";
    if (!publicKey || !sendTransaction) return "Connect an operator wallet to mint a policy NFT.";
    if (!selectedSeries) return "Select a policy series first.";
    if (!selectedMember?.member) return "Select a member first.";
    try {
      new PublicKey(nftMintInput);
    } catch {
      return "Policy NFT mint must be a valid Solana public key.";
    }
    if (!normalize(nftMetadataUriInput)) return "NFT metadata URI is required.";
    return "";
  }, [canIssuePositions, nftMetadataUriInput, nftMintInput, publicKey, selectedMember?.member, selectedSeries, sendTransaction]);

  const premiumGuard = useMemo(() => {
    if (!canPayPremium) return "Premium payments require a member, delegate, or operator wallet.";
    if (!publicKey || !sendTransaction) return "Connect a payer wallet to pay premiums.";
    if (!selectedSeries) return "Select a policy series first.";
    if (!selectedMember?.member) return "Select the member position owner.";
    const effectivePaymentMint = selectedPaymentOption?.paymentMint ?? paymentMintInput;
    if (effectivePaymentMint !== ZERO_PUBKEY && !selectedWalletPaymentAccount) {
      return "Select a payer token account for the chosen SPL payment rail.";
    }
    return "";
  }, [canPayPremium, paymentMintInput, publicKey, selectedMember?.member, selectedPaymentOption?.paymentMint, selectedSeries, selectedWalletPaymentAccount, sendTransaction]);

  const offchainGuard = useMemo(() => {
    if (!canAttestOffchainPremium) return "Off-chain premium attestations require a registered oracle wallet.";
    if (!publicKey || !sendTransaction) return "Connect an oracle wallet to attest off-chain premium payment.";
    if (!selectedSeries) return "Select a policy series first.";
    if (!selectedMember?.member) return "Select a member first.";
    if (!/^[0-9a-f]{64}$/iu.test(normalize(offchainReplayHash).replace(/^0x/, ""))) {
      return "Replay hash must be a 32-byte hex value.";
    }
    if (!offchainPaidAt.trim()) return "Off-chain payment timestamp is required.";
    return "";
  }, [canAttestOffchainPremium, offchainPaidAt, offchainReplayHash, publicKey, selectedMember?.member, selectedSeries, sendTransaction]);

  const activationGuard = useMemo(() => {
    if (!capabilities.canActivateCycles) return "Cycle activation is limited to members, delegates, or operator wallets.";
    if (!publicKey || !sendTransaction) return "Connect a signer wallet to activate a cycle.";
    if (quoteError) return quoteError;
    if (!parsedQuote) return "Paste a signed quote payload first.";
    if (!quoteUsesSolRail(parsedQuote) && !selectedWalletPaymentAccount) {
      return "Select the payer token account for the quote payment mint.";
    }
    return "";
  }, [capabilities.canActivateCycles, parsedQuote, publicKey, quoteError, selectedWalletPaymentAccount, sendTransaction]);

  async function runProtocolAction(
    label: string,
    factory: (recentBlockhash: string) => Promise<ReturnType<typeof buildCreatePolicySeriesTx>>,
  ) {
    if (!sendTransaction) return;
    setBusyAction(label);
    setStatus(null);
    setStatusTone(null);
    setTxUrl(null);
    try {
      const { blockhash } = await connection.getLatestBlockhash("confirmed");
      const tx = await factory(blockhash);
      const result = await executeProtocolTransaction({
        connection,
        sendTransaction,
        tx,
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

  async function onCreateSeries() {
    if (createGuard || !publicKey) return;
    const seriesRefHashHex = await hashStringTo32Hex(normalize(productIdSeed));
    const termsHashHex = normalize(termsHashOverride)
      ? normalize(termsHashOverride).replace(/^0x/, "")
      : await hashStringTo32Hex([
        poolAddress,
        normalize(productIdSeed),
        normalize(displayName),
        normalize(metadataUri),
        normalize(premiumAmountBaseUnits),
      ].join("|"));
    await runProtocolAction("Create policy series", async (recentBlockhash) =>
      buildCreatePolicySeriesTx({
        authority: publicKey,
        poolAddress: new PublicKey(poolAddress),
        seriesRefHashHex,
        status: productActive ? POLICY_SERIES_STATUS_ACTIVE : POLICY_SERIES_STATUS_PAUSED,
        planMode: PLAN_MODE_PROTECTION,
        sponsorMode: SPONSOR_MODE_DIRECT,
        displayName,
        metadataUri,
        termsHashHex,
        durationSecs: parseMonthsToSeconds(durationMonths),
        premiumDueEverySecs: parseDaysToSeconds(premiumCadenceDays),
        premiumGraceSecs: parseDaysToSeconds(premiumGraceDays),
        premiumAmount: BigInt(normalize(premiumAmountBaseUnits)),
        termsVersion: 1,
        mappingVersion: 0,
        recentBlockhash,
      }));
  }

  async function onUpdateSeries() {
    if (updateGuard || !publicKey || !selectedSeries) return;
    await runProtocolAction("Update policy series", async (recentBlockhash) =>
      buildUpdatePolicySeriesTx({
        authority: publicKey,
        poolAddress: new PublicKey(poolAddress),
        seriesRefHashHex: selectedSeries.seriesRefHashHex,
        status: productActive ? POLICY_SERIES_STATUS_ACTIVE : POLICY_SERIES_STATUS_PAUSED,
        planMode: selectedSeries.planMode,
        sponsorMode: selectedSeries.sponsorMode,
        displayName,
        metadataUri,
        termsHashHex: normalize(termsHashOverride)
          ? normalize(termsHashOverride).replace(/^0x/, "")
          : selectedSeries.termsHashHex,
        durationSecs: parseMonthsToSeconds(durationMonths),
        premiumDueEverySecs: parseDaysToSeconds(premiumCadenceDays),
        premiumGraceSecs: parseDaysToSeconds(premiumGraceDays),
        premiumAmount: BigInt(normalize(premiumAmountBaseUnits)),
        termsVersion: selectedSeries.termsVersion,
        mappingVersion: selectedSeries.mappingVersion,
        recentBlockhash,
      }));
  }

  async function onUpsertPaymentOption() {
    if (paymentOptionGuard || !publicKey || !selectedSeries) return;
    await runProtocolAction("Upsert payment option", async (recentBlockhash) =>
      buildUpsertPolicySeriesPaymentOptionTx({
        authority: publicKey,
        poolAddress: new PublicKey(poolAddress),
        seriesRefHashHex: selectedSeries.seriesRefHashHex,
        paymentMint: new PublicKey(paymentMintInput),
        paymentAmount: BigInt(normalize(paymentAmountInput)),
        active: paymentOptionActive,
        recentBlockhash,
      }));
  }

  async function onSubscribe() {
    if (subscribeGuard || !publicKey || !selectedSeries) return;
    await runProtocolAction("Subscribe policy series", async (recentBlockhash) =>
      buildSubscribePolicySeriesTx({
        member: publicKey,
        poolAddress: new PublicKey(poolAddress),
        seriesRefHashHex: selectedSeries.seriesRefHashHex,
        startsAtTs: dateInputToUnixTs(subscribeStartDate),
        recentBlockhash,
      }));
  }

  async function onIssuePosition() {
    if (issueGuard || !publicKey || !selectedSeries || !selectedMember?.member) return;
    await runProtocolAction("Issue policy position", async (recentBlockhash) =>
      buildIssuePolicyPositionTx({
        authority: publicKey,
        poolAddress: new PublicKey(poolAddress),
        member: new PublicKey(selectedMember.member),
        seriesRefHashHex: selectedSeries.seriesRefHashHex,
        startsAtTs: dateInputToUnixTs(issueStartDate),
        recentBlockhash,
      }));
  }

  async function onMintPolicyNft() {
    if (mintNftGuard || !publicKey || !selectedSeries || !selectedMember?.member) return;
    await runProtocolAction("Mint policy NFT", async (recentBlockhash) =>
      buildMintPolicyNftTx({
        authority: publicKey,
        poolAddress: new PublicKey(poolAddress),
        member: new PublicKey(selectedMember.member),
        seriesRefHashHex: selectedSeries.seriesRefHashHex,
        nftMint: new PublicKey(nftMintInput),
        metadataUri: nftMetadataUriInput,
        recentBlockhash,
      }));
  }

  async function onPayPremium() {
    if (premiumGuard || !publicKey || !selectedSeries || !selectedMember?.member) return;
    const paymentMint = selectedPaymentOption?.paymentMint ?? paymentMintInput;
    await runProtocolAction("Pay premium", async (recentBlockhash) => {
      if (paymentMint === ZERO_PUBKEY) {
        return buildPayPremiumSolTx({
          payer: publicKey,
          poolAddress: new PublicKey(poolAddress),
          member: new PublicKey(selectedMember.member),
          seriesRefHashHex: selectedSeries.seriesRefHashHex,
          periodIndex: BigInt(normalize(premiumPeriodIndex) || "0"),
          recentBlockhash,
        });
      }
      return buildPayPremiumSplTx({
        payer: publicKey,
        poolAddress: new PublicKey(poolAddress),
        member: new PublicKey(selectedMember.member),
        seriesRefHashHex: selectedSeries.seriesRefHashHex,
        paymentMint: new PublicKey(paymentMint),
        periodIndex: BigInt(normalize(premiumPeriodIndex) || "0"),
        payerTokenAccount: new PublicKey(selectedWalletPaymentAccount),
        recentBlockhash,
      });
    });
  }

  async function onAttestOffchainPayment() {
    if (offchainGuard || !publicKey || !selectedSeries || !selectedMember?.member) return;
    await runProtocolAction("Attest premium paid off-chain", async (recentBlockhash) =>
      buildAttestPremiumPaidOffchainTx({
        oracle: publicKey,
        poolAddress: new PublicKey(poolAddress),
        member: new PublicKey(selectedMember.member),
        seriesRefHashHex: selectedSeries.seriesRefHashHex,
        periodIndex: BigInt(normalize(premiumPeriodIndex) || "0"),
        replayHashHex: normalize(offchainReplayHash).replace(/^0x/, ""),
        amount: BigInt(normalize(paymentAmountInput)),
        paidAtTs: dateTimeInputToUnixTs(offchainPaidAt),
        recentBlockhash,
      }));
  }

  async function onActivateCycle() {
    if (activationGuard || !publicKey || !parsedQuote) return;
    await runProtocolAction("Activate cycle from quote", async (recentBlockhash) => {
      const member = parsedQuote.member ? new PublicKey(parsedQuote.member) : publicKey;
      if (quoteUsesSolRail(parsedQuote)) {
        return buildActivateCycleWithQuoteSolTx({
          payer: publicKey,
          poolAddress: new PublicKey(poolAddress),
          oracle: new PublicKey(parsedQuote.oracle),
          member,
          seriesRefHashHex: parsedQuote.seriesRefHashHex,
          periodIndex: parsedQuote.periodIndex,
          nonceHashHex: parsedQuote.nonceHashHex,
          premiumAmountRaw: parsedQuote.premiumAmountRaw,
          canonicalPremiumAmount: parsedQuote.canonicalPremiumAmount,
          commitmentEnabled: parsedQuote.commitmentEnabled,
          bondAmountRaw: parsedQuote.bondAmountRaw,
          shieldFeeRaw: parsedQuote.shieldFeeRaw,
          protocolFeeRaw: parsedQuote.protocolFeeRaw,
          oracleFeeRaw: parsedQuote.oracleFeeRaw,
          netPoolPremiumRaw: parsedQuote.netPoolPremiumRaw,
          totalAmountRaw: parsedQuote.totalAmountRaw,
          includedShieldCount: parsedQuote.includedShieldCount,
          thresholdBps: parsedQuote.thresholdBps,
          outcomeThresholdScore: parsedQuote.outcomeThresholdScore,
          cohortHashHex: parsedQuote.cohortHashHex ?? undefined,
          expiresAtTs: parsedQuote.expiresAtTs,
          quoteMetaHashHex: parsedQuote.quoteMetaHashHex,
          quoteVerificationInstruction: parsedQuote.quoteVerificationInstruction,
          recentBlockhash,
        });
      }
      return buildActivateCycleWithQuoteSplTx({
        payer: publicKey,
        poolAddress: new PublicKey(poolAddress),
        oracle: new PublicKey(parsedQuote.oracle),
        member,
        paymentMint: new PublicKey(parsedQuote.paymentMint),
        payerTokenAccount: new PublicKey(selectedWalletPaymentAccount),
        seriesRefHashHex: parsedQuote.seriesRefHashHex,
        periodIndex: parsedQuote.periodIndex,
        nonceHashHex: parsedQuote.nonceHashHex,
        premiumAmountRaw: parsedQuote.premiumAmountRaw,
        canonicalPremiumAmount: parsedQuote.canonicalPremiumAmount,
        commitmentEnabled: parsedQuote.commitmentEnabled,
        bondAmountRaw: parsedQuote.bondAmountRaw,
        shieldFeeRaw: parsedQuote.shieldFeeRaw,
        protocolFeeRaw: parsedQuote.protocolFeeRaw,
        oracleFeeRaw: parsedQuote.oracleFeeRaw,
        netPoolPremiumRaw: parsedQuote.netPoolPremiumRaw,
        totalAmountRaw: parsedQuote.totalAmountRaw,
        includedShieldCount: parsedQuote.includedShieldCount,
        thresholdBps: parsedQuote.thresholdBps,
        outcomeThresholdScore: parsedQuote.outcomeThresholdScore,
        cohortHashHex: parsedQuote.cohortHashHex ?? undefined,
        expiresAtTs: parsedQuote.expiresAtTs,
        quoteMetaHashHex: parsedQuote.quoteMetaHashHex,
        quoteVerificationInstruction: parsedQuote.quoteVerificationInstruction,
        recentBlockhash,
      });
    });
  }

  const paymentVault = useMemo(
    () => poolAssetVaults.find((row) => row.payoutMint === (selectedPaymentOption?.paymentMint ?? paymentMintInput)) ?? null,
    [paymentMintInput, poolAssetVaults, selectedPaymentOption?.paymentMint],
  );

  return (
    <section className="space-y-4">
      <section className="surface-card-soft space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Layers3 className="h-4 w-4 text-[var(--accent-strong)]" />
            <p className="metric-label">Coverage workspace</p>
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
        <p className="field-help">
          {panelLead}
        </p>
        <div className="flex flex-wrap gap-2">
          <span className="status-pill status-off">{series.length} series</span>
          <span className="status-pill status-off">{paymentOptions.length} payment rails</span>
          <span className="status-pill status-off">{positions.length} positions</span>
          <span className="status-pill status-off">{memberCycles.length} member cycles</span>
        </div>
      </section>

      {visiblePanels.length > 1 ? (
        <section className="surface-card-soft space-y-3">
          <div className="grid gap-2 sm:grid-cols-4">
            {COVERAGE_PANELS.filter((panel) => visiblePanels.includes(panel.value)).map((panel) => (
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

      <section className="surface-card-soft space-y-3">
        <div className={`grid gap-3 ${showMemberSelector && showPaymentSelector ? "xl:grid-cols-3" : showMemberSelector || showPaymentSelector ? "xl:grid-cols-2" : "xl:grid-cols-1"}`}>
          <SearchableSelect
            label="Policy series"
            value={selectedSeriesAddress}
            options={selectedSeriesOptions}
            onChange={setSelectedSeriesAddress}
            searchValue={seriesSearch}
            onSearchChange={setSeriesSearch}
            loading={loading}
            placeholder="Select policy series"
          />
          {showMemberSelector ? (
            <SearchableSelect
              label="Member context"
              value={selectedMemberAddress}
              options={memberOptions}
              onChange={setSelectedMemberAddress}
              searchValue={memberSearch}
              onSearchChange={setMemberSearch}
              loading={loading}
              placeholder="Select member"
              emptyMessage="No active memberships were discovered for this pool."
            />
          ) : null}
          {showPaymentSelector ? (
            <SearchableSelect
              label="Payment rail"
              value={selectedPaymentOptionAddress}
              options={paymentOptionOptions}
              onChange={setSelectedPaymentOptionAddress}
              searchValue={paymentSearch}
              onSearchChange={setPaymentSearch}
              loading={loading}
              placeholder="Select payment rail"
              emptyMessage="No payment options match this policy series yet."
            />
          ) : null}
        </div>

        {selectedSeries ? (
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            <div className="monitor-row">
              <span>Status</span>
              <span>{selectedSeries.status === POLICY_SERIES_STATUS_ACTIVE ? "Active" : `Status ${selectedSeries.status}`}</span>
            </div>
            <div className="monitor-row">
              <span>Terms hash</span>
              <span>{shortAddress(selectedSeries.termsHashHex)}</span>
            </div>
            <div className="monitor-row">
              <span>Default premium</span>
              <span>{selectedSeries.premiumAmount.toString()}</span>
            </div>
            <div className="monitor-row">
              <span>Default rail</span>
              <span>{formatRail(selectedPaymentOption?.paymentMint ?? paymentMintInput)}</span>
            </div>
          </div>
        ) : (
          <p className="field-help">Select a policy series to unlock the shared coverage subviews.</p>
        )}
      </section>

      {activePanel === "series" ? (
        <section className="surface-card-soft space-y-4">
          <div className="flex items-center gap-2">
            <ShieldPlus className="h-4 w-4 text-[var(--accent-strong)]" />
            <p className="metric-label">Series + payment rails</p>
          </div>

          {canManageSeries || canManagePaymentRails ? (
            <>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="space-y-1">
                  <span className="metric-label">Series seed (create only)</span>
                  <input className="field-input" value={productIdSeed} onChange={(event) => setProductIdSeed(event.target.value)} />
                </label>
                <label className="space-y-1">
                  <span className="metric-label">Display name</span>
                  <input className="field-input" value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
                </label>
                <label className="space-y-1 md:col-span-2">
                  <span className="metric-label">Metadata URI</span>
                  <input className="field-input" value={metadataUri} onChange={(event) => setMetadataUri(event.target.value)} />
                </label>
                <label className="space-y-1">
                  <span className="metric-label">Duration (months)</span>
                  <input className="field-input" value={durationMonths} onChange={(event) => setDurationMonths(event.target.value)} />
                </label>
                <label className="space-y-1">
                  <span className="metric-label">Premium amount (base units)</span>
                  <input className="field-input" value={premiumAmountBaseUnits} onChange={(event) => setPremiumAmountBaseUnits(event.target.value)} />
                </label>
                <label className="space-y-1">
                  <span className="metric-label">Premium cadence (days)</span>
                  <input className="field-input" value={premiumCadenceDays} onChange={(event) => setPremiumCadenceDays(event.target.value)} />
                </label>
                <label className="space-y-1">
                  <span className="metric-label">Grace window (days)</span>
                  <input className="field-input" value={premiumGraceDays} onChange={(event) => setPremiumGraceDays(event.target.value)} />
                </label>
              </div>

              <label className="inline-flex items-center gap-2 text-sm text-[var(--foreground)]">
                <input type="checkbox" checked={productActive} onChange={(event) => setProductActive(event.target.checked)} />
                Keep series active
              </label>

              <AdvancedOverride
                title="Manual terms hash"
                description="Use this only when the derived terms hash is not the value you want to publish for this series."
                openDescription="Manual terms hash mode is active. The override below replaces the derived value for this submission."
                closedActionLabel="Use manual terms hash"
                openActionLabel="Use derived terms hash"
                enabled={expertOpen}
                onToggle={setExpertOpen}
              >
                <label className="space-y-1">
                  <span className="metric-label">Terms hash override</span>
                  <input
                    className="field-input font-mono"
                    value={termsHashOverride}
                    onChange={(event) => setTermsHashOverride(event.target.value)}
                    placeholder="Optional 32-byte hex"
                  />
                </label>
              </AdvancedOverride>

              <div className="flex flex-wrap gap-2">
                {canManageSeries ? (
                  <>
                    <button type="button" className="action-button" onClick={() => void onCreateSeries()} disabled={Boolean(createGuard) || Boolean(busyAction)}>
                      {busyAction === "Create policy series" ? "Creating..." : "Create series"}
                    </button>
                    <button type="button" className="secondary-button" onClick={() => void onUpdateSeries()} disabled={Boolean(updateGuard) || Boolean(busyAction)}>
                      {busyAction === "Update policy series" ? "Updating..." : "Update selected series"}
                    </button>
                  </>
                ) : null}
              </div>
              {createGuard ? <p className="field-help">{createGuard}</p> : null}

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <label className="space-y-1 xl:col-span-2">
                  <span className="metric-label">Payment mint</span>
                  <input className="field-input font-mono" value={paymentMintInput} onChange={(event) => setPaymentMintInput(event.target.value)} />
                </label>
                <label className="space-y-1">
                  <span className="metric-label">Payment amount</span>
                  <input className="field-input" value={paymentAmountInput} onChange={(event) => setPaymentAmountInput(event.target.value)} />
                </label>
                <label className="inline-flex items-center gap-2 rounded-2xl border border-[var(--border)]/60 bg-[var(--surface)] px-3 py-2">
                  <input type="checkbox" checked={paymentOptionActive} onChange={(event) => setPaymentOptionActive(event.target.checked)} />
                  <span className="metric-label">Payment rail active</span>
                </label>
              </div>
              <div className="flex flex-wrap gap-2">
                {canManagePaymentRails ? (
                  <button type="button" className="secondary-button" onClick={() => void onUpsertPaymentOption()} disabled={Boolean(paymentOptionGuard) || Boolean(busyAction)}>
                    {busyAction === "Upsert payment option" ? "Saving..." : "Save payment rail"}
                  </button>
                ) : null}
                {paymentVault ? <span className="status-pill status-off">Vault {shortAddress(paymentVault.vaultTokenAccount)}</span> : null}
              </div>
              {paymentOptionGuard ? <p className="field-help">{paymentOptionGuard}</p> : null}
            </>
          ) : (
            <p className="field-help">Policy series and payment rail management is limited to operator or governance wallets. Series state stays visible here for review.</p>
          )}
        </section>
      ) : null}

      {activePanel === "positions" ? (
        <section className="surface-card-soft space-y-4">
          <div className="grid gap-4 xl:grid-cols-2">
            <article className="space-y-3 rounded-2xl border border-[var(--border)]/60 bg-[var(--surface)] p-4">
              <p className="metric-label">Member subscribe</p>
              <p className="field-help">Default path for connected members. Uses the selected series and current wallet as the subscriber.</p>
              <label className="space-y-1">
                <span className="metric-label">Policy start date</span>
                <input className="field-input" type="date" value={subscribeStartDate} onChange={(event) => setSubscribeStartDate(event.target.value)} />
              </label>
              <button type="button" className="action-button" onClick={() => void onSubscribe()} disabled={Boolean(subscribeGuard) || Boolean(busyAction)}>
                {busyAction === "Subscribe policy series" ? "Subscribing..." : "Subscribe with connected wallet"}
              </button>
              {subscribeGuard ? <p className="field-help">{subscribeGuard}</p> : null}
            </article>

            {canIssuePositions ? (
              <article className="space-y-3 rounded-2xl border border-[var(--border)]/60 bg-[var(--surface)] p-4">
              <p className="metric-label">Operator issue + NFT mint</p>
              <label className="space-y-1">
                <span className="metric-label">Issue start date</span>
                <input className="field-input" type="date" value={issueStartDate} onChange={(event) => setIssueStartDate(event.target.value)} />
              </label>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="secondary-button" onClick={() => void onIssuePosition()} disabled={Boolean(issueGuard) || Boolean(busyAction)}>
                  {busyAction === "Issue policy position" ? "Issuing..." : "Issue position"}
                </button>
              </div>
              <label className="space-y-1">
                <span className="metric-label">NFT mint</span>
                <input className="field-input font-mono" value={nftMintInput} onChange={(event) => setNftMintInput(event.target.value)} />
              </label>
              <label className="space-y-1">
                <span className="metric-label">NFT metadata URI</span>
                <input className="field-input" value={nftMetadataUriInput} onChange={(event) => setNftMetadataUriInput(event.target.value)} />
              </label>
              <button type="button" className="secondary-button" onClick={() => void onMintPolicyNft()} disabled={Boolean(mintNftGuard) || Boolean(busyAction)}>
                {busyAction === "Mint policy NFT" ? "Minting..." : "Mint policy NFT"}
              </button>
              {issueGuard || mintNftGuard ? <p className="field-help">{issueGuard || mintNftGuard}</p> : null}
              </article>
            ) : null}
          </div>

          <SearchableSelect
            label="Position history"
            value={selectedPositionAddress}
            options={positionOptions}
            onChange={setSelectedPositionAddress}
            searchValue=""
            onSearchChange={() => {}}
            placeholder="Select position"
            disabled={!positionOptions.length}
            disabledHint="No policy positions were indexed for this pool yet."
            emptyMessage="No positions found for the selected series."
          />

          {selectedPosition ? (
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
              <div className="monitor-row">
                <span>Member</span>
                <span>{shortAddress(selectedPosition.member)}</span>
              </div>
              <div className="monitor-row">
                <span>Starts</span>
                <span>{formatTimestamp(selectedPosition.startsAt)}</span>
              </div>
              <div className="monitor-row">
                <span>Ends</span>
                <span>{formatTimestamp(selectedPosition.endsAt)}</span>
              </div>
              <div className="monitor-row">
                <span>Next due</span>
                <span>{formatTimestamp(selectedPosition.nextDueAt)}</span>
              </div>
            </div>
          ) : null}

          <ul className="space-y-2">
            {positionNfts
              .filter((row) => (selectedSeries ? row.seriesRefHashHex === selectedSeries.seriesRefHashHex : true))
              .slice(0, 6)
              .map((row) => (
                <li key={row.address} className="rounded-2xl border border-[var(--border)]/60 bg-[var(--surface)] p-3">
                  <p className="text-sm font-semibold text-[var(--foreground)]">{shortAddress(row.member)} NFT</p>
                  <p className="field-help break-all">{row.metadataUri || row.nftMint}</p>
                </li>
              ))}
          </ul>
        </section>
      ) : null}

      {activePanel === "payments" ? (
        <section className="surface-card-soft space-y-4">
          <div className="grid gap-4 xl:grid-cols-2">
            <article className="space-y-3 rounded-2xl border border-[var(--border)]/60 bg-[var(--surface)] p-4">
              <div className="flex items-center gap-2">
                <WalletCards className="h-4 w-4 text-[var(--accent-strong)]" />
                <p className="metric-label">On-chain premium</p>
              </div>
              <label className="space-y-1">
                <span className="metric-label">Period index</span>
                <input className="field-input" value={premiumPeriodIndex} onChange={(event) => setPremiumPeriodIndex(event.target.value)} />
              </label>
              {paymentMintInput !== ZERO_PUBKEY ? (
                <label className="space-y-1">
                  <span className="metric-label">Payer token account</span>
                  <select className="field-input" value={selectedWalletPaymentAccount} onChange={(event) => setSelectedWalletPaymentAccount(event.target.value)}>
                    <option value="">Select token account</option>
                    {walletPaymentAccounts.map((row) => (
                      <option key={row.address} value={row.address}>
                        {shortAddress(row.address)} • balance {row.amount}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <p className="field-help">
                Selected rail: {formatRail(selectedPaymentOption?.paymentMint ?? paymentMintInput)} • amount {selectedPaymentOption?.paymentAmount.toString() ?? paymentAmountInput}
              </p>
              <button type="button" className="action-button" onClick={() => void onPayPremium()} disabled={Boolean(premiumGuard) || Boolean(busyAction)}>
                {busyAction === "Pay premium" ? "Paying..." : "Pay premium"}
              </button>
              {premiumGuard ? <p className="field-help">{premiumGuard}</p> : null}
            </article>

            <article className="space-y-3 rounded-2xl border border-[var(--border)]/60 bg-[var(--surface)] p-4">
              <p className="metric-label">Off-chain premium attestation</p>
              <label className="space-y-1">
                <span className="metric-label">Replay hash</span>
                <input className="field-input font-mono" value={offchainReplayHash} onChange={(event) => setOffchainReplayHash(event.target.value)} />
              </label>
              <label className="space-y-1">
                <span className="metric-label">Paid at</span>
                <input className="field-input" type="datetime-local" value={offchainPaidAt} onChange={(event) => setOffchainPaidAt(event.target.value)} />
              </label>
              {canAttestOffchainPremium ? (
                <>
                  <button type="button" className="secondary-button" onClick={() => void onAttestOffchainPayment()} disabled={Boolean(offchainGuard) || Boolean(busyAction)}>
                    {busyAction === "Attest premium paid off-chain" ? "Submitting..." : "Attest off-chain payment"}
                  </button>
                  {offchainGuard ? <p className="field-help">{offchainGuard}</p> : null}
                </>
              ) : (
                <p className="field-help">Off-chain premium attestations require a registered oracle wallet.</p>
              )}
            </article>
          </div>

          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            {filteredCycles.slice(0, 4).map((row) => (
              <div key={row.address} className="monitor-row">
                <span>{shortAddress(row.member)}</span>
                <span>{row.periodIndex.toString()} • {row.premiumAmountRaw.toString()}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {activePanel === "activation" ? (
        <section className="surface-card-soft space-y-4">
          <div className="space-y-2">
            <p className="metric-label">Quote-based activation</p>
            <p className="field-help">
              Paste one signed quote object. The UI parses the canonical quote payload, infers SOL/SPL handling, and optionally appends the verification instruction if present.
            </p>
            <textarea
              className="field-input min-h-52 font-mono"
              value={quoteInput}
              onChange={(event) => setQuoteInput(event.target.value)}
              placeholder='{"oracle":"...","paymentMint":"11111111111111111111111111111111","seriesRefHashHex":"..."}'
            />
            {quoteError ? <p className="field-error">{quoteError}</p> : null}
          </div>

          {parsedQuote ? (
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
              <div className="monitor-row">
                <span>Oracle</span>
                <span>{shortAddress(parsedQuote.oracle)}</span>
              </div>
              <div className="monitor-row">
                <span>Member</span>
                <span>{shortAddress((parsedQuote.member ?? walletAddress) || "connected wallet")}</span>
              </div>
              <div className="monitor-row">
                <span>Rail</span>
                <span>{quoteUsesSolRail(parsedQuote) ? "SOL" : shortAddress(parsedQuote.paymentMint)}</span>
              </div>
              <div className="monitor-row">
                <span>Period</span>
                <span>{parsedQuote.periodIndex.toString()}</span>
              </div>
              <div className="monitor-row">
                <span>Total</span>
                <span>{parsedQuote.totalAmountRaw.toString()}</span>
              </div>
              <div className="monitor-row">
                <span>Expires</span>
                <span>{formatTimestamp(parsedQuote.expiresAtTs)}</span>
              </div>
              <div className="monitor-row">
                <span>Verification ix</span>
                <span>{parsedQuote.quoteVerificationInstruction ? "Attached" : "None"}</span>
              </div>
            </div>
          ) : null}

          {parsedQuote && !quoteUsesSolRail(parsedQuote) ? (
            <label className="space-y-1">
              <span className="metric-label">Payer token account</span>
              <select className="field-input" value={selectedWalletPaymentAccount} onChange={(event) => setSelectedWalletPaymentAccount(event.target.value)}>
                <option value="">Select token account</option>
                {walletPaymentAccounts.map((row) => (
                  <option key={row.address} value={row.address}>
                    {shortAddress(row.address)} • balance {row.amount}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <button type="button" className="action-button" onClick={() => void onActivateCycle()} disabled={Boolean(activationGuard) || Boolean(busyAction)}>
            {busyAction === "Activate cycle from quote" ? "Activating..." : "Activate cycle"}
          </button>
          {activationGuard ? <p className="field-help">{activationGuard}</p> : null}
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
