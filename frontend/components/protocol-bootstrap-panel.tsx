// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import { useEffect, useMemo, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import type { Transaction } from "@solana/web3.js";

import { executeProtocolTransaction } from "@/lib/protocol-action";
import {
  buildCreateDomainAssetVaultTx,
  buildCreateReserveDomainTx,
  buildInitializeProtocolGovernanceTx,
  type ProtocolConsoleSnapshot,
} from "@/lib/protocol";

type ActionStatus = {
  tone: "ok" | "error";
  message: string;
  explorerUrl?: string | null;
} | null;

function Field(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: "text" | "number";
}) {
  return (
    <label className="plans-wizard-field-group">
      <span className="plans-wizard-field-label">{props.label}</span>
      <span className="plans-wizard-field-bar">
        <input
          className="plans-wizard-input"
          type={props.type ?? "text"}
          value={props.value}
          onChange={(event) => props.onChange(event.target.value)}
          placeholder={props.placeholder}
        />
      </span>
    </label>
  );
}

function ToggleRow(props: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="plans-settings-row">
      <div>
        <span className="plans-settings-label">{props.label}</span>
        <span className="plans-settings-lane">{props.checked ? "Enabled" : "Disabled"}</span>
      </div>
      <input type="checkbox" checked={props.checked} onChange={(event) => props.onChange(event.target.checked)} />
    </label>
  );
}

function StatusBanner({ status }: { status: ActionStatus }) {
  if (!status) return null;
  return (
    <div className="plans-notice liquid-glass" role="status">
      <span className="material-symbols-outlined plans-notice-icon" aria-hidden="true">
        {status.tone === "ok" ? "verified" : "error"}
      </span>
      <p>
        {status.message}
        {status.explorerUrl ? (
          <>
            {" "}
            <a href={status.explorerUrl} target="_blank" rel="noreferrer" className="plans-table-link">
              Explorer →
            </a>
          </>
        ) : null}
      </p>
    </div>
  );
}

