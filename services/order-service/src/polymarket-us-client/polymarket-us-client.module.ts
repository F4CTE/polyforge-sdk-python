import { Module } from "@nestjs/common";
import { PolymarketUsClientService } from "./polymarket-us-client.service";

@Module({
  providers: [PolymarketUsClientService],
  exports: [PolymarketUsClientService],
})
export class PolymarketUsClientModule {}
