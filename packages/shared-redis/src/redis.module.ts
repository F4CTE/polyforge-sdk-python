import { Global, Module } from "@nestjs/common";
import { RedisService } from "./redis.service";
import { StreamMonitorService } from "./stream-monitor.service";
import { PelReclaimService } from "./pel-reclaim.service";
import { BetaLimitsConfigService } from "./beta-limits-config.service";

@Global()
@Module({
  providers: [RedisService, StreamMonitorService, PelReclaimService, BetaLimitsConfigService],
  exports: [RedisService, StreamMonitorService, PelReclaimService, BetaLimitsConfigService],
})
export class RedisModule {}
