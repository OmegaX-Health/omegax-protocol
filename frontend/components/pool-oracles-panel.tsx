// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { ExternalLink, RefreshCw, ShieldCheck } from "lucide-react";

import { SearchableSelect } from "@/components/searchable-select";
import { executeProtocolTransactionWithToast } from "@/lib/protocol-action-toast";
import {
  buildSetPoolOraclePermissionsTx,
  buildSetPoolOraclePolicyTx,
  buildSetPoolOracleTx,
  clearProtocolDiscoveryCache,
  listOraclesWithProfiles,
  listPoolOracleApprovals,
  listPoolOraclePermissionSets,
  listPoolOraclePolicies,
  toExplorerAddressLink,
  type OracleWithProfileSummary,
  type PoolOracleApprovalSummary,
  type PoolOraclePermissionSetSummary,
  type PoolOraclePolicySummary,
} from "@/lib/protocol";
import { formatRpcError } from "@/lib/rpc-errors";

type PoolOraclesPanelProps = {
  poolAddress: string;
  sectionMode?: "standalone" | "embedded";
};

type ApprovedOracleRow = {
  oracle: string;
  approvalActive: boolean;
  registryActive: boolean | null;
  displayName: string;
  websiteUrl: string;
  metadataUri: string;
};

function shortAddress(value: string): string {
  if (!value) return value;
  if (value.length < 12) return value;
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

export function PoolOraclesPanel({ poolAddress, sectionMode = "standalone" }: PoolOraclesPanelProps) {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const embedded = sectionMode === "embedded";
  const canAct = Boolean(publicKey && sendTransaction);

  const [oracles, setOracles] = useState<OracleWithProfileSummary[]>([]);
  const [approvals, setApprovals] = useState<PoolOracleApprovalSummary[]>([]);
  const [permissionSets, setPermissionSets] = useState<PoolOraclePermissionSetSummary[]>([]);
  const [policy, setPolicy] = useState<PoolOraclePolicySummary | null>(null);
  const [search, setSearch] = useState("");
  const [oracleSelectSearch, setOracleSelectSearch] = useState("");
  const [selectedOracleAddress, setSelectedOracleAddress] = useState("");
  const [approvalActive, setApprovalActive] = useState(true);
  const [permissionMask, setPermissionMask] = useState("0");
  const [quorumM, setQuorumM] = useState("2");
  const [quorumN, setQuorumN] = useState("3");
  const [requireVerifiedSchema, setRequireVerifiedSchema] = useState(true);
  const [allowDelegateClaim, setAllowDelegateClaim] = useState(true);
  const [oracleFeeBps, setOracleFeeBps] = useState("0");
  const [challengeWindowSecs, setChallengeWindowSecs] = useState("0");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<"ok" | "error" | null>(null);
  const [txUrl, setTxUrl] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      clearProtocolDiscoveryCache();
      const [nextOracles, nextApprovals, nextPolicies, nextPermissionSets] = await Promise.all([
        listOraclesWithProfiles({ connection, activeOnly: false }),
        listPoolOracleApprovals({ connection, poolAddress, activeOnly: false }),
        listPoolOraclePolicies({ connection, poolAddress }),
        listPoolOraclePermissionSets({ connection, poolAddress }),
      ]);

      setOracles(nextOracles);
      setApprovals(nextApprovals);
      setPolicy(nextPolicies[0] ?? null);
      setPermissionSets(nextPermissionSets);
      setSelectedOracleAddress((prev) => {
        if (prev && nextOracles.some((row) => row.oracle === prev)) return prev;
        return nextApprovals[0]?.oracle ?? nextOracles[0]?.oracle ?? "";
      });
      setLastUpdatedAt(Date.now());
    } catch (cause) {
      setError(
        formatRpcError(cause, {
          fallback: "Failed to load pool oracle network.",
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

  const oracleByAddress = useMemo(() => {
    const map = new Map<string, OracleWithProfileSummary>();
    for (const oracle of oracles) {
      map.set(oracle.oracle, oracle);
    }
    return map;
  }, [oracles]);
  const selectableOracles = useMemo(() => {
    const rows = new Map<string, OracleWithProfileSummary>();
    for (const oracle of oracles) {
      rows.set(oracle.oracle, oracle);
    }
    for (const approval of approvals) {
      if (!rows.has(approval.oracle)) {
        rows.set(approval.oracle, {
          address: approval.address,
          oracle: approval.oracle,
          active: false,
          claimed: false,
          admin: approval.oracle,
          bump: approval.bump,
          metadataUri: "",
        });
      }
    }
    for (const permissionSet of permissionSets) {
      if (!rows.has(permissionSet.oracle)) {
        rows.set(permissionSet.oracle, {
          address: permissionSet.address,
          oracle: permissionSet.oracle,
          active: false,
          claimed: false,
          admin: permissionSet.oracle,
          bump: permissionSet.bump,
          metadataUri: "",
        });
      }
    }
    return Array.from(rows.values()).sort((left, right) => {
      if (left.active !== right.active) return left.active ? -1 : 1;
      return left.oracle.localeCompare(right.oracle);
    });
  }, [approvals, oracles, permissionSets]);

  const approvedOracles = useMemo((): ApprovedOracleRow[] => {
    const query = normalize(search);
    const rows = approvals.map((approval) => {
      const oracle = oracleByAddress.get(approval.oracle);
      const profile = oracle?.profile;
      return {
        oracle: approval.oracle,
        approvalActive: approval.active,
        registryActive: oracle ? oracle.active : null,
        displayName: profile?.displayName || "",
        websiteUrl: profile?.websiteUrl || "",
        metadataUri: oracle?.metadataUri || "",
      };
    });

    const filtered = query
      ? rows.filter((row) =>
        [
          row.oracle,
          row.displayName,
          row.websiteUrl,
          row.metadataUri,
          row.approvalActive ? "approved" : "inactive",
          row.registryActive === null ? "unregistered" : row.registryActive ? "active" : "inactive",
        ].some((value) => normalize(value).includes(query)),
      )
      : rows;

    return filtered.sort((a, b) => {
      if (a.approvalActive !== b.approvalActive) return a.approvalActive ? -1 : 1;
      if (a.registryActive !== b.registryActive) return a.registryActive ? -1 : 1;
      return a.oracle.localeCompare(b.oracle);
    });
  }, [approvals, oracleByAddress, search]);

  const approvalsActiveCount = useMemo(
    () => approvals.filter((row) => row.active).length,
    [approvals],
  );
  const registryActiveCount = useMemo(
    () => oracles.filter((row) => row.active).length,
    [oracles],
  );
  const selectedApproval = useMemo(
    () => approvals.find((row) => row.oracle === selectedOracleAddress) ?? null,
    [approvals, selectedOracleAddress],
  );
  const selectedPermissionSet = useMemo(
    () => permissionSets.find((row) => row.oracle === selectedOracleAddress) ?? null,
    [permissionSets, selectedOracleAddress],
  );
  const selectedOracle = useMemo(
    () => selectableOracles.find((row) => row.oracle === selectedOracleAddress) ?? null,
    [selectableOracles, selectedOracleAddress],
  );
  const oracleSelectorOptions = useMemo(() => {
    const query = normalize(oracleSelectSearch);
    const filtered = query
      ? selectableOracles.filter((oracle) =>
        [
          oracle.oracle,
          oracle.profile?.displayName ?? "",
          oracle.profile?.websiteUrl ?? "",
          oracle.metadataUri,
          oracle.active ? "active" : "inactive",
        ].some((value) => normalize(value).includes(query)),
      )
      : selectableOracles;
    if (selectedOracle && !filtered.some((row) => row.oracle === selectedOracle.oracle)) {
      filtered.unshift(selectedOracle);
    }
    return filtered.map((oracle) => ({
      value: oracle.oracle,
      label: oracle.profile?.displayName || shortAddress(oracle.oracle),
      hint: `${oracle.active ? "Registry active" : "Registry inactive"}${oracle.profile?.websiteUrl ? ` • ${oracle.profile.websiteUrl}` : ""}`,
    }));
  }, [oracleSelectSearch, selectableOracles, selectedOracle]);

  useEffect(() => {
    if (!selectedOracleAddress) return;
    setApprovalActive(selectedApproval?.active ?? true);
    setPermissionMask(String(selectedPermissionSet?.permissions ?? 0));
  }, [selectedApproval?.active, selectedOracleAddress, selectedPermissionSet?.permissions]);

  useEffect(() => {
    if (!policy) return;
    setQuorumM(String(policy.quorumM));
    setQuorumN(String(policy.quorumN));
    setRequireVerifiedSchema(policy.requireVerifiedSchema);
    setAllowDelegateClaim(policy.allowDelegateClaim);
    setOracleFeeBps(String(policy.oracleFeeBps));
    setChallengeWindowSecs(policy.challengeWindowSecs.toString());
  }, [policy]);

  async function onSetPoolOracleApproval() {
    if (!publicKey || !sendTransaction || !selectedOracleAddress) return;
    setBusy("approval");
    setStatus(null);
    setTxUrl(null);
    try {
      const { blockhash } = await connection.getLatestBlockhash("confirmed");
      const tx = buildSetPoolOracleTx({
        authority: publicKey,
        poolAddress: new PublicKey(poolAddress),
        oracle: new PublicKey(selectedOracleAddress),
        recentBlockhash: blockhash,
        active: approvalActive,
      });
      const result = await executeProtocolTransactionWithToast({
        connection,
        sendTransaction,
        tx,
        label: approvalActive ? "Approve oracle" : "Disable oracle approval",
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

  async function onSetOraclePermissions() {
    if (!publicKey || !sendTransaction || !selectedOracleAddress) return;
    setBusy("permissions");
    setStatus(null);
    setTxUrl(null);
    try {
      const { blockhash } = await connection.getLatestBlockhash("confirmed");
      const tx = buildSetPoolOraclePermissionsTx({
        authority: publicKey,
        poolAddress: new PublicKey(poolAddress),
        oracle: new PublicKey(selectedOracleAddress),
        permissions: Number.parseInt(permissionMask, 10) || 0,
        recentBlockhash: blockhash,
      });
      const result = await executeProtocolTransactionWithToast({
        connection,
        sendTransaction,
        tx,
        label: "Set oracle permissions",
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

  async function onSetOraclePolicy() {
    if (!publicKey || !sendTransaction) return;
    setBusy("policy");
    setStatus(null);
    setTxUrl(null);
    try {
      const { blockhash } = await connection.getLatestBlockhash("confirmed");
      const tx = buildSetPoolOraclePolicyTx({
        authority: publicKey,
        poolAddress: new PublicKey(poolAddress),
        recentBlockhash: blockhash,
        quorumM: Number.parseInt(quorumM, 10) || 0,
        quorumN: Number.parseInt(quorumN, 10) || 0,
        requireVerifiedSchema,
        oracleFeeBps: Number.parseInt(oracleFeeBps, 10) || 0,
        allowDelegateClaim,
        challengeWindowSecs: Number.parseInt(challengeWindowSecs, 10) || 0,
      });
      const result = await executeProtocolTransactionWithToast({
        connection,
        sendTransaction,
        tx,
        label: "Set oracle policy",
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

  return (
    <section className={embedded ? "space-y-4" : "surface-card space-y-4"}>
      {!embedded ? (
        <div className="space-y-1">
          <h2 className="hero-title">Oracle Network</h2>
          <p className="hero-copy">
            Oracles verify pool outcomes. This view shows the pool policy (quorum + requirements) and which oracles are approved to participate.
          </p>
        </div>
      ) : null}

      <section className="surface-card-soft space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[var(--accent-strong)]" />
            <p className="metric-label">Pool oracle network</p>
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
          Approvals + quorum determine who can vote on outcomes and settle claims for this pool.
        </p>

        <div className="flex flex-wrap gap-2">
          <span className="status-pill status-off">Approved: {approvalsActiveCount}/{approvals.length}</span>
          <span className="status-pill status-off">Registry active: {registryActiveCount}/{oracles.length}</span>
          {policy ? (
            <span className="status-pill status-off">Quorum: {policy.quorumM}/{policy.quorumN}</span>
          ) : (
            <span className="status-pill status-error">Policy: missing</span>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <a
            className="secondary-button inline-flex items-center gap-2"
            href={toExplorerAddressLink(poolAddress)}
            target="_blank"
            rel="noreferrer"
          >
            <ExternalLink className="h-4 w-4" />
            Pool on Explorer
          </a>
          <Link href="/oracles" className="secondary-button inline-flex">
            Open oracle registry
          </Link>
        </div>

        {error ? <p className="field-error">{error}</p> : null}
        {lastUpdatedAt ? <p className="field-help">Updated {new Date(lastUpdatedAt).toLocaleTimeString()}</p> : null}
      </section>

      <section className="surface-card-soft space-y-2">
        <p className="metric-label">Policy</p>
        {policy ? (
          <div className="flex flex-wrap gap-2">
            <span className="status-pill status-off">Quorum {policy.quorumM}/{policy.quorumN}</span>
            <span className={`status-pill ${policy.requireVerifiedSchema ? "status-ok" : "status-off"}`}>
              Verified schemas {policy.requireVerifiedSchema ? "required" : "optional"}
            </span>
            <span className={`status-pill ${policy.allowDelegateClaim ? "status-ok" : "status-off"}`}>
              Delegate claims {policy.allowDelegateClaim ? "allowed" : "not allowed"}
            </span>
            <span className="status-pill status-off">Oracle fee {policy.oracleFeeBps} bps</span>
            <span className="status-pill status-off">Challenge window {policy.challengeWindowSecs.toString()}s</span>
          </div>
        ) : (
          <p className="field-help">No oracle policy found for this pool yet. Configure it here before outcome voting starts.</p>
        )}

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <label className="space-y-1">
            <span className="metric-label">Quorum M</span>
            <input className="field-input" value={quorumM} onChange={(event) => setQuorumM(event.target.value)} />
          </label>
          <label className="space-y-1">
            <span className="metric-label">Quorum N</span>
            <input className="field-input" value={quorumN} onChange={(event) => setQuorumN(event.target.value)} />
          </label>
          <label className="space-y-1">
            <span className="metric-label">Oracle fee bps</span>
            <input className="field-input" value={oracleFeeBps} onChange={(event) => setOracleFeeBps(event.target.value)} />
          </label>
          <label className="space-y-1 xl:col-span-3">
            <span className="metric-label">Challenge window secs</span>
            <input
              className="field-input"
              value={challengeWindowSecs}
              onChange={(event) => setChallengeWindowSecs(event.target.value)}
            />
          </label>
          <label className="flex items-center gap-2 rounded-2xl border border-[var(--border)]/60 bg-[var(--surface)] px-3 py-2">
            <input
              type="checkbox"
              checked={requireVerifiedSchema}
              onChange={(event) => setRequireVerifiedSchema(event.target.checked)}
            />
            <span className="metric-label">Require verified schema</span>
          </label>
          <label className="flex items-center gap-2 rounded-2xl border border-[var(--border)]/60 bg-[var(--surface)] px-3 py-2">
            <input
              type="checkbox"
              checked={allowDelegateClaim}
              onChange={(event) => setAllowDelegateClaim(event.target.checked)}
            />
            <span className="metric-label">Allow delegate claims</span>
          </label>
        </div>

        <button
          type="button"
          className="action-button"
          onClick={() => void onSetOraclePolicy()}
          disabled={!canAct || busy === "policy"}
        >
          {busy === "policy" ? "Saving..." : policy ? "Save oracle policy" : "Create oracle policy"}
        </button>
      </section>

      <section className="surface-card-soft space-y-3">
        <div>
          <p className="metric-label">Operator controls</p>
          <p className="field-help">
            Manage per-pool oracle approvals and permission masks inline. Legacy raw-address workflows stay out of the default path.
          </p>
        </div>

        <SearchableSelect
          label="Oracle"
          value={selectedOracleAddress}
          options={oracleSelectorOptions}
          onChange={setSelectedOracleAddress}
          searchValue={oracleSelectSearch}
          onSearchChange={setOracleSelectSearch}
          loading={loading}
          placeholder="Select oracle"
          disabled={!selectableOracles.length}
          disabledHint="No oracle registry or pool approval accounts are available yet."
          emptyMessage="No oracles match the current selector."
        />

        {selectedOracle ? (
          <div className="grid gap-3 lg:grid-cols-2">
            <article className="rounded-2xl border border-[var(--border)]/60 bg-[var(--surface)] p-3">
              <p className="metric-label">Selected oracle</p>
              <div className="mt-2 space-y-2">
                <div>
                  <p className="text-sm font-semibold text-[var(--foreground)]">
                    {selectedOracle.profile?.displayName || shortAddress(selectedOracle.oracle)}
                  </p>
                  <p className="text-xs font-mono text-[var(--muted-foreground)] break-all">{selectedOracle.oracle}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className={`status-pill ${selectedOracle.active ? "status-ok" : "status-off"}`}>
                    {selectedOracle.active ? "Registry active" : "Registry inactive"}
                  </span>
                  <span className={`status-pill ${selectedApproval?.active ? "status-ok" : "status-off"}`}>
                    {selectedApproval?.active ? "Pool approved" : "Pool inactive"}
                  </span>
                  <span className="status-pill status-off">
                    Permissions {selectedPermissionSet?.permissions ?? 0}
                  </span>
                </div>
                {selectedOracle.profile?.websiteUrl ? (
                  <a
                    className="text-xs text-[var(--primary)] hover:underline break-all"
                    href={selectedOracle.profile.websiteUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {selectedOracle.profile.websiteUrl}
                  </a>
                ) : null}
                {selectedOracle.metadataUri ? (
                  <p className="field-help break-all">Metadata: {selectedOracle.metadataUri}</p>
                ) : null}
              </div>
            </article>

            <article className="rounded-2xl border border-[var(--border)]/60 bg-[var(--surface)] p-3 space-y-3">
              <label className="flex items-center gap-2 rounded-2xl border border-[var(--border)]/60 bg-[color-mix(in_oklab,var(--surface)_82%,transparent)] px-3 py-2">
                <input type="checkbox" checked={approvalActive} onChange={(event) => setApprovalActive(event.target.checked)} />
                <span className="metric-label">Pool approval active</span>
              </label>
              <label className="space-y-1">
                <span className="metric-label">Permission mask</span>
                <input className="field-input" value={permissionMask} onChange={(event) => setPermissionMask(event.target.value)} />
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="action-button"
                  onClick={() => void onSetPoolOracleApproval()}
                  disabled={!canAct || busy === "approval"}
                >
                  {busy === "approval" ? "Saving..." : approvalActive ? "Approve oracle" : "Disable approval"}
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => void onSetOraclePermissions()}
                  disabled={!canAct || busy === "permissions"}
                >
                  {busy === "permissions" ? "Saving..." : "Update permissions"}
                </button>
              </div>
              {!canAct ? <p className="field-help">Connect an operator or governance wallet to submit oracle changes.</p> : null}
            </article>
          </div>
        ) : (
          <p className="field-help">Select an oracle to review or update its pool approval and permission set.</p>
        )}

        {status ? <p className={statusTone === "error" ? "field-error" : "field-help"}>{status}</p> : null}
        {txUrl ? (
          <a className="secondary-button inline-flex w-fit" href={txUrl} target="_blank" rel="noreferrer">
            View transaction
          </a>
        ) : null}
      </section>

      <section className="surface-card-soft space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="metric-label">Approved oracles</p>
          <span className="status-pill status-off">{approvals.length} total</span>
        </div>

        <input
          className="field-input"
          placeholder="Search approved oracles..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />

        {approvals.length === 0 ? (
          <p className="field-help">No oracle approvals found for this pool.</p>
        ) : approvedOracles.length === 0 ? (
          <p className="field-help">No approved oracles match that search.</p>
        ) : (
          <ul className="space-y-2">
            {approvedOracles.map((row) => (
              <li
                key={row.oracle}
                className="rounded-2xl border border-[var(--border)]/60 bg-[color-mix(in_oklab,var(--surface-strong)_88%,transparent)] p-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm font-semibold text-[var(--foreground)]">
                      {row.displayName || shortAddress(row.oracle)}
                    </p>
                    <p className="text-xs text-[var(--muted-foreground)] font-mono break-all">{row.oracle}</p>
                    {row.websiteUrl ? (
                      <a
                        className="text-xs text-[var(--primary)] hover:underline break-all"
                        href={row.websiteUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {row.websiteUrl}
                      </a>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`status-pill ${row.approvalActive ? "status-ok" : "status-off"}`}>
                      {row.approvalActive ? "Approved" : "Inactive"}
                    </span>
                    <span
                      className={`status-pill ${
                        row.registryActive === null ? "status-error" : row.registryActive ? "status-ok" : "status-off"
                      }`}
                    >
                      {row.registryActive === null
                        ? "Unregistered"
                        : row.registryActive
                          ? "Registry active"
                          : "Registry inactive"}
                    </span>
                    <a
                      className="secondary-button inline-flex items-center gap-1.5 py-1.5 text-xs"
                      href={toExplorerAddressLink(row.oracle)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Explorer
                    </a>
                  </div>
                </div>

                {row.metadataUri ? (
                  <p className="field-help mt-2 break-all">Metadata: {row.metadataUri}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}
