import Mathlib.Algebra.BigOperators.Fin
import QEDGen.Solana.Account
import QEDGenMathlib.IndexedState

namespace OmegaxProtocol

open QEDGen.Solana
open QEDGen.Solana.IndexedState

abbrev BASIS_POINTS_DENOMINATOR : Nat := 10000
abbrev MAX_CONFIGURED_FEE_BPS : Nat := 9999
abbrev MAX_SELECTED_ASSET_PAYOUT_OVERPAY_BPS : Nat := 50

abbrev AccountIdx : Type := Fin MAX_CONFIGURED_FEE_BPS

structure ActivateCommitmentArgs where
  deriving Repr, DecidableEq, BEq

instance : Inhabited ActivateCommitmentArgs := ⟨{
}⟩

structure AdjudicateClaimCaseArgs where
  review_state : Nat
  approved_amount : Nat
  denied_amount : Nat
  reserve_amount : Nat
  deriving Repr, DecidableEq, BEq

instance : Inhabited AdjudicateClaimCaseArgs := ⟨{
  review_state := 0,
  approved_amount := 0,
  denied_amount := 0,
  reserve_amount := 0,
}⟩

structure AllocateCapitalArgs where
  amount : Nat
  deriving Repr, DecidableEq, BEq

instance : Inhabited AllocateCapitalArgs := ⟨{
  amount := 0,
}⟩

structure AttachClaimEvidenceRefArgs where
  deriving Repr, DecidableEq, BEq

instance : Inhabited AttachClaimEvidenceRefArgs := ⟨{
}⟩

structure AttestClaimCaseArgs where
  deriving Repr, DecidableEq, BEq

instance : Inhabited AttestClaimCaseArgs := ⟨{
}⟩

structure AuthorizeClaimRecipientArgs where
  deriving Repr, DecidableEq, BEq

instance : Inhabited AuthorizeClaimRecipientArgs := ⟨{
}⟩

structure BackfillSchemaDependencyLedgerArgs where
  deriving Repr, DecidableEq, BEq

instance : Inhabited BackfillSchemaDependencyLedgerArgs := ⟨{
}⟩

structure ConfigureReserveAssetRailArgs where
  active : Bool
  max_confidence_bps : Nat
  deriving Repr, DecidableEq, BEq

instance : Inhabited ConfigureReserveAssetRailArgs := ⟨{
  active := false,
  max_confidence_bps := 0,
}⟩

structure CreateAllocationPositionArgs where
  cap_amount : Nat
  weight_bps : Nat
  deriving Repr, DecidableEq, BEq

instance : Inhabited CreateAllocationPositionArgs := ⟨{
  cap_amount := 0,
  weight_bps := 0,
}⟩

structure CreateCapitalClassArgs where
  fee_bps : Nat
  pause_flags : Nat
  deriving Repr, DecidableEq, BEq

instance : Inhabited CreateCapitalClassArgs := ⟨{
  fee_bps := 0,
  pause_flags := 0,
}⟩

structure CreateCommitmentCampaignArgs where
  deposit_amount : Nat
  coverage_amount : Nat
  deriving Repr, DecidableEq, BEq

instance : Inhabited CreateCommitmentCampaignArgs := ⟨{
  deposit_amount := 0,
  coverage_amount := 0,
}⟩

structure CreateCommitmentPaymentRailArgs where
  deposit_amount : Nat
  coverage_amount : Nat
  deriving Repr, DecidableEq, BEq

instance : Inhabited CreateCommitmentPaymentRailArgs := ⟨{
  deposit_amount := 0,
  coverage_amount := 0,
}⟩

structure CreateDomainAssetVaultArgs where
  deriving Repr, DecidableEq, BEq

instance : Inhabited CreateDomainAssetVaultArgs := ⟨{
}⟩

structure CreateHealthPlanArgs where
  allowed_rail_mask : Nat
  pause_flags : Nat
  deriving Repr, DecidableEq, BEq

instance : Inhabited CreateHealthPlanArgs := ⟨{
  allowed_rail_mask := 0,
  pause_flags := 0,
}⟩

structure CreateLiquidityPoolArgs where
  fee_bps : Nat
  pause_flags : Nat
  deriving Repr, DecidableEq, BEq

instance : Inhabited CreateLiquidityPoolArgs := ⟨{
  fee_bps := 0,
  pause_flags := 0,
}⟩

structure CreateObligationArgs where
  amount : Nat
  deriving Repr, DecidableEq, BEq

instance : Inhabited CreateObligationArgs := ⟨{
  amount := 0,
}⟩

structure CreatePolicySeriesArgs where
  deriving Repr, DecidableEq, BEq

instance : Inhabited CreatePolicySeriesArgs := ⟨{
}⟩

structure CreateReserveDomainArgs where
  allowed_rail_mask : Nat
  pause_flags : Nat
  deriving Repr, DecidableEq, BEq

instance : Inhabited CreateReserveDomainArgs := ⟨{
  allowed_rail_mask := 0,
  pause_flags := 0,
}⟩

structure DeallocateCapitalArgs where
  amount : Nat
  deriving Repr, DecidableEq, BEq

instance : Inhabited DeallocateCapitalArgs := ⟨{
  amount := 0,
}⟩

structure DepositCommitmentArgs where
  deriving Repr, DecidableEq, BEq

instance : Inhabited DepositCommitmentArgs := ⟨{
}⟩

structure DepositIntoCapitalClassArgs where
  amount : Nat
  shares : Nat
  deriving Repr, DecidableEq, BEq

instance : Inhabited DepositIntoCapitalClassArgs := ⟨{
  amount := 0,
  shares := 0,
}⟩

structure FundSponsorBudgetArgs where
  amount : Nat
  deriving Repr, DecidableEq, BEq

instance : Inhabited FundSponsorBudgetArgs := ⟨{
  amount := 0,
}⟩

structure InitPoolOracleFeeVaultArgs where
  deriving Repr, DecidableEq, BEq

instance : Inhabited InitPoolOracleFeeVaultArgs := ⟨{
}⟩

structure InitPoolTreasuryVaultArgs where
  deriving Repr, DecidableEq, BEq

