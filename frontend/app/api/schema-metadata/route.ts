// SPDX-License-Identifier: AGPL-3.0-or-later

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    {
      retired: true,
      message:
        "Legacy schema-metadata fetches were retired in the health-capital-markets redesign. Use PolicySeries comparability metadata instead.",
    },
    {
      status: 410,
      headers: { "cache-control": "no-store" },
    },
  );
}
