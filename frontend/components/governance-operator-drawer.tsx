// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import { useEffect, useMemo, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import type { Transaction } from "@solana/web3.js";

import { WizardDetailSheet } from "@/components/wizard-detail-sheet";
import { executeProtocolTransaction } from "@/lib/protocol-action";
import {
  buildCreateDomainAssetVaultTx,
  buildCreateReserveDomainTx,
  buildInitializeProtocolGovernanceTx,
  hashStringTo32Hex,
  type ProtocolConsoleSnapshot,
} from "@/lib/protocol";
import { cn } from "@/lib/cn";

export type GovernanceOperatorSection = "governance" | "domain" | "vault";

type Status = {
  tone: "ok" | "error";
  message: string;
  explorerUrl?: string | null;
} | null;

type SnapshotSlice = Pick<
  ProtocolConsoleSnapshot,
  "protocolGovernance" | "reserveDomains" | "domainAssetVaults"
>;

type GovernanceOperatorDrawerProps = {
  open: boolean;
  initialSection?: GovernanceOperatorSection;
  onOpenChange: (open: boolean) => void;
  onRefresh?: () => Promise<void> | void;
  snapshot: SnapshotSlice;
};

const SECTIONS: Array<{ id: GovernanceOperatorSection; label: string; blurb: string }> = [
  {
    id: "governance",
    label: "Governance",
    blurb: "Initialize the protocol governance authority.",
  },
  {
    id: "domain",
    label: "Reserve domain",
    blurb: "Create a reserve domain under governance control.",
  },
  {
    id: "vault",
    label: "Domain vault",
    blurb: "Open a new asset vault under an existing domain.",
  },
];

