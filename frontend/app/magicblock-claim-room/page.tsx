// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Metadata } from "next";

import { MagicBlockClaimRoomWorkbench } from "@/components/magicblock-claim-room-workbench";

export const metadata: Metadata = {
  title: "MagicBlock Claim Room | OmegaX Protocol",
  description:
    "A devnet-only MagicBlock private-review demo surface for OmegaX Protect claim receipts.",
};

export default function MagicBlockClaimRoomPage() {
  return <MagicBlockClaimRoomWorkbench />;
}
