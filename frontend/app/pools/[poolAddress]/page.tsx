// SPDX-License-Identifier: AGPL-3.0-or-later

import { redirect } from "next/navigation";

type LegacyPoolWorkspacePageProps = {
  params: Promise<{ poolAddress: string }>;
};

export default async function LegacyPoolWorkspacePage({ params }: LegacyPoolWorkspacePageProps) {
  const { poolAddress } = await params;
  redirect(`/capital?pool=${encodeURIComponent(poolAddress)}&tab=overview`);
}
