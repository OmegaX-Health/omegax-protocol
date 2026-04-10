// SPDX-License-Identifier: AGPL-3.0-or-later

const DEFAULT_IPFS_GATEWAY_BASES = [
  "https://ipfs.io/ipfs",
  "https://gateway.pinata.cloud/ipfs",
];

function normalize(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

function splitGatewayBases(value: string): string[] {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .flatMap((entry) => {
      try {
        const parsed = new URL(entry);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return [];
        return [parsed.toString().replace(/\/+$/, "")];
      } catch {
        return [];
      }
    });
}

function preferredIpfsGatewayBase(): string {
  const configured = splitGatewayBases(process.env.NEXT_PUBLIC_IPFS_GATEWAY_BASE || "");
  return (configured[0] ?? DEFAULT_IPFS_GATEWAY_BASES[0]).replace(/\/+$/, "");
}

function resolveIpfsUrl(value: string): string | null {
  const match = value.match(/^ipfs:\/\/([^?#]+)([?#].*)?$/i);
  if (!match) return null;

  const cidPathRaw = match[1].replace(/^\/+/, "");
  const cidPath = cidPathRaw.toLowerCase().startsWith("ipfs/")
    ? cidPathRaw.slice("ipfs/".length)
    : cidPathRaw;
  if (!cidPath) return null;

  return `${preferredIpfsGatewayBase()}/${cidPath}${match[2] ?? ""}`;
}

export function resolveSafeExternalHref(value: string | null | undefined): string | null {
  const normalized = normalize(value);
  if (!normalized) return null;

  if (normalized.toLowerCase().startsWith("ipfs://")) {
    return resolveIpfsUrl(normalized);
  }

  try {
    const parsed = new URL(normalized);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.toString();
    }
  } catch {
    return null;
  }

  return null;
}

const safeExternalUrl = {
  resolveSafeExternalHref,
};

export default safeExternalUrl;
