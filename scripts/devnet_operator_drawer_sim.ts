// SPDX-License-Identifier: AGPL-3.0-or-later

// Devnet simulate-only smoke harness for the operator drawer builders.
//
// Replicates the exact argument construction used by
// frontend/components/plan-operator-drawer.tsx and
// frontend/components/governance-operator-drawer.tsx, then signs each tx
// with the local governance keypair and runs connection.simulateTransaction
// against devnet. Does NOT submit. No state is mutated.
//
// Usage:
//   npm run devnet:operator:drawer:sim
//
// Keypair is read from SOLANA_KEYPAIR (falls back to ~/.config/solana/id.json).
// The pubkey must equal the devnet governance wallet configured in
// NEXT_PUBLIC_DEVNET_PROTOCOL_GOVERNANCE_WALLET; mismatch aborts before any
// RPC work.

import { Buffer } from "node:buffer";
import { createHash, randomBytes } from "node:crypto";
import { homedir } from "node:os";
import { resolve } from "node:path";

import { keypairFromFile } from "./support/script_helpers.ts";

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";

import { loadEnvFile } from "./support/load_env_file.ts";

type ProtocolModule = typeof import("../frontend/lib/protocol.ts");
type FixturesModule = typeof import("../frontend/lib/devnet-fixtures.ts");

const FRONTEND_ENV_PATH = resolve(process.cwd(), "frontend/.env.local");
const DEFAULT_KEYPAIR_PATH = resolve(homedir(), ".config/solana/id.json");
const DEFAULT_RPC_URL = "https://api.devnet.solana.com";

type FlowResult = {
  name: string;
  section: "governance" | "plan";
  // PASS               — simulate succeeded cleanly
  // EXPECTED_COLLISION — account already bootstrapped (idempotent collision)
  // BUILDER_OK         — instruction decoded + accounts loaded + reached
  //                      the program, but live state / authority rejected it.
  // FAIL               — actual builder or wiring bug (runtime rejected tx
  //                      before it reached the program or hit known UI inputs)
  // SKIP               — required fixture missing
  status: "PASS" | "EXPECTED_COLLISION" | "BUILDER_OK" | "FAIL" | "SKIP";
  note?: string;
};

