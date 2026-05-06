// SPDX-License-Identifier: AGPL-3.0-or-later

import { resolveSafeDocumentHref } from "@/lib/safe-external-url";

type DocumentLinkRowProps = {
  href: string;
  label: string;
  sourceLabel?: string;
};

function formatDocumentSource(value: string, fallback?: string): string {
  if (fallback) return fallback;
  try {
    const url = value.startsWith("/")
      ? new URL(value, "https://protocol.omegax.health")
      : new URL(value);
    return url.hostname;
  } catch {
    return "Metadata";
  }
}

export function DocumentLinkRow({ href, label, sourceLabel }: DocumentLinkRowProps) {
  const safeHref = resolveSafeDocumentHref(href);
  const displayHref = safeHref ?? href.trim();
  const documentSource = formatDocumentSource(displayHref, sourceLabel);
  const documentCopy = (
    <div className="plans-review-document-copy">
      <span className="plans-review-document-label">{label}</span>
      <span className="plans-review-document-host">{documentSource}</span>
      <span className="plans-review-document-url" title={displayHref}>{displayHref || "Unavailable"}</span>
    </div>
  );

  if (!safeHref) {
    return (
      <div className="plans-review-document" aria-disabled="true">
        {documentCopy}
      </div>
    );
  }

  return (
    <a
      className="plans-review-document"
      href={safeHref}
      target={safeHref.startsWith("/") ? undefined : "_blank"}
      rel={safeHref.startsWith("/") ? undefined : "noreferrer"}
    >
      {documentCopy}
    </a>
  );
}