instance : Inhabited InitPoolTreasuryVaultArgs := ⟨{
}⟩

structure InitProtocolFeeVaultArgs where
  deriving Repr, DecidableEq, BEq

instance : Inhabited InitProtocolFeeVaultArgs := ⟨{
}⟩

structure InitializeProtocolGovernanceArgs where
  protocol_fee_bps : Nat
  emergency_pause : Bool
  deriving Repr, DecidableEq, BEq

instance : Inhabited InitializeProtocolGovernanceArgs := ⟨{
  protocol_fee_bps := 0,
  emergency_pause := false,
}⟩

structure InitializeSeriesReserveLedgerArgs where
  deriving Repr, DecidableEq, BEq

instance : Inhabited InitializeSeriesReserveLedgerArgs := ⟨{
}⟩

structure MarkImpairmentArgs where
  amount : Nat
  deriving Repr, DecidableEq, BEq

instance : Inhabited MarkImpairmentArgs := ⟨{
  amount := 0,
}⟩

structure OpenClaimCaseArgs where
  deriving Repr, DecidableEq, BEq

instance : Inhabited OpenClaimCaseArgs := ⟨{
}⟩

structure OpenFundingLineArgs where
  deriving Repr, DecidableEq, BEq

instance : Inhabited OpenFundingLineArgs := ⟨{
}⟩

structure OpenMemberPositionArgs where
  eligibility_status : Nat
  delegated_rights : Nat
  deriving Repr, DecidableEq, BEq

instance : Inhabited OpenMemberPositionArgs := ⟨{
  eligibility_status := 0,
  delegated_rights := 0,
}⟩

structure PauseCommitmentCampaignArgs where
  deriving Repr, DecidableEq, BEq

instance : Inhabited PauseCommitmentCampaignArgs := ⟨{
}⟩

structure ProcessRedemptionQueueArgs where
  shares : Nat
  deriving Repr, DecidableEq, BEq

instance : Inhabited ProcessRedemptionQueueArgs := ⟨{
  shares := 0,
}⟩

structure PublishReserveAssetRailPriceArgs where
  price_usd_1e8 : Nat
  confidence_bps : Nat
  published_at_ts : Nat
  deriving Repr, DecidableEq, BEq

instance : Inhabited PublishReserveAssetRailPriceArgs := ⟨{
  price_usd_1e8 := 0,
  confidence_bps := 0,
  published_at_ts := 0,
}⟩

structure RecordPremiumPaymentArgs where
  amount : Nat
  deriving Repr, DecidableEq, BEq

instance : Inhabited RecordPremiumPaymentArgs := ⟨{
  amount := 0,
}⟩

structure RefundCommitmentArgs where
  deriving Repr, DecidableEq, BEq

instance : Inhabited RefundCommitmentArgs := ⟨{
}⟩

structure RegisterOracleArgs where
  deriving Repr, DecidableEq, BEq

instance : Inhabited RegisterOracleArgs := ⟨{
}⟩

structure RegisterOutcomeSchemaArgs where
  deriving Repr, DecidableEq, BEq

instance : Inhabited RegisterOutcomeSchemaArgs := ⟨{
}⟩

structure ReleaseReserveArgs where
  amount : Nat
  deriving Repr, DecidableEq, BEq

instance : Inhabited ReleaseReserveArgs := ⟨{
  amount := 0,
}⟩

structure RequestRedemptionArgs where
  shares : Nat
  deriving Repr, DecidableEq, BEq

instance : Inhabited RequestRedemptionArgs := ⟨{
  shares := 0,
}⟩

structure ReserveObligationArgs where
  amount : Nat
  deriving Repr, DecidableEq, BEq

instance : Inhabited ReserveObligationArgs := ⟨{
  amount := 0,
}⟩

structure RotateProtocolGovernanceAuthorityArgs where
  deriving Repr, DecidableEq, BEq

instance : Inhabited RotateProtocolGovernanceAuthorityArgs := ⟨{
}⟩

structure SetPoolOracleArgs where
  active : Bool
  deriving Repr, DecidableEq, BEq

instance : Inhabited SetPoolOracleArgs := ⟨{
  active := false,
}⟩

structure SetPoolOraclePermissionsArgs where
  deriving Repr, DecidableEq, BEq

instance : Inhabited SetPoolOraclePermissionsArgs := ⟨{
}⟩

structure SetPoolOraclePolicyArgs where
  quorum_m : Nat
  quorum_n : Nat
  oracle_fee_bps : Nat
  deriving Repr, DecidableEq, BEq

instance : Inhabited SetPoolOraclePolicyArgs := ⟨{
  quorum_m := 0,
  quorum_n := 0,
  oracle_fee_bps := 0,
}⟩

structure SetProtocolEmergencyPauseArgs where
  emergency_pause : Bool
  deriving Repr, DecidableEq, BEq

instance : Inhabited SetProtocolEmergencyPauseArgs := ⟨{
  emergency_pause := false,
}⟩

structure SettleClaimCaseArgs where
  amount : Nat
  deriving Repr, DecidableEq, BEq

instance : Inhabited SettleClaimCaseArgs := ⟨{
  amount := 0,
}⟩

structure SettleClaimCaseSelectedAssetArgs where
  claim_credit_amount : Nat
  payout_amount : Nat
  max_overpay_bps : Nat
  deriving Repr, DecidableEq, BEq

instance : Inhabited SettleClaimCaseSelectedAssetArgs := ⟨{
  claim_credit_amount := 0,
  payout_amount := 0,
  max_overpay_bps := 0,
}⟩

structure SettleObligationArgs where
  amount : Nat
  deriving Repr, DecidableEq, BEq

instance : Inhabited SettleObligationArgs := ⟨{
  amount := 0,
}⟩

structure UpdateAllocationCapsArgs where
  cap_amount : Nat
  weight_bps : Nat
  active : Bool
  deriving Repr, DecidableEq, BEq

instance : Inhabited UpdateAllocationCapsArgs := ⟨{
  cap_amount := 0,
  weight_bps := 0,
  active := false,
}⟩

structure UpdateCapitalClassControlsArgs where
  pause_flags : Nat
  queue_only_redemptions : Bool
  active : Bool
  deriving Repr, DecidableEq, BEq

