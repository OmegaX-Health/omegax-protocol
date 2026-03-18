// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import { FieldHint } from "@/components/field-hint";

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
  registerInviteIssuerLabel: string;
  registerInviteIssuerHelp?: string | null;
  onCreatePlan: () => void;
  createPlanDisabled: boolean;
  createPlanLabel: string;
  createPlanHelp?: string | null;
};

function membershipSummary(mode: MembershipMode): string {
  if (mode === "open") return "Anyone can enroll after launch.";
  if (mode === "token_gate") return "Members need a qualifying token balance.";
  return "Only invited wallets can enroll.";
}

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
  registerInviteIssuerLabel,
  registerInviteIssuerHelp,
  onCreatePlan,
  createPlanDisabled,
  createPlanLabel,
  createPlanHelp,
}: StepEligibilityProps) {
  return (
    <section className="wizard-section">
      <div className="wizard-section-heading">
        <div className="space-y-1">
          <p className="wizard-section-kicker">Enrollment</p>
          <h3 className="wizard-section-title">Who should be allowed to join?</h3>
        </div>
        <FieldHint
          content="Choose the membership rule the plan should enforce from day one. You can still manage member operations later in the workspace."
          side="end"
        />
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
          Token-gated
        </button>
        <button
          type="button"
          className={`segment-button ${membershipMode === "invite_only" ? "segment-button-active" : ""}`}
          onClick={() => onMembershipModeChange("invite_only")}
        >
          Invite-only
        </button>
      </div>

      <p className="wizard-inline-copy">{membershipSummary(membershipMode)}</p>

      {membershipMode === "token_gate" ? (
        <div className="wizard-section-block">
          <div className="wizard-inline-head">
            <p className="wizard-section-label">Token gate</p>
            <FieldHint
              content="Members will need to hold at least this token balance before they can enroll."
              side="end"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="field-label">
              Qualifying token mint
              <input
                className="field-input"
                value={tokenGateMint}
                onChange={(event) => onTokenGateMintChange(event.target.value)}
              />
            </label>
            <label className="field-label">
              Minimum token balance
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
        </div>
      ) : null}

      {membershipMode === "invite_only" ? (
        <div className="wizard-section-block">
          <div className="wizard-inline-head">
            <p className="wizard-section-label">Invite issuer</p>
            <FieldHint
              content="Register the wallet that will approve or issue invites before invite-only enrollment goes live."
              side="end"
            />
          </div>

          <label className="field-label">
            Invite issuer wallet
            <input
              className="field-input"
              value={inviteIssuer}
              onChange={(event) => onInviteIssuerChange(event.target.value)}
            />
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="secondary-button"
              onClick={onRegisterInviteIssuer}
              disabled={registerInviteIssuerDisabled}
            >
              {registerInviteIssuerLabel}
            </button>
            <span className={`status-pill ${inviteIssuerReady ? "status-ok" : "status-off"}`}>
              {inviteIssuerReady ? "Issuer ready" : "Issuer not registered"}
            </span>
          </div>

          {registerInviteIssuerHelp ? (
            <p className={registerInviteIssuerDisabled ? "field-error" : "wizard-inline-copy"}>
              {registerInviteIssuerHelp}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="wizard-action-block">
        <div className="space-y-2">
          <p className="wizard-section-label">Create the plan</p>
          <p className="wizard-inline-copy">This saves the plan and its primary policy series on-chain.</p>
        </div>
        <button
          type="button"
          className="action-button hidden w-full sm:inline-flex sm:w-auto"
          onClick={onCreatePlan}
          disabled={createPlanDisabled}
        >
          {createPlanLabel}
        </button>
        {createPlanHelp ? (
          <p className={createPlanDisabled ? "field-error" : "wizard-inline-copy"}>
            {createPlanHelp}
          </p>
        ) : null}
      </div>
    </section>
  );
}
