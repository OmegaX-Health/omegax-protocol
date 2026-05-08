// SPDX-License-Identifier: AGPL-3.0-or-later

import { NextResponse } from "next/server";

import { fetchSchemaMetadata } from "@/lib/schema-metadata";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const uri = new URL(request.url).searchParams.get("uri") ?? "";
  const payload = await fetchSchemaMetadata(uri);

  return NextResponse.json(payload, {
    headers: { "cache-control": "no-store" },
  });
}