instance : Inhabited UpdateCapitalClassControlsArgs := ⟨{
  pause_flags := 0,
  queue_only_redemptions := false,
  active := false,
}⟩

structure UpdateHealthPlanControlsArgs where
  allowed_rail_mask : Nat
  pause_flags : Nat
  active : Bool
  deriving Repr, DecidableEq, BEq

instance : Inhabited UpdateHealthPlanControlsArgs := ⟨{
  allowed_rail_mask := 0,
  pause_flags := 0,
  active := false,
}⟩

structure UpdateLpPositionCredentialingArgs where
  credentialed : Bool
  deriving Repr, DecidableEq, BEq

instance : Inhabited UpdateLpPositionCredentialingArgs := ⟨{
  credentialed := false,
}⟩

structure UpdateMemberEligibilityArgs where
  eligibility_status : Nat
  delegated_rights : Nat
  active : Bool
  deriving Repr, DecidableEq, BEq

instance : Inhabited UpdateMemberEligibilityArgs := ⟨{
  eligibility_status := 0,
  delegated_rights := 0,
  active := false,
}⟩

structure UpdateOracleProfileArgs where
  deriving Repr, DecidableEq, BEq

instance : Inhabited UpdateOracleProfileArgs := ⟨{
}⟩

structure UpdateReserveDomainControlsArgs where
  allowed_rail_mask : Nat
  pause_flags : Nat
  active : Bool
  deriving Repr, DecidableEq, BEq

instance : Inhabited UpdateReserveDomainControlsArgs := ⟨{
  allowed_rail_mask := 0,
  pause_flags := 0,
  active := false,
}⟩

structure VerifyOutcomeSchemaArgs where
  verified : Bool
  deriving Repr, DecidableEq, BEq

instance : Inhabited VerifyOutcomeSchemaArgs := ⟨{
  verified := false,
}⟩

structure VersionPolicySeriesArgs where
  deriving Repr, DecidableEq, BEq

instance : Inhabited VersionPolicySeriesArgs := ⟨{
}⟩

structure WithdrawArgs where
  amount : Nat
  deriving Repr, DecidableEq, BEq

instance : Inhabited WithdrawArgs := ⟨{
  amount := 0,
}⟩

inductive Status where
  | Uninitialized
  | Live
  deriving Repr, DecidableEq, BEq

structure State where
  governance_authority : Pubkey
  pending_authority : Pubkey
  authority : Pubkey
  plan_admin : Pubkey
  wallet : Pubkey
  depositor : Pubkey
  activation_authority : Pubkey
  owner : Pubkey
  admin : Pubkey
  oracle : Pubkey
  publisher : Pubkey
  audit_nonce : Nat
  protocol_fee_bps : Nat
  emergency_pause : Bool
  allowed_rail_mask : Nat
  pause_flags : Nat
  active : Bool
  total_assets : Nat
  last_price_usd_1e8 : Nat
  last_price_confidence_bps : Nat
  max_confidence_bps : Nat
  last_price_published_at_ts : Nat
  accrued_fees : Nat
  withdrawn_fees : Nat
  membership_mode : Nat
  eligibility_status : Nat
  delegated_rights : Nat
  funded_amount : Nat
  spent_amount : Nat
  reserved_amount : Nat
  paid_amount : Nat
  approved_amount : Nat
  denied_amount : Nat
  pending_amount : Nat
  activated_amount : Nat
  treasury_locked_amount : Nat
  refunded_amount : Nat
  canceled_amount : Nat
  next_queue_index : Nat
  refunded_at : Nat
  intake_status : Nat
  review_state : Nat
  recovered_amount : Nat
  appeal_count : Nat
  attestation_count : Nat
  supported_schema_count : Nat
  updated_at_ts : Nat
  updated_at : Nat
  created_at_ts : Nat
  closed_at : Nat
  oracle_fee_bps : Nat
  quorum_m : Nat
  quorum_n : Nat
  challenge_window_secs : Nat
  cap_amount : Nat
  weight_bps : Nat
  allocated_amount : Nat
  allocated_assets : Nat
  total_allocated : Nat
  pending_redemption_shares : Nat
  pending_redemption_assets : Nat
  pending_redemptions : Nat
  total_shares : Nat
  nav_assets : Nat
  queue_only_redemptions : Bool
  credentialed : Bool
  claimed : Bool
  verified : Bool
  closed_outcome_schema_count : Nat
  commitment_deposit_amount : Nat
  refund_amount : Nat
  settlement_net_payout_amount : Nat
  claim_net_payout_amount : Nat
  redemption_net_payout_amount : Nat
  fee_withdrawal_amount : Nat
  bump : Nat
  status : Status

def initialize_protocol_governanceTransition (s : State) (signer : Pubkey) (args : InitializeProtocolGovernanceArgs) : Option State :=
  if signer = s.governance_authority ∧ s.status = .Uninitialized ∧ (args.protocol_fee_bps ≤ 9999) then
    some { s with protocol_fee_bps := args.protocol_fee_bps, emergency_pause := args.emergency_pause, audit_nonce := 0, status := .Live }
  else none

def set_protocol_emergency_pauseTransition (s : State) (signer : Pubkey) (args : SetProtocolEmergencyPauseArgs) : Option State :=
  if signer = s.authority ∧ s.status = .Live then
    some { s with emergency_pause := args.emergency_pause, status := .Live }
  else none

def rotate_protocol_governance_authorityTransition (s : State) (signer : Pubkey) (args : RotateProtocolGovernanceAuthorityArgs) : Option State :=
  if signer = s.authority ∧ s.status = .Live then
    some { s with status := .Live }
  else none

def accept_protocol_governance_authorityTransition (s : State) (signer : Pubkey) : Option State :=
  if signer = s.pending_authority ∧ s.status = .Live then
    some { s with governance_authority := s.pending_authority, status := .Live }
  else none

def cancel_protocol_governance_authority_transferTransition (s : State) (signer : Pubkey) : Option State :=
  if signer = s.authority ∧ s.status = .Live then
    some { s with status := .Live }
  else none

