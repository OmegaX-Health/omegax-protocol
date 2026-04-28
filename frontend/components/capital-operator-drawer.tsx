// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import { useEffect, useMemo, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import type { Transaction } from "@solana/web3.js";

import { useProtocolTransactionReviewPrompt } from "@/components/protocol-transaction-review";
import { Term } from "@/components/term";
import { WizardDetailSheet } from "@/components/wizard-detail-sheet";
import { executeProtocolTransactionWithToast } from "@/lib/protocol-action-toast";
import {
  buildAllocateCapitalTx,
  buildCreateAllocationPositionTx,
  buildCreateCapitalClassTx,
  buildCreateLiquidityPoolTx,
  buildDeallocateCapitalTx,
  buildProcessRedemptionQueueTx,
  buildUpdateAllocationCapsTx,
  buildUpdateCapitalClassControlsTx,
  buildUpdateLpPositionCredentialingTx,
  CAPITAL_CLASS_RESTRICTION_OPEN,
  REDEMPTION_POLICY_OPEN,
  ZERO_PUBKEY,
  hashStringTo32Hex,
  type AllocationPositionSnapshot,
  type CapitalClassSnapshot,
  type FundingLineSnapshot,
  type HealthPlanSnapshot,
  type LiquidityPoolSnapshot,
  type LPPositionSnapshot,
  type ReserveDomainSnapshot,
} from "@/lib/protocol";
import { cn } from "@/lib/cn";

export type CapitalOperatorSection = "provision" | "controls" | "allocate" | "queue";

type Status = {
  tone: "ok" | "error";
  message: string;
  explorerUrl?: string | null;
} | null;

type CapitalOperatorDrawerProps = {
  open: boolean;
  initialSection?: CapitalOperatorSection;
  onOpenChange: (open: boolean) => void;
  onRefresh?: () => Promise<void> | void;
  reserveDomains: ReserveDomainSnapshot[];
  selectedPool: LiquidityPoolSnapshot | null;
  selectedClass: CapitalClassSnapshot | null;
  lpPositions: LPPositionSnapshot[];
  allocations: AllocationPositionSnapshot[];
  plans: HealthPlanSnapshot[];
  fundingLines: FundingLineSnapshot[];
};

const SECTIONS: Array<{ id: CapitalOperatorSection; label: string; blurb: string }> = [
  {
    id: "provision",
    label: "Provision",
    blurb: "Create a liquidity pool or capital class.",
  },
  {
    id: "controls",
    label: "Class controls",
    blurb: "Pause, restrict redemptions, activate or deactivate.",
  },
  {
    id: "allocate",
    label: "Allocate",
    blurb: "Link a class to a plan funding line and deploy capital.",
  },
  {
    id: "queue",
    label: "Redemption queue",
    blurb: "Process pending redemptions and credential liquidity providers.",
  },
];

function parseBigIntInput(value: string): bigint {
  const normalized = value.trim().replace(/[_ ,]/g, "");
  if (!normalized) return 0n;
  try {
    return BigInt(normalized);
  } catch {
    return 0n;
  }
}

async function hashReason(value: string): Promise<string> {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const normalized = trimmed.toLowerCase().replace(/^0x/, "");
  if (/^[0-9a-f]{64}$/.test(normalized)) return normalized;
  return hashStringTo32Hex(trimmed);
}

