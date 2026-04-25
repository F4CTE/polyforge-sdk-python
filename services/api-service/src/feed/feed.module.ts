import { Module } from "@nestjs/common";
import { FeedController } from "./feed.controller";
import { WhalesModule } from "../whales/whales.module";

@Module({
  imports: [WhalesModule],
  controllers: [FeedController],
})
export class FeedModule {}
