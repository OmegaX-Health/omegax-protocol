// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

type MembershipMode = "open" | "token_gate" | "invite_only";

type StepEligibilityProps = {
  membershipMode: MembershipMode;
  onMembershipModeChange: (value: MembershipMode) => void;
  tokenGateMint: string;
  onTokenGateMintChange: (value: string) => void;
  tokenGateMinBalance: string;
  onTokenGateMinBalanceChange: (value: string) => void;
  inviteIssuer: string;
  onInviteIssuerChange: (value: string) => void;
  onRegisterInviteIssuer: () => void;
  inviteIssuerReady: boolean;
  registerInviteIssuerDisabled: boolean;
  onCreatePlan: () => void;
  createPlanDisabled: boolean;
};

export function StepEligibility({
  membershipMode,
  onMembershipModeChange,
  tokenGateMint,
  onTokenGateMintChange,
  tokenGateMinBalance,
  onTokenGateMinBalanceChange,
  inviteIssuer,
  onInviteIssuerChange,
  onRegisterInviteIssuer,
  inviteIssuerReady,
  registerInviteIssuerDisabled,
  onCreatePlan,
  createPlanDisabled,
}: StepEligibilityProps) {
  return (
    <section className="surface-card step-card space-y-4">
      <div className="step-head">
        <h3 className="step-title">2. Eligibility & Create Plan</h3>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <button
          type="button"
          className={`segment-button ${membershipMode === "open" ? "segment-button-active" : ""}`}
          onClick={() => onMembershipModeChange("open")}
        >
          Open
        </button>
        <button
          type="button"
          className={`segment-button ${membershipMode === "token_gate" ? "segment-button-active" : ""}`}
          onClick={() => onMembershipModeChange("token_gate")}
        >
          Token-gate
        </button>
        <button
          type="button"
          className={`segment-button ${membershipMode === "invite_only" ? "segment-button-active" : ""}`}
          onClick={() => onMembershipModeChange("invite_only")}
        >
          Invite-only
        </button>
      </div>

      {membershipMode === "token_gate" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="field-label">
            Token gate mint address
            <input className="field-input" value={tokenGateMint} onChange={(event) => onTokenGateMintChange(event.target.value)} />
          </label>
          <label className="field-label">
            Token gate minimum balance
            <input
              className="field-input"
              type="number"
              min="1"
              step="1"
              value={tokenGateMinBalance}
              onChange={(event) => onTokenGateMinBalanceChange(event.target.value)}
            />
          </label>
        </div>
      ) : null}

      {membershipMode === "invite_only" ? (
        <div className="surface-card-soft space-y-3">
          <label className="field-label">
            Invite issuer address
            <input className="field-input" value={inviteIssuer} onChange={(event) => onInviteIssuerChange(event.target.value)} />
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className="secondary-button" onClick={onRegisterInviteIssuer} disabled={registerInviteIssuerDisabled}>
              Register invite issuer
            </button>
            <span className={`status-pill ${inviteIssuerReady ? "status-ok" : "status-off"}`}>
              {inviteIssuerReady ? "Invite issuer registered" : "Invite issuer pending"}
            </span>
          </div>
        </div>
      ) : null}

      <button type="button" className="action-button" onClick={onCreatePlan} disabled={createPlanDisabled}>
        Create Health Plan
      </button>
    </section>
  );
}
