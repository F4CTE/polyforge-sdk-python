export const CURRENT_US_RAIL_TERMS_VERSION = "us-rail-2026-04-29";

export interface UsRailTermsAcceptance {
  usRailTermsAcceptedAt?: Date | string | null;
  usRailTermsVersion?: string | null;
}

export function hasAcceptedCurrentUsRailTerms(
  acceptance: UsRailTermsAcceptance | null | undefined,
): boolean {
  return (
    !!acceptance?.usRailTermsAcceptedAt &&
    acceptance.usRailTermsVersion === CURRENT_US_RAIL_TERMS_VERSION
  );
}
