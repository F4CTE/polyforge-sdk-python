import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { OrdersController } from "./orders.controller";
import { OrdersService } from "./orders.service";
import { SharedDbModule } from "@polyforge/shared-db";
import { SignerClientModule } from "../signer-client/signer-client.module";
import { ClobClientModule } from "../clob-client/clob-client.module";
import { EventsModule } from "../events/events.module";
import { InternalAuthGuard } from "../common/internal-auth.guard";

@Module({
  imports: [
    SharedDbModule,
    SignerClientModule,
    ClobClientModule,
    EventsModule,
    JwtModule.register({}),
  ],
  controllers: [OrdersController],
  providers: [OrdersService, InternalAuthGuard],
  exports: [OrdersService],
})
export class OrdersModule {}
