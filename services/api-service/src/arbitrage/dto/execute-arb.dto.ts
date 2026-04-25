import { IsString, IsNumber, IsOptional, Min, Max } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class ExecuteArbDto {
  @ApiProperty({
    description: "MarketMatch ID identifying the cross-venue pair",
  })
  @IsString()
  matchId: string;

  @ApiProperty({ description: "Position size in USDC (applied to both legs)" })
  @IsNumber()
  @Min(1)
  @Max(10000)
  size: number;

  @ApiPropertyOptional({
    description: "Max acceptable slippage % from quoted prices (default 0.5)",
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(5)
  maxSlippagePct?: number;
}
