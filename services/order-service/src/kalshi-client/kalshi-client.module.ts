import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { KalshiAuthService } from "./kalshi-auth.service";
import { KalshiRestService } from "./kalshi-rest.service";
import { KalshiWsService } from "./kalshi-ws.service";
import { KalshiAdapterService } from "./kalshi-adapter.service";
import { SportsDataController } from "./sports-data.controller";
import { InternalAuthGuard } from "../common/internal-auth.guard";

@Module({
  imports: [JwtModule.register({})],
  controllers: [SportsDataController],
  providers: [
    KalshiAuthService,
    KalshiRestService,
    KalshiWsService,
    KalshiAdapterService,
    InternalAuthGuard,
  ],
  exports: [KalshiAdapterService, KalshiRestService],
})
export class KalshiClientModule {}
