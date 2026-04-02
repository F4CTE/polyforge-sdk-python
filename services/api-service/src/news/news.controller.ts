import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard } from "@polyforge/shared-auth";
import { NewsService } from "./news.service";
import { NewsArticleQueryDto, NewsSignalQueryDto } from "./dto/news-query.dto";

@ApiTags("news")
@ApiBearerAuth("jwt")
@Controller("news")
@UseGuards(JwtAuthGuard)
export class NewsController {
  constructor(private readonly news: NewsService) {}

  @Get()
  getArticles(@Query() query: NewsArticleQueryDto) {
    return this.news.getArticles(query);
  }

  @Get("signals")
  getSignals(@Query() query: NewsSignalQueryDto) {
    return this.news.getSignals(query);
  }

  @Get("sentiment/:marketId")
  getMarketSentiment(@Param("marketId") marketId: string) {
    return this.news.getMarketSentiment(marketId);
  }

  @Get(":id")
  getArticleById(@Param("id") id: string) {
    return this.news.getArticleById(id);
  }
}
