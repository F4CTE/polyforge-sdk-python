import { Module } from "@nestjs/common";
import { RelayerModule } from "../relayer/relayer.module";
import { PolymarketCtfService } from "./ctf.service";

@Module({
  imports: [RelayerModule],
  providers: [PolymarketCtfService],
  exports: [PolymarketCtfService],
})
export class CtfModule {}
