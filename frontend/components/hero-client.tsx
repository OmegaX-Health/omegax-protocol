// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import { motion } from "framer-motion";
import { ReactNode, useRef } from "react";

interface HeroClientProps {
    title: string;
    subtitle: ReactNode;
    iconNode: ReactNode;
}

export function HeroClient({ title, subtitle, iconNode }: HeroClientProps) {
    const titleRef = useRef<HTMLDivElement | null>(null);

    return (
        <motion.section
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.2, 0.7, 0.2, 1] }}
            className="hero-shell"
        >
            <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[15rem] items-center justify-center lg:flex">
                <div className="hero-orbit">
                    <div className="hero-orbit-inner" />
                    <div className="hero-orbit-core">{iconNode}</div>
                </div>
            </div>

            <div className="relative z-10 flex max-w-4xl flex-col gap-3 px-2 py-2 sm:px-0 sm:py-0">
                <motion.div
                    ref={titleRef}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.15, duration: 0.5, ease: [0.2, 0.7, 0.2, 1] }}
                    className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-5"
                >
                    <div className="hero-icon-well">
                        {iconNode}
                    </div>

                    <h1 className="hero-title text-[clamp(2.35rem,8.8vw,3.05rem)] sm:text-5xl">
                        {title}
                    </h1>
                </motion.div>

                <div className="hero-copy max-w-3xl text-[0.96rem] leading-[1.68] sm:text-lg sm:leading-relaxed">
                    {subtitle}
                </div>
            </div>
        </motion.section>
    );
}
