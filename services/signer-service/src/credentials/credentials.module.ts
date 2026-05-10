import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { RedisModule } from "@polyforge/shared-redis";
import { CredentialsController } from "./credentials.controller";
import { CredentialsService } from "./credentials.service";
import { EncryptionModule } from "../encryption/encryption.module";
import { SharedUserDbModule } from "@polyforge/shared-db";
import { InternalAuthGuard } from "../common/internal-auth.guard";

@Module({
  imports: [
    SharedUserDbModule,
    EncryptionModule,
    JwtModule.register({}),
    RedisModule,
  ],
  controllers: [CredentialsController],
  providers: [CredentialsService, InternalAuthGuard],
  exports: [CredentialsService],
})
export class CredentialsModule {}
