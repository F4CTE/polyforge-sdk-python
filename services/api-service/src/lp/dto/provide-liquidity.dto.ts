import { IsString, IsNumber, IsOptional, Min, Max } from "class-validator";

export class ProvideLiquidityDto {
  @IsString()
  marketId!: string;

  @IsString()
  tokenId!: string; // YES token ID

  @IsNumber()
  @Min(1)
  amountUsdc!: number;

  @IsOptional()
  @IsNumber()
  @Min(0.001)
  @Max(0.5)
  targetSpread?: number; // default 0.02 (2%)
}
