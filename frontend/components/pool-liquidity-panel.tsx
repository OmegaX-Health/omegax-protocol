// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { RefreshCw, Waves } from "lucide-react";

import {
  buildCapitalClassIntegrationPolicy,
  buildWalletPoolPositionSummary,
  buildPoolCapitalMetrics,
  buildDepositPoolLiquiditySolTx,
  buildDepositPoolLiquiditySplTx,
  buildInitializePoolLiquiditySolTx,
  buildInitializePoolLiquiditySplTx,
  buildRedeemPoolLiquiditySolTx,
  buildRedeemPoolLiquiditySplTx,
  buildSetPoolRiskControlsTx,
  buildSetPoolLiquidityEnabledTx,
  clearProtocolDiscoveryCache,
  computePoolLiquidityDepositSharesOut,
  computePoolLiquidityMinOut,
  computePoolLiquidityRedeemAmountOut,
  CAPITAL_CLASS_MODE_DISTRIBUTION,
  CAPITAL_CLASS_MODE_HYBRID,
  CAPITAL_TRANSFER_MODE_PERMISSIONLESS,
  CAPITAL_TRANSFER_MODE_RESTRICTED,
  CAPITAL_TRANSFER_MODE_WRAPPER_ONLY,
  DEFAULT_LIQUIDITY_SLIPPAGE_BPS,
  listCoverageClaims,
  listMemberships,
  listPoolAssetVaults,
  listPoolCapitalClasses,
  listPoolLiquidityConfigs,
  listPoolRiskConfigs,
  listRewardClaims,
  listPoolTreasuryReserves,
  listPools,
  listPoolTerms,
  listWalletTokenAccountsForMint,
  MEMBERSHIP_STATUS_ACTIVE,
  POOL_CLAIM_MODE_OPEN,
  POOL_CLAIM_MODE_PAUSED,
  POOL_REDEMPTION_MODE_OPEN,
  POOL_REDEMPTION_MODE_PAUSED,
  POOL_REDEMPTION_MODE_QUEUE_ONLY,
  toExplorerLink,
  ZERO_PUBKEY,
  type CapitalClassIntegrationPolicySummary,
  type CoverageClaimSummary,
  type MembershipSummary,
  type PoolAssetVaultSummary,
  type PoolCapitalClassSummary,
  type PoolCapitalMetricsSummary,
  type PoolLiquidityConfigSummary,
  type PoolRiskConfigSummary,
  type PoolSummary,
  type PoolTreasuryReserveSummary,
  type PoolTermsSummary,
  type RewardClaimSummary,
  type TokenAccountSummary,
  type WalletPoolPositionSummary,
} from "@/lib/protocol";
import { formatApyBps, formatPoolTvl, listPoolDefiMetrics, type PoolDefiMetrics } from "@/lib/pool-defi-metrics";
import { formatRpcError } from "@/lib/rpc-errors";

const SOL_DECIMALS = 9;

type PoolLiquidityPanelProps = {
  poolAddress: string;
  sectionMode?: "standalone" | "embedded";
};

function pow10(decimals: number): bigint {
  return 10n ** BigInt(Math.max(0, decimals));
}

function formatUnits(amount: bigint, decimals: number, maxFractionDigits = 6): string {
  const sign = amount < 0n ? "-" : "";
  const value = amount < 0n ? -amount : amount;
  const denom = pow10(decimals);
  const whole = value / denom;
  const frac = value % denom;
  if (decimals === 0) {
    return `${sign}${whole.toString()}`;
  }
  const padded = frac.toString().padStart(decimals, "0");
  const trimmed = padded.slice(0, Math.max(0, maxFractionDigits)).replace(/0+$/, "");
  return trimmed.length ? `${sign}${whole.toString()}.${trimmed}` : `${sign}${whole.toString()}`;
}

function parseUnits(input: string, decimals: number): bigint | null {
  const normalized = input.trim();
  if (!normalized) return null;
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;
  const [wholePart, fractionPart = ""] = normalized.split(".");
  if (fractionPart.length > decimals) return null;
  const whole = BigInt(wholePart);
  const fracPadded = `${fractionPart}${"0".repeat(Math.max(0, decimals - fractionPart.length))}`;
  const fraction = fracPadded ? BigInt(fracPadded) : 0n;
  return whole * pow10(decimals) + fraction;
}

function parseSlippagePercentToBps(input: string): number {
  const parsed = Number.parseFloat(input.trim());
  if (!Number.isFinite(parsed) || parsed < 0) return DEFAULT_LIQUIDITY_SLIPPAGE_BPS;
  return Math.max(0, Math.min(10_000, Math.round(parsed * 100)));
}

function formatReferenceNav(referenceNavScaled: bigint, payoutDecimals: number): string {
  return formatUnits(referenceNavScaled, payoutDecimals, 8);
}

