import { Controller, Get, Query, Res, UseGuards } from "@nestjs/common";
import type { FastifyReply } from "fastify";
type Response = FastifyReply;
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard, CurrentUser } from "@polyforge/shared-auth";
import { IsOptional, IsIn, IsString } from "class-validator";
import { PortfolioService } from "./portfolio.service";

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
  constructor(private readonly portfolio: PortfolioService) {}

  @Get()
  getPortfolio(@CurrentUser() user: any) {
    return this.portfolio.getPortfolio(user.sub);
  }

  @Get("pnl")
  getPnl(@CurrentUser() user: any, @Query() query: PnlQueryDto) {
    return this.portfolio.getPnl(
      user.sub,
      query.period ?? "30d",
      query.strategyId,
    );
  }

  @Get('export/csv')
  async exportCsv(@CurrentUser() user: any, @Res() res: Response) {
    const csv = await this.portfolio.exportCsv(user.sub);
    res.header('Content-Type', 'text/csv');
    res.header('Content-Disposition', 'attachment; filename="portfolio.csv"');
    res.send(csv);
  }
}
