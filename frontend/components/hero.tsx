// SPDX-License-Identifier: AGPL-3.0-or-later

import { LucideIcon } from "lucide-react";
import { ReactNode } from "react";
import { HeroClient } from "./hero-client";

interface HeroProps {
  title: string;
  subtitle: ReactNode;
  icon: LucideIcon;
}

export function Hero({ title, subtitle, icon: Icon }: HeroProps) {
  return (
    <HeroClient
      title={title}
      subtitle={subtitle}
      iconNode={<Icon className="h-5 w-5 sm:h-6 sm:w-6 text-[var(--accent)]" strokeWidth={1.5} />}
    />
  );
}
