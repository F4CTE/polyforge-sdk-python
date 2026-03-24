import { Module } from "@nestjs/common";
import { SharedDbModule } from "@polyforge/shared-db";
import { TradeReconcilerService } from "./trade-reconciler.service";
import { ClobClientModule } from "../clob-client/clob-client.module";

@Module({
  imports: [SharedDbModule, ClobClientModule],
  providers: [TradeReconcilerService],
  exports: [TradeReconcilerService],
})
export class ReconciliationModule {}
