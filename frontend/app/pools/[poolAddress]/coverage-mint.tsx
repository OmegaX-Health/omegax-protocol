// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PublicKey } from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { motion } from "framer-motion";
import { CheckCircle2, Landmark, Layers3, RefreshCw, ShieldPlus, Users, WalletCards } from "lucide-react";

import {
  buildIssuePolicyPositionTx,
  buildPayPremiumOnchainTx,
  buildCreatePolicySeriesTx,
  buildSubscribePolicySeriesTx,
  buildUpdatePolicySeriesTx,
  PLAN_MODE_PROTECTION,
  POLICY_SERIES_STATUS_ACTIVE,
  POLICY_SERIES_STATUS_PAUSED,
  SPONSOR_MODE_DIRECT,
  derivePoolAssetVaultPda,
  derivePoolTermsPda,
  getProgramId,
  hashStringTo32Hex,
  listPolicySeries,
  toExplorerLink,
  type PolicySeriesSummary,
} from "@/lib/protocol";
import { getAssociatedTokenAddress } from "@/lib/spl";
import { formatRpcError } from "@/lib/rpc-errors";

type CoverageMintProps = {
  poolAddress: string;
};

type CoverageMode = "products" | "subscribe" | "issue" | "premium";
const ENABLE_RWA_POLICY = process.env.NEXT_PUBLIC_ENABLE_RWA_POLICY === "true";

function normalize(value: string): string {
  return value.trim();
}

function isPublicKey(value: string): boolean {
  try {
    new PublicKey(normalize(value));
    return true;
  } catch {
    return false;
  }
}

