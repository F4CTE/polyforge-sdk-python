import {
  IsString,
  IsEnum,
  IsNumber,
  IsNumberString,
  IsOptional,
  IsDateString,
  Min,
  Max,
} from "class-validator";
import { Type } from "class-transformer";

export class CreateConditionalOrderDto {
  @IsString()
  declare marketId: string;

  @IsString()
  declare tokenId: string;

  @IsEnum(["TAKE_PROFIT", "STOP_LOSS", "TRAILING_STOP", "LIMIT", "PEGGED"])
  declare type: string;

  @IsEnum(["BUY", "SELL"])
  declare side: string;

  @IsEnum(["YES", "NO"])
  declare outcome: string;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  declare size: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  @Max(1)
  declare triggerPrice: number;

  @IsOptional()
  @IsNumberString()
  limitPrice?: string;

  @IsOptional()
  @IsNumberString()
  trailingPct?: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
