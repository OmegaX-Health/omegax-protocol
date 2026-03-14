# Firebase App Hosting Cutover

This runbook covers the safe way to connect the public `omegax-protocol` repo to Firebase App Hosting.

## Goal

Use a GitHub-connected App Hosting backend with a checked-in `frontend/apphosting.yaml` that contains only:

- public client configuration in `value:`
- runtime-only provider secrets in `secret:`

Do not commit plaintext secrets, private override files, or deployment-only `.env` files.

## Files

- `frontend/apphosting.yaml` is the public-safe config tracked in git
- `frontend/.env.example` is the local developer template
- `frontend/apphosting.local.yaml` is optional for private local experiments and must stay untracked

## What Is Safe To Commit

- Solana program IDs
- public on-chain addresses
- public explorer cluster and public repo URL
- Cloudflare Turnstile site key
- Secret Manager reference names such as `protocolFaucetToken`

## What Must Stay Outside Git

- faucet service base URLs if you do not want them public
- faucet internal tokens
- challenge secrets
- Turnstile secret key
- any local or environment-specific private overrides

## Backend Strategy

Do not try to repoint the existing backend that is still tied to the legacy repo.

Preferred flow:

1. Keep the current backend serving traffic until the new repo is ready.
2. Create a new App Hosting backend in the same Firebase project.
3. Connect that backend to the `OmegaX-Health/omegax-protocol` GitHub repo.
4. Set the app root directory to `frontend/`.
5. Use manual rollouts first.
6. Test the new backend URL before moving the canonical domain.
7. Move the custom domain only after the new backend is verified.

Temporary bridge:

- If you need to test before wiring GitHub, deploy local source from this repo to a staging or existing backend.
- Treat that as temporary; the long-term canonical path should still be a GitHub-connected backend.

## Secrets To Provision

Create these Secret Manager entries for the backend before the first rollout:

- `protocolFaucetBaseUrl`
- `protocolFaucetBaseUrlV2`
- `protocolFaucetToken`
- `protocolFaucetTokenV2`
- `protocolFaucetChallengeSecret`
- `turnstileSecretKey`

Recommended rule:

- if a value is runtime-only and not intended for the browser, prefer `secret:`

## Rollout Checklist

1. Confirm `frontend/apphosting.yaml` contains no plaintext secret values.
2. Confirm `frontend/.env.local` and any `apphosting.local.yaml` files are ignored.
3. Provision or rotate all runtime secrets in Firebase / Google Secret Manager.
4. Grant the new backend access to each required secret.
5. Configure the new backend to use `frontend/` as the source root.
6. Trigger a manual rollout and verify the hosted URL.
7. Check faucet, captcha, governance, and protocol views in the deployed app.
8. Move the custom domain only after the hosted URL is clean.

## Notes

- `NEXT_PUBLIC_*` values are browser-visible by design.
- If a public RPC URL or public on-chain address appears in `apphosting.yaml`, that is expected.
- If a value would be harmful when copied into a public issue or screenshot, it should not live in `value:`.
