// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Public health endpoint for the protocol console. Used by uptime monitors,
// canary checks, and post-deploy verification to confirm the frontend is
// reachable and serving the expected build. Returns no secret material.

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const FRONTEND_VERSION = "0.3.1";

export async function GET() {
  const commit =
    process.env.NEXT_PUBLIC_GIT_COMMIT_SHA?.trim()
    || process.env.VERCEL_GIT_COMMIT_SHA?.trim()
    || process.env.GIT_COMMIT_SHA?.trim()
    || "unknown";

  const network =
    process.env.NEXT_PUBLIC_SOLANA_NETWORK?.trim()
    || process.env.NEXT_PUBLIC_REALMS_CLUSTER?.trim()
    || process.env.NEXT_PUBLIC_SOLANA_EXPLORER_CLUSTER?.trim()
    || "unknown";

  return NextResponse.json(
    {
      ok: true,
      version: FRONTEND_VERSION,
      commit,
      network,
      timestamp: new Date().toISOString(),
    },
    {
      status: 200,
      headers: { "cache-control": "no-store" },
    },
  );
}
