import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  BadRequestException,
  PipeTransform,
  Injectable,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard } from "@polyforge/shared-auth";
import { NewsService } from "./news.service";
import { NewsArticleQueryDto, NewsSignalQueryDto } from "./dto/news-query.dto";

@Injectable()
class MarketIdPipe implements PipeTransform<string, string> {
  private readonly pattern = /^[A-Za-z0-9_\-:.]{1,255}$/;
  transform(value: string): string {
    if (!this.pattern.test(value)) {
      throw new BadRequestException("Invalid marketId format");
    }
    return value;
  }
}

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
  getMarketSentiment(@Param("marketId", MarketIdPipe) marketId: string) {
    return this.news.getMarketSentiment(marketId);
  }

  @Get(":id")
  getArticleById(@Param("id", ParseUUIDPipe) id: string) {
    return this.news.getArticleById(id);
  }
}
