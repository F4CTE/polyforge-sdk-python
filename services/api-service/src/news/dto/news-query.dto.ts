import {
  IsOptional,
  IsString,
  IsIn,
  IsInt,
  Min,
  Max,
  MaxLength,
} from "class-validator";
import { Type } from "class-transformer";

export class NewsArticleQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  marketId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  source?: string;

  @IsOptional()
  @IsIn(["POSITIVE", "NEGATIVE", "NEUTRAL"])
  sentiment?: string;

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

export class NewsSignalQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  marketId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  minConfidence?: number;

  @IsOptional()
  @IsIn(["BUY", "SELL"])
  direction?: string;

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