def create_reserve_domainTransition (s : State) (signer : Pubkey) (args : CreateReserveDomainArgs) : Option State :=
  if signer = s.authority ∧ s.status = .Live then
    some { s with status := .Live }
  else none

def update_reserve_domain_controlsTransition (s : State) (signer : Pubkey) (args : UpdateReserveDomainControlsArgs) : Option State :=
  if signer = s.authority ∧ s.status = .Live then
    some { s with allowed_rail_mask := args.allowed_rail_mask, pause_flags := args.pause_flags, active := args.active, status := .Live }
  else none

def create_domain_asset_vaultTransition (s : State) (signer : Pubkey) (args : CreateDomainAssetVaultArgs) : Option State :=
  if signer = s.authority ∧ s.status = .Live then
    some { s with total_assets := 0, status := .Live }
  else none

def configure_reserve_asset_railTransition (s : State) (signer : Pubkey) (args : ConfigureReserveAssetRailArgs) : Option State :=
  if signer = s.authority ∧ s.status = .Live ∧ (s.emergency_pause = false) then
    some { s with max_confidence_bps := args.max_confidence_bps, status := .Live }
  else none

def publish_reserve_asset_rail_priceTransition (s : State) (signer : Pubkey) (args : PublishReserveAssetRailPriceArgs) : Option State :=
  if signer = s.authority ∧ s.status = .Live ∧ (s.emergency_pause = false) ∧ (args.price_usd_1e8 > 0) ∧ (s.max_confidence_bps > 0) ∧ (args.confidence_bps ≤ s.max_confidence_bps) then
    some { s with last_price_usd_1e8 := args.price_usd_1e8, last_price_confidence_bps := args.confidence_bps, last_price_published_at_ts := args.published_at_ts, status := .Live }
  else none

def init_protocol_fee_vaultTransition (s : State) (signer : Pubkey) (args : InitProtocolFeeVaultArgs) : Option State :=
  if signer = s.authority ∧ s.status = .Live then
    some { s with accrued_fees := 0, withdrawn_fees := 0, status := .Live }
  else none

def init_pool_treasury_vaultTransition (s : State) (signer : Pubkey) (args : InitPoolTreasuryVaultArgs) : Option State :=
  if signer = s.authority ∧ s.status = .Live then
    some { s with accrued_fees := 0, withdrawn_fees := 0, status := .Live }
  else none

def init_pool_oracle_fee_vaultTransition (s : State) (signer : Pubkey) (args : InitPoolOracleFeeVaultArgs) : Option State :=
  if signer = s.authority ∧ s.status = .Live then
    some { s with accrued_fees := 0, withdrawn_fees := 0, status := .Live }
  else none

def create_health_planTransition (s : State) (signer : Pubkey) (args : CreateHealthPlanArgs) : Option State :=
  if signer = s.plan_admin ∧ s.status = .Live then
    some { s with status := .Live }
  else none

def update_health_plan_controlsTransition (s : State) (signer : Pubkey) (args : UpdateHealthPlanControlsArgs) : Option State :=
  if signer = s.authority ∧ s.status = .Live then
    some { s with active := args.active, status := .Live }
  else none

def create_policy_seriesTransition (s : State) (signer : Pubkey) (args : CreatePolicySeriesArgs) : Option State :=
  if signer = s.authority ∧ s.status = .Live then
    some { s with status := .Live }
  else none

def initialize_series_reserve_ledgerTransition (s : State) (signer : Pubkey) (args : InitializeSeriesReserveLedgerArgs) : Option State :=
  if signer = s.authority ∧ s.status = .Live then
    some { s with status := .Live }
  else none

def version_policy_seriesTransition (s : State) (signer : Pubkey) (args : VersionPolicySeriesArgs) : Option State :=
  if signer = s.authority ∧ s.status = .Live then
    some { s with status := .Live }
  else none

def open_member_positionTransition (s : State) (signer : Pubkey) (args : OpenMemberPositionArgs) : Option State :=
  if signer = s.wallet ∧ s.status = .Live ∧ (s.emergency_pause = false) ∧ (s.active = true) then
    some { s with eligibility_status := args.eligibility_status, delegated_rights := args.delegated_rights, status := .Live }
  else none

def update_member_eligibilityTransition (s : State) (signer : Pubkey) (args : UpdateMemberEligibilityArgs) : Option State :=
  if signer = s.authority ∧ s.status = .Live then
    some { s with eligibility_status := args.eligibility_status, delegated_rights := args.delegated_rights, active := args.active, status := .Live }
  else none

def open_funding_lineTransition (s : State) (signer : Pubkey) (args : OpenFundingLineArgs) : Option State :=
  if signer = s.authority ∧ s.status = .Live then
    some { s with status := .Live }
  else none

def fund_sponsor_budgetTransition (s : State) (signer : Pubkey) (args : FundSponsorBudgetArgs) : Option State :=
  if signer = s.authority ∧ s.status = .Live ∧ (s.emergency_pause = false) ∧ (args.amount > 0) then
    some { s with status := .Live }
  else none

def record_premium_paymentTransition (s : State) (signer : Pubkey) (args : RecordPremiumPaymentArgs) : Option State :=
  if signer = s.authority ∧ s.status = .Live ∧ (s.emergency_pause = false) ∧ (args.amount > 0) then
    some { s with status := .Live }
  else none

def create_commitment_campaignTransition (s : State) (signer : Pubkey) (args : CreateCommitmentCampaignArgs) : Option State :=
  if signer = s.authority ∧ s.status = .Live ∧ (s.emergency_pause = false) ∧ (args.deposit_amount > 0) ∧ (args.coverage_amount > 0) then
    some { s with status := .Live }
  else none

def create_commitment_payment_railTransition (s : State) (signer : Pubkey) (args : CreateCommitmentPaymentRailArgs) : Option State :=
  if signer = s.authority ∧ s.status = .Live ∧ (s.emergency_pause = false) ∧ (args.deposit_amount > 0) ∧ (args.coverage_amount > 0) then
    some { s with status := .Live }
  else none

def deposit_commitmentTransition (s : State) (signer : Pubkey) (args : DepositCommitmentArgs) : Option State :=
  if signer = s.depositor ∧ s.status = .Live ∧ (s.emergency_pause = false) then
    some { s with status := .Live }
  else none

