import { Module } from "@nestjs/common";
import { SharedUserDbModule } from "@polyforge/shared-db";
import { TradeReconcilerService } from "./trade-reconciler.service";
import { ClobClientModule } from "../clob-client/clob-client.module";
import { EventsModule } from "../events/events.module";

@Module({
  imports: [SharedUserDbModule, ClobClientModule, EventsModule],
  providers: [TradeReconcilerService],
  exports: [TradeReconcilerService],
})
export class ReconciliationModule {}
