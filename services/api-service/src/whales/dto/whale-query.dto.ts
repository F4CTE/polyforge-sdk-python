import {
  IsOptional,
  IsString,
  IsNumberString,
  IsIn,
  MaxLength,
  Min,
  Max,
  IsInt,
} from "class-validator";
import { Type } from "class-transformer";

export class WhaleFeedQueryDto {
  @IsOptional()
  @IsNumberString()
  minSize?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  marketId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  walletAddress?: string;

  @IsOptional()
  @IsIn(["BUY", "SELL"])
  side?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

export class WhaleTopQueryDto {
  @IsOptional()
  @IsIn(["volume", "pnl", "winRate", "tradeCount"])
  sortBy?: string = "volume";

  @IsOptional()
  @IsIn(["24h", "7d", "30d", "all"])
  period?: string = "all";

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

export class SmartMoneyLeaderboardDto {
  @IsOptional()
  @IsIn(["24h", "7d", "30d", "all"])
  period?: string = "all";

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