def activate_direct_premium_commitmentTransition (s : State) (signer : Pubkey) (args : ActivateCommitmentArgs) : Option State :=
  if signer = s.activation_authority ∧ s.status = .Live ∧ (s.emergency_pause = false) then
    some { s with status := .Live }
  else none

def activate_treasury_credit_commitmentTransition (s : State) (signer : Pubkey) (args : ActivateCommitmentArgs) : Option State :=
  if signer = s.activation_authority ∧ s.status = .Live ∧ (s.emergency_pause = false) then
    some { s with status := .Live }
  else none

def activate_waterfall_commitmentTransition (s : State) (signer : Pubkey) (args : ActivateCommitmentArgs) : Option State :=
  if signer = s.activation_authority ∧ s.status = .Live ∧ (s.emergency_pause = false) then
    some { s with status := .Live }
  else none

def refund_commitmentTransition (s : State) (signer : Pubkey) (args : RefundCommitmentArgs) : Option State :=
  if signer = s.depositor ∧ s.status = .Live then
    some { s with status := .Live }
  else none

def pause_commitment_campaignTransition (s : State) (signer : Pubkey) (args : PauseCommitmentCampaignArgs) : Option State :=
  if signer = s.authority ∧ s.status = .Live ∧ (s.emergency_pause = false) then
    some { s with status := .Live }
  else none

def create_obligationTransition (s : State) (signer : Pubkey) (args : CreateObligationArgs) : Option State :=
  if signer = s.authority ∧ s.status = .Live ∧ (s.emergency_pause = false) ∧ (args.amount > 0) then
    some { s with status := .Live }
  else none

def reserve_obligationTransition (s : State) (signer : Pubkey) (args : ReserveObligationArgs) : Option State :=
  if signer = s.authority ∧ s.status = .Live ∧ (s.emergency_pause = false) ∧ (args.amount > 0) then
    some { s with status := .Live }
  else none

def settle_obligationTransition (s : State) (signer : Pubkey) (args : SettleObligationArgs) : Option State :=
  if signer = s.authority ∧ s.status = .Live ∧ (s.emergency_pause = false) ∧ (args.amount > 0) then
    some { s with status := .Live }
  else none

def release_reserveTransition (s : State) (signer : Pubkey) (args : ReleaseReserveArgs) : Option State :=
  if signer = s.authority ∧ s.status = .Live ∧ (s.emergency_pause = false) ∧ (args.amount > 0) then
    some { s with status := .Live }
  else none

def open_claim_caseTransition (s : State) (signer : Pubkey) (args : OpenClaimCaseArgs) : Option State :=
  if signer = s.authority ∧ s.status = .Live ∧ (s.emergency_pause = false) ∧ (s.active = true) then
    some { s with review_state := 0, status := .Live }
  else none

def authorize_claim_recipientTransition (s : State) (signer : Pubkey) (args : AuthorizeClaimRecipientArgs) : Option State :=
  if signer = s.authority ∧ s.status = .Live ∧ (s.emergency_pause = false) then
    some { s with status := .Live }
  else none

def attach_claim_evidence_refTransition (s : State) (signer : Pubkey) (args : AttachClaimEvidenceRefArgs) : Option State :=
  if signer = s.authority ∧ s.status = .Live ∧ (s.emergency_pause = false) then
    some { s with status := .Live }
  else none

def adjudicate_claim_caseTransition (s : State) (signer : Pubkey) (args : AdjudicateClaimCaseArgs) : Option State :=
  if signer = s.authority ∧ s.status = .Live ∧ (s.emergency_pause = false) ∧ (args.reserve_amount ≤ args.approved_amount) then
    some { s with review_state := args.review_state, approved_amount := args.approved_amount, denied_amount := args.denied_amount, status := .Live }
  else none

def settle_claim_caseTransition (s : State) (signer : Pubkey) (args : SettleClaimCaseArgs) : Option State :=
  if signer = s.authority ∧ s.status = .Live ∧ (s.emergency_pause = false) ∧ (args.amount > 0) ∧ (s.paid_amount + args.amount ≤ s.approved_amount) then
    some { s with status := .Live }
  else none

def settle_claim_case_selected_assetTransition (s : State) (signer : Pubkey) (args : SettleClaimCaseSelectedAssetArgs) : Option State :=
  if signer = s.authority ∧ s.status = .Live ∧ (s.emergency_pause = false) ∧ (args.claim_credit_amount > 0) ∧ (args.payout_amount > 0) ∧ (args.max_overpay_bps ≤ 50) ∧ (s.paid_amount + args.claim_credit_amount ≤ s.approved_amount) then
    some { s with status := .Live }
  else none

def create_liquidity_poolTransition (s : State) (signer : Pubkey) (args : CreateLiquidityPoolArgs) : Option State :=
  if signer = s.authority ∧ s.status = .Live ∧ (args.fee_bps ≤ 9999) then
    some { s with status := .Live }
  else none

def create_capital_classTransition (s : State) (signer : Pubkey) (args : CreateCapitalClassArgs) : Option State :=
  if signer = s.authority ∧ s.status = .Live ∧ (args.fee_bps ≤ 9999) then
    some { s with status := .Live }
  else none

def update_capital_class_controlsTransition (s : State) (signer : Pubkey) (args : UpdateCapitalClassControlsArgs) : Option State :=
  if signer = s.authority ∧ s.status = .Live then
    some { s with pause_flags := args.pause_flags, queue_only_redemptions := args.queue_only_redemptions, active := args.active, status := .Live }
  else none

def update_lp_position_credentialingTransition (s : State) (signer : Pubkey) (args : UpdateLpPositionCredentialingArgs) : Option State :=
  if signer = s.authority ∧ s.status = .Live then
    some { s with credentialed := args.credentialed, status := .Live }
  else none

def deposit_into_capital_classTransition (s : State) (signer : Pubkey) (args : DepositIntoCapitalClassArgs) : Option State :=
  if signer = s.owner ∧ s.status = .Live ∧ (s.emergency_pause = false) ∧ (args.amount > 0) ∧ (s.active = true) then
    some { s with status := .Live }
  else none

