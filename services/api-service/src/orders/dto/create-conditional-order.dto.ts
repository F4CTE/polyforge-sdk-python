import {
  IsString,
  IsEnum,
  IsNumberString,
  IsOptional,
  IsDateString,
} from "class-validator";

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

  @IsNumberString()
  declare size: string;

  @IsNumberString()
  declare triggerPrice: string;

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
