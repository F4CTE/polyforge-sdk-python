import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { IsOptional, IsString, IsNumberString } from "class-validator";
import { JwtAuthGuard, CurrentUser } from "@polyforge/shared-auth";
import {
  MarketplaceService,
  CreateListingDto,
  UpdateListingDto,
  RateListingDto,
} from "./marketplace.service";

class BrowseQueryDto {
  @IsOptional() @IsString() tag?: string;
  @IsOptional() @IsString() sort?: string;
  @IsOptional() @IsNumberString() limit?: string;
  @IsOptional() @IsNumberString() offset?: string;
}

@ApiTags("marketplace")
@ApiBearerAuth("jwt")
@Controller("marketplace")
@UseGuards(JwtAuthGuard)
export class MarketplaceController {
  constructor(private readonly marketplace: MarketplaceService) {}

  // ── Browse (public-ish) ───────────────────────────────────────────────────

  @Get()
  browse(@Query() query: BrowseQueryDto) {
    return this.marketplace.browse({
      tag: query.tag,
      sort: query.sort,
      limit: query.limit ? parseInt(String(query.limit)) : 20,
      offset: query.offset ? parseInt(String(query.offset)) : 0,
    });
  }

  @Get("my/listings")
  myListings(@CurrentUser() user: any) {
    return this.marketplace.myListings(user.sub);
  }

  @Get("my/purchases")
  myPurchases(@CurrentUser() user: any) {
    return this.marketplace.myPurchases(user.sub);
  }

  @Get(":id")
  getListing(@Param("id") id: string) {
    return this.marketplace.getListing(id);
  }

  // ── Sell-side ─────────────────────────────────────────────────────────────

  @Post()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @HttpCode(HttpStatus.CREATED)
  createListing(@CurrentUser() user: any, @Body() dto: CreateListingDto) {
    return this.marketplace.createListing(user.sub, dto);
  }

  @Patch(":id")
  updateListing(
    @CurrentUser() user: any,
    @Param("id") id: string,
    @Body() dto: UpdateListingDto,
  ) {
    return this.marketplace.updateListing(user.sub, id, dto);
  }

  // ── Buy-side ──────────────────────────────────────────────────────────────

  @Post(":id/purchase")
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @HttpCode(HttpStatus.CREATED)
  purchase(@CurrentUser() user: any, @Param("id") id: string) {
    return this.marketplace.purchase(user.sub, id);
  }

  @Post(":id/rate")
  @HttpCode(HttpStatus.OK)
  rate(@CurrentUser() user: any, @Param("id") id: string, @Body() dto: RateListingDto) {
    return this.marketplace.rateListing(user.sub, id, dto);
  }
}