def request_redemptionTransition (s : State) (signer : Pubkey) (args : RequestRedemptionArgs) : Option State :=
  if signer = s.owner ∧ s.status = .Live ∧ (s.emergency_pause = false) ∧ (args.shares > 0) then
    some { s with status := .Live }
  else none

def process_redemption_queueTransition (s : State) (signer : Pubkey) (args : ProcessRedemptionQueueArgs) : Option State :=
  if signer = s.authority ∧ s.status = .Live ∧ (s.emergency_pause = false) ∧ (args.shares > 0) then
    some { s with status := .Live }
  else none

def withdraw_protocol_fee_splTransition (s : State) (signer : Pubkey) (args : WithdrawArgs) : Option State :=
  if signer = s.authority ∧ s.status = .Live ∧ (args.amount > 0) ∧ (s.withdrawn_fees + args.amount ≤ s.accrued_fees) then
    some { s with status := .Live }
  else none

def withdraw_protocol_fee_solTransition (s : State) (signer : Pubkey) (args : WithdrawArgs) : Option State :=
  if signer = s.authority ∧ s.status = .Live ∧ (args.amount > 0) ∧ (s.withdrawn_fees + args.amount ≤ s.accrued_fees) then
    some { s with status := .Live }
  else none

def withdraw_pool_treasury_splTransition (s : State) (signer : Pubkey) (args : WithdrawArgs) : Option State :=
  if signer = s.authority ∧ s.status = .Live ∧ (args.amount > 0) ∧ (s.withdrawn_fees + args.amount ≤ s.accrued_fees) then
    some { s with status := .Live }
  else none

def withdraw_pool_treasury_solTransition (s : State) (signer : Pubkey) (args : WithdrawArgs) : Option State :=
  if signer = s.authority ∧ s.status = .Live ∧ (args.amount > 0) ∧ (s.withdrawn_fees + args.amount ≤ s.accrued_fees) then
    some { s with status := .Live }
  else none

def withdraw_pool_oracle_fee_splTransition (s : State) (signer : Pubkey) (args : WithdrawArgs) : Option State :=
  if signer = s.authority ∧ s.status = .Live ∧ (args.amount > 0) ∧ (s.withdrawn_fees + args.amount ≤ s.accrued_fees) then
    some { s with status := .Live }
  else none

def withdraw_pool_oracle_fee_solTransition (s : State) (signer : Pubkey) (args : WithdrawArgs) : Option State :=
  if signer = s.authority ∧ s.status = .Live ∧ (args.amount > 0) ∧ (s.withdrawn_fees + args.amount ≤ s.accrued_fees) then
    some { s with status := .Live }
  else none

def create_allocation_positionTransition (s : State) (signer : Pubkey) (args : CreateAllocationPositionArgs) : Option State :=
  if signer = s.authority ∧ s.status = .Live then
    some { s with cap_amount := args.cap_amount, weight_bps := args.weight_bps, status := .Live }
  else none

def update_allocation_capsTransition (s : State) (signer : Pubkey) (args : UpdateAllocationCapsArgs) : Option State :=
  if signer = s.authority ∧ s.status = .Live then
    some { s with cap_amount := args.cap_amount, weight_bps := args.weight_bps, status := .Live }
  else none

def allocate_capitalTransition (s : State) (signer : Pubkey) (args : AllocateCapitalArgs) : Option State :=
  if signer = s.authority ∧ s.status = .Live ∧ (s.emergency_pause = false) ∧ (args.amount > 0) then
    some { s with status := .Live }
  else none

def deallocate_capitalTransition (s : State) (signer : Pubkey) (args : DeallocateCapitalArgs) : Option State :=
  if signer = s.authority ∧ s.status = .Live ∧ (s.emergency_pause = false) ∧ (args.amount > 0) then
    some { s with status := .Live }
  else none

def mark_impairmentTransition (s : State) (signer : Pubkey) (args : MarkImpairmentArgs) : Option State :=
  if signer = s.authority ∧ s.status = .Live ∧ (s.emergency_pause = false) ∧ (args.amount > 0) then
    some { s with status := .Live }
  else none

def register_oracleTransition (s : State) (signer : Pubkey) (args : RegisterOracleArgs) : Option State :=
  if signer = s.admin ∧ s.status = .Live then
    some { s with active := true, status := .Live }
  else none

def claim_oracleTransition (s : State) (signer : Pubkey) : Option State :=
  if signer = s.oracle ∧ s.status = .Live then
    some { s with claimed := true, status := .Live }
  else none

def update_oracle_profileTransition (s : State) (signer : Pubkey) (args : UpdateOracleProfileArgs) : Option State :=
  if signer = s.authority ∧ s.status = .Live then
    some { s with status := .Live }
  else none

def set_pool_oracleTransition (s : State) (signer : Pubkey) (args : SetPoolOracleArgs) : Option State :=
  if signer = s.authority ∧ s.status = .Live then
    some { s with active := args.active, status := .Live }
  else none

def set_pool_oracle_permissionsTransition (s : State) (signer : Pubkey) (args : SetPoolOraclePermissionsArgs) : Option State :=
  if signer = s.authority ∧ s.status = .Live then
    some { s with status := .Live }
  else none

def set_pool_oracle_policyTransition (s : State) (signer : Pubkey) (args : SetPoolOraclePolicyArgs) : Option State :=
  if signer = s.authority ∧ s.status = .Live ∧ (args.oracle_fee_bps ≤ 9999) then
    some { s with quorum_m := args.quorum_m, quorum_n := args.quorum_n, status := .Live }
  else none

def register_outcome_schemaTransition (s : State) (signer : Pubkey) (args : RegisterOutcomeSchemaArgs) : Option State :=
  if signer = s.publisher ∧ s.status = .Live then
    some { s with status := .Live }
  else none

def verify_outcome_schemaTransition (s : State) (signer : Pubkey) (args : VerifyOutcomeSchemaArgs) : Option State :=
  if signer = s.governance_authority ∧ s.status = .Live then
    some { s with verified := args.verified, status := .Live }
  else none

