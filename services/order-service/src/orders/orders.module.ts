import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { OrdersController } from "./orders.controller";
import { OrdersService } from "./orders.service";
import { SharedUserDbModule } from "@polyforge/shared-db";
import { SignerClientModule } from "../signer-client/signer-client.module";
import { ClobClientModule } from "../clob-client/clob-client.module";
import { EventsModule } from "../events/events.module";
import { InternalAuthGuard } from "../common/internal-auth.guard";
import { VenueModule } from "../venue/venue.module";

@Module({
  imports: [
    SharedUserDbModule,
    SignerClientModule,
    ClobClientModule,
    EventsModule,
    JwtModule.register({}),
    VenueModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService, InternalAuthGuard],
  exports: [OrdersService],
})
export class OrdersModule {}
