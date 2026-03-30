import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  Max,
  Min,
} from "class-validator";

export class UpdateRiskSettingsDto {
  @IsOptional()
  @IsBoolean()
  drawdownEnabled?: boolean;

  /** Lookback window in hours: 1, 4, 8, or 24 */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(168) // up to 7 days
  drawdownLookbackHours?: number;

  /** Threshold as a decimal, e.g. 0.10 = 10% */
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  @Max(0.99)
  drawdownThresholdPct?: number;
}
