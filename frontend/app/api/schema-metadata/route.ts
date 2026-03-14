// SPDX-License-Identifier: AGPL-3.0-or-later

import { NextRequest, NextResponse } from "next/server";

import { fetchSchemaMetadata } from "@/lib/schema-metadata";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const uri = request.nextUrl.searchParams.get("uri") ?? "";
  const result = await fetchSchemaMetadata(uri);
  return NextResponse.json(result, {
    status: 200,
    headers: {
      "cache-control": "no-store",
    },
  });
}

