// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Metadata } from "next";

import { GenesisProtectDisclosurePage } from "@/components/genesis-protect-disclosure-page";
import { GENESIS_PROTECT_DISCLOSURE_PAGES } from "@/lib/genesis-protect-disclosures";

const content = GENESIS_PROTECT_DISCLOSURE_PAGES.riskDisclosures;

export const metadata: Metadata = {
  title: content.title,
  description: content.description,
};

export default function CoverageRiskDisclosuresPage() {
  return <GenesisProtectDisclosurePage content={content} />;
}
