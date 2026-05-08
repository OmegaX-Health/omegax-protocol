# MagicBlock Private Claim Room

OmegaX Private Claim Room is a hackathon adjunct for private Genesis Protect Acute claim review. It uses MagicBlock Ephemeral Rollups for delegated review-session state while the main `omegax_protocol` program remains the Solana settlement and claim-attestation kernel.

The adjunct program is `omegax_private_claim_review`. It stores only public-safe hashes and session state:

- linked claim case
- health plan and policy series
- evidence and schema hashes
- review result and artifact hashes
- review binary and TEE attestation digests
- reviewer/operator key
- private payment reference hash
- lifecycle status and timestamps

Raw medical evidence, encrypted evidence payloads, OCR text, storage paths, and private payment details never belong in this program.

## Demo Flow

1. `omegax-health` prepares a redacted Genesis Protect Acute claim packet and hashes the private evidence bundle.
2. `omegax_private_claim_review::open_review_session` creates a public review-session PDA on base Solana.
3. `delegate_review_session` delegates that session PDA to MagicBlock ER.
4. A TEE/private reviewer checks the private packet and emits a hash-bounded review artifact.
5. `record_private_review` records only review hashes and status on the delegated session.
6. The MagicBlock Private Payments API builds a devnet reimbursement preview; `record_private_payment_ref` stores only its reference hash.
7. `commit_and_close_review_session` commits and undelegates the review session back to Solana.
8. The existing `omegax_protocol::attest_claim_case` consumes the committed review artifact hash through the normal claim attestation path.

## Boundaries

- The main `omegax_protocol` program is not delegated to MagicBlock.
- `ClaimCase`, reserves, vaults, funding lines, obligations, and payout accounts are not delegated.
- The private reviewer may inspect plaintext inside the TEE path, but public Solana only receives hashes and status.
- The hackathon reimbursement preview demonstrates MagicBlock private payments; it does not replace the production reserve kernel.
