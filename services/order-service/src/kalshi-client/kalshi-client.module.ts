import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { KalshiAuthService } from "./kalshi-auth.service";
import { KalshiRestService } from "./kalshi-rest.service";
import { KalshiWsService } from "./kalshi-ws.service";
import { KalshiAdapterService } from "./kalshi-adapter.service";
import { SportsDataController } from "./sports-data.controller";

@Module({
  imports: [JwtModule.register({})],
  controllers: [SportsDataController],
  providers: [
    KalshiAuthService,
    KalshiRestService,
    KalshiWsService,
    KalshiAdapterService,
  ],
  exports: [KalshiAdapterService, KalshiRestService],
})
export class KalshiClientModule {}
