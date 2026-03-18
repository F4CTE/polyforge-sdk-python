import { Module } from "@nestjs/common";
import { ClobClientService } from "./clob-client.service";

@Module({
  providers: [ClobClientService],
  exports: [ClobClientService],
})
export class ClobClientModule {}
