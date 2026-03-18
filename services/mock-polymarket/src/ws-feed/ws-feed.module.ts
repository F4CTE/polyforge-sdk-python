import { Module } from "@nestjs/common";
import { WsFeedService } from "./ws-feed";

@Module({
  providers: [WsFeedService],
  exports: [WsFeedService],
})
export class WsFeedModule {}