export function CapitalOperatorDrawer(props: CapitalOperatorDrawerProps) {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const canAct = Boolean(publicKey);
  const { confirmReview, reviewPrompt } = useProtocolTransactionReviewPrompt();

  const [section, setSection] = useState<CapitalOperatorSection>(props.initialSection ?? "provision");
  const [status, setStatus] = useState<Status>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (props.open && props.initialSection) setSection(props.initialSection);
  }, [props.open, props.initialSection]);

  // Provision
  const [reserveDomainAddress, setReserveDomainAddress] = useState("");
  const [poolId, setPoolId] = useState("");
  const [poolDisplayName, setPoolDisplayName] = useState("");
  const [classId, setClassId] = useState("");
  const [classDisplayName, setClassDisplayName] = useState("");

  // Controls
  const [queueOnly, setQueueOnly] = useState(false);
  const [classActive, setClassActive] = useState(true);
  const [pauseFlags, setPauseFlags] = useState("0");
  const [advancedControls, setAdvancedControls] = useState(false);

  // Allocate
  const [planAddress, setPlanAddress] = useState("");
  const [fundingLineAddress, setFundingLineAddress] = useState("");
  const [allocationCap, setAllocationCap] = useState("0");
  const [allocationWeight, setAllocationWeight] = useState("5000");
  const [allocationAmount, setAllocationAmount] = useState("0");

  // Queue
  const [lpOwner, setLpOwner] = useState("");
  const [queueShares, setQueueShares] = useState("0");
  const [lpCredentialed, setLpCredentialed] = useState(true);
  const [lpReason, setLpReason] = useState("");

  useEffect(() => {
    setReserveDomainAddress(
      props.selectedPool?.reserveDomain ?? props.reserveDomains[0]?.address ?? "",
    );
    setPlanAddress(props.plans[0]?.address ?? "");
    setQueueOnly(props.selectedClass?.queueOnlyRedemptions ?? false);
    setClassActive(props.selectedClass?.active ?? true);
    setLpOwner(props.lpPositions[0]?.owner ?? publicKey?.toBase58() ?? "");
    setLpCredentialed(props.lpPositions[0]?.credentialed ?? true);
  }, [
    props.lpPositions,
    props.plans,
    props.reserveDomains,
    props.selectedClass,
    props.selectedPool,
    publicKey,
  ]);

  const filteredFundingLines = useMemo(
    () =>
      props.fundingLines.filter(
        (line) => !planAddress || line.healthPlan === planAddress,
      ),
    [props.fundingLines, planAddress],
  );

  useEffect(() => {
    if (!filteredFundingLines.find((line) => line.address === fundingLineAddress)) {
      setFundingLineAddress(filteredFundingLines[0]?.address ?? "");
    }
  }, [filteredFundingLines, fundingLineAddress]);

  const selectedFundingLine = useMemo<FundingLineSnapshot | null>(
    () => filteredFundingLines.find((line) => line.address === fundingLineAddress) ?? null,
    [filteredFundingLines, fundingLineAddress],
  );

  async function run(label: string, factory: () => Promise<Transaction>) {
    if (!publicKey || !sendTransaction) return;
    setBusy(label);
    setStatus(null);
    try {
      const tx = await factory();
      const result = await executeProtocolTransactionWithToast({
        connection,
        sendTransaction,
        tx,
        label,
        confirmReview,
        review: {
          authority: publicKey.toBase58(),
          feePayer: publicKey.toBase58(),
          affectedObject: props.selectedClass
            ? `${props.selectedClass.displayName} (${props.selectedClass.address})`
            : props.selectedPool
              ? `${props.selectedPool.displayName} (${props.selectedPool.address})`
              : "Capital operator action",
          economicEffect: "Submits a capital action that may affect pool or class state, allocation caps, deployed capital, or redemption queues.",
          warnings: props.selectedPool?.poolId === "genesis-protect-acute-pool"
            ? ["Genesis reserve movement should stay paired with readiness and operator sign-off review."]
            : [],
        },
        onConfirmed: async () => {
          await props.onRefresh?.();
        },
        onRetry: () => {
          void run(label, factory);
        },
      });
      if (!result.ok) {
        setStatus({ tone: "error", message: result.error });
        return;
      }
      setStatus({ tone: "ok", message: result.message, explorerUrl: result.explorerUrl });
    } catch (err) {
      setStatus({
        tone: "error",
        message: err instanceof Error ? err.message : `${label} failed.`,
      });
    } finally {
      setBusy(null);
    }
  }

  const busyOn = (label: string) => busy === label;

  const sheetMeta = useMemo(() => {
    const meta: Array<{ label: string; tone?: "default" | "accent" | "muted" }> = [];
    if (props.selectedPool) meta.push({ label: props.selectedPool.displayName });
    if (props.selectedClass) meta.push({ label: props.selectedClass.displayName, tone: "accent" });
    return meta;
  }, [props.selectedClass, props.selectedPool]);

  return (
    <>
      {reviewPrompt}
      <WizardDetailSheet
      open={props.open}
      onOpenChange={props.onOpenChange}
      title="Operator actions"
      summary="Provision pools and classes, adjust class controls, deploy allocations, and process the redemption queue."
      meta={sheetMeta}
      size="wide"
    >
      <div className="operator-drawer">
        <nav className="operator-drawer-nav" aria-label="Operator action sections">
          {SECTIONS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={cn(
                "operator-drawer-nav-item",
                section === item.id && "operator-drawer-nav-item-active",
              )}
              onClick={() => setSection(item.id)}
              aria-current={section === item.id ? "page" : undefined}
            >
              <span className="operator-drawer-nav-label">{item.label}</span>
              <span className="operator-drawer-nav-blurb">{item.blurb}</span>
            </button>
          ))}
        </nav>

        <div className="operator-drawer-body">
          {!canAct ? (
            <p className="operator-drawer-hint">
              Connect a wallet before submitting protocol transactions.
            </p>
          ) : null}

          {status ? (
            <div className="plans-notice liquid-glass" role="status">
              <span className="material-symbols-outlined plans-notice-icon" aria-hidden="true">
                {status.tone === "ok" ? "verified" : "error"}
              </span>
              <p>
                {status.message}
                {status.explorerUrl ? (
                  <>
                    {" "}
                    <a
                      href={status.explorerUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="plans-table-link"
                    >
                      Explorer →
                    </a>
                  </>
                ) : null}
              </p>
            </div>
          ) : null}

          {section === "provision" ? (
            <div className="operator-drawer-section">
              <fieldset className="operator-drawer-fieldset">
                <legend className="operator-drawer-legend">Create liquidity pool</legend>
                <div className="plans-wizard-row">
                  <label className="plans-wizard-field-group">
                    <span className="plans-wizard-field-label">Reserve domain</span>
                    <span className="plans-wizard-field-bar">
                      <select
                        className="plans-wizard-input"
                        value={reserveDomainAddress}
                        onChange={(event) => setReserveDomainAddress(event.target.value)}
                      >
                        {props.reserveDomains.length === 0 ? (
                          <option value="">No reserve domains available</option>
                        ) : null}
                        {props.reserveDomains.map((domain) => (
                          <option key={domain.address} value={domain.address}>
                            {domain.displayName || domain.domainId}
                          </option>
                        ))}
                      </select>
                    </span>
                  </label>
                  <TextField
                    label="Pool identifier"
                    value={poolId}
                    onChange={setPoolId}
                    placeholder="e.g. atlas-prime"
                  />
                </div>
                <TextField
                  label="Pool name"
                  value={poolDisplayName}
                  onChange={setPoolDisplayName}
                  placeholder="e.g. Atlas Prime Reserve"
                />
                <div className="operator-drawer-actions">
                  <button
                    type="button"
                    className="plans-secondary-cta"
                    disabled={
                      !canAct ||
                      !reserveDomainAddress ||
                      !poolId ||
                      busyOn("Create liquidity pool")
                    }
                    onClick={() =>
                      run("Create liquidity pool", async () => {
                        const { blockhash } = await connection.getLatestBlockhash("confirmed");
                        return buildCreateLiquidityPoolTx({
                          authority: publicKey!,
                          reserveDomainAddress,
                          recentBlockhash: blockhash,
                          poolId,
                          displayName: poolDisplayName || poolId,
                          depositAssetMint:
                            props.selectedPool?.depositAssetMint ??
                            props.fundingLines[0]?.assetMint ??
                            ZERO_PUBKEY,
                          redemptionPolicy: REDEMPTION_POLICY_OPEN,
                          feeBps: 0,
                          pauseFlags: 0,
                        });
                      })
                    }
                  >
                    Create pool
                  </button>
                </div>
              </fieldset>

              <fieldset className="operator-drawer-fieldset">
                <legend className="operator-drawer-legend">Create capital class</legend>
                <p className="operator-drawer-hint">
                  {props.selectedPool
                    ? `Added to ${props.selectedPool.displayName}.`
                    : "Select a pool in the context bar before creating a class."}
                </p>
                <div className="plans-wizard-row">
                  <TextField
                    label="Class identifier"
                    value={classId}
                    onChange={setClassId}
                    placeholder="e.g. senior"
                  />
                  <TextField
                    label="Class name"
                    value={classDisplayName}
                    onChange={setClassDisplayName}
                    placeholder="e.g. Senior Tranche"
                  />
                </div>
                <div className="operator-drawer-actions">
                  <button
                    type="button"
                    className="plans-secondary-cta"
                    disabled={
                      !canAct ||
                      !props.selectedPool ||
                      !classId ||
                      busyOn("Create capital class")
                    }
                    onClick={() =>
                      run("Create capital class", async () => {
                        const { blockhash } = await connection.getLatestBlockhash("confirmed");
                        return buildCreateCapitalClassTx({
                          authority: publicKey!,
                          poolAddress: props.selectedPool!.address,
                          poolDepositAssetMint: props.selectedPool!.depositAssetMint,
                          recentBlockhash: blockhash,
                          classId,
                          displayName: classDisplayName || classId,
                          priority: 1,
                          impairmentRank: 1,
                          restrictionMode: CAPITAL_CLASS_RESTRICTION_OPEN,
                          redemptionTermsMode: 0,
                          feeBps: 0,
                          minLockupSeconds: 0n,
                          pauseFlags: 0,
                        });
                      })
                    }
                  >
                    Create class
                  </button>
                </div>
              </fieldset>
            </div>
          ) : null}

          {section === "controls" ? (
            <div className="operator-drawer-section">
              <fieldset className="operator-drawer-fieldset">
                <legend className="operator-drawer-legend">Class controls</legend>
                {!props.selectedClass ? (
                  <p className="operator-drawer-hint">
                    Select a <Term name="CapitalClass">capital class</Term> in the context bar to edit its controls.
                  </p>
                ) : (
                  <>
                    <p className="operator-drawer-hint">
                      Editing {props.selectedClass.displayName}.
                    </p>
                    <Toggle
                      label="Queue-only redemptions"
                      description="Route all redemptions through the exit queue."
                      checked={queueOnly}
                      onChange={setQueueOnly}
                    />
                    <Toggle
                      label="Class is active"
                      description="Disable to freeze new deposits and allocations."
                      checked={classActive}
                      onChange={setClassActive}
                    />
                    <button
                      type="button"
                      className="operator-drawer-advanced-toggle"
                      onClick={() => setAdvancedControls((value) => !value)}
                      aria-expanded={advancedControls}
                    >
                      {advancedControls ? "Hide advanced" : "Show advanced"}
                    </button>
                    {advancedControls ? (
                      <TextField
                        label="Pause flags (bitmask)"
                        value={pauseFlags}
                        onChange={setPauseFlags}
                      />
                    ) : null}
                    <div className="operator-drawer-actions">
                      <button
                        type="button"
                        className="plans-primary-cta"
                        disabled={!canAct || busyOn("Update capital class controls")}
                        onClick={() =>
                          run("Update capital class controls", async () => {
                            const { blockhash } = await connection.getLatestBlockhash("confirmed");
                            return buildUpdateCapitalClassControlsTx({
                              authority: publicKey!,
                              poolAddress: props.selectedPool!.address,
                              capitalClassAddress: props.selectedClass!.address,
                              recentBlockhash: blockhash,
                              pauseFlags: Number.parseInt(pauseFlags, 10) || 0,
                              queueOnlyRedemptions: queueOnly,
                              active: classActive,
                            });
                          })
                        }
                      >
                        Save controls
                      </button>
                    </div>
                  </>
                )}
              </fieldset>
            </div>
          ) : null}

          {section === "allocate" ? (
            <div className="operator-drawer-section">
              <fieldset className="operator-drawer-fieldset">
                <legend className="operator-drawer-legend">Allocate to a plan</legend>
                {!props.selectedPool || !props.selectedClass ? (
                  <p className="operator-drawer-hint">
                    Select a pool and capital class in the context bar before allocating.
                  </p>
                ) : (
                  <>
                    <div className="plans-wizard-row">
                      <label className="plans-wizard-field-group">
                        <span className="plans-wizard-field-label">Plan</span>
                        <span className="plans-wizard-field-bar">
                          <select
                            className="plans-wizard-input"
                            value={planAddress}
                            onChange={(event) => setPlanAddress(event.target.value)}
                          >
                            <option value="">Select plan</option>
                            {props.plans.map((plan) => (
                              <option key={plan.address} value={plan.address}>
                                {plan.displayName}
                              </option>
                            ))}
                          </select>
                        </span>
                      </label>
                      <label className="plans-wizard-field-group">
                        <span className="plans-wizard-field-label">Funding line</span>
                        <span className="plans-wizard-field-bar">
                          <select
                            className="plans-wizard-input"
                            value={fundingLineAddress}
                            onChange={(event) => setFundingLineAddress(event.target.value)}
                            disabled={filteredFundingLines.length === 0}
                          >
                            {filteredFundingLines.length === 0 ? (
                              <option value="">No funding lines</option>
                            ) : null}
                            {filteredFundingLines.map((line) => (
                              <option key={line.address} value={line.address}>
                                {line.displayName}
                              </option>
                            ))}
                          </select>
                        </span>
                      </label>
                    </div>
                    <div className="plans-wizard-row">
                      <TextField
                        label="Allocation cap"
                        value={allocationCap}
                        onChange={setAllocationCap}
                      />
                      <TextField
                        label="Weight (bps)"
                        value={allocationWeight}
                        onChange={setAllocationWeight}
                      />
                    </div>
                    <div className="operator-drawer-actions">
                      <button
                        type="button"
                        className="plans-secondary-cta"
                        disabled={
                          !canAct || !selectedFundingLine || busyOn("Create allocation position")
                        }
                        onClick={() =>
                          run("Create allocation position", async () => {
                            const { blockhash } = await connection.getLatestBlockhash("confirmed");
                            return buildCreateAllocationPositionTx({
                              authority: publicKey!,
                              poolAddress: props.selectedPool!.address,
                              capitalClassAddress: props.selectedClass!.address,
                              healthPlanAddress: planAddress,
                              fundingLineAddress: selectedFundingLine!.address,
                              fundingLineAssetMint: selectedFundingLine!.assetMint,
                              recentBlockhash: blockhash,
                              policySeriesAddress: selectedFundingLine!.policySeries ?? null,
                              capAmount: parseBigIntInput(allocationCap),
                              weightBps: Number.parseInt(allocationWeight, 10) || 0,
                              allocationMode: 0,
                              deallocationOnly: false,
                            });
                          })
                        }
                      >
                        Create allocation lane
                      </button>
                      <button
                        type="button"
                        className="plans-secondary-cta"
                        disabled={
                          !canAct || !selectedFundingLine || busyOn("Update allocation caps")
                        }
                        onClick={() =>
                          run("Update allocation caps", async () => {
                            const allocation = props.allocations.find(
                              (entry) =>
                                entry.capitalClass === props.selectedClass!.address &&
                                entry.fundingLine === selectedFundingLine!.address,
                            );
                            if (!allocation) throw new Error("Create the allocation lane first.");
                            const { blockhash } = await connection.getLatestBlockhash("confirmed");
                            return buildUpdateAllocationCapsTx({
                              authority: publicKey!,
                              poolAddress: props.selectedPool!.address,
                              allocationPositionAddress: allocation.address,
                              recentBlockhash: blockhash,
                              capAmount: parseBigIntInput(allocationCap),
                              weightBps: Number.parseInt(allocationWeight, 10) || 0,
                              deallocationOnly: false,
                              active: true,
                            });
                          })
                        }
                      >
                        Update caps
                      </button>
                    </div>

                    <div className="operator-drawer-divider" aria-hidden="true" />

                    <TextField
                      label="Amount"
                      value={allocationAmount}
                      onChange={setAllocationAmount}
                    />
                    <div className="operator-drawer-actions">
                      <button
                        type="button"
                        className="plans-primary-cta"
                        disabled={
                          !canAct || !selectedFundingLine || busyOn("Allocate capital")
                        }
                        onClick={() =>
                          run("Allocate capital", async () => {
                            const { blockhash } = await connection.getLatestBlockhash("confirmed");
                            return buildAllocateCapitalTx({
                              authority: publicKey!,
                              poolAddress: props.selectedPool!.address,
                              capitalClassAddress: props.selectedClass!.address,
                              poolDepositAssetMint: props.selectedPool!.depositAssetMint,
                              fundingLineAddress: selectedFundingLine!.address,
                              fundingLineAssetMint: selectedFundingLine!.assetMint,
                              recentBlockhash: blockhash,
                              amount: parseBigIntInput(allocationAmount),
                            });
                          })
                        }
                      >
                        Deploy capital
                      </button>
                      <button
                        type="button"
                        className="plans-secondary-cta"
                        disabled={
                          !canAct || !selectedFundingLine || busyOn("Deallocate capital")
                        }
                        onClick={() =>
                          run("Deallocate capital", async () => {
                            const { blockhash } = await connection.getLatestBlockhash("confirmed");
                            return buildDeallocateCapitalTx({
                              authority: publicKey!,
                              poolAddress: props.selectedPool!.address,
                              capitalClassAddress: props.selectedClass!.address,
                              poolDepositAssetMint: props.selectedPool!.depositAssetMint,
                              fundingLineAddress: selectedFundingLine!.address,
                              fundingLineAssetMint: selectedFundingLine!.assetMint,
                              recentBlockhash: blockhash,
                              amount: parseBigIntInput(allocationAmount),
                            });
                          })
                        }
                      >
                        Withdraw capital
                      </button>
                    </div>
                  </>
                )}
              </fieldset>
            </div>
          ) : null}

          {section === "queue" ? (
            <div className="operator-drawer-section">
              <fieldset className="operator-drawer-fieldset">
                <legend className="operator-drawer-legend">Process redemption</legend>
                {!props.selectedPool || !props.selectedClass ? (
                  <p className="operator-drawer-hint">
                    Select a pool and capital class in the context bar first.
                  </p>
                ) : (
                  <>
                    <TextField
                      label="Liquidity provider address"
                      value={lpOwner}
                      onChange={setLpOwner}
                    />
                    <div className="plans-wizard-row">
                      <TextField
                        label="Shares"
                        value={queueShares}
                        onChange={setQueueShares}
                      />
                    </div>
                    <p className="operator-drawer-hint">
                      Asset payout is derived on-chain from the queued redemption assets.
                    </p>
                    <div className="operator-drawer-actions">
                      <button
                        type="button"
                        className="plans-primary-cta"
                        disabled={!canAct || !lpOwner || busyOn("Process redemption queue")}
                        onClick={() =>
                          run("Process redemption queue", async () => {
                            const { blockhash } = await connection.getLatestBlockhash("confirmed");
                            return buildProcessRedemptionQueueTx({
                              authority: publicKey!,
                              reserveDomainAddress: props.selectedPool!.reserveDomain,
                              poolAddress: props.selectedPool!.address,
                              poolDepositAssetMint: props.selectedPool!.depositAssetMint,
                              capitalClassAddress: props.selectedClass!.address,
                              lpOwnerAddress: lpOwner,
                              recentBlockhash: blockhash,
                              shares: parseBigIntInput(queueShares),
                            });
                          })
                        }
                      >
                        Process redemption
                      </button>
                    </div>
                  </>
                )}
              </fieldset>

              <fieldset className="operator-drawer-fieldset">
                <legend className="operator-drawer-legend">Credentialing</legend>
                {!props.selectedPool || !props.selectedClass ? (
                  <p className="operator-drawer-hint">
                    Select a pool and capital class in the context bar first.
                  </p>
                ) : (
                  <>
                    <TextField
                      label="Liquidity provider address"
                      value={lpOwner}
                      onChange={setLpOwner}
                    />
                    <TextField
                      label="Credentialing note"
                      value={lpReason}
                      onChange={setLpReason}
                      placeholder="Internal audit reference"
                    />
                    <Toggle
                      label="Credentialed"
                      description="Uncheck to revoke credentialed status."
                      checked={lpCredentialed}
                      onChange={setLpCredentialed}
                    />
                    <div className="operator-drawer-actions">
                      <button
                        type="button"
                        className="plans-secondary-cta"
                        disabled={!canAct || !lpOwner || busyOn("Update LP credentialing")}
                        onClick={() =>
                          run("Update LP credentialing", async () => {
                            const { blockhash } = await connection.getLatestBlockhash("confirmed");
                            return buildUpdateLpPositionCredentialingTx({
                              authority: publicKey!,
                              poolAddress: props.selectedPool!.address,
                              capitalClassAddress: props.selectedClass!.address,
                              ownerAddress: lpOwner,
                              recentBlockhash: blockhash,
                              credentialed: lpCredentialed,
                              reasonHashHex: await hashReason(lpReason),
                            });
                          })
                        }
                      >
                        Save credentialing
                      </button>
                    </div>
                  </>
                )}
              </fieldset>
            </div>
          ) : null}
        </div>
      </div>
      </WizardDetailSheet>
    </>
  );
}

function TextField(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="plans-wizard-field-group">
      <span className="plans-wizard-field-label">{props.label}</span>
      <span className="plans-wizard-field-bar">
        <input
          className="plans-wizard-input"
          type="text"
          value={props.value}
          onChange={(event) => props.onChange(event.target.value)}
          placeholder={props.placeholder}
        />
      </span>
    </label>
  );
}

function Toggle(props: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="plans-settings-row">
      <div>
        <span className="plans-settings-label">{props.label}</span>
        {props.description ? (
          <span className="plans-settings-lane">{props.description}</span>
        ) : null}
      </div>
      <input
        type="checkbox"
        checked={props.checked}
        onChange={(event) => props.onChange(event.target.checked)}
      />
    </label>
  );
}
