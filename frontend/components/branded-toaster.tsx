// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import { Toaster } from "sonner";

import { useTheme } from "@/components/theme-provider";

export function BrandedToaster() {
  const { theme, mounted } = useTheme();

  if (!mounted) {
    return null;
  }

  return (
    <Toaster
      theme={theme}
      position="bottom-right"
      closeButton
      richColors={false}
      toastOptions={{
        style: {
          background: "var(--panel-heavy)",
          color: "var(--foreground)",
          border: "1px solid var(--border-strong)",
          boxShadow: "var(--panel-shadow)",
          fontFamily: "var(--font-sans)",
        },
        classNames: {
          toast: "omegax-toast",
          title: "omegax-toast-title",
          description: "omegax-toast-description",
          actionButton: "omegax-toast-action",
          cancelButton: "omegax-toast-cancel",
          closeButton: "omegax-toast-close",
        },
      }}
    />
  );
}
