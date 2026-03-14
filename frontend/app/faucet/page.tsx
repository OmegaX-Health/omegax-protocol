// SPDX-License-Identifier: AGPL-3.0-or-later

import { redirect } from "next/navigation";

// The DAO Token Faucet has been merged into the Governance section.
export default function FaucetPage() {
  redirect("/governance");
}
