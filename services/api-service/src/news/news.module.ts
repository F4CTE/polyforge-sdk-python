import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { NewsController } from "./news.controller";
import { NewsService } from "./news.service";
import { NewsIngestionService } from "./news-ingestion.service";
import { LlmService } from "./llm.service";
import { SignalGeneratorService } from "./signal-generator.service";

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [NewsController],
  providers: [
    NewsService,
    NewsIngestionService,
    LlmService,
    SignalGeneratorService,
  ],
})
export class NewsModule {}