function shortAddress(value: string): string {
  if (value.length < 12) return value;
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function formatRedemptionMode(mode: number): string {
  switch (mode) {
    case POOL_REDEMPTION_MODE_OPEN:
      return "Open";
    case POOL_REDEMPTION_MODE_QUEUE_ONLY:
      return "Queue only";
    case POOL_REDEMPTION_MODE_PAUSED:
      return "Paused";
    default:
      return `Unknown (${mode})`;
  }
}

function formatClaimMode(mode: number): string {
  switch (mode) {
    case POOL_CLAIM_MODE_OPEN:
      return "Open";
    case POOL_CLAIM_MODE_PAUSED:
      return "Paused";
    default:
      return `Unknown (${mode})`;
  }
}

function formatCapitalClassMode(mode: number): string {
  switch (mode) {
    case CAPITAL_CLASS_MODE_DISTRIBUTION:
      return "Distribution";
    case CAPITAL_CLASS_MODE_HYBRID:
      return "Hybrid";
    default:
      return "NAV-up";
  }
}

function formatTransferMode(mode: number): string {
  switch (mode) {
    case CAPITAL_TRANSFER_MODE_RESTRICTED:
      return "Restricted";
    case CAPITAL_TRANSFER_MODE_WRAPPER_ONLY:
      return "Wrapper-only";
    case CAPITAL_TRANSFER_MODE_PERMISSIONLESS:
    default:
      return "Permissionless";
  }
}

function formatUtilizationBps(bps: number): string {
  return `${(bps / 100).toFixed(2)}%`;
}

function formatIntegrationMode(policy: CapitalClassIntegrationPolicySummary): string {
  switch (policy.marketParticipationMode) {
    case "wrapper-mediated":
      return "Wrapper-mediated";
    case "restricted":
      return "Restricted";
    case "direct":
      return "Direct";
    default:
      return "Transitional";
  }
}

export function PoolLiquidityPanel({ poolAddress, sectionMode = "standalone" }: PoolLiquidityPanelProps) {
  const { connection } = useConnection();
  const { connected, publicKey, sendTransaction } = useWallet();
  const embedded = sectionMode === "embedded";

  const [pool, setPool] = useState<PoolSummary | null>(null);
  const [poolTerms, setPoolTerms] = useState<PoolTermsSummary | null>(null);
  const [liquidityConfig, setLiquidityConfig] = useState<PoolLiquidityConfigSummary | null>(null);
  const [assetVault, setAssetVault] = useState<PoolAssetVaultSummary | null>(null);
  const [poolRiskConfig, setPoolRiskConfig] = useState<PoolRiskConfigSummary | null>(null);
  const [poolCapitalClass, setPoolCapitalClass] = useState<PoolCapitalClassSummary | null>(null);
  const [treasuryReserve, setTreasuryReserve] = useState<PoolTreasuryReserveSummary | null>(null);
  const [membership, setMembership] = useState<MembershipSummary | null>(null);
  const [coverageClaims, setCoverageClaims] = useState<CoverageClaimSummary[]>([]);
  const [rewardClaims, setRewardClaims] = useState<RewardClaimSummary[]>([]);
  const [payoutDecimals, setPayoutDecimals] = useState<number>(SOL_DECIMALS);
  const [shareDecimals, setShareDecimals] = useState<number>(SOL_DECIMALS);
  const [shareSupplyRaw, setShareSupplyRaw] = useState<bigint>(0n);
  const [reservesRaw, setReservesRaw] = useState<bigint>(0n);
  const [userSharesRaw, setUserSharesRaw] = useState<bigint>(0n);
  const [userPayoutTokenAccounts, setUserPayoutTokenAccounts] = useState<TokenAccountSummary[]>([]);
  const [selectedUserPayoutTokenAccount, setSelectedUserPayoutTokenAccount] = useState("");
  const [poolMetrics, setPoolMetrics] = useState<PoolDefiMetrics | null>(null);
  const [initialAmountInput, setInitialAmountInput] = useState("");
  const [depositAmountInput, setDepositAmountInput] = useState("");
  const [redeemSharesInput, setRedeemSharesInput] = useState("");
  const [depositSlippageInput, setDepositSlippageInput] = useState("0.5");
  const [redeemSlippageInput, setRedeemSlippageInput] = useState("0.5");
  const [redemptionModeInput, setRedemptionModeInput] = useState<number>(POOL_REDEMPTION_MODE_OPEN);
  const [claimModeInput, setClaimModeInput] = useState<number>(POOL_CLAIM_MODE_OPEN);
  const [impairedInput, setImpairedInput] = useState(false);
  const [impairmentAmountInput, setImpairmentAmountInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("");
  const [statusTone, setStatusTone] = useState<"ok" | "error" | null>(null);
  const [txSig, setTxSig] = useState("");
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);

  const walletAddress = publicKey?.toBase58() ?? "";
  const isSolPool = poolTerms?.payoutAssetMint === ZERO_PUBKEY;
  const payoutSymbol = isSolPool ? "SOL" : "SPL";
  const isAuthority = Boolean(pool && walletAddress && pool.authority === walletAddress);

  const depositAmountRaw = useMemo(
    () => parseUnits(depositAmountInput, payoutDecimals),
    [depositAmountInput, payoutDecimals],
  );
  const redeemSharesRaw = useMemo(
    () => parseUnits(redeemSharesInput, shareDecimals),
    [redeemSharesInput, shareDecimals],
  );
  const depositSlippageBps = useMemo(
    () => parseSlippagePercentToBps(depositSlippageInput),
    [depositSlippageInput],
  );
  const redeemSlippageBps = useMemo(
    () => parseSlippagePercentToBps(redeemSlippageInput),
    [redeemSlippageInput],
  );
  const impairmentAmountRaw = useMemo(
    () => parseUnits(impairmentAmountInput, payoutDecimals),
    [impairmentAmountInput, payoutDecimals],
  );
  const capitalMetrics = useMemo<PoolCapitalMetricsSummary>(
    () =>
      buildPoolCapitalMetrics({
        capitalClass: poolCapitalClass,
        riskConfig: poolRiskConfig,
        treasuryReserve,
        reservesRaw,
        shareSupplyRaw,
      }),
    [poolCapitalClass, poolRiskConfig, reservesRaw, shareSupplyRaw, treasuryReserve],
  );
  const integrationPolicy = useMemo(
    () => buildCapitalClassIntegrationPolicy({ capitalMetrics }),
    [capitalMetrics],
  );
  const encumberedCapitalRaw = capitalMetrics.encumberedCapitalRaw;
  const freeCapitalRaw = capitalMetrics.freeCapitalRaw;

  const expectedSharesOut = useMemo(
    () =>
      computePoolLiquidityDepositSharesOut({
        amountIn: depositAmountRaw ?? 0n,
        sharesSupply: shareSupplyRaw,
        reservesBefore: reservesRaw,
      }),
    [depositAmountRaw, reservesRaw, shareSupplyRaw],
  );
  const minSharesOut = useMemo(
    () => computePoolLiquidityMinOut(expectedSharesOut, depositSlippageBps),
    [depositSlippageBps, expectedSharesOut],
  );
  const expectedAmountOut = useMemo(
    () =>
      computePoolLiquidityRedeemAmountOut({
        sharesIn: redeemSharesRaw ?? 0n,
        sharesSupply: shareSupplyRaw,
        reservesBefore: reservesRaw,
        encumberedCapital: encumberedCapitalRaw,
      }),
    [encumberedCapitalRaw, redeemSharesRaw, reservesRaw, shareSupplyRaw],
  );
  const minAmountOut = useMemo(
    () => computePoolLiquidityMinOut(expectedAmountOut, redeemSlippageBps),
    [expectedAmountOut, redeemSlippageBps],
  );
  const positionUnderlyingRaw = useMemo(
    () =>
      computePoolLiquidityRedeemAmountOut({
        sharesIn: userSharesRaw,
        sharesSupply: shareSupplyRaw,
        reservesBefore: reservesRaw,
        encumberedCapital: encumberedCapitalRaw,
      }),
    [encumberedCapitalRaw, userSharesRaw, reservesRaw, shareSupplyRaw],
  );
  const walletPosition = useMemo<WalletPoolPositionSummary | null>(() => {
    if (!walletAddress) return null;
    return buildWalletPoolPositionSummary({
      ownerAddress: walletAddress,
      membership,
      capitalMetrics,
      shareBalanceRaw: userSharesRaw,
      shareSupplyRaw,
      coverageClaims,
      rewardClaims,
    });
  }, [
    capitalMetrics,
    coverageClaims,
    membership,
    rewardClaims,
    shareSupplyRaw,
    userSharesRaw,
    walletAddress,
  ]);
  const activeRedemptionMode = capitalMetrics.redemptionMode;
  const activeClaimMode = capitalMetrics.claimMode;
  const activeImpaired = capitalMetrics.impaired;

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      clearProtocolDiscoveryCache();
      const [pools, terms, liquidityConfigs, riskConfigs, capitalClasses] = await Promise.all([
        listPools({ connection, search: null }),
        listPoolTerms({ connection, poolAddress, search: null }),
        listPoolLiquidityConfigs({ connection, poolAddress, search: null }),
        listPoolRiskConfigs({ connection, poolAddress, search: null }),
        listPoolCapitalClasses({ connection, poolAddress, search: null }),
      ]);

      const nextPool = pools.find((row) => row.address === poolAddress) ?? null;
      const nextPoolTerms = terms.find((row) => row.pool === poolAddress) ?? null;
      const nextLiquidityConfig = liquidityConfigs.find((row) => row.pool === poolAddress) ?? null;
      const nextPoolRiskConfig = riskConfigs.find((row) => row.pool === poolAddress) ?? null;
      const nextPoolCapitalClass =
        capitalClasses.find(
          (row) =>
            row.pool === poolAddress &&
            (!nextLiquidityConfig?.shareMint || row.shareMint === nextLiquidityConfig.shareMint),
        ) ??
        capitalClasses.find((row) => row.pool === poolAddress) ??
        null;

      setPool(nextPool);
      setPoolTerms(nextPoolTerms);
      setLiquidityConfig(nextLiquidityConfig);
      setPoolRiskConfig(nextPoolRiskConfig);
      setPoolCapitalClass(nextPoolCapitalClass);

      if (publicKey) {
        const [memberships, claims, rewards] = await Promise.all([
          listMemberships({
            connection,
            poolAddress,
            memberAddress: publicKey.toBase58(),
            search: null,
          }),
          listCoverageClaims({
            connection,
            poolAddress,
            memberAddress: publicKey.toBase58(),
            claimantAddress: publicKey.toBase58(),
            search: null,
          }),
          listRewardClaims({
            connection,
            poolAddress,
            memberAddress: publicKey.toBase58(),
            claimantAddress: publicKey.toBase58(),
            search: null,
          }),
        ]);
        setMembership(memberships.find((row) => row.member === publicKey.toBase58() && row.pool === poolAddress) ?? null);
        setCoverageClaims(claims);
        setRewardClaims(rewards);
      } else {
        setMembership(null);
        setCoverageClaims([]);
        setRewardClaims([]);
      }

      const reserveRows = nextPoolTerms
        ? await listPoolTreasuryReserves({
            connection,
            poolAddress,
            paymentMint: nextPoolTerms.payoutAssetMint,
            search: null,
          })
        : [];
      const nextTreasuryReserve =
        nextPoolTerms
          ? reserveRows.find(
              (row) => row.pool === poolAddress && row.paymentMint === nextPoolTerms.payoutAssetMint,
            ) ?? null
          : null;
      setTreasuryReserve(nextTreasuryReserve);

      let nextPayoutDecimals = SOL_DECIMALS;
      const nextIsSolPool = nextPoolTerms?.payoutAssetMint === ZERO_PUBKEY;
      const nextPayoutMint = nextPoolTerms?.payoutAssetMint ?? null;

      if (!nextIsSolPool && nextPayoutMint) {
        try {
          const mintInfo = await connection.getAccountInfo(new PublicKey(nextPayoutMint), "confirmed");
          if (mintInfo?.data && mintInfo.data.length >= 45) {
            nextPayoutDecimals = mintInfo.data[44] ?? 0;
          } else {
            nextPayoutDecimals = 0;
          }
        } catch {
          nextPayoutDecimals = 0;
        }
      }
      setPayoutDecimals(nextPayoutDecimals);
      setRedemptionModeInput(nextPoolRiskConfig?.redemptionMode ?? POOL_REDEMPTION_MODE_OPEN);
      setClaimModeInput(nextPoolRiskConfig?.claimMode ?? POOL_CLAIM_MODE_OPEN);
      setImpairedInput(nextPoolRiskConfig?.impaired ?? false);
      setImpairmentAmountInput(
        nextPoolRiskConfig?.impaired
          ? formatUnits(nextTreasuryReserve?.impairedAmount ?? 0n, nextPayoutDecimals, 6)
          : "",
      );

      let nextAssetVault: PoolAssetVaultSummary | null = null;
      let nextReservesRaw = 0n;
      if (nextPool) {
        if (nextIsSolPool) {
          const poolInfo = await connection.getAccountInfo(new PublicKey(nextPool.address), "confirmed");
          if (poolInfo) {
            const minimumBalance = await connection.getMinimumBalanceForRentExemption(poolInfo.data.length);
            const withdrawable = BigInt(poolInfo.lamports) - BigInt(minimumBalance);
            nextReservesRaw = withdrawable > 0n ? withdrawable : 0n;
          }
        } else if (nextPayoutMint) {
          const vaults = await listPoolAssetVaults({ connection, poolAddress, search: null });
          nextAssetVault = vaults.find(
            (vault) => vault.pool === poolAddress && vault.payoutMint === nextPayoutMint && vault.active,
          ) ?? null;
          if (nextAssetVault?.vaultTokenAccount) {
            try {
              const vaultBalance = await connection.getTokenAccountBalance(
                new PublicKey(nextAssetVault.vaultTokenAccount),
                "confirmed",
              );
              nextReservesRaw = BigInt(vaultBalance.value.amount);
            } catch {
              nextReservesRaw = 0n;
            }
          }
        }
      }
      setAssetVault(nextAssetVault);
      setReservesRaw(nextReservesRaw);

      let nextShareDecimals = nextIsSolPool ? SOL_DECIMALS : nextPayoutDecimals;
      let nextShareSupplyRaw = 0n;
      let nextUserSharesRaw = 0n;

      if (nextLiquidityConfig?.shareMint) {
        try {
          const supply = await connection.getTokenSupply(new PublicKey(nextLiquidityConfig.shareMint), "confirmed");
          nextShareDecimals = supply.value.decimals;
          nextShareSupplyRaw = BigInt(supply.value.amount);
        } catch {
          nextShareSupplyRaw = 0n;
        }

        if (publicKey) {
          try {
            const shareAta = getAssociatedTokenAddressSync(
              new PublicKey(nextLiquidityConfig.shareMint),
              publicKey,
            );
            const userShareBalance = await connection.getTokenAccountBalance(shareAta, "confirmed");
            nextUserSharesRaw = BigInt(userShareBalance.value.amount);
          } catch {
            nextUserSharesRaw = 0n;
          }
        }
      }
      setShareDecimals(nextShareDecimals);
      setShareSupplyRaw(nextShareSupplyRaw);
      setUserSharesRaw(nextUserSharesRaw);

      if (publicKey && nextPayoutMint && nextPayoutMint !== ZERO_PUBKEY) {
        const nextUserAccounts = await listWalletTokenAccountsForMint({
          connection,
          owner: publicKey.toBase58(),
          mint: nextPayoutMint,
          search: null,
        });
        setUserPayoutTokenAccounts(nextUserAccounts);
        setSelectedUserPayoutTokenAccount((current) => {
          if (current && nextUserAccounts.some((row) => row.address === current)) {
            return current;
          }
          return nextUserAccounts[0]?.address ?? "";
        });
      } else {
        setUserPayoutTokenAccounts([]);
        setSelectedUserPayoutTokenAccount("");
      }

      if (nextPool) {
        try {
          const byPool = await listPoolDefiMetrics({ connection, pools: [nextPool] });
          setPoolMetrics(byPool[nextPool.address] ?? null);
        } catch {
          setPoolMetrics(null);
        }
      } else {
        setPoolMetrics(null);
      }

      setLastUpdatedAt(Date.now());
    } catch (cause) {
      setError(
        formatRpcError(cause, {
          fallback: "Failed to load pool liquidity state.",
          rpcEndpoint: connection.rpcEndpoint,
        }),
      );
    } finally {
      setLoading(false);
    }
  }, [connection, poolAddress, publicKey]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const submitTx = useCallback(
    async (
      action: string,
      buildTx: (recentBlockhash: string) => Promise<ReturnType<typeof buildDepositPoolLiquiditySolTx>>,
    ) => {
      if (!publicKey) return;

      setBusyAction(action);
      setStatus("");
      setStatusTone(null);
      setTxSig("");
      try {
        const latestBlockhash = await connection.getLatestBlockhash("confirmed");
        const tx = await buildTx(latestBlockhash.blockhash);
        const signature = await sendTransaction(tx, connection);
        const confirmation = await connection.confirmTransaction(
          {
            signature,
            blockhash: latestBlockhash.blockhash,
            lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
          },
          "confirmed",
        );
        if (confirmation.value.err) {
          throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
        }
        setTxSig(signature);
        setStatusTone("ok");
        setStatus(`${action} confirmed on-chain.`);
        clearProtocolDiscoveryCache();
        await refresh();
      } catch (cause) {
        setStatusTone("error");
        setStatus(
          formatRpcError(cause, {
            fallback: `${action} failed. Please retry.`,
            rpcEndpoint: connection.rpcEndpoint,
          }),
        );
      } finally {
        setBusyAction(null);
      }
    },
    [connection, publicKey, refresh, sendTransaction],
  );

  const enableGuard = useMemo(() => {
    if (!connected || !publicKey) return "Connect wallet to enable pool liquidity.";
    if (!isAuthority) return "Only the pool authority wallet can enable liquidity.";
    const parsed = parseUnits(initialAmountInput, payoutDecimals);
    if (!parsed || parsed <= 0n) return "Initial deposit must be greater than zero.";
    if (!isSolPool && !selectedUserPayoutTokenAccount) return "Select an SPL payout token account.";
    return "";
  }, [connected, initialAmountInput, isAuthority, isSolPool, payoutDecimals, publicKey, selectedUserPayoutTokenAccount]);

  const depositGuard = useMemo(() => {
    if (!connected || !publicKey) return "Connect wallet to deposit liquidity.";
    if (!liquidityConfig) return "Liquidity is not enabled yet.";
    const parsed = depositAmountRaw;
    if (!parsed || parsed <= 0n) return "Deposit amount must be greater than zero.";
    if (expectedSharesOut <= 0n) return "Deposit preview resolves to zero shares; increase amount.";
    if (!isSolPool && !selectedUserPayoutTokenAccount) return "Select an SPL payout token account.";
    return "";
  }, [connected, depositAmountRaw, expectedSharesOut, isSolPool, liquidityConfig, publicKey, selectedUserPayoutTokenAccount]);

  const redeemGuard = useMemo(() => {
    if (!connected || !publicKey) return "Connect wallet to redeem shares.";
    if (!liquidityConfig) return "Liquidity is not enabled yet.";
    if (activeRedemptionMode === POOL_REDEMPTION_MODE_QUEUE_ONLY) {
      return "Pool redemptions are queue-only right now.";
    }
    if (activeRedemptionMode === POOL_REDEMPTION_MODE_PAUSED) {
      return "Pool redemptions are paused right now.";
    }
    const parsed = redeemSharesRaw;
    if (!parsed || parsed <= 0n) return "Redeem shares must be greater than zero.";
    if (parsed > userSharesRaw) return "Redeem shares cannot exceed your balance.";
    if (expectedAmountOut <= 0n) return "Redeem preview resolves to zero payout; increase shares.";
    if (!isSolPool && !selectedUserPayoutTokenAccount) return "Select an SPL payout token account.";
    return "";
  }, [
    connected,
    expectedAmountOut,
    activeRedemptionMode,
    isSolPool,
    liquidityConfig,
    publicKey,
    redeemSharesRaw,
    selectedUserPayoutTokenAccount,
    userSharesRaw,
  ]);
  const riskGuard = useMemo(() => {
    if (!connected || !publicKey) return "Connect wallet to update risk controls.";
    if (!isAuthority) return "Only the pool authority wallet can update risk controls here.";
    if (!poolTerms) return "Pool terms are still loading.";
    if (impairedInput && impairmentAmountRaw == null) {
      return "Enter a valid impairment amount or clear the impairment flag.";
    }
    return "";
  }, [connected, impairmentAmountRaw, impairedInput, isAuthority, poolTerms, publicKey]);

  const selectedUserPayoutBalanceRaw = useMemo(() => {
    const account = userPayoutTokenAccounts.find((row) => row.address === selectedUserPayoutTokenAccount);
    return account ? BigInt(account.amount) : 0n;
  }, [selectedUserPayoutTokenAccount, userPayoutTokenAccounts]);

  async function onEnableLiquidity() {
    if (!publicKey || !poolTerms || enableGuard) return;
    const initialAmountRaw = parseUnits(initialAmountInput, payoutDecimals);
    if (!initialAmountRaw || initialAmountRaw <= 0n) return;

    await submitTx("Enable liquidity", async (recentBlockhash) => {
      if (poolTerms.payoutAssetMint === ZERO_PUBKEY) {
        return buildInitializePoolLiquiditySolTx({
          authority: publicKey,
          poolAddress: new PublicKey(poolAddress),
          recentBlockhash,
          initialLamports: initialAmountRaw,
        });
      }
      return buildInitializePoolLiquiditySplTx({
        authority: publicKey,
        poolAddress: new PublicKey(poolAddress),
        payoutMint: new PublicKey(poolTerms.payoutAssetMint),
        authorityPayoutTokenAccount: new PublicKey(selectedUserPayoutTokenAccount),
        recentBlockhash,
        initialAmount: initialAmountRaw,
      });
    });
  }

  async function onToggleDeposits(nextEnabled: boolean) {
    if (!publicKey || !pool || !liquidityConfig) return;
    await submitTx(nextEnabled ? "Enable deposits" : "Disable deposits", async (recentBlockhash) =>
      buildSetPoolLiquidityEnabledTx({
        authority: publicKey,
        poolAddress: new PublicKey(pool.address),
        recentBlockhash,
        enabled: nextEnabled,
      }));
  }

  async function onSaveRiskControls() {
    if (!publicKey || !poolTerms || riskGuard) return;
    await submitTx("Update risk controls", async (recentBlockhash) =>
      buildSetPoolRiskControlsTx({
        authority: publicKey,
        poolAddress: new PublicKey(poolAddress),
        payoutMint: new PublicKey(poolTerms.payoutAssetMint),
        recentBlockhash,
        redemptionMode: redemptionModeInput,
        claimMode: claimModeInput,
        impaired: impairedInput,
        impairmentAmount: impairedInput ? (impairmentAmountRaw ?? 0n) : 0n,
      }));
  }

  async function onDeposit() {
    if (!publicKey || !poolTerms || depositGuard) return;
    const amountIn = depositAmountRaw;
    if (!amountIn || amountIn <= 0n) return;

    await submitTx("Deposit liquidity", async (recentBlockhash) => {
      if (poolTerms.payoutAssetMint === ZERO_PUBKEY) {
        return buildDepositPoolLiquiditySolTx({
          depositor: publicKey,
          poolAddress: new PublicKey(poolAddress),
          recentBlockhash,
          amountIn,
          minSharesOut,
        });
      }
      return buildDepositPoolLiquiditySplTx({
        depositor: publicKey,
        poolAddress: new PublicKey(poolAddress),
        payoutMint: new PublicKey(poolTerms.payoutAssetMint),
        depositorPayoutTokenAccount: new PublicKey(selectedUserPayoutTokenAccount),
        recentBlockhash,
        amountIn,
        minSharesOut,
      });
    });
  }

  async function onRedeem() {
    if (!publicKey || !poolTerms || redeemGuard) return;
    const sharesIn = redeemSharesRaw;
    if (!sharesIn || sharesIn <= 0n) return;

    await submitTx("Redeem liquidity", async (recentBlockhash) => {
      if (poolTerms.payoutAssetMint === ZERO_PUBKEY) {
        return buildRedeemPoolLiquiditySolTx({
          redeemer: publicKey,
          poolAddress: new PublicKey(poolAddress),
          recentBlockhash,
          sharesIn,
          minAmountOut,
        });
      }
      return buildRedeemPoolLiquiditySplTx({
        redeemer: publicKey,
        poolAddress: new PublicKey(poolAddress),
        payoutMint: new PublicKey(poolTerms.payoutAssetMint),
        redeemerPayoutTokenAccount: new PublicKey(selectedUserPayoutTokenAccount),
        recentBlockhash,
        sharesIn,
        minAmountOut,
      });
    });
  }

  return (
    <section className={embedded ? "space-y-4" : "surface-card space-y-4"}>
      {!embedded ? (
        <div className="space-y-1">
          <h2 className="hero-title">Pool Liquidity</h2>
          <p className="hero-copy">Enable PoolShare liquidity, deposit reserves, and redeem shares.</p>
        </div>
      ) : null}

      <section className="surface-card-soft space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Waves className="h-4 w-4 text-[var(--accent-strong)]" />
            <p className="metric-label">Liquidity state</p>
          </div>
          <button
            type="button"
            className="secondary-button inline-flex items-center gap-1.5"
            onClick={() => void refresh()}
            disabled={loading || Boolean(busyAction)}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className={`status-pill ${connected ? "status-ok" : "status-off"}`}>
            {connected ? "Wallet connected" : "Wallet disconnected"}
          </span>
          <span className={`status-pill ${isAuthority ? "status-ok" : "status-off"}`}>
            {isAuthority ? "Authority wallet" : "Non-authority wallet"}
          </span>
          <span className={`status-pill ${liquidityConfig ? "status-ok" : "status-off"}`}>
            {liquidityConfig ? "Liquidity enabled" : "Liquidity not enabled"}
          </span>
          {liquidityConfig ? (
            <span className={`status-pill ${liquidityConfig.depositsEnabled ? "status-ok" : "status-error"}`}>
              Deposits {liquidityConfig.depositsEnabled ? "enabled" : "disabled"}
            </span>
          ) : null}
          <span
            className={`status-pill ${
              activeRedemptionMode === POOL_REDEMPTION_MODE_OPEN ? "status-ok" : "status-error"
            }`}
          >
            Redemptions {formatRedemptionMode(activeRedemptionMode)}
          </span>
          <span className={`status-pill ${activeClaimMode === POOL_CLAIM_MODE_OPEN ? "status-ok" : "status-error"}`}>
            Claims {formatClaimMode(activeClaimMode)}
          </span>
          <span className={`status-pill ${activeImpaired ? "status-error" : "status-ok"}`}>
            {activeImpaired ? "Impaired capital booked" : "No impairment booked"}
          </span>
          <span className={`status-pill ${capitalMetrics.transitionalSharePath ? "status-off" : "status-ok"}`}>
            {capitalMetrics.transitionalSharePath ? "Transitional share path" : "Capital class registered"}
          </span>
          {walletPosition ? (
            <span
              className={`status-pill ${
                walletPosition.memberPositionActive ? "status-ok" : "status-off"
              }`}
            >
              {walletPosition.memberPositionActive ? "Active member position" : "No active member position"}
            </span>
          ) : null}
        </div>

        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <div className="monitor-row">
            <span>TVL</span>
            <span>{formatPoolTvl(poolMetrics?.tvl ?? null)}</span>
          </div>
          <div className="monitor-row">
            <span>Est. APY (30d)</span>
            <span>{formatApyBps(poolMetrics?.apy ?? null)}</span>
          </div>
          <div className="monitor-row">
            <span>Reference NAV</span>
            <span>{formatReferenceNav(capitalMetrics.referenceNavScaled, payoutDecimals)} {payoutSymbol}</span>
          </div>
          <div className="monitor-row">
            <span>Your position</span>
            <span>{formatUnits(positionUnderlyingRaw, payoutDecimals, 6)} {payoutSymbol}</span>
          </div>
          <div className="monitor-row">
            <span>Pending claims</span>
            <span>{walletPosition?.pendingCoverageClaimCount ?? 0}</span>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          <div className="monitor-row">
            <span>Reserves</span>
            <span>{formatUnits(reservesRaw, payoutDecimals, 6)} {payoutSymbol}</span>
          </div>
          <div className="monitor-row">
            <span>Encumbered capital</span>
            <span>{formatUnits(encumberedCapitalRaw, payoutDecimals, 6)} {payoutSymbol}</span>
          </div>
          <div className="monitor-row">
            <span>Free capital</span>
            <span>{formatUnits(freeCapitalRaw, payoutDecimals, 6)} {payoutSymbol}</span>
          </div>
          <div className="monitor-row">
            <span>Utilization</span>
            <span>{formatUtilizationBps(capitalMetrics.utilizationBps)}</span>
          </div>
          <div className="monitor-row">
            <span>Available redemption</span>
            <span>{formatUnits(capitalMetrics.availableRedemptionRaw, payoutDecimals, 6)} {payoutSymbol}</span>
          </div>
          <div className="monitor-row">
            <span>Class mode</span>
            <span>{formatCapitalClassMode(capitalMetrics.classMode)}</span>
          </div>
          <div className="monitor-row">
            <span>Transfer mode</span>
            <span>{formatTransferMode(capitalMetrics.transferMode)}</span>
          </div>
          <div className="monitor-row">
            <span>Integration policy</span>
            <span>{formatIntegrationMode(integrationPolicy)}</span>
          </div>
          <div className="monitor-row">
            <span>Capital path</span>
            <span>{capitalMetrics.transitionalSharePath ? "Compatibility share mint" : "Registered class"}</span>
          </div>
          <div className="monitor-row">
            <span>Total shares</span>
            <span>{formatUnits(shareSupplyRaw, shareDecimals, 6)}</span>
          </div>
          <div className="monitor-row">
            <span>Your shares</span>
            <span>{formatUnits(userSharesRaw, shareDecimals, 6)}</span>
          </div>
          <div className="monitor-row">
            <span>Distribution locked</span>
            <span>{formatUnits(capitalMetrics.distributionLockedRaw, payoutDecimals, 6)} {payoutSymbol}</span>
          </div>
          <div className="monitor-row">
            <span>Restrictions</span>
            <span>{capitalMetrics.restricted ? "Restricted" : "Open"} / {capitalMetrics.ringFenced ? "Ring-fenced" : "Shared"}</span>
          </div>
          <div className="monitor-row">
            <span>Redemption mode</span>
            <span>{formatRedemptionMode(activeRedemptionMode)}</span>
          </div>
          <div className="monitor-row">
            <span>Claim intake</span>
            <span>{formatClaimMode(activeClaimMode)}</span>
          </div>
          <div className="monitor-row">
            <span>Member status</span>
            <span>
              {membership?.status === MEMBERSHIP_STATUS_ACTIVE
                ? "Active"
                : membership
                  ? `Status ${membership.status}`
                  : "No membership"}
            </span>
          </div>
          <div className="monitor-row">
            <span>Claim exposure</span>
            <span>{formatUnits(walletPosition?.pendingCoverageExposureRaw ?? 0n, payoutDecimals, 6)} {payoutSymbol}</span>
          </div>
          <div className="monitor-row">
            <span>Pending rewards</span>
            <span>{walletPosition?.pendingRewardClaimCount ?? 0}</span>
          </div>
          <div className="monitor-row">
            <span>Reward payouts</span>
            <span>{formatUnits(walletPosition?.pendingRewardPayoutRaw ?? 0n, payoutDecimals, 6)} {payoutSymbol}</span>
          </div>
          <div className="monitor-row">
            <span>Wallet redeemable</span>
            <span>{formatUnits(walletPosition?.currentlyRedeemableRaw ?? 0n, payoutDecimals, 6)} {payoutSymbol}</span>
          </div>
        </div>

        <p className="field-help">
          Pool: {shortAddress(poolAddress)} | Payout: {poolTerms?.payoutAssetMint ?? "unknown"} | Vault: {assetVault?.vaultTokenAccount ?? "n/a"}
        </p>
        <p className="field-help">
          Redeem previews and reference NAV use free capital after treasury reserves, redistribution holds, coverage-case reserves, and impairments.
        </p>
        {capitalMetrics.transitionalSharePath ? (
          <p className="field-help">
            This pool is still on the transitional compatibility share path. Registering a capital class makes NAV, restriction, and queue semantics explicit without replacing the current share mint.
          </p>
        ) : (
          <p className="field-help">
            Class mode {formatCapitalClassMode(capitalMetrics.classMode)} | transfer {formatTransferMode(capitalMetrics.transferMode)} | vintage {capitalMetrics.vintageIndex ?? "n/a"} | queue {capitalMetrics.redemptionQueueEnabled ? "enabled" : "disabled"}
          </p>
        )}
        {walletPosition ? (
          <p className="field-help">
            Wallet view: {walletPosition.capitalPositionActive ? "capital position active" : "no capital balance"} | pending claims {walletPosition.pendingCoverageClaimCount} | pending rewards {walletPosition.pendingRewardClaimCount}
          </p>
        ) : null}
        <p className="field-help">
          Integration boundaries: {formatIntegrationMode(integrationPolicy)} | reference NAV is authoritative | market price is not authoritative | collateral reuse disabled | external yield adapters are downstream-only.
        </p>
        {poolRiskConfig ? (
          <p className="field-help">
            Risk controls last updated by {shortAddress(poolRiskConfig.updatedBy)} at{" "}
            {new Date(Number(poolRiskConfig.updatedAt) * 1000).toLocaleString()}.
          </p>
        ) : null}
        {lastUpdatedAt ? <p className="field-help">Updated {new Date(lastUpdatedAt).toLocaleTimeString()}</p> : null}
      </section>

      {!liquidityConfig ? (
        isAuthority ? (
          <section className="surface-card-soft space-y-3">
            <p className="metric-label">Enable Liquidity</p>
            <p className="field-help">
              Enabling liquidity requires zero existing TVL and a non-zero initial deposit.
            </p>
            <label className="field-label" htmlFor="liquidity-initial-amount">Initial deposit ({payoutSymbol})</label>
            <input
              id="liquidity-initial-amount"
              className="field-input"
              value={initialAmountInput}
              onChange={(event) => setInitialAmountInput(event.target.value)}
              placeholder={isSolPool ? "1.0" : "100.0"}
            />
            {!isSolPool ? (
              <>
                <label className="field-label" htmlFor="liquidity-init-token-account">
                  Payout token account ({payoutDecimals} decimals)
                </label>
                <select
                  id="liquidity-init-token-account"
                  className="field-input"
                  value={selectedUserPayoutTokenAccount}
                  onChange={(event) => setSelectedUserPayoutTokenAccount(event.target.value)}
                >
                  <option value="">Select token account</option>
                  {userPayoutTokenAccounts.map((row) => (
                    <option key={row.address} value={row.address}>
                      {shortAddress(row.address)} | Balance {formatUnits(BigInt(row.amount), row.decimals, 4)}
                    </option>
                  ))}
                </select>
                <p className="field-help">
                  Wallet payout balance: {formatUnits(selectedUserPayoutBalanceRaw, payoutDecimals, 6)} SPL
                </p>
              </>
            ) : null}
            {enableGuard ? <p className="field-help">{enableGuard}</p> : null}
            <button
              type="button"
              className="action-button"
              onClick={() => void onEnableLiquidity()}
              disabled={Boolean(enableGuard) || Boolean(busyAction)}
            >
              {busyAction === "Enable liquidity" ? "Enabling..." : "Enable liquidity"}
            </button>
          </section>
        ) : (
          <section className="surface-card-soft">
            <p className="field-help">Liquidity not enabled for this plan.</p>
          </section>
        )
      ) : (
        <>
          {isAuthority ? (
            <section className="surface-card-soft space-y-3">
              <p className="metric-label">Deposit toggle</p>
              <p className="field-help">Disabling deposits blocks new deposits but keeps redemptions available.</p>
              <button
                type="button"
                className="secondary-button"
                onClick={() => void onToggleDeposits(!liquidityConfig.depositsEnabled)}
                disabled={Boolean(busyAction)}
              >
                {busyAction === "Enable deposits" || busyAction === "Disable deposits"
                  ? "Updating..."
                  : liquidityConfig.depositsEnabled
                    ? "Disable deposits"
                    : "Enable deposits"}
              </button>
            </section>
          ) : null}

          {isAuthority ? (
            <section className="surface-card-soft space-y-3">
              <p className="metric-label">Risk controls</p>
              <p className="field-help">
                Queue or pause redemptions, pause claim intake, and book impairment against free capital.
              </p>
              <label className="field-label" htmlFor="liquidity-redemption-mode">Redemption mode</label>
              <select
                id="liquidity-redemption-mode"
                className="field-input"
                value={String(redemptionModeInput)}
                onChange={(event) => setRedemptionModeInput(Number(event.target.value))}
              >
                <option value={String(POOL_REDEMPTION_MODE_OPEN)}>Open</option>
                <option value={String(POOL_REDEMPTION_MODE_QUEUE_ONLY)}>Queue only</option>
                <option value={String(POOL_REDEMPTION_MODE_PAUSED)}>Paused</option>
              </select>
              <label className="field-label" htmlFor="liquidity-claim-mode">Claim intake</label>
              <select
                id="liquidity-claim-mode"
                className="field-input"
                value={String(claimModeInput)}
                onChange={(event) => setClaimModeInput(Number(event.target.value))}
              >
                <option value={String(POOL_CLAIM_MODE_OPEN)}>Open</option>
                <option value={String(POOL_CLAIM_MODE_PAUSED)}>Paused</option>
              </select>
              <label className="inline-flex items-center gap-2 text-sm text-[var(--text-primary)]">
                <input
                  type="checkbox"
                  checked={impairedInput}
                  onChange={(event) => setImpairedInput(event.target.checked)}
                />
                Mark pool as impaired
              </label>
              {impairedInput ? (
                <>
                  <label className="field-label" htmlFor="liquidity-impairment-amount">
                    Impairment amount ({payoutSymbol})
                  </label>
                  <input
                    id="liquidity-impairment-amount"
                    className="field-input"
                    value={impairmentAmountInput}
                    onChange={(event) => setImpairmentAmountInput(event.target.value)}
                    placeholder={isSolPool ? "0.25" : "25.0"}
                  />
                </>
              ) : null}
              {riskGuard ? <p className="field-help">{riskGuard}</p> : null}
              <button
                type="button"
                className="secondary-button"
                onClick={() => void onSaveRiskControls()}
                disabled={Boolean(riskGuard) || Boolean(busyAction)}
              >
                {busyAction === "Update risk controls" ? "Updating..." : "Update risk controls"}
              </button>
            </section>
          ) : null}

          <section className="surface-card-soft space-y-3">
            <p className="metric-label">Deposit liquidity</p>
            <label className="field-label" htmlFor="liquidity-deposit-amount">Amount in ({payoutSymbol})</label>
            <input
              id="liquidity-deposit-amount"
              className="field-input"
              value={depositAmountInput}
              onChange={(event) => setDepositAmountInput(event.target.value)}
              placeholder={isSolPool ? "0.25" : "25.0"}
            />
            {!isSolPool ? (
              <>
                <label className="field-label" htmlFor="liquidity-deposit-token-account">Payout token account</label>
                <select
                  id="liquidity-deposit-token-account"
                  className="field-input"
                  value={selectedUserPayoutTokenAccount}
                  onChange={(event) => setSelectedUserPayoutTokenAccount(event.target.value)}
                >
                  <option value="">Select token account</option>
                  {userPayoutTokenAccounts.map((row) => (
                    <option key={row.address} value={row.address}>
                      {shortAddress(row.address)} | Balance {formatUnits(BigInt(row.amount), row.decimals, 4)}
                    </option>
                  ))}
                </select>
              </>
            ) : null}
            <label className="field-label" htmlFor="liquidity-deposit-slippage">Slippage tolerance (%)</label>
            <input
              id="liquidity-deposit-slippage"
              className="field-input"
              value={depositSlippageInput}
              onChange={(event) => setDepositSlippageInput(event.target.value)}
            />
            <p className="field-help">
              Expected shares out: {formatUnits(expectedSharesOut, shareDecimals, 6)} | Min shares out: {formatUnits(minSharesOut, shareDecimals, 6)}
            </p>
            {depositGuard ? <p className="field-help">{depositGuard}</p> : null}
            <button
              type="button"
              className="action-button"
              onClick={() => void onDeposit()}
              disabled={Boolean(depositGuard) || Boolean(busyAction) || !liquidityConfig.depositsEnabled}
            >
              {busyAction === "Deposit liquidity" ? "Depositing..." : "Deposit liquidity"}
            </button>
          </section>

          <section className="surface-card-soft space-y-3">
            <p className="metric-label">Redeem liquidity</p>
            <label className="field-label" htmlFor="liquidity-redeem-shares">Shares in</label>
            <input
              id="liquidity-redeem-shares"
              className="field-input"
              value={redeemSharesInput}
              onChange={(event) => setRedeemSharesInput(event.target.value)}
              placeholder="0.0"
            />
            <label className="field-label" htmlFor="liquidity-redeem-slippage">Slippage tolerance (%)</label>
            <input
              id="liquidity-redeem-slippage"
              className="field-input"
              value={redeemSlippageInput}
              onChange={(event) => setRedeemSlippageInput(event.target.value)}
            />
            <p className="field-help">
              Expected payout: {formatUnits(expectedAmountOut, payoutDecimals, 6)} {payoutSymbol} | Min payout: {formatUnits(minAmountOut, payoutDecimals, 6)} {payoutSymbol}
            </p>
            {redeemGuard ? <p className="field-help">{redeemGuard}</p> : null}
            <button
              type="button"
              className="secondary-button"
              onClick={() => void onRedeem()}
              disabled={Boolean(redeemGuard) || Boolean(busyAction)}
            >
              {busyAction === "Redeem liquidity" ? "Redeeming..." : "Redeem liquidity"}
            </button>
          </section>
        </>
      )}

      {error ? <p className="field-error">{error}</p> : null}
      {status ? (
        <section className="surface-card-soft space-y-2">
          <span className={`status-pill ${statusTone === "error" ? "status-error" : "status-ok"}`}>
            {statusTone === "error" ? "Action failed" : "Action confirmed"}
          </span>
          <p className={statusTone === "error" ? "field-error" : "field-help"}>{status}</p>
          {txSig ? (
            <a className="secondary-button inline-flex w-fit" href={toExplorerLink(txSig)} target="_blank" rel="noreferrer">
              View transaction
            </a>
          ) : null}
        </section>
      ) : null}
    </section>
  );
}
