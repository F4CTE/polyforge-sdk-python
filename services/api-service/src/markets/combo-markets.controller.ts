import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
  NotFoundException,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { JwtAuthGuard } from "@polyforge/shared-auth";
import {
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  IsIn,
} from "class-validator";
import { Type } from "class-transformer";
import { KalshiReadService } from "./kalshi-read.service";
import { BETA_LIMITS } from "../common/beta-limits.config";

class ComboCollectionsQueryDto {
  @IsOptional()
  @IsString()
  seriesTicker?: string;

  @IsOptional()
  limit?: number;

  @IsOptional()
  @IsString()
  cursor?: string;
}

class ComboLegDto {
  @IsString()
  ticker!: string;

  @IsIn(["yes", "no"])
  outcome!: "yes" | "no";
}

class LookupTickerDto {
  @IsString()
  collectionTicker!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ComboLegDto)
  legs!: ComboLegDto[];
}

const COMBO_THROTTLE = {
  default: { ttl: 60000, limit: BETA_LIMITS.marketDataRateLimitPerMinute },
};

@ApiTags("combo-markets")
@ApiBearerAuth("jwt")
@Controller("markets/combo")
@UseGuards(JwtAuthGuard)
@Throttle(COMBO_THROTTLE)
export class ComboMarketsController {
  constructor(private readonly kalshi: KalshiReadService) {}

  @Get("collections")
  async listCollections(@Query() query: ComboCollectionsQueryDto) {
    return this.kalshi.getCollections(
      query.seriesTicker,
      query.limit ? Number(query.limit) : undefined,
      query.cursor,
    );
  }

  @Get("collections/:ticker")
  async getCollection(@Param("ticker") ticker: string) {
    const collection = await this.kalshi.getCollection(ticker);
    if (!collection) {
      throw new NotFoundException(`Combo collection "${ticker}" not found`);
    }
    return collection;
  }

  @Post("lookup")
  async lookupTicker(@Body() dto: LookupTickerDto) {
    const result = await this.kalshi.lookupTicker(
      dto.collectionTicker,
      dto.legs,
    );
    if (!result) {
      throw new NotFoundException(
        `No combo market found for collection "${dto.collectionTicker}" with the given legs`,
      );
    }
    return result;
  }
}
