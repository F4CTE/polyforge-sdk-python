import { IsOptional, IsInt, IsPositive, IsNumber } from "class-validator";

export class UpdateLimitsDto {
  @IsOptional()
  @IsInt()
  @IsPositive()
  maxRunningStrategies?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  maxOrdersPerDay?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  maxOrderSizeUsdc?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  maxBacktestRunsPerDay?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  circuitBreakerErrors?: number;
}