function hashStringTo32HexLocal(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function hashReason(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const normalized = trimmed.toLowerCase().replace(/^0x/, "");
  if (/^[0-9a-f]{64}$/.test(normalized)) return normalized;
  return hashStringTo32HexLocal(trimmed);
}

function normalizedMembershipLabel(value?: string | null): string {
  return (value ?? "").trim().toLowerCase().replace(/[-\s]+/g, "_");
}

function membershipModeForPlan(protocol: ProtocolModule, plan: { membershipModeValue?: number; membershipModel: string }): number {
  if (typeof plan.membershipModeValue === "number") return plan.membershipModeValue;
  const label = normalizedMembershipLabel(plan.membershipModel);
  if (label.includes("invite")) return protocol.MEMBERSHIP_MODE_INVITE_ONLY;
  if (
    label.includes("token") ||
    label.includes("nft") ||
    label.includes("stake") ||
    label.includes("fungible")
  ) {
    return protocol.MEMBERSHIP_MODE_TOKEN_GATE;
  }
  return protocol.MEMBERSHIP_MODE_OPEN;
}

function membershipGateKindForPlan(
  protocol: ProtocolModule,
  plan: { membershipGateKindValue?: number; membershipGateKind?: string; membershipModel: string },
): number {
  if (typeof plan.membershipGateKindValue === "number") return plan.membershipGateKindValue;
  const gateLabel = normalizedMembershipLabel(plan.membershipGateKind);
  if (gateLabel.includes("invite")) return protocol.MEMBERSHIP_GATE_KIND_INVITE_ONLY;
  if (gateLabel.includes("nft")) return protocol.MEMBERSHIP_GATE_KIND_NFT_ANCHOR;
  if (gateLabel.includes("stake")) return protocol.MEMBERSHIP_GATE_KIND_STAKE_ANCHOR;
  if (gateLabel.includes("fungible") || gateLabel.includes("token")) {
    return protocol.MEMBERSHIP_GATE_KIND_FUNGIBLE_SNAPSHOT;
  }

  const mode = membershipModeForPlan(protocol, plan);
  if (mode === protocol.MEMBERSHIP_MODE_INVITE_ONLY) return protocol.MEMBERSHIP_GATE_KIND_INVITE_ONLY;
  if (mode === protocol.MEMBERSHIP_MODE_TOKEN_GATE) return protocol.MEMBERSHIP_GATE_KIND_FUNGIBLE_SNAPSHOT;
  return protocol.MEMBERSHIP_GATE_KIND_OPEN;
}

function proofModeForPlan(protocol: ProtocolModule, plan: { membershipModeValue?: number; membershipModel: string }): number {
  const mode = membershipModeForPlan(protocol, plan);
  if (mode === protocol.MEMBERSHIP_MODE_INVITE_ONLY) return protocol.MEMBERSHIP_PROOF_MODE_INVITE_PERMIT;
  if (mode === protocol.MEMBERSHIP_MODE_TOKEN_GATE) return protocol.MEMBERSHIP_PROOF_MODE_TOKEN_GATE;
  return protocol.MEMBERSHIP_PROOF_MODE_OPEN;
}

function classifyError(
  logs: string[],
  isBootstrap: boolean,
): "EXPECTED_COLLISION" | "BUILDER_OK" | "FAIL" {
  const joined = logs.join(" ").toLowerCase();
  if (
    joined.includes("already in use") ||
    joined.includes("already initialized") ||
    // 0x0 on an init-constrained account path with bootstrap flows means the
    // SystemProgram Allocate rejected because the PDA is already materialized.
    (isBootstrap && joined.includes("custom program error: 0x0"))
  ) {
    return "EXPECTED_COLLISION";
  }
  const anchorCode = logs
    .find((l) => l.includes("Error Code: "))
    ?.replace(/.*Error Code: /, "")
    .split(".")[0]
    ?.trim();
  if (
    anchorCode === "ConstraintSeeds" ||
    anchorCode === "MembershipProofModeMismatch" ||
    anchorCode === "MembershipGateConfigurationInvalid" ||
    anchorCode === "MembershipTokenGateAccountMissing" ||
    anchorCode === "MembershipInviteAuthorityInvalid"
  ) {
    return "FAIL";
  }
  // If the program emitted an AnchorError, the builder reached the program
  // cleanly (instruction decoded, accounts loaded). That is a builder-level
  // success for state / auth / lifecycle rejections that depend on live data.
  if (logs.some((l) => l.includes("AnchorError"))) return "BUILDER_OK";
  return "FAIL";
}

// The protocol module resolves @solana/web3.js from frontend/node_modules,
// while this script resolves it from root/node_modules. Even when both are
// the same version, the Transaction class prototypes differ and cross-instance
// signing fails in Message.serialize. Rebuild each tx in our local class.
function localizeTx(foreignTx: { instructions: readonly unknown[] }, blockhash: string, feePayer: PublicKey): Transaction {
  const instructions = foreignTx.instructions.map((ix) => {
    const typed = ix as {
      keys: Array<{ pubkey: { toBase58?: () => string; toString?: () => string } | string; isSigner: boolean; isWritable: boolean }>;
      programId: { toBase58?: () => string; toString?: () => string } | string;
      data: Uint8Array | Buffer;
    };
    return new TransactionInstruction({
      keys: typed.keys.map((k) => ({
        pubkey: new PublicKey(
          typeof k.pubkey === "string" ? k.pubkey : (k.pubkey.toBase58?.() ?? k.pubkey.toString!()),
        ),
        isSigner: k.isSigner,
        isWritable: k.isWritable,
      })),
      programId: new PublicKey(
        typeof typed.programId === "string"
          ? typed.programId
          : (typed.programId.toBase58?.() ?? typed.programId.toString!()),
      ),
      data: Buffer.from(typed.data),
    });
  });
  return new Transaction({ feePayer, recentBlockhash: blockhash }).add(...instructions);
}

async function simulate(
  connection: Connection,
  signer: Keypair,
  blockhash: string,
  foreignTx: { instructions: readonly unknown[] },
  name: string,
  section: "governance" | "plan",
  isBootstrap = false,
): Promise<FlowResult> {
  try {
    const tx = localizeTx(foreignTx, blockhash, signer.publicKey);
    tx.sign(signer);
    const sim = await connection.simulateTransaction(tx, undefined, false);
    if (sim.value.err) {
      const logs = sim.value.logs ?? [];
      const anchorLine = logs.find((l) => l.includes("AnchorError")) ?? "";
      const errCodeLine = logs.find((l) => /Error Code: [A-Z]/.test(l)) ?? "";
      const composed = `${JSON.stringify(sim.value.err)} ${anchorLine} ${errCodeLine}`;
      const verdict = classifyError(logs, isBootstrap);
      return {
        name,
        section,
        status: verdict,
        note:
          verdict === "EXPECTED_COLLISION"
            ? "fixture already bootstrapped (idempotent collision)"
            : verdict === "BUILDER_OK"
              ? `program rejected: ${errCodeLine.replace(/.*Error Code: /, "").trim() || anchorLine}`
              : composed.trim().slice(0, 240),
      };
    }
    return { name, section, status: "PASS" };
  } catch (err) {
    return {
      name,
      section,
      status: "FAIL",
      note: err instanceof Error ? err.message.slice(0, 240) : String(err).slice(0, 240),
    };
  }
}

async function main(): Promise<void> {
  loadEnvFile(FRONTEND_ENV_PATH);

  const keypairPath = process.env.SOLANA_KEYPAIR?.trim() || DEFAULT_KEYPAIR_PATH;
  const signer = keypairFromFile(keypairPath);
  const signerAddress = signer.publicKey.toBase58();

  const expectedGov = (process.env.NEXT_PUBLIC_DEVNET_PROTOCOL_GOVERNANCE_WALLET || "").trim();
  if (expectedGov && signerAddress !== expectedGov) {
    throw new Error(
      `Signer pubkey ${signerAddress} does not match NEXT_PUBLIC_DEVNET_PROTOCOL_GOVERNANCE_WALLET=${expectedGov}. Aborting.`,
    );
  }

  const rpcUrl = (process.env.NEXT_PUBLIC_SOLANA_RPC_URL || DEFAULT_RPC_URL).trim();
  const connection = new Connection(rpcUrl, "confirmed");
  const { blockhash } = await connection.getLatestBlockhash("confirmed");

  console.log("Devnet operator drawer simulate-only smoke");
  console.log(`RPC: ${rpcUrl}`);
  console.log(`Signer: ${signerAddress}`);
  console.log(`Blockhash: ${blockhash}`);
  console.log("");

  const protocol = (await import("../frontend/lib/protocol.ts")) as ProtocolModule;
  const fixturesModule = (await import("../frontend/lib/devnet-fixtures.ts")) as FixturesModule;
  const fixtures = fixturesModule.DEVNET_PROTOCOL_FIXTURE_STATE;

  const plan = fixtures.healthPlans[0] ?? null;
  const reserveDomain =
    (plan ? fixtures.reserveDomains.find((domain) => domain.address === plan.reserveDomain) : null) ??
    fixtures.reserveDomains[0] ??
    null;
  const planSeries = plan
    ? fixtures.policySeries.filter((entry) => entry.healthPlan === plan.address)
    : [];
  const planFundingLines = plan
    ? fixtures.fundingLines.filter((entry) => entry.healthPlan === plan.address)
    : [];
  const planMembers = plan
    ? fixtures.memberPositions.filter((entry) => entry.healthPlan === plan.address)
    : [];
  const planClaims = plan
    ? fixtures.claimCases.filter((entry) => entry.healthPlan === plan.address)
    : [];
  const planObligations = plan
    ? fixtures.obligations.filter((entry) => entry.healthPlan === plan.address)
    : [];
  const series = planSeries[0] ?? null;
  const sponsorLine =
    planFundingLines.find((l) => l.lineType === protocol.FUNDING_LINE_TYPE_SPONSOR_BUDGET) ?? null;
  const premiumLine =
    planFundingLines.find((l) => l.lineType === protocol.FUNDING_LINE_TYPE_PREMIUM_INCOME) ?? null;
  const operatorSourceTokenAccount =
    process.env.NEXT_PUBLIC_DEVNET_OPERATOR_SOURCE_TOKEN_ACCOUNT ||
    process.env.OMEGAX_DEVNET_OPERATOR_SOURCE_TOKEN_ACCOUNT ||
    "";
  const vaultTokenForLine = (line: { assetMint: string } | null): string => {
    if (!line) return "";
    const fixtureVault = fixtures.domainAssetVaults.find(
      (vault) => vault.reserveDomain === plan?.reserveDomain && vault.assetMint === line.assetMint,
    ) as { vaultTokenAccount?: string } | undefined;
    if (fixtureVault?.vaultTokenAccount) return fixtureVault.vaultTokenAccount;
    const envName = line.assetMint === fixtures.rewardMint
      ? "OMEGAX_DEVNET_OPEN_REWARD_VAULT_TOKEN_ACCOUNT"
      : "OMEGAX_DEVNET_OPEN_SETTLEMENT_VAULT_TOKEN_ACCOUNT";
    return process.env[envName] ?? "";
  };
  const firstLine = planFundingLines[0] ?? null;
  const claim = planClaims[0] ?? null;
  const obligation =
    planObligations.find((entry) => entry.address === claim?.linkedObligation) ??
    planObligations.find((entry) => entry.claimCase === claim?.address) ??
    planObligations[0] ??
    null;
  const member =
    (claim ? planMembers.find((entry) => entry.address === claim.memberPosition) : null) ??
    planMembers[0] ??
    null;
  const capitalClass = fixtures.capitalClasses[0] ?? null;
  const pool = fixtures.liquidityPools[0] ?? null;
  const allocation =
    fixtures.allocationPositions.find((entry) => entry.healthPlan === plan?.address) ??
    fixtures.allocationPositions[0] ??
    null;

  const results: FlowResult[] = [];

  const skip = (name: string, section: "governance" | "plan", reason: string): FlowResult => ({
    name,
    section,
    status: "SKIP",
    note: reason,
  });

  // ── GOVERNANCE DRAWER ─────────────────────────────────────────────────────

  results.push(
    await simulate(
      connection,
      signer,
      blockhash,
      protocol.buildInitializeProtocolGovernanceTx({
        governanceAuthority: signer.publicKey,
        recentBlockhash: blockhash,
        protocolFeeBps: 0,
        emergencyPaused: false,
      }),
      "Initialize protocol governance",
      "governance",
      true,
    ),
  );

  results.push(
    await simulate(
      connection,
      signer,
      blockhash,
      protocol.buildCreateReserveDomainTx({
        authority: signer.publicKey,
        recentBlockhash: blockhash,
        // Use a random-suffixed id to avoid colliding with bootstrapped domains
        // (we want a *builder-shape* check, not an idempotency probe).
        domainId: `sim-domain-${randomBytes(4).toString("hex")}`,
        displayName: "Simulated domain",
        domainAdmin: signer.publicKey,
        settlementMode: 0,
        legalStructureHashHex: hashReason("simulated-legal"),
        complianceBaselineHashHex: hashReason("simulated-baseline"),
        allowedRailMask: 65535,
        pauseFlags: 0,
      }),
      "Create reserve domain",
      "governance",
    ),
  );

  if (!reserveDomain) {
    results.push(skip("Create domain asset vault", "governance", "no reserve domain fixture"));
  } else {
    // Use the protocol's own settlement mint; simulation will collide if the
    // vault is already bootstrapped for this (domain, mint) pair — that is the
    // expected classification.
    const assetMint =
      process.env.NEXT_PUBLIC_DEVNET_SETTLEMENT_MINT ||
      process.env.NEXT_PUBLIC_DEFAULT_INSURANCE_PAYOUT_MINT ||
      "";
    if (!assetMint) {
      results.push(skip("Create domain asset vault", "governance", "no settlement mint configured"));
    } else {
      // PT-2026-04-27-01/02 fix: vault token account is now PDA-owned and
      // initialized by the program inline, so the OMEGAX_DEVNET_OPEN_SETTLEMENT_VAULT_TOKEN_ACCOUNT
      // env var is no longer required. The token account address is derivable
      // via deriveDomainAssetVaultTokenAccountPda for downstream inflow calls.
      results.push(
        await simulate(
          connection,
          signer,
          blockhash,
          protocol.buildCreateDomainAssetVaultTx({
            authority: signer.publicKey,
            reserveDomainAddress: reserveDomain.address,
            assetMint,
            recentBlockhash: blockhash,
          }),
          "Create domain asset vault",
          "governance",
          true,
        ),
      );
    }
  }

  // ── PLAN DRAWER ───────────────────────────────────────────────────────────

  const requirePlan = <T>(label: string, value: T | null | undefined): T | null => {
    if (!value) {
      results.push(skip(label, "plan", "required fixture missing"));
      return null;
    }
    return value;
  };

  if (plan) {
    // Fund sponsor budget
    const sponsorVaultTokenAccount = vaultTokenForLine(sponsorLine);
    if (sponsorLine && operatorSourceTokenAccount && sponsorVaultTokenAccount) {
      results.push(
        await simulate(
          connection,
          signer,
          blockhash,
          protocol.buildFundSponsorBudgetTx({
            authority: signer.publicKey,
            healthPlanAddress: plan.address,
            reserveDomainAddress: plan.reserveDomain,
            fundingLineAddress: sponsorLine.address,
            assetMint: sponsorLine.assetMint,
            sourceTokenAccountAddress: operatorSourceTokenAccount,
            vaultTokenAccountAddress: sponsorVaultTokenAccount,
            recentBlockhash: blockhash,
            amount: 100_000n,
            policySeriesAddress: sponsorLine.policySeries ?? null,
          }),
          "Fund sponsor budget",
          "plan",
        ),
      );
    } else {
      results.push(
        skip(
          "Fund sponsor budget",
          "plan",
          sponsorLine
            ? "operator source token account or vault token account missing"
            : "no SPONSOR_BUDGET funding line",
        ),
      );
    }

    // Record premium payment
    const premiumVaultTokenAccount = vaultTokenForLine(premiumLine);
    if (premiumLine && operatorSourceTokenAccount && premiumVaultTokenAccount) {
      results.push(
        await simulate(
          connection,
          signer,
          blockhash,
          protocol.buildRecordPremiumPaymentTx({
            authority: signer.publicKey,
            healthPlanAddress: plan.address,
            reserveDomainAddress: plan.reserveDomain,
            fundingLineAddress: premiumLine.address,
            assetMint: premiumLine.assetMint,
            sourceTokenAccountAddress: operatorSourceTokenAccount,
            vaultTokenAccountAddress: premiumVaultTokenAccount,
            recentBlockhash: blockhash,
            amount: 100_000n,
            policySeriesAddress: premiumLine.policySeries ?? null,
            capitalClassAddress: capitalClass?.address ?? null,
            poolAssetMint: pool?.depositAssetMint ?? null,
          }),
          "Record premium payment",
          "plan",
        ),
      );
    } else {
      results.push(
        skip(
          "Record premium payment",
          "plan",
          premiumLine
            ? "operator source token account or vault token account missing"
            : "no PREMIUM_INCOME funding line",
        ),
      );
    }

    // Open claim case (use random claim id to probe builder shape)
    if (member && firstLine) {
      results.push(
        await simulate(
          connection,
          signer,
          blockhash,
          protocol.buildOpenClaimCaseTx({
            authority: signer.publicKey,
            healthPlanAddress: plan.address,
            memberPositionAddress: member.address,
            fundingLineAddress: firstLine.address,
            recentBlockhash: blockhash,
            claimId: `sim-${randomBytes(4).toString("hex")}`,
            policySeriesAddress: series?.address ?? firstLine.policySeries ?? null,
            claimantAddress: signer.publicKey,
            evidenceRefHashHex: hashReason("sim-evidence"),
          }),
          "Open claim case",
          "plan",
        ),
      );
    } else {
      results.push(skip("Open claim case", "plan", "no member or funding line"));
    }

    // Attach claim evidence
    if (claim) {
      results.push(
        await simulate(
          connection,
          signer,
          blockhash,
          protocol.buildAttachClaimEvidenceRefTx({
            authority: signer.publicKey,
            healthPlanAddress: plan.address,
            claimCaseAddress: claim.address,
            recentBlockhash: blockhash,
            evidenceRefHashHex: hashReason("sim-evidence"),
            decisionSupportHashHex: hashReason("sim-decision"),
          }),
          "Attach claim evidence",
          "plan",
        ),
      );
    } else {
      results.push(skip("Attach claim evidence", "plan", "no claim case fixture"));
    }

    // Adjudicate claim case
    if (claim) {
      results.push(
        await simulate(
          connection,
          signer,
          blockhash,
          protocol.buildAdjudicateClaimCaseTx({
            authority: signer.publicKey,
            healthPlanAddress: plan.address,
            claimCaseAddress: claim.address,
            recentBlockhash: blockhash,
            reviewState: protocol.CLAIM_INTAKE_UNDER_REVIEW,
            approvedAmount: 0n,
            deniedAmount: 0n,
            reserveAmount: 0n,
            decisionSupportHashHex: hashReason("sim-decision"),
            obligationAddress: obligation?.address ?? null,
          }),
          "Adjudicate claim case",
          "plan",
        ),
      );
    } else {
      results.push(skip("Adjudicate claim case", "plan", "no claim case fixture"));
    }

    // Create obligation
    if (firstLine) {
      results.push(
        await simulate(
          connection,
          signer,
          blockhash,
          protocol.buildCreateObligationTx({
            authority: signer.publicKey,
            healthPlanAddress: plan.address,
            reserveDomainAddress: plan.reserveDomain,
            fundingLineAddress: firstLine.address,
            assetMint: firstLine.assetMint,
            recentBlockhash: blockhash,
            obligationId: `sim-${randomBytes(4).toString("hex")}`,
            policySeriesAddress: series?.address ?? firstLine.policySeries ?? null,
            memberWalletAddress: member?.wallet ?? null,
            beneficiaryAddress: signer.publicKey,
            claimCaseAddress: claim?.address ?? null,
            liquidityPoolAddress: pool?.address ?? null,
            capitalClassAddress: capitalClass?.address ?? null,
            allocationPositionAddress: allocation?.address ?? null,
            deliveryMode: protocol.OBLIGATION_DELIVERY_MODE_CLAIMABLE,
            amount: 10_000n,
            creationReasonHashHex: hashReason("sim-reason"),
            poolAssetMint: pool?.depositAssetMint ?? null,
          }),
          "Create obligation",
          "plan",
        ),
      );
    } else {
      results.push(skip("Create obligation", "plan", "no funding line"));
    }

    // Reserve obligation
    if (obligation && firstLine) {
      results.push(
        await simulate(
          connection,
          signer,
          blockhash,
          protocol.buildReserveObligationTx({
            authority: signer.publicKey,
            healthPlanAddress: plan.address,
            reserveDomainAddress: plan.reserveDomain,
            fundingLineAddress: firstLine.address,
            assetMint: obligation.assetMint,
            obligationAddress: obligation.address,
            recentBlockhash: blockhash,
            amount: 1_000n,
            claimCaseAddress: obligation.claimCase ?? null,
            policySeriesAddress: obligation.policySeries ?? null,
            capitalClassAddress: obligation.capitalClass ?? null,
            allocationPositionAddress: obligation.allocationPosition ?? null,
            poolAssetMint: pool?.depositAssetMint ?? null,
          }),
          "Reserve obligation",
          "plan",
        ),
      );

      results.push(
        await simulate(
          connection,
          signer,
          blockhash,
          protocol.buildReleaseReserveTx({
            authority: signer.publicKey,
            healthPlanAddress: plan.address,
            reserveDomainAddress: plan.reserveDomain,
            fundingLineAddress: firstLine.address,
            assetMint: obligation.assetMint,
            obligationAddress: obligation.address,
            recentBlockhash: blockhash,
            amount: 0n,
            claimCaseAddress: obligation.claimCase ?? null,
            policySeriesAddress: obligation.policySeries ?? null,
            capitalClassAddress: obligation.capitalClass ?? null,
            allocationPositionAddress: obligation.allocationPosition ?? null,
            poolAssetMint: pool?.depositAssetMint ?? null,
          }),
          "Release reserve",
          "plan",
        ),
      );

      results.push(
        await simulate(
          connection,
          signer,
          blockhash,
          protocol.buildSettleObligationTx({
            authority: signer.publicKey,
            healthPlanAddress: plan.address,
            reserveDomainAddress: plan.reserveDomain,
            fundingLineAddress: firstLine.address,
            assetMint: obligation.assetMint,
            obligationAddress: obligation.address,
            recentBlockhash: blockhash,
            nextStatus: protocol.OBLIGATION_STATUS_CLAIMABLE_PAYABLE,
            amount: 0n,
            settlementReasonHashHex: hashReason("sim-settlement"),
            claimCaseAddress: obligation.claimCase ?? null,
            policySeriesAddress: obligation.policySeries ?? null,
            capitalClassAddress: obligation.capitalClass ?? null,
            allocationPositionAddress: obligation.allocationPosition ?? null,
            poolAssetMint: pool?.depositAssetMint ?? null,
          }),
          "Settle obligation",
          "plan",
        ),
      );
    } else {
      results.push(skip("Reserve obligation", "plan", "no obligation or funding line"));
      results.push(skip("Release reserve", "plan", "no obligation or funding line"));
      results.push(skip("Settle obligation", "plan", "no obligation or funding line"));
    }

    // Settle claim
    if (claim && firstLine) {
      results.push(
        await simulate(
          connection,
          signer,
          blockhash,
          protocol.buildSettleClaimCaseTx({
            authority: signer.publicKey,
            healthPlanAddress: plan.address,
            reserveDomainAddress: plan.reserveDomain,
            fundingLineAddress: firstLine.address,
            assetMint: firstLine.assetMint,
            claimCaseAddress: claim.address,
            recentBlockhash: blockhash,
            amount: 0n,
            policySeriesAddress: claim.policySeries ?? null,
            obligationAddress: obligation?.address ?? null,
            capitalClassAddress: obligation?.capitalClass ?? null,
            allocationPositionAddress: obligation?.allocationPosition ?? null,
            poolAssetMint: pool?.depositAssetMint ?? null,
          }),
          "Settle claim case",
          "plan",
        ),
      );
    } else {
      results.push(skip("Settle claim case", "plan", "no claim case or funding line"));
    }

    // Mark impairment
    if (firstLine) {
      results.push(
        await simulate(
          connection,
          signer,
          blockhash,
          protocol.buildMarkImpairmentTx({
            authority: signer.publicKey,
            healthPlanAddress: plan.address,
            reserveDomainAddress: plan.reserveDomain,
            fundingLineAddress: firstLine.address,
            assetMint: obligation?.assetMint ?? firstLine.assetMint,
            recentBlockhash: blockhash,
            amount: 1n,
            reasonHashHex: hashReason("sim-impairment"),
            policySeriesAddress:
              obligation?.policySeries ?? firstLine.policySeries ?? null,
            capitalClassAddress: obligation?.capitalClass ?? capitalClass?.address ?? null,
            allocationPositionAddress:
              obligation?.allocationPosition ?? allocation?.address ?? null,
            obligationAddress: obligation?.address ?? null,
            poolAssetMint: pool?.depositAssetMint ?? null,
          }),
          "Mark impairment",
          "plan",
        ),
      );
    } else {
      results.push(skip("Mark impairment", "plan", "no funding line"));
    }

    // Open member position. Simulate only when the local signer can satisfy
    // the plan posture; otherwise report a real fixture/signature gap instead
    // of turning a guaranteed semantic rejection into "builder ok".
    const memberProofMode = proofModeForPlan(protocol, plan);
    const memberMode = membershipModeForPlan(protocol, plan);
    const memberGateKind = membershipGateKindForPlan(protocol, plan);
    const tokenGateRequired = memberMode === protocol.MEMBERSHIP_MODE_TOKEN_GATE;
    const inviteRequired = memberMode === protocol.MEMBERSHIP_MODE_INVITE_ONLY;
    const inviteAuthority =
      plan.membershipInviteAuthority && plan.membershipInviteAuthority !== protocol.ZERO_PUBKEY
        ? plan.membershipInviteAuthority
        : "";
    const tokenGateAccountAddress = process.env.OMEGAX_DEVNET_MEMBER_TOKEN_GATE_ACCOUNT?.trim() || "";
    const anchorRefAddress =
      memberGateKind === protocol.MEMBERSHIP_GATE_KIND_NFT_ANCHOR
        ? plan.membershipGateMint ?? ""
        : memberGateKind === protocol.MEMBERSHIP_GATE_KIND_STAKE_ANCHOR
          ? tokenGateAccountAddress
          : "";

    if (inviteRequired && inviteAuthority !== signerAddress) {
      results.push(
        skip("Open member position", "plan", "invite authority signer fixture missing"),
      );
    } else if (tokenGateRequired && !tokenGateAccountAddress) {
      results.push(
        skip("Open member position", "plan", "token gate account fixture missing"),
      );
    } else {
      results.push(
        await simulate(
          connection,
          signer,
          blockhash,
          protocol.buildOpenMemberPositionTx({
            wallet: signer.publicKey,
            healthPlanAddress: plan.address,
            recentBlockhash: blockhash,
            seriesScopeAddress: series?.address ?? protocol.ZERO_PUBKEY,
            subjectCommitmentHashHex: hashReason(signer.publicKey.toBase58()),
            eligibilityStatus: protocol.ELIGIBILITY_PENDING,
            delegatedRightsMask: 0,
            proofMode: memberProofMode,
            tokenGateAmountSnapshot: BigInt(plan.membershipGateMinAmount ?? 0),
            inviteIdHashHex: inviteRequired ? hashReason("sim-invite") : "",
            inviteExpiresAt: 0n,
            tokenGateAccountAddress: tokenGateRequired ? tokenGateAccountAddress : undefined,
            anchorRefAddress: anchorRefAddress || undefined,
            inviteAuthorityAddress: inviteRequired ? inviteAuthority : undefined,
          }),
          "Open member position",
          "plan",
          true,
        ),
      );
    }

    // Update member eligibility
    if (member) {
      results.push(
        await simulate(
          connection,
          signer,
          blockhash,
          protocol.buildUpdateMemberEligibilityTx({
            authority: signer.publicKey,
            healthPlanAddress: plan.address,
            walletAddress: member.wallet,
            recentBlockhash: blockhash,
            seriesScopeAddress: member.policySeries,
            eligibilityStatus: protocol.ELIGIBILITY_ELIGIBLE,
            delegatedRightsMask: 0,
            active: true,
          }),
          "Update member eligibility",
          "plan",
        ),
      );
    } else {
      results.push(skip("Update member eligibility", "plan", "no member fixture"));
    }

    // Update plan controls
    results.push(
      await simulate(
        connection,
        signer,
        blockhash,
        protocol.buildUpdateHealthPlanControlsTx({
          authority: signer.publicKey,
          healthPlanAddress: plan.address,
          recentBlockhash: blockhash,
          sponsorOperator: plan.sponsorOperator,
          claimsOperator: plan.claimsOperator,
          oracleAuthority: plan.oracleAuthority ?? protocol.ZERO_PUBKEY,
          membershipMode: membershipModeForPlan(protocol, plan),
          membershipGateKind: membershipGateKindForPlan(protocol, plan),
          membershipGateMint: plan.membershipGateMint ?? protocol.ZERO_PUBKEY,
          membershipGateMinAmount: BigInt(plan.membershipGateMinAmount ?? 0),
          membershipInviteAuthority: plan.membershipInviteAuthority ?? protocol.ZERO_PUBKEY,
          allowedRailMask: 65535,
          defaultFundingPriority: fixtures.fundingLines[0]?.fundingPriority ?? 0,
          pauseFlags: 0,
          active: true,
        }),
        "Update plan controls",
        "plan",
      ),
    );

    // Update reserve domain controls
    if (reserveDomain) {
      results.push(
        await simulate(
          connection,
          signer,
          blockhash,
          protocol.buildUpdateReserveDomainControlsTx({
            authority: signer.publicKey,
            reserveDomainAddress: reserveDomain.address,
            recentBlockhash: blockhash,
            allowedRailMask: 65535,
            pauseFlags: 0,
            active: true,
          }),
          "Update reserve domain controls",
          "plan",
        ),
      );
    } else {
      results.push(skip("Update reserve domain controls", "plan", "no reserve domain"));
    }

    // Create policy series (random seriesId avoids bootstrapped collision,
    // exercises arg-shape correctness against the program constraints).
    {
      const seriesAssetMint =
        process.env.NEXT_PUBLIC_DEVNET_SETTLEMENT_MINT ||
        process.env.NEXT_PUBLIC_DEFAULT_INSURANCE_PAYOUT_MINT ||
        "";
      if (!seriesAssetMint) {
        results.push(skip("Create policy series", "plan", "no settlement mint configured"));
      } else {
        results.push(
          await simulate(
            connection,
            signer,
            blockhash,
            protocol.buildCreatePolicySeriesTx({
              authority: signer.publicKey,
              healthPlanAddress: plan.address,
              assetMint: seriesAssetMint,
              recentBlockhash: blockhash,
              seriesId: `sim-${randomBytes(4).toString("hex")}`,
              displayName: "Simulated series",
              metadataUri: "ipfs://sim",
              mode: protocol.SERIES_MODE_OTHER,
              status: protocol.SERIES_STATUS_DRAFT,
              adjudicationMode: 0,
              cycleSeconds: 0n,
              termsVersion: 1,
            }),
            "Create policy series",
            "plan",
          ),
        );
      }
    }

    // Version policy series — must use an existing series
    if (series) {
      results.push(
        await simulate(
          connection,
          signer,
          blockhash,
          protocol.buildVersionPolicySeriesTx({
            authority: signer.publicKey,
            healthPlanAddress: plan.address,
            currentPolicySeriesAddress: series.address,
            assetMint: series.assetMint,
            recentBlockhash: blockhash,
            seriesId: `sim-v-${randomBytes(4).toString("hex")}`,
            displayName: "Simulated next series",
            metadataUri: "ipfs://sim-v",
            status: series.status,
            adjudicationMode: 0,
            cycleSeconds: 0n,
          }),
          "Version policy series",
          "plan",
        ),
      );
    } else {
      results.push(skip("Version policy series", "plan", "no policy series fixture"));
    }

    // Open funding line (random id)
    {
      const lineAssetMint =
        process.env.NEXT_PUBLIC_DEVNET_SETTLEMENT_MINT ||
        process.env.NEXT_PUBLIC_DEFAULT_INSURANCE_PAYOUT_MINT ||
        "";
      if (!lineAssetMint) {
        results.push(skip("Open funding line", "plan", "no settlement mint configured"));
      } else {
        results.push(
          await simulate(
            connection,
            signer,
            blockhash,
            protocol.buildOpenFundingLineTx({
              authority: signer.publicKey,
              healthPlanAddress: plan.address,
              reserveDomainAddress: plan.reserveDomain,
              assetMint: lineAssetMint,
              recentBlockhash: blockhash,
              lineId: `sim-${randomBytes(4).toString("hex")}`,
              policySeriesAddress: series?.address ?? null,
              lineType: protocol.FUNDING_LINE_TYPE_SPONSOR_BUDGET,
              fundingPriority: 0,
              committedAmount: 0n,
            }),
            "Open funding line",
            "plan",
          ),
        );
      }
    }
  } else {
    const allPlanFlows = [
      "Fund sponsor budget",
      "Record premium payment",
      "Open claim case",
      "Attach claim evidence",
      "Adjudicate claim case",
      "Create obligation",
      "Reserve obligation",
      "Release reserve",
      "Settle obligation",
      "Settle claim case",
      "Mark impairment",
      "Open member position",
      "Update member eligibility",
      "Update plan controls",
      "Update reserve domain controls",
      "Create policy series",
      "Version policy series",
      "Open funding line",
    ];
    for (const name of allPlanFlows) {
      results.push(skip(name, "plan", "no health plan fixture"));
    }
  }

  // ── REPORT ────────────────────────────────────────────────────────────────

  const pad = (s: string, n: number) => String(s ?? "") + " ".repeat(Math.max(0, n - String(s ?? "").length));
  const cleanNote = (s?: string) =>
    (s ?? "").replace(/\s+/g, " ").slice(0, 180);
  console.log(pad("Flow", 34) + pad("Section", 12) + pad("Status", 22) + "Note");
  console.log("-".repeat(140));
  for (const r of results) {
    console.log(
      pad(r.name, 34) + pad(r.section, 12) + pad(r.status, 22) + cleanNote(r.note),
    );
  }
  console.log("");

  const counts = results.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});
  const builderOk =
    (counts.PASS ?? 0) + (counts.EXPECTED_COLLISION ?? 0) + (counts.BUILDER_OK ?? 0);
  const attempted = builderOk + (counts.FAIL ?? 0);
  console.log(
    `Summary: PASS=${counts.PASS ?? 0}  EXPECTED_COLLISION=${counts.EXPECTED_COLLISION ?? 0}  BUILDER_OK=${counts.BUILDER_OK ?? 0}  SKIP=${counts.SKIP ?? 0}  FAIL=${counts.FAIL ?? 0}`,
  );
  console.log(
    `Builder health: ${builderOk}/${attempted} attempted flows reached the program cleanly.`,
  );
  console.log(
    "  PASS               — sim succeeded; tx would submit cleanly",
  );
  console.log(
    "  EXPECTED_COLLISION — fixture already bootstrapped (idempotent)",
  );
  console.log(
    "  BUILDER_OK         — program accepted & rejected semantically (state/auth/lifecycle)",
  );
  console.log(
    "  FAIL               — real builder or wiring bug",
  );

  if ((counts.FAIL ?? 0) > 0) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack || err.message : err);
  process.exit(1);
});
