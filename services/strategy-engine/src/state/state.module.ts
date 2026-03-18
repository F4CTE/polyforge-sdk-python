import { Module } from "@nestjs/common";
import { StateService } from "./state.service";
import { RedisModule } from "@polyforge/shared-redis";

@Module({
  imports: [RedisModule],
  providers: [StateService],
  exports: [StateService],
})
export class StateModule {}
