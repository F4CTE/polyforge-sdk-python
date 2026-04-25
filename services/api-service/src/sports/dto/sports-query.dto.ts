import {
  IsOptional,
  IsString,
  IsBoolean,
  IsIn,
  IsArray,
  MaxLength,
} from "class-validator";
import { Transform } from "class-transformer";
import { PaginationDto } from "../../common/dto/pagination.dto";

export class SportsMarketsQueryDto extends PaginationDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  category?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  search?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  seriesTicker?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  eventTicker?: string;

  @IsOptional()
  @Transform(({ value }) => value === "true" || value === true)
  @IsBoolean()
  liveOnly?: boolean;

  @IsOptional()
  @IsIn(["volume", "closing_soon", "newest"])
  sort?: string = "volume";
}

export class SportsEventsQueryDto extends PaginationDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  category?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  seriesTicker?: string;

  @IsOptional()
  @IsIn(["SCHEDULED", "PREGAME", "LIVE", "HALFTIME", "FINAL"])
  status?: string;
}

export class MilestonesQueryDto extends PaginationDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  eventTicker?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  status?: string;
}

export class ComboCollectionsQueryDto extends PaginationDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  seriesTicker?: string;
}

export class ComboLookupDto {
  @IsString()
  @MaxLength(100)
  collectionTicker!: string;

  @IsArray()
  selectedMarkets!: Array<{
    marketTicker: string;
    eventTicker: string;
    side: "yes" | "no";
  }>;
}