function parseInteger(value: string): number {
  const parsed = Number.parseInt(value.trim(), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function hashInputToHex(value: string): Promise<string> {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const normalized = trimmed.toLowerCase().replace(/^0x/, "");
  if (/^[0-9a-f]{64}$/.test(normalized)) return normalized;
  const bytes = new TextEncoder().encode(trimmed);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((entry) => entry.toString(16).padStart(2, "0")).join("");
}

type ProtocolBootstrapPanelProps = {
  snapshot: Pick<ProtocolConsoleSnapshot, "protocolGovernance" | "reserveDomains" | "domainAssetVaults">;
  onRefresh?: () => Promise<void> | void;
};

export function ProtocolBootstrapPanel(props: ProtocolBootstrapPanelProps) {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const canAct = Boolean(publicKey);
  const governanceReady = Boolean(props.snapshot.protocolGovernance);

  const [status, setStatus] = useState<ActionStatus>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [protocolFeeBps, setProtocolFeeBps] = useState(String(props.snapshot.protocolGovernance?.protocolFeeBps ?? 0));
  const [emergencyPaused, setEmergencyPaused] = useState(props.snapshot.protocolGovernance?.emergencyPause ?? false);
  const [domainId, setDomainId] = useState("");
  const [domainDisplayName, setDomainDisplayName] = useState("");
  const [domainAdmin, setDomainAdmin] = useState(publicKey?.toBase58() ?? "");
  const [settlementMode, setSettlementMode] = useState("0");
  const [allowedRailMask, setAllowedRailMask] = useState("65535");
  const [domainPauseFlags, setDomainPauseFlags] = useState("0");
  const [legalStructureSeed, setLegalStructureSeed] = useState("");
  const [complianceBaselineSeed, setComplianceBaselineSeed] = useState("");
  const [selectedReserveDomainAddress, setSelectedReserveDomainAddress] = useState(props.snapshot.reserveDomains[0]?.address ?? "");
  const [assetMint, setAssetMint] = useState("");
  const [vaultTokenAccount, setVaultTokenAccount] = useState("");

  useEffect(() => {
    if (publicKey && !domainAdmin) setDomainAdmin(publicKey.toBase58());
  }, [domainAdmin, publicKey]);

  useEffect(() => {
    setSelectedReserveDomainAddress(props.snapshot.reserveDomains[0]?.address ?? "");
  }, [props.snapshot.reserveDomains]);

  const selectedReserveDomain = useMemo(
    () => props.snapshot.reserveDomains.find((domain) => domain.address === selectedReserveDomainAddress) ?? null,
    [props.snapshot.reserveDomains, selectedReserveDomainAddress],
  );
  const selectedDomainVaults = useMemo(
    () => props.snapshot.domainAssetVaults.filter((vault) => vault.reserveDomain === selectedReserveDomainAddress),
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
    } catch (error) {
      setStatus({ tone: "error", message: error instanceof Error ? error.message : `${label} failed.` });
    } finally {
      setBusy(null);
    }
  }

  return (
    <article className="plans-card heavy-glass">
      <div className="plans-card-head">
        <div>
          <p className="plans-card-eyebrow">PROTOCOL_BOOTSTRAP</p>
          <h2 className="plans-card-title plans-card-title-display">
            Bootstrap <em>operations</em>
          </h2>
        </div>
      </div>
      <StatusBanner status={status} />
      {!canAct ? (
        <p className="plans-card-body">Connect the governance or domain-admin wallet to initialize missing protocol surfaces.</p>
      ) : null}

      <div className="plans-data-grid">
        <div className="plans-data-row">
          <span className="plans-data-label">GOVERNANCE</span>
          <span className="plans-data-value">
            {governanceReady ? "Initialized" : "Missing"}
          </span>
        </div>
        <div className="plans-data-row">
          <span className="plans-data-label">RESERVE_DOMAINS</span>
          <span className="plans-data-value">{props.snapshot.reserveDomains.length}</span>
        </div>
        <div className="plans-data-row">
          <span className="plans-data-label">DOMAIN_VAULTS</span>
          <span className="plans-data-value">{props.snapshot.domainAssetVaults.length}</span>
        </div>
      </div>

      <div className="plans-wizard-divider" />

      <div className="plans-wizard-row">
        <Field label="PROTOCOL_FEE_BPS" value={protocolFeeBps} onChange={setProtocolFeeBps} />
      </div>
      <ToggleRow label="EMERGENCY_PAUSED" checked={emergencyPaused} onChange={setEmergencyPaused} />
      <div className="protocol-actions">
        <button
          type="button"
          className="plans-secondary-cta"
          disabled={!canAct || governanceReady || busy === "Initialize protocol governance"}
          onClick={() => run("Initialize protocol governance", async () => {
            const { blockhash } = await connection.getLatestBlockhash("confirmed");
            return buildInitializeProtocolGovernanceTx({
              governanceAuthority: publicKey!,
              recentBlockhash: blockhash,
              protocolFeeBps: parseInteger(protocolFeeBps),
              emergencyPaused,
            });
          })}
        >
          {governanceReady ? "GOVERNANCE_READY" : "INITIALIZE_GOVERNANCE"}
        </button>
      </div>

      <div className="plans-wizard-divider" />

      <div className="plans-wizard-row">
        <Field label="DOMAIN_ID" value={domainId} onChange={setDomainId} />
        <Field label="DISPLAY_NAME" value={domainDisplayName} onChange={setDomainDisplayName} />
      </div>
      <div className="plans-wizard-row">
        <Field label="DOMAIN_ADMIN" value={domainAdmin} onChange={setDomainAdmin} />
        <Field label="SETTLEMENT_MODE" value={settlementMode} onChange={setSettlementMode} />
      </div>
      <div className="plans-wizard-row">
        <Field label="ALLOWED_RAIL_MASK" value={allowedRailMask} onChange={setAllowedRailMask} />
        <Field label="PAUSE_FLAGS" value={domainPauseFlags} onChange={setDomainPauseFlags} />
      </div>
      <div className="plans-wizard-row">
        <Field label="LEGAL_STRUCTURE_HASH" value={legalStructureSeed} onChange={setLegalStructureSeed} placeholder="Optional seed or 32-byte hex" />
        <Field label="COMPLIANCE_HASH" value={complianceBaselineSeed} onChange={setComplianceBaselineSeed} placeholder="Optional seed or 32-byte hex" />
      </div>
      <div className="protocol-actions">
        <button
          type="button"
          className="plans-secondary-cta"
          disabled={!canAct || !governanceReady || !domainId.trim() || busy === "Create reserve domain"}
          onClick={() => run("Create reserve domain", async () => {
            const { blockhash } = await connection.getLatestBlockhash("confirmed");
            return buildCreateReserveDomainTx({
              authority: publicKey!,
              recentBlockhash: blockhash,
              domainId: domainId.trim(),
              displayName: domainDisplayName || domainId.trim(),
              domainAdmin: domainAdmin || publicKey!,
              settlementMode: parseInteger(settlementMode),
              legalStructureHashHex: await hashInputToHex(legalStructureSeed),
              complianceBaselineHashHex: await hashInputToHex(complianceBaselineSeed),
              allowedRailMask: parseInteger(allowedRailMask),
              pauseFlags: parseInteger(domainPauseFlags),
            });
          })}
        >
          CREATE_RESERVE_DOMAIN
        </button>
      </div>

      <div className="plans-wizard-divider" />

      <div className="plans-wizard-row">
        <label className="plans-wizard-field-group">
          <span className="plans-wizard-field-label">RESERVE_DOMAIN</span>
          <span className="plans-wizard-field-bar">
            <select
              className="plans-wizard-input"
              value={selectedReserveDomainAddress}
              onChange={(event) => setSelectedReserveDomainAddress(event.target.value)}
            >
              {props.snapshot.reserveDomains.length === 0 ? <option value="">No reserve domains</option> : null}
              {props.snapshot.reserveDomains.map((domain) => (
                <option key={domain.address} value={domain.address}>
                  {domain.displayName || domain.domainId}
                </option>
              ))}
            </select>
          </span>
        </label>
        <Field label="ASSET_MINT" value={assetMint} onChange={setAssetMint} />
      </div>
      <Field
        label="VAULT_TOKEN_ACCOUNT"
        value={vaultTokenAccount}
        onChange={setVaultTokenAccount}
        placeholder="Optional external token account reference"
      />
      {selectedReserveDomain ? (
        <p className="plans-card-body">
          Existing rails for {selectedReserveDomain.displayName || selectedReserveDomain.domainId}:{" "}
          {selectedDomainVaults.length > 0
            ? selectedDomainVaults.map((vault) => vault.assetMint).join(" · ")
            : "none yet"}
        </p>
      ) : null}
      <div className="protocol-actions">
        <button
          type="button"
          className="plans-primary-cta"
          disabled={
            !canAct
            || !governanceReady
            || !selectedReserveDomainAddress
            || !assetMint.trim()
            || vaultAlreadyExists
            || busy === "Create domain asset vault"
          }
          onClick={() => run("Create domain asset vault", async () => {
            const { blockhash } = await connection.getLatestBlockhash("confirmed");
            return buildCreateDomainAssetVaultTx({
              authority: publicKey!,
              reserveDomainAddress: selectedReserveDomainAddress,
              assetMint: assetMint.trim(),
              recentBlockhash: blockhash,
              vaultTokenAccountAddress: vaultTokenAccount.trim() || undefined,
            });
          })}
        >
          {vaultAlreadyExists ? "VAULT_EXISTS" : "CREATE_DOMAIN_ASSET_VAULT"}
        </button>
      </div>
    </article>
  );
}
