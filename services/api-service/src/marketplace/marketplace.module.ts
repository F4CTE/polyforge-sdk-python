import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { MarketplaceController } from "./marketplace.controller";
import { MarketplaceService } from "./marketplace.service";

@Module({
  imports: [JwtModule.register({})],
  controllers: [MarketplaceController],
  providers: [MarketplaceService],
})
export class MarketplaceModule {}