function parseInteger(value: string): number {
  const parsed = Number.parseInt(value.trim(), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function hashReason(value: string): Promise<string> {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const normalized = trimmed.toLowerCase().replace(/^0x/, "");
  if (/^[0-9a-f]{64}$/.test(normalized)) return normalized;
  return hashStringTo32Hex(trimmed);
}

export function GovernanceOperatorDrawer(props: GovernanceOperatorDrawerProps) {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const canAct = Boolean(publicKey);
  const governanceReady = Boolean(props.snapshot.protocolGovernance);

  const [section, setSection] = useState<GovernanceOperatorSection>(
    props.initialSection ?? "governance",
  );
  const [status, setStatus] = useState<Status>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (props.open && props.initialSection) setSection(props.initialSection);
  }, [props.open, props.initialSection]);

  // Governance
  const [protocolFeeBps, setProtocolFeeBps] = useState(
    String(props.snapshot.protocolGovernance?.protocolFeeBps ?? 0),
  );
  const [emergencyPaused, setEmergencyPaused] = useState(
    props.snapshot.protocolGovernance?.emergencyPause ?? false,
  );

  // Domain
  const [domainId, setDomainId] = useState("");
  const [domainDisplayName, setDomainDisplayName] = useState("");
  const [domainAdmin, setDomainAdmin] = useState("");
  const [settlementMode, setSettlementMode] = useState("0");
  const [allowedRailMask, setAllowedRailMask] = useState("65535");
  const [domainPauseFlags, setDomainPauseFlags] = useState("0");
  const [legalStructureSeed, setLegalStructureSeed] = useState("");
  const [complianceBaselineSeed, setComplianceBaselineSeed] = useState("");

  // Vault
  const [selectedReserveDomainAddress, setSelectedReserveDomainAddress] = useState(
    props.snapshot.reserveDomains[0]?.address ?? "",
  );
  const [assetMint, setAssetMint] = useState("");
  const [vaultTokenAccount, setVaultTokenAccount] = useState("");

  useEffect(() => {
    if (publicKey && !domainAdmin) setDomainAdmin(publicKey.toBase58());
  }, [publicKey, domainAdmin]);

  useEffect(() => {
    setSelectedReserveDomainAddress(
      (current) => current || props.snapshot.reserveDomains[0]?.address || "",
    );
  }, [props.snapshot.reserveDomains]);

  const selectedReserveDomain = useMemo(
    () =>
      props.snapshot.reserveDomains.find((domain) => domain.address === selectedReserveDomainAddress) ??
      null,
    [props.snapshot.reserveDomains, selectedReserveDomainAddress],
  );
  const selectedDomainVaults = useMemo(
    () =>
      props.snapshot.domainAssetVaults.filter(
        (vault) => vault.reserveDomain === selectedReserveDomainAddress,
      ),
    [props.snapshot.domainAssetVaults, selectedReserveDomainAddress],
  );
  const vaultAlreadyExists = useMemo(
    () => selectedDomainVaults.some((vault) => vault.assetMint === assetMint.trim()),
    [assetMint, selectedDomainVaults],
  );

  async function run(label: string, factory: () => Promise<Transaction>) {
    if (!publicKey || !sendTransaction) return;
    setBusy(label);
    setStatus(null);
    try {
      const tx = await factory();
      const result = await executeProtocolTransaction({ connection, sendTransaction, tx, label });
      if (!result.ok) {
        setStatus({ tone: "error", message: result.error });
        return;
      }
      setStatus({ tone: "ok", message: result.message, explorerUrl: result.explorerUrl });
      await props.onRefresh?.();
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
    meta.push({ label: governanceReady ? "Governance ready" : "Bootstrap pending", tone: governanceReady ? "accent" : "muted" });
    meta.push({ label: `${props.snapshot.reserveDomains.length} domain${props.snapshot.reserveDomains.length === 1 ? "" : "s"}` });
    return meta;
  }, [governanceReady, props.snapshot.reserveDomains.length]);

  return (
    <WizardDetailSheet
      open={props.open}
      onOpenChange={props.onOpenChange}
      title="Operator actions"
      summary="Initialize governance, create reserve domains, and open domain asset vaults."
      meta={sheetMeta}
      size="wide"
    >
      <div className="operator-drawer">
        <nav className="operator-drawer-nav" aria-label="Governance operator action sections">
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
              Connect the governance or domain-admin wallet before submitting protocol transactions.
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

          {section === "governance" ? (
            <div className="operator-drawer-section">
              <fieldset className="operator-drawer-fieldset">
                <legend className="operator-drawer-legend">Initialize protocol governance</legend>
                <p className="operator-drawer-hint">
                  {governanceReady
                    ? "Protocol governance is already initialized."
                    : "Sets the governance authority, protocol fee, and emergency pause posture."}
                </p>
                <TextField
                  label="Protocol fee (bps)"
                  value={protocolFeeBps}
                  onChange={setProtocolFeeBps}
                />
                <Toggle
                  label="Emergency pause"
                  description="Enable to freeze the protocol at launch."
                  checked={emergencyPaused}
                  onChange={setEmergencyPaused}
                />
                <div className="operator-drawer-actions">
                  <button
                    type="button"
                    className="plans-primary-cta"
                    disabled={!canAct || governanceReady || busyOn("Initialize protocol governance")}
                    onClick={() =>
                      run("Initialize protocol governance", async () => {
                        const { blockhash } = await connection.getLatestBlockhash("confirmed");
                        return buildInitializeProtocolGovernanceTx({
                          governanceAuthority: publicKey!,
                          recentBlockhash: blockhash,
                          protocolFeeBps: parseInteger(protocolFeeBps),
                          emergencyPaused,
                        });
                      })
                    }
                  >
                    {governanceReady ? "Governance ready" : "Initialize governance"}
                  </button>
                </div>
              </fieldset>
            </div>
          ) : null}

          {section === "domain" ? (
            <div className="operator-drawer-section">
              <fieldset className="operator-drawer-fieldset">
                <legend className="operator-drawer-legend">Create reserve domain</legend>
                {!governanceReady ? (
                  <p className="operator-drawer-hint">
                    Initialize protocol governance first.
                  </p>
                ) : null}
                <div className="plans-wizard-row">
                  <TextField
                    label="Domain identifier"
                    value={domainId}
                    onChange={setDomainId}
                    placeholder="e.g. prime-domain"
                  />
                  <TextField
                    label="Display name"
                    value={domainDisplayName}
                    onChange={setDomainDisplayName}
                    placeholder="e.g. Prime Reserve Domain"
                  />
                </div>
                <div className="plans-wizard-row">
                  <TextField label="Domain admin" value={domainAdmin} onChange={setDomainAdmin} />
                  <TextField
                    label="Settlement mode"
                    value={settlementMode}
                    onChange={setSettlementMode}
                  />
                </div>
                <div className="plans-wizard-row">
                  <TextField
                    label="Allowed rails (bitmask)"
                    value={allowedRailMask}
                    onChange={setAllowedRailMask}
                  />
                  <TextField
                    label="Pause flags (bitmask)"
                    value={domainPauseFlags}
                    onChange={setDomainPauseFlags}
                  />
                </div>
                <div className="plans-wizard-row">
                  <TextField
                    label="Legal structure hash"
                    value={legalStructureSeed}
                    onChange={setLegalStructureSeed}
                    placeholder="Optional seed or 32-byte hex"
                  />
                  <TextField
                    label="Compliance baseline hash"
                    value={complianceBaselineSeed}
                    onChange={setComplianceBaselineSeed}
                    placeholder="Optional seed or 32-byte hex"
                  />
                </div>
                <div className="operator-drawer-actions">
                  <button
                    type="button"
                    className="plans-primary-cta"
                    disabled={
                      !canAct ||
                      !governanceReady ||
                      !domainId.trim() ||
                      busyOn("Create reserve domain")
                    }
                    onClick={() =>
                      run("Create reserve domain", async () => {
                        const { blockhash } = await connection.getLatestBlockhash("confirmed");
                        return buildCreateReserveDomainTx({
                          authority: publicKey!,
                          recentBlockhash: blockhash,
                          domainId: domainId.trim(),
                          displayName: domainDisplayName || domainId.trim(),
                          domainAdmin: domainAdmin || publicKey!,
                          settlementMode: parseInteger(settlementMode),
                          legalStructureHashHex: await hashReason(legalStructureSeed),
                          complianceBaselineHashHex: await hashReason(complianceBaselineSeed),
                          allowedRailMask: parseInteger(allowedRailMask),
                          pauseFlags: parseInteger(domainPauseFlags),
                        });
                      })
                    }
                  >
                    Create reserve domain
                  </button>
                </div>
              </fieldset>
            </div>
          ) : null}

          {section === "vault" ? (
            <div className="operator-drawer-section">
              <fieldset className="operator-drawer-fieldset">
                <legend className="operator-drawer-legend">Create domain asset vault</legend>
                {!governanceReady ? (
                  <p className="operator-drawer-hint">
                    Initialize protocol governance first.
                  </p>
                ) : props.snapshot.reserveDomains.length === 0 ? (
                  <p className="operator-drawer-hint">
                    Create a reserve domain before opening a vault.
                  </p>
                ) : null}
                <div className="plans-wizard-row">
                  <SelectField
                    label="Reserve domain"
                    value={selectedReserveDomainAddress}
                    onChange={setSelectedReserveDomainAddress}
                  >
                    {props.snapshot.reserveDomains.length === 0 ? (
                      <option value="">No reserve domains</option>
                    ) : null}
                    {props.snapshot.reserveDomains.map((domain) => (
                      <option key={domain.address} value={domain.address}>
                        {domain.displayName || domain.domainId}
                      </option>
                    ))}
                  </SelectField>
                  <TextField label="Asset mint" value={assetMint} onChange={setAssetMint} />
                </div>
                <TextField
                  label="Vault token account"
                  value={vaultTokenAccount}
                  onChange={setVaultTokenAccount}
                  placeholder="Required SPL token account for this vault"
                />
                {selectedReserveDomain ? (
                  <p className="operator-drawer-hint">
                    Existing rails for{" "}
                    {selectedReserveDomain.displayName || selectedReserveDomain.domainId}:{" "}
                    {selectedDomainVaults.length > 0
                      ? selectedDomainVaults.map((vault) => vault.assetMint).join(" · ")
                      : "none yet"}
                  </p>
                ) : null}
                <div className="operator-drawer-actions">
                  <button
                    type="button"
                    className="plans-primary-cta"
                    disabled={
                      !canAct ||
                      !governanceReady ||
                      !selectedReserveDomainAddress ||
                      !assetMint.trim() ||
                      !vaultTokenAccount.trim() ||
                      vaultAlreadyExists ||
                      busyOn("Create domain asset vault")
                    }
                    onClick={() =>
                      run("Create domain asset vault", async () => {
                        const { blockhash } = await connection.getLatestBlockhash("confirmed");
                        return buildCreateDomainAssetVaultTx({
                          authority: publicKey!,
                          reserveDomainAddress: selectedReserveDomainAddress,
                          assetMint: assetMint.trim(),
                          recentBlockhash: blockhash,
                          vaultTokenAccountAddress: vaultTokenAccount.trim(),
                        });
                      })
                    }
                  >
                    {vaultAlreadyExists ? "Vault already exists" : "Create domain vault"}
                  </button>
                </div>
              </fieldset>
            </div>
          ) : null}
        </div>
      </div>
    </WizardDetailSheet>
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

function SelectField(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="plans-wizard-field-group">
      <span className="plans-wizard-field-label">{props.label}</span>
      <span className="plans-wizard-field-bar">
        <select
          className="plans-wizard-input"
          value={props.value}
          onChange={(event) => props.onChange(event.target.value)}
        >
          {props.children}
        </select>
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
