// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import { useEffect, useState } from "react";
import { useConnection } from "@solana/wallet-adapter-react";

import { useNetworkContext } from "@/components/network-context";

export function ProtocolStatusBar() {
  const { connection } = useConnection();
  const { selectedNetwork } = useNetworkContext();
  const [slot, setSlot] = useState<string>("--");
  const [epoch, setEpoch] = useState<string>("--");
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function refreshChainStatus() {
      try {
        const [nextSlot, nextEpochInfo] = await Promise.all([
          connection.getSlot("confirmed"),
          connection.getEpochInfo("confirmed"),
        ]);

        if (cancelled) return;
        setSlot(nextSlot.toLocaleString());
        setEpoch(nextEpochInfo.epoch.toLocaleString());
        setIsLive(true);
      } catch {
        if (cancelled) return;
        setIsLive(false);
        setSlot("--");
        setEpoch("--");
      }
    }

    void refreshChainStatus();
    const interval = window.setInterval(() => {
      void refreshChainStatus();
    }, 15000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [connection, selectedNetwork]);

  return (
    <div className="protocol-status-shell" aria-label="Protocol operations status">
      <div className="protocol-status-row">
        <span className="protocol-status-item protocol-status-item-live">
          <span className="protocol-status-key">Sync</span>
          <span className="protocol-status-value">
            <span className={`protocol-live-dot ${isLive ? "is-live" : ""}`} aria-hidden="true" />
            {isLive ? "Live" : "Retrying"}
          </span>
        </span>
        <span className="protocol-status-item">
          <span className="protocol-status-key">Cluster</span>
          <span className="protocol-status-value">{selectedNetwork === "mainnet-beta" ? "Mainnet" : "Devnet"}</span>
        </span>
        <span className="protocol-status-item">
          <span className="protocol-status-key">Epoch</span>
          <span className="protocol-status-value">{epoch}</span>
        </span>
        <span className="protocol-status-item">
          <span className="protocol-status-key">Slot</span>
          <span className="protocol-status-value">{slot}</span>
        </span>
      </div>
    </div>
  );
}
