import { Module } from "@nestjs/common";
import { RedisModule } from "@polyforge/shared-redis";
import { GasSponsorService } from "./gas-sponsor.service";

@Module({
  imports: [RedisModule],
  providers: [GasSponsorService],
  exports: [GasSponsorService],
})
export class GasSponsorModule {}
