// SPDX-License-Identifier: AGPL-3.0-or-later

import { redirect } from "next/navigation";

type LegacyPoolWorkspacePageProps = {
  params: { poolAddress: string };
};

export default function LegacyPoolWorkspacePage({ params }: LegacyPoolWorkspacePageProps) {
  redirect(`/capital?pool=${encodeURIComponent(params.poolAddress)}&tab=overview`);
}
