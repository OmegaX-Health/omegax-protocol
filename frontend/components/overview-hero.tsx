// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import { ReactNode } from "react";

interface OverviewHeroProps {
  title: string;
  subtitle: ReactNode;
}

export function OverviewHero({ title, subtitle }: OverviewHeroProps) {
  return (
    <section
      className="hero-shell text-center"
    >
      <div className="pointer-events-none absolute inset-x-0 top-8 z-0 flex justify-center">
        <div className="hero-orbit scale-[0.82] sm:scale-100">
          <div className="hero-orbit-inner" />
          <div className="hero-orbit-core" />
        </div>
      </div>

      <div className="relative z-10 flex flex-col gap-2 px-4 py-10 sm:px-5 sm:py-12">
        <h1 className="hero-title">{title}</h1>
        <p className="hero-copy max-w-2xl mx-auto">{subtitle}</p>
      </div>
    </section>
  );
}

export default OverviewHero;
