import { HttpException, HttpStatus } from "@nestjs/common";
import {
  CURRENT_US_RAIL_TERMS_VERSION,
  hasAcceptedCurrentUsRailTerms,
  type UsRailTermsAcceptance,
} from "@polyforge/shared-types";

export function assertCurrentUsRailTermsAccepted(
  acceptance: UsRailTermsAcceptance | null | undefined,
): void {
  if (hasAcceptedCurrentUsRailTerms(acceptance)) {
    return;
  }

  throw new HttpException(
    {
      code: "US_RAIL_TERMS_REQUIRED",
      message: "Accept the current US-rail legal terms before continuing.",
      requiredVersion: CURRENT_US_RAIL_TERMS_VERSION,
    },
    HttpStatus.PRECONDITION_REQUIRED,
  );
}
