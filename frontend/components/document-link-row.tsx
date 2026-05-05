// SPDX-License-Identifier: AGPL-3.0-or-later

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

  return (
    <div className="plans-review-document">
      <div className="plans-review-document-copy">
        <span className="plans-review-document-label">{label}</span>
        <span className="plans-review-document-host">{formatDocumentSource(normalizedHref, sourceLabel)}</span>
        <span className="plans-review-document-url" title={normalizedHref}>{normalizedHref}</span>
      </div>
    </div>
  );
}
