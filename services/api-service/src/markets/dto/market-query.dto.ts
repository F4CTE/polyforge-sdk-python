import {
  IsOptional,
  IsString,
  IsBoolean,
  IsIn,
  IsInt,
  Min,
  Max,
  MaxLength,
  IsISO8601,
  IsNumber,
} from "class-validator";
import { Type, Transform } from "class-transformer";
import { PaginationDto } from "../../common/dto/pagination.dto";

export class MarketQueryDto extends PaginationDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  search?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;

  @IsOptional()
  @Transform(({ value }) => value === "true" || value === true)
  @IsBoolean()
  closed?: boolean;

  @IsOptional()
  @IsIn([
    "volume",
    "endDate",
    "firstSeenAt",
    "newest",
    "closing_soon",
    "liquidity",
  ])
  sort?: string = "volume";
}

export class PriceHistoryQueryDto {
  @IsOptional()
  @IsIn(["1m", "1h", "1d"])
  resolution?: string = "1h";

  @IsOptional()
  @IsISO8601()
  @MaxLength(30)
  from?: string;

  @IsOptional()
  @IsISO8601()
  @MaxLength(30)
  to?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  limit?: number = 200;
}

export class ClobPriceHistoryQueryDto {
  @IsOptional()
  @IsIn(["1m", "5m", "1h", "4h", "1d", "1w", "max"])
  interval?: string = "1h";

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  fidelity?: number = 60;
}

export class SearchQueryDto {
  @IsString()
  @MaxLength(255)
  q!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

export class MarketHistoryQueryDto {
  @IsOptional()
  @IsIn(["1d", "7d", "30d", "90d"])
  period?: string = "7d";
}

export class CreateMarketAlertDto {
  @IsIn(["YES", "NO", "Yes", "No"])
  outcome!: string;

  @IsIn(["above", "below"])
  condition!: string;

  @IsNumber()
  @Type(() => Number)
  @Min(0.01)
  @Max(0.99)
  threshold!: number;
}
