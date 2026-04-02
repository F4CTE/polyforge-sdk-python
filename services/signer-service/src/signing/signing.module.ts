import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { RedisModule } from "@polyforge/shared-redis";
import { SigningController } from "./signing.controller";
import { SigningService } from "./signing.service";
import { CredentialsModule } from "../credentials/credentials.module";
import { GasSponsorModule } from "../gas/gas-sponsor.module";
import { InternalAuthGuard } from "../common/internal-auth.guard";

@Module({
  imports: [
    CredentialsModule,
    GasSponsorModule,
    JwtModule.register({}),
    RedisModule,
  ],
  controllers: [SigningController],
  providers: [SigningService, InternalAuthGuard],
})
export class SigningModule {}