def backfill_schema_dependency_ledgerTransition (s : State) (signer : Pubkey) (args : BackfillSchemaDependencyLedgerArgs) : Option State :=
  if signer = s.governance_authority ∧ s.status = .Live then
    some { s with status := .Live }
  else none

def close_outcome_schemaTransition (s : State) (signer : Pubkey) : Option State :=
  if signer = s.governance_authority ∧ s.status = .Live then
    some { s with status := .Live }
  else none

def attest_claim_caseTransition (s : State) (signer : Pubkey) (args : AttestClaimCaseArgs) : Option State :=
  if signer = s.oracle ∧ s.status = .Live then
    some { s with status := .Live }
  else none

inductive Operation where
  | initialize_protocol_governance (args : InitializeProtocolGovernanceArgs)
  | set_protocol_emergency_pause (args : SetProtocolEmergencyPauseArgs)
  | rotate_protocol_governance_authority (args : RotateProtocolGovernanceAuthorityArgs)
  | accept_protocol_governance_authority
  | cancel_protocol_governance_authority_transfer
  | create_reserve_domain (args : CreateReserveDomainArgs)
  | update_reserve_domain_controls (args : UpdateReserveDomainControlsArgs)
  | create_domain_asset_vault (args : CreateDomainAssetVaultArgs)
  | configure_reserve_asset_rail (args : ConfigureReserveAssetRailArgs)
  | publish_reserve_asset_rail_price (args : PublishReserveAssetRailPriceArgs)
  | init_protocol_fee_vault (args : InitProtocolFeeVaultArgs)
  | init_pool_treasury_vault (args : InitPoolTreasuryVaultArgs)
  | init_pool_oracle_fee_vault (args : InitPoolOracleFeeVaultArgs)
  | create_health_plan (args : CreateHealthPlanArgs)
  | update_health_plan_controls (args : UpdateHealthPlanControlsArgs)
  | create_policy_series (args : CreatePolicySeriesArgs)
  | initialize_series_reserve_ledger (args : InitializeSeriesReserveLedgerArgs)
  | version_policy_series (args : VersionPolicySeriesArgs)
  | open_member_position (args : OpenMemberPositionArgs)
  | update_member_eligibility (args : UpdateMemberEligibilityArgs)
  | open_funding_line (args : OpenFundingLineArgs)
  | fund_sponsor_budget (args : FundSponsorBudgetArgs)
  | record_premium_payment (args : RecordPremiumPaymentArgs)
  | create_commitment_campaign (args : CreateCommitmentCampaignArgs)
  | create_commitment_payment_rail (args : CreateCommitmentPaymentRailArgs)
  | deposit_commitment (args : DepositCommitmentArgs)
  | activate_direct_premium_commitment (args : ActivateCommitmentArgs)
  | activate_treasury_credit_commitment (args : ActivateCommitmentArgs)
  | activate_waterfall_commitment (args : ActivateCommitmentArgs)
  | refund_commitment (args : RefundCommitmentArgs)
  | pause_commitment_campaign (args : PauseCommitmentCampaignArgs)
  | create_obligation (args : CreateObligationArgs)
  | reserve_obligation (args : ReserveObligationArgs)
  | settle_obligation (args : SettleObligationArgs)
  | release_reserve (args : ReleaseReserveArgs)
  | open_claim_case (args : OpenClaimCaseArgs)
  | authorize_claim_recipient (args : AuthorizeClaimRecipientArgs)
  | attach_claim_evidence_ref (args : AttachClaimEvidenceRefArgs)
  | adjudicate_claim_case (args : AdjudicateClaimCaseArgs)
  | settle_claim_case (args : SettleClaimCaseArgs)
  | settle_claim_case_selected_asset (args : SettleClaimCaseSelectedAssetArgs)
  | create_liquidity_pool (args : CreateLiquidityPoolArgs)
  | create_capital_class (args : CreateCapitalClassArgs)
  | update_capital_class_controls (args : UpdateCapitalClassControlsArgs)
  | update_lp_position_credentialing (args : UpdateLpPositionCredentialingArgs)
  | deposit_into_capital_class (args : DepositIntoCapitalClassArgs)
  | request_redemption (args : RequestRedemptionArgs)
  | process_redemption_queue (args : ProcessRedemptionQueueArgs)
  | withdraw_protocol_fee_spl (args : WithdrawArgs)
  | withdraw_protocol_fee_sol (args : WithdrawArgs)
  | withdraw_pool_treasury_spl (args : WithdrawArgs)
  | withdraw_pool_treasury_sol (args : WithdrawArgs)
  | withdraw_pool_oracle_fee_spl (args : WithdrawArgs)
  | withdraw_pool_oracle_fee_sol (args : WithdrawArgs)
  | create_allocation_position (args : CreateAllocationPositionArgs)
  | update_allocation_caps (args : UpdateAllocationCapsArgs)
  | allocate_capital (args : AllocateCapitalArgs)
  | deallocate_capital (args : DeallocateCapitalArgs)
  | mark_impairment (args : MarkImpairmentArgs)
  | register_oracle (args : RegisterOracleArgs)
  | claim_oracle
  | update_oracle_profile (args : UpdateOracleProfileArgs)
  | set_pool_oracle (args : SetPoolOracleArgs)
  | set_pool_oracle_permissions (args : SetPoolOraclePermissionsArgs)
  | set_pool_oracle_policy (args : SetPoolOraclePolicyArgs)
  | register_outcome_schema (args : RegisterOutcomeSchemaArgs)
  | verify_outcome_schema (args : VerifyOutcomeSchemaArgs)
  | backfill_schema_dependency_ledger (args : BackfillSchemaDependencyLedgerArgs)
  | close_outcome_schema
  | attest_claim_case (args : AttestClaimCaseArgs)

