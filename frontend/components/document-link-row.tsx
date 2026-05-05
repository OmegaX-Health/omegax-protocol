// SPDX-License-Identifier: AGPL-3.0-or-later

import safeExternalUrl from "@/lib/safe-external-url";

const { resolveSafeExternalHref } = safeExternalUrl;

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
  const normalizedHref = href.trim();
  const safeHref = resolveSafeExternalHref(normalizedHref);

  return (
    <div className="plans-review-document">
      <div className="plans-review-document-copy">
        <span className="plans-review-document-label">{label}</span>
        <span className="plans-review-document-host">{formatDocumentSource(normalizedHref, sourceLabel)}</span>
        <span className="plans-review-document-url" title={normalizedHref}>{normalizedHref}</span>
      </div>
      {safeHref ? (
        <a
          className="secondary-button plans-review-document-action"
          href={safeHref}
          target="_blank"
          rel="noreferrer"
          aria-label={`Open ${label}`}
        >
          Open
          <span className="material-symbols-outlined" aria-hidden="true">open_in_new</span>
        </a>
      ) : null}
    </div>
  );
}
