// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";

import { ProtocolDetailDisclosure } from "@/components/protocol-detail-disclosure";
import { SearchableSelect } from "@/components/searchable-select";
import { executeProtocolTransactionWithToast } from "@/lib/protocol-action-toast";
import {
  buildBackfillSchemaDependencyLedgerTx,
  buildCloseOutcomeSchemaTx,
  buildRegisterOutcomeSchemaTx,
  buildVerifyOutcomeSchemaTx,
  hashStringTo32Hex,
  listPoolRules,
  listSchemaDependencyLedgers,
  listSchemas,
  SCHEMA_FAMILY_CLAIMS_CODING,
  SCHEMA_FAMILY_CLINICAL,
  SCHEMA_FAMILY_KERNEL,
  SCHEMA_VISIBILITY_PRIVATE,
  SCHEMA_VISIBILITY_PUBLIC,
  SCHEMA_VISIBILITY_RESTRICTED,
  type RuleSummary,
  type SchemaDependencyLedgerSummary,
  type SchemaSummary,
} from "@/lib/protocol";
import { formatRpcError } from "@/lib/rpc-errors";

type PoolSchemasPanelProps = {
  poolAddress: string;
  onRefresh?: () => void;
};

function shortAddress(value: string): string {
  if (!value || value.length < 12) return value || "n/a";
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function schemaFamilyLabel(value: number): string {
  switch (value) {
    case SCHEMA_FAMILY_CLINICAL:
      return "Clinical";
    case SCHEMA_FAMILY_CLAIMS_CODING:
      return "Claims coding";
    case SCHEMA_FAMILY_KERNEL:
    default:
      return "Kernel";
  }
}

function schemaVisibilityLabel(value: number): string {
  switch (value) {
    case SCHEMA_VISIBILITY_PRIVATE:
      return "Private";
    case SCHEMA_VISIBILITY_RESTRICTED:
      return "Restricted";
    case SCHEMA_VISIBILITY_PUBLIC:
    default:
      return "Public";
  }
}

export function PoolSchemasPanel({ poolAddress, onRefresh }: PoolSchemasPanelProps) {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const [schemas, setSchemas] = useState<SchemaSummary[]>([]);
  const [rules, setRules] = useState<RuleSummary[]>([]);
  const [dependencies, setDependencies] = useState<SchemaDependencyLedgerSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<"ok" | "error" | null>(null);
  const [txUrl, setTxUrl] = useState<string | null>(null);
  const [schemaSearch, setSchemaSearch] = useState("");
  const [selectedSchemaAddress, setSelectedSchemaAddress] = useState("");
  const [schemaKey, setSchemaKey] = useState("");
  const [schemaVersion, setSchemaVersion] = useState("1");
  const [schemaHashHex, setSchemaHashHex] = useState("00".repeat(32));
  const [metadataUri, setMetadataUri] = useState("");
  const [schemaFamily, setSchemaFamily] = useState(String(SCHEMA_FAMILY_KERNEL));
  const [visibility, setVisibility] = useState(String(SCHEMA_VISIBILITY_PUBLIC));
  const [verifyState, setVerifyState] = useState(true);
  const [manualBackfillRuleAddresses, setManualBackfillRuleAddresses] = useState("");
  const [closeRecipient, setCloseRecipient] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextSchemas, nextRules, nextDependencies] = await Promise.all([
        listSchemas({ connection, verifiedOnly: false }),
        listPoolRules({ connection, poolAddress, enabledOnly: false }),
        listSchemaDependencyLedgers({ connection }),
      ]);
      setSchemas(nextSchemas);
      setRules(nextRules);
      setDependencies(nextDependencies);
      setSelectedSchemaAddress((prev) => {
        if (prev && nextSchemas.some((row) => row.address === prev)) return prev;
        return nextSchemas[0]?.address ?? "";
      });
      onRefresh?.();
    } catch (cause) {
      setError(
        formatRpcError(cause, {
          fallback: "Failed to load schema registry state.",
          rpcEndpoint: connection.rpcEndpoint,
        }),
      );
    } finally {
      setLoading(false);
    }
  }, [connection, onRefresh, poolAddress]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (publicKey && !closeRecipient) {
      setCloseRecipient(publicKey.toBase58());
    }
  }, [closeRecipient, publicKey]);

  const selectedSchema = useMemo(
    () => schemas.find((row) => row.address === selectedSchemaAddress) ?? null,
    [schemas, selectedSchemaAddress],
  );
  const selectedDependency = useMemo(
    () => dependencies.find((row) => row.schemaKeyHashHex === selectedSchema?.schemaKeyHashHex) ?? null,
    [dependencies, selectedSchema?.schemaKeyHashHex],
  );
  const matchingRules = useMemo(
    () => rules.filter((row) => row.schemaKeyHashHex === selectedSchema?.schemaKeyHashHex),
    [rules, selectedSchema?.schemaKeyHashHex],
  );

  async function onRegisterSchema() {
    if (!publicKey || !sendTransaction) return;
    setBusy("register");
    setStatus(null);
    setTxUrl(null);
    try {
      const schemaKeyHashHex = await hashStringTo32Hex(schemaKey.trim());
      const { blockhash } = await connection.getLatestBlockhash("confirmed");
      const tx = buildRegisterOutcomeSchemaTx({
        publisher: publicKey,
        recentBlockhash: blockhash,
        schemaKeyHashHex,
        schemaKey,
        version: Number.parseInt(schemaVersion, 10) || 1,
        schemaHashHex,
        schemaFamily: Number.parseInt(schemaFamily, 10) || 0,
        visibility: Number.parseInt(visibility, 10) || 0,
        metadataUri,
      });
      const result = await executeProtocolTransactionWithToast({
        connection,
        sendTransaction,
        tx,
        label: "Register schema",
        onConfirmed: async () => {
          await refresh();
        },
      });
      if (!result.ok) {
        setStatus(result.error);
        setStatusTone("error");
        return;
      }
      setStatus(result.message);
      setStatusTone("ok");
      setTxUrl(result.explorerUrl);
    } finally {
      setBusy(null);
    }
  }

  async function onVerifySchema() {
    if (!publicKey || !sendTransaction || !selectedSchema) return;
    setBusy("verify");
    setStatus(null);
    setTxUrl(null);
    try {
      const { blockhash } = await connection.getLatestBlockhash("confirmed");
      const tx = buildVerifyOutcomeSchemaTx({
        governanceAuthority: publicKey,
        recentBlockhash: blockhash,
        schemaKeyHashHex: selectedSchema.schemaKeyHashHex,
        verified: verifyState,
      });
      const result = await executeProtocolTransactionWithToast({
        connection,
        sendTransaction,
        tx,
        label: verifyState ? "Verify schema" : "Unverify schema",
        onConfirmed: async () => {
          await refresh();
        },
      });
      if (!result.ok) {
        setStatus(result.error);
        setStatusTone("error");
        return;
      }
      setStatus(result.message);
      setStatusTone("ok");
      setTxUrl(result.explorerUrl);
    } finally {
      setBusy(null);
    }
  }

  async function onBackfillDependencyLedger() {
    if (!publicKey || !sendTransaction || !selectedSchema) return;
    setBusy("backfill");
    setStatus(null);
    setTxUrl(null);
    try {
      const poolRuleAddresses = manualBackfillRuleAddresses
        .split(/[,\s]+/)
        .map((value) => value.trim())
        .filter(Boolean)
        .map((value) => new PublicKey(value));
      const { blockhash } = await connection.getLatestBlockhash("confirmed");
      const tx = buildBackfillSchemaDependencyLedgerTx({
        governanceAuthority: publicKey,
        recentBlockhash: blockhash,
        schemaKeyHashHex: selectedSchema.schemaKeyHashHex,
        poolRuleAddresses,
      });
      const result = await executeProtocolTransactionWithToast({
        connection,
        sendTransaction,
        tx,
        label: "Backfill schema dependency ledger",
        onConfirmed: async () => {
          await refresh();
        },
      });
      if (!result.ok) {
        setStatus(result.error);
        setStatusTone("error");
        return;
      }
      setStatus(result.message);
      setStatusTone("ok");
      setTxUrl(result.explorerUrl);
    } catch (cause) {
      setStatus(cause instanceof Error ? cause.message : "Backfill inputs are invalid.");
      setStatusTone("error");
    } finally {
      setBusy(null);
    }
  }

  async function onCloseSchema() {
    if (!publicKey || !sendTransaction || !selectedSchema || !closeRecipient.trim()) return;
    setBusy("close");
    setStatus(null);
    setTxUrl(null);
    try {
      const recipientSystemAccount = new PublicKey(closeRecipient.trim());
      const { blockhash } = await connection.getLatestBlockhash("confirmed");
      const tx = buildCloseOutcomeSchemaTx({
        governanceAuthority: publicKey,
        recipientSystemAccount,
        recentBlockhash: blockhash,
        schemaKeyHashHex: selectedSchema.schemaKeyHashHex,
      });
      const result = await executeProtocolTransactionWithToast({
        connection,
        sendTransaction,
        tx,
        label: "Close schema",
        onConfirmed: async () => {
          await refresh();
        },
      });
      if (!result.ok) {
        setStatus(result.error);
        setStatusTone("error");
        return;
      }
      setStatus(result.message);
      setStatusTone("ok");
      setTxUrl(result.explorerUrl);
    } catch (cause) {
      setStatus(cause instanceof Error ? cause.message : "Close recipient is invalid.");
      setStatusTone("error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <section className="surface-card-soft space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="metric-label">Schema governance</p>
            <p className="field-help">Register, verify, backfill, and close schemas from inside the pool workspace.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="secondary-button" onClick={() => void refresh()} disabled={loading}>
              {loading ? "Refreshing..." : "Refresh"}
            </button>
            <Link href="/schemas" className="secondary-button inline-flex">
              Open full registry
            </Link>
          </div>
        </div>
        {error ? <p className="field-error">{error}</p> : null}
        {status ? <p className={statusTone === "error" ? "field-error" : "field-help"}>{status}</p> : null}
        {txUrl ? (
          <a className="secondary-button inline-flex w-fit" href={txUrl} target="_blank" rel="noreferrer">
            View transaction
          </a>
        ) : null}
      </section>

      <section className="surface-card-soft space-y-3">
        <div>
          <p className="metric-label">Current pool schema state</p>
          <p className="field-help">{rules.length} pool rules mapped across {schemas.length} known schemas.</p>
        </div>

        <SearchableSelect
          label="Schema"
          value={selectedSchemaAddress}
          options={schemas.map((schema) => ({
            value: schema.address,
            label: `${schema.schemaKey} v${schema.version}`,
            hint: `${schema.verified ? "Verified" : "Draft"} | ${schemaFamilyLabel(schema.schemaFamily)} | ${schemaVisibilityLabel(schema.visibility)}`,
          }))}
          onChange={setSelectedSchemaAddress}
          searchValue={schemaSearch}
          onSearchChange={setSchemaSearch}
          loading={loading}
          placeholder="Select schema"
        />

        {selectedSchema ? (
          <div className="grid gap-3 md:grid-cols-2">
            <article className="rounded-2xl border border-[var(--border)]/60 bg-[var(--surface)] p-3">
              <p className="metric-label">Selected schema</p>
              <ul className="mt-2 space-y-1 text-sm text-[var(--muted-foreground)]">
                <li>Publisher: {shortAddress(selectedSchema.publisher)}</li>
                <li>Key hash: {shortAddress(selectedSchema.schemaKeyHashHex)}</li>
                <li>Family: {schemaFamilyLabel(selectedSchema.schemaFamily)}</li>
                <li>Visibility: {schemaVisibilityLabel(selectedSchema.visibility)}</li>
                <li>Verified: {selectedSchema.verified ? "Yes" : "No"}</li>
              </ul>
            </article>

            <article className="rounded-2xl border border-[var(--border)]/60 bg-[var(--surface)] p-3">
              <p className="metric-label">Dependency ledger</p>
              <ul className="mt-2 space-y-1 text-sm text-[var(--muted-foreground)]">
                <li>Tracked dependencies: {selectedDependency?.poolRuleAddresses.length ?? 0}</li>
                <li>Pool rules using schema: {matchingRules.length}</li>
                <li>Metadata: {selectedSchema.metadataUri || "n/a"}</li>
              </ul>
            </article>
          </div>
        ) : (
          <p className="field-help">No schema selected.</p>
        )}
      </section>

      <section className="surface-card-soft space-y-3">
        <div className="operator-task-head">
          <h3 className="operator-task-title">Register schema</h3>
          <p className="operator-task-copy">Add a new schema to the registry with readable metadata first. Low-level hashes still stay available when needed.</p>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          <label className="space-y-1">
            <span className="metric-label">Schema key</span>
            <input
              className="field-input"
              value={schemaKey}
              onChange={(event) => setSchemaKey(event.target.value)}
              placeholder="omegax.partner.custom_outcomes"
            />
          </label>
          <label className="space-y-1">
            <span className="metric-label">Version</span>
            <input className="field-input" value={schemaVersion} onChange={(event) => setSchemaVersion(event.target.value)} />
          </label>
          <label className="space-y-1 lg:col-span-2">
            <span className="metric-label">Schema hash</span>
            <input className="field-input font-mono" value={schemaHashHex} onChange={(event) => setSchemaHashHex(event.target.value)} />
          </label>
          <label className="space-y-1 lg:col-span-2">
            <span className="metric-label">Metadata URI</span>
            <input
              className="field-input"
              value={metadataUri}
              onChange={(event) => setMetadataUri(event.target.value)}
              placeholder="https://schemas.yourorg.com/custom-outcomes.json"
            />
          </label>
          <label className="space-y-1">
            <span className="metric-label">Family</span>
            <select className="field-input" value={schemaFamily} onChange={(event) => setSchemaFamily(event.target.value)}>
              <option value={String(SCHEMA_FAMILY_KERNEL)}>Kernel</option>
              <option value={String(SCHEMA_FAMILY_CLINICAL)}>Clinical</option>
              <option value={String(SCHEMA_FAMILY_CLAIMS_CODING)}>Claims coding</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="metric-label">Visibility</span>
            <select className="field-input" value={visibility} onChange={(event) => setVisibility(event.target.value)}>
              <option value={String(SCHEMA_VISIBILITY_PUBLIC)}>Public</option>
              <option value={String(SCHEMA_VISIBILITY_PRIVATE)}>Private</option>
              <option value={String(SCHEMA_VISIBILITY_RESTRICTED)}>Restricted</option>
            </select>
          </label>
        </div>
        <button type="button" className="action-button" onClick={() => void onRegisterSchema()} disabled={!publicKey || busy === "register"}>
          {busy === "register" ? "Registering..." : "Register schema"}
        </button>
      </section>

      <section className="surface-card-soft space-y-3">
        <div className="operator-task-head">
          <h3 className="operator-task-title">Schema state</h3>
          <p className="operator-task-copy">Use the selected schema for the common verify or unverify action, then open maintenance details only for backfill or close work.</p>
        </div>
        <label className="toggle-card">
          <div>
            <p className="toggle-card-title">{verifyState ? "Mark selected schema verified" : "Mark selected schema unverified"}</p>
            <p className="field-help">This affects the selected schema only. Use maintenance details below for dependency backfills or closing.</p>
          </div>
          <input type="checkbox" checked={verifyState} onChange={(event) => setVerifyState(event.target.checked)} />
        </label>
        <button type="button" className="action-button" onClick={() => void onVerifySchema()} disabled={!selectedSchema || !publicKey || busy === "verify"}>
          {busy === "verify" ? "Submitting..." : verifyState ? "Verify selected schema" : "Mark selected schema unverified"}
        </button>
        <ProtocolDetailDisclosure
          title="Schema maintenance"
          summary="Backfill and close actions remain available here when you need them."
          description="Backfill updates the dependency ledger for the selected schema. Closing should only happen once you are sure the registry entry is no longer needed."
        >
          <div className="grid gap-3 lg:grid-cols-2">
            <label className="space-y-1 lg:col-span-2">
              <span className="metric-label">Backfill rule addresses (optional)</span>
              <textarea className="field-input min-h-[92px] font-mono" value={manualBackfillRuleAddresses} onChange={(event) => setManualBackfillRuleAddresses(event.target.value)} placeholder="Comma or whitespace separated pool rule addresses" />
            </label>
            <button type="button" className="secondary-button" onClick={() => void onBackfillDependencyLedger()} disabled={!selectedSchema || !publicKey || busy === "backfill"}>
              {busy === "backfill" ? "Backfilling..." : "Backfill dependency ledger"}
            </button>
            <div />
            <label className="space-y-1">
              <span className="metric-label">Close recipient</span>
              <input className="field-input" value={closeRecipient} onChange={(event) => setCloseRecipient(event.target.value)} />
            </label>
            <button type="button" className="secondary-button" onClick={() => void onCloseSchema()} disabled={!selectedSchema || !publicKey || !closeRecipient || busy === "close"}>
              {busy === "close" ? "Closing..." : "Close schema"}
            </button>
          </div>
        </ProtocolDetailDisclosure>
      </section>
    </div>
  );
}
