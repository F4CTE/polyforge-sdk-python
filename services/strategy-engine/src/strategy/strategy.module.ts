import { Module } from "@nestjs/common";
import { StrategyRegistryService } from "./strategy-registry.service";
import { SharedUserDbModule } from "@polyforge/shared-db";
import { RedisModule } from "@polyforge/shared-redis";
import { StateModule } from "../state/state.module";

@Module({
  imports: [SharedUserDbModule, RedisModule, StateModule],
  providers: [StrategyRegistryService],
  exports: [StrategyRegistryService],
})
export class StrategyModule {}
