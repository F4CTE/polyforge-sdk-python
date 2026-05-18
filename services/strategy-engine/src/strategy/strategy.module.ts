import { Module } from "@nestjs/common";
import { StrategyRegistryService } from "./strategy-registry.service";
import { WasmWorkerPoolService } from "./wasm-worker-pool";
import { SharedUserDbModule } from "@polyforge/shared-db";
import { RedisModule } from "@polyforge/shared-redis";
import { StateModule } from "../state/state.module";

@Module({
  imports: [SharedUserDbModule, RedisModule, StateModule],
  providers: [StrategyRegistryService, WasmWorkerPoolService],
  exports: [StrategyRegistryService],
})
export class StrategyModule {}
