import { Controller, Get, Query, Res, UseGuards } from "@nestjs/common";
import type { FastifyReply } from "fastify";
type Response = FastifyReply;
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard, CurrentUser } from "@polyforge/shared-auth";
import { IsOptional, IsIn, IsString } from "class-validator";
import { PortfolioService } from "./portfolio.service";
import { PolymarketDataApiService } from "./polymarket-data-api.service";
import { JwtPayload } from "@polyforge/shared-types";
import { PrismaService } from "@polyforge/shared-db";

class ActivityQueryDto {
  @IsOptional()
  @IsIn([
    "TRADE",
    "SPLIT",
    "MERGE",
    "REDEEM",
    "REWARD",
    "CONVERSION",
    "MAKER_REBATE",
    "REFERRAL_REWARD",
  ])
  type?: string;
}

class PnlQueryDto {
  @IsOptional()
  @IsIn(["7d", "30d", "90d", "allTime"])
  period?: string = "30d";

  @IsOptional()
  @IsString()
  strategyId?: string;
}

@ApiTags("portfolio")
@ApiBearerAuth("jwt")
@Controller("portfolio")
@UseGuards(JwtAuthGuard)
export class PortfolioController {
  constructor(
    private readonly portfolio: PortfolioService,
    private readonly dataApi: PolymarketDataApiService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  getPortfolio(@CurrentUser() user: JwtPayload) {
    return this.portfolio.getPortfolio(user.sub);
  }

  @Get("pnl")
  getPnl(@CurrentUser() user: JwtPayload, @Query() query: PnlQueryDto) {
    return this.portfolio.getPnl(
      user.sub,
      query.period ?? "30d",
      query.strategyId,
    );
  }

  @Get("export/csv")
  async exportCsv(@CurrentUser() user: JwtPayload, @Res() res: Response) {
    const { csv, truncated } = await this.portfolio.exportCsv(user.sub);
    res.header("Content-Type", "text/csv");
    res.header("Content-Disposition", 'attachment; filename="portfolio.csv"');
    if (truncated) {
      res.header("X-Export-Truncated", "true");
    }
    res.send(csv);
  }

  @Get("polymarket/portfolio")
  async getPolymarketPortfolio(@CurrentUser() user: JwtPayload) {
    const profile = await this.prisma.user.findUnique({
      where: { id: user.sub },
      select: { polymarketAddress: true, polymarketConnected: true },
    });
    if (!profile?.polymarketConnected || !profile.polymarketAddress) {
      return { entries: [] };
    }
    const entries = await this.dataApi.getPortfolio(profile.polymarketAddress);
    return { entries };
  }

  @Get("polymarket/earnings")
  async getPolymarketEarnings(@CurrentUser() user: JwtPayload) {
    const profile = await this.prisma.user.findUnique({
      where: { id: user.sub },
      select: { polymarketAddress: true, polymarketConnected: true },
    });
    if (!profile?.polymarketConnected || !profile.polymarketAddress) {
      return { entries: [] };
    }
    const entries = await this.dataApi.getEarnings(profile.polymarketAddress);
    return { entries };
  }

  @Get("polymarket/activity")
  async getPolymarketActivity(
    @CurrentUser() user: JwtPayload,
    @Query() query: ActivityQueryDto,
  ) {
    const profile = await this.prisma.user.findUnique({
      where: { id: user.sub },
      select: { polymarketAddress: true, polymarketConnected: true },
    });
    if (!profile?.polymarketConnected || !profile.polymarketAddress) {
      return { activities: [] };
    }
    const activities = await this.dataApi.getActivity(
      profile.polymarketAddress,
      query.type,
    );
    return { activities };
  }
}
