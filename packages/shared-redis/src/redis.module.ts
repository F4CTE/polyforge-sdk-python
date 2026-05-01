import { Global, Module } from "@nestjs/common";
import { RedisService } from "./redis.service";
import { StreamMonitorService } from "./stream-monitor.service";
import { PelReclaimService } from "./pel-reclaim.service";

@Global()
@Module({
  providers: [RedisService, StreamMonitorService, PelReclaimService],
  exports: [RedisService, StreamMonitorService, PelReclaimService],
})
export class RedisModule {}
