// SPDX-License-Identifier: AGPL-3.0-or-later

import { redirect } from "next/navigation";

export default function LegacyCreatePoolPage() {
  redirect("/plans");
}