def applyOp (s : State) (signer : Pubkey) : Operation → Option State
  | .initialize_protocol_governance args => initialize_protocol_governanceTransition s signer args
  | .set_protocol_emergency_pause args => set_protocol_emergency_pauseTransition s signer args
  | .rotate_protocol_governance_authority args => rotate_protocol_governance_authorityTransition s signer args
  | .accept_protocol_governance_authority => accept_protocol_governance_authorityTransition s signer
  | .cancel_protocol_governance_authority_transfer => cancel_protocol_governance_authority_transferTransition s signer
  | .create_reserve_domain args => create_reserve_domainTransition s signer args
  | .update_reserve_domain_controls args => update_reserve_domain_controlsTransition s signer args
  | .create_domain_asset_vault args => create_domain_asset_vaultTransition s signer args
  | .configure_reserve_asset_rail args => configure_reserve_asset_railTransition s signer args
  | .publish_reserve_asset_rail_price args => publish_reserve_asset_rail_priceTransition s signer args
  | .init_protocol_fee_vault args => init_protocol_fee_vaultTransition s signer args
  | .init_pool_treasury_vault args => init_pool_treasury_vaultTransition s signer args
  | .init_pool_oracle_fee_vault args => init_pool_oracle_fee_vaultTransition s signer args
  | .create_health_plan args => create_health_planTransition s signer args
  | .update_health_plan_controls args => update_health_plan_controlsTransition s signer args
  | .create_policy_series args => create_policy_seriesTransition s signer args
  | .initialize_series_reserve_ledger args => initialize_series_reserve_ledgerTransition s signer args
  | .version_policy_series args => version_policy_seriesTransition s signer args
  | .open_member_position args => open_member_positionTransition s signer args
  | .update_member_eligibility args => update_member_eligibilityTransition s signer args
  | .open_funding_line args => open_funding_lineTransition s signer args
  | .fund_sponsor_budget args => fund_sponsor_budgetTransition s signer args
  | .record_premium_payment args => record_premium_paymentTransition s signer args
  | .create_commitment_campaign args => create_commitment_campaignTransition s signer args
  | .create_commitment_payment_rail args => create_commitment_payment_railTransition s signer args
  | .deposit_commitment args => deposit_commitmentTransition s signer args
  | .activate_direct_premium_commitment args => activate_direct_premium_commitmentTransition s signer args
  | .activate_treasury_credit_commitment args => activate_treasury_credit_commitmentTransition s signer args
  | .activate_waterfall_commitment args => activate_waterfall_commitmentTransition s signer args
  | .refund_commitment args => refund_commitmentTransition s signer args
  | .pause_commitment_campaign args => pause_commitment_campaignTransition s signer args
  | .create_obligation args => create_obligationTransition s signer args
  | .reserve_obligation args => reserve_obligationTransition s signer args
  | .settle_obligation args => settle_obligationTransition s signer args
  | .release_reserve args => release_reserveTransition s signer args
  | .open_claim_case args => open_claim_caseTransition s signer args
  | .authorize_claim_recipient args => authorize_claim_recipientTransition s signer args
  | .attach_claim_evidence_ref args => attach_claim_evidence_refTransition s signer args
  | .adjudicate_claim_case args => adjudicate_claim_caseTransition s signer args
  | .settle_claim_case args => settle_claim_caseTransition s signer args
  | .settle_claim_case_selected_asset args => settle_claim_case_selected_assetTransition s signer args
  | .create_liquidity_pool args => create_liquidity_poolTransition s signer args
  | .create_capital_class args => create_capital_classTransition s signer args
  | .update_capital_class_controls args => update_capital_class_controlsTransition s signer args
  | .update_lp_position_credentialing args => update_lp_position_credentialingTransition s signer args
  | .deposit_into_capital_class args => deposit_into_capital_classTransition s signer args
  | .request_redemption args => request_redemptionTransition s signer args
  | .process_redemption_queue args => process_redemption_queueTransition s signer args
  | .withdraw_protocol_fee_spl args => withdraw_protocol_fee_splTransition s signer args
  | .withdraw_protocol_fee_sol args => withdraw_protocol_fee_solTransition s signer args
  | .withdraw_pool_treasury_spl args => withdraw_pool_treasury_splTransition s signer args
  | .withdraw_pool_treasury_sol args => withdraw_pool_treasury_solTransition s signer args
  | .withdraw_pool_oracle_fee_spl args => withdraw_pool_oracle_fee_splTransition s signer args
  | .withdraw_pool_oracle_fee_sol args => withdraw_pool_oracle_fee_solTransition s signer args
  | .create_allocation_position args => create_allocation_positionTransition s signer args
  | .update_allocation_caps args => update_allocation_capsTransition s signer args
  | .allocate_capital args => allocate_capitalTransition s signer args
  | .deallocate_capital args => deallocate_capitalTransition s signer args
  | .mark_impairment args => mark_impairmentTransition s signer args
  | .register_oracle args => register_oracleTransition s signer args
  | .claim_oracle => claim_oracleTransition s signer
  | .update_oracle_profile args => update_oracle_profileTransition s signer args
  | .set_pool_oracle args => set_pool_oracleTransition s signer args
  | .set_pool_oracle_permissions args => set_pool_oracle_permissionsTransition s signer args
  | .set_pool_oracle_policy args => set_pool_oracle_policyTransition s signer args
  | .register_outcome_schema args => register_outcome_schemaTransition s signer args
  | .verify_outcome_schema args => verify_outcome_schemaTransition s signer args
  | .backfill_schema_dependency_ledger args => backfill_schema_dependency_ledgerTransition s signer args
  | .close_outcome_schema => close_outcome_schemaTransition s signer
  | .attest_claim_case args => attest_claim_caseTransition s signer args

/-- Property: abstract_state_progress_nonnegative. -/
def abstract_state_progress_nonnegative (s : State) : Prop :=
  s.audit_nonce ≥ 0

/-- Property: protocol_fee_bps_bounded. -/
def protocol_fee_bps_bounded (s : State) : Prop :=
  s.protocol_fee_bps ≤ 9999

/-- Property: claim_payment_bounded. -/
def claim_payment_bounded (s : State) : Prop :=
  s.paid_amount ≤ s.approved_amount

/-- Property: fee_withdrawals_bounded. -/
def fee_withdrawals_bounded (s : State) : Prop :=
  s.withdrawn_fees ≤ s.accrued_fees

/-- Property: allocation_cap_bounded. -/
def allocation_cap_bounded (s : State) : Prop :=
  s.allocated_amount ≤ s.cap_amount

end OmegaxProtocol
