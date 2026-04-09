// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useWallet } from "@solana/wallet-adapter-react";

import { useNetworkContext } from "@/components/network-context";
import { walletFixtureFor } from "@/lib/canonical-ui";
import {
  derivePersonaFromRole,
  type WorkbenchPersona,
} from "@/lib/workbench";

type PreviewPersona = "auto" | Exclude<WorkbenchPersona, "observer">;

type WorkspacePersonaValue = {
  derivedPersona: WorkbenchPersona;
  effectivePersona: WorkbenchPersona;
  previewPersona: PreviewPersona;
  setPreviewPersona: (persona: PreviewPersona) => void;
  canPreviewPersona: boolean;
};

const WorkspacePersonaContext = createContext<WorkspacePersonaValue | undefined>(undefined);

export function WorkspacePersonaProvider({ children }: { children: ReactNode }) {
  const { publicKey } = useWallet();
  const { selectedNetwork } = useNetworkContext();
  const [mounted, setMounted] = useState(false);
  const [previewPersona, setPreviewPersona] = useState<PreviewPersona>("auto");

  useEffect(() => {
    setMounted(true);
  }, []);

  const derivedPersona = useMemo<WorkbenchPersona>(() => {
    const fixture = walletFixtureFor(mounted ? publicKey?.toBase58() : undefined);
    return derivePersonaFromRole(fixture?.role);
  }, [mounted, publicKey]);

  const canPreviewPersona = selectedNetwork === "devnet";
  const effectivePersona =
    canPreviewPersona && previewPersona !== "auto" ? previewPersona : derivedPersona;

  const value = useMemo(
    () => ({
      derivedPersona,
      effectivePersona,
      previewPersona,
      setPreviewPersona,
      canPreviewPersona,
    }),
    [canPreviewPersona, derivedPersona, effectivePersona, previewPersona],
  );

  return (
    <WorkspacePersonaContext.Provider value={value}>
      {children}
    </WorkspacePersonaContext.Provider>
  );
}

export function useWorkspacePersona(): WorkspacePersonaValue {
  const context = useContext(WorkspacePersonaContext);
  if (!context) {
    throw new Error("useWorkspacePersona must be used within WorkspacePersonaProvider.");
  }
  return context;
}
