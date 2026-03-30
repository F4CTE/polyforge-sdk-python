import { Controller, Get, Query, UseGuards, ParseFloatPipe, DefaultValuePipe } from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse } from "@nestjs/swagger";
import { JwtAuthGuard } from "@polyforge/shared-auth";
import { ArbitrageService } from "./arbitrage.service";

@ApiTags("Arbitrage")
@ApiBearerAuth("jwt")
@UseGuards(JwtAuthGuard)
@Controller("arbitrage")
export class ArbitrageController {
  constructor(private readonly arbitrage: ArbitrageService) {}

  @Get()
  @ApiOperation({
    summary: "Scan live markets for merge arbitrage opportunities",
    description:
      "Returns binary prediction markets where YES_price + NO_price < 1.00. " +
      "Buying both tokens guarantees a $1 payout on resolution regardless of outcome, " +
      "creating a risk-free profit equal to 1 − (YES + NO).",
  })
  @ApiQuery({ name: "minMargin", required: false, type: Number, description: "Minimum profit margin % (default 0.5)" })
  @ApiResponse({ status: 200, description: "Sorted list of arbitrage opportunities (best margin first)" })
  getOpportunities(
    @Query("minMargin", new DefaultValuePipe(0.5), ParseFloatPipe) minMargin: number,
  ) {
    return this.arbitrage.getOpportunities(minMargin);
  }
}
