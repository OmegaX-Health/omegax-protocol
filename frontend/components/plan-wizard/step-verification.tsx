// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import { MultiOraclePicker } from "@/components/multi-oracle-picker";
import type { MultiOracleOption } from "@/components/multi-oracle-picker";

type StepVerificationProps = {
  oracles: MultiOracleOption[];
  oracleSearch: string;
  onOracleSearchChange: (value: string) => void;
  selectedOracles: string[];
  onToggleOracle: (oracle: string) => void;
  requiredOracleAddress?: string | null;
  lockRequiredOracle?: boolean;
  requiredOracleDiscovered?: boolean;
  quorumM: string;
  onQuorumMChange: (value: string) => void;
  quorumN: string;
  requireVerifiedSchema: boolean;
  onRequireVerifiedSchemaChange: (value: boolean) => void;
  allowDelegateClaim: boolean;
  onAllowDelegateClaimChange: (value: boolean) => void;
  onConfirmVerification: () => void;
  disabledInputs?: boolean;
  confirmDisabled?: boolean;
};

export function StepVerification({
  oracles,
  oracleSearch,
  onOracleSearchChange,
  selectedOracles,
  onToggleOracle,
  requiredOracleAddress,
  lockRequiredOracle,
  requiredOracleDiscovered,
  quorumM,
  onQuorumMChange,
  quorumN,
  requireVerifiedSchema,
  onRequireVerifiedSchemaChange,
  allowDelegateClaim,
  onAllowDelegateClaimChange,
  onConfirmVerification,
  disabledInputs,
  confirmDisabled,
}: StepVerificationProps) {
  return (
    <section className="surface-card step-card space-y-4">
      <div className="step-head">
        <h3 className="step-title">3. Verification Network</h3>
      </div>

      <MultiOraclePicker
        options={oracles}
        search={oracleSearch}
        onSearchChange={onOracleSearchChange}
        selected={selectedOracles}
        onToggle={onToggleOracle}
        requiredOracle={requiredOracleAddress}
        lockRequiredOracle={lockRequiredOracle}
        disabled={disabledInputs}
      />

      {lockRequiredOracle ? (
        <p className="field-help">
          Business-origin policy requires the OmegaX Health oracle verifier to stay selected.
        </p>
      ) : null}
      {lockRequiredOracle && requiredOracleAddress && requiredOracleDiscovered === false ? (
        <p className="field-error">
          Required business oracle is not discoverable on this network.
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="field-label">
          Minimum confirmations (quorum M)
          <input
            className="field-input"
            type="number"
            min="1"
            value={quorumM}
            onChange={(event) => onQuorumMChange(event.target.value)}
            disabled={disabledInputs}
          />
        </label>
        <label className="field-label">
          Verification network size (quorum N)
          <input className="field-input" type="number" min="1" value={quorumN} disabled />
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="field-label">
          Require verified schema
          <select
            className="field-input"
            value={requireVerifiedSchema ? "1" : "0"}
            onChange={(event) => onRequireVerifiedSchemaChange(event.target.value === "1")}
            disabled={disabledInputs}
          >
            <option value="1">Yes</option>
            <option value="0">No</option>
          </select>
        </label>
        <label className="field-label">
          Allow delegate claim
          <select
            className="field-input"
            value={allowDelegateClaim ? "1" : "0"}
            onChange={(event) => onAllowDelegateClaimChange(event.target.value === "1")}
            disabled={disabledInputs}
          >
            <option value="0">No</option>
            <option value="1">Yes</option>
          </select>
        </label>
      </div>

      <p className="field-help">
        Delegate claim primarily affects reward claim flows. Coverage claims currently allow delegated submission.
      </p>

      <button type="button" className="action-button" onClick={onConfirmVerification} disabled={confirmDisabled}>
        Confirm verification network
      </button>
    </section>
  );
}