function isHex32(value: string): boolean {
  return /^[0-9a-f]{64}$/i.test(normalize(value).replace(/^0x/i, ""));
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

function shortAddress(value: string): string {
  if (value.length < 12) return value;
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
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

export function CoverageMint({ poolAddress }: CoverageMintProps) {
  const { connection } = useConnection();
  const { connected, publicKey, sendTransaction } = useWallet();
  const searchParams = useSearchParams();

  const initialMode = useMemo<CoverageMode>(() => {
    const fromQuery = normalize(searchParams.get("mode") ?? "").toLowerCase();
    if (fromQuery === "subscribe") return "subscribe";
    if (fromQuery === "issue") return "issue";
    if (fromQuery === "premium") return "premium";
    return "products";
  }, [searchParams]);

  const [mode, setMode] = useState<CoverageMode>(initialMode);
  const [products, setProducts] = useState<PolicySeriesSummary[]>([]);
  const [selectedProductAddress, setSelectedProductAddress] = useState("");
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [error, setError] = useState("");

  const [productIdSeed, setProductIdSeed] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [metadataUri, setMetadataUri] = useState("https://protocol.omegax.health/coverage/template");
  const [termsHashOverride, setTermsHashOverride] = useState("");
  const [durationMonths, setDurationMonths] = useState("12");
  const [premiumCadenceDays, setPremiumCadenceDays] = useState("30");
  const [premiumGraceDays, setPremiumGraceDays] = useState("14");
  const [premiumAmountBaseUnits, setPremiumAmountBaseUnits] = useState("1000000");
  const [productActive, setProductActive] = useState(true);

  const [subscribeStartDate, setSubscribeStartDate] = useState(todayDateInput());
  const [issueMember, setIssueMember] = useState("");
  const [issueStartDate, setIssueStartDate] = useState(todayDateInput());
  const [premiumPeriodIndex, setPremiumPeriodIndex] = useState("0");

  const [busyAction, setBusyAction] = useState("");
  const [status, setStatus] = useState("");
  const [statusTone, setStatusTone] = useState<"ok" | "error" | null>(null);
  const [signature, setSignature] = useState("");

  const selectedProduct = useMemo(
    () => products.find((entry) => entry.address === selectedProductAddress) ?? null,
    [products, selectedProductAddress],
  );

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    if (!selectedProduct) return;
    setDisplayName(selectedProduct.displayName);
    setMetadataUri(selectedProduct.metadataUri || "https://protocol.omegax.health/coverage/template");
    setDurationMonths((Number(selectedProduct.durationSecs) / (30 * 86_400)).toFixed(2));
    setPremiumCadenceDays((Number(selectedProduct.premiumDueEverySecs) / 86_400).toFixed(2));
    setPremiumGraceDays((Number(selectedProduct.premiumGraceSecs) / 86_400).toFixed(2));
    setPremiumAmountBaseUnits(selectedProduct.premiumAmount.toString());
    setProductActive(selectedProduct.status === POLICY_SERIES_STATUS_ACTIVE);
  }, [selectedProduct]);

  const refreshProducts = useCallback(async () => {
    if (!isPublicKey(poolAddress)) return;
    setLoadingProducts(true);
    setError("");
    try {
      const rows = await listPolicySeries({
        connection,
        poolAddress,
        activeOnly: false,
      });
      setProducts(rows);
      if (!selectedProductAddress && rows[0]) {
        setSelectedProductAddress(rows[0].address);
      }
      if (selectedProductAddress && !rows.some((row) => row.address === selectedProductAddress)) {
        setSelectedProductAddress(rows[0]?.address ?? "");
      }
    } catch (cause) {
      setError(
        formatRpcError(cause, {
          fallback: "Failed to load coverage products.",
          rpcEndpoint: connection.rpcEndpoint,
        }),
      );
    } finally {
      setLoadingProducts(false);
    }
  }, [connection, poolAddress, selectedProductAddress]);

  useEffect(() => {
    void refreshProducts();
  }, [refreshProducts]);

  const openCoverageDiagnostics = useCallback(() => {
    const diagnostics = document.getElementById("coverage-diagnostics");
    if (diagnostics instanceof HTMLDetailsElement) {
      diagnostics.open = true;
    }
    diagnostics?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const poolGuard = useMemo(() => {
    if (!isPublicKey(poolAddress)) return "Pool address is invalid.";
    return "";
  }, [poolAddress]);

  const registerGuard = useMemo(() => {
    if (poolGuard) return poolGuard;
    if (!connected || !publicKey) return "Connect wallet to register coverage products.";
    if (!normalize(productIdSeed)) return "Product ID seed is required.";
    if (!normalize(displayName)) return "Product display name is required.";
    if (parseMonthsToSeconds(durationMonths) <= 0n) return "Duration must be greater than zero.";
    if (parseDaysToSeconds(premiumCadenceDays) <= 0n) return "Premium cadence must be greater than zero.";
    const parsedPremiumGraceDays = Number.parseFloat(normalize(premiumGraceDays));
    if (!Number.isFinite(parsedPremiumGraceDays) || parsedPremiumGraceDays < 0) {
      return "Premium grace must be zero or greater.";
    }
    try {
      if (BigInt(normalize(premiumAmountBaseUnits)) <= 0n) return "Premium amount must be greater than zero.";
    } catch {
      return "Premium amount must be an integer in base units.";
    }
    if (normalize(termsHashOverride) && !isHex32(termsHashOverride)) {
      return "Terms hash override must be 64-char hex.";
    }
    return "";
  }, [
    connected,
    displayName,
    durationMonths,
    poolGuard,
    premiumAmountBaseUnits,
    premiumCadenceDays,
    premiumGraceDays,
    productIdSeed,
    publicKey,
    termsHashOverride,
  ]);

  const updateGuard = useMemo(() => {
    if (registerGuard) return registerGuard;
    if (!selectedProduct) return "Select an existing product to update.";
    return "";
  }, [registerGuard, selectedProduct]);

  const subscribeGuard = useMemo(() => {
    if (poolGuard) return poolGuard;
    if (!connected || !publicKey) return "Connect wallet to subscribe.";
    if (!selectedProduct) return "Select a coverage product.";
    return "";
  }, [connected, poolGuard, publicKey, selectedProduct]);

  const issueGuard = useMemo(() => {
    if (poolGuard) return poolGuard;
    if (!connected || !publicKey) return "Connect wallet to issue coverage.";
    if (!selectedProduct) return "Select a coverage product.";
    if (!isPublicKey(issueMember)) return "Member wallet must be a valid Solana public key.";
    return "";
  }, [connected, issueMember, poolGuard, publicKey, selectedProduct]);

  const premiumGuard = useMemo(() => {
    if (poolGuard) return poolGuard;
    if (!connected || !publicKey) return "Connect wallet to pay premium.";
    if (!selectedProduct) return "Select a coverage product.";
    try {
      const amount = BigInt(normalize(premiumAmountBaseUnits));
      if (amount <= 0n) return "Premium amount must be greater than zero.";
    } catch {
      return "Premium amount must be an integer in base units.";
    }
    try {
      const period = BigInt(normalize(premiumPeriodIndex));
      if (period < 0n) return "Period index must be zero or greater.";
    } catch {
      return "Period index must be an integer.";
    }
    return "";
  }, [connected, poolGuard, premiumAmountBaseUnits, premiumPeriodIndex, publicKey, selectedProduct]);

  async function resolveTermsHash(fallbackHex = ""): Promise<string> {
    const override = normalize(termsHashOverride).replace(/^0x/i, "").toLowerCase();
    if (override) {
      if (!isHex32(override)) throw new Error("Terms hash override must be 64-char hex.");
      return override;
    }
    if (fallbackHex) return fallbackHex;
    if (!normalize(productIdSeed)) {
      throw new Error("Product ID seed is required to derive terms hash.");
    }
    return hashStringTo32Hex(
      [
        poolAddress,
        normalize(productIdSeed),
        normalize(displayName),
        normalize(metadataUri),
        normalize(premiumAmountBaseUnits),
        normalize(durationMonths),
        normalize(premiumCadenceDays),
        normalize(premiumGraceDays),
      ].join("|"),
    );
  }

  async function runTx(action: string, factory: (recentBlockhash: string) => Promise<ReturnType<typeof buildCreatePolicySeriesTx>>) {
    if (!publicKey) return;
    setBusyAction(action);
    setStatus("");
    setStatusTone(null);
    setSignature("");
    try {
      const { blockhash } = await connection.getLatestBlockhash("confirmed");
      const tx = await factory(blockhash);
      const sig = await sendTransaction(tx, connection);
      await connection.confirmTransaction(sig, "confirmed");
      setSignature(sig);
      setStatusTone("ok");
      setStatus(`${action} confirmed.`);
      await refreshProducts();
    } catch (cause) {
      setStatusTone("error");
      setStatus(
        formatRpcError(cause, {
          fallback: `${action} failed.`,
          rpcEndpoint: connection.rpcEndpoint,
        }),
      );
    } finally {
      setBusyAction("");
    }
  }

  async function onRegisterProduct() {
    if (registerGuard || !publicKey) return;
    const poolKey = new PublicKey(poolAddress);
    await runTx("Register coverage product", async (recentBlockhash) => {
      const seriesRefHashHex = await hashStringTo32Hex(normalize(productIdSeed));
      const termsHashHex = await resolveTermsHash();
      return buildCreatePolicySeriesTx({
        authority: publicKey,
        poolAddress: poolKey,
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
      });
    });
  }

  async function onUpdateProduct() {
    if (updateGuard || !publicKey || !selectedProduct) return;
    const poolKey = new PublicKey(poolAddress);
    await runTx("Update coverage product", async (recentBlockhash) => {
      const termsHashHex = await resolveTermsHash(selectedProduct.termsHashHex);
      return buildUpdatePolicySeriesTx({
        authority: publicKey,
        poolAddress: poolKey,
        seriesRefHashHex: selectedProduct.seriesRefHashHex,
        status: productActive ? POLICY_SERIES_STATUS_ACTIVE : POLICY_SERIES_STATUS_PAUSED,
        planMode: selectedProduct.planMode,
        sponsorMode: selectedProduct.sponsorMode,
        displayName,
        metadataUri,
        termsHashHex,
        durationSecs: parseMonthsToSeconds(durationMonths),
        premiumDueEverySecs: parseDaysToSeconds(premiumCadenceDays),
        premiumGraceSecs: parseDaysToSeconds(premiumGraceDays),
        premiumAmount: BigInt(normalize(premiumAmountBaseUnits)),
        termsVersion: selectedProduct.termsVersion,
        mappingVersion: selectedProduct.mappingVersion,
        recentBlockhash,
      });
    });
  }

  async function onSubscribe() {
    if (subscribeGuard || !publicKey || !selectedProduct) return;
    await runTx("Subscribe coverage product", async (recentBlockhash) =>
      buildSubscribePolicySeriesTx({
        member: publicKey,
        poolAddress: new PublicKey(poolAddress),
        seriesRefHashHex: selectedProduct.seriesRefHashHex,
        startsAtTs: dateInputToUnixTs(subscribeStartDate),
        recentBlockhash,
      }),
    );
  }

  async function onIssuePolicy() {
    if (issueGuard || !publicKey || !selectedProduct) return;
    await runTx("Issue member policy", async (recentBlockhash) =>
      buildIssuePolicyPositionTx({
        authority: publicKey,
        poolAddress: new PublicKey(poolAddress),
        member: new PublicKey(issueMember),
        seriesRefHashHex: selectedProduct.seriesRefHashHex,
        startsAtTs: dateInputToUnixTs(issueStartDate),
        recentBlockhash,
      }),
    );
  }

  async function onPayPremium() {
    if (premiumGuard || !publicKey || !selectedProduct) return;
    await runTx("Pay premium on-chain", async (recentBlockhash) => {
      const poolKey = new PublicKey(poolAddress);
      const programId = getProgramId();
      const poolTermsAddress = derivePoolTermsPda({ programId, poolAddress: poolKey });
      const poolTermsAccount = await connection.getAccountInfo(poolTermsAddress, "confirmed");
      if (!poolTermsAccount || poolTermsAccount.data.length < 73) {
        throw new Error("Pool terms account is missing or malformed.");
      }
      const payoutMint = new PublicKey(poolTermsAccount.data.slice(41, 73));
      if (payoutMint.toBase58() === "11111111111111111111111111111111") {
        throw new Error("Pool payout mint is not configured for premium payments.");
      }
      const poolAssetVaultAddress = derivePoolAssetVaultPda({
        programId,
        poolAddress: poolKey,
        payoutMint,
      });
      const poolAssetVaultAccount = await connection.getAccountInfo(poolAssetVaultAddress, "confirmed");
      if (!poolAssetVaultAccount || poolAssetVaultAccount.data.length < 104) {
        throw new Error("Pool asset vault is not configured yet.");
      }
      const poolVaultTokenAccount = new PublicKey(poolAssetVaultAccount.data.slice(72, 104));
      const payerTokenAccount = await getAssociatedTokenAddress(payoutMint, publicKey);
      return buildPayPremiumOnchainTx({
        payer: publicKey,
        poolAddress: poolKey,
        member: publicKey,
        seriesRefHashHex: selectedProduct.seriesRefHashHex,
        payoutMint,
        periodIndex: BigInt(normalize(premiumPeriodIndex)),
        amount: BigInt(normalize(premiumAmountBaseUnits)),
        payerTokenAccount,
        poolVaultTokenAccount,
        recentBlockhash,
      });
    });
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="space-y-4"
    >
      <section className="surface-card space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="status-pill status-ok inline-flex items-center gap-1.5">
            <Layers3 className="h-3.5 w-3.5" />
            Product templates + member policy positions
          </span>
          <span className="status-pill status-off">{products.length} product template{products.length === 1 ? "" : "s"}</span>
        </div>
        <p className="field-help">
          Coverage is pool-scoped: register reusable products here, then subscribe as a member or issue policies as an operator.
        </p>
      </section>

      <section className="surface-card-soft space-y-3">
        <p className="metric-label">Pathways</p>
        <div className="grid gap-3 md:grid-cols-2">
          <article className="surface-card-soft space-y-2.5">
            <div className="flex items-center gap-2">
              <span className="status-pill status-ok">DeFi Native Pathway</span>
            </div>
            <p className="field-help">
              Use on-chain product templates for member-driven subscribe flows and premium payments with transparent smart-contract settlement.
            </p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="secondary-button py-1.5 text-xs" onClick={() => setMode("products")}>
                Products
              </button>
              <button type="button" className="secondary-button py-1.5 text-xs" onClick={() => setMode("subscribe")}>
                Member Subscribe
              </button>
              <button type="button" className="secondary-button py-1.5 text-xs" onClick={() => setMode("premium")}>
                Pay Premium
              </button>
            </div>
          </article>

          {ENABLE_RWA_POLICY ? (
            <article className="surface-card-soft space-y-2.5">
              <div className="flex items-center gap-2">
                <Landmark className="h-4 w-4 text-[var(--primary)]" />
                <span className="status-pill status-off">RWA Policy Pathway</span>
              </div>
              <p className="field-help">
                Use policy templates for institution-led issuance with auditable operational controls and pooled diagnostics.
              </p>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="secondary-button py-1.5 text-xs" onClick={() => setMode("products")}>
                  Products
                </button>
                <button type="button" className="secondary-button py-1.5 text-xs" onClick={() => setMode("issue")}>
                  Operator Issue
                </button>
                <button type="button" className="secondary-button py-1.5 text-xs" onClick={openCoverageDiagnostics}>
                  Coverage Diagnostics
                </button>
              </div>
            </article>
          ) : null}
        </div>
      </section>

      <section className="surface-card-soft space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="metric-label">Coverage product registry</p>
          <button type="button" className="secondary-button inline-flex items-center gap-1.5" onClick={() => void refreshProducts()} disabled={loadingProducts}>
            <RefreshCw className={`h-3.5 w-3.5 ${loadingProducts ? "animate-spin" : ""}`} />
            {loadingProducts ? "Refreshing..." : "Refresh"}
          </button>
        </div>
        <label className="field-label block">
          Select product template
          <select
            className="field-input mt-1.5 w-full"
            value={selectedProductAddress}
            onChange={(event) => setSelectedProductAddress(event.target.value)}
          >
            <option value="">Select product</option>
            {products.map((product) => (
              <option key={product.address} value={product.address}>
                {product.displayName} ({shortAddress(product.address)})
              </option>
            ))}
          </select>
        </label>
        {selectedProduct ? (
          <div className="grid gap-2 sm:grid-cols-2">
            <p className="field-help">ID hash: {selectedProduct.seriesRefHashHex}</p>
            <p className="field-help">Terms hash: {selectedProduct.termsHashHex}</p>
          </div>
        ) : null}
      </section>

      <section className="surface-card-soft space-y-3">
        <div className="grid gap-2 sm:grid-cols-4">
          <button type="button" className={`segment-button ${mode === "products" ? "segment-button-active" : ""}`} onClick={() => setMode("products")}>
            Products
          </button>
          <button type="button" className={`segment-button ${mode === "subscribe" ? "segment-button-active" : ""}`} onClick={() => setMode("subscribe")}>
            Member Subscribe
          </button>
          <button type="button" className={`segment-button ${mode === "issue" ? "segment-button-active" : ""}`} onClick={() => setMode("issue")}>
            Operator Issue
          </button>
          <button type="button" className={`segment-button ${mode === "premium" ? "segment-button-active" : ""}`} onClick={() => setMode("premium")}>
            Pay Premium
          </button>
        </div>
      </section>

      {mode === "products" ? (
        <section className="surface-card-soft space-y-3">
          <div className="flex items-center gap-2">
            <ShieldPlus className="h-4 w-4 text-[var(--primary)]" />
            <p className="metric-label">Coverage product template</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="field-label">
              Product ID seed (create only)
              <input className="field-input mt-1" value={productIdSeed} onChange={(event) => setProductIdSeed(event.target.value)} placeholder="basic-annual-2026" />
            </label>
            <label className="field-label">
              Display name
              <input className="field-input mt-1" value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Basic Annual Plan" />
            </label>
            <label className="field-label sm:col-span-2">
              Metadata URI
              <input className="field-input mt-1" value={metadataUri} onChange={(event) => setMetadataUri(event.target.value)} />
            </label>
            <label className="field-label">
              Duration (months)
              <input className="field-input mt-1" type="number" min="0.01" step="0.01" value={durationMonths} onChange={(event) => setDurationMonths(event.target.value)} />
            </label>
            <label className="field-label">
              Premium amount (base units)
              <input className="field-input mt-1" value={premiumAmountBaseUnits} onChange={(event) => setPremiumAmountBaseUnits(event.target.value)} />
            </label>
            <label className="field-label">
              Premium cadence (days)
              <input className="field-input mt-1" type="number" min="0.01" step="0.01" value={premiumCadenceDays} onChange={(event) => setPremiumCadenceDays(event.target.value)} />
            </label>
            <label className="field-label">
              Premium grace window (days)
              <input className="field-input mt-1" type="number" min="0" step="0.01" value={premiumGraceDays} onChange={(event) => setPremiumGraceDays(event.target.value)} />
            </label>
            <label className="field-label sm:col-span-2">
              Terms hash override (optional 64-char hex)
              <input className="field-input mt-1 font-mono" value={termsHashOverride} onChange={(event) => setTermsHashOverride(event.target.value)} placeholder="optional override" />
            </label>
          </div>
          <label className="field-label inline-flex w-fit items-center gap-2">
            <input type="checkbox" checked={productActive} onChange={(event) => setProductActive(event.target.checked)} />
            Active product
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="action-button" onClick={() => void onRegisterProduct()} disabled={Boolean(registerGuard) || Boolean(busyAction)}>
              {busyAction === "Register coverage product" ? "Registering..." : "Register product"}
            </button>
            <button type="button" className="secondary-button" onClick={() => void onUpdateProduct()} disabled={Boolean(updateGuard) || Boolean(busyAction)}>
              {busyAction === "Update coverage product" ? "Updating..." : "Update selected product"}
            </button>
          </div>
          {registerGuard && !busyAction ? <p className="field-error">{registerGuard}</p> : null}
        </section>
      ) : null}

      {mode === "subscribe" ? (
        <section className="surface-card-soft space-y-3">
          <div className="flex items-center gap-2">
            <WalletCards className="h-4 w-4 text-[var(--primary)]" />
            <p className="metric-label">Member subscribe pathway</p>
          </div>
          <p className="field-help">
            Connected wallet subscribes to the selected product and creates its own coverage policy position.
          </p>
          <label className="field-label">
            Policy start date (optional)
            <input className="field-input mt-1" type="date" value={subscribeStartDate} onChange={(event) => setSubscribeStartDate(event.target.value)} />
          </label>
          <button type="button" className="action-button" onClick={() => void onSubscribe()} disabled={Boolean(subscribeGuard) || Boolean(busyAction)}>
            {busyAction === "Subscribe coverage product" ? "Subscribing..." : "Subscribe with connected wallet"}
          </button>
          {subscribeGuard && !busyAction ? <p className="field-error">{subscribeGuard}</p> : null}
        </section>
      ) : null}

      {mode === "issue" ? (
        <section className="surface-card-soft space-y-3">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-[var(--primary)]" />
            <p className="metric-label">Operator issue pathway</p>
          </div>
          <p className="field-help">
            Pool authority issues or renews a member policy from a selected product template.
          </p>
          <label className="field-label">
            Member wallet
            <input className="field-input mt-1" value={issueMember} onChange={(event) => setIssueMember(event.target.value)} placeholder="Member pubkey" />
          </label>
          <label className="field-label">
            Policy start date (optional)
            <input className="field-input mt-1" type="date" value={issueStartDate} onChange={(event) => setIssueStartDate(event.target.value)} />
          </label>
          <button type="button" className="action-button" onClick={() => void onIssuePolicy()} disabled={Boolean(issueGuard) || Boolean(busyAction)}>
            {busyAction === "Issue member policy" ? "Issuing..." : "Issue member policy"}
          </button>
          {issueGuard && !busyAction ? <p className="field-error">{issueGuard}</p> : null}
        </section>
      ) : null}

      {mode === "premium" ? (
        <section className="surface-card-soft space-y-3">
          <div className="flex items-center gap-2">
            <WalletCards className="h-4 w-4 text-[var(--primary)]" />
            <p className="metric-label">Pay premium</p>
          </div>
          <p className="field-help">
            Uses connected wallet as payer/member, selected product premium amount as default, and the pool payout mint vault.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="field-label">
              Period index
              <input className="field-input mt-1" value={premiumPeriodIndex} onChange={(event) => setPremiumPeriodIndex(event.target.value)} />
            </label>
            <label className="field-label">
              Premium amount (base units)
              <input className="field-input mt-1" value={premiumAmountBaseUnits} onChange={(event) => setPremiumAmountBaseUnits(event.target.value)} />
            </label>
          </div>
          <button type="button" className="action-button" onClick={() => void onPayPremium()} disabled={Boolean(premiumGuard) || Boolean(busyAction)}>
            {busyAction === "Pay premium on-chain" ? "Paying..." : "Pay premium on-chain"}
          </button>
          {premiumGuard && !busyAction ? <p className="field-error">{premiumGuard}</p> : null}
        </section>
      ) : null}

      {error ? <p className="field-error">{error}</p> : null}
      {status ? (
        <section className="surface-card-soft space-y-2">
          <span className={`status-pill ${statusTone === "error" ? "status-error" : "status-ok"}`}>{statusTone === "error" ? "Action failed" : "Action confirmed"}</span>
          <p className={statusTone === "error" ? "field-error" : "field-help"}>{status}</p>
          {signature ? (
            <a className="secondary-button inline-flex w-fit items-center gap-2" href={toExplorerLink(signature)} target="_blank" rel="noreferrer">
              <CheckCircle2 className="h-4 w-4" />
              View transaction
            </a>
          ) : null}
        </section>
      ) : null}
    </motion.div>
  );
}
