// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import { FieldHint } from "@/components/field-hint";
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
  confirmLabel: string;
  confirmHelp?: string | null;
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
  confirmLabel,
  confirmHelp,
  disabledInputs,
  confirmDisabled,
}: StepVerificationProps) {
  return (
    <section className="wizard-section">
      <div className="wizard-section-heading">
        <div className="space-y-1">
          <p className="wizard-section-kicker">Verification</p>
          <h3 className="wizard-section-title">Who should be allowed to confirm outcomes?</h3>
        </div>
        <FieldHint
          content="Start with the verifier set, then set the approval threshold and policy toggles that govern claim submissions."
          side="end"
        />
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
        <p className="wizard-inline-copy">
          Business-origin launches keep the OmegaX Health verifier selected by default.
        </p>
      ) : null}

      {lockRequiredOracle && requiredOracleAddress && requiredOracleDiscovered === false ? (
        <p className="field-error">The required business verifier is not discoverable on this network yet.</p>
      ) : null}

      <div className="wizard-section-block">
        <div className="wizard-inline-head">
          <p className="wizard-section-label">How many confirmations are required?</p>
          <FieldHint
            content="The selected verifier count updates automatically. Only the required confirmation count needs manual input."
            side="end"
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="field-label">
            Required confirmations
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
            Selected verifier count
            <input className="field-input" type="number" min="1" value={quorumN} disabled />
          </label>
        </div>
      </div>

      <div className="space-y-3">
        <label className="wizard-toggle-row">
          <span>
            <span className="wizard-section-label">Only use verified schemas</span>
            <span className="wizard-inline-copy block">
              Keep payout rules tied to governance-verified outcome schemas.
            </span>
          </span>
          <input
            type="checkbox"
            checked={requireVerifiedSchema}
            onChange={(event) => onRequireVerifiedSchemaChange(event.target.checked)}
            disabled={disabledInputs}
          />
        </label>

        <label className="wizard-toggle-row">
          <span>
            <span className="wizard-section-label">Allow delegated reward claims</span>
            <span className="wizard-inline-copy block">
              Let a sponsor or service submit reward claims for members.
            </span>
          </span>
          <input
            type="checkbox"
            checked={allowDelegateClaim}
            onChange={(event) => onAllowDelegateClaimChange(event.target.checked)}
            disabled={disabledInputs}
          />
        </label>
      </div>

      <div className="wizard-action-block">
        <div className="space-y-2">
          <p className="wizard-section-label">Save verification</p>
          <p className="wizard-inline-copy">Lock in the verifier set and quorum before you define payout rules.</p>
        </div>
        <button
          type="button"
          className="action-button hidden w-full sm:inline-flex sm:w-auto"
          onClick={onConfirmVerification}
          disabled={confirmDisabled}
        >
          {confirmLabel}
        </button>
        {confirmHelp ? (
          <p className={confirmDisabled ? "field-error" : "wizard-inline-copy"}>
            {confirmHelp}
          </p>
        ) : null}
      </div>
    </section>
  );
}
