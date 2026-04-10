// SPDX-License-Identifier: AGPL-3.0-or-later

import { fetchPoolMetadata } from "@/lib/pool-metadata";
import {
  parseProtectionPosture,
  serializeProtectionPosture,
  type ProtectionPostureInput,
  type SerializedProtectionPosture,
} from "@/lib/plan-launch";

export type ProtectionMetadataDocument = SerializedProtectionPosture;

export type ProtectionMetadataErrorCode =
  | "fetch_failed"
  | "invalid_document"
  | "posture_mismatch";

export type ProtectionMetadataValidationResult = {
  document: ProtectionMetadataDocument | null;
  error: {
    code: ProtectionMetadataErrorCode;
    message: string;
  } | null;
};

function normalize(value: string): string {
  return value.trim();
}

export function protectionMetadataMatchesPosture(
  document: ProtectionMetadataDocument,
  posture: ProtectionPostureInput,
): boolean {
  const serialized = serializeProtectionPosture(posture);
  if (!serialized) return false;

  if (
    document.version !== serialized.version
    || document.lane !== serialized.lane
    || normalize(document.metadataUri) !== normalize(serialized.metadataUri)
    || document.coveragePathway !== serialized.coveragePathway
  ) {
    return false;
  }

  if (document.coveragePathway === "defi_native") {
    return Boolean(
      document.defi
      && serialized.defi
      && document.defi.settlementStyle === serialized.defi.settlementStyle
      && normalize(document.defi.technicalTermsUri) === normalize(serialized.defi.technicalTermsUri)
      && normalize(document.defi.riskDisclosureUri) === normalize(serialized.defi.riskDisclosureUri),
    );
  }

  return Boolean(
    document.rwa
    && serialized.rwa
    && normalize(document.rwa.legalEntityName) === normalize(serialized.rwa.legalEntityName)
    && normalize(document.rwa.jurisdiction) === normalize(serialized.rwa.jurisdiction)
    && normalize(document.rwa.policyTermsUri) === normalize(serialized.rwa.policyTermsUri)
    && normalize(document.rwa.regulatoryLicenseRef) === normalize(serialized.rwa.regulatoryLicenseRef)
    && normalize(document.rwa.complianceContact) === normalize(serialized.rwa.complianceContact),
  );
}

export async function fetchProtectionMetadataDocument(
  metadataUri: string,
): Promise<ProtectionMetadataValidationResult> {
  const fetched = await fetchPoolMetadata(metadataUri);
  if (fetched.error) {
    return {
      document: null,
      error: {
        code: "fetch_failed",
        message: fetched.error.message,
      },
    };
  }

  const document = parseProtectionPosture(fetched.metadata);
  if (!document) {
    return {
      document: null,
      error: {
        code: "invalid_document",
        message: "Protection metadata did not match the required structured protection JSON document.",
      },
    };
  }

  return {
    document,
    error: null,
  };
}

export async function validateProtectionMetadataAgainstPosture(
  metadataUri: string,
  posture: ProtectionPostureInput,
): Promise<ProtectionMetadataValidationResult> {
  const fetched = await fetchProtectionMetadataDocument(metadataUri);
  if (fetched.error || !fetched.document) {
    return fetched;
  }

  if (!protectionMetadataMatchesPosture(fetched.document, posture)) {
    return {
      document: fetched.document,
      error: {
        code: "posture_mismatch",
        message: "Protection metadata JSON does not match the selected coverage posture fields.",
      },
    };
  }

  return fetched;
}
